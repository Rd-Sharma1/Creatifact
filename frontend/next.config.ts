import type { NextConfig } from "next";

export function apiRewrites(environment = process.env.NODE_ENV) {
  if (environment !== "development") return [];
  return [{ source: "/api/:path*", destination: "http://localhost:8080/api/:path*" }];
}

export function allowedDevelopmentOrigins(environment = process.env.NODE_ENV) {
  // Local HTTPS OAuth uses an ngrok hostname for the frontend. Next.js blocks
  // cross-origin dev assets by default, which prevents Client Components from
  // hydrating (and therefore prevents their session/repository effects running).
  return environment === "development" ? ["*.ngrok-free.dev"] : undefined;
}

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  allowedDevOrigins: allowedDevelopmentOrigins(),
  // Local OAuth needs the browser, callback, and host-only Lax cookies on one
  // origin. In development, proxy API paths through Next to the local Express
  // server. Production continues to call the separately deployed API directly.
  async rewrites() { return apiRewrites(); },
};

export default nextConfig;
