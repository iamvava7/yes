// Professional HTML email template for VerifiCasa transactional emails.
// Shared by all notification backend functions via sendVC() in email.js.
// The site's own address (APP_URL on the server), and the logo it serves:
// email clients need a PNG on a public URL.
export const APP_URL = ((globalThis.process?.env?.APP_URL) || "https://verificasa.ro").replace(/\/$/, "");
const LOGO_URL = `${APP_URL}/images/brand/verificasa-email.png`;
export const CONTACT_EMAIL = "contact@verificasa.ro";

// Category config: banner color, icon, highlight-box tint.
const CATEGORIES = {
  property_approved:  { color: "#00A859", icon: "✅", box: "#E8F8F0" },
  property_rejected:  { color: "#D64545", icon: "⚠️", box: "#FDECEC" },
  property_pending:   { color: "#D9A441", icon: "🏠", box: "#FBF4E6" },
  inquiry:            { color: "#2A73CC", icon: "🔔", box: "#E9F1FB" },
  comment:            { color: "#5B5BD6", icon: "💬", box: "#EEEDFB" },
  review:             { color: "#F59E0B", icon: "⭐", box: "#FEF6E7" },
  inspection:         { color: "#0D9488", icon: "🛠️", box: "#E6F5F3" },
  report_resolved:    { color: "#00A859", icon: "🛡️", box: "#E8F8F0" },
  report_rejected:    { color: "#64748B", icon: "📋", box: "#F1F5F9" },
  admin_alert:        { color: "#D9A441", icon: "⚠️", box: "#FBF4E6" },
  system:             { color: "#1B222C", icon: "📨", box: "#F4F7F9" },
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fieldRow(icon, label, value) {
  if (value == null || value === "") return "";
  return `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td style="width:30px;vertical-align:top;font-size:18px;">${esc(icon)}</td>
          <td style="vertical-align:top;">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#7a8289;font-weight:600;">${esc(label)}</div>
            <div style="font-size:15px;font-weight:600;color:#1B222C;line-height:1.4;">${esc(value)}</div>
          </td>
        </tr>
      </table>`;
}

function ctaButton(link, label) {
  if (!link) return "";
  return `
      <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td style="background:#00A859;border-radius:8px;">
            <a href="${esc(link)}" style="display:inline-block;padding:13px 30px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;font-family:'Inter','Helvetica Neue',Arial,sans-serif;">${esc(label)} →</a>
          </td>
        </tr>
      </table>`;
}

// Build a full HTML email. `content` is a structured object:
// { category, title, greeting, intro, dataFields:[{icon,label,value}],
//   ctaLink, ctaLabel, closingNote }
export function buildEmail(content) {
  const c = content || {};
  const cat = CATEGORIES[c.category] || CATEGORIES.system;
  const fields = (c.dataFields || [])
    .filter((f) => f && f.value != null && f.value !== "")
    .map((f) => fieldRow(f.icon || "•", f.label, f.value))
    .join("");

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>VerifiCasa</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f9;font-family:'Inter','Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7f9;padding:28px 12px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(27,34,44,0.10);">
          <tr>
            <td style="background:#1B222C;padding:30px 0;text-align:center;">
              <img src="${LOGO_URL}" width="68" height="68" alt="VerifiCasa" style="border-radius:50%;border:2px solid #C5A059;display:block;margin:0 auto;">
            </td>
          </tr>
          <tr>
            <td style="background:${cat.color};padding:20px 28px;text-align:center;">
              <div style="font-size:24px;line-height:1;margin-bottom:6px;">${cat.icon}</div>
              <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.01em;line-height:1.3;">${esc(c.title || "")}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px 38px 8px;">
              <p style="margin:0 0 10px;font-size:17px;font-weight:700;color:#1B222C;">${esc(c.greeting || "Salut!")}</p>
              <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:#3d4753;">${esc(c.intro || "")}</p>${fields ? `
              <table width="100%" cellpadding="0" cellspacing="0" style="background:${cat.box};border-radius:10px;margin:0 0 24px;">
                <tr><td style="padding:20px 22px;">${fields}</td></tr>
              </table>` : ""}${c.closingNote ? `
              <p style="margin:0 0 22px;font-size:14px;line-height:1.6;color:#3d4753;">${esc(c.closingNote)}</p>` : ""}${ctaButton(c.ctaLink, c.ctaLabel)}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 38px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8eaed;padding-top:22px;">
                <tr>
                  <td>
                    <p style="margin:0 0 10px;font-size:14px;color:#3d4753;">Cu încredere,</p>
                    <p style="margin:0;font-size:17px;font-weight:700;color:#1B222C;">Echipa VerifiCasa</p>
                    <p style="margin:3px 0 0;font-size:11px;color:#7a8289;text-transform:uppercase;letter-spacing:0.12em;font-weight:600;">Inspecții &amp; Verificări Imobiliare</p>
                    <p style="margin:10px 0 0;font-size:13px;color:#3d4753;">📧 <a href="mailto:${CONTACT_EMAIL}" style="color:#00A859;text-decoration:none;font-weight:600;">${CONTACT_EMAIL}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;padding:22px 38px;">
          <tr>
            <td align="center" style="padding-bottom:14px;">
              <a href="${APP_URL}/contact" style="font-size:12px;font-weight:700;color:#0e1d2c;text-decoration:none;letter-spacing:0.06em;">AJUTOR</a>
              <span style="color:#cbd5e1;margin:0 12px;">·</span>
              <a href="${APP_URL}/contact" style="font-size:12px;font-weight:700;color:#0e1d2c;text-decoration:none;letter-spacing:0.06em;">CONTACTEAZĂ-NE</a>
              <span style="color:#cbd5e1;margin:0 12px;">·</span>
              <a href="${APP_URL}/account" style="font-size:12px;font-weight:700;color:#0e1d2c;text-decoration:none;letter-spacing:0.06em;">CONTUL MEU</a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:18px;">
              <p style="margin:0 0 12px;font-size:12px;color:#7a8289;">Suntem aici pentru tine:</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="padding:0 7px;">
                    <a href="mailto:${CONTACT_EMAIL}" style="text-decoration:none;">
                      <img src="${APP_URL}/images/generated/icon-contact-v1.png" width="38" height="38" alt="Contact" style="display:block;">
                    </a>
                  </td>
                  <td style="padding:0 7px;">
                    <a href="https://instagram.com/verificasaro" style="text-decoration:none;">
                      <img src="${APP_URL}/images/generated/icon-instagram-v1.png" width="38" height="38" alt="Instagram" style="display:block;">
                    </a>
                  </td>
                  <td style="padding:0 7px;">
                    <a href="https://tiktok.com/@verificasaro" style="text-decoration:none;">
                      <img src="${APP_URL}/images/generated/icon-tiktok-v1.png" width="38" height="38" alt="TikTok" style="display:block;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;font-size:11px;line-height:1.65;color:#7a8289;">Acest mesaj este trimis automat. Te rugăm să nu răspunzi la acest e-mail. Pentru setări de comunicare, intră în <a href="${APP_URL}/account" style="color:#295fb3;text-decoration:none;">Contul tău</a> &gt; Setări &gt; Notificări.</p>
              <p style="margin:10px 0 0;font-size:11px;color:#7a8289;">© ${new Date().getFullYear()} VerifiCasa · www.verificasa.ro</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}