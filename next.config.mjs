/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow remote prospect/source logos to be rendered via plain <img>.
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
};

export default nextConfig;
