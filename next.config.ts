import type { NextConfig } from "next";
import { buildSecurityHeaders } from "./src/security/securityHeaders";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:2333';
    return [
      {
        source: '/horizon/:path*',
        destination: `${backendUrl}/proxy/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: buildSecurityHeaders(
          process.env.NODE_ENV || "development",
          process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:2333",
          process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001",
        ),
      },
    ];
  },
};

export default nextConfig;
