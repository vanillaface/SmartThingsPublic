# Home Designer (2D / 3D)

A self-contained web app for designing a home in 2D — walls, doors, windows,
rooms — and visualizing it in 3D, with a library of finishes and furniture and
per-room ceiling options (including vaulted ceilings).

It opens pre-loaded with an editable starter design for **2544 N 90th St,
Wauwatosa, WI 53226**.

## Run it

No build step. Either:

- **Open directly:** double-click `home-designer/index.html` in a modern
  browser (Chrome, Edge, Firefox, Safari). 3D uses Three.js loaded from a CDN,
  so an internet connection is needed the first time.
- **Or serve it** (avoids any local-file restrictions):

  ```bash
  cd home-designer
  python3 -m http.server 8000
  # then visit http://localhost:8000
  ```

## Features

**2D plan editor**
- Draw walls as connected chains; doors, windows, and cased openings snap onto
  walls. Wall lengths and room areas are labeled live.
- Select / move / delete anything; grid + endpoint snapping (hold **Alt** to
  disable snapping).
- Define rooms as polygons; each gets a floor material, paint color, and ceiling.

**3D visualizer**
- Walls are extruded with real door/window cutouts; glass, frames, and door
  leaves are modeled.
- Interior paint, floor materials, and furniture render in 3D.
- Per-room **flat or vaulted** ceilings (set the ridge height).
- Toggles: ceilings, furniture, exterior roof, and a "dollhouse" cutaway view.
- Orbit / zoom / pan camera.

**Library**
- 30+ furniture pieces across Living, Dining, Kitchen, Bedroom, Bath, Office,
  Decor, and Structure (incl. a staircase). Drag onto the plan or click to drop.
- Finishes: 9 floor materials, 10 wall paints, 6 exterior finishes.

**Project**
- Save/Open in the browser (localStorage), Export/Import JSON, Clear, and
  Load Starter Home. Undo/redo with **Ctrl/Cmd+Z** / **Shift+Ctrl/Cmd+Z**.

## Keyboard shortcuts

`V` select · `W` wall · `D` door · `N` window · `R` room · `X` delete ·
`Del` remove selection · `Esc` cancel · `Enter`/double-click finish a wall
chain or close a room.

## About the starter design

Live listing data for the exact address is paywalled, so the starter floor plan
is seeded from the typical footprint and layout of the 2-story prewar/Cape Cod
homes on N 90th St in Wauwatosa (e.g. a comparable on the block, 2504 N 90th St,
is ~2,555 sqft, 4 bd / 2.5 ba). The included main floor (~1,064 sqft: living,
dining, kitchen, family/foyer with staircase) is a starting point — edit walls,
rooms, and finishes to match your home exactly.

## Files

```
home-designer/
  index.html          # layout + import map
  css/styles.css
  js/
    main.js           # app controller, panels, save/load
    state.js          # data model, persistence, undo, geometry helpers
    editor2d.js       # 2D canvas plan editor
    viewer3d.js       # Three.js 3D scene builder
    library.js        # furniture + finish catalogs
    presets.js        # the starter home
```

Data model units are in **feet**. The plan's Y axis maps to the 3D Z axis.
