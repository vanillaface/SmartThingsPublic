// Bundles the modular app into one self-contained HTML file that runs by
// just opening it in a browser (Three.js still comes from a CDN).
import { readFileSync, writeFileSync } from 'fs';

const dir = new URL('./', import.meta.url);
const read = p => readFileSync(new URL(p, dir), 'utf8');

const order = ['js/library.js','js/presets.js','js/state.js','js/editor2d.js','js/viewer3d.js','js/main.js'];

let threeImports = [];
const bodies = order.map(f => {
  let src = read(f);
  // drop the dynamic import of state.js (undo/redo are in scope after bundling)
  src = src.replace(/import\(['"]\.\/state\.js['"]\)\.then\(m\s*=>\s*e\.shiftKey\s*\?\s*m\.redo\(\)\s*:\s*m\.undo\(\)\);/, 'e.shiftKey ? redo() : undo();');
  // capture & strip three.js imports (kept once at top); may span lines
  src = src.replace(/import\s+[\s\S]*?from\s+['"]three[^'"]*['"];?/g, m => { threeImports.push(m.trim()); return ''; });
  // strip local module imports (may span lines)
  src = src.replace(/import\s+[\s\S]*?from\s+['"]\.\/[^'"]*['"];?/g, '');
  // remove `export ` qualifiers
  src = src.replace(/^(\s*)export\s+(const|function|class|let|var|async)\b/mg, '$1$2');
  return `\n/* ===== ${f} ===== */\n` + src.trim() + '\n';
}).join('\n');

const uniqThree = [...new Set(threeImports)].join('\n');
const css = read('css/styles.css');
let html = read('index.html');

// inline css
html = html.replace(/<link rel="stylesheet" href="css\/styles.css"\s*\/>/, `<style>\n${css}\n</style>`);
// replace the module script src with an inline bundled module
html = html.replace(/<script type="module" src="js\/main.js"><\/script>/,
  `<script type="module">\n${uniqThree}\n${bodies}\n</script>`);

writeFileSync(new URL('./home-designer-standalone.html', dir), html);
console.log('wrote home-designer-standalone.html', html.length, 'bytes; three imports:\n' + uniqThree);
