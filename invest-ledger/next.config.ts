import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 폴더(invest-ledger)를 프로젝트 루트로 고정 (저장소 상위 폴더의 다른 앱과 섞이지 않도록)
  turbopack: { root: import.meta.dirname },
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
