// Bundles the modular app into one self-contained HTML file that runs by
// just opening it in a browser - no network access, no local server needed.
//
// Three.js and OrbitControls are vendored under vendor/ (see README) and are
// embedded as base64 text. At runtime they're turned into Blob URLs and
// loaded with a dynamic import(), which is allowed for file:// pages (unlike
// static <script type="module" src="..."> across origins). This avoids any
// dependency on a CDN being reachable.
import { readFileSync, writeFileSync } from 'fs';

const dir = new URL('./', import.meta.url);
const read = p => readFileSync(new URL(p, dir), 'utf8');
const b64 = s => Buffer.from(s, 'utf8').toString('base64');

const order = ['js/library.js', 'js/presets.js', 'js/state.js', 'js/editor2d.js', 'js/viewer3d.js', 'js/main.js'];

const bodies = order.map(f => {
  let src = read(f);
  // drop the dynamic import of state.js (undo/redo are in scope after bundling)
  src = src.replace(/import\(['"]\.\/state\.js['"]\)\.then\(m\s*=>\s*e\.shiftKey\s*\?\s*m\.redo\(\)\s*:\s*m\.undo\(\)\);/, 'e.shiftKey ? redo() : undo();');
  // drop the three.js imports - THREE/OrbitControls are injected as locals below
  src = src.replace(/import\s+[\s\S]*?from\s+['"]three[^'"]*['"];?/g, '');
  // strip local module imports (may span lines)
  src = src.replace(/import\s+[\s\S]*?from\s+['"]\.\/[^'"]*['"];?/g, '');
  // remove `export ` qualifiers
  src = src.replace(/^(\s*)export\s+(const|function|class|let|var|async)\b/mg, '$1$2');
  return `\n/* ===== ${f} ===== */\n` + src.trim() + '\n';
}).join('\n');

const threeSrc = read('vendor/three.module.js');
// OrbitControls imports named bindings from 'three'; point that at the blob URL we create at runtime.
const orbitSrc = read('vendor/controls/OrbitControls.js')
  .replace(/from\s+['"]three['"]/, 'from __THREE_BLOB_URL__');

const threeB64 = b64(threeSrc);
const orbitB64 = b64(orbitSrc);

const loader = `
const _b64decode = (b64) => decodeURIComponent(escape(atob(b64)));
const _moduleFromB64 = (b64) => {
  const blob = new Blob([_b64decode(b64)], { type: 'text/javascript' });
  return URL.createObjectURL(blob);
};
const __threeUrl = _moduleFromB64(${JSON.stringify(threeB64)});
const THREE = await import(__threeUrl);
const __orbitSrcDecoded = _b64decode(${JSON.stringify(orbitB64)}).replace('__THREE_BLOB_URL__', JSON.stringify(__threeUrl));
const __orbitUrl = URL.createObjectURL(new Blob([__orbitSrcDecoded], { type: 'text/javascript' }));
const { OrbitControls } = await import(__orbitUrl);
`;

const css = read('css/styles.css');
let html = read('index.html');

html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
html = html.replace(/<link rel="stylesheet" href="css\/styles.css"\s*\/>/, `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/,
  `<script type="module">\n${loader}\n${bodies}\n</script>`);

writeFileSync(new URL('./home-designer-standalone.html', dir), html);
console.log('wrote home-designer-standalone.html,', html.length, 'bytes (fully offline, no CDN).');
