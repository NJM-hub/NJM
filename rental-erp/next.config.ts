import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 이 폴더(rental-erp)를 프로젝트 루트로 고정 (상위 폴더에 다른 앱이 있어도 헷갈리지 않도록)
  turbopack: { root: import.meta.dirname },
  // 엑셀 가져오기 (서버 동작으로 파일 전송)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
