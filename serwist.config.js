// @ts-check
import { serwist } from "@serwist/next/config";

// The /~offline fallback page must be precached for the SW fallback to work.
const revision = crypto.randomUUID();

export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});
