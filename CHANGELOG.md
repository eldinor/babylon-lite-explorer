# Changelog

All notable changes to Babylon Lite Explorer are documented here.

## 0.3.1 - 2026-07-08

### Fixed

- Documented the jsDelivr `/browser/+esm` entry, which preserves the bundled Preact and Signals runtime required for asynchronous Explorer updates.
- Added an automatic npm `prepack` build so published JavaScript, CSS, and embedded version metadata always match `package.json`.

## 0.3.0 - 2026-07-08

- Added smoothed FPS to the Explorer status bar alongside frame interval and render statistics.
- Added optional host Babylon Lite runtime injection for reliable CDN/playground uploads, picking, animation, visibility, fog, and material mutations across split module instances.
- Added dedicated Scene Explorer and Properties footers, moving the User Guide, BabylonPress, and GitHub links into the Scene Explorer footer.
- Added an Animation Groups count to the Properties footer; clicking it opens, expands, selects, and scrolls to the Animation Groups section in Scene Explorer.

### Added

- Added a split-module dist-bundle example that reproduces CDN and Lite Playground module boundaries.
- Added live property refresh for selected scenes, cameras, meshes, transform nodes, lights, materials, textures, and animation groups.

### Fixed

- Camera values such as `alpha`, `beta`, and radius now follow external camera controls while selected.
- Mesh and transform properties now follow animation and other application-side mutations while selected.

## 0.2.2 - 2026-07-07

### Added

- Added a dedicated browser/CDN bundle with Preact and Signals bundled together.
- Added package verification for the browser JavaScript and CSS artifacts.
- Added a `./browser` package export and configured jsDelivr to use the browser entry.

### Fixed

- Prevented jsDelivr from resolving incompatible Preact instances for Explorer and `@preact/signals`.
- Changed the lifecycle version assertion to read the version from `package.json`.

## 0.2.0 - 2026-07-07

### Added

- Added support for Babylon Lite 1.8.0 public scene APIs.
- Added scene diagnostics for fog, clip planes, and shadow-generator counts.
- Added PBR, Standard, Shader, Node, and material-view family detection through public fields.
- Added scene, camera, light, mesh, material, texture, deformation, and animation inspection.
- Added editable public scene and entity properties where Babylon Lite provides safe runtime APIs.
- Added GLB upload and public scene snapshot export tools.
- Added Basic, Boombox, animated GLB, Node Material, 100-mesh, and scene-diagnostics examples.
- Added the in-app user guide and public API inventory documentation.

### Changed

- Upgraded the Babylon Lite peer and development dependency to 1.8.0.
- Kept tone-mapping mode and enabled state read-only because Babylon Lite consumes them during scene registration.

## 0.1.0 - 2026-06-20

### Added

- Initial Babylon Lite Explorer package.
- Added the public-API-only default adapter, overlay UI, scene tree, property panel, themes, layouts, keyboard shortcuts, and lifecycle API.
