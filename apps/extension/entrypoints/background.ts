import type { ExtensionCapture } from "@tayloredspace/domain";

const QUEUE = "pendingCaptures";
export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (rawMessage: unknown) => {
    const message = rawMessage as { type: string; capture?: ExtensionCapture };
    if (message.type === "QUEUE_CAPTURE" && message.capture) {
      const stored = await browser.storage.local.get(QUEUE);
      const captures = (stored[QUEUE] as ExtensionCapture[] | undefined) ?? [];
      await browser.storage.local.set({ [QUEUE]: [...captures.filter((item) => item.id !== message.capture!.id), message.capture] });
      const tabs = await browser.tabs.query({ url: ["https://tayloredspace.vercel.app/*", "http://localhost:3000/*", "http://127.0.0.1:3000/*"] });
      await Promise.all(tabs.map((tab) => tab.id ? browser.tabs.sendMessage(tab.id, { type: "FLUSH_CAPTURES" }).catch(() => undefined) : undefined));
      return { ok: true };
    }
    if (message.type === "GET_CAPTURES") {
      const stored = await browser.storage.local.get(QUEUE);
      return { captures: (stored[QUEUE] as ExtensionCapture[] | undefined) ?? [] };
    }
    if (message.type === "ACK_CAPTURE" && message.capture) {
      const stored = await browser.storage.local.get(QUEUE);
      await browser.storage.local.set({ [QUEUE]: ((stored[QUEUE] as ExtensionCapture[] | undefined) ?? []).filter((item) => item.id !== message.capture!.id) });
    }
  });
});
