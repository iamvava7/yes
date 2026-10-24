// Outgoing email. With RESEND_API_KEY set, mail goes out through Resend
// (resend.com, free tier 3,000 emails/month). Without it nothing is sent:
// each message is printed to the server log and kept in data/outbox, so
// sign-up codes still work while testing.

import fs from 'node:fs/promises';
import path from 'node:path';

export function createMailer({ dataDir, env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  const from = env.MAIL_FROM || 'VerifiCasa <no-reply@verificasa.ro>';
  const outbox = dataDir ? path.join(dataDir, 'outbox') : null;
  const sent = []; // last messages, for tests

  async function send({ to, subject, html, text, fromName }) {
    if (!to) throw new Error('missing recipient');
    const sender = fromName ? from.replace(/^[^<]*</, `${fromName} <`) : from;
    const msg = { to, subject, html, text, from: sender, at: new Date().toISOString() };
    sent.push(msg);
    if (sent.length > 50) sent.shift();
    if (env.RESEND_API_KEY) {
      const r = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: sender, to: [].concat(to), subject, html, text }),
      });
      if (!r.ok) throw new Error(`email not sent: Resend HTTP ${r.status} ${await r.text().catch(() => '')}`.trim());
      return { ok: true, provider: 'resend' };
    }
    log(`[mail] to ${to}: ${subject}${text ? `\n${text}` : ''}`);
    if (outbox) {
      await fs.mkdir(outbox, { recursive: true });
      await fs.writeFile(path.join(outbox, `${Date.now()}-${String(to).replace(/[^a-z0-9@.]/gi, '_')}.json`), JSON.stringify(msg, null, 2));
    }
    return { ok: true, provider: 'log' };
  }

  return { send, sent, configured: Boolean(env.RESEND_API_KEY) };
}
