// App controller: wires the toolbar, panels, 2D editor and 3D viewer together.

import { state, serialize, load, loadStarter, clearAll, saveLocal, loadLocal,
         hasLocal, onChange, emitChange, snapshot, wallById, wallLength } from './state.js';
import { Editor2D } from './editor2d.js';
import { Viewer3D } from './viewer3d.js';
import { FURNITURE, FURNITURE_CATEGORIES, FLOOR_MATERIALS, WALL_PAINTS,
         EXTERIOR_FINISHES, hex } from './library.js';

const $ = sel => document.querySelector(sel);

const stage = $('#stage');
const editor = new Editor2D($('#canvas2d'), {
  onSelect: sel => renderProps(sel),
  onHint: text => { $('#hint').textContent = text; },
  onDrawState: drawing => { $('#btn-finish').hidden = !drawing; },
});
const viewer = new Viewer3D($('#canvas3d'));

let mode = '2d';

// ---- view toggle ------------------------------------------------------
function setMode(m) {
  mode = m;
  $('#btn-2d').classList.toggle('active', m === '2d');
  $('#btn-3d').classList.toggle('active', m === '3d');
  stage.classList.toggle('mode-3d', m === '3d');
  $('#toolbar').style.visibility = m === '2d' ? 'visible' : 'hidden';
  if (m === '3d') {
    viewer.init();
    viewer.build();
    viewer.frameCamera();
    viewer._resize();
    $('#hint').textContent = 'Drag to orbit · scroll to zoom · right-drag to pan';
  } else {
    editor.render();
    editor._hint();
  }
}
$('#btn-2d').onclick = () => setMode('2d');
$('#btn-3d').onclick = () => setMode('3d');

// ---- top actions ------------------------------------------------------
$('#btn-starter').onclick = () => { loadStarter(); editor.fit(); flash('Starter home loaded'); };
$('#btn-save').onclick = () => { saveLocal(); flash('Saved to this browser'); };
$('#btn-load').onclick = () => { if (loadLocal()) { emitChange(); editor.fit(); flash('Loaded saved project'); } else flash('No saved project'); };
$('#btn-clear').onclick = () => { if (confirm('Clear the entire design?')) clearAll(); };
$('#btn-export').onclick = () => {
  const blob = new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (state.meta.name || 'home') .replace(/\s+/g, '_') + '.json';
  a.click();
};
$('#btn-import').onclick = () => $('#file-input').click();
$('#file-input').onchange = e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { try { load(JSON.parse(reader.result)); emitChange(); editor.fit(); flash('Imported'); } catch { flash('Invalid file'); } };
  reader.readAsText(file);
  e.target.value = '';
};

function flash(msg) {
  const h = $('#hint'); h.textContent = msg;
  clearTimeout(flash._t);
  flash._t = setTimeout(() => { if (mode === '2d') editor._hint(); }, 1800);
}

// ---- tool rail --------------------------------------------------------
document.querySelectorAll('.tool').forEach(btn => {
  btn.onclick = () => {
    const t = btn.dataset.tool;
    if (t !== 'fit') {
      document.querySelectorAll('.tool').forEach(b => b.classList.toggle('active', b === btn));
    }
    editor.setTool(t);
  };
});
$('#btn-snap').onclick = () => {
  editor.setSnapEnabled(!editor.snapEnabled);
  $('#btn-snap').classList.toggle('active', editor.snapEnabled);
};
$('#btn-finish').onclick = () => editor.finishDrawing();

// ---- panel tabs -------------------------------------------------------
document.querySelectorAll('.ptab').forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.ptab-body').forEach(b => b.classList.remove('active'));
    $('#tab-' + tab.dataset.tab).classList.add('active');
  };
});

// ---- helpers to build form fields ------------------------------------
function field(label, inputHtml) {
  return `<div class="field"><label>${label}</label>${inputHtml}</div>`;
}
function num(id, val, step = 0.5) {
  return `<input type="number" id="${id}" value="${(+val).toFixed ? (+val).toFixed(2) : val}" step="${step}" />`;
}
function swatches(list, current, attr = 'color') {
  return `<div class="swatches">` + list.map(s =>
    `<div class="swatch ${s.color === current ? 'sel' : ''}" style="background:${hex(s.color)}" data-${attr}="${s.color}" title="${s.name}"></div>`
  ).join('') + `</div>`;
}

// ---- properties panel -------------------------------------------------
function renderProps(sel) {
  const el = $('#tab-props');
  if (!sel) { el.innerHTML = projectForm(); bindProjectForm(); return; }

  if (sel.type === 'furniture') {
    const f = state.furniture.find(x => x.id === sel.id); if (!f) { renderProps(null); return; }
    const def = FURNITURE[f.cat];
    el.innerHTML = `<div class="section-title">${def.name}</div>
      ${field('Rotation°', `<input type="range" id="p-rot" min="0" max="350" step="10" value="${f.rot || 0}" style="width:100%">`)}
      <div class="field-row">${field('X (ft)', num('p-x', f.x))}${field('Y (ft)', num('p-y', f.y))}</div>
      <div class="muted-help">${def.w}′ × ${def.d}′ footprint, ${def.h}′ tall.</div>
      <button class="btn-block btn-danger" id="p-del">Delete</button>`;
    bind('p-rot', 'input', v => { f.rot = +v; emitChange(); });
    bind('p-x', 'input', v => { f.x = +v; emitChange(); });
    bind('p-y', 'input', v => { f.y = +v; emitChange(); });
    $('#p-del').onclick = () => editor.deleteSelection();

  } else if (sel.type === 'wall') {
    const w = wallById(sel.id); if (!w) { renderProps(null); return; }
    el.innerHTML = `<div class="section-title">Wall · ${wallLength(w).toFixed(1)}′ long</div>
      <div class="field-row">${field('X1', num('p-x1', w.x1))}${field('Y1', num('p-y1', w.y1))}</div>
      <div class="field-row">${field('X2', num('p-x2', w.x2))}${field('Y2', num('p-y2', w.y2))}</div>
      <div class="field-row">${field('Thickness', num('p-th', w.thickness, 0.1))}${field('Height', num('p-h', w.height, 0.5))}</div>
      <button class="btn-block btn-danger" id="p-del">Delete Wall</button>`;
    ['x1','y1','x2','y2'].forEach(k => bind('p-' + k, 'input', v => { w[k] = +v; emitChange(); }));
    bind('p-th', 'input', v => { w.thickness = +v; emitChange(); });
    bind('p-h', 'input', v => { w.height = +v; emitChange(); });
    $('#p-del').onclick = () => editor.deleteSelection();

  } else if (sel.type === 'opening') {
    const o = state.openings.find(x => x.id === sel.id); if (!o) { renderProps(null); return; }
    el.innerHTML = `<div class="section-title">${o.type === 'opening' ? 'Cased Opening' : o.type[0].toUpperCase() + o.type.slice(1)}</div>
      ${field('Type', `<select id="p-type">
        ${['door','window','opening'].map(t => `<option value="${t}" ${o.type===t?'selected':''}>${t}</option>`).join('')}
      </select>`)}
      <div class="field-row">${field('Width', num('p-w', o.width, 0.5))}${field('Height', num('p-oh', o.height, 0.5))}</div>
      ${field('Sill height', num('p-sill', o.sill, 0.5))}
      ${field('Position along wall', num('p-pos', o.pos, 0.5))}
      <button class="btn-block btn-danger" id="p-del">Delete</button>`;
    bind('p-type', 'change', v => { o.type = v; if (v === 'window' && o.sill === 0) o.sill = 2.5; if (v !== 'window') o.sill = 0; renderProps(sel); emitChange(); });
    bind('p-w', 'input', v => { o.width = +v; emitChange(); });
    bind('p-oh', 'input', v => { o.height = +v; emitChange(); });
    bind('p-sill', 'input', v => { o.sill = +v; emitChange(); });
    bind('p-pos', 'input', v => { o.pos = +v; emitChange(); });
    $('#p-del').onclick = () => editor.deleteSelection();

  } else if (sel.type === 'room') {
    const r = state.rooms.find(x => x.id === sel.id); if (!r) { renderProps(null); return; }
    const vault = r.ceiling && r.ceiling.type === 'vaulted';
    el.innerHTML = `<div class="section-title">Room</div>
      ${field('Name', `<input type="text" id="p-name" value="${r.name}">`)}
      ${field('Floor', `<select id="p-floor">${Object.entries(FLOOR_MATERIALS).map(([k,m]) => `<option value="${k}" ${r.floor===k?'selected':''}>${m.name}</option>`).join('')}</select>`)}
      ${field('Wall paint', swatches(WALL_PAINTS, r.paint))}
      ${field('Ceiling', `<select id="p-ceil">
        <option value="flat" ${!vault?'selected':''}>Flat</option>
        <option value="vaulted" ${vault?'selected':''}>Vaulted</option></select>`)}
      <div class="field-row">${field('Ceiling ht', num('p-ch', (r.ceiling&&r.ceiling.height)||9, 0.5))}
        ${vault ? field('Ridge ht', num('p-ridge', r.ceiling.ridge||14, 0.5)) : ''}</div>
      <button class="btn-block btn-danger" id="p-del">Delete Room</button>`;
    bind('p-name', 'input', v => { r.name = v; emitChange(); });
    bind('p-floor', 'change', v => { r.floor = v; emitChange(); });
    bind('p-ceil', 'change', v => {
      r.ceiling = r.ceiling || {};
      r.ceiling.type = v;
      if (v === 'vaulted' && !r.ceiling.ridge) r.ceiling.ridge = (r.ceiling.height || 9) + 5;
      renderProps(sel); emitChange();
    });
    bind('p-ch', 'input', v => { r.ceiling = r.ceiling || {}; r.ceiling.height = +v; emitChange(); });
    if (vault) bind('p-ridge', 'input', v => { r.ceiling.ridge = +v; emitChange(); });
    el.querySelectorAll('.swatch').forEach(sw => sw.onclick = () => { snapshot(); r.paint = +sw.dataset.color; renderProps(sel); emitChange(); });
    $('#p-del').onclick = () => editor.deleteSelection();
  }
}

function projectForm() {
  return `<div class="section-title">Project</div>
    ${field('Name', `<input type="text" id="pj-name" value="${state.meta.name || ''}">`)}
    ${field('Address', `<input type="text" id="pj-addr" value="${state.meta.address || ''}">`)}
    ${field('Default wall height (ft)', num('pj-h', state.defaults.wallHeight, 0.5))}
    ${field('Exterior finish', swatches(EXTERIOR_FINISHES, state.exterior))}
    <div class="muted-help" style="margin-top:14px">
      <b>Tips</b><br>
      • <kbd>W</kbd> draw walls, <kbd>D</kbd> doors, <kbd>N</kbd> windows, <kbd>R</kbd> rooms.<br>
      • Drag furniture from the <b>Library</b> tab onto the plan.<br>
      • Click any item to edit it here. <kbd>Del</kbd> removes it.<br>
      • Switch to <b>3D View</b> to walk the model; set vaulted ceilings per room.
    </div>`;
}
function bindProjectForm() {
  bind('pj-name', 'input', v => { state.meta.name = v; });
  bind('pj-addr', 'input', v => { state.meta.address = v; });
  bind('pj-h', 'input', v => { state.defaults.wallHeight = +v; });
  $('#tab-props').querySelectorAll('.swatch').forEach(sw => sw.onclick = () => { snapshot(); state.exterior = +sw.dataset.color; bindProjectForm(); emitChange(); $('#tab-props').querySelectorAll('.swatch').forEach(s => s.classList.toggle('sel', +s.dataset.color === state.exterior)); });
}

function bind(id, ev, fn) {
  const elx = document.getElementById(id);
  if (!elx) return;
  if (ev === 'input') elx.addEventListener('focus', snapshotOnce, { once: true });
  elx.addEventListener(ev, e => fn(e.target.value));
}
function snapshotOnce() { snapshot(); }

// ---- library tab ------------------------------------------------------
function renderLibrary() {
  const el = $('#tab-library');
  let html = `<div class="muted-help">Drag an item onto the plan, or click to drop it at the center.</div>`;
  for (const cat of FURNITURE_CATEGORIES) {
    const items = Object.entries(FURNITURE).filter(([, d]) => d.cat === cat);
    if (!items.length) continue;
    html += `<div class="lib-cat">${cat}</div><div class="lib-grid">`;
    for (const [key, d] of items) {
      html += `<div class="lib-item" draggable="true" data-cat="${key}">
        <span class="ic">${d.icon}</span>${d.name}
        <div class="dim">${d.w}′×${d.d}′</div></div>`;
    }
    html += `</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('.lib-item').forEach(item => {
    item.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', item.dataset.cat));
    item.addEventListener('click', () => {
      if (mode !== '2d') setMode('2d');
      editor.addFurnitureAt(item.dataset.cat, editor.cv.clientWidth / 2, editor.cv.clientHeight / 2);
      switchTab('props');
    });
  });
}
const canvasWrap = $('#canvas2d');
canvasWrap.addEventListener('dragover', e => e.preventDefault());
canvasWrap.addEventListener('drop', e => {
  e.preventDefault();
  const cat = e.dataTransfer.getData('text/plain'); if (!cat || !FURNITURE[cat]) return;
  const r = canvasWrap.getBoundingClientRect();
  editor.addFurnitureAt(cat, e.clientX - r.left, e.clientY - r.top);
  switchTab('props');
});

function switchTab(name) {
  document.querySelectorAll('.ptab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.ptab-body').forEach(b => b.classList.toggle('active', b.id === 'tab-' + name));
}

// ---- 3D options tab ---------------------------------------------------
function render3DOptions() {
  const el = $('#tab-design3d');
  const cb = (id, label, on) => `<label class="row-toggle"><input type="checkbox" id="${id}" ${on?'checked':''}> ${label}</label>`;
  el.innerHTML = `<div class="section-title">3D Display</div>
    ${cb('o-ceil', 'Show ceilings', viewer.opts.ceilings)}
    ${cb('o-furn', 'Show furniture', viewer.opts.furniture)}
    ${cb('o-roof', 'Show exterior roof', viewer.opts.roof)}
    ${cb('o-cut', 'Dollhouse cutaway (low walls)', viewer.opts.cutaway)}
    ${field('Exterior finish', swatches(EXTERIOR_FINISHES, state.exterior))}
    <button class="btn-block" id="o-frame">Reframe View</button>
    <div class="muted-help" style="margin-top:12px">Vaulted ceilings are set per room in the Properties tab. Enter 3D View to see them.</div>`;
  const sync = () => { if (mode === '3d') viewer.build(); };
  $('#o-ceil').onchange = e => { viewer.opts.ceilings = e.target.checked; sync(); };
  $('#o-furn').onchange = e => { viewer.opts.furniture = e.target.checked; sync(); };
  $('#o-roof').onchange = e => { viewer.opts.roof = e.target.checked; sync(); };
  $('#o-cut').onchange = e => { viewer.opts.cutaway = e.target.checked; sync(); };
  $('#o-frame').onclick = () => { if (mode !== '3d') setMode('3d'); else viewer.frameCamera(); };
  el.querySelectorAll('.swatch').forEach(sw => sw.onclick = () => {
    state.exterior = +sw.dataset.color; render3DOptions();
    if (mode === '3d') viewer.build();
    editor.render();
  });
}

// ---- change propagation ----------------------------------------------
onChange(() => {
  if (mode === '2d') editor.render();
  else viewer.build();
  // keep properties live if something is selected
  if (editor.selection) {
    const exists = (
      (editor.selection.type === 'furniture' && state.furniture.some(f => f.id === editor.selection.id)) ||
      (editor.selection.type === 'wall' && state.walls.some(w => w.id === editor.selection.id)) ||
      (editor.selection.type === 'opening' && state.openings.some(o => o.id === editor.selection.id)) ||
      (editor.selection.type === 'room' && state.rooms.some(r => r.id === editor.selection.id))
    );
    if (!exists) { editor.selection = null; renderProps(null); }
  }
});

// ---- boot -------------------------------------------------------------
function boot() {
  if (hasLocal()) loadLocal(); else loadStarter();
  renderLibrary();
  render3DOptions();
  renderProps(null);
  editor.fit();
  editor.render();
  setMode('2d');
}
boot();
