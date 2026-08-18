"use client";

import { Excalidraw, convertToExcalidrawElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { captureToPiece, TAYLOREDSPACE_BRIDGE_EVENT, type ExtensionCapture, type TayloredPiece } from "@tayloredspace/domain";
import { pieceStore } from "@tayloredspace/persistence";
import { Armchair, ChevronDown, CircleDollarSign, Grid2X2, Heart, ImagePlus, Layers3, Link2, PackageOpen, Plus, Search, Settings2, WandSparkles } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

  const addPieces = useCallback(async (incoming: TayloredPiece[]) => {
    const fresh = incoming.filter((piece) => !known.current.has(piece.id));
    if (!fresh.length) return;
    fresh.forEach((piece) => known.current.add(piece.id));
    await pieceStore.putMany(fresh);
    setPieces((current) => [...current, ...fresh]);
    setStatus(`${fresh.length} product${fresh.length === 1 ? "" : "s"} added from the extension`);
  }, []);

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

  const files = useMemo<BinaryFiles>(() => Object.fromEntries(pieces.filter((piece) => piece.imageDataUrl?.startsWith("data:" )).map((piece) => [toFileId(piece.id), { id: toFileId(piece.id), dataURL: piece.imageDataUrl as never, mimeType: (piece.imageDataUrl?.slice(5, piece.imageDataUrl.indexOf(";")) || "image/png") as never, created: Date.parse(piece.createdAt), lastRetrieved: Date.now() }])), [pieces]);
  const elements = useMemo(() => pieces.flatMap(pieceElements), [pieces]);
  useEffect(() => { if (apiRef.current && elements.length) { apiRef.current.addFiles(Object.values(files)); apiRef.current.updateScene({ elements }); } }, [elements, files]);

  const products = [
    { name: "Lennon sofa", price: "$1,899", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=400&q=80" },
    { name: "Travertine table", price: "$649", image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=400&q=80" },
    { name: "Bouclé chair", price: "$849", image: "https://images.unsplash.com/photo-1549497538-303791108f95?auto=format&fit=crop&w=400&q=80" },
  ];

  return <main className="flex h-screen min-w-[1040px] flex-col overflow-hidden bg-[#eeebe4] text-[#24221f]">
    <header className="flex h-[72px] shrink-0 items-center border-b border-black/[.07] bg-[#f8f6f1] px-5">
      <div className="flex w-[278px] items-center gap-3 border-r border-black/[.07]"><div className="relative h-11 w-11 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm"><Image src="/tayloredspace-logo.jpg" alt="TayloredSpace swallow" fill sizes="44px" priority className="object-cover"/></div><div><h1 className="font-serif text-[21px] leading-none tracking-tight">TayloredSpace</h1><p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[.17em] text-[#9a6b58]">Design what feels like you</p></div></div>
      <div className="flex flex-1 items-center justify-between pl-6"><button className="flex items-center gap-2 text-sm font-semibold">Austin living room <ChevronDown className="h-4 w-4 text-black/45"/></button><div className="flex items-center gap-3"><div className="flex items-center gap-2 rounded-full bg-[#e9efe9] px-3 py-2 text-[11px] font-medium text-[#4b6354]"><span className="h-1.5 w-1.5 rounded-full bg-[#66866f]"/>{status}</div><button className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-semibold shadow-sm">Share preview</button><button aria-label="Settings" className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white"><Settings2 className="h-4 w-4"/></button></div></div>
    </header>

    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[298px] shrink-0 flex-col border-r border-black/[.07] bg-[#f8f6f1]">
        <div className="p-5 pb-3"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Your collection</p><h2 className="mt-1 font-serif text-[24px]">Saved pieces</h2></div><button aria-label="Add piece" className="grid h-9 w-9 place-items-center rounded-full bg-[#26392f] text-white"><Plus className="h-4 w-4"/></button></div><label className="flex items-center gap-2 rounded-xl border border-black/[.08] bg-white px-3 py-2.5 text-xs text-black/40"><Search className="h-4 w-4"/><input aria-label="Search saved pieces" className="w-full bg-transparent outline-none" placeholder="Search furniture, lighting…"/></label></div>
        <div className="flex gap-2 overflow-hidden px-5 py-2 text-[11px]"><button className="rounded-full bg-[#26392f] px-3 py-1.5 text-white">All 12</button><button className="rounded-full border border-black/10 bg-white px-3 py-1.5">Seating</button><button className="rounded-full border border-black/10 bg-white px-3 py-1.5">Tables</button></div>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto p-5 pt-3">
          {products.map((product) => <button key={product.name} className="group overflow-hidden rounded-2xl border border-black/[.07] bg-white text-left shadow-[0_5px_18px_rgba(46,39,31,.05)]"><div className="relative aspect-square overflow-hidden bg-[#e7e1d8]"><Image src={product.image} alt={product.name} fill sizes="120px" className="object-cover transition duration-300 group-hover:scale-105"/><span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-white/90"><Heart className="h-3.5 w-3.5"/></span></div><div className="p-2.5"><p className="truncate text-[11px] font-semibold">{product.name}</p><p className="mt-1 text-[10px] text-black/45">{product.price}</p></div></button>)}
          <button className="grid aspect-[.78] place-items-center rounded-2xl border border-dashed border-black/15 bg-white/45 text-center"><div><ImagePlus className="mx-auto h-5 w-5 text-black/35"/><p className="mt-2 text-[10px] font-semibold text-black/45">Add inspiration</p></div></button>
        </div>
        <div className="mt-auto border-t border-black/[.07] p-5"><div className="rounded-2xl bg-[#26392f] p-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold"><WandSparkles className="h-4 w-4 text-[#dec8a5]"/>Capture from anywhere</div><p className="mt-2 text-[11px] leading-5 text-white/60">Use the browser extension on any product page and it lands right here.</p><button className="mt-3 flex items-center gap-2 text-[11px] font-semibold text-[#dec8a5]"><Link2 className="h-3.5 w-3.5"/>How product capture works</button></div></div>
      </aside>

      <section className="relative min-w-0 flex-1 bg-[#dedbd3] p-4">
        <div className="absolute left-1/2 top-7 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/[.08] bg-white/95 p-1.5 shadow-[0_8px_30px_rgba(42,37,31,.12)] backdrop-blur"><button className="flex items-center gap-2 rounded-lg bg-[#f0eee9] px-3 py-2 text-[11px] font-semibold"><Grid2X2 className="h-3.5 w-3.5"/>Board</button><button className="flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] text-black/45"><Layers3 className="h-3.5 w-3.5"/>Room view</button></div>
        <div className="h-full overflow-hidden rounded-[22px] border border-black/[.08] bg-[#f9f8f5] shadow-[0_16px_50px_rgba(52,46,38,.08)]">
          <Excalidraw excalidrawAPI={(api) => { apiRef.current = api; if (elements.length) { api.addFiles(Object.values(files)); api.updateScene({ elements }); } }} initialData={{ elements, files, appState: { viewBackgroundColor: "#f9f8f5" } }} UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}/>
        </div>
        {!pieces.length && <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-black/[.08] bg-white/90 p-8 text-center shadow-[0_25px_80px_rgba(43,37,31,.14)] backdrop-blur-xl"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#ebe1d6] text-[#9a6b58]"><Armchair className="h-6 w-6"/></div><p className="mt-5 text-[10px] font-bold uppercase tracking-[.18em] text-[#9a6b58]">Austin living room</p><h2 className="mt-2 font-serif text-[30px] tracking-tight">Create a room you can actually buy</h2><p className="mx-auto mt-3 max-w-[330px] text-sm leading-6 text-black/50">Drag saved pieces onto the canvas, mix in inspiration, and shape a room that feels unmistakably yours.</p><div className="mt-6 flex justify-center gap-2"><button className="pointer-events-auto rounded-full bg-[#26392f] px-5 py-2.5 text-xs font-semibold text-white">Start with saved pieces</button><button className="pointer-events-auto rounded-full border border-black/10 bg-white px-5 py-2.5 text-xs font-semibold">Upload a room</button></div></div>}
      </section>

      <aside className="w-[238px] shrink-0 border-l border-black/[.07] bg-[#f8f6f1] p-5"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-black/40">Room overview</p><div className="mt-4 rounded-2xl border border-black/[.07] bg-white p-4"><p className="text-xs font-semibold">Budget</p><div className="mt-3 flex items-end justify-between"><span className="font-serif text-2xl">$4,247</span><span className="text-[10px] text-black/40">of $6,000</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ebe8e2]"><div className="h-full w-[71%] rounded-full bg-[#9a6b58]"/></div><div className="mt-4 flex items-center gap-2 text-[10px] text-[#58705f]"><CircleDollarSign className="h-3.5 w-3.5"/>$1,753 remaining</div></div><div className="mt-5"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Style direction</p><button className="text-[10px] text-black/40">Edit</button></div><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[#e7ded2] px-3 py-1.5 text-[10px]">Warm modern</span><span className="rounded-full bg-[#dfe6df] px-3 py-1.5 text-[10px]">Natural</span><span className="rounded-full bg-[#ebe8e2] px-3 py-1.5 text-[10px]">Soft minimal</span></div></div><div className="mt-7 border-t border-black/[.07] pt-5"><div className="flex items-center gap-2"><PackageOpen className="h-4 w-4 text-[#9a6b58]"/><p className="text-xs font-semibold">12 pieces collected</p></div><p className="mt-2 text-[11px] leading-5 text-black/45">3 retailers · 2 inspiration images · locally saved</p></div></aside>
    </div>
  </main>;
}
