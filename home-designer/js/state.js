// Central data model + persistence.
// Units are FEET throughout. 2D plan: x = right, y = down. 3D maps y(plan) -> z(world).

import { STARTER_HOME } from './presets.js';

const STORAGE_KEY = 'home-designer-project-v1';

let _id = 1;
export function uid(prefix = 'o') { return `${prefix}${_id++}`; }

function reseedIds(state) {
  let max = 0;
  const scan = (arr) => arr && arr.forEach(o => {
    const m = /(\d+)$/.exec(o.id || '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  scan(state.walls); scan(state.openings); scan(state.rooms); scan(state.furniture);
  _id = max + 1;
}

export const state = {
  meta: { name: 'Untitled Home', address: '' },
  defaults: { wallHeight: 9, wallThickness: 0.5 },
  exterior: 0xe7e0cf,
  walls: [],
  openings: [],
  rooms: [],
  furniture: [],
};

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function emitChange() { listeners.forEach(fn => fn()); }

// ---- Undo stack ---------------------------------------------------------
const undoStack = [];
let redoStack = [];
export function snapshot() {
  undoStack.push(JSON.stringify(serialize()));
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
}
export function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(serialize()));
  load(JSON.parse(undoStack.pop()), false);
  emitChange();
}
export function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(serialize()));
  load(JSON.parse(redoStack.pop()), false);
  emitChange();
}

// ---- (de)serialize ------------------------------------------------------
export function serialize() {
  return {
    meta: state.meta,
    defaults: state.defaults,
    exterior: state.exterior,
    walls: state.walls,
    openings: state.openings,
    rooms: state.rooms,
    furniture: state.furniture,
  };
}

export function load(data, takeSnapshot = true) {
  if (takeSnapshot) snapshot();
  state.meta = data.meta || { name: 'Untitled Home', address: '' };
  state.defaults = data.defaults || { wallHeight: 9, wallThickness: 0.5 };
  state.exterior = data.exterior ?? 0xe7e0cf;
  state.walls = data.walls || [];
  state.openings = data.openings || [];
  state.rooms = data.rooms || [];
  state.furniture = data.furniture || [];
  reseedIds(state);
}

export function loadStarter() { load(structuredClone(STARTER_HOME)); emitChange(); }

export function clearAll() {
  load({ meta: { name: 'Untitled Home', address: '' },
         defaults: state.defaults, exterior: state.exterior,
         walls: [], openings: [], rooms: [], furniture: [] });
  emitChange();
}

export function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
}
export function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try { load(JSON.parse(raw), false); return true; } catch { return false; }
}
export function hasLocal() { return !!localStorage.getItem(STORAGE_KEY); }

// ---- Geometry helpers ---------------------------------------------------
export function wallById(id) { return state.walls.find(w => w.id === id); }

export function wallLength(w) {
  return Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
}

// Returns {point, t, dist} for the closest point on a wall to (px,py).
export function projectOnWall(w, px, py) {
  const dx = w.x2 - w.x1, dy = w.y2 - w.y1;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - w.x1) * dx + (py - w.y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const x = w.x1 + t * dx, y = w.y1 + t * dy;
  return { x, y, t, dist: Math.hypot(px - x, py - y) };
}

export function nearestWall(px, py, maxDist = 1.2) {
  let best = null;
  for (const w of state.walls) {
    const p = projectOnWall(w, px, py);
    if (p.dist <= maxDist && (!best || p.dist < best.dist)) best = { wall: w, ...p };
  }
  return best;
}

// Point-in-polygon for room hit testing.
export function pointInPoly(pt, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    const hit = (yi > pt.y) !== (yj > pt.y) &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function polyCentroid(poly) {
  let x = 0, y = 0;
  poly.forEach(p => { x += p.x; y += p.y; });
  return { x: x / poly.length, y: y / poly.length };
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  }
  return Math.abs(a / 2);
}

export function boundsOf(state_) {
  const xs = [], ys = [];
  state_.walls.forEach(w => { xs.push(w.x1, w.x2); ys.push(w.y1, w.y2); });
  state_.rooms.forEach(r => r.points.forEach(p => { xs.push(p.x); ys.push(p.y); }));
  state_.furniture.forEach(f => { xs.push(f.x); ys.push(f.y); });
  if (!xs.length) return { minX: -20, minY: -20, maxX: 40, maxY: 40 };
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}
