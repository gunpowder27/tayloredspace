import { extractProduct } from "../lib/extract-product";
export default defineContentScript({ matches: ["http://*/*", "https://*/*"], runAt: "document_idle", main() { browser.runtime.onMessage.addListener((rawMessage: unknown) => { const message = rawMessage as { type?: string }; if (message.type === "EXTRACT_PRODUCT") return Promise.resolve(extractProduct(document)); }); } });
