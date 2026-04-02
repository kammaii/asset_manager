/** @type {import('next').NextConfig} */
const nextConfig = {
  // Firebase Hosting(Cloud Run) 배포 시 firebase-admin을 번들에 넣으면 초기화/인스턴스 오류가 날 수 있음
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;
