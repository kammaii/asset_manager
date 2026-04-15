import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import {
    __FIREBASE_ADMIN_EMBEDDED_JSON,
    __FIREBASE_ADMIN_EMBEDDED_CLIENT_EMAIL,
    __FIREBASE_ADMIN_EMBEDDED_PRIVATE_KEY,
} from './firebaseAdminEmbedded.generated.js';

/**
 * 런타임 env(로컬 next dev) 우선, 없으면 prebuild가 만든 firebaseAdminEmbedded.generated.js 값 사용.
 * Cloud Run에는 .env가 없어 process.env만으로는 비어 있음 → 생성 파일에 박힌 상수로 Admin 초기화.
 */
function getOrInitApp() {
    if (getApps().length > 0) {
        return getApps()[0];
    }

    const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asset-master-jwpark';

    const json =
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON || __FIREBASE_ADMIN_EMBEDDED_JSON;
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

    const clientEmail = (
        process.env.FIREBASE_CLIENT_EMAIL || __FIREBASE_ADMIN_EMBEDDED_CLIENT_EMAIL
    )?.trim();
    const rawKey =
        process.env.FIREBASE_PRIVATE_KEY || __FIREBASE_ADMIN_EMBEDDED_PRIVATE_KEY;
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
