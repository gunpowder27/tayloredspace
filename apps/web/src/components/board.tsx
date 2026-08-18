"use client";

import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { captureToPiece, TAYLOREDSPACE_BRIDGE_EVENT, type ExtensionCapture, type TayloredPiece } from "@tayloredspace/domain";
import { imageAssetStore, pieceStore } from "@tayloredspace/persistence";
import { Armchair, ChevronDown, CircleDollarSign, ExternalLink, Grid2X2, ImageIcon, ImagePlus, Layers3, Link2, PackageOpen, Plus, RefreshCw, Scissors, Search, Settings2, Trash2, WandSparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { removeImageBackground } from "../lib/background-removal";
import { blobToDataUrl, dataUrlToBlob } from "../lib/image-processing";

const toFileId = (id: string) => `piece-${id}` as never;
const pieceElements = (piece: TayloredPiece, index: number): ExcalidrawElement[] => {
  const x = piece.position.x + (index % 4) * 36;
  const y = piece.position.y + (index % 4) * 36;
  const elements = convertToExcalidrawElements([
    { type: "image", x, y, width: piece.position.width, height: piece.position.height, fileId: toFileId(piece.id), customData: { pieceId: piece.id, product: piece.product } },
    { type: "text", x, y: y + piece.position.height + 14, text: [piece.product?.title, piece.product?.price].filter(Boolean).join(" · ") || "Saved product", fontSize: 18, strokeColor: "#28241f", customData: { pieceId: piece.id } },
  ]);
  return elements as ExcalidrawElement[];
};

export function Board() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const known = useRef(new Set<string>());
  const [pieces, setPieces] = useState<TayloredPiece[]>([]);
  const [status, setStatus] = useState("Your board is saved on this device");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedPieceId, setSelectedPieceId] = useState<string>();
  const [assetUrls, setAssetUrls] = useState<Record<string, { original: string; cutout?: string }>>({});
  const [processing, setProcessing] = useState<Record<string, string>>({});

  const processPieceImage = useCallback(async (piece: TayloredPiece, force = false) => {
    if (!piece.imageDataUrl && !piece.imageAssetId) return;
    const stored = await imageAssetStore.get(piece.id);
    if (stored?.cutout && !force) return;
    setProcessing((current) => ({ ...current, [piece.id]: "Preparing image…" }));
    try {
      const original = stored?.original ?? await dataUrlToBlob(piece.imageDataUrl!);
      const cutout = await removeImageBackground(original, (label) => setProcessing((current) => ({ ...current, [piece.id]: label })));
      await imageAssetStore.put({ pieceId: piece.id, original, cutout, updatedAt: new Date().toISOString() });
      const urls = { original: await blobToDataUrl(original), cutout: await blobToDataUrl(cutout) };
      setAssetUrls((current) => ({ ...current, [piece.id]: urls }));
      const updated = { ...piece, imageAssetId: piece.id, imageVariant: "cutout" as const, updatedAt: new Date().toISOString() };
      await pieceStore.put(updated);
      setPieces((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatus("Background removed — original is still saved");
    } catch {
      setStatus("Cutout could not be made. The original is safe — try again.");
    } finally {
      setProcessing((current) => { const next = { ...current }; delete next[piece.id]; return next; });
    }
  }, []);

  const addPieces = useCallback(async (incoming: TayloredPiece[]) => {
    const fresh = incoming.filter((piece) => !known.current.has(piece.id));
    if (!fresh.length) return;
    fresh.forEach((piece) => known.current.add(piece.id));
    await pieceStore.putMany(fresh);
    setPieces((current) => [...current, ...fresh]);
    setStatus(`${fresh.length} product${fresh.length === 1 ? "" : "s"} added from the extension`);
    for (const piece of fresh) {
      if (!piece.imageDataUrl) continue;
      try {
        const original = await dataUrlToBlob(piece.imageDataUrl);
        await imageAssetStore.put({ pieceId: piece.id, original, updatedAt: new Date().toISOString() });
        setAssetUrls((current) => ({ ...current, [piece.id]: { original: piece.imageDataUrl! } }));
        void processPieceImage(piece);
      } catch { /* The source image remains available on the piece. */ }
    }
  }, [processPieceImage]);

  useEffect(() => { pieceStore.list().then(addPieces); }, [addPieces]);
  useEffect(() => {
    const receive = (event: MessageEvent<{ type?: string; capture?: ExtensionCapture }>) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== TAYLOREDSPACE_BRIDGE_EVENT) return;
      const capture = event.data.capture;
      if (capture?.id && capture?.product?.sourceUrl) void addPieces([captureToPiece(capture)]);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [addPieces]);

  useEffect(() => { imageAssetStore.list().then(async (assets) => {
    const entries = await Promise.all(assets.map(async (asset) => [asset.pieceId, { original: await blobToDataUrl(asset.original), cutout: asset.cutout ? await blobToDataUrl(asset.cutout) : undefined }] as const));
    setAssetUrls(Object.fromEntries(entries));
  }); }, []);

  const files = useMemo<BinaryFiles>(() => Object.fromEntries(pieces.flatMap((piece) => {
    const stored = assetUrls[piece.id];
    const dataURL = piece.imageVariant === "cutout" ? stored?.cutout : stored?.original ?? piece.imageDataUrl;
    if (!dataURL?.startsWith("data:")) return [];
    return [[toFileId(piece.id), { id: toFileId(piece.id), dataURL: dataURL as never, mimeType: (dataURL.slice(5, dataURL.indexOf(";")) || "image/png") as never, created: Date.parse(piece.createdAt), lastRetrieved: Date.now() }]];
  })), [pieces, assetUrls]);
  const elements = useMemo(() => pieces.flatMap(pieceElements), [pieces]);
  useEffect(() => { if (apiRef.current && elements.length) { apiRef.current.addFiles(Object.values(files)); apiRef.current.updateScene({ elements }); } }, [elements, files]);

  const products = [
    { name: "Lennon sofa", price: "$1,899", category: "Seating", retailer: "West Elm", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=85" },
    { name: "Travertine table", price: "$649", category: "Tables", retailer: "Article", image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=700&q=85" },
    { name: "Bouclé chair", price: "$849", category: "Seating", retailer: "CB2", image: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=700&q=85" },
  ];
  const visibleProducts = products.filter((product) => (category === "All" || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase()));
  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);

  const imageToDataUrl = async (url: string) => {
    const blob = await fetch(url).then((response) => response.blob());
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  };
  const addProductToBoard = async (product: typeof products[number]) => {
    setStatus(`Adding ${product.name}…`);
    try {
      const now = new Date().toISOString();
      const piece: TayloredPiece = { id: crypto.randomUUID(), boardId: "default", type: "product", createdAt: now, updatedAt: now, imageDataUrl: await imageToDataUrl(product.image), product: { sourceUrl: product.image, title: product.name, price: product.price, retailer: product.retailer }, position: { x: 170 + pieces.length * 28, y: 130 + pieces.length * 24, width: 300, height: 250 } };
      await addPieces([piece]);
      setSelectedPieceId(piece.id);
    } catch { setStatus("Could not add that image — try again"); }
  };
  const updateSelectedPiece = async (changes: Partial<TayloredPiece["product"]>) => {
    if (!selectedPiece) return;
    const updated = { ...selectedPiece, updatedAt: new Date().toISOString(), product: { ...selectedPiece.product!, ...changes } };
    await pieceStore.put(updated);
    setPieces((current) => current.map((piece) => piece.id === updated.id ? updated : piece));
  };
  const setImageVariant = async (variant: "original" | "cutout") => {
    if (!selectedPiece || (variant === "cutout" && !assetUrls[selectedPiece.id]?.cutout)) return;
    const updated = { ...selectedPiece, imageVariant: variant, updatedAt: new Date().toISOString() };
    await pieceStore.put(updated);
    setPieces((current) => current.map((piece) => piece.id === updated.id ? updated : piece));
  };
  const deleteSelectedPiece = async () => {
    if (!selectedPiece) return;
    await pieceStore.remove(selectedPiece.id);
    known.current.delete(selectedPiece.id);
    setPieces((current) => current.filter((piece) => piece.id !== selectedPiece.id));
    setSelectedPieceId(undefined);
    setStatus("Piece removed from this board");
  };

  return <main className="flex h-screen min-w-[1040px] flex-col overflow-hidden bg-[#eeebe4] text-[#24221f]">
    <header className="flex h-[72px] shrink-0 items-center border-b border-black/[.07] bg-[#f8f6f1] px-5">
      <div className="flex w-[278px] items-center gap-3 border-r border-black/[.07]"><div className="relative h-11 w-11 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><Image src="/tayloredspace-logo.jpg" alt="TayloredSpace swallow" fill sizes="44px" priority className="object-cover"/></div><div><h1 className="font-serif text-[21px] leading-none tracking-tight">TayloredSpace</h1><p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-[#9a6b58]">Design what feels like you</p></div></div>
      <div className="flex flex-1 items-center justify-between pl-6"><button className="flex items-center gap-2 text-sm font-semibold">Austin living room <ChevronDown className="h-4 w-4 text-black/45"/></button><div className="flex items-center gap-3"><div className="flex max-w-[310px] items-center gap-2 truncate rounded-full bg-[#e9efe9] px-3 py-2 text-[11px] font-medium text-[#4b6354]"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#66866f]"/>{status}</div><button className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold shadow-sm">Share preview</button><button aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white"><Settings2 className="h-4 w-4"/></button></div></div>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[298px] shrink-0 flex-col border-r border-black/[.07] bg-[#f8f6f1]">
        <div className="p-5 pb-3"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Your collection</p><h2 className="mt-1 font-serif text-[24px]">Saved pieces</h2></div><button aria-label="Add piece" className="grid h-9 w-9 place-items-center rounded-full bg-[#26392f] text-white"><Plus className="h-4 w-4"/></button></div><label className="flex items-center gap-2 rounded-xl border border-black/[.08] bg-white px-3 py-2.5 text-xs text-black/40"><Search className="h-4 w-4"/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search saved pieces" className="w-full bg-transparent outline-none" placeholder="Search furniture, lighting…"/></label></div>
        <div className="flex gap-2 overflow-hidden px-5 py-2 text-[11px]">{["All","Seating","Tables"].map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? "rounded-full bg-[#26392f] px-3 py-1.5 text-white" : "rounded-full border border-black/10 bg-white px-3 py-1.5"}>{item}{item === "All" ? ` ${products.length}` : ""}</button>)}</div>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 pt-3">
          {visibleProducts.map((product) => <button onClick={() => void addProductToBoard(product)} key={product.name} className="group overflow-hidden rounded-2xl border border-black/[.07] bg-white text-left shadow-[0_5px_18px_rgba(46,39,31,.05)]"><div className="relative aspect-square overflow-hidden bg-[#e7e1d8]"><Image src={product.image} alt={product.name} fill sizes="120px" className="object-cover transition duration-300 group-hover:scale-105"/><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90"><Plus className="h-3.5 w-3.5"/></span></div><div className="p-2.5"><p className="truncate text-[11px] font-semibold">{product.name}</p><p className="mt-1 text-[10px] text-black/45">{product.price}</p></div></button>)}
          <button className="grid aspect-[.78] place-items-center rounded-2xl border border-dashed border-black/15 bg-white/45 text-center"><div><ImagePlus className="mx-auto h-5 w-5 text-black/35"/><p className="mt-2 text-[10px] font-semibold text-black/45">Add inspiration</p></div></button>
        </div>
        <div className="mt-auto border-t border-black/[.07] p-5"><div className="rounded-2xl bg-[#26392f] p-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold"><WandSparkles className="h-4 w-4 text-[#dec8a5]"/>Capture from anywhere</div><p className="mt-2 text-[11px] leading-5 text-white/60">Use the browser extension on any product page and it lands right here.</p><button className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#dec8a5]"><Link2 className="h-3.5 w-3.5"/>How product capture works</button></div></div>
      </aside>

      <section className="relative min-w-0 flex-1 bg-[#dedbd3] p-4">
        <div className="absolute left-1/2 top-7 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/[.08] bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(42,37,31,.12)] backdrop-blur"><button className="flex items-center gap-2 rounded-lg bg-[#f0eee9] px-3 py-2 text-[11px] font-semibold"><Grid2X2 className="h-3.5 w-3.5"/>Board</button><button className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-black/45"><Layers3 className="h-3.5 w-3.5"/>Room view</button></div>
        <div className="h-full overflow-hidden rounded-[22px] border border-black/[.08] bg-[#f9f8f5] shadow-[0_16px_50px_rgba(52,46,38,.08)]">
          <Excalidraw onChange={(sceneElements, appState) => { const selected = sceneElements.find((element) => appState.selectedElementIds[element.id])?.customData?.pieceId as string | undefined; setSelectedPieceId(selected); for (const element of sceneElements) { const pieceId = element.customData?.pieceId as string | undefined; if (pieceId && element.type === "image") { const piece = pieces.find((item) => item.id === pieceId); if (piece && (piece.position.x !== element.x || piece.position.y !== element.y || piece.position.width !== element.width || piece.position.height !== element.height)) void pieceStore.put({ ...piece, updatedAt: new Date().toISOString(), position: { x: element.x, y: element.y, width: element.width, height: element.height } }); } } }} excalidrawAPI={(api) => { apiRef.current = api; if (elements.length) { api.addFiles(Object.values(files)); api.updateScene({ elements }); } }} initialData={{ elements, files, appState: { viewBackgroundColor: "#f9f8f5" } }} UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}/>
        </div>
        {!pieces.length && <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-black/[.08] bg-white/90 p-8 text-center shadow-[0_25px_80px_rgba(43,37,31,.14)] backdrop-blur-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#ebe1d6] text-[#9a6b58]"><Armchair className="h-6 w-6"/></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a6b58]">Austin living room</p><h2 className="mt-2 font-serif text-[30px] tracking-tight">Create a room you can actually buy</h2><p className="mx-auto mt-3 max-w-[330px] text-sm leading-6 text-black/50">Drag saved pieces onto the canvas, mix in inspiration, and shape a room that feels unmistakably yours.</p><div className="mt-6 flex justify-center gap-2"><button className="pointer-events-auto rounded-full bg-[#26392f] px-5 py-2.5 text-xs font-semibold text-white">Start with saved pieces</button><button className="pointer-events-auto rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-semibold">Upload a room</button></div></div>}
      </section>

      <aside className="w-[238px] shrink-0 border-l border-black/[.07] bg-[#f8f6f1] p-5">{selectedPiece ? <><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9a6b58]">Selected piece</p><h3 className="mt-2 font-serif text-xl">Edit product</h3><div className="mt-4 rounded-xl border border-black/[.07] bg-white p-2"><p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-black/40">Product image</p><div className="grid grid-cols-2 gap-1"><button onClick={() => void setImageVariant("original")} className={selectedPiece.imageVariant !== "cutout" ? "flex items-center justify-center gap-1.5 rounded-lg bg-[#26392f] px-2 py-2 text-[10px] font-semibold text-white" : "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold text-black/50"}><ImageIcon className="h-3.5 w-3.5"/>Original</button><button disabled={!assetUrls[selectedPiece.id]?.cutout} onClick={() => void setImageVariant("cutout")} className={selectedPiece.imageVariant === "cutout" ? "flex items-center justify-center gap-1.5 rounded-lg bg-[#26392f] px-2 py-2 text-[10px] font-semibold text-white" : "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold text-black/50 disabled:opacity-30"}><Scissors className="h-3.5 w-3.5"/>Cutout</button></div><button disabled={Boolean(processing[selectedPiece.id])} onClick={() => void processPieceImage(selectedPiece, true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#ebe1d6] px-2 py-2 text-[10px] font-semibold text-[#795747] disabled:opacity-60"><RefreshCw className={processing[selectedPiece.id] ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}/>{processing[selectedPiece.id] ?? (assetUrls[selectedPiece.id]?.cutout ? "Remake cutout" : "Remove background")}</button></div><label className="mt-5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Title<input value={selectedPiece.product?.title ?? ""} onChange={(event) => void updateSelectedPiece({ title: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-black/40">Price<input value={selectedPiece.product?.price ?? ""} onChange={(event) => void updateSelectedPiece({ price: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-black/40">Retailer<input value={selectedPiece.product?.retailer ?? ""} onChange={(event) => void updateSelectedPiece({ retailer: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label><a href={selectedPiece.product?.sourceUrl} target="_blank" className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-[#58705f]">Open source <ExternalLink className="h-3.5 w-3.5"/></a><button onClick={() => void deleteSelectedPiece()} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/10 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800"><Trash2 className="h-3.5 w-3.5"/>Remove from board</button></> : <><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Room overview</p><div className="mt-4 rounded-2xl border border-black/[.07] bg-white p-4"><p className="text-xs font-semibold">Budget</p><div className="mt-3 flex items-end justify-between"><span className="font-serif text-2xl">$4,247</span><span className="text-[10px] text-black/40">of $6,000</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe8e2]"><div className="h-full w-[71%] rounded-full bg-[#9a6b58]"/></div><div className="mt-4 flex items-center gap-2 text-[10px] text-[#58705f]"><CircleDollarSign className="h-3.5 w-3.5"/>$1,753 remaining</div></div><div className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Style direction</p><button className="text-[10px] text-black/40">Edit</button></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[#e7ded2] px-3 py-1.5 text-[10px]">Warm modern</span><span className="rounded-full bg-[#dfe6df] px-3 py-1.5 text-[10px]">Natural</span><span className="rounded-full bg-[#ebe8e2] px-3 py-1.5 text-[10px]">Soft minimal</span></div></div><div className="mt-7 border-t border-black/[.07] pt-5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-[#9a6b58]"/><p className="text-xs font-semibold">{pieces.length || 12} pieces collected</p></div><p className="mt-2 text-[11px] leading-5 text-black/45">Select a piece on the canvas to edit its details.</p></div></>}</aside>
    </div>
  </main>;
}
