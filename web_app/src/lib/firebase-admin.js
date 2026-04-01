import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * FIREBASE_PRIVATE_KEY가 비어 있으면 cert()에 undefined가 들어가 "private_key" 오류가 난다.
 * 키가 있을 때만 서비스 계정으로 초기화하고, 없으면 ADC(application default)를 쓴다.
 */
function initFirebaseAdmin() {
    if (admin.apps.length) return;

    const projectId =
        process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asset-master-jwpark';

    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (json?.trim()) {
        try {
            const sa = JSON.parse(json);
            admin.initializeApp({
                credential: admin.credential.cert(sa),
                projectId: sa.project_id || projectId,
            });
            return;
        } catch (e) {
            console.error('[firebase-admin] FIREBASE_SERVICE_ACCOUNT_JSON 파싱 실패:', e);
        }
    }

    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const rawKey = process.env.FIREBASE_PRIVATE_KEY;
    const privateKey =
        typeof rawKey === 'string' ? rawKey.replace(/\\n/g, '\n').trim() : '';

    if (clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId,
                clientEmail,
                privateKey,
            }),
        });
        return;
    }

    // 로컬: GOOGLE_APPLICATION_CREDENTIALS=/path/to.json 또는 gcloud auth application-default login
    // 배포: 클라우드가 자동으로 ADC 주입
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
    });
}

initFirebaseAdmin();

const adminDb = admin.firestore();
const adminAuth = admin.auth();

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
