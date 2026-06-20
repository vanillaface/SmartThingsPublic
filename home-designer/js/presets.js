// Pre-designed starter home, seeded from the footprint and room layout typical
// of the 2-story prewar/Cape Cod homes on N 90th St in Wauwatosa (53226).
// Comparable on the block (2504 N 90th St): ~2,555 sqft, 4 bd / 2.5 ba.
// This is the MAIN FLOOR — fully editable. All measurements in feet.

const H = 9;          // wall height
const EXT = 0.6;      // exterior wall thickness
const INT = 0.4;      // interior wall thickness

const door  = (id, wallId, pos, width = 3.0)              => ({ id, wallId, type: 'door',    pos, width, height: 6.8, sill: 0 });
const win   = (id, wallId, pos, width = 4.0, sill = 2.5)  => ({ id, wallId, type: 'window',  pos, width, height: 4.0, sill });
const cased = (id, wallId, pos, width = 4.0)              => ({ id, wallId, type: 'opening', pos, width, height: 7.0, sill: 0 });

export const STARTER_HOME = {
  meta: { name: '2544 N 90th St — Main Floor', address: '2544 N 90th St, Wauwatosa, WI 53226' },
  defaults: { wallHeight: H, wallThickness: INT },
  exterior: 0xc9a884, // tan brick

  walls: [
    // Exterior shell (38 x 28 footprint)
    { id: 'w1', x1: 0,  y1: 0,  x2: 38, y2: 0,  thickness: EXT, height: H }, // front
    { id: 'w2', x1: 38, y1: 0,  x2: 38, y2: 28, thickness: EXT, height: H }, // right
    { id: 'w3', x1: 38, y1: 28, x2: 0,  y2: 28, thickness: EXT, height: H }, // back
    { id: 'w4', x1: 0,  y1: 28, x2: 0,  y2: 0,  thickness: EXT, height: H }, // left
    // Interior partitions
    { id: 'w5', x1: 0,  y1: 16, x2: 38, y2: 16, thickness: INT, height: H }, // mid horizontal
    { id: 'w6', x1: 20, y1: 0,  x2: 20, y2: 16, thickness: INT, height: H }, // living | dining
    { id: 'w7', x1: 20, y1: 16, x2: 20, y2: 28, thickness: INT, height: H }, // foyer | kitchen
  ],

  openings: [
    // Front wall (w1): entry + living/dining windows
    door('o1', 'w1', 6,  3.2),
    win ('o2', 'w1', 12, 5.0),
    win ('o3', 'w1', 28, 5.0),
    // Right wall (w2): dining + kitchen windows
    win ('o4', 'w2', 7,  4.0),
    win ('o5', 'w2', 20, 4.0),
    // Back wall (w3): kitchen back door + family windows
    door('o6', 'w3', 4,  3.0),
    win ('o7', 'w3', 12, 4.0),
    win ('o8', 'w3', 24, 5.0),
    // Left wall (w4): family + living windows
    win ('o9',  'w4', 6,  4.0),
    win ('o10', 'w4', 20, 5.0),
    // Interior connections
    cased('o11', 'w5', 4,  3.5),  // living <-> family
    cased('o12', 'w5', 30, 4.0),  // dining <-> kitchen
    cased('o13', 'w6', 7,  6.0),  // living <-> dining (wide opening)
    door ('o14', 'w7', 4,  3.0),  // foyer <-> kitchen
  ],

  rooms: [
    { id: 'r1', name: 'Living Room',
      points: [{x:0,y:0},{x:20,y:0},{x:20,y:16},{x:0,y:16}],
      floor: 'oak', paint: 0xf3efe7,
      ceiling: { type: 'vaulted', height: H, ridge: 14 } },
    { id: 'r2', name: 'Dining Room',
      points: [{x:20,y:0},{x:38,y:0},{x:38,y:16},{x:20,y:16}],
      floor: 'oak', paint: 0xa9b4a0,
      ceiling: { type: 'flat', height: H } },
    { id: 'r3', name: 'Kitchen',
      points: [{x:20,y:16},{x:38,y:16},{x:38,y:28},{x:20,y:28}],
      floor: 'tile', paint: 0xf2f4f6,
      ceiling: { type: 'flat', height: H } },
    { id: 'r4', name: 'Family / Foyer',
      points: [{x:0,y:16},{x:20,y:16},{x:20,y:28},{x:0,y:28}],
      floor: 'oak', paint: 0xcfc6b8,
      ceiling: { type: 'flat', height: H } },
  ],

  furniture: [
    // Living room
    { id: 'f1',  cat: 'rug',         x: 10,  y: 8,   rot: 0 },
    { id: 'f2',  cat: 'sofa',        x: 10,  y: 13.3,rot: 0 },
    { id: 'f3',  cat: 'coffeetable', x: 10,  y: 9,   rot: 0 },
    { id: 'f4',  cat: 'tvstand',     x: 10,  y: 2.5, rot: 0 },
    { id: 'f5',  cat: 'armchair',    x: 16.5,y: 6,   rot: -30 },
    { id: 'f6',  cat: 'fireplace',   x: 1.4, y: 10,  rot: 90 },

    // Dining room
    { id: 'f7',  cat: 'diningtable', x: 29,  y: 8,   rot: 0 },
    { id: 'f8',  cat: 'diningchair', x: 29,  y: 4.6, rot: 0 },
    { id: 'f9',  cat: 'diningchair', x: 29,  y: 11.4,rot: 180 },
    { id: 'f10', cat: 'diningchair', x: 25.5,y: 8,   rot: 90 },
    { id: 'f11', cat: 'diningchair', x: 32.5,y: 8,   rot: -90 },

    // Kitchen
    { id: 'f12', cat: 'island',      x: 29,  y: 22,  rot: 0 },
    { id: 'f13', cat: 'fridge',      x: 36,  y: 18,  rot: 0 },
    { id: 'f14', cat: 'range',       x: 36,  y: 22,  rot: 0 },
    { id: 'f15', cat: 'counter',     x: 29,  y: 26.6,rot: 0 },
    { id: 'f16', cat: 'sink',        x: 23,  y: 26.6,rot: 0 },

    // Family / foyer
    { id: 'f17', cat: 'stairs',      x: 17,  y: 22,  rot: 0 },
    { id: 'f18', cat: 'bookshelf',   x: 2,   y: 19,  rot: 90 },
    { id: 'f19', cat: 'armchair',    x: 6,   y: 25,  rot: 0 },
    { id: 'f20', cat: 'plant',       x: 11,  y: 18,  rot: 0 },
  ],
};
