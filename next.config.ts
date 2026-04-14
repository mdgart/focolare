import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "better-auth", "@better-auth/drizzle-adapter"],
};

export default nextConfig;
