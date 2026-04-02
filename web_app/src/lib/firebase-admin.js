import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

/**
 * 로컬: .env의 서비스 계정 또는 ADC(gcloud / GOOGLE_APPLICATION_CREDENTIALS).
 * Firebase Hosting(App Hosting·frameworks 백엔드): FIREBASE_CONFIG 주입 시 무인자 initializeApp() 권장.
 * Next.js가 firebase-admin을 번들하면 런타임 오류가 날 수 있어 next.config.mjs의 serverExternalPackages에 포함함.
 */
function getOrInitApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asset-master-jwpark';

    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json?.trim()) {
        try {
            const sa = JSON.parse(json);
            return initializeApp({
                credential: cert(sa),
                projectId: sa.project_id || projectId,
            });
        } catch (e) {
            console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패:', e);
        }
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey =
        typeof rawKey === 'string' ? rawKey.replace(/\\n/g, '\n').trim() : '';

    if (clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
        return initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
    }

    // Cloud Run / App Hosting: 콘솔이 주입하는 FIREBASE_CONFIG로 자동 구성 (ADC보다 안정적)
    if (process.env.FIREBASE_CONFIG?.trim()) {
        try {
            return initializeApp();
        } catch (e) {
            console.error('[firebase-admin] FIREBASE_CONFIG 기반 initializeApp() 실패:', e);
        }
    }

    return initializeApp({
        credential: applicationDefault(),
        projectId,
    });
}

const app = getOrInitApp();
const adminDb = getFirestore(app);
const adminAuth = getAuth(app);

/** 서버 API Route에서만 사용. 클라이언트 SDK로는 rules의 request.auth가 비어 사용자 데이터 읽기가 거부됨. */
export { adminDb, adminAuth, FieldValue };

/**
 * Authorization 헤더에서 토큰을 추출하고 검증하여 UID를 반환합니다.
 */
export async function getUserIdFromRequest(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('Error verifying Firebase ID token:', error);
        return null;
    }
}
