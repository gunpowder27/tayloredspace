# Phase 0 — Local-first product capture

## Architecture

- `apps/web`: Next.js App Router board using Excalidraw.
- `apps/extension`: WXT Chrome extension with a capture popup, local queue, and board bridge.
- `packages/domain`: framework-independent `TayloredPiece` and bridge contracts.
- `packages/persistence`: IndexedDB repository for board pieces.

The extension extracts Product JSON-LD first, then Open Graph metadata. It downloads the product image when the retailer permits it and queues the capture in extension-local storage. A content script on the local TayloredSpace board forwards queued captures into the page. The web app maps each capture to a `TayloredPiece`, stores it in IndexedDB, and creates movable Excalidraw image/text elements. No server or account is involved.

## Data model

`TayloredPiece` has an ID, board ID, timestamps, position, and one of five types: `product`, `inspiration`, `render`, `upload`, or `note`. Product pieces may include an image data URL and `sourceUrl`, `title`, `price`, `currency`, and `retailer` metadata.

## Acceptance criteria

- [ ] Web board opens locally and exposes standard Excalidraw move/zoom tools.
- [ ] Chrome extension loads as an unpacked extension.
- [ ] Saving a product page captures its primary image and available metadata.
- [ ] A queued capture reaches an already-open board or arrives when the board next opens.
- [ ] The product appears as a movable board piece with title and price when available.
- [ ] Refreshing the board restores saved pieces from IndexedDB.
- [ ] Type checking and production builds pass.
- [ ] No auth, cloud sync, 3D, social, price tracking, or later-scope feature is present.

## Bridge constraints

Browser security isolates extension storage from website IndexedDB. The small content-script bridge intentionally crosses that origin boundary with an origin-checked `postMessage`. The extension queue is durable until the board acknowledges each capture. Local production URLs can be added to `bridge.content.ts` when hosting begins.
