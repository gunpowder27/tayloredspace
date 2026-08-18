import type { Metadata } from "next";
import "@excalidraw/excalidraw/index.css";
import "./globals.css";
export const metadata: Metadata = { title: "TayloredSpace", description: "Turn inspiration into a room you can actually buy.", icons: { icon: "/tayloredspace-logo.jpg", apple: "/tayloredspace-logo.jpg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
