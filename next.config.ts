import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "better-auth", "@better-auth/drizzle-adapter"],
  images: {
    remotePatterns: [
      // Vercel Blob CDN — where uploads and AI covers live in production.
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Seeded demo photos.
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

export default nextConfig;
