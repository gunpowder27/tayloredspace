# Phase 1 — Interactive local room board

## Goal

Turn the Phase 0 capture loop into a convincing, editable local-first workspace.

## Implemented slice

- Dedicated product-page reader injected on retailer pages.
- JSON-LD support for products, groups, variants, aggregate offers, and price specifications.
- Open Graph, microdata, canonical URL, and visible-price fallbacks.
- Automated retailer-markup fixtures for capture regressions.
- Search and category filters for the saved-piece library.
- One-click placement of representative saved products onto Excalidraw.
- Movable and resizable board pieces with positions persisted to IndexedDB.
- Canvas selection connected to a product inspector.
- Editable title, price, and retailer metadata.
- Local product removal.
- Automatic on-device background removal with original/cutout/retry controls.
- Original and cutout blobs persisted locally in IndexedDB.
- The Phase 0 extension capture queue remains the ingestion path for real retailers.

## Acceptance criteria

- [x] Filtering the library changes the visible product cards.
- [x] Choosing a product adds it to the canvas as a movable image.
- [x] Moving or resizing the image survives page refresh.
- [x] Selecting the image opens its inspector.
- [x] Metadata edits survive refresh.
- [x] Removing a piece removes it from IndexedDB and the scene.
- [x] A captured product gets a transparent cutout without uploading its image.
- [x] Original/cutout selection survives refresh and retry never destroys the original.

The repeatable presentation flow and retailer coverage are documented in `DEMO-READINESS.md`. The next bounded milestone is in `ROOM-MODE-NEXT.md`.
