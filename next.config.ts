import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // Never precache server-side work — always hit the network for fresh data.
  exclude: [/\/api\//, /_next\/static\/.*\.map$/],
});

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Bulk imports post parsed spreadsheet rows to Server Actions; the 1 MB
      // default 413'd in production. 5 MB pairs with FileDropzone's 4.5 MB
      // client-side cap, leaving headroom for JSON serialization overhead.
      bodySizeLimit: "5mb",
    },
  },
};

export default withSerwist(nextConfig);
