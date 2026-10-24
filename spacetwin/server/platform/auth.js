// Accounts for the VerifiCasa website: email + password with a 6-digit code
// sent by email, password reset links, and Google sign-in. Sessions are
// signed tokens (HMAC-SHA256); changing the password or signing out
// everywhere bumps token_version, which voids every older token.

import { createHmac, randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { newRecordId } from './db.js';
import { PlatformError } from './entities.js';

const scrypt = promisify(scryptCb);
const DAY = 24 * 3600 * 1000;
const TOKEN_DAYS = 30;
const OTP_MINUTES = 15;
const RESET_HOURS = 2;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sha = (secret, s) => createHmac('sha256', secret).update(s).digest('base64url');

function sameString(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${b64(salt)}$${b64(key)}`;
}

export async function checkPassword(pw, stored) {
  const [kind, salt, key] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !salt || !key) return false;
  const got = await scrypt(pw, Buffer.from(salt, 'base64url'), 64);
  return sameString(b64(got), key);
}

export function createAuth({ db, entities, mailer, env = process.env, appUrl }) {
  const secret = env.PLATFORM_SECRET || db.setting('platform_secret', () => randomBytes(32).toString('base64url'));
  const adminEmails = new Set(String(env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
  const site = () => (env.APP_URL || appUrl || 'http://localhost:3000').replace(/\/$/, '');
  const svc = entities.handler('User', { service: true });

  const q = {
    byEmail: db.sql.prepare('SELECT * FROM credentials WHERE email = ?'),
    byUser: db.sql.prepare('SELECT * FROM credentials WHERE user_id = ?'),
    byGoogle: db.sql.prepare('SELECT * FROM credentials WHERE google_sub = ?'),
    insert: db.sql.prepare('INSERT INTO credentials (user_id, email, password_hash, email_verified, google_sub) VALUES (?, ?, ?, ?, ?)'),
    setOtp: db.sql.prepare('UPDATE credentials SET otp_hash = ?, otp_expires = ?, otp_tries = 0 WHERE user_id = ?'),
    tries: db.sql.prepare('UPDATE credentials SET otp_tries = otp_tries + 1 WHERE user_id = ?'),
    verified: db.sql.prepare('UPDATE credentials SET email_verified = 1, otp_hash = NULL, otp_expires = NULL, otp_tries = 0 WHERE user_id = ?'),
    setPassword: db.sql.prepare('UPDATE credentials SET password_hash = ?, token_version = token_version + 1, reset_hash = NULL, reset_expires = NULL WHERE user_id = ?'),
    setReset: db.sql.prepare('UPDATE credentials SET reset_hash = ?, reset_expires = ? WHERE user_id = ?'),
    byReset: db.sql.prepare('SELECT * FROM credentials WHERE reset_hash = ?'),
    setGoogle: db.sql.prepare('UPDATE credentials SET google_sub = ?, email_verified = 1 WHERE user_id = ?'),
    bump: db.sql.prepare('UPDATE credentials SET token_version = token_version + 1 WHERE user_id = ?'),
    remove: db.sql.prepare('DELETE FROM credentials WHERE user_id = ?'),
  };

  entities.bus.on('user-deleted', (u) => q.remove.run(u.id));

  const normEmail = (e) => String(e || '').trim().toLowerCase();

  function issue(userId) {
    const cred = q.byUser.get(userId);
    const body = b64(JSON.stringify({ sub: userId, v: cred?.token_version ?? 0, exp: Date.now() + TOKEN_DAYS * DAY }));
    return `${body}.${sha(secret, body)}`;
  }

  function userFromToken(token) {
    if (!token || typeof token !== 'string') return null;
    const [body, sig] = token.split('.');
    if (!body || !sig || !sameString(sig, sha(secret, body))) return null;
    let p;
    try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
    if (!p.sub || p.exp < Date.now()) return null;
    const cred = q.byUser.get(p.sub);
    if (!cred || cred.token_version !== p.v) return null;
    const user = db.get('User', p.sub);
    return user ?? null;
  }

  // The User record every part of the site reads (full_name, role, ...).
  async function createUser(email, fullName) {
    const now = new Date().toISOString();
    const rec = {
      ...Object.fromEntries(Object.entries(entities.schemas.get('User')?.properties ?? {})
        .filter(([, p]) => p && 'default' in p).map(([k, p]) => [k, structuredClone(p.default)])),
      id: newRecordId(), email, full_name: fullName || '', role: adminEmails.has(email) ? 'SUPER_ADMIN' : 'user',
      created_date: now, updated_date: now, created_by: email, created_by_id: null,
    };
    rec.created_by_id = rec.id;
    db.put('User', rec);
    entities.bus.emit('change', { entity: 'User', type: 'create', id: rec.id, data: rec, timestamp: now });
    return rec;
  }

  // ADMIN_EMAILS always get SUPER_ADMIN, so the owner can never lock themselves out.
  async function promote(user) {
    if (user && adminEmails.has(normEmail(user.email)) && user.role !== 'SUPER_ADMIN') {
      return svc.update(user.id, { role: 'SUPER_ADMIN' });
    }
    return user;
  }

  async function sendOtp(cred) {
    const code = String(randomInt(0, 1e6)).padStart(6, '0');
    q.setOtp.run(sha(secret, `otp:${cred.user_id}:${code}`), Date.now() + OTP_MINUTES * 60e3, cred.user_id);
    await mailer.send({
      to: cred.email,
      subject: `Codul tău VerifiCasa: ${code}`,
      text: `Codul de confirmare VerifiCasa este ${code}. Expiră în ${OTP_MINUTES} minute.\nYour VerifiCasa code is ${code}.`,
      html: `<p>Codul de confirmare VerifiCasa este:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Expiră în ${OTP_MINUTES} minute. Dacă nu tu ai cerut codul, ignoră acest email.</p>`,
    });
  }

  function session(user) {
    return { access_token: issue(user.id), user };
  }

  return {
    secret,
    userFromToken,
    issue,
    providers: () => ({ google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET), email: true }),

    async register({ email, password, full_name }) {
      email = normEmail(email);
      if (!EMAIL_RE.test(email)) throw new PlatformError(400, 'Adresa de email nu e validă.');
      if (typeof password !== 'string' || password.length < 8) throw new PlatformError(400, 'Parola trebuie să aibă cel puțin 8 caractere.');
      if (password.length > 200) throw new PlatformError(400, 'Parola e prea lungă.');
      let cred = q.byEmail.get(email);
      if (cred?.email_verified) throw new PlatformError(409, 'Există deja un cont cu acest email. Intră în cont sau resetează parola.');
      if (cred) {
        q.setPassword.run(await hashPassword(password), cred.user_id);
      } else {
        const user = await createUser(email, full_name);
        q.insert.run(user.id, email, await hashPassword(password), 0, null);
      }
      cred = q.byEmail.get(email);
      await sendOtp(cred);
      return { ok: true, message: 'Verification code sent' };
    },

    async resendOtp(email) {
      const cred = q.byEmail.get(normEmail(email));
      if (cred && !cred.email_verified) await sendOtp(cred);
      return { ok: true }; // same answer either way: don't reveal who has an account
    },

    async verifyOtp({ email, otp_code }) {
      const cred = q.byEmail.get(normEmail(email));
      const bad = () => new PlatformError(400, 'Cod greșit sau expirat.');
      if (!cred || !cred.otp_hash) throw bad();
      if (cred.otp_tries >= 5 || cred.otp_expires < Date.now()) throw new PlatformError(400, 'Codul a expirat. Cere unul nou.');
      if (!sameString(cred.otp_hash, sha(secret, `otp:${cred.user_id}:${String(otp_code || '').trim()}`))) {
        q.tries.run(cred.user_id);
        throw bad();
      }
      q.verified.run(cred.user_id);
      return session(await promote(db.get('User', cred.user_id)));
    },

    async login({ email, password }) {
      const cred = q.byEmail.get(normEmail(email));
      const ok = cred && await checkPassword(String(password || ''), cred.password_hash);
      if (!ok) throw new PlatformError(401, 'Email sau parolă greșită.');
      if (!cred.email_verified) {
        await sendOtp(cred);
        throw new PlatformError(403, 'Confirmă adresa de email: ți-am trimis un cod nou.', { reason: 'email_not_verified' });
      }
      const user = db.get('User', cred.user_id);
      if (!user) throw new PlatformError(401, 'Email sau parolă greșită.');
      return session(await promote(user));
    },

    async resetRequest(email) {
      const cred = q.byEmail.get(normEmail(email));
      if (cred) {
        const token = randomBytes(24).toString('base64url');
        q.setReset.run(sha(secret, `reset:${token}`), Date.now() + RESET_HOURS * 3600e3, cred.user_id);
        const link = `${site()}/reset-password?token=${token}`;
        await mailer.send({
          to: cred.email,
          subject: 'Resetează parola VerifiCasa',
          text: `Deschide linkul ca să alegi o parolă nouă (valabil ${RESET_HOURS} ore): ${link}`,
          html: `<p>Ai cerut resetarea parolei VerifiCasa.</p><p><a href="${link}">Alege o parolă nouă</a> (valabil ${RESET_HOURS} ore).</p><p>Dacă nu tu ai cerut, ignoră acest email.</p>`,
        });
      }
      return { ok: true };
    },

    async reset({ reset_token, new_password }) {
      const cred = reset_token && q.byReset.get(sha(secret, `reset:${reset_token}`));
      if (!cred || cred.reset_expires < Date.now()) throw new PlatformError(400, 'Linkul de resetare a expirat. Cere unul nou.');
      if (typeof new_password !== 'string' || new_password.length < 8) throw new PlatformError(400, 'Parola trebuie să aibă cel puțin 8 caractere.');
      q.setPassword.run(await hashPassword(new_password), cred.user_id);
      q.verified.run(cred.user_id); // the link proved they own the address
      return { ok: true };
    },

    async changePassword(user, { current_password, new_password }) {
      const cred = user && q.byUser.get(user.id);
      if (!cred) throw new PlatformError(401, 'Trebuie să fii autentificat.');
      if (cred.password_hash && !await checkPassword(String(current_password || ''), cred.password_hash)) {
        throw new PlatformError(400, 'Parola actuală e greșită.');
      }
      if (typeof new_password !== 'string' || new_password.length < 8) throw new PlatformError(400, 'Parola trebuie să aibă cel puțin 8 caractere.');
      q.setPassword.run(await hashPassword(new_password), user.id);
      return session(db.get('User', user.id));
    },

    signOutEverywhere(user) {
      if (user) q.bump.run(user.id);
    },

    // ---- Google ----
    googleUrl(state, redirectUri) {
      const p = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
        scope: 'openid email profile', state, prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
    },

    signState(data) {
      const body = b64(JSON.stringify({ ...data, exp: Date.now() + 10 * 60e3 }));
      return `${body}.${sha(secret, `state:${body}`)}`;
    },

    readState(state) {
      const [body, sig] = String(state || '').split('.');
      if (!body || !sig || !sameString(sig, sha(secret, `state:${body}`))) return null;
      try {
        const d = JSON.parse(Buffer.from(body, 'base64url').toString());
        return d.exp > Date.now() ? d : null;
      } catch { return null; }
    },

    async googleCallback(code, redirectUri, fetchImpl = fetch) {
      const tr = await fetchImpl('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
      });
      const tok = await tr.json().catch(() => ({}));
      if (!tr.ok || !tok.access_token) throw new PlatformError(400, 'Google sign-in failed');
      const ir = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } });
      const info = await ir.json().catch(() => ({}));
      if (!info.sub || !info.email || info.email_verified === false) throw new PlatformError(400, 'Google account has no verified email');
      const email = normEmail(info.email);
      let cred = q.byGoogle.get(info.sub) || q.byEmail.get(email);
      let isNew = false;
      if (!cred) {
        const user = await createUser(email, info.name);
        if (info.picture) db.put('User', { ...user, avatar_url: info.picture });
        q.insert.run(user.id, email, null, 1, info.sub);
        cred = q.byUser.get(user.id);
        isNew = true;
      } else if (cred.google_sub !== info.sub) {
        q.setGoogle.run(info.sub, cred.user_id);
      }
      const user = await promote(db.get('User', cred.user_id));
      return { ...session(user), is_new_user: isNew };
    },
  };
}
