import { TAYLOREDSPACE_BRIDGE_ACK_EVENT, TAYLOREDSPACE_BRIDGE_EVENT, TAYLOREDSPACE_BRIDGE_READY_EVENT, type ExtensionCapture } from "@tayloredspace/domain";

export default defineContentScript({
  matches: ["https://tayloredspace.vercel.app/*", "http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  runAt: "document_idle",
  main() {
    const flush = async () => {
      const response = await browser.runtime.sendMessage({ type: "GET_CAPTURES" }) as { captures: ExtensionCapture[] };
      for (const capture of response.captures) {
        window.postMessage({ type: TAYLOREDSPACE_BRIDGE_EVENT, capture }, window.location.origin);
      }
    };
    window.addEventListener("message", (event: MessageEvent<{ type?: string; captureId?: string }>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (event.data?.type === TAYLOREDSPACE_BRIDGE_READY_EVENT) void flush();
      if (event.data?.type === TAYLOREDSPACE_BRIDGE_ACK_EVENT && event.data.captureId) {
        void browser.runtime.sendMessage({ type: "ACK_CAPTURE", captureId: event.data.captureId });
      }
    });
    browser.runtime.onMessage.addListener((rawMessage: unknown) => { const message = rawMessage as { type?: string }; if (message.type === "FLUSH_CAPTURES") void flush(); });
    void flush();
  },
});
