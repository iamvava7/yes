/** Tiny DOM helper: h('button.primary', { onclick }, 'Save'). */
export function h(spec, props = {}, ...children) {
  if (props instanceof Node || typeof props === 'string' || Array.isArray(props)) {
    children.unshift(props);
    props = {};
  }
  const [tag, ...classes] = spec.split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && k !== 'list') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

export function toast(message, kind = 'info') {
  const el = h(`div.toast.${kind}`, { role: kind === 'error' ? 'alert' : 'status' }, message);
  document.getElementById('toasts').append(el);
  setTimeout(() => el.classList.add('leaving'), 3500);
  setTimeout(() => el.remove(), 4000);
}

export function fmtArea(m2) {
  return `${m2.toFixed(1)} m²`;
}

/** Inline SVG icons (24×24, stroke = currentColor). */
const ICONS = {
  walk: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>',
  cube: '<path d="M12 3 4 7.5v9L12 21l8-4.5v-9z"/><path d="M4 7.5 12 12l8-4.5M12 12v9"/>',
  plan: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h7v8M11 4v4M15 12h5"/>',
  hand: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-5.5V5a1.5 1.5 0 0 1 3 0v6m0-4.5a1.5 1.5 0 0 1 3 0V13c0 4-2.5 7-6 7s-5-1.5-6.5-4L3 13.5a1.5 1.5 0 0 1 2.4-1.8L8 14"/>',
  ruler: '<path d="m3 17 14-14 4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>',
  trace: '<path d="M4 18 8 6l8 2 4 10z"/><circle cx="4" cy="18" r="1.6"/><circle cx="8" cy="6" r="1.6"/><circle cx="16" cy="8" r="1.6"/><circle cx="20" cy="18" r="1.6"/>',
  pointer: '<path d="m5 3 14 8-6 2-2 6z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  upload: '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6"/>',
  download: '<path d="M12 4v12m0 0-5-5m5 5 5-5"/><path d="M4 20h16"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};

export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return span;
}
