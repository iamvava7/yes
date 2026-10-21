import { api, panoUrl } from '../api.js';
import { fmtArea, h, icon, toast } from '../ui.js';

export async function renderHome(app) {
  document.title = 'SpaceTwin';
  const grid = h('div.space-grid');
  const page = h('main.home',
    h('header.home-header',
      h('div.brand', h('span.brand-mark'), 'SpaceTwin'),
      h('div.home-actions',
        h('button.secondary', { onclick: loadSample }, 'Load sample'),
        h('button.primary', { onclick: create }, icon('plus'), 'New space'),
      ),
    ),
    h('section.home-intro',
      h('h1', 'Your spaces'),
      h('p', 'Upload 360° panoramas, trace each room, then share a walkable 3D tour with measurements and a floor plan.'),
    ),
    grid,
  );
  app.append(page);

  async function create() {
    try {
      const space = await api.createSpace('Untitled space');
      location.hash = `#/space/${space.id}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function loadSample() {
    try {
      const space = await api.createSample();
      location.hash = `#/space/${space.id}`;
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  let spaces;
  try {
    spaces = await api.listSpaces();
  } catch (err) {
    grid.append(h('p.empty', `Couldn't load spaces: ${err.message}`));
    return;
  }
  if (!spaces.length) {
    grid.append(h('div.empty-card',
      h('h2', 'No spaces yet'),
      h('p', 'Create a space and upload equirectangular (2:1) panoramas from any 360° camera, or open the sample apartment to look around first.'),
      h('div.row', h('button.secondary', { onclick: loadSample }, 'Open sample apartment'), h('button.primary', { onclick: create }, 'New space')),
    ));
    return;
  }
  for (const s of spaces) {
    const cover = s.coverScanId
      ? h('img', { src: panoUrl(s.id)({ id: s.coverScanId, file: '' }), alt: '', loading: 'lazy' })
      : h('div.cover-empty', 'No scans yet');
    grid.append(h('a.space-card', { href: `#/space/${s.id}` },
      h('div.cover', cover),
      h('div.card-body',
        h('h3', s.name),
        h('p.meta', `${s.stats.scanCount} scan${s.stats.scanCount === 1 ? '' : 's'} · ${s.stats.roomCount} room${s.stats.roomCount === 1 ? '' : 's'} · ${fmtArea(s.stats.totalArea)}`),
        h('p.meta.dim', `Updated ${new Date(s.updatedAt).toLocaleString()}`),
      ),
    ));
  }
}
