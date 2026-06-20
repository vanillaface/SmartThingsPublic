// Shared catalogs for furniture and finishing materials.
// Dimensions are in FEET. w = width (local X), d = depth (local Y), h = height (Z/up).

export const FURNITURE = {
  // Living room
  sofa:        { name: 'Sofa',          icon: '🛋️', cat: 'Living',   w: 7.0, d: 3.0, h: 2.8, color: 0x6d7b8d },
  loveseat:    { name: 'Loveseat',      icon: '🛋️', cat: 'Living',   w: 5.0, d: 3.0, h: 2.8, color: 0x7d6d8d },
  armchair:    { name: 'Armchair',      icon: '🪑', cat: 'Living',   w: 3.0, d: 3.0, h: 2.8, color: 0x8d7d6d },
  coffeetable: { name: 'Coffee Table',  icon: '▭',  cat: 'Living',   w: 4.0, d: 2.0, h: 1.4, color: 0x8a5a3c },
  tvstand:     { name: 'TV Stand',      icon: '📺', cat: 'Living',   w: 5.0, d: 1.5, h: 2.0, color: 0x3c3c40 },
  bookshelf:   { name: 'Bookshelf',     icon: '📚', cat: 'Living',   w: 3.0, d: 1.0, h: 6.0, color: 0x6b4a30 },
  rug:         { name: 'Area Rug',      icon: '▬',  cat: 'Living',   w: 8.0, d: 5.0, h: 0.08, color: 0xb07a6a },

  // Dining / kitchen
  diningtable: { name: 'Dining Table',  icon: '🍽️', cat: 'Dining',   w: 6.0, d: 3.5, h: 2.5, color: 0x7a4a28 },
  diningchair: { name: 'Dining Chair',  icon: '🪑', cat: 'Dining',   w: 1.6, d: 1.6, h: 3.0, color: 0x5a4030 },
  island:      { name: 'Kitchen Island',icon: '🧱', cat: 'Kitchen',  w: 6.0, d: 3.0, h: 3.0, color: 0xcfcabb },
  counter:     { name: 'Counter',       icon: '▭',  cat: 'Kitchen',  w: 8.0, d: 2.0, h: 3.0, color: 0xd8d3c5 },
  fridge:      { name: 'Refrigerator',  icon: '🧊', cat: 'Kitchen',  w: 3.0, d: 2.8, h: 6.0, color: 0xb8c0c8 },
  range:       { name: 'Range / Stove', icon: '🔥', cat: 'Kitchen',  w: 2.5, d: 2.5, h: 3.0, color: 0x44474c },
  sink:        { name: 'Sink Cabinet',  icon: '🚰', cat: 'Kitchen',  w: 3.0, d: 2.0, h: 3.0, color: 0xd8d3c5 },

  // Bedroom
  bedking:     { name: 'King Bed',      icon: '🛏️', cat: 'Bedroom',  w: 6.5, d: 7.0, h: 2.2, color: 0x8a93a3 },
  bedqueen:    { name: 'Queen Bed',     icon: '🛏️', cat: 'Bedroom',  w: 5.3, d: 6.8, h: 2.2, color: 0x8a93a3 },
  bedtwin:     { name: 'Twin Bed',      icon: '🛏️', cat: 'Bedroom',  w: 3.5, d: 6.5, h: 2.2, color: 0x8a93a3 },
  nightstand:  { name: 'Nightstand',    icon: '▫',  cat: 'Bedroom',  w: 1.7, d: 1.5, h: 2.0, color: 0x6b4a30 },
  dresser:     { name: 'Dresser',       icon: '🗄️', cat: 'Bedroom',  w: 5.0, d: 1.7, h: 3.0, color: 0x6b4a30 },
  wardrobe:    { name: 'Wardrobe',      icon: '🚪', cat: 'Bedroom',  w: 4.0, d: 2.0, h: 7.0, color: 0x5a4030 },

  // Bathroom
  toilet:      { name: 'Toilet',        icon: '🚽', cat: 'Bath',     w: 1.7, d: 2.5, h: 2.5, color: 0xf2f2f2 },
  bathtub:     { name: 'Bathtub',       icon: '🛁', cat: 'Bath',     w: 5.0, d: 2.6, h: 1.8, color: 0xf2f2f2 },
  vanity:      { name: 'Vanity',        icon: '🪞', cat: 'Bath',     w: 3.0, d: 1.8, h: 3.0, color: 0xd8d3c5 },
  shower:      { name: 'Shower',        icon: '🚿', cat: 'Bath',     w: 3.0, d: 3.0, h: 6.5, color: 0xbcd6e0 },

  // Office / misc
  desk:        { name: 'Desk',          icon: '💻', cat: 'Office',   w: 5.0, d: 2.5, h: 2.5, color: 0x6b4a30 },
  officechair: { name: 'Office Chair',  icon: '🪑', cat: 'Office',   w: 2.2, d: 2.2, h: 3.5, color: 0x303236 },
  plant:       { name: 'Plant',         icon: '🪴', cat: 'Decor',    w: 2.0, d: 2.0, h: 4.5, color: 0x3f7d44 },
  fireplace:   { name: 'Fireplace',     icon: '🔥', cat: 'Decor',    w: 5.0, d: 1.5, h: 4.5, color: 0x8a8175 },
  stairs:      { name: 'Staircase',     icon: '🪜', cat: 'Structure',w: 3.5, d: 10.0,h: 9.0, color: 0x9a8775 },
};

export const FURNITURE_CATEGORIES = ['Living', 'Dining', 'Kitchen', 'Bedroom', 'Bath', 'Office', 'Decor', 'Structure'];

export const FLOOR_MATERIALS = {
  oak:      { name: 'Oak Hardwood',   color: 0xb98b5e },
  walnut:   { name: 'Walnut',         color: 0x6b4226 },
  maple:    { name: 'Light Maple',    color: 0xd8b486 },
  tile:     { name: 'Ceramic Tile',   color: 0xd9d5cc },
  marble:   { name: 'Marble',         color: 0xeae8e3 },
  slate:    { name: 'Slate',          color: 0x4a4f55 },
  carpetbg: { name: 'Beige Carpet',   color: 0xc9bda8 },
  carpetgy: { name: 'Gray Carpet',    color: 0x8d8d8d },
  concrete: { name: 'Concrete',       color: 0x9a9a9a },
};

export const WALL_PAINTS = [
  { name: 'Warm White',  color: 0xf3efe7 },
  { name: 'Cool White',  color: 0xf2f4f6 },
  { name: 'Greige',      color: 0xcfc6b8 },
  { name: 'Soft Gray',   color: 0xc3c7cb },
  { name: 'Sage',        color: 0xa9b4a0 },
  { name: 'Sky Blue',    color: 0xaecadb },
  { name: 'Navy',        color: 0x36465e },
  { name: 'Clay',        color: 0xc18f72 },
  { name: 'Charcoal',    color: 0x44474c },
  { name: 'Butter',      color: 0xf0e2b0 },
];

export const EXTERIOR_FINISHES = [
  { name: 'Cream Siding',  color: 0xe7e0cf },
  { name: 'Tan Brick',     color: 0xc9a884 },
  { name: 'Red Brick',     color: 0x9d5a45 },
  { name: 'Gray Stucco',   color: 0xb8b6ad },
  { name: 'White Clapboard', color: 0xf0efe9 },
  { name: 'Sage Siding',   color: 0x9fae97 },
];

export function hex(n) {
  return '#' + n.toString(16).padStart(6, '0');
}
