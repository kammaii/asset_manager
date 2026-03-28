# 자산 관리자 (Asset Manager) 프로젝트 요약

## 💡 1. 프로젝트 개요
* **목적:** 주식·연금·현금·부동산·금·가상화폐·자동차 등 개인 자산을 한 화면에서 입력·집계하고, 차트·목표 비중·AI 조언으로 포트폴리오를 점검한다.
* **주요 타겟:** 개인 투자자 및 가계 자산을 직접 관리하려는 사용자(현재 배포는 Google 로그인 + 허용 이메일 화이트리스트로 접근 제한 가능).

## 🛠 2. 기술 스택
* **Frontend:** Next.js(App Router), React 19, Tailwind CSS 4, Lucide React, Recharts
* **Backend:** Next.js Route Handlers(`app/api/*`), Firebase(Firestore, Auth), Firebase Admin(서버 토큰 검증)
* **기타 도구:** Zustand(+ persist: 브라우저 로컬 저장), Yahoo Finance 2(시세), `@google/genai`(AI 어드바이저·인사이트), 환율/금 시세 전용 API 라우트

## ✨ 3. 핵심 기능 목록
* **대시보드(`/`):** 자산 유형별 집계, 원·달러 드릴다운, 일/월 히스토리 차트, 대시보드 포함 여부·요약
* **입력·거래(`entry`):** 유형별 자산 추가·거래(매수/매도 등) 관리, 무료 플랜 시 자산 개수 상한 안내
* **설정(`settings`):** 대시보드에 쓸 자산 유형 on/off, 목표 자산 비중·목표 총액, 클라우드 연동(로그인) UI
* **시세·환율:** 서버 API에서 주식/코인 등 시세 보강, 환율·금 시세 캐시 활용
* **AI 어드바이저 / AI 인사이트:** 자산·목표 맥락 기반 질의/요약(비용·정책은 API 라우트에서 제어 가능)
* **멀티 유저·동기화(진행 방향):** Firestore `users/{uid}/...` 경로 격리, 로그인 시 로컬 `local_*` 자산을 서버로 올리는 `syncWithCloud`, 보안 규칙으로 본인 데이터만 read/write

## 📂 4. 디렉토리 구조 및 역할
AI는 작업 시 아래 구조를 참고하여 파일을 탐색하고 수정해야 합니다.

📦 `web_app/` (Next.js 앱 루트)
 ┣ 📂 `src/app/` # App Router 페이지 및 API
 ┃ ┣ 📜 `layout.js` # 폰트·전역 스타일, `AuthProvider`로 래핑
 ┃ ┣ 📜 `page.js` # 대시보드(메인)
 ┃ ┣ 📂 `entry/` # 자산·거래 입력
 ┃ ┣ 📂 `settings/` # 설정·목표 비중·로그인/백업 UI
 ┃ ┗ 📂 `api/` # Route Handlers (`assets`, `transactions`, `history`, `settings`, `ai-advisor`, `ai-insights`, `exchange-rate`, `gold-price` 등)
 ┣ 📂 `src/components/` # `AiAdvisor`, `AiInsights`, `AuthProvider` 등 UI·인증 래퍼
 ┣ 📂 `src/store/` # `useAssetStore.js` — Zustand 전역 상태·persist·인증 헤더·클라우드 동기화 액션
 ┣ 📂 `src/lib/` # `firebase.js`(클라이언트 SDK), `firebase-admin.js`(Admin + `getUserIdFromRequest`)
 ┗ 📜 `firestore.rules` # `users/{userId}` 및 하위 컬렉션에 대한 UID 기반 접근 제어

## 🗺 5. 화면 구성 및 네비게이션
* **로그인(게이트):** Google 로그인 → `NEXT_PUBLIC_ALLOWED_EMAILS`에 포함된 계정만 앱 본문 진입 → 대시보드 등
* **대시보드:** 자산 요약·차트·AI 위젯 → 입력(`entry`), 설정(`settings`) 링크
* **입력(`entry`):** 유형별 폼·거래 목록 → 대시보드/설정 이동
* **설정:** 유형/목표 비중 저장 → 대시보드 반영

## 🔄 6. 데이터 흐름 및 아키텍처
* **클라이언트 상태:** `useAssetStore`가 자산·거래·히스토리·설정 메타 등을 보관하고 `persist`로 로컬에 스냅샷 저장한다.
* **서버·DB:** API 라우트가 `Authorization: Bearer <Firebase ID Token>`을 `firebase-admin`으로 검증한 뒤 `uid`별 Firestore 컬렉션(`users/{uid}/assets` 등)에 접근한다. 클라이언트 일부는 Firestore Lite SDK로 보조 쿼리를 사용한다.
* **로컬 퍼스트 분기:** 스토어는 비로그인 시 `local_*` ID로 자산·거래를 메모리/로컬에만 쌓는 경로를 갖고, 로그인 성공 시 `syncWithCloud`로 서버에 올린 뒤 서버 데이터를 다시 불러온다. 현재 `layout`의 `AuthProvider`는 Google 로그인·허용 이메일(`NEXT_PUBLIC_ALLOWED_EMAILS`)로 본문 진입을 제한할 수 있어, 배포 설정에 따라 “비로그인 로컬 전용” 경로가 사용자에게 노출되지 않을 수 있다.
* **AI:** 클라이언트가 자산 컨텍스트와 함께 `/api/ai-advisor`, `/api/ai-insights`를 호출하고, 서버에서 모델·제한 정책을 적용한다.

## 📝 7. 최근 주요 업데이트 내역
* [2025-03-19]: Firestore 유저별 격리 규칙(`firestore.rules`) 정비, API에서 Firebase Admin 기반 UID 검증(`firebase-admin.js`), 스토어의 클라우드 동기화·인증 헤더·무료 자산 한도 등 멀티 유저·로컬-클라우드 혼합 흐름 반영.
