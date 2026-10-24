export function initials(name) {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name[0].toUpperCase();
}

export function timeLabel(iso, lang = "ro") {
  if (!iso) return "";
  const en = lang === "en";
  const loc = en ? "en-GB" : "ro-RO";
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return en ? "now" : "acum";
  if (diff < 3600) return Math.floor(diff / 60) + " min";
  if (diff < 86400) return d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString(loc, { day: "2-digit", month: "short" });
}

// Avatar grounds stay inside the brand: verde leads, bronze and ink fill out
// the set. Every tone clears 5:1 against white initials.
const AVATAR_COLORS = [
  "bg-[#1F7048]", "bg-[#2C6B57]", "bg-[#3F6B4F]", "bg-[#8A661B]",
  "bg-[#6E5B33]", "bg-[#161C29]", "bg-[#4A5A52]",
];

export function avatarColor(id) {
  if (!id) return AVATAR_COLORS[0];
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}