import { lang, t } from '../i18n.js';
import { h } from '../ui.js';

// Maria, the VerifiCasa assistant on the tour page. Opened only from her orb
// button. She answers questions about this property (server: /assistant),
// and her answers can carry actions the page performs: a map of the area,
// walking the tour to a room, ways to contact the lister.

export function createMaria(root, { spaceId, title, viewer, listingUrl, contact }) {
  const history = []; // [{ role, content }] sent to the server
  let open = false;
  let speaking = loadVoice();
  let busy = false;

  const orbBtn = h('button.maria-orb-btn', { 'aria-label': t('Ask Maria, the VerifiCasa assistant'), 'aria-expanded': 'false', onclick: () => toggle(true) },
    h('span.maria-orb', h('span'), h('span'), h('span')), h('span.maria-orb-label', 'Maria'));
  const log = h('div.maria-log', { role: 'log', 'aria-live': 'polite' });
  const input = h('input.maria-input', {
    type: 'text', maxLength: 600, autocomplete: 'off', placeholder: t('Ask Maria about this home…'), 'aria-label': t('Your question for Maria'),
    onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); send(input.value); } },
  });
  const mic = speechRecognition() ? h('button.maria-mic', { 'aria-label': t('Speak your question'), onclick: listen }, micIcon()) : null;
  const voiceBtn = h('button.maria-icon', { onclick: () => setVoice(!speaking) });
  const chips = h('div.maria-chips',
    chip(t('About the price'), t('How much does it cost?')),
    chip(t('Rooms & sizes'), t('What rooms does it have and how big are they?')),
    chip(t('Location & area'), t('Where is it exactly?')),
    chip(t('Take me to…'), t('Show me the rooms')),
    chip(t('Book a viewing'), t('I would like to arrange a viewing')),
  );
  const panel = h('section.maria', { role: 'dialog', 'aria-label': t('Maria, the VerifiCasa assistant'), hidden: true },
    h('header.maria-head',
      h('span.maria-orb.small', h('span'), h('span'), h('span')),
      h('div.maria-title', h('strong', 'Maria'), h('span', t('VerifiCasa AI · only about this home'))),
      voiceBtn,
      h('button.maria-icon', { 'aria-label': t('Close'), onclick: () => toggle(false) }, closeIcon())),
    log,
    h('div.maria-foot', chips, h('div.maria-bar', input, mic)),
    h('div.maria-glow', { 'aria-hidden': 'true' }));
  root.append(orbBtn, panel);
  setVoice(speaking);
  say(t('Hi! I’m Maria. I’ll help you explore {title}. Ask me about the price, the rooms, the area, or how to arrange a viewing.', { title }), [], { speak: false });

  function toggle(on) {
    open = on;
    panel.hidden = !on;
    root.classList.toggle('maria-open', on);
    orbBtn.setAttribute('aria-expanded', String(on));
    if (on) setTimeout(() => input.focus(), 50);
    else window.speechSynthesis?.cancel?.();
  }

  function chip(label, question) {
    return h('button.maria-chip', { onclick: () => send(question) }, label);
  }

  async function send(text) {
    const q = text.trim();
    if (!q || busy) return;
    input.value = '';
    log.append(h('p.maria-msg.user', q));
    history.push({ role: 'user', content: q });
    busy = true;
    panel.classList.add('thinking');
    const typing = h('p.maria-msg.typing', h('span'), h('span'), h('span'));
    log.append(typing);
    scroll();
    try {
      const res = await fetch(`/api/spaces/${spaceId}/assistant`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-20), lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      typing.remove();
      history.push({ role: 'assistant', content: data.reply });
      say(data.reply, data.actions ?? []);
    } catch (err) {
      typing.remove();
      history.pop();
      say(t('Sorry, I couldn’t answer just now ({error}). Try again in a moment.', { error: err.message }), [], { speak: false });
    } finally {
      busy = false;
      panel.classList.remove('thinking');
    }
  }

  function say(text, actions, { speak = true } = {}) {
    const msg = h('div.maria-msg.bot', h('p', text), ...actions.map(renderAction).filter(Boolean));
    log.append(msg);
    scroll();
    if (speak && speaking && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'ro' ? 'ro-RO' : 'en-GB';
      speechSynthesis.speak(u);
    }
    // a single "walk there" answer walks there straight away
    const gotos = actions.filter((a) => a.type === 'goto');
    if (gotos.length === 1) viewer.goToScan(gotos[0].scanId);
  }

  function renderAction(a) {
    if (a.type === 'map') return mapCard(a);
    if (a.type === 'goto') return h('button.maria-action', { onclick: () => viewer.goToScan(a.scanId) }, t('Go to {name}', { name: a.name }));
    if (a.type === 'inquiry') return contactCard();
    return null;
  }

  function mapCard(a) {
    if (Number.isFinite(a.latitude) && Number.isFinite(a.longitude)) {
      const d = 0.006, bbox = [a.longitude - d * 1.5, a.latitude - d, a.longitude + d * 1.5, a.latitude + d].map((v) => v.toFixed(5)).join(',');
      return h('figure.maria-map',
        h('iframe', { src: `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${a.latitude},${a.longitude}`, title: t('Map of {place}', { place: a.label }), loading: 'lazy' }),
        h('figcaption', h('span', t('Approximate area')),
          h('a', { href: `https://www.google.com/maps/search/?api=1&query=${a.latitude},${a.longitude}`, target: '_blank', rel: 'noopener' }, t('Open in Maps'))));
    }
    return h('a.maria-action', { href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.query ?? a.label)}`, target: '_blank', rel: 'noopener' }, t('Open in Maps'));
  }

  function contactCard() {
    const msg = t('Hello! I saw the 3D tour of {title} on VerifiCasa and I’d like to know more.', { title });
    const digits = contact.phone?.replace(/[^\d]/g, '');
    const links = [
      contact.phone ? h('a.maria-action', { href: `tel:${contact.phone.replace(/[^\d+]/g, '')}` }, t('Call')) : null,
      digits ? h('a.maria-action', { href: `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, target: '_blank', rel: 'noopener' }, 'WhatsApp') : null,
      contact.email ? h('a.maria-action', { href: `mailto:${contact.email}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(msg)}` }, t('Email')) : null,
      listingUrl ? h('a.maria-action', { href: listingUrl, target: '_blank', rel: 'noopener' }, t('Message on VerifiCasa')) : null,
    ].filter(Boolean);
    return links.length ? h('div.maria-actions', links) : null;
  }

  function scroll() { log.scrollTop = log.scrollHeight; }

  function setVoice(on) {
    speaking = on;
    try { localStorage.setItem('maria-voice', on ? '1' : '0'); } catch { /* private mode */ }
    voiceBtn.replaceChildren(on ? speakerIcon() : muteIcon());
    voiceBtn.setAttribute('aria-label', on ? t('Stop reading answers aloud') : t('Read answers aloud'));
    voiceBtn.setAttribute('aria-pressed', String(on));
    if (!on) window.speechSynthesis?.cancel?.();
  }

  function listen() {
    const Rec = speechRecognition();
    const rec = new Rec();
    rec.lang = lang === 'ro' ? 'ro-RO' : 'en-GB';
    rec.interimResults = false;
    mic.classList.add('on');
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => mic.classList.remove('on');
    rec.onerror = () => mic.classList.remove('on');
    rec.start();
  }

  return { toggle, ask: send, panel, button: orbBtn };
}

function loadVoice() { try { return localStorage.getItem('maria-voice') === '1'; } catch { return false; } }
function speechRecognition() { return window.SpeechRecognition || window.webkitSpeechRecognition || null; }

const svg = (d) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('viewBox', '0 0 24 24');
  el.setAttribute('width', '18');
  el.setAttribute('height', '18');
  el.setAttribute('fill', 'none');
  el.setAttribute('stroke', 'currentColor');
  el.setAttribute('stroke-width', '1.8');
  el.setAttribute('stroke-linecap', 'round');
  el.setAttribute('stroke-linejoin', 'round');
  el.innerHTML = d;
  return el;
};
const micIcon = () => svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>');
const speakerIcon = () => svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>');
const muteIcon = () => svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/>');
const closeIcon = () => svg('<path d="M6 6l12 12M18 6 6 18"/>');
