const withSerwist = require("@serwist/next").default({
  swSrc: "sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  trailingSlash: true,
  experimental: {
    typedRoutes: true
  }
};

module.exports = withSerwist(nextConfig);
