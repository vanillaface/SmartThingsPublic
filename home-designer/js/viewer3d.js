// 3D visualizer built with Three.js. Reconstructs the scene from the shared
// state: floors, walls (with door/window cutouts), painted room surfaces,
// flat or vaulted ceilings, and furniture.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { state, wallLength, polyCentroid, boundsOf } from './state.js';
import { FURNITURE, FLOOR_MATERIALS } from './library.js';

export class Viewer3D {
  constructor(container) {
    this.el = container;
    this.opts = { ceilings: true, roof: false, furniture: true, cutaway: false };
    this.ready = false;
  }

  init() {
    if (this.ready) return;
    this.ready = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xaaccee);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.el.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;

    // lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b7280, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.1);
    sun.position.set(60, 90, 40);
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({ color: 0x7c9a6b })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    this.scene.add(ground);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._resize();
    window.addEventListener('resize', () => this._resize());

    const loop = () => {
      this._raf = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  setOpts(partial) { Object.assign(this.opts, partial); this.build(); }

  _resize() {
    const w = this.el.clientWidth || 1, h = this.el.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frameCamera() {
    const b = boundsOf(state);
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxY - b.minY, 20);
    this.controls.target.set(cx, 4, cz);
    this.camera.position.set(cx + span * 0.9, span * 0.8, cz + span * 1.1);
    this.controls.update();
  }

  _clear() {
    this.root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    });
    this.root.clear();
  }

  build() {
    if (!this.ready) return;
    this._clear();
    const wallCap = this.opts.cutaway ? 4 : Infinity;

    state.rooms.forEach(r => this._room(r, wallCap));
    state.walls.forEach(w => this._wall(w, wallCap));
    if (this.opts.furniture) state.furniture.forEach(f => this._furniture(f));
    if (this.opts.roof && !this.opts.cutaway) this._roof();
  }

  // ---- rooms: floor, painted walls, ceiling --------------------------
  _room(r, wallCap) {
    const shape = new THREE.Shape();
    r.points.forEach((p, i) => i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y));
    shape.closePath();

    // floor
    const mat = FLOOR_MATERIALS[r.floor] || FLOOR_MATERIALS.oak;
    const fGeo = new THREE.ShapeGeometry(shape);
    fGeo.rotateX(Math.PI / 2);          // lay flat, normal up
    const floor = new THREE.Mesh(fGeo, new THREE.MeshStandardMaterial({
      color: mat.color, roughness: 0.85, side: THREE.DoubleSide }));
    floor.position.y = 0.01;
    this.root.add(floor);

    const h = (r.ceiling && r.ceiling.height) || state.defaults.wallHeight;

    // painted interior surfaces (inset slightly from structural walls)
    const paintMat = new THREE.MeshStandardMaterial({ color: r.paint ?? 0xf3efe7, roughness: 0.95, side: THREE.DoubleSide });
    const c = polyCentroid(r.points);
    const inset = 0.06;
    const top = Math.min(h, wallCap);
    for (let i = 0; i < r.points.length; i++) {
      const a = r.points[i], b = r.points[(i + 1) % r.points.length];
      this._paintEdge(a, b, c, inset, top, paintMat);
    }

    // ceiling
    if (this.opts.ceilings && !this.opts.cutaway) {
      if (r.ceiling && r.ceiling.type === 'vaulted') this._vault(r, h, r.ceiling.ridge || h + 5, paintMat);
      else {
        const cGeo = new THREE.ShapeGeometry(shape);
        cGeo.rotateX(Math.PI / 2);
        const ceil = new THREE.Mesh(cGeo, new THREE.MeshStandardMaterial({ color: 0xf6f6f4, side: THREE.DoubleSide, roughness: 1 }));
        ceil.position.y = h;
        this.root.add(ceil);
      }
    }
  }

  // Paint one interior wall surface for a room edge, cutting the same
  // door/window holes that the structural wall has.
  _paintEdge(a, b, centroid, inset, top, mat) {
    const ex = b.x - a.x, ez = b.y - a.y;
    const edgeLen = Math.hypot(ex, ez);
    if (edgeLen < 1e-3) return;
    const dx = ex / edgeLen, dz = ez / edgeLen;        // along edge
    const nx = -dz, nz = dx;                            // edge normal
    // inset toward room interior
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const sign = ((centroid.x - mid.x) * nx + (centroid.y - mid.y) * nz) >= 0 ? 1 : -1;
    const ox = nx * inset * sign, oz = nz * inset * sign;
    const A = { x: a.x + ox, z: a.y + oz };

    // gather openings on walls collinear with this edge
    const cuts = [];
    for (const w of state.walls) {
      const wl = wallLength(w); if (wl < 1e-3) continue;
      const wdx = (w.x2 - w.x1) / wl, wdz = (w.y2 - w.y1) / wl;
      if (Math.abs(wdx * dz - wdz * dx) > 0.03) continue;          // not parallel
      const perp = Math.abs((w.x1 - a.x) * nx + (w.y1 - a.y) * nz); // distance edge->wall line
      if (perp > 0.7) continue;
      for (const o of state.openings.filter(op => op.wallId === w.id)) {
        const cxp = w.x1 + wdx * o.pos, czp = w.y1 + wdz * o.pos;
        const t = (cxp - a.x) * dx + (czp - a.y) * dz;             // along edge from A
        cuts.push({ s: t - o.width / 2, e: t + o.width / 2,
                    sill: o.sill, head: Math.min(top, o.sill + o.height) });
      }
    }
    cuts.sort((p, q) => p.s - q.s);

    const quad = (a0, a1, vLo, vHi) => {
      if (a1 - a0 <= 1e-3 || vHi - vLo <= 1e-3) return;
      const x0 = A.x + dx * a0, z0 = A.z + dz * a0;
      const x1 = A.x + dx * a1, z1 = A.z + dz * a1;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        x0, vLo, z0,  x1, vLo, z1,  x1, vHi, z1,
        x0, vLo, z0,  x1, vHi, z1,  x0, vHi, z0]), 3));
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, mat));
    };

    let cursor = 0;
    for (const o of cuts) {
      const s = Math.max(0, o.s), e = Math.min(edgeLen, o.e);
      if (e <= 0 || s >= edgeLen) continue;
      if (s > cursor) quad(cursor, s, 0, top);
      if (o.sill > 0) quad(s, e, 0, Math.min(o.sill, top));         // below window
      if (o.head < top) quad(s, e, o.head, top);                    // above opening
      cursor = Math.max(cursor, e);
    }
    if (cursor < edgeLen) quad(cursor, edgeLen, 0, top);
  }

  _vault(r, wallH, ridgeH, paintMat) {
    const xs = r.points.map(p => p.x), zs = r.points.map(p => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const white = new THREE.MeshStandardMaterial({ color: 0xf6f6f4, side: THREE.DoubleSide, roughness: 1 });
    const quad = (p1, p2, p3, p4, m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
        ...p1, ...p2, ...p3,  ...p1, ...p3, ...p4]), 3));
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, m));
    };
    const tri = (p1, p2, p3, m) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p1, ...p2, ...p3]), 3));
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, m));
    };
    if ((maxX - minX) >= (maxZ - minZ)) {
      const midZ = (minZ + maxZ) / 2;
      quad([minX, wallH, minZ], [maxX, wallH, minZ], [maxX, ridgeH, midZ], [minX, ridgeH, midZ], white);
      quad([minX, wallH, maxZ], [maxX, wallH, maxZ], [maxX, ridgeH, midZ], [minX, ridgeH, midZ], white);
      tri([minX, wallH, minZ], [minX, wallH, maxZ], [minX, ridgeH, midZ], paintMat);
      tri([maxX, wallH, minZ], [maxX, wallH, maxZ], [maxX, ridgeH, midZ], paintMat);
    } else {
      const midX = (minX + maxX) / 2;
      quad([minX, wallH, minZ], [minX, wallH, maxZ], [midX, ridgeH, maxZ], [midX, ridgeH, minZ], white);
      quad([maxX, wallH, minZ], [maxX, wallH, maxZ], [midX, ridgeH, maxZ], [midX, ridgeH, minZ], white);
      tri([minX, wallH, minZ], [maxX, wallH, minZ], [midX, ridgeH, minZ], paintMat);
      tri([minX, wallH, maxZ], [maxX, wallH, maxZ], [midX, ridgeH, maxZ], paintMat);
    }
  }

  // ---- walls with openings -------------------------------------------
  _wall(w, wallCap) {
    const L = wallLength(w);
    if (L < 1e-3) return;
    const H = Math.min(w.height || state.defaults.wallHeight, wallCap);
    const T = w.thickness || state.defaults.wallThickness;
    const dx = (w.x2 - w.x1) / L, dy = (w.y2 - w.y1) / L;
    const angle = Math.atan2(-dy, dx);
    const isExt = T >= 0.55;
    const mat = new THREE.MeshStandardMaterial({
      color: isExt ? state.exterior : 0xece7dd, roughness: 0.9 });

    const ops = state.openings.filter(o => o.wallId === w.id)
      .map(o => ({ ...o, s: Math.max(0, o.pos - o.width / 2), e: Math.min(L, o.pos + o.width / 2) }))
      .sort((a, b) => a.s - b.s);

    const addBox = (a0, a1, vLo, vHi) => {
      const segLen = a1 - a0, segH = vHi - vLo;
      if (segLen <= 1e-3 || segH <= 1e-3) return;
      const geo = new THREE.BoxGeometry(segLen, segH, T);
      const m = new THREE.Mesh(geo, mat);
      const a = (a0 + a1) / 2;
      m.position.set(w.x1 + dx * a, (vLo + vHi) / 2, w.y1 + dy * a);
      m.rotation.y = angle;
      this.root.add(m);
    };

    let cursor = 0;
    for (const o of ops) {
      if (o.s > cursor) addBox(cursor, o.s, 0, H);
      const head = Math.min(H, o.sill + o.height);
      if (o.sill > 0) addBox(o.s, o.e, 0, Math.min(o.sill, H));          // under window
      if (head < H) addBox(o.s, o.e, head, H);                           // lintel above
      if (o.type === 'window') this._window(w, o, dx, dy, angle, T);
      else if (o.type === 'door') this._door(w, o, dx, dy, angle, T);
      cursor = Math.max(cursor, o.e);
    }
    if (cursor < L) addBox(cursor, L, 0, H);
  }

  _window(w, o, dx, dy, angle, T) {
    const a = o.pos;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(o.width - 0.3, o.height - 0.3, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x9fd0e8, transparent: true, opacity: 0.4, metalness: 0.1, roughness: 0.1 }));
    glass.position.set(w.x1 + dx * a, o.sill + o.height / 2, w.y1 + dy * a);
    glass.rotation.y = angle;
    this.root.add(glass);
    this.root.add(this._frameRing(o.width, o.height, T, glass.position, angle, 0xf2f2f0));
  }

  _frameRing(width, height, T, pos, angle, color) {
    const grp = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const b = 0.18; // frame thickness
    const parts = [
      [width, b, 0, height / 2 - b / 2],
      [width, b, 0, -height / 2 + b / 2],
      [b, height, -width / 2 + b / 2, 0],
      [b, height, width / 2 - b / 2, 0],
    ];
    parts.forEach(([pw, ph, ox, oy]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, T + 0.08), m);
      mesh.position.set(ox, oy, 0);
      grp.add(mesh);
    });
    grp.position.copy(pos); grp.rotation.y = angle;
    return grp;
  }

  _door(w, o, dx, dy, angle, T) {
    const a = o.pos;
    if (o.type === 'opening') return; // cased opening: no leaf
    const leaf = new THREE.Mesh(
      new THREE.BoxGeometry(o.width - 0.2, o.height - 0.1, 0.16),
      new THREE.MeshStandardMaterial({ color: 0x9a6b43, roughness: 0.6 }));
    leaf.position.set(w.x1 + dx * a, o.height / 2, w.y1 + dy * a);
    leaf.rotation.y = angle;
    this.root.add(leaf);
    // knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xd8c178, metalness: 0.6, roughness: 0.3 }));
    knob.position.set(w.x1 + dx * (a + (o.width / 2 - 0.4)), o.height / 2, w.y1 + dy * (a + (o.width / 2 - 0.4)));
    this.root.add(knob);
  }

  // ---- furniture ------------------------------------------------------
  _furniture(f) {
    const def = FURNITURE[f.cat]; if (!def) return;
    const grp = (this._builders[f.cat] || this._builders._box)(def);
    grp.position.set(f.x, 0, f.y);
    grp.rotation.y = -(f.rot || 0) * Math.PI / 180;
    this.root.add(grp);
  }

  get _builders() {
    if (this.__builders) return this.__builders;
    const std = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
    const box = (w, h, d, color, y) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color));
      m.position.y = y; return m;
    };
    const B = {
      _box: (def) => { const g = new THREE.Group(); g.add(box(def.w, def.h, def.d, def.color, def.h / 2)); return g; },

      rug: (def) => { const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(def.w, 0.06, def.d), std(def.color, { roughness: 1 }));
        m.position.y = 0.03; g.add(m); return g; },

      sofa: (def) => { const g = new THREE.Group();
        g.add(box(def.w, 1.0, def.d, def.color, 0.7));                       // seat base
        g.add(box(def.w, 1.6, 0.6, def.color, 1.5 - 0.0 + 0.3));            // back
        const back = g.children[1]; back.position.set(0, 1.5, -def.d / 2 + 0.3);
        g.add(Object.assign(box(0.5, 1.3, def.d, def.color, 1.1), { }));     // left arm
        g.children[2].position.x = -def.w / 2 + 0.25;
        const ra = box(0.5, 1.3, def.d, def.color, 1.1); ra.position.x = def.w / 2 - 0.25; g.add(ra);
        return g; },
      loveseat: (def) => B.sofa(def),
      armchair: (def) => B.sofa(def),

      bedking: (def) => B._bed(def), bedqueen: (def) => B._bed(def), bedtwin: (def) => B._bed(def),
      _bed: (def) => { const g = new THREE.Group();
        g.add(box(def.w, 0.6, def.d, 0x6b4a30, 0.5));                        // frame
        const mat = box(def.w - 0.3, 0.8, def.d - 0.6, 0xeae6df, 1.1); mat.position.z = 0.3; g.add(mat);
        const hb = box(def.w, 2.2, 0.4, 0x5a4030, 1.1); hb.position.z = -def.d / 2 + 0.2; g.add(hb);
        const pillow = box(def.w - 1.2, 0.4, 1.2, 0xffffff, 1.7); pillow.position.z = -def.d / 2 + 1.2; g.add(pillow);
        return g; },

      diningtable: (def) => B._table(def), coffeetable: (def) => B._table(def), desk: (def) => B._table(def),
      _table: (def) => { const g = new THREE.Group();
        const top = box(def.w, 0.25, def.d, def.color, def.h - 0.12); g.add(top);
        const lh = def.h - 0.25;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
          const leg = box(0.25, lh, 0.25, def.color, lh / 2);
          leg.position.set(sx * (def.w / 2 - 0.3), lh / 2, sz * (def.d / 2 - 0.3)); g.add(leg);
        });
        return g; },

      diningchair: (def) => B._chair(def), officechair: (def) => B._chair(def),
      _chair: (def) => { const g = new THREE.Group();
        g.add(box(def.w, 0.2, def.d, def.color, 1.5));
        const back = box(def.w, 1.4, 0.18, def.color, 2.2); back.position.z = -def.d / 2 + 0.1; g.add(back);
        const lh = 1.5;
        [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
          const leg = box(0.15, lh, 0.15, def.color, lh / 2);
          leg.position.set(sx * (def.w / 2 - 0.2), lh / 2, sz * (def.d / 2 - 0.2)); g.add(leg);
        });
        return g; },

      fridge: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h, def.d, def.color, def.h / 2));
        const h1 = box(0.12, 2.5, 0.12, 0x888d92, 4.5); h1.position.set(def.w / 2 - 0.2, 4.2, def.d / 2); g.add(h1);
        return g; },
      range: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h, def.d, def.color, def.h / 2));
        const top = box(def.w - 0.2, 0.1, def.d - 0.2, 0x222428, def.h + 0.02); g.add(top);
        return g; },
      island: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h - 0.1, def.d, def.color, (def.h - 0.1) / 2));
        const top = box(def.w + 0.2, 0.18, def.d + 0.2, 0x3a3d42, def.h); g.add(top); return g; },
      counter: (def) => B.island(def), sink: (def) => B.island(def), vanity: (def) => B.island(def),

      bookshelf: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h, def.d, def.color, def.h / 2));
        for (let i = 1; i <= 4; i++) { const s = box(def.w - 0.2, 0.08, def.d - 0.1, 0x4a3320, i * def.h / 5); g.add(s); }
        return g; },
      dresser: (def) => B._box(def), nightstand: (def) => B._box(def), tvstand: (def) => B._box(def), wardrobe: (def) => B._box(def),

      toilet: (def) => { const g = new THREE.Group();
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 1.3, 16), std(def.color)); bowl.position.set(0, 0.8, 0.4); g.add(bowl);
        const tank = box(1.6, 1.4, 0.7, def.color, 1.4); tank.position.z = -def.d / 2 + 0.4; g.add(tank);
        return g; },
      bathtub: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h, def.d, def.color, def.h / 2));
        const inner = box(def.w - 0.6, 0.6, def.d - 0.6, 0xdfeef5, def.h - 0.2); g.add(inner); return g; },
      shower: (def) => { const g = new THREE.Group();
        const m = new THREE.Mesh(new THREE.BoxGeometry(def.w, def.h, def.d),
          new THREE.MeshStandardMaterial({ color: 0xbcd6e0, transparent: true, opacity: 0.3 }));
        m.position.y = def.h / 2; g.add(m);
        g.add(box(def.w, 0.1, def.d, 0xd8d3c5, 0.05)); return g; },

      plant: (def) => { const g = new THREE.Group();
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.6, 1.2, 12), std(0x8a5a3c)); pot.position.y = 0.6; g.add(pot);
        const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 12), std(def.color)); foliage.position.y = 2.6; g.add(foliage);
        return g; },
      fireplace: (def) => { const g = new THREE.Group();
        g.add(box(def.w, def.h, def.d, def.color, def.h / 2));
        const open = box(def.w - 2, 2, 0.3, 0x1a1a1a, 1.5); open.position.z = def.d / 2; g.add(open); return g; },
      stairs: (def) => { const g = new THREE.Group();
        const n = 8; const rise = def.h / n; const run = def.d / n;
        for (let i = 0; i < n; i++) {
          const step = box(def.w, rise, def.d - i * run, def.color, rise * (i + 0.5));
          step.position.z = (i * run) / 2;
          g.add(step);
        }
        return g; },
    };
    this.__builders = B;
    return B;
  }

  // ---- simple exterior gable roof over the whole footprint -----------
  _roof() {
    const b = boundsOf(state);
    const wallH = state.defaults.wallHeight;
    const ridge = wallH + Math.min((b.maxY - b.minY), (b.maxX - b.minX)) * 0.35;
    const over = 1.2;
    const minX = b.minX - over, maxX = b.maxX + over, minZ = b.minY - over, maxZ = b.maxY + over;
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b4a3a, side: THREE.DoubleSide, roughness: 0.95 });
    const quad = (p1, p2, p3, p4) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p1, ...p2, ...p3, ...p1, ...p3, ...p4]), 3));
      g.computeVertexNormals();
      this.root.add(new THREE.Mesh(g, mat));
    };
    const midZ = (minZ + maxZ) / 2;
    quad([minX, wallH, minZ], [maxX, wallH, minZ], [maxX, ridge, midZ], [minX, ridge, midZ]);
    quad([minX, wallH, maxZ], [maxX, wallH, maxZ], [maxX, ridge, midZ], [minX, ridge, midZ]);
    const gable = new THREE.MeshStandardMaterial({ color: state.exterior, side: THREE.DoubleSide });
    const tri = (p1, p2, p3) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p1, ...p2, ...p3]), 3));
      g.computeVertexNormals(); this.root.add(new THREE.Mesh(g, gable));
    };
    tri([minX, wallH, minZ], [minX, wallH, maxZ], [minX, ridge, midZ]);
    tri([maxX, wallH, minZ], [maxX, wallH, maxZ], [maxX, ridge, midZ]);
  }
}
