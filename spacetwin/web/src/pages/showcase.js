import { api } from '../api.js';
import { fmtArea, h, icon } from '../ui.js';
import { createViewerChrome } from '../viewerChrome.js';

/** Read-only, full-screen tour: the page you share. */
export async function renderShowcase(app, id) {
  let space;
  try {
    space = await api.getSpace(id);
  } catch (err) {
    app.append(h('main.not-found', h('h1', 'Tour not found'), h('p', err.message)));
    return null;
  }
  document.title = `${space.name} · SpaceTwin`;
  const root = h('div.showcase');
  app.append(root);
  const chrome = createViewerChrome(root, id, { tools: ['navigate', 'measure'] });
  root.append(h('div.showcase-title',
    h('a.icon-btn', { href: `#/space/${id}`, title: 'Edit this space' }, icon('edit')),
    h('div', h('strong', space.name), h('span', `${space.stats.roomCount} rooms · ${fmtArea(space.stats.totalArea)}`)),
  ));
  chrome.update(space);
  return () => chrome.dispose();
}
