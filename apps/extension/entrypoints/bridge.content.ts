import { TAYLOREDSPACE_BRIDGE_EVENT, type ExtensionCapture } from "@tayloredspace/domain";

export default defineContentScript({
  matches: ["https://tayloredspace.vercel.app/*", "http://localhost:3000/*", "http://127.0.0.1:3000/*"],
  runAt: "document_idle",
  main() {
    const flush = async () => {
      const response = await browser.runtime.sendMessage({ type: "GET_CAPTURES" }) as { captures: ExtensionCapture[] };
      for (const capture of response.captures) {
        window.postMessage({ type: TAYLOREDSPACE_BRIDGE_EVENT, capture }, window.location.origin);
        await browser.runtime.sendMessage({ type: "ACK_CAPTURE", capture });
      }
    };
    browser.runtime.onMessage.addListener((rawMessage: unknown) => { const message = rawMessage as { type?: string }; if (message.type === "FLUSH_CAPTURES") void flush(); });
    void flush();
  },
});
