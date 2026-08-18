"use client";

import dynamic from "next/dynamic";
const Board = dynamic(() => import("@/components/board").then((module) => module.Board), { ssr: false, loading: () => <main className="grid h-screen place-items-center">Preparing your space…</main> });
export default function Home() { return <Board />; }
