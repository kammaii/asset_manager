/** @type {import('next').NextConfig} */
// Next.js 15 + Webpack 기본값 조합.
// serverExternalPackages: firebase-admin은 번들링하지 않고 런타임 외부 패키지로 처리.
// (Next.js 16 + Turbopack 시절엔 firebase-admin-<hash> 로 해싱돼 Cloud Run 500 발생했으나,
//  Next.js 15 Webpack은 패키지명 그대로 외부화하므로 Cloud Run에서 정상 해석됨)
const nextConfig = {
    serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
