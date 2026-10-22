import './styles.css';
import { renderCapture } from './pages/capture.js';
import { renderEditor } from './pages/editor.js';
import { renderHome } from './pages/home.js';
import { renderShowcase } from './pages/showcase.js';

const app = document.getElementById('app');
let cleanup = null;
let navigation = 0;

/**
 * Each page renders into its own host element. Pages load data before they
 * finish rendering, so if the address changes meanwhile, the stale page is
 * disposed and removed instead of appearing over the new one.
 */
async function route() {
  const current = ++navigation;
  cleanup?.();
  cleanup = null;
  app.replaceChildren();
  const host = document.createElement('div');
  host.className = 'route';
  app.append(host);
  const hash = location.hash.replace(/^#/, '') || '/';
  let m, dispose;
  if ((m = hash.match(/^\/space\/([a-z0-9]+)$/))) dispose = await renderEditor(host, m[1]);
  else if ((m = hash.match(/^\/view\/([a-z0-9]+)$/))) dispose = await renderShowcase(host, m[1]);
  else if ((m = hash.match(/^\/capture\/([a-z0-9]+)$/))) dispose = await renderCapture(host, m[1]);
  else dispose = await renderHome(host);
  if (current !== navigation) {
    dispose?.();
    host.remove();
    return;
  }
  cleanup = dispose;
}

window.addEventListener('hashchange', route);
route();
