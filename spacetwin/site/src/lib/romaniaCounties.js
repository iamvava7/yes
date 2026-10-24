// Centroid coordinates for all 41 Romanian counties + Bucharest.
// Used for the national-level map clustering view.
export const ROMANIA_COUNTIES = [
  { name: "Alba", lat: 46.07, lng: 23.57 },
  { name: "Arad", lat: 46.17, lng: 21.72 },
  { name: "Argeș", lat: 45.0, lng: 24.83 },
  { name: "Bacău", lat: 46.35, lng: 26.92 },
  { name: "Bihor", lat: 47.05, lng: 22.1 },
  { name: "Bistrița-Năsăud", lat: 47.13, lng: 24.5 },
  { name: "Botoșani", lat: 47.75, lng: 26.67 },
  { name: "Brașov", lat: 45.65, lng: 25.55 },
  { name: "Brăila", lat: 45.27, lng: 27.98 },
  { name: "Buzău", lat: 45.15, lng: 26.42 },
  { name: "Caraș-Severin", lat: 45.42, lng: 22.13 },
  { name: "Călărași", lat: 44.2, lng: 27.33 },
  { name: "Cluj", lat: 46.78, lng: 23.55 },
  { name: "Constanța", lat: 44.16, lng: 28.49 },
  { name: "Covasna", lat: 45.83, lng: 26.13 },
  { name: "Dâmbovița", lat: 44.95, lng: 25.45 },
  { name: "Dolj", lat: 44.1, lng: 23.8 },
  { name: "Galați", lat: 45.75, lng: 28.05 },
  { name: "Giurgiu", lat: 43.9, lng: 25.97 },
  { name: "Gorj", lat: 45.03, lng: 23.27 },
  { name: "Harghita", lat: 46.35, lng: 25.8 },
  { name: "Hunedoara", lat: 45.75, lng: 22.9 },
  { name: "Ialomița", lat: 44.67, lng: 26.83 },
  { name: "Iași", lat: 47.16, lng: 27.6 },
  { name: "Ilfov", lat: 44.5, lng: 26.05 },
  { name: "Maramureș", lat: 47.7, lng: 23.75 },
  { name: "Mehedinți", lat: 44.63, lng: 22.68 },
  { name: "Mureș", lat: 46.55, lng: 24.57 },
  { name: "Neamț", lat: 47.0, lng: 26.38 },
  { name: "Olt", lat: 44.43, lng: 24.37 },
  { name: "Prahova", lat: 45.13, lng: 26.07 },
  { name: "Satu Mare", lat: 47.8, lng: 22.72 },
  { name: "Sălaj", lat: 47.2, lng: 23.05 },
  { name: "Sibiu", lat: 45.8, lng: 24.15 },
  { name: "Suceava", lat: 47.65, lng: 26.25 },
  { name: "Teleorman", lat: 43.77, lng: 25.23 },
  { name: "Timiș", lat: 45.75, lng: 21.23 },
  { name: "Tulcea", lat: 45.18, lng: 28.8 },
  { name: "Vaslui", lat: 46.63, lng: 27.73 },
  { name: "Vâlcea", lat: 45.1, lng: 24.02 },
  { name: "Vrancea", lat: 45.9, lng: 27.18 },
  { name: "București", lat: 44.43, lng: 26.1 },
];

export const ROMANIA_CENTER = [45.94, 24.97];

// Cutia hărții s-a mutat în `romaniaOutline.js`, lângă conturul din care e
// derivată — cea de aici era desenată cu ochiul, cu ~30 km de joc pe fiecare
// latură, iar la zoom mic lăsa jumătate de Europă în cadru.
// Vezi ROMANIA_BOUNDS / ROMANIA_MAX_BOUNDS acolo.

export function getCountyCenter(name) {
  const c = ROMANIA_COUNTIES.find((c) => c.name === name);
  return c ? [c.lat, c.lng] : null;
}