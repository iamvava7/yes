// Maria: answers only about the property, from its facts; the Claude engine is
// exercised with a stand-in client (no network, no key), the FAQ engine directly.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAssistant, factsOf, faqAnswer, parseChat } from '../server/assistant.js';

const space = {
  name: 'Sample', scans: [
    { id: 's1', name: 'Living room', capture: { method: 'guided', at: '2026-09-12T10:00:00.000Z' } },
    { id: 's2', name: 'Bedroom' },
  ],
  rooms: [
    { name: 'Living room', height: 2.7, points: [[0, 0], [5, 0], [5, 4], [0, 4]] },
    { name: 'Bedroom', height: 2.7, points: [[5, 0], [8.5, 0], [8.5, 4], [5, 4]] },
  ],
  listing: { address: 'Str. Caramfil 10', price: 145000, currency: 'EUR', status: 'For sale', contactName: 'Andrei', contactPhone: '+40 712 345 678', description: 'Bright flat with a south-facing balcony.' },
  verificasa: { title: '2 camere Aviației', zone: 'Aviației', city: 'București', rooms: 2, transaction: 'SALE', latitude: 44.48012, longitude: 26.09514, url: 'https://verificasa.ro/property/p1' },
};

test('facts: rooms with areas, approximate location, capture date', () => {
  const f = factsOf(space);
  assert.deepEqual(f.rooms.map((r) => [r.name, r.area, r.ceiling]), [['Living room', 20, 2.7], ['Bedroom', 14, 2.7]]);
  assert.equal(f.surface, 34, 'total of the traced rooms');
  assert.deepEqual(f.location, { latitude: 44.48, longitude: 26.095 }, 'rounded to ~100 m');
  assert.equal(f.capturedAt, '2026-09-12T10:00:00.000Z');
});

test('FAQ: price, location with map, rooms, walking to a room — in Romanian and English', () => {
  const f = factsOf(space);
  const price = faqAnswer(f, 'Cât costă?', 'ro');
  assert.match(price.reply, /145\.000 EUR/);
  const where = faqAnswer(f, 'Where is this exactly?', 'en');
  assert.match(where.reply, /Aviației, București/);
  assert.deepEqual(where.actions[0], { type: 'map', latitude: 44.48, longitude: 26.095, label: 'Aviației, București' });
  const rooms = faqAnswer(f, 'Câte camere are?', 'ro');
  assert.match(rooms.reply, /2 camere: Living room 20,0 m², Bedroom 14,0 m²/);
  const go = faqAnswer(f, 'Take me to the bedroom', 'en');
  assert.deepEqual(go.actions, [{ type: 'goto', scanId: 's2', name: 'Bedroom' }]);
  const ceiling = faqAnswer(f, 'what is the ceiling height', 'en');
  assert.match(ceiling.reply, /2\.70 m/);
  assert.match(faqAnswer(f, 'Tell me about this flat', 'en').reply, /south-facing balcony/);
  const verified = faqAnswer(f, 'Is this real or a scam?', 'en');
  assert.match(verified.reply, /captured on site/);
});

test('FAQ: stays on this property', () => {
  const f = factsOf(space);
  const off = faqAnswer(f, 'Write me a poem about football', 'en');
  assert.match(off.reply, /only help with this property/);
  assert.deepEqual(off.actions, []);
  const unknown = faqAnswer(f, 'Is parking included in the price of the rent?', 'en');
  assert.ok(unknown.actions.some((a) => a.type === 'inquiry'));
});

test('chat input is validated', () => {
  assert.throws(() => parseChat({ messages: [] }), /send 1 to 20/);
  assert.throws(() => parseChat({ messages: [{ role: 'assistant', content: 'hi' }] }), /last message/);
  const ok = parseChat({ messages: [{ role: 'user', content: 'x'.repeat(5000) }], lang: 'ro' });
  assert.equal(ok.messages[0].content.length, 600);
  assert.equal(ok.lang, 'ro');
});

test('Claude engine: property-only system prompt, tools turned into page actions', async () => {
  let request;
  const client = {
    beta: {
      messages: {
        async create(req) {
          request = req;
          return {
            stop_reason: 'tool_use',
            content: [
              { type: 'text', text: 'Este în Aviației. Te duc și în dormitor.' },
              { type: 'tool_use', name: 'show_map', input: {} },
              { type: 'tool_use', name: 'go_to_room', input: { spot_id: 's2' } },
              { type: 'tool_use', name: 'go_to_room', input: { spot_id: 'nope' } },
            ],
          };
        },
      },
    },
  };
  const maria = createAssistant({ client });
  assert.equal(maria.engine, 'claude');
  const out = await maria.answer(space, parseChat({ messages: [{ role: 'user', content: 'Unde e și arată-mi dormitorul' }], lang: 'ro' }));
  assert.equal(out.engine, 'claude');
  assert.equal(out.reply, 'Este în Aviației. Te duc și în dormitor.');
  assert.deepEqual(out.actions, [
    { type: 'map', latitude: 44.48, longitude: 26.095, label: 'Aviației, București' },
    { type: 'goto', scanId: 's2', name: 'Bedroom' },
  ]);
  assert.equal(request.model, 'claude-opus-5-5');
  assert.match(request.system, /answer only questions about this property/);
  assert.match(request.system, /"price": 145000/);
  assert.match(request.system, /default Romanian/);
  assert.deepEqual(request.tools.map((t) => t.name), ['show_map', 'go_to_room', 'open_inquiry']);
  assert.equal(request.tool_choice.type, 'auto');
});

test('Claude engine falls back to the built-in answers on any error', async () => {
  const client = { beta: { messages: { async create() { throw new Error('overloaded'); } } } };
  const out = await createAssistant({ client }).answer(space, parseChat({ messages: [{ role: 'user', content: 'How much?' }] }));
  assert.equal(out.engine, 'faq');
  assert.match(out.reply, /145,000 EUR/);
});
