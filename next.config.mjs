/** @type {import('next').NextConfig} */

// `output: "standalone"` emits .next/standalone with a self-contained
// server.js. The Docker runtime stage copies exactly that, so the image can
// ship without dev dependencies — but managed hosts (Vercel and friends) do
// their own packaging and the extra output trips their build, which is why the
// deployed fork had to delete the line outright.
//
// So it is opt-in rather than always-on: the Dockerfile's builder stage sets
// BUILD_STANDALONE=1, and every other build — local, CI, managed host — gets
// the default output that those platforms expect.
const standalone = process.env.BUILD_STANDALONE === "1";

const nextConfig = {
  reactStrictMode: true,
  ...(standalone ? { output: "standalone" } : {}),
};

export default nextConfig;
