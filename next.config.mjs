/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emits .next/standalone with a self-contained server.js — this is what the
  // Docker runtime stage copies, so the final image carries no dev deps.
  output: "standalone",
};

export default nextConfig;
