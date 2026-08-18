# Open-source sweep — August 2026

## Decision

TayloredSpace will run product cutouts locally in the browser:

`retailer image → pica resize → Transformers.js worker → ORMBG ONNX → transparent-edge trim → IndexedDB → Excalidraw`

The original and cutout are both preserved as blobs. Users can switch between them or retry removal.

## Adopt

| Project | License | Use |
| --- | --- | --- |
| Transformers.js | Apache-2.0 | Browser-based ONNX inference in a Web Worker |
| onnx-community/ormbg-ONNX | Apache-2.0 | Default product background-removal model |
| pica | MIT | High-quality input resizing before inference |
| Dexie | Apache-2.0 | IndexedDB records, blobs, and schema migrations |
| schema-dts | Apache-2.0 | Typed retailer JSON-LD extraction |

BEN2-ONNX (MIT) is retained as a benchmark candidate, not shipped by default, because of its much larger download. Model quality, first-load time, and memory use must be measured before replacement.

## Borrow patterns

- Arcada Planner v2 (MIT): exact dimensions, rotation, keyboard shortcuts, save/load, and library interaction patterns.
- Aedifex (MIT): a flat future scene dictionary, schema validation, undo/redo boundaries, and spatial indexing when room mode arrives.
- Apartment Planner: interaction concepts only until its license can be verified.

## Reject or defer

- IMG.LY background-removal-js and ISNet: AGPL obligations do not fit the current distribution plan.
- BRIA RMBG weights: noncommercial restrictions unless a separate license is obtained.
- rembg: Python/server architecture conflicts with Phase 1 local-first operation.
- Full 2D/3D planners: deferred; TayloredSpace remains a shopping-intelligence board in this phase.

## Guardrails

- No image upload is required for removal.
- Model files use the browser cache after first download.
- The original asset is never overwritten.
- A failed cutout leaves the original usable.
- Third-party entries are added to Master Library as `inbox`; approval remains a human gate.
