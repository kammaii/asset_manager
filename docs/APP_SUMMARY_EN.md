# Asset Manager — Project Summary

## 💡 1. Project overview
* **Purpose:** Enter and aggregate personal assets (stocks, pensions, cash, real estate, gold, crypto, vehicles, etc.) on one screen, then review the portfolio with charts, target weights, and AI guidance.
* **Primary audience:** Individual investors and users who manage household assets themselves (dashboard from the first screen; optional Google linking from Settings).

## 🛠 2. Tech stack
* **Frontend:** Next.js 15.x (App Router), React 19, Tailwind CSS 4, Lucide React, Recharts
* **Backend:** Next.js Route Handlers (`app/api/*`), Firebase (Firestore, Auth), Firebase Admin (server token verification)
* **Other tools:** Zustand (+ persist: browser local storage), Yahoo Finance 2 (quotes), `@google/genai` (AI advisor & insights), dedicated API routes for FX and gold prices

## ✨ 3. Core features
* **Dashboard (`/`):** Aggregation by asset type, KRW/USD drill-down, daily/monthly history charts, dashboard inclusion flags and summaries
* **Entry & transactions (`entry`):** Add assets and manage transactions (buy/sell, etc.) by type; free-plan asset count limits surfaced in the UI
* **Settings (`settings`):** Toggle asset types for the dashboard, target weights and target totals, cloud linking (sign-in) UI
* **Quotes & FX:** Server APIs enrich stock/crypto quotes; FX and gold prices use caching
* **AI advisor / AI insights:** Q&A and summaries grounded in assets and goals (cost and policy controlled in API routes)
* **Multi-user & sync (direction of travel):** Firestore paths isolated under `users/{uid}/...`; `syncWithCloud` uploads local `local_*` assets to the server after sign-in; security rules restrict read/write to the owner’s data

## 📂 4. Directory layout and roles
When working on the codebase, use this structure to find and edit files.

📦 `web_app/` (Next.js app root)
 ┣ 📂 `src/app/` # App Router pages and APIs
 ┃ ┣ 📜 `layout.js` # Fonts, global styles, wrapped with `AuthProvider`
 ┃ ┣ 📜 `page.js` # Dashboard (main)
 ┃ ┣ 📂 `entry/` # Asset and transaction entry
 ┃ ┣ 📂 `settings/` # Settings, target weights, sign-in / backup UI
 ┃ ┗ 📂 `api/` # Route Handlers (`assets`, `transactions`, `history`, `settings`, `ai-advisor`, `ai-insights`, `exchange-rate`, `gold-price`, etc.)
 ┣ 📂 `src/components/` # UI and auth wrappers such as `AiAdvisor`, `AiInsights`, `AuthProvider`
 ┣ 📂 `src/store/` # `useAssetStore.js` — Zustand global state, persist, auth headers, cloud sync actions
 ┣ 📂 `src/lib/` # `firebase.js` (client SDK), `firebase-admin.js` (Admin + `getUserIdFromRequest`)
 ┗ 📜 `firestore.rules` # UID-based access for `users/{userId}` and subcollections

## 🗺 5. Screens and navigation
* **Dashboard (entry):** App opens directly to the main dashboard → links to Entry (`entry`) and Settings (`settings`)
* **Entry (`entry`):** Type-specific forms and transaction lists → navigate to Dashboard / Settings
* **Settings:** Save types and target weights → reflected on the Dashboard

## 🔄 6. Data flow and architecture
* **Client state:** `useAssetStore` holds assets, transactions, history, settings metadata, etc., and persists snapshots locally via `persist`.
* **Server & DB:** API routes verify `Authorization: Bearer <Firebase ID Token>` with `firebase-admin`, then read/write **Firebase Admin Firestore (`adminDb`)** only under paths like `users/{uid}/assets`, `users/{uid}/transactions`. Using the browser client SDK on the server leaves `request.auth` empty in Firestore rules, so user collections are denied—APIs use Admin only. The client may use Firestore Lite for auth/UI, but CRUD goes mainly through APIs.
* **Local-first branch:** When signed out, the store keeps assets/transactions under `local_*` IDs in memory/local only; after Google sign-in from Settings, `syncWithCloud` uploads to the server and reloads server data. `AuthProvider` does not block the main UI; it only provides layout / `useAuth` context.
* **AI:** The client calls `/api/ai-advisor` and `/api/ai-insights` with asset context; the server applies model and rate limits.

## 📝 7. Recent notable updates
* [2026-04-06]: Cloud Run API 500 — `firebase deploy` ignores `package.json` scripts and runs `next build` internally; **Next.js 16 defaults to Turbopack**, so `firebase-admin` was externalized as a virtual `firebase-admin-<hash>` package and Cloud Run hit `ERR_MODULE_NOT_FOUND`. Firebase CLI officially supports Next.js 12–15.x only. **Mitigation: downgrade Next.js 16 → 15.5.14** (Webpack by default) and align ESLint with Next.js 15 via `FlatCompat`.
* [2026-04-02]: Firebase Hosting (Cloud Run) API 500 — **Turbopack did not embed `process.env.FIREBASE_*`**, so values were missing at runtime on Cloud Run. **Mitigation:** `embed-firebase-admin.mjs` inlines credentials into `firebaseAdminEmbedded.generated.js` (gitignore, `prebuild` / `predev` / `postinstall`). `firebase-admin` keeps modular init and no-arg `FIREBASE_CONFIG` init. CI workflows write the service account JSON to `.env.production`, then `npm ci` → embed → `next build`.
* [2026-03-30]: Switched API Firestore access from the client SDK to **Admin SDK (`adminDb`)** (server requests had no auth context, so reads under `users/{uid}` failed under rules). Client: `getAuthHeaders` refined to send the ID token after `auth.authStateReady()`.
* [2026-03-28]: Firestore generalization — APIs `assets/[id]`, `transactions/[id]` unified under `users/{uid}/...`; scheduled `takeDailySnapshot` writes per-user snapshots via `collectionGroup('assets')`. Migration from root collections to `users/{uid}`: `web_app/scripts/migrate-root-to-user.mjs` and `npm run migrate:firestore`.
* [2026-03-28]: Removed the Google sign-in gate on first launch; main (dashboard) shows immediately. Cloud linking remains the existing sign-in flow on Settings.
* [2025-03-19]: Tightened per-user Firestore rules (`firestore.rules`), UID verification in APIs via Firebase Admin (`firebase-admin.js`), and store updates for cloud sync, auth headers, free asset limits, and mixed local/cloud multi-user flows.
