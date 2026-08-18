import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@tayloredspace/domain", "@tayloredspace/persistence"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
};
export default config;
