import { api, exportUrl } from '../api.js';
import { PlanEditor } from '../editor/PlanEditor.js';
import { perimeter, polygonArea } from '../../../shared/geometry.js';
import { fmtArea, h, icon, toast } from '../ui.js';
import { createViewerChrome } from '../viewerChrome.js';

export async function renderEditor(app, id) {
  let space;
  try {
    space = await api.getSpace(id);
  } catch (err) {
    app.append(h('main.not-found', h('h1', 'Space not found'), h('p', err.message), h('a', { href: '#/' }, 'Back to spaces')));
    return null;
  }

  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, hidden: true, onchange: () => upload([...fileInput.files]) });
  const nameInput = h('input.title-input', { value: space.name, 'aria-label': 'Space name', onchange: rename, onkeydown: (e) => e.key === 'Enter' && e.target.blur() });
  const stats = h('span.header-stats');
  const progress = h('div.upload-progress', { hidden: true }, h('div.bar'), h('span'));
  const exportMenu = h('div.menu', { hidden: true },
    h('a', { href: exportUrl(id, 'floorplan.svg'), target: '_blank', rel: 'noopener' }, 'Floor plan (SVG)'),
    h('a', { href: exportUrl(id, 'model.obj'), download: true }, '3D model (OBJ)'),
    h('a', { href: exportUrl(id, 'space.json'), download: true }, 'Space data (JSON)'),
  );
  const exportBtn = h('button.secondary', { 'aria-haspopup': 'menu', onclick: (e) => { e.stopPropagation(); exportMenu.hidden = !exportMenu.hidden; } }, icon('download'), h('span', 'Export'));
  const closeMenu = () => { exportMenu.hidden = true; };
  document.addEventListener('click', closeMenu);

  const planCanvas = h('canvas.plan-canvas');
  const planTools = h('div.plan-tools',
    h('button.tool', { dataset: { tool: 'select' }, 'aria-pressed': true, title: 'Select and move (drag scans, corners or rooms)', onclick: () => setPlanTool('select') }, icon('pointer'), h('span', 'Select')),
    h('button.tool', { dataset: { tool: 'draw' }, 'aria-pressed': false, title: 'Draw a room by clicking its corners', onclick: () => setPlanTool('draw') }, icon('pen'), h('span', 'Draw room')),
    h('button.tool', { title: 'Fit to view', onclick: () => { plan.fit(); plan.draw(); } }, icon('fit'), h('span', 'Fit')),
  );
  const planHint = h('div.plan-hint');
  const inspector = h('aside.inspector');
  const viewerPane = h('section.viewer-pane');
  const dropzone = h('div.dropzone', { hidden: true },
    h('div', icon('upload'), h('h2', 'Add your first panoramas'),
      h('p', 'Drop equirectangular 360° photos (2:1 JPEG, PNG or WebP) here, one per capture point.'),
      h('button.primary', { onclick: () => fileInput.click() }, 'Choose files')),
  );

  app.append(h('div.editor',
    h('header.editor-header',
      h('a.icon-btn', { href: '#/', title: 'All spaces' }, icon('back')),
      nameInput, stats,
      h('div.spacer'),
      progress,
      h('button.secondary', { onclick: () => fileInput.click() }, icon('upload'), h('span', 'Upload')),
      h('div.menu-wrap', exportBtn, exportMenu),
      h('a.button.primary', { href: `#/view/${id}`, title: 'Open the shareable tour' }, icon('share'), h('span', 'View tour')),
      fileInput,
    ),
    h('div.editor-body',
      h('section.plan-pane', h('div.plan-canvas-wrap', planCanvas, planTools, planHint), inspector),
      viewerPane,
    ),
    dropzone,
  ));

  const chrome = createViewerChrome(viewerPane, id, {
    tools: ['navigate', 'measure', 'tag', 'trace'],
    onTagCreate: async (tag) => {
      try {
        await api.createTag(id, tag);
        await reload();
        toast('Tag added');
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    onTagDelete: async (tag) => {
      try {
        await api.deleteTag(id, tag.id);
        await reload();
      } catch (err) {
        toast(err.message, 'error');
      }
    },
    onRoomTraced: async ({ points, height }) => {
      const scan = space.scans.find((s) => s.id === chrome.viewer.currentScanId);
      const taken = new Set(space.rooms.map((r) => r.name));
      const name = scan && !taken.has(scan.name) ? scan.name : `Room ${space.rooms.length + 1}`;
      await saveRooms([...space.rooms, { name, height, points }], `Added ${name}`);
    },
    onScanChange: () => {},
  });

  const plan = new PlanEditor(planCanvas, {
    onSelect: renderInspector,
    onScanPreview: () => chrome.preview({ ...space }),
    onScanCommit: async (scan, patch) => {
      try {
        apply(await api.updateScan(id, scan.id, patch));
      } catch (err) {
        toast(err.message, 'error');
        reload();
      }
    },
    onRoomsPreview: (rooms) => chrome.preview({ ...space, rooms }),
    onRoomsCommit: (rooms) => saveRooms(rooms),
    onRoomCreate: async (room) => {
      await saveRooms([...space.rooms, room], `Added ${room.name}`);
      setPlanTool('select');
    },
    onToolDone: () => setPlanTool('select'),
  });

  function setPlanTool(tool) {
    plan.setTool(tool);
    for (const b of planTools.querySelectorAll('[data-tool]')) b.setAttribute('aria-pressed', b.dataset.tool === tool);
    planHint.textContent = tool === 'draw'
      ? 'Click corners to draw a room · click the first corner, double-click or press Enter to finish · Backspace undoes · Alt disables snapping'
      : 'Drag scans to place them · drag the blue handle to rotate a panorama · drag corners to reshape rooms';
  }
  setPlanTool('select');

  function apply(next) {
    space = next;
    document.title = `${space.name} · SpaceTwin`;
    stats.textContent = `${space.stats.scanCount} scans · ${space.stats.roomCount} rooms · ${fmtArea(space.stats.totalArea)}`;
    dropzone.hidden = space.scans.length > 0;
    plan.setSpace(space);
    chrome.update(space);
    renderInspector(plan.selection);
  }

  async function reload() {
    apply(await api.getSpace(id));
  }

  async function saveRooms(rooms, message) {
    try {
      apply(await api.putRooms(id, rooms));
      if (message) toast(message);
    } catch (err) {
      toast(err.message, 'error');
      reload();
    }
  }

  async function rename() {
    const name = nameInput.value.trim();
    if (!name || name === space.name) {
      nameInput.value = space.name;
      return;
    }
    try {
      apply(await api.renameSpace(id, name));
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function upload(files) {
    fileInput.value = '';
    if (!files.length) return;
    progress.hidden = false;
    const label = progress.querySelector('span'), bar = progress.querySelector('.bar');
    try {
      const next = await api.uploadScans(id, files, (f) => {
        bar.style.width = `${Math.round(f * 100)}%`;
        label.textContent = f < 1 ? `Uploading ${Math.round(f * 100)}%` : 'Processing…';
      });
      const added = next.scans.length - space.scans.length;
      apply(next);
      plan.fit();
      plan.draw();
      toast(`Added ${added} scan${added === 1 ? '' : 's'}. Drag each one to where it was taken on the plan.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      progress.hidden = true;
    }
  }

  // drag-and-drop anywhere on the page
  const onDragOver = (e) => {
    if ([...(e.dataTransfer?.types ?? [])].includes('Files')) {
      e.preventDefault();
      document.body.classList.add('dragging-files');
    }
  };
  const onDragLeave = (e) => {
    if (!e.relatedTarget) document.body.classList.remove('dragging-files');
  };
  const onDrop = (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    document.body.classList.remove('dragging-files');
    upload([...e.dataTransfer.files]);
  };
  window.addEventListener('dragover', onDragOver);
  window.addEventListener('dragleave', onDragLeave);
  window.addEventListener('drop', onDrop);

  function field(label, input, suffix) {
    return h('label.field', h('span', label), h('div.input-row', input, suffix ? h('span.suffix', suffix) : null));
  }

  function renderInspector(sel) {
    inspector.replaceChildren();
    if (sel?.type === 'scan') {
      const scan = space.scans.find((s) => s.id === sel.id);
      if (!scan) return;
      const idx = space.scans.indexOf(scan) + 1;
      const save = async (patch) => {
        try {
          apply(await api.updateScan(id, scan.id, patch));
        } catch (err) {
          toast(err.message, 'error');
        }
      };
      const heading = h('input', {
        type: 'range', min: 0, max: 359, step: 1, value: scan.heading, 'aria-label': 'Panorama heading',
        oninput: (e) => {
          scan.heading = Number(e.target.value);
          headingOut.textContent = `${scan.heading}°`;
          plan.draw();
          chrome.preview({ ...space });
        },
        onchange: (e) => save({ heading: Number(e.target.value) }),
      });
      const headingOut = h('output', `${scan.heading}°`);
      inspector.append(
        h('div.inspector-head', h('span.badge', String(idx)), h('h3', 'Scan')),
        field('Name', h('input', { value: scan.name, onchange: (e) => save({ name: e.target.value }) })),
        h('label.field', h('span', 'Heading'), h('div.input-row', heading, headingOut)),
        field('Camera height', h('input', { type: 'number', min: 0.2, max: 5, step: 0.05, value: scan.cameraHeight, onchange: (e) => save({ cameraHeight: Number(e.target.value) }) }), 'm'),
        h('p.dim', `Position ${scan.position.x.toFixed(2)}, ${scan.position.z.toFixed(2)} m · ${scan.width}×${scan.height}px`),
        h('div.row',
          h('button.secondary.small', { onclick: () => chrome.viewer.goToScan(scan.id) }, 'Go here'),
          h('button.ghost.small.danger', {
            onclick: async () => {
              if (!confirm(`Delete scan “${scan.name}”? Its panorama will be removed.`)) return;
              try {
                plan.select(null);
                apply(await api.deleteScan(id, scan.id));
              } catch (err) {
                toast(err.message, 'error');
              }
            },
          }, icon('trash'), 'Delete'),
        ),
      );
      return;
    }
    if (sel?.type === 'room') {
      const room = space.rooms.find((r) => r.id === sel.id);
      if (!room) return;
      const update = (patch) => saveRooms(space.rooms.map((r) => (r.id === room.id ? { ...r, ...patch } : r)));
      inspector.append(
        h('div.inspector-head', h('h3', 'Room')),
        field('Name', h('input', { value: room.name, onchange: (e) => update({ name: e.target.value }) })),
        field('Ceiling height', h('input', { type: 'number', min: 1.5, max: 10, step: 0.05, value: room.height, onchange: (e) => update({ height: Number(e.target.value) }) }), 'm'),
        h('dl.facts',
          h('dt', 'Floor area'), h('dd', fmtArea(polygonArea(room.points))),
          h('dt', 'Perimeter'), h('dd', `${perimeter(room.points).toFixed(2)} m`),
          h('dt', 'Corners'), h('dd', String(room.points.length)),
        ),
        h('button.ghost.small.danger', { onclick: () => plan.deleteRoom(room.id) }, icon('trash'), 'Delete room'),
      );
      return;
    }
    inspector.append(
      h('div.inspector-head', h('h3', 'Space')),
      h('dl.facts',
        h('dt', 'Scans'), h('dd', String(space.stats.scanCount)),
        h('dt', 'Rooms'), h('dd', String(space.stats.roomCount)),
        h('dt', 'Floor area'), h('dd', fmtArea(space.stats.totalArea)),
        h('dt', 'Tags'), h('dd', String(space.tags.length)),
      ),
      h('p.dim', space.rooms.length
        ? 'Select a scan or room on the plan to edit it.'
        : 'Next: stand in a room in the 3D view, pick “Trace room” and click the floor corners. Or draw rooms on this plan.'),
    );
  }

  apply(space);

  return () => {
    chrome.dispose();
    plan.dispose();
    document.removeEventListener('click', closeMenu);
    window.removeEventListener('dragover', onDragOver);
    window.removeEventListener('dragleave', onDragLeave);
    window.removeEventListener('drop', onDrop);
  };
}
