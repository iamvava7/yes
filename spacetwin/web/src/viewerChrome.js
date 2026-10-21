import { panoUrl } from './api.js';
import { h, icon } from './ui.js';
import { Viewer } from './viewer/Viewer.js';

const MODES = [
  ['inside', 'walk', 'Inside'],
  ['dollhouse', 'cube', 'Dollhouse'],
  ['floorplan', 'plan', 'Floor plan'],
];

const TOOLS = {
  navigate: ['hand', 'Navigate'],
  measure: ['ruler', 'Measure'],
  tag: ['tag', 'Add tag'],
  trace: ['trace', 'Trace room'],
};

/**
 * Wraps a Viewer with its on-screen controls. `tools` picks which tools show;
 * editing hooks (onTagCreate, onTagDelete, onRoomTraced) are optional, which is
 * how the read-only showcase reuses this.
 */
export function createViewerChrome(container, spaceId, { tools = ['navigate', 'measure'], onTagCreate, onTagDelete, onRoomTraced, onScanChange } = {}) {
  const stage = h('div.viewer-stage');
  const modeBar = h('div.mode-bar', { role: 'tablist', 'aria-label': 'View mode' });
  const toolBar = h('div.tool-bar', { role: 'toolbar', 'aria-label': 'Tools' });
  const banner = h('div.banner', { hidden: true });
  const strip = h('div.scan-strip', { 'aria-label': 'Capture points' });
  const popover = h('div.popover', { hidden: true });
  container.append(h('div.viewer-wrap', stage, h('div.viewer-top', modeBar, toolBar), banner, strip, popover));

  let space = null;
  const viewer = new Viewer(stage, {
    panoUrl: panoUrl(spaceId),
    onModeChange: (mode) => {
      for (const b of modeBar.children) b.setAttribute('aria-selected', b.dataset.mode === mode);
      updateBanner();
    },
    onScanChange: (id) => {
      for (const b of strip.children) b.classList.toggle('current', b.dataset.scan === id);
      onScanChange?.(id);
    },
    onTraceProgress: () => updateBanner(),
    onTraceComplete: (room) => {
      setTool('navigate');
      onRoomTraced?.(room);
    },
    onTagPlace: (position, e) => openTagForm(position, e),
    onTagOpen: (tag, el) => openTag(tag, el),
    onMeasure: () => updateBanner(),
  });
  stage.viewer = viewer; // handle for end-to-end tests and debugging

  for (const [mode, ic, label] of MODES) {
    modeBar.append(h('button.mode', {
      role: 'tab', dataset: { mode }, title: label, 'aria-selected': mode === 'inside',
      onclick: () => viewer.setMode(mode),
    }, icon(ic), h('span', label)));
  }
  for (const t of tools) {
    const [ic, label] = TOOLS[t];
    toolBar.append(h('button.tool', { dataset: { tool: t }, title: label, 'aria-pressed': t === 'navigate', onclick: () => setTool(t) }, icon(ic), h('span', label)));
  }

  function setTool(tool) {
    if (tool === 'trace' && !viewer.currentScanId) return;
    viewer.setTool(tool);
    for (const b of toolBar.children) b.setAttribute('aria-pressed', b.dataset.tool === tool);
    closePopover();
    updateBanner();
  }

  function updateBanner() {
    const t = viewer.trace;
    banner.replaceChildren();
    let content = null;
    if (viewer.tool === 'trace' && t) {
      if (t.stage === 'floor') {
        content = [
          h('span', t.points.length < 3
            ? `Click each corner where the walls meet the floor, going around the room (${t.points.length} so far).`
            : 'Keep adding corners, then click the red first corner or press Enter to close the outline.'),
          h('button.secondary.small', { disabled: t.points.length < 3, onclick: () => viewer.closeTrace() }, 'Close outline'),
          h('button.ghost.small', { onclick: () => setTool('navigate') }, 'Cancel'),
        ];
      } else {
        content = [
          h('span', 'Now click where the ceiling meets the wall, directly above the red corner, to set the room height.'),
          h('button.secondary.small', { onclick: () => viewer.finishTrace(2.6) }, 'Skip (2.6 m)'),
          h('button.ghost.small', { onclick: () => setTool('navigate') }, 'Cancel'),
        ];
      }
    } else if (viewer.tool === 'measure') {
      content = [
        h('span', viewer.pendingMeasure ? 'Click the second point.' : 'Click two points on any surface to measure between them.'),
        viewer.measurements.length ? h('button.ghost.small', { onclick: () => { viewer.clearMeasurements(); updateBanner(); } }, 'Clear') : null,
      ];
    } else if (viewer.tool === 'tag') {
      content = [h('span', 'Click a surface to pin a tag there.')];
    }
    banner.hidden = !content;
    if (content) banner.append(...content.filter(Boolean));
  }
  // measurement clicks don't emit a callback for the first point; keep text in sync
  stage.addEventListener('pointerup', () => queueMicrotask(updateBanner));

  function placePopover(x, y) {
    const r = container.getBoundingClientRect();
    popover.hidden = false;
    const pw = popover.offsetWidth, ph = popover.offsetHeight;
    popover.style.left = `${Math.min(Math.max(8, x - r.left - pw / 2), r.width - pw - 8)}px`;
    popover.style.top = `${Math.min(Math.max(8, y - r.top + 14), r.height - ph - 8)}px`;
  }

  function closePopover() {
    popover.hidden = true;
    popover.replaceChildren();
  }

  function openTagForm(position, e) {
    const label = h('input', { type: 'text', placeholder: 'Label', maxLength: 80, required: true, 'aria-label': 'Tag label' });
    const desc = h('textarea', { placeholder: 'Notes (optional)', rows: 3, 'aria-label': 'Tag notes' });
    const form = h('form.tag-form', {
      onsubmit: async (ev) => {
        ev.preventDefault();
        if (!label.value.trim()) return;
        await onTagCreate?.({ label: label.value.trim(), description: desc.value, position });
        closePopover();
      },
    }, label, desc, h('div.row', h('button.ghost.small', { type: 'button', onclick: closePopover }, 'Cancel'), h('button.primary.small', { type: 'submit' }, 'Save tag')));
    popover.replaceChildren(form);
    placePopover(e.clientX, e.clientY);
    label.focus();
  }

  function openTag(tag, el) {
    const r = el.getBoundingClientRect();
    popover.replaceChildren(
      h('div.tag-view',
        h('div.row.spread', h('strong', tag.label), h('button.icon-btn', { title: 'Close', onclick: closePopover }, icon('x'))),
        tag.description ? h('p', tag.description) : null,
        onTagDelete ? h('button.ghost.small.danger', { onclick: async () => { await onTagDelete(tag); closePopover(); } }, icon('trash'), 'Delete tag') : null,
      ),
    );
    placePopover(r.left + r.width / 2, r.bottom);
  }

  function renderStrip() {
    strip.replaceChildren(...space.scans.map((s, i) => h('button.scan-thumb', {
      dataset: { scan: s.id },
      title: s.name,
      className: `scan-thumb${s.id === viewer.currentScanId ? ' current' : ''}`,
      onclick: () => viewer.goToScan(s.id),
    }, h('img', { src: panoUrl(spaceId)(s), alt: '', loading: 'lazy', draggable: false }), h('span', `${i + 1}. ${s.name}`))));
    strip.hidden = space.scans.length < 1;
  }

  return {
    viewer,
    setTool,
    update(next) {
      space = next;
      viewer.setSpace(next);
      renderStrip();
      for (const b of modeBar.children) b.disabled = b.dataset.mode === 'inside' && !next.scans.length;
      const trace = toolBar.querySelector('[data-tool="trace"]');
      if (trace) trace.disabled = !next.scans.length;
    },
    preview(next) {
      viewer.setSpace(next);
    },
    dispose() {
      viewer.dispose();
    },
  };
}
