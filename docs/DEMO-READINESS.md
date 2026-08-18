# Five-minute demo runbook

## Before the demo

1. Run `npm install`, `npm run dev:web`, and load `apps/extension/.output/chrome-mv3` as an unpacked Chrome extension.
2. Open `http://localhost:3000` and allow the first background-removal model download to finish once.
3. Refresh the board. Confirm there is no error overlay and the **Demo tour** button is visible.

## Demo story

1. Open **Demo tour** and choose **Try the chair**.
2. Point out the on-device progress state: the source image is not uploaded.
3. When the cutout appears, drag and resize it.
4. Use the right inspector to compare **Original** and **Cutout**, edit the price, and retry the cutout.
5. Open a retailer product page, use **Save to TayloredSpace**, and return to the board to show retained title, price, retailer, and source URL.
6. Refresh the board to demonstrate local persistence.

## Capture compatibility

Automated fixtures cover current representative structures from IKEA, Article, West Elm, CB2, and Wayfair-style pages. The parser supports Product/ProductGroup JSON-LD, variants, offers, aggregate offers, price specifications, Open Graph, microdata, canonical URLs, and visible-price fallbacks.

Before a public presentation, manually smoke-test the exact retailer URLs planned for that demo because retailer markup and anti-bot behavior can change without notice.

## Phase 1 exit gate

- Production web and extension builds pass.
- Extension extraction suite passes all nine cases.
- Guided tour, catalog cards, and model-loading progress render without browser console errors.
- Original assets survive cutout creation and retry.
- The extension ZIP is attached to a GitHub prerelease.

## Alpha 2 interaction QA

The release checklist and browser evidence are recorded in [UI-QA-2026-08.md](UI-QA-2026-08.md).
