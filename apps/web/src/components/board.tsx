"use client";

import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { captureToPiece, TAYLOREDSPACE_BRIDGE_ACK_EVENT, TAYLOREDSPACE_BRIDGE_EVENT, TAYLOREDSPACE_BRIDGE_READY_EVENT, type ExtensionCapture, type TayloredPiece } from "@tayloredspace/domain";
import { imageAssetStore, pieceStore } from "@tayloredspace/persistence";
import { ArrowRight, Armchair, Check, ChevronDown, ChevronUp, CircleDollarSign, ExternalLink, Grid2X2, ImageIcon, ImagePlus, Layers3, Link2, PackageOpen, Pencil, Plus, RefreshCw, Scissors, Search, Trash2, WandSparkles, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { removeImageBackground, warmImageBackgroundRemoval } from "../lib/background-removal";
import { blobToDataUrl, dataUrlToBlob } from "../lib/image-processing";

const toFileId = (id: string, variant: TayloredPiece["imageVariant"] = "original") => `piece-${id}-${variant}` as never;
const pieceElements = (piece: TayloredPiece): ExcalidrawElement[] => {
  const x = piece.position.x;
  const y = piece.position.y;
  const elements = convertToExcalidrawElements([
    { id: `piece-image-${piece.id}`, type: "image", x, y, width: piece.position.width, height: piece.position.height, fileId: toFileId(piece.id, piece.imageVariant), customData: { pieceId: piece.id, product: piece.product } },
    { id: `piece-label-${piece.id}`, type: "text", x, y: y + piece.position.height + 14, text: [piece.product?.title, piece.product?.price].filter(Boolean).join(" · ") || "Saved product", fontSize: 18, strokeColor: "#28241f", customData: { pieceId: piece.id } },
  ]);
  return elements as ExcalidrawElement[];
};

export function Board() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const known = useRef(new Set<string>());
  const [pieces, setPieces] = useState<TayloredPiece[]>([]);
  const [status, setStatus] = useState("Your board is saved on this device");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedPieceId, setSelectedPieceId] = useState<string>();
  const [assetUrls, setAssetUrls] = useState<Record<string, { original: string; cutout?: string }>>({});
  const [processing, setProcessing] = useState<Record<string, string>>({});
  const [processingErrors, setProcessingErrors] = useState<Record<string, string>>({});
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [extensionHelpOpen, setExtensionHelpOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [roomName, setRoomName] = useState("Taylor’s living room");
  const [editingRoomName, setEditingRoomName] = useState(false);
  const [draggingPieceId, setDraggingPieceId] = useState<string>();

  const processPieceImage = useCallback(async (piece: TayloredPiece, force = false) => {
    if (!piece.imageDataUrl && !piece.imageAssetId) return;
    const stored = await imageAssetStore.get(piece.id);
    if (stored?.cutout && !force) return;
    setProcessingErrors((current) => { const next = { ...current }; delete next[piece.id]; return next; });
    setProcessing((current) => ({ ...current, [piece.id]: "Preparing image…" }));
    try {
      const original = stored?.original ?? await dataUrlToBlob(piece.imageDataUrl!);
      const cutout = await removeImageBackground(original, (label) => {
        setProcessing((current) => ({ ...current, [piece.id]: label }));
        setStatus(label);
      });
      await imageAssetStore.put({ pieceId: piece.id, original, cutout, updatedAt: new Date().toISOString() });
      const urls = { original: await blobToDataUrl(original), cutout: await blobToDataUrl(cutout) };
      setAssetUrls((current) => ({ ...current, [piece.id]: urls }));
      const latest = await pieceStore.get(piece.id) ?? piece;
      const updated = { ...latest, imageAssetId: piece.id, imageVariant: "cutout" as const, updatedAt: new Date().toISOString() };
      await pieceStore.put(updated);
      setPieces((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatus("Background removed — original is still saved");
      setTourStep((current) => current === 1 ? 2 : current);
    } catch {
      setProcessingErrors((current) => ({ ...current, [piece.id]: "We couldn't make the cutout. Your original is safe." }));
      setStatus("Cutout paused — select the piece to retry or keep the original");
      setTourOpen(false);
    } finally {
      setProcessing((current) => { const next = { ...current }; delete next[piece.id]; return next; });
    }
  }, []);

  const addPieces = useCallback(async (incoming: TayloredPiece[], placeOnBoard = false) => {
    const fresh = incoming.map((piece) => ({ ...piece, onBoard: piece.onBoard ?? placeOnBoard })).filter((piece) => !known.current.has(piece.id));
    if (!fresh.length) return;
    fresh.forEach((piece) => known.current.add(piece.id));
    await pieceStore.putMany(fresh);
    setPieces((current) => [...current, ...fresh]);
    setStatus(`${fresh.length} ${fresh.length === 1 ? "piece" : "pieces"} saved to your collection`);
    for (const piece of fresh) {
      if (!piece.imageDataUrl || !["product", "upload"].includes(piece.type)) continue;
      try {
        const original = await dataUrlToBlob(piece.imageDataUrl);
        await imageAssetStore.put({ pieceId: piece.id, original, updatedAt: new Date().toISOString() });
        setAssetUrls((current) => ({ ...current, [piece.id]: { original: piece.imageDataUrl! } }));
        void processPieceImage(piece);
      } catch { /* The source image remains available on the piece. */ }
    }
  }, [processPieceImage]);

  useEffect(() => { pieceStore.list().then((stored) => {
    const migrated = stored.map((piece) => piece.onBoard === undefined ? { ...piece, onBoard: true } : piece);
    migrated.forEach((piece) => known.current.add(piece.id));
    void pieceStore.putMany(migrated);
    setPieces((current) => [...migrated, ...current.filter((piece) => !migrated.some((saved) => saved.id === piece.id))]);
  }); }, []);
  useEffect(() => { warmImageBackgroundRemoval(); }, []);
  useEffect(() => { const savedRoomName = window.localStorage.getItem("tayloredspace-room-name"); if (savedRoomName) setRoomName(savedRoomName); }, []);
  useEffect(() => { setConfirmDelete(false); }, [selectedPieceId]);
  useEffect(() => {
    const receive = (event: MessageEvent<{ type?: string; capture?: ExtensionCapture }>) => {
      if (event.source !== window || event.origin !== window.location.origin || event.data?.type !== TAYLOREDSPACE_BRIDGE_EVENT) return;
      const capture = event.data.capture;
      if (capture?.id && capture?.product?.sourceUrl) void addPieces([captureToPiece(capture)]).then(() => {
        window.postMessage({ type: TAYLOREDSPACE_BRIDGE_ACK_EVENT, captureId: capture.id }, window.location.origin);
      });
    };
    window.addEventListener("message", receive);
    window.postMessage({ type: TAYLOREDSPACE_BRIDGE_READY_EVENT }, window.location.origin);
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
    const fileId = toFileId(piece.id, piece.imageVariant);
    return [[fileId, { id: fileId, dataURL: dataURL as never, mimeType: (dataURL.slice(5, dataURL.indexOf(";")) || "image/png") as never, created: Date.parse(piece.createdAt), lastRetrieved: Date.now() }]];
  })), [pieces, assetUrls]);
  const boardPieces = useMemo(() => pieces.filter((piece) => piece.onBoard !== false), [pieces]);
  const elements = useMemo(() => boardPieces.flatMap(pieceElements), [boardPieces]);
  const sceneKey = useMemo(() => boardPieces.map((piece) => [piece.id, piece.imageVariant, piece.position.x, piece.position.y, piece.position.width, piece.position.height, assetUrls[piece.id]?.original ? "original-ready" : "", assetUrls[piece.id]?.cutout ? "cutout-ready" : ""].join(":" )).join("|"), [boardPieces, assetUrls]);

  const products = [
    { name: "Lennon sofa", price: "$1,899", category: "Seating", retailer: "Demo collection", image: "/demo/lennon-sofa.jpg" },
    { name: "Travertine table", price: "$649", category: "Tables", retailer: "Demo collection", image: "/demo/travertine-table.jpg" },
    { name: "Bouclé chair", price: "$849", category: "Seating", retailer: "Demo collection", image: "/demo/boucle-chair.jpg" },
  ];
  const visiblePieces = pieces.filter((piece) => {
    const title = piece.product?.title ?? piece.text ?? "Saved piece";
    return (category === "All" || (category === "Seating" && /chair|sofa|seat/i.test(title)) || (category === "Tables" && /table|desk|nightstand/i.test(title))) && title.toLowerCase().includes(query.toLowerCase());
  });
  const selectedPiece = pieces.find((piece) => piece.id === selectedPieceId);

  const imageToDataUrl = async (url: string) => {
    const blob = await fetch(url).then((response) => response.blob());
    return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  };
  const addProductToBoard = async (product: typeof products[number]) => {
    setStatus(`Adding ${product.name}…`);
    try {
      const now = new Date().toISOString();
      const piece: TayloredPiece = { id: crypto.randomUUID(), boardId: "default", type: "product", createdAt: now, updatedAt: now, imageDataUrl: await imageToDataUrl(product.image), product: { sourceUrl: product.image, title: product.name, price: product.price, retailer: product.retailer }, position: { x: 280 + (pieces.length % 4) * 34, y: 190 + (pieces.length % 4) * 28, width: 300, height: 250 } };
      await addPieces([piece], true);
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
    if (!confirmDelete) {
      setConfirmDelete(true);
      setStatus("Confirm before removing — your piece is still safe");
      return;
    }
    const updated = { ...selectedPiece, onBoard: false, updatedAt: new Date().toISOString() };
    await pieceStore.put(updated);
    setPieces((current) => current.map((piece) => piece.id === updated.id ? updated : piece));
    setSelectedPieceId(undefined);
    setStatus("Removed from the board — it is still saved in your collection");
  };
  const startGuidedDemo = async () => {
    setTourStep(1);
    const saved = pieces.find((piece) => piece.product?.retailer === "Demo collection");
    if (!saved) return addProductToBoard(products[2]);
    setSelectedPieceId(saved.id);
    if (assetUrls[saved.id]?.cutout) {
      const updated = { ...saved, onBoard: true, imageVariant: "cutout" as const, updatedAt: new Date().toISOString() };
      await pieceStore.put(updated);
      setPieces((current) => current.map((piece) => piece.id === updated.id ? updated : piece));
      setStatus("Cutout ready — click and drag the product to style your board");
      setTourStep(2);
      return;
    }
    await processPieceImage(saved);
  };
  const hasDemoPiece = pieces.some((piece) => piece.product?.retailer === "Demo collection");
  const sharePreview = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("App link copied — this private board still stays on your device");
    } catch { setStatus("Could not copy the link — your board is still safe"); }
  };
  const addUpload = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setStatus(`Adding ${file.name}…`);
    const now = new Date().toISOString();
    const piece: TayloredPiece = { id: crypto.randomUUID(), boardId: "default", type: "upload", createdAt: now, updatedAt: now, imageDataUrl: await blobToDataUrl(file), text: file.name, position: { x: 300 + (pieces.length % 4) * 32, y: 210 + (pieces.length % 4) * 26, width: 320, height: 260 } };
    await addPieces([piece], true);
    setSelectedPieceId(piece.id);
    setStatus("Image added — drag it anywhere on the board");
  };
  const budget = 6000;
  const spent = pieces.reduce((total, piece) => total + Number((piece.product?.price ?? "").replace(/[^0-9.]/g, "") || 0), 0);
  const remaining = Math.max(0, budget - spent);
  const budgetPercent = Math.min(100, Math.round((spent / budget) * 100));
  const saveRoomName = () => {
    const nextName = roomName.trim() || "Taylor’s living room";
    setRoomName(nextName);
    window.localStorage.setItem("tayloredspace-room-name", nextName);
    setEditingRoomName(false);
    setStatus(`Room renamed to ${nextName}`);
  };
  const placePieceAt = async (pieceId: string, clientX: number, clientY: number) => {
    const piece = pieces.find((item) => item.id === pieceId);
    const appState = apiRef.current?.getAppState();
    if (!piece || !appState) return;
    const zoom = appState.zoom.value || 1;
    const position = {
      x: (clientX - appState.offsetLeft) / zoom - appState.scrollX - piece.position.width / 2,
      y: (clientY - appState.offsetTop) / zoom - appState.scrollY - piece.position.height / 2,
      width: piece.position.width,
      height: piece.position.height,
    };
    const updated = { ...piece, onBoard: true, position, updatedAt: new Date().toISOString() };
    await pieceStore.put(updated);
    setPieces((current) => current.map((item) => item.id === updated.id ? updated : item));
    setSelectedPieceId(updated.id);
    setStatus("Piece placed on your board");
  };

  return <main className="flex min-h-screen flex-col overflow-x-hidden bg-[#eeebe4] text-[#24221f] lg:h-screen lg:overflow-hidden">
    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void addUpload(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
    <header className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-between gap-3 border-b border-black/[.07] bg-[#f8f6f1] px-4 py-3 sm:px-5">
      <div className="flex items-center gap-3 lg:w-[278px] lg:border-r lg:border-black/[.07]"><div className="relative h-10 w-12 overflow-hidden sm:h-11 sm:w-14"><Image src="/tayloredspace-logo-v2.png" alt="TayloredSpace TS swallow" fill sizes="56px" priority className="object-contain"/></div><div><h1 className="font-serif text-[19px] leading-none tracking-tight sm:text-[21px]">TayloredSpace</h1><p className="mt-1.5 hidden text-[10px] font-semibold uppercase tracking-[.17em] text-[#9a6b58] sm:block">Design what feels like you</p></div></div>
      <div className="flex min-w-0 items-center gap-2 lg:flex-1 lg:justify-between lg:pl-6"><div className="hidden min-w-0 lg:block">{editingRoomName ? <input autoFocus value={roomName} onChange={(event) => setRoomName(event.target.value)} onBlur={saveRoomName} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} aria-label="Room name" className="w-[190px] rounded-lg border border-[#9a6b58]/30 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-[#9a6b58]"/> : <button onClick={() => setEditingRoomName(true)} className="flex max-w-[210px] items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-black/[.04]" title="Rename this room"><span className="truncate">{roomName}</span><Pencil className="h-3.5 w-3.5 shrink-0 text-black/35"/></button>}</div><div className="flex items-center gap-2 sm:gap-3"><div role="status" className="hidden max-w-[310px] items-center gap-2 truncate rounded-full bg-[#e9efe9] px-3 py-2 text-[11px] font-medium text-[#4b6354] md:flex"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#66866f]"/>{status}</div><button onClick={() => { setTourStep(0); setTourOpen(true); setExtensionHelpOpen(false); }} className="flex items-center gap-2 rounded-full border border-[#9a6b58]/20 bg-[#f4ece4] px-3 py-2 text-[11px] font-semibold text-[#795747] sm:px-4 sm:text-xs"><WandSparkles className="h-3.5 w-3.5"/>How it works</button><button onClick={() => void sharePreview()} className="hidden rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold shadow-sm sm:block">Copy app link</button></div></div>
    </header>

    <div className="ts-layout flex min-h-0 flex-1 flex-col lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-b border-black/[.07] bg-[#f8f6f1] lg:w-[298px] lg:border-b-0 lg:border-r">
        <div className="p-5 pb-3"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Your collection</p><h2 className="mt-1 font-serif text-[24px]">Saved pieces</h2></div><button onClick={() => fileInputRef.current?.click()} aria-label="Upload an image" title="Upload an image" className="grid h-9 w-9 place-items-center rounded-full bg-[#26392f] text-white"><Plus className="h-4 w-4"/></button></div><label className="flex items-center gap-2 rounded-xl border border-black/[.08] bg-white px-3 py-2.5 text-xs text-black/40"><Search className="h-4 w-4"/><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search saved pieces" className="w-full bg-transparent outline-none" placeholder="Search furniture, lighting…"/></label></div>
        <div className="flex gap-2 overflow-hidden px-5 py-2 text-[11px]">{["All","Seating","Tables"].map((item) => <button key={item} onClick={() => setCategory(item)} className={category === item ? "rounded-full bg-[#26392f] px-3 py-1.5 text-white" : "rounded-full border border-black/10 bg-white px-3 py-1.5"}>{item}{item === "All" ? ` ${pieces.length}` : ""}</button>)}</div>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 pt-3 sm:grid-cols-4 lg:grid-cols-2">
          {visiblePieces.map((piece) => { const title = piece.product?.title ?? piece.text ?? "Saved piece"; const thumbnail = assetUrls[piece.id]?.original ?? piece.imageDataUrl; return <button onPointerDown={(event) => { if (event.button !== 0) return; setDraggingPieceId(piece.id); setSelectedPieceId(piece.id); }} onPointerUp={() => setDraggingPieceId(undefined)} onClick={() => setSelectedPieceId(piece.id)} key={piece.id} className="group cursor-grab touch-none overflow-hidden rounded-2xl border border-black/[.07] bg-white text-left shadow-[0_5px_18px_rgba(46,39,31,.05)] active:cursor-grabbing"><div className="relative aspect-square overflow-hidden bg-[#e7e1d8]">{thumbnail ? <img src={thumbnail} alt={title} draggable={false} className="h-full w-full object-contain transition duration-300 group-hover:scale-105"/> : <PackageOpen className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-black/25"/>}</div><div className="p-2.5"><p className="truncate text-[11px] font-semibold">{title}</p><div className="mt-1 flex items-center justify-between"><p className="truncate text-[10px] text-black/45">{piece.product?.price ?? piece.product?.retailer ?? "Saved"}</p><span className="text-[9px] font-bold uppercase tracking-wide text-[#795747]">Drag to board</span></div></div></button>; })}
          <button onClick={() => fileInputRef.current?.click()} className="grid aspect-[.78] place-items-center rounded-2xl border border-dashed border-black/15 bg-white/45 text-center"><div><ImagePlus className="mx-auto h-5 w-5 text-black/35"/><p className="mt-2 text-[10px] font-semibold text-black/45">Upload inspiration</p></div></button>
        </div>
        <div className="mt-auto border-t border-black/[.07] p-5"><div className="rounded-2xl bg-[#26392f] p-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold"><WandSparkles className="h-4 w-4 text-[#dec8a5]"/>Capture from anywhere</div><p className="mt-2 text-[11px] leading-5 text-white/60">Install the Chrome extension, save a product while you shop, and it appears on this board.</p><button onClick={() => { setExtensionHelpOpen(true); setTourOpen(false); }} className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#dec8a5]"><Link2 className="h-3.5 w-3.5"/>Extension setup</button></div></div>
      </aside>

      <section className="relative h-[68vh] min-h-[520px] min-w-0 flex-1 bg-[#dedbd3] p-3 sm:p-4 lg:h-auto lg:min-h-0">
        {Object.keys(processing).length > 0 && !tourOpen && <div className="absolute right-8 top-24 z-40 flex w-[290px] items-center gap-3 rounded-2xl border border-[#9a6b58]/15 bg-white/95 p-4 shadow-[0_16px_50px_rgba(52,46,38,.16)] backdrop-blur"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f1e8df] text-[#9a6b58]"><RefreshCw className="h-4 w-4 animate-spin"/></span><div><p className="text-xs font-bold">Creating a clean cutout</p><p className="mt-1 text-[10px] leading-4 text-black/45">{Object.values(processing)[0]} First use takes longer; the model stays cached afterward.</p></div></div>}
        {tourOpen && <div role="dialog" aria-label="How TayloredSpace works" className="absolute bottom-8 left-1/2 z-40 w-[390px] -translate-x-1/2 overflow-hidden rounded-[24px] border border-black/10 bg-[#26392f] text-white shadow-[0_24px_80px_rgba(25,31,27,.3)]"><div className="flex items-start justify-between px-6 pt-5"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#dec8a5]">Step {tourStep + 1} of 3</p><h3 className="mt-2 font-serif text-[24px]">{["Add one piece", "We make the cutout", "Move it into place"][tourStep]}</h3></div><button onClick={() => setTourOpen(false)} aria-label="Close how it works" className="rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"><X className="h-4 w-4"/></button></div><p className="px-6 pt-2 text-[12px] leading-5 text-white/70">{[hasDemoPiece ? "We found your demo piece. Press the button to continue with it." : "Press the button below. We will add one chair so you can see the whole flow.", "Your first cutout can take about a minute. Keep this tab open; your photo stays on this device. You can always keep the original.", "Click the chair, then drag it. The simple panel on the right switches between Original and Cutout."][tourStep]}</p><div className="mt-5 flex items-center justify-between border-t border-white/10 px-6 py-4"><div className="flex gap-1.5">{[0,1,2].map((step) => <span key={step} className={step <= tourStep ? "h-1.5 w-7 rounded-full bg-[#dec8a5]" : "h-1.5 w-7 rounded-full bg-white/15"}/>)}</div>{tourStep === 0 ? <button onClick={() => void startGuidedDemo()} className="flex items-center gap-2 rounded-full bg-[#dec8a5] px-4 py-2 text-[11px] font-bold text-[#26392f]">Add demo chair <ArrowRight className="h-3.5 w-3.5"/></button> : tourStep === 1 ? <span className="flex items-center gap-2 text-[11px] font-semibold text-[#dec8a5]"><RefreshCw className="h-3.5 w-3.5 animate-spin"/>{Object.values(processing)[0] ?? "Making cutout…"}</span> : <button onClick={() => setTourOpen(false)} className="flex items-center gap-2 rounded-full bg-[#dec8a5] px-4 py-2 text-[11px] font-bold text-[#26392f]"><Check className="h-3.5 w-3.5"/>Got it</button>}</div></div>}
        <div className="absolute left-6 top-6 z-20 rounded-xl border border-black/[.08] bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(42,37,31,.12)] backdrop-blur"><div className="flex items-center gap-1"><button className="flex items-center gap-2 rounded-lg bg-[#f0eee9] px-3 py-2 text-[11px] font-semibold"><Grid2X2 className="h-3.5 w-3.5"/>Board</button>{toolbarOpen && <><button disabled title="Coming in the next phase" className="flex cursor-not-allowed items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-black/30"><Layers3 className="h-3.5 w-3.5"/>Room view · next</button><span className="mx-1 h-5 w-px bg-black/10"/><span className="px-2 text-[10px] text-black/40">Select · drag · resize</span></>}<button onClick={() => setToolbarOpen((open) => !open)} aria-label={toolbarOpen ? "Minimize board toolbar" : "Expand board toolbar"} title={toolbarOpen ? "Minimize" : "Show board options"} className="grid h-8 w-8 place-items-center rounded-lg text-black/45 hover:bg-black/5">{toolbarOpen ? <ChevronUp className="h-3.5 w-3.5"/> : <ChevronDown className="h-3.5 w-3.5"/>}</button></div></div>
        <div onPointerUpCapture={(event: ReactPointerEvent<HTMLDivElement>) => { if (draggingPieceId) { void placePieceAt(draggingPieceId, event.clientX, event.clientY); setDraggingPieceId(undefined); } }} onPointerCancel={() => setDraggingPieceId(undefined)} className="h-full overflow-hidden rounded-[22px] border border-black/[.08] bg-[#f9f8f5] shadow-[0_16px_50px_rgba(52,46,38,.08)]">
          <Excalidraw key={sceneKey} onChange={(sceneElements: readonly ExcalidrawElement[], appState: AppState) => { const selected = sceneElements.find((element) => appState.selectedElementIds[element.id])?.customData?.pieceId as string | undefined; if (selected) setSelectedPieceId(selected); const moved = sceneElements.flatMap((element) => { const pieceId = element.customData?.pieceId as string | undefined; if (!pieceId || element.type !== "image") return []; const piece = pieces.find((item) => item.id === pieceId); if (!piece || (piece.position.x === element.x && piece.position.y === element.y && piece.position.width === element.width && piece.position.height === element.height)) return []; return [{ piece, position: { x: element.x, y: element.y, width: element.width, height: element.height } }]; }); if (moved.length) { setPieces((current) => current.map((piece) => { const change = moved.find((item) => item.piece.id === piece.id); return change ? { ...piece, position: change.position } : piece; })); moved.forEach(({ piece, position }) => { void pieceStore.put({ ...piece, updatedAt: new Date().toISOString(), position }); }); } }} excalidrawAPI={(api: ExcalidrawImperativeAPI) => { apiRef.current = api; }} initialData={{ elements, files, appState: { viewBackgroundColor: "#f9f8f5" } }} UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false} }}/>
        </div>
        {!boardPieces.length && !tourOpen && <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-black/[.08] bg-white/90 p-8 text-center shadow-[0_25px_80px_rgba(43,37,31,.14)] backdrop-blur-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#ebe1d6] text-[#9a6b58]"><Armchair className="h-6 w-6"/></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a6b58]">Your first board</p><h2 className="mt-2 font-serif text-[30px] tracking-tight">Add one piece to begin</h2><p className="mx-auto mt-3 max-w-[330px] text-sm leading-6 text-black/50">Drag any saved piece here, or upload a new image. We will guide the next step.</p><div className="mt-6 flex justify-center gap-2"><button onClick={() => void addProductToBoard(products[2])} className="pointer-events-auto rounded-full bg-[#26392f] px-5 py-2.5 text-xs font-semibold text-white">Add demo chair</button><button onClick={() => fileInputRef.current?.click()} className="pointer-events-auto rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-semibold">Upload image</button></div></div>}
      </section>

      <aside className="w-[238px] shrink-0 border-l border-black/[.07] bg-[#f8f6f1] p-5">{selectedPiece ? <><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9a6b58]">Selected piece</p><h3 className="mt-2 font-serif text-xl">Edit product</h3><div className="mt-4 rounded-xl border border-black/[.07] bg-white p-2"><p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-black/40">Product image</p><div className="grid grid-cols-2 gap-1"><button onClick={() => void setImageVariant("original")} className={selectedPiece.imageVariant !== "cutout" ? "flex items-center justify-center gap-1.5 rounded-lg bg-[#26392f] px-2 py-2 text-[10px] font-semibold text-white" : "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold text-black/50"}><ImageIcon className="h-3.5 w-3.5"/>Original</button><button disabled={!assetUrls[selectedPiece.id]?.cutout} onClick={() => void setImageVariant("cutout")} className={selectedPiece.imageVariant === "cutout" ? "flex items-center justify-center gap-1.5 rounded-lg bg-[#26392f] px-2 py-2 text-[10px] font-semibold text-white" : "flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[10px] font-semibold text-black/50 disabled:opacity-30"}><Scissors className="h-3.5 w-3.5"/>Cutout</button></div><button disabled={Boolean(processing[selectedPiece.id])} onClick={() => void processPieceImage(selectedPiece, true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#ebe1d6] px-2 py-2 text-[10px] font-semibold text-[#795747] disabled:opacity-60"><RefreshCw className={processing[selectedPiece.id] ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}/>{processing[selectedPiece.id] ?? (assetUrls[selectedPiece.id]?.cutout ? "Remake cutout" : "Remove background")}</button></div><label className="mt-5 block text-[10px] font-bold uppercase tracking-wider text-black/40">Title<input value={selectedPiece.product?.title ?? selectedPiece.text ?? ""} onChange={(event) => void updateSelectedPiece({ title: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-black/40">Price<input value={selectedPiece.product?.price ?? ""} onChange={(event) => void updateSelectedPiece({ price: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-black/40">Retailer<input value={selectedPiece.product?.retailer ?? ""} onChange={(event) => void updateSelectedPiece({ retailer: event.target.value })} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-xs font-normal normal-case tracking-normal outline-none focus:border-[#9a6b58]"/></label>{selectedPiece.product?.sourceUrl && <a href={selectedPiece.product.sourceUrl} target="_blank" className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-[#58705f]">Open source <ExternalLink className="h-3.5 w-3.5"/></a>}<button onClick={() => void deleteSelectedPiece()} className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl border border-red-900/10 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800"><Trash2 className="h-3.5 w-3.5"/>Remove from board</button></> : <><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Room overview</p><div className="mt-4 rounded-2xl border border-black/[.07] bg-white p-4"><p className="text-xs font-semibold">Budget</p><div className="mt-3 flex items-end justify-between"><span className="font-serif text-2xl">${spent.toLocaleString()}</span><span className="text-[10px] text-black/40">of ${budget.toLocaleString()}</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe8e2]"><div className="h-full rounded-full bg-[#9a6b58]" style={{ width: `${budgetPercent}%` }}/></div><div className="mt-4 flex items-center gap-2 text-[10px] text-[#58705f]"><CircleDollarSign className="h-3.5 w-3.5"/>${remaining.toLocaleString()} remaining</div></div><div className="mt-5"><p className="text-xs font-semibold">Style direction</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[#e7ded2] px-3 py-1.5 text-[10px]">Warm modern</span><span className="rounded-full bg-[#dfe6df] px-3 py-1.5 text-[10px]">Natural</span><span className="rounded-full bg-[#ebe8e2] px-3 py-1.5 text-[10px]">Soft minimal</span></div></div><div className="mt-7 border-t border-black/[.07] pt-5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-[#9a6b58]"/><p className="text-xs font-semibold">{pieces.length} {pieces.length === 1 ? "piece" : "pieces"} collected</p></div><p className="mt-2 text-[11px] leading-5 text-black/45">Choose a product card to add it, then click the canvas piece to edit.</p></div></>}</aside>
    </div>
    {confirmDelete && selectedPiece && <div className="absolute inset-0 z-50 grid place-items-center bg-black/20 backdrop-blur-[2px]"><div role="dialog" aria-modal="true" aria-labelledby="remove-piece-title" className="w-[340px] rounded-[22px] border border-black/10 bg-[#fffdf9] p-6 shadow-[0_24px_80px_rgba(35,29,24,.28)]"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#f3e7e2] text-[#8b4336]"><Trash2 className="h-4 w-4"/></div><h3 id="remove-piece-title" className="mt-4 font-serif text-2xl">Remove this piece?</h3><p className="mt-2 text-sm leading-5 text-black/50">It will disappear from this board. Nothing happens until you confirm.</p><div className="mt-6 grid grid-cols-2 gap-2"><button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-black/10 bg-white px-3 py-3 text-xs font-semibold">Keep it</button><button onClick={() => void deleteSelectedPiece()} className="rounded-xl bg-[#8b4336] px-3 py-3 text-xs font-semibold text-white">Yes, remove</button></div></div></div>}
    {extensionHelpOpen && <div className="fixed inset-0 z-50 grid place-items-end bg-black/25 p-3 backdrop-blur-[2px] sm:place-items-center"><div role="dialog" aria-modal="true" aria-labelledby="extension-setup-title" className="w-full max-w-[520px] rounded-[26px] border border-black/10 bg-[#fffdf9] p-5 shadow-[0_24px_80px_rgba(35,29,24,.28)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#9a6b58]">Chrome extension</p><h3 id="extension-setup-title" className="mt-2 font-serif text-2xl sm:text-3xl">Save products from any shop</h3></div><button onClick={() => setExtensionHelpOpen(false)} aria-label="Close extension setup" className="rounded-full p-2 text-black/45 hover:bg-black/5"><X className="h-4 w-4"/></button></div><div className="mt-6 grid gap-3"><div className="flex gap-3 rounded-2xl bg-[#f3eee7] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26392f] text-xs font-bold text-white">1</span><div><p className="text-sm font-bold">Install Alpha 5 in desktop Chrome</p><p className="mt-1 text-xs leading-5 text-black/55">Download, unzip, then open chrome://extensions and choose Load unpacked.</p></div></div><div className="flex gap-3 rounded-2xl bg-[#f3eee7] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26392f] text-xs font-bold text-white">2</span><div><p className="text-sm font-bold">Shop normally</p><p className="mt-1 text-xs leading-5 text-black/55">Open a product page, click the TayloredSpace bird icon, then press Save to TayloredSpace.</p></div></div><div className="flex gap-3 rounded-2xl bg-[#f3eee7] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#26392f] text-xs font-bold text-white">3</span><div><p className="text-sm font-bold">Return to this board</p><p className="mt-1 text-xs leading-5 text-black/55">The product appears here with its image, price, source, and automatic cutout.</p></div></div></div><div className="mt-6 flex flex-col gap-2 sm:flex-row"><a href="https://github.com/gunpowder27/tayloredspace/releases/tag/v0.1.0-alpha.5" target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#26392f] px-4 py-3 text-xs font-bold text-white">Download Alpha 5 <ExternalLink className="h-3.5 w-3.5"/></a><button onClick={() => setExtensionHelpOpen(false)} className="rounded-xl border border-black/10 bg-white px-4 py-3 text-xs font-semibold">I’ll do this later</button></div><p className="mt-4 text-center text-[10px] leading-4 text-black/40">The extension requires desktop Chrome. The board itself works on phones and tablets.</p></div></div>}
    {extensionHelpOpen && <button onClick={() => setExtensionHelpOpen(false)} aria-label="Close extension setup" title="Close" className="fixed right-5 top-5 z-[60] grid h-11 w-11 place-items-center rounded-full border border-black/15 bg-white text-black shadow-lg transition hover:bg-[#f3eee7]"><X className="h-6 w-6"/></button>}
  </main>;
}
