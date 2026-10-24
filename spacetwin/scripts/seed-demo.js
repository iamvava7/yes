// Fills a local copy with demo listings so the website isn't empty while you
// try it. Run with the server stopped:  npm run seed:demo
// Every record is marked is_sample, and running it again doesn't add more.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Db, loadSchemas, newRecordId } from '../server/platform/db.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.DATA_DIR ?? path.join(root, 'data');
const db = new Db(path.join(dataDir, 'verificasa.db'));
const schemas = loadSchemas(path.join(root, 'site', 'base44', 'entities'));

if (db.all('Property').some((p) => p.is_sample)) {
  console.log('Demo listings are already there.');
  process.exit(0);
}

const defaults = (name) => Object.fromEntries(Object.entries(schemas.get(name)?.properties ?? {})
  .filter(([, p]) => p && 'default' in p).map(([k, p]) => [k, structuredClone(p.default)]));

const now = Date.now();
const agent = {
  ...defaults('User'), id: newRecordId(), email: 'agent.demo@verificasa.ro', full_name: 'Agent Demo',
  role: 'AGENT', seller_type: 'Agent', agency_name: 'VerifiCasa Demo', is_verified: true, phone: '+40 700 000 000',
  created_date: new Date(now).toISOString(), updated_date: new Date(now).toISOString(), is_sample: true,
};
agent.created_by = agent.email;
agent.created_by_id = agent.id;
db.put('User', agent);

const img = (...names) => names.map((n) => `/images/properties/${n}.webp`);
const listings = [
  ['Apartament 2 camere, Floreasca', 'București', 'Ilfov', 'Floreasca', 'SALE', 189000, '2 Camere', 2, 62, img('interior-01', 'interior-02', 'exterior-01'), 44.4632, 26.0981],
  ['Garsonieră modernă lângă metrou', 'București', 'Ilfov', 'Tineretului', 'RENT', 450, 'Garsonieră', 1, 34, img('interior-03', 'interior-04'), 44.4114, 26.1069],
  ['Apartament 3 camere cu terasă', 'Cluj-Napoca', 'Cluj', 'Zorilor', 'SALE', 235000, '3 Camere', 3, 84, img('interior-05', 'interior-06', 'exterior-02'), 46.7563, 23.5797],
  ['Studio luminos, centru', 'Cluj-Napoca', 'Cluj', 'Centru', 'RENT', 520, 'Studio', 1, 38, img('interior-07', 'interior-08'), 46.7701, 23.5897],
  ['Casă cu grădină', 'Brașov', 'Brașov', 'Stupini', 'SALE', 310000, 'Casă', 5, 160, img('exterior-03', 'interior-09', 'interior-10'), 45.6912, 25.6091],
  ['Apartament 2 camere, vedere la mare', 'Constanța', 'Constanța', 'Mamaia Nord', 'RENT', 650, '2 Camere', 2, 58, img('interior-11', 'exterior-04'), 44.2702, 28.6224],
  ['Apartament 4 camere renovat', 'Timișoara', 'Timiș', 'Complex Studențesc', 'SALE', 199000, '4+ Camere', 4, 98, img('interior-02', 'interior-05', 'exterior-05'), 45.7489, 21.2393],
  ['Spațiu comercial stradal', 'Iași', 'Iași', 'Copou', 'RENT', 1200, 'Spațiu Comercial', 2, 75, img('exterior-06', 'interior-06'), 47.1744, 27.5698],
];

listings.forEach(([title, city, county, zone, tx, price, type, rooms, area, images, lat, lon], i) => {
  const at = new Date(now - (i + 1) * 3600e3 * 7).toISOString();
  db.put('Property', {
    ...defaults('Property'), id: newRecordId(), title, city, county, zone, transaction_type: tx, price_monthly: price,
    currency: 'EUR', country: 'RO', property_type: type, rooms, surface_sqm: area, images, latitude: lat, longitude: lon,
    description: `${title} în ${zone}, ${city}. Anunț demonstrativ: poze și date de test.`,
    status: 'Activ', approval_status: 'APPROVED', approved_by_name: 'VerifiCasa', approved_date: at,
    seller_role: 'Agent', posted_by_name: agent.full_name, owner_name: agent.full_name, phone: agent.phone,
    created_date: at, updated_date: at, created_by: agent.email, created_by_id: agent.id, is_sample: true,
  });
});

db.close();
console.log(`Added ${listings.length} demo listings (agent: ${agent.full_name}). Start the server: npm start`);
