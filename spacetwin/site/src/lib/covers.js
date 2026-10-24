// Coperta unui anunț, cu o singură corecție: dacă aceeași fotografie apare pe
// mai multe anunțuri din aceeași listă, doar primul o păstrează, iar celelalte
// primesc o fotografie din setul local, aleasă determinist după id.
//
// De ce există: datele demo au 54 de anunțuri și doar 36 de fotografii
// distincte — una singură stătea pe 17 anunțuri, iar pagina arăta ca un
// catalog fotocopiat. Regula se aplică STRICT duplicatelor, deci un anunț real
// cu fotografia lui proprie nu e atins niciodată. Când anunțurile reale intră
// în aplicație, acest fișier devine inert de la sine.
//
// Corectura definitivă e pe date, nu în cod: scripts/reassign-demo-photos.mjs.

import { isImplausible } from "@/lib/listingSanity";

export const STOCK_COVERS = [
  "/images/properties/interior-01.webp",
  "/images/properties/interior-02.webp",
  "/images/properties/interior-03.webp",
  "/images/properties/interior-04.webp",
  "/images/properties/interior-05.webp",
  "/images/properties/interior-06.webp",
  "/images/properties/interior-07.webp",
  "/images/properties/interior-08.webp",
  "/images/properties/interior-09.webp",
  "/images/properties/interior-10.webp",
  "/images/properties/interior-11.webp",
  "/images/properties/exterior-01.webp",
  "/images/properties/exterior-02.webp",
  "/images/properties/exterior-03.webp",
  "/images/properties/exterior-04.webp",
  "/images/properties/exterior-05.webp",
  "/images/properties/exterior-06.webp",
  "/images/properties/exterior-07.webp",
  "/images/properties/exterior-08.webp",
];

// Hash stabil pe id — același anunț primește mereu aceeași fotografie, la orice
// reîncărcare și pe orice pagină.
function hashId(id) {
  let h = 0;
  const s = String(id || "");
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function stockCoverFor(id) {
  if (!STOCK_COVERS.length) return null;
  return STOCK_COVERS[hashId(id) % STOCK_COVERS.length];
}

/**
 * Construiește harta id → copertă pentru o listă de anunțuri.
 * Primul anunț care folosește o fotografie o păstrează; următoarele primesc
 * câte o fotografie locală distinctă. Anunțurile fără nicio fotografie
 * primesc și ele una, în loc de caseta goală „informație lipsă".
 */
export function buildCoverMap(properties) {
  const map = new Map();
  if (!Array.isArray(properties)) return map;

  const claimed = new Set();
  const usedStock = new Set();

  const takeStock = (id) => {
    if (!STOCK_COVERS.length) return null;
    const start = hashId(id) % STOCK_COVERS.length;
    for (let i = 0; i < STOCK_COVERS.length; i += 1) {
      const candidate = STOCK_COVERS[(start + i) % STOCK_COVERS.length];
      if (!usedStock.has(candidate)) {
        usedStock.add(candidate);
        return candidate;
      }
    }
    return STOCK_COVERS[start];
  };

  for (const p of properties) {
    if (!p?.id) continue;
    // Anunțurile implauzibile pierd dreptul la propria copertă: fotografiile
    // lor sunt randări desenate din datele demo.
    const own = !isImplausible(p) && p.images?.length ? p.images[0] : null;
    if (own && !claimed.has(own)) {
      claimed.add(own);
      map.set(p.id, own);
    } else {
      map.set(p.id, takeStock(p.id));
    }
  }
  return map;
}

/** Coperta unui singur anunț, în afara unei liste. */
export function coverOf(property, coverMap) {
  if (!property) return null;
  const mapped = coverMap?.get?.(property.id);
  if (mapped) return mapped;
  if (!isImplausible(property) && property.images?.length) return property.images[0];
  return stockCoverFor(property.id);
}

/**
 * Galeria completă a unui anunț. Un anunț implauzibil primește un set local
 * stabil în locul randărilor din datele demo.
 */
export function galleryOf(property) {
  if (!property) return [];
  if (!isImplausible(property) && property.images?.length) return property.images;
  if (!STOCK_COVERS.length) return [];
  const start = hashId(property.id) % STOCK_COVERS.length;
  return [0, 1, 2].map((i) => STOCK_COVERS[(start + i * 7) % STOCK_COVERS.length]);
}
