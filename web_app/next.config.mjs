/** @type {import('next').NextConfig} */
// Next.js 16은 `next build` 기본이 Turbopack이라 Firebase CLI(webframeworks)가 firebase-admin을
// `firebase-admin-<hash>` 가상 패키지로 외부화하고 Cloud Run에서 ERR_MODULE_NOT_FOUND(500) 발생.
// Firebase CLI는 Next.js 12-15.x만 공식 지원하므로 Next.js 15.x로 다운그레이드.
// Next.js 15에서는 `next build` 기본이 Webpack이라 이 문제가 없음.
const nextConfig = {};

export default nextConfig;
