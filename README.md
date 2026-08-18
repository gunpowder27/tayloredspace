# TayloredSpace

Turn inspiration into a room you can actually buy.

Phase 0 is a local-first product capture loop: save a retail product with the Chrome extension and it appears as a movable piece on an Excalidraw board. See [Phase 0 architecture and acceptance criteria](docs/PHASE-0.md).

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

## Quality checks

```bash
npm run typecheck
npm run build
```

## Scope

This phase deliberately excludes accounts, cloud sync, 3D room planning, social features, and price tracking.
