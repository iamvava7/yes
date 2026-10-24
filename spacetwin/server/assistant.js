// Maria, the VerifiCasa assistant on a tour: answers questions about this one
// property and nothing else, from what the listing and the tour already say.
//
// Two engines with the same contract ({ reply, actions }):
//   - Claude, when the server has Anthropic credentials (ANTHROPIC_API_KEY):
//     natural answers in the visitor's language, restricted by the system
//     prompt to the property's facts, with tools for the viewer's actions.
//   - A built-in FAQ engine otherwise (and as the fallback on any error), so
//     Maria always answers the common questions, free and offline.
//
// Actions the page carries out: { type: 'map', latitude, longitude, label },
// { type: 'goto', scanId, name }, { type: 'inquiry' }, { type: 'contact', ... }.
import Anthropic from '@anthropic-ai/sdk';
import { polygonArea } from '../shared/geometry.js';

const MODEL = process.env.SPACETWIN_ASSISTANT_MODEL || 'claude-opus-5-5';
const MAX_TURNS = 20;
const MAX_CHARS = 600;

/** What the assistant may say about a space: listing, rooms, tour, location. */
export function factsOf(space) {
  const l = space.listing ?? {};
  const vc = space.verificasa ?? {};
  const rooms = space.rooms.map((r) => ({ name: r.name, area: round1(polygonArea(r.points)), ceiling: round2(r.height) }));
  const total = rooms.reduce((s, r) => s + r.area, 0);
  return {
    title: l.address || vc.title || space.name,
    status: l.status ?? null,
    price: l.price ?? null,
    currency: l.currency || 'EUR',
    transaction: vc.transaction ?? (l.status === 'For rent' ? 'RENT' : l.status === 'For sale' ? 'SALE' : null),
    description: l.description ?? null,
    beds: l.beds ?? null,
    baths: l.baths ?? null,
    yearBuilt: l.yearBuilt ?? null,
    roomsCount: vc.rooms ?? null,
    surface: vc.surface ?? (total > 0 ? round1(total) : null),
    rooms,
    place: [vc.zone, vc.city].filter(Boolean).join(', ') || null,
    // approximate (≈100 m) so the tour never pins the exact door
    location: Number.isFinite(vc.latitude) && Number.isFinite(vc.longitude)
      ? { latitude: round3(vc.latitude), longitude: round3(vc.longitude) } : null,
    contactName: l.contactName ?? vc.posterName ?? null,
    contactPhone: l.contactPhone ?? null,
    contactEmail: l.contactEmail ?? null,
    listingUrl: vc.url ?? null,
    spots: space.scans.map((s) => ({ id: s.id, name: s.name })),
    capturedAt: space.scans.map((s) => s.capture?.method === 'guided' && s.capture.at).filter(Boolean).sort().at(-1) ?? null,
  };
}

/** Validate the chat history a page sends. */
export function parseChat(body) {
  const msgs = body?.messages;
  if (!Array.isArray(msgs) || !msgs.length || msgs.length > MAX_TURNS) throw new Error(`send 1 to ${MAX_TURNS} messages`);
  const out = msgs.map((m) => {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string' || !m.content.trim()) {
      throw new Error('each message needs role user|assistant and text content');
    }
    return { role: m.role, content: m.content.trim().slice(0, MAX_CHARS) };
  });
  if (out.at(-1).role !== 'user') throw new Error('the last message must be the visitor’s');
  return { messages: out, lang: body.lang === 'ro' ? 'ro' : 'en' };
}

// `apiKey` may be a function: the key is then looked up on every question, so
// one saved later in Admin → Integrări & chei API is used without a restart.
export function createAssistant({ client, apiKey } = {}) {
  let fixed = client ?? null;
  if (!fixed && !apiKey && (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) fixed = new Anthropic();
  let made = { key: null, client: null };
  const anthropic = () => {
    if (fixed) return fixed;
    const key = typeof apiKey === 'function' ? apiKey() : apiKey;
    if (!key) return null;
    if (made.key !== key) made = { key, client: new Anthropic({ apiKey: key }) };
    return made.client;
  };
  return {
    get engine() { return anthropic() ? 'claude' : 'faq'; },
    async answer(space, { messages, lang }) {
      const facts = factsOf(space);
      const ai = anthropic();
      if (ai) {
        try {
          return { ...(await claudeAnswer(ai, facts, messages, lang)), engine: 'claude' };
        } catch (err) {
          console.warn(`Maria: Claude unavailable (${err.message}); using the built-in answers`);
        }
      }
      return { ...faqAnswer(facts, messages.at(-1).content, lang), engine: 'faq' };
    },
  };
}

// ---------------------------------------------------------------- Claude

const TOOLS = [
  {
    name: 'show_map',
    description: 'Show the property\'s approximate location on a map in the chat. Use when the visitor asks where the property is, about the area, neighbourhood or distances.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'go_to_room',
    description: 'Walk the 3D tour to one of the capture spots. Use when the visitor asks to see or go to a room.',
    input_schema: {
      type: 'object',
      properties: { spot_id: { type: 'string', description: 'The id of a spot from the property facts.' } },
      required: ['spot_id'],
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'open_inquiry',
    description: 'Open the form to send a question or a viewing request to the person who listed the property. Use when the visitor wants to visit, make an offer, or ask something the facts do not answer.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
];

function systemPrompt(facts) {
  return `You are Maria, the VerifiCasa assistant shown inside the 3D tour of one property on verificasa.ro, a Romanian real-estate site.

Scope: answer only questions about this property, its tour and its area, using the facts below. If something is not in the facts, say you don't know and offer to send the question to the lister (open_inquiry). Decline anything unrelated to this property in one friendly sentence and steer back. Never invent prices, measurements, legal or financial details. Do not give legal, tax or mortgage advice beyond pointing to the facts.

Style: reply in the visitor's language (Romanian or English; default ${'{lang}'}), warm and concise: one to three short sentences, no markdown headings or lists unless asked. Use the tools for actions: show_map for location questions, go_to_room to walk the tour to a room, open_inquiry for viewings, offers or unanswered questions.

Property facts (JSON):
${JSON.stringify(facts, null, 1)}`;
}

async function claudeAnswer(client, facts, messages, lang) {
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 1024,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low' },
    system: systemPrompt(facts).replace('{lang}', lang === 'ro' ? 'Romanian' : 'English'),
    tools: TOOLS,
    tool_choice: { type: 'auto' },
    messages,
  });
  if (response.stop_reason === 'refusal') return { reply: lang === 'ro' ? 'Pot răspunde doar la întrebări despre această locuință.' : 'I can only help with questions about this property.', actions: [] };
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  const actions = [];
  for (const b of response.content) {
    if (b.type !== 'tool_use') continue;
    if (b.name === 'show_map' && facts.location) actions.push({ type: 'map', ...facts.location, label: facts.place ?? facts.title });
    if (b.name === 'go_to_room') {
      const spot = facts.spots.find((s) => s.id === b.input?.spot_id);
      if (spot) actions.push({ type: 'goto', scanId: spot.id, name: spot.name });
    }
    if (b.name === 'open_inquiry') actions.push({ type: 'inquiry' });
  }
  const fallback = actions.length ? (lang === 'ro' ? 'Sigur, iată.' : 'Sure, here you go.') : (lang === 'ro' ? 'Nu am un răspuns acum.' : 'I don’t have an answer right now.');
  return { reply: text || fallback, actions };
}

// ---------------------------------------------------------------- built-in FAQ

const INTENTS = [
  ['location', /\b(unde|where|loca[tț]i|adres|address|map|hart[aă]|zon[aă]|cartier|area|neighbou?rhood|metrou|metro|transport|near|aproape)/i],
  ['goto', /\b(du-m[aă]|du ma|arat[aă]-mi|show me|take me|go to|mergi|vreau s[aă] v[aă]d)\b/i],
  ['price', /\b(pre[tț]|price|cost|c[aâ]t cost|how much|eur|euro|lei|chiri[ae]|rent|negociabil|negotiable)/i],
  ['rooms', /\b(camer|rooms?|dormitoar|bedrooms?|b[aă]i|baie|bath|living|buc[aă]t[aă]ri|kitchen|layout|compartiment)/i],
  ['area', /\b(suprafa[tț]|area|size|metri|mp\b|m²|m2|sqm|square|cât de mare|how big)/i],
  ['ceiling', /\b([iî]n[aă]l[tț]im|ceiling|height|tavan)/i],
  ['contact', /\b(contact|telefon|phone|sun|call|agent|proprietar|owner|email|vizionare|viewing|visit|program)/i],
  ['year', /\b(an(ul)? construc|built|year|vechime|age)/i],
  ['verified', /\b(verificat|verified|real|fals|fake|scam|țeap|teap|adevărat|genuine)/i],
  ['about', /\b(despre (ea|el|apartament|cas|locuin|proprietate)|about (it|this|the (property|place|flat|apartment|house|home))|descri|tell me about (it|this)|spune-mi despre|detalii|details|ce are|features|dot[aă]ri)/i],
  ['hello', /^(bun[aă]|salut|hello|hi|hey|servus|ziua)\b/i],
];

export function faqAnswer(f, question, lang) {
  const ro = lang === 'ro';
  const T = (en, roText) => (ro ? roText : en);
  const intent = INTENTS.find(([, re]) => re.test(question))?.[0] ?? null;
  const money = (v) => `${Math.round(v).toLocaleString(ro ? 'ro-RO' : 'en-GB')} ${f.currency}`;
  const roomsText = f.rooms.length
    ? f.rooms.map((r) => `${r.name} ${fmt(r.area, ro)} m²`).join(', ')
    : null;

  // a named room → walk there
  const spot = f.spots.find((s) => question.toLowerCase().includes(s.name.toLowerCase()));
  if (spot && (intent === 'goto' || intent === null)) {
    return { reply: T(`Taking you to the ${spot.name}.`, `Te duc în ${spot.name}.`), actions: [{ type: 'goto', scanId: spot.id, name: spot.name }] };
  }

  switch (intent) {
    case 'hello':
      return { reply: T(`Hi! I’m Maria. Ask me anything about ${f.title}: price, rooms, location, or how to arrange a viewing.`, `Bună! Sunt Maria. Întreabă-mă orice despre ${f.title}: preț, camere, locație sau cum programezi o vizionare.`), actions: [] };
    case 'location': {
      const where = f.place ?? f.title;
      if (f.location) return { reply: T(`It’s in ${where}. Here’s the area on the map (approximate, for privacy).`, `Se află în ${where}. Iată zona pe hartă (aproximativ, pentru confidențialitate).`), actions: [{ type: 'map', ...f.location, label: where }] };
      return { reply: T(`The listing gives the address as ${where}.`, `Adresa din anunț este ${where}.`), actions: [{ type: 'map', query: where, label: where }] };
    }
    case 'goto':
      if (f.spots.length) return { reply: T(`Which room? ${f.spots.map((s) => s.name).join(', ')}.`, `În ce cameră? ${f.spots.map((s) => s.name).join(', ')}.`), actions: f.spots.map((s) => ({ type: 'goto', scanId: s.id, name: s.name })) };
      break;
    case 'price':
      if (f.price != null) {
        const per = f.transaction === 'RENT' ? T(' per month', ' pe lună') : '';
        const sqm = f.surface && f.transaction !== 'RENT' ? T(` (about ${money(f.price / f.surface)}/m²)`, ` (aproximativ ${money(f.price / f.surface)}/m²)`) : '';
        return { reply: T(`The asking price is ${money(f.price)}${per}${sqm}. For negotiation, ask the lister directly.`, `Prețul cerut este ${money(f.price)}${per}${sqm}. Pentru negociere, întreabă direct pe cel care a publicat anunțul.`), actions: [{ type: 'inquiry' }] };
      }
      break;
    case 'rooms':
      if (roomsText || f.roomsCount != null) {
        const count = f.roomsCount ?? f.rooms.length;
        return { reply: T(`${count} room${count === 1 ? '' : 's'}${roomsText ? `: ${roomsText}` : ''}.${f.baths != null ? ` ${f.baths} bathroom${f.baths === 1 ? '' : 's'}.` : ''}`, `${count} ${count === 1 ? 'cameră' : 'camere'}${roomsText ? `: ${roomsText}` : ''}.${f.baths != null ? ` ${f.baths} ${f.baths === 1 ? 'baie' : 'băi'}.` : ''}`), actions: f.spots.map((s) => ({ type: 'goto', scanId: s.id, name: s.name })) };
      }
      break;
    case 'area':
      if (f.surface) return { reply: T(`About ${fmt(f.surface, ro)} m² in total${roomsText ? ` (${roomsText})` : ''}, measured in the 3D tour.`, `Aproximativ ${fmt(f.surface, ro)} m² în total${roomsText ? ` (${roomsText})` : ''}, măsurat în turul 3D.`), actions: [] };
      break;
    case 'ceiling':
      if (f.rooms.length) {
        const h = [...new Set(f.rooms.map((r) => fmt(r.ceiling, ro, 2)))];
        return { reply: T(`Ceiling height: ${h.join(' / ')} m. You can measure anything yourself with the ruler in the tour.`, `Înălțimea tavanului: ${h.join(' / ')} m. Poți măsura orice cu rigla din tur.`), actions: [] };
      }
      break;
    case 'contact':
      return {
        reply: T(`You can reach ${f.contactName ?? 'the lister'}${f.contactPhone ? ` at ${f.contactPhone}` : ''}, or send a message from here.`, `Îl poți contacta pe ${f.contactName ?? 'cel care a publicat anunțul'}${f.contactPhone ? ` la ${f.contactPhone}` : ''} sau poți trimite un mesaj de aici.`),
        actions: [{ type: 'inquiry' }, ...(f.contactPhone ? [{ type: 'contact', phone: f.contactPhone }] : [])],
      };
    case 'year':
      if (f.yearBuilt) return { reply: T(`Built in ${f.yearBuilt}.`, `Construit în ${f.yearBuilt}.`), actions: [] };
      break;
    case 'verified':
      if (f.capturedAt) return { reply: T(`This tour was captured on site with the VerifiCasa app on ${dateText(f.capturedAt, ro)}, so what you see is the real place.`, `Turul a fost filmat la fața locului cu aplicația VerifiCasa pe ${dateText(f.capturedAt, ro)}, deci vezi locuința reală.`), actions: [] };
      return { reply: T('The photos are the lister’s. For extra certainty, ask for a viewing.', 'Fotografiile sunt ale celui care a publicat anunțul. Pentru siguranță, cere o vizionare.'), actions: [{ type: 'inquiry' }] };
    case 'about':
      if (f.description) return { reply: f.description.length > 420 ? `${f.description.slice(0, 400).trim()}…` : f.description, actions: [] };
      break;
    default:
      break;
  }
  // nothing in the facts answers it: be honest and offer the lister
  return {
    reply: intent
      ? T('The listing doesn’t say. Want me to send your question to the lister?', 'Anunțul nu spune. Vrei să trimit întrebarea celui care a publicat anunțul?')
      : T('I can only help with this property: its price, rooms and sizes, location, or a viewing. What would you like to know?', 'Te pot ajuta doar cu această locuință: preț, camere și suprafețe, locație sau o vizionare. Ce vrei să afli?'),
    actions: intent ? [{ type: 'inquiry' }] : [],
  };
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const round3 = (v) => Math.round(v * 1000) / 1000;
const fmt = (v, ro, d = 1) => v.toLocaleString(ro ? 'ro-RO' : 'en-GB', { minimumFractionDigits: d, maximumFractionDigits: d });
const dateText = (iso, ro) => new Date(iso).toLocaleDateString(ro ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
