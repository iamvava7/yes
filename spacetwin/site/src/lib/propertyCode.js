import { base44 } from "@/api/base44Client";

// Generates a unique 12-character property code: 6 random digits + 6 random
// uppercase letters (e.g. "838DAC831VER"). Checks existing codes to avoid
// collisions. Falls back gracefully if the list call fails.
export async function generateUniquePropertyCode() {
  let existing = new Set();
  try {
    const list = await base44.entities.Property.list("-created_date", 1000);
    (list || []).forEach((p) => {
      if (p.property_code) existing.add(String(p.property_code).toUpperCase());
    });
  } catch {
    // ignore — proceed with an empty set
  }

  const DIGITS = "0123456789";
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const pick = (src) => src[Math.floor(Math.random() * src.length)];

  let code = "";
  let attempts = 0;
  do {
    let nums = "";
    for (let i = 0; i < 6; i++) nums += pick(DIGITS);
    let letters = "";
    for (let i = 0; i < 6; i++) letters += pick(LETTERS);
    code = nums + letters;
    attempts++;
  } while (existing.has(code) && attempts < 50);

  return code;
}