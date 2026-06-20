// 2D floor-plan editor on a canvas. Draws walls, openings, rooms and furniture,
// and handles the drawing/selection tools.

import { state, uid, snapshot, emitChange, wallById, wallLength,
         projectOnWall, nearestWall, pointInPoly, polyArea, polyCentroid,
         boundsOf } from './state.js';
import { FURNITURE, FLOOR_MATERIALS, hex } from './library.js';

export class Editor2D {
  constructor(canvas, { onSelect, onHint, onDrawState }) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect;
    this.onHint = onHint;
    this.onDrawState = onDrawState;

    this.scale = 14;          // px per foot
    this.cam = { x: 19, y: 14 }; // world point at viewport center
    this.tool = 'select';
    this.selection = null;
    this.gridStep = 0.5;      // 6 inches
    this.snapEnabled = true;

    // interaction state
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false };
    this.drag = null;         // { kind, ... }
    this.chain = null;        // wall drawing in progress: last world point
    this.roomPts = null;      // room polygon in progress
    this.hoverWall = null;    // for door/window placement

    // multi-touch (pinch-zoom / two-finger pan) state
    this.pointers = new Map(); // pointerId -> {x, y} in element-relative px
    this.pinch = null;         // { startDist, startScale, startMid, startCam }
    this.lastPointerType = null;
    this._touchStart = null;  // { e, pointerId, x, y } - a touch tap not yet committed

    this._bind();
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this.render(); });
  }

  setSnapEnabled(on) { this.snapEnabled = on; this.render(); }

  isDrawing() { return !!(this.chain || (this.roomPts && this.roomPts.length)); }
  _notifyDrawState() { this.onDrawState && this.onDrawState(this.isDrawing()); }
  finishDrawing() { this._finishChainOrRoom(); }

  // alt key inverts whatever the current snap setting is (works for mouse;
  // touch has no alt key, so the toolbar toggle is the only way to flip it there)
  _useGrid(e) { return e && e.altKey ? !this.snapEnabled : this.snapEnabled; }
  // fingers are much fatter than a mouse cursor - widen hit/snap thresholds for touch
  _hitMul() { return this.lastPointerType === 'touch' ? 1.6 : 1; }

  // --- coordinate transforms ------------------------------------------
  toScreen(wx, wy) {
    return {
      x: (wx - this.cam.x) * this.scale + this.cv.clientWidth / 2,
      y: (wy - this.cam.y) * this.scale + this.cv.clientHeight / 2,
    };
  }
  toWorld(sx, sy) {
    return {
      x: (sx - this.cv.clientWidth / 2) / this.scale + this.cam.x,
      y: (sy - this.cv.clientHeight / 2) / this.scale + this.cam.y,
    };
  }
  snap(v) { return Math.round(v / this.gridStep) * this.gridStep; }
  snapPt(p, useGrid = true) {
    // snap to nearby wall endpoints first
    const thr = 0.8;
    let best = null;
    for (const w of state.walls) {
      for (const e of [[w.x1, w.y1], [w.x2, w.y2]]) {
        const dd = Math.hypot(e[0] - p.x, e[1] - p.y);
        if (dd < thr && (!best || dd < best.d)) best = { x: e[0], y: e[1], d: dd };
      }
    }
    if (best) return { x: best.x, y: best.y };
    if (useGrid) return { x: this.snap(p.x), y: this.snap(p.y) };
    return p;
  }

  setTool(tool) {
    if (tool === 'fit') { this.fit(); this.setTool('select'); return; }
    this.tool = tool;
    this.chain = null;
    this.roomPts = null;
    this.hoverWall = null;
    if (tool !== 'select') this.select(null);
    this._hint();
    this._notifyDrawState();
    this.render();
  }

  _hint() {
    const h = {
      select: 'Tap to select. Drag to move. Drag empty space to pan, pinch to zoom.',
      wall:   'Tap to place wall points. Tap Finish (or double-click / Enter) to end the chain.',
      door:   'Tap on a wall to drop a door.',
      window: 'Tap on a wall to drop a window.',
      room:   'Tap to outline a room. Tap Finish (or double-click / Enter) to close it.',
      delete: 'Tap an item to delete it.',
    }[this.tool] || '';
    this.onHint && this.onHint(h);
  }

  select(sel) { this.selection = sel; this.onSelect && this.onSelect(sel); this.render(); }

  fit() {
    const b = boundsOf(state);
    const pad = 6;
    const w = (b.maxX - b.minX) + pad * 2;
    const h = (b.maxY - b.minY) + pad * 2;
    this.cam.x = (b.minX + b.maxX) / 2;
    this.cam.y = (b.minY + b.maxY) / 2;
    const sx = this.cv.clientWidth / w, sy = this.cv.clientHeight / h;
    this.scale = Math.max(4, Math.min(sx, sy));
    this.render();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.cv.getBoundingClientRect();
    this.cv.width = r.width * dpr;
    this.cv.height = r.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // --- hit testing -----------------------------------------------------
  hitFurniture(wx, wy) {
    const pad = this.lastPointerType === 'touch' ? 0.35 : 0;
    for (let i = state.furniture.length - 1; i >= 0; i--) {
      const f = state.furniture[i];
      const def = FURNITURE[f.cat]; if (!def) continue;
      const a = -(f.rot || 0) * Math.PI / 180;
      const dx = wx - f.x, dy = wy - f.y;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= def.w / 2 + pad && Math.abs(ly) <= def.d / 2 + pad)
        return { type: 'furniture', id: f.id };
    }
    return null;
  }
  hitOpening(wx, wy) {
    const mul = this._hitMul();
    for (const o of state.openings) {
      const w = wallById(o.wallId); if (!w) continue;
      const len = wallLength(w); const dx = (w.x2 - w.x1) / len, dy = (w.y2 - w.y1) / len;
      const cx = w.x1 + dx * o.pos, cy = w.y1 + dy * o.pos;
      if (Math.hypot(wx - cx, wy - cy) < Math.max(o.width / 2, 1) * mul)
        return { type: 'opening', id: o.id };
    }
    return null;
  }
  hitWall(wx, wy) {
    const n = nearestWall(wx, wy, 0.9 * this._hitMul());
    return n ? { type: 'wall', id: n.wall.id } : null;
  }
  hitRoom(wx, wy) {
    for (let i = state.rooms.length - 1; i >= 0; i--)
      if (pointInPoly({ x: wx, y: wy }, state.rooms[i].points))
        return { type: 'room', id: state.rooms[i].id };
    return null;
  }
  hitAny(wx, wy) {
    return this.hitFurniture(wx, wy) || this.hitOpening(wx, wy) ||
           this.hitWall(wx, wy) || this.hitRoom(wx, wy);
  }

  // --- event binding ---------------------------------------------------
  _bind() {
    const cv = this.cv;
    cv.addEventListener('pointerdown', e => this._down(e));
    cv.addEventListener('pointermove', e => this._move(e));
    window.addEventListener('pointerup', e => this._up(e));
    window.addEventListener('pointercancel', e => this._cancel(e));
    cv.addEventListener('dblclick', e => this._dbl(e));
    cv.addEventListener('contextmenu', e => { e.preventDefault(); this._finishChainOrRoom(); });
    cv.addEventListener('wheel', e => this._wheel(e), { passive: false });
    window.addEventListener('keydown', e => this._key(e));
  }

  _updMouse(e) {
    this.lastPointerType = e.pointerType || this.lastPointerType;
    const r = this.cv.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    this.mouse.wx = w.x; this.mouse.wy = w.y;
  }

  _down(e) {
    try { this.cv.setPointerCapture(e.pointerId); } catch { /* no-op: not all synthetic/edge-case pointers can be captured */ }
    const r = this.cv.getBoundingClientRect();
    this.pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    this.lastPointerType = e.pointerType;

    if (this.pointers.size >= 2) {
      // a second finger landed - this is a pinch/pan gesture, not a tap action
      this._touchStart = null;
      this.drag = null;
      this._beginPinch();
      return;
    }

    if (e.pointerType === 'touch') {
      // Don't act yet: a second finger could still land (pinch) or the finger
      // could turn into a drag. Commit only once we know which on move/up.
      this._touchStart = { e, pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    this._performDown(e);
  }

  _performDown(e) {
    this._updMouse(e);
    this.mouse.down = true;
    const { wx, wy } = this.mouse;
    const sp = this.snapPt({ x: wx, y: wy }, this._useGrid(e));
    const mul = this._hitMul();

    if (this.tool === 'select' || this.tool === 'delete') {
      const hit = this.hitAny(wx, wy);
      if (this.tool === 'delete') { if (hit) this._delete(hit); return; }
      if (hit) {
        this.select(hit);
        snapshot();
        this.drag = { kind: hit.type, id: hit.id, startX: wx, startY: wy, moved: false,
                      orig: this._origOf(hit) };
      } else {
        this.select(null);
        this.drag = { kind: 'pan', startX: e.clientX, startY: e.clientY,
                      cam: { ...this.cam } };
      }
    } else if (this.tool === 'wall') {
      if (!this.chain) { this.chain = { ...sp }; }
      else {
        snapshot();
        state.walls.push({ id: uid('w'), x1: this.chain.x, y1: this.chain.y,
          x2: sp.x, y2: sp.y, thickness: state.defaults.wallThickness, height: state.defaults.wallHeight });
        this.chain = { ...sp };
        emitChange();
      }
      this._notifyDrawState();
    } else if (this.tool === 'room') {
      if (!this.roomPts) this.roomPts = [];
      this.roomPts.push({ x: sp.x, y: sp.y });
      this._notifyDrawState();
    } else if (this.tool === 'door' || this.tool === 'window') {
      const n = nearestWall(wx, wy, 2.0 * mul);
      if (n) {
        snapshot();
        const isWin = this.tool === 'window';
        let pos = n.t * wallLength(n.wall);
        if (this._useGrid(e)) pos = this.snap(pos);
        pos = Math.max(1, Math.min(wallLength(n.wall) - 1, pos));
        state.openings.push({
          id: uid('o'), wallId: n.wall.id, type: this.tool,
          pos, width: isWin ? 4 : 3, height: isWin ? 4 : 6.8, sill: isWin ? 2.5 : 0,
        });
        emitChange();
      }
    }
    this.render();
  }

  _beginPinch() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return;
    const [a, b] = pts;
    this.pinch = {
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startScale: this.scale,
      startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      startCam: { ...this.cam },
    };
  }

  _updatePinch() {
    const pts = [...this.pointers.values()];
    if (pts.length < 2 || !this.pinch) return;
    const [a, b] = pts;
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const newScale = Math.max(3, Math.min(80, this.pinch.startScale * (dist / this.pinch.startDist)));
    // world point under the gesture's starting midpoint, computed with the starting cam/scale
    const worldAtStart = {
      x: (this.pinch.startMid.x - this.cv.clientWidth / 2) / this.pinch.startScale + this.pinch.startCam.x,
      y: (this.pinch.startMid.y - this.cv.clientHeight / 2) / this.pinch.startScale + this.pinch.startCam.y,
    };
    this.scale = newScale;
    // re-anchor so that point sits under the fingers' current midpoint (handles pan + zoom together)
    this.cam.x = worldAtStart.x - (mid.x - this.cv.clientWidth / 2) / newScale;
    this.cam.y = worldAtStart.y - (mid.y - this.cv.clientHeight / 2) / newScale;
    this.render();
  }

  _origOf(hit) {
    if (hit.type === 'furniture') { const f = state.furniture.find(x => x.id === hit.id); return { x: f.x, y: f.y }; }
    if (hit.type === 'opening')   { const o = state.openings.find(x => x.id === hit.id); return { pos: o.pos }; }
    if (hit.type === 'room')      { const r = state.rooms.find(x => x.id === hit.id); return { points: r.points.map(p => ({ ...p })) }; }
    if (hit.type === 'wall')      { const w = wallById(hit.id); return { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }; }
    return {};
  }

  _move(e) {
    if (this.pointers.has(e.pointerId)) {
      const r = this.cv.getBoundingClientRect();
      this.pointers.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
    }
    if (this.pointers.size >= 2) {
      if (this.pinch) this._updatePinch();
      return;
    }

    if (this._touchStart && this._touchStart.pointerId === e.pointerId) {
      const dx = e.clientX - this._touchStart.x, dy = e.clientY - this._touchStart.y;
      if (Math.hypot(dx, dy) <= 8) return; // still holding still - not a drag yet
      const startEvent = this._touchStart.e;
      this._touchStart = null;
      this._performDown(startEvent); // now commits as a drag-start, anchored at the original touch point
    }

    this._updMouse(e);
    const { wx, wy } = this.mouse;

    if (this.drag) {
      const d = this.drag;
      if (d.kind === 'pan') {
        const dx = (e.clientX - d.startX) / this.scale;
        const dy = (e.clientY - d.startY) / this.scale;
        this.cam.x = d.cam.x - dx; this.cam.y = d.cam.y - dy;
        this.render(); return;
      }
      d.moved = true;
      let ddx = wx - d.startX, ddy = wy - d.startY;
      if (this._useGrid(e)) { ddx = this.snap(d.startX + ddx) - d.startX; ddy = this.snap(d.startY + ddy) - d.startY; }
      if (d.kind === 'furniture') {
        const f = state.furniture.find(x => x.id === d.id);
        f.x = d.orig.x + ddx; f.y = d.orig.y + ddy;
      } else if (d.kind === 'room') {
        const r = state.rooms.find(x => x.id === d.id);
        r.points = d.orig.points.map(p => ({ x: p.x + ddx, y: p.y + ddy }));
      } else if (d.kind === 'wall') {
        const w = wallById(d.id);
        w.x1 = d.orig.x1 + ddx; w.y1 = d.orig.y1 + ddy;
        w.x2 = d.orig.x2 + ddx; w.y2 = d.orig.y2 + ddy;
      } else if (d.kind === 'opening') {
        const o = state.openings.find(x => x.id === d.id);
        const w = wallById(o.wallId);
        const p = projectOnWall(w, wx, wy);
        let pos = p.t * wallLength(w);
        if (this._useGrid(e)) pos = this.snap(pos);
        o.pos = Math.max(o.width / 2, Math.min(wallLength(w) - o.width / 2, pos));
      }
      emitChange();
      return;
    }

    if (this.tool === 'door' || this.tool === 'window') {
      this.hoverWall = nearestWall(wx, wy, 2.0 * this._hitMul());
      this.render(); return;
    }
    if (this.chain || this.roomPts) this.render();
  }

  _up(e) {
    if (this._touchStart && this._touchStart.pointerId === e.pointerId) {
      // finger lifted without ever moving past the drag threshold - it's a tap
      const startEvent = this._touchStart.e;
      this._touchStart = null;
      this._performDown(startEvent);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) { this.mouse.down = false; this.drag = null; }
      return;
    }
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size > 0) return;
    this.mouse.down = false;
    if (this.drag && this.drag.kind !== 'pan' && this.drag.moved) emitChange();
    this.drag = null;
  }

  _cancel(e) {
    if (this._touchStart && this._touchStart.pointerId === e.pointerId) this._touchStart = null;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 0) { this.mouse.down = false; this.drag = null; }
  }

  _dbl() { this._finishChainOrRoom(); }

  _finishChainOrRoom() {
    if (this.tool === 'wall' && this.chain) { this.chain = null; this._notifyDrawState(); this.render(); }
    if (this.tool === 'room' && this.roomPts) {
      if (this.roomPts.length >= 3) {
        snapshot();
        const r = { id: uid('r'), name: `Room ${state.rooms.length + 1}`,
          points: this.roomPts, floor: 'oak', paint: 0xf3efe7,
          ceiling: { type: 'flat', height: state.defaults.wallHeight } };
        state.rooms.push(r);
        emitChange();
        this.select({ type: 'room', id: r.id });
      }
      this.roomPts = null;
      this._notifyDrawState();
      this.render();
    }
  }

  _delete(hit) {
    snapshot();
    if (hit.type === 'wall') {
      state.walls = state.walls.filter(w => w.id !== hit.id);
      state.openings = state.openings.filter(o => o.wallId !== hit.id);
    } else if (hit.type === 'opening') {
      state.openings = state.openings.filter(o => o.id !== hit.id);
    } else if (hit.type === 'room') {
      state.rooms = state.rooms.filter(r => r.id !== hit.id);
    } else if (hit.type === 'furniture') {
      state.furniture = state.furniture.filter(f => f.id !== hit.id);
    }
    if (this.selection && this.selection.id === hit.id) this.select(null);
    emitChange();
  }

  deleteSelection() { if (this.selection) this._delete(this.selection); }

  _wheel(e) {
    e.preventDefault();
    const before = this.toWorld(this.mouse.x, this.mouse.y);
    const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.scale = Math.max(3, Math.min(80, this.scale * f));
    const after = this.toWorld(this.mouse.x, this.mouse.y);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.render();
  }

  _key(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    const map = { v: 'select', w: 'wall', d: 'door', n: 'window', r: 'room', x: 'delete' };
    if (map[e.key]) { this.setTool(map[e.key]); return; }
    if (e.key === 'Escape') { this.chain = null; this.roomPts = null; this.select(null); this._notifyDrawState(); this.render(); }
    if (e.key === 'Enter') this._finishChainOrRoom();
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection) this.deleteSelection();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault();
      import('./state.js').then(m => e.shiftKey ? m.redo() : m.undo()); }
  }

  addFurnitureAt(cat, sx, sy) {
    const w = this.toWorld(sx, sy);
    snapshot();
    const f = { id: uid('f'), cat,
      x: this.snapEnabled ? this.snap(w.x) : w.x,
      y: this.snapEnabled ? this.snap(w.y) : w.y, rot: 0 };
    state.furniture.push(f);
    emitChange();
    this.select({ type: 'furniture', id: f.id });
  }

  // --- rendering -------------------------------------------------------
  render() {
    const ctx = this.ctx, W = this.cv.clientWidth, H = this.cv.clientHeight;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#11151a'; ctx.fillRect(0, 0, W, H);
    this._grid(ctx, W, H);
    this._rooms(ctx);
    this._walls(ctx);
    this._openings(ctx);
    this._furniture(ctx);
    this._previews(ctx);
    this._selectionOverlay(ctx);
  }

  _grid(ctx, W, H) {
    // fine lines at the 6" (0.5 ft) snap resolution, falling back to whole-foot
    // lines when zoomed out far enough that 6" lines would just be visual noise
    const fine = this.gridStep;
    const step = (fine * this.scale >= 6) ? fine : 1;
    const tl = this.toWorld(0, 0), br = this.toWorld(W, H);
    const i0 = Math.floor(tl.x / step), i1 = Math.ceil(br.x / step);
    const j0 = Math.floor(tl.y / step), j1 = Math.ceil(br.y / step);
    for (let i = i0; i <= i1; i++) {
      const x = i * step;
      const isFoot = Number.isInteger(x);
      const isFive = isFoot && (Math.round(x) % 5 === 0);
      const s = this.toScreen(x, 0).x;
      ctx.strokeStyle = isFive ? '#3a4450' : isFoot ? '#262e37' : '#1a2026';
      ctx.lineWidth = isFive ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(s, H); ctx.stroke();
    }
    for (let j = j0; j <= j1; j++) {
      const y = j * step;
      const isFoot = Number.isInteger(y);
      const isFive = isFoot && (Math.round(y) % 5 === 0);
      const s = this.toScreen(0, y).y;
      ctx.strokeStyle = isFive ? '#3a4450' : isFoot ? '#262e37' : '#1a2026';
      ctx.lineWidth = isFive ? 1.5 : 1;
      ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(W, s); ctx.stroke();
    }
  }

  _rooms(ctx) {
    for (const r of state.rooms) {
      const mat = FLOOR_MATERIALS[r.floor] || FLOOR_MATERIALS.oak;
      ctx.beginPath();
      r.points.forEach((p, i) => { const s = this.toScreen(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
      ctx.closePath();
      ctx.fillStyle = hex(mat.color) + 'cc';
      ctx.fill();
      // label
      const c = polyCentroid(r.points); const s = this.toScreen(c.x, c.y);
      const area = Math.round(polyArea(r.points));
      ctx.fillStyle = '#1a1a1a';
      ctx.font = '600 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(r.name, s.x, s.y - 4);
      ctx.font = '11px sans-serif';
      ctx.fillText(`${area} sq ft${r.ceiling && r.ceiling.type === 'vaulted' ? ' · vaulted' : ''}`, s.x, s.y + 12);
    }
  }

  _walls(ctx) {
    for (const w of state.walls) {
      const a = this.toScreen(w.x1, w.y1), b = this.toScreen(w.x2, w.y2);
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#e9ecf0';
      ctx.lineWidth = Math.max(3, (w.thickness || 0.4) * this.scale);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      // length label
      if (this.scale > 7) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const len = wallLength(w);
        ctx.fillStyle = '#7f8b97'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${len.toFixed(1)}'`, mx, my - 6);
      }
    }
    ctx.lineCap = 'butt';
  }

  _openings(ctx) {
    for (const o of state.openings) {
      const w = wallById(o.wallId); if (!w) continue;
      const len = wallLength(w); const dx = (w.x2 - w.x1) / len, dy = (w.y2 - w.y1) / len;
      const cx = w.x1 + dx * o.pos, cy = w.y1 + dy * o.pos;
      const half = o.width / 2;
      const ax = cx - dx * half, ay = cy - dy * half;
      const bx = cx + dx * half, by = cy + dy * half;
      const A = this.toScreen(ax, ay), B = this.toScreen(bx, by);
      const th = Math.max(3, (w.thickness || 0.4) * this.scale);
      // clear the wall (the gap)
      ctx.strokeStyle = '#11151a';
      ctx.lineWidth = th + 2;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      if (o.type === 'window') {
        ctx.strokeStyle = '#5fb0e0'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
        // jambs
        ctx.strokeStyle = '#e9ecf0'; ctx.lineWidth = 3;
        this._jamb(ctx, A, dx, dy, th); this._jamb(ctx, B, dx, dy, th);
      } else if (o.type === 'door') {
        // leaf + swing
        const nx = -dy, ny = dx;
        const lp = this.toScreen(ax + nx * o.width, ay + ny * o.width);
        ctx.strokeStyle = '#caa46a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(lp.x, lp.y); ctx.stroke();
        ctx.strokeStyle = '#6b7785'; ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(A.x, A.y, o.width * this.scale, Math.atan2(B.y - A.y, B.x - A.x), Math.atan2(lp.y - A.y, lp.x - A.x), true); ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = '#e9ecf0'; ctx.lineWidth = 3;
        this._jamb(ctx, A, dx, dy, th); this._jamb(ctx, B, dx, dy, th);
      } else { // cased opening
        ctx.strokeStyle = '#e9ecf0'; ctx.lineWidth = 3;
        this._jamb(ctx, A, dx, dy, th); this._jamb(ctx, B, dx, dy, th);
      }
    }
  }
  _jamb(ctx, P, dx, dy, th) {
    const nx = -dy, ny = dx;
    ctx.beginPath();
    ctx.moveTo(P.x - nx * th / 2, P.y - ny * th / 2);
    ctx.lineTo(P.x + nx * th / 2, P.y + ny * th / 2);
    ctx.stroke();
  }

  _furniture(ctx) {
    for (const f of state.furniture) {
      const def = FURNITURE[f.cat]; if (!def) continue;
      const c = this.toScreen(f.x, f.y);
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate((f.rot || 0) * Math.PI / 180);
      const w = def.w * this.scale, h = def.d * this.scale;
      ctx.fillStyle = hex(def.color) + 'e0';
      ctx.strokeStyle = '#10141a'; ctx.lineWidth = 1.5;
      this._roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(6, w / 6));
      ctx.fill(); ctx.stroke();
      if (this.scale > 8) {
        ctx.rotate(-(f.rot || 0) * Math.PI / 180);
        ctx.fillStyle = '#0c0f14'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(def.name, 0, 3);
      }
      ctx.restore();
    }
  }
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  _previews(ctx) {
    // wall chain rubber band
    if (this.tool === 'wall' && this.chain) {
      const a = this.toScreen(this.chain.x, this.chain.y);
      const sp = this.snapPt({ x: this.mouse.wx, y: this.mouse.wy }, this.snapEnabled);
      const b = this.toScreen(sp.x, sp.y);
      ctx.strokeStyle = '#4f9dde'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
      const len = Math.hypot(sp.x - this.chain.x, sp.y - this.chain.y);
      ctx.fillStyle = '#4f9dde'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${len.toFixed(1)}'`, (a.x + b.x) / 2, (a.y + b.y) / 2 - 8);
    }
    // room polygon in progress
    if (this.tool === 'room' && this.roomPts && this.roomPts.length) {
      ctx.strokeStyle = '#58b368'; ctx.lineWidth = 2;
      ctx.beginPath();
      this.roomPts.forEach((p, i) => { const s = this.toScreen(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
      const sp = this.snapPt({ x: this.mouse.wx, y: this.mouse.wy }, this.snapEnabled);
      const cur = this.toScreen(sp.x, sp.y); ctx.lineTo(cur.x, cur.y);
      ctx.stroke();
      this.roomPts.forEach(p => { const s = this.toScreen(p.x, p.y); ctx.fillStyle = '#58b368'; ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, 7); ctx.fill(); });
    }
    // door/window ghost
    if ((this.tool === 'door' || this.tool === 'window') && this.hoverWall) {
      const n = this.hoverWall;
      const s = this.toScreen(n.x, n.y);
      ctx.fillStyle = this.tool === 'window' ? '#5fb0e0' : '#caa46a';
      ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, 7); ctx.fill();
    }
  }

  _selectionOverlay(ctx) {
    const sel = this.selection; if (!sel) return;
    ctx.strokeStyle = '#ffcf4f'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    if (sel.type === 'furniture') {
      const f = state.furniture.find(x => x.id === sel.id); if (!f) return;
      const def = FURNITURE[f.cat]; const c = this.toScreen(f.x, f.y);
      ctx.save(); ctx.translate(c.x, c.y); ctx.rotate((f.rot || 0) * Math.PI / 180);
      ctx.strokeRect(-def.w * this.scale / 2 - 3, -def.d * this.scale / 2 - 3, def.w * this.scale + 6, def.d * this.scale + 6);
      ctx.restore();
    } else if (sel.type === 'wall') {
      const w = wallById(sel.id); if (!w) return;
      const a = this.toScreen(w.x1, w.y1), b = this.toScreen(w.x2, w.y2);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      [a, b].forEach(p => { ctx.fillStyle = '#ffcf4f'; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 7); ctx.fill(); });
    } else if (sel.type === 'room') {
      const r = state.rooms.find(x => x.id === sel.id); if (!r) return;
      ctx.beginPath();
      r.points.forEach((p, i) => { const s = this.toScreen(p.x, p.y); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
      ctx.closePath(); ctx.stroke();
    } else if (sel.type === 'opening') {
      const o = state.openings.find(x => x.id === sel.id); const w = wallById(o.wallId); if (!w) return;
      const len = wallLength(w); const dx = (w.x2 - w.x1) / len, dy = (w.y2 - w.y1) / len;
      const c = this.toScreen(w.x1 + dx * o.pos, w.y1 + dy * o.pos);
      ctx.setLineDash([]); ctx.strokeStyle = '#ffcf4f'; ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, 7); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}
