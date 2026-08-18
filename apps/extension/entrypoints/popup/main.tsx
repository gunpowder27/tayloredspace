import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { ExtensionCapture } from "@tayloredspace/domain";
import "./style.css";

type PageProduct = { imageUrl?: string; title?: string; price?: string; currency?: string; retailer?: string; sourceUrl: string };

async function imageAsDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
}

function Popup() {
  const [state, setState] = useState("ready");
  const save = async () => {
    setState("saving");
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) throw new Error("No active tab");
      const result = await browser.tabs.sendMessage(tab.id, { type: "EXTRACT_PRODUCT" }) as PageProduct | undefined;
      if (!result?.imageUrl) throw new Error("We couldn’t find a product image on this page.");
      let imageDataUrl: string | undefined;
      try { imageDataUrl = await imageAsDataUrl(result.imageUrl); } catch { /* The original URL remains useful. */ }
      const capture: ExtensionCapture = { id: crypto.randomUUID(), capturedAt: new Date().toISOString(), imageUrl: result.imageUrl, imageDataUrl, product: { sourceUrl: result.sourceUrl, title: result.title, price: result.price, currency: result.currency, retailer: result.retailer } };
      await browser.runtime.sendMessage({ type: "QUEUE_CAPTURE", capture });
      setState("saved");
    } catch (error) { setState(error instanceof Error ? error.message : "Could not save this page"); }
  };
  return <main><div className="brand"><img src="/tayloredspace-logo-v2.png" alt=""/><span className="eyebrow">TAYLOREDSPACE</span></div><h1>Save this product</h1><p>One click saves the image, price, and source to your board.</p><button onClick={save} disabled={state === "saving"}>{state === "saving" ? "Saving…" : state === "saved" ? "Saved to your board ✓" : "Save to TayloredSpace"}</button>{!(["ready","saving","saved"].includes(state)) && <small>{state}</small>}</main>;
}
createRoot(document.getElementById("root")!).render(<Popup />);
