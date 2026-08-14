import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy /api/* → FastAPI backend so the UI never hits CORS
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.FASTAPI_URL ?? "http://localhost:8000"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
