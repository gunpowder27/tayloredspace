import type { Metadata } from "next";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
export const metadata: Metadata = { title: "TayloredSpace", description: "Turn inspiration into a room you can actually buy.", icons: { icon: "/tayloredspace-logo-v2.png", apple: "/tayloredspace-logo-v2.png" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body suppressHydrationWarning>{children}</body></html>; }
