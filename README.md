# TayloredSpace

Turn inspiration into a room you can actually buy.

TayloredSpace is a local-first product capture loop: save a retail product with the Chrome extension and it appears as a movable piece on an Excalidraw board. Phase 1 automatically makes a transparent product cutout in a private browser worker while preserving the original. See [Phase 0 architecture](docs/PHASE-0.md), [Phase 1](docs/PHASE-1.md), and the [open-source decision record](docs/OPEN-SOURCE-SWEEP-2026-08.md).

## Run locally

Requirements: Node.js 20+ and Chrome.

```bash
npm install
npm run dev:web
```

In another terminal:

```bash
npm run dev:extension
```

Open `http://localhost:3000`. In Chrome, visit `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `apps/extension/.output/chrome-mv3`. Visit a product page, open the TayloredSpace extension, and select **Save to TayloredSpace**. The product will appear on the open board; it also remains queued if the board is closed.

The first background-removal run downloads the ORMBG model. Later runs reuse the browser cache. Select a product on the board to switch between **Original** and **Cutout**, or retry removal.

## Quality checks

```bash
npm run typecheck
npm run build
```

## Scope

This phase deliberately excludes accounts, cloud sync, 3D room planning, social features, and price tracking.
