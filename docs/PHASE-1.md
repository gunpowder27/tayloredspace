# Phase 1 — Interactive local room board

## Goal

Turn the Phase 0 capture loop into a convincing, editable local-first workspace.

## Implemented slice

- Search and category filters for the saved-piece library.
- One-click placement of representative saved products onto Excalidraw.
- Movable and resizable board pieces with positions persisted to IndexedDB.
- Canvas selection connected to a product inspector.
- Editable title, price, and retailer metadata.
- Local product removal.
- The Phase 0 extension capture queue remains the ingestion path for real retailers.

## Acceptance criteria

- [ ] Filtering the library changes the visible product cards.
- [ ] Choosing a product adds it to the canvas as a movable image.
- [ ] Moving or resizing the image survives page refresh.
- [ ] Selecting the image opens its inspector.
- [ ] Metadata edits survive refresh.
- [ ] Removing a piece removes it from IndexedDB and the scene.
