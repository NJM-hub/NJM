import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 폴더(goldencar-van)를 프로젝트 루트로 고정 (상위 폴더에 다른 앱이 있어도 헷갈리지 않도록)
  turbopack: { root: import.meta.dirname },
  images: { qualities: [75, 85] },
};

export default nextConfig;
