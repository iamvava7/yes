import './styles.css';
import { renderEditor } from './pages/editor.js';
import { renderHome } from './pages/home.js';
import { renderShowcase } from './pages/showcase.js';

const app = document.getElementById('app');
let cleanup = null;

async function route() {
  cleanup?.();
  cleanup = null;
  app.replaceChildren();
  const hash = location.hash.replace(/^#/, '') || '/';
  let m;
  if ((m = hash.match(/^\/space\/([a-z0-9]+)$/))) cleanup = await renderEditor(app, m[1]);
  else if ((m = hash.match(/^\/view\/([a-z0-9]+)$/))) cleanup = await renderShowcase(app, m[1]);
  else cleanup = await renderHome(app);
}

window.addEventListener('hashchange', route);
route();
