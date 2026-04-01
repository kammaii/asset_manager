/**
 * 루트 컬렉션(레거시 단일 사용자 구조) → users/{uid}/{collection} 으로 복사
 *
 * 사용 (web_app 디렉터리에서):
 *   node scripts/migrate-root-to-user.mjs [대상_UID] [--delete-source]
 *
 * 예:
 *   node scripts/migrate-root-to-user.mjs SW6GAvdnkCfxCSa0nonFp3FBgu52
 *   node scripts/migrate-root-to-user.mjs SW6GAvdnkCfxCSa0nonFp3FBgu52 --delete-source
 *
 * 필요 환경: .env.local 의 FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID(선택)
 *
 * 대상 컬렉션(루트): assets, transactions, daily_snapshots, monthly_snapshots, settings, test
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
    const p = join(__dirname, '..', '.env.local');
    if (!existsSync(p)) return;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq === -1) continue;
        const key = t.slice(0, eq).trim();
        let val = t.slice(eq + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = val;
    }
}

loadEnvLocal();

const deleteSource = process.argv.includes('--delete-source');
const posArgs = process.argv.slice(2).filter((a) => a !== '--delete-source');
const TARGET_UID = posArgs[0] || 'SW6GAvdnkCfxCSa0nonFp3FBgu52';

if (!process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    console.error('FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 가 필요합니다 (.env.local).');
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asset-master-jwpark',
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

const ROOT_COLLECTIONS = [
    'assets',
    'daily_snapshots',
    'monthly_snapshots',
    'settings',
    'test',
    'transactions',
];

async function copyCollection(rootName) {
    const snap = await db.collection(rootName).get();
    if (snap.empty) {
        console.log(`[skip] ${rootName}: 루트에 문서 없음`);
        return;
    }

    let batch = db.batch();
    let ops = 0;
    const commits = [];

    for (const docSnap of snap.docs) {
        const dest = db.collection('users').doc(TARGET_UID).collection(rootName).doc(docSnap.id);
        batch.set(dest, docSnap.data(), { merge: true });
        ops++;

        if (ops >= 450) {
            commits.push(batch.commit());
            batch = db.batch();
            ops = 0;
        }
    }
    if (ops > 0) commits.push(batch.commit());
    await Promise.all(commits);
    console.log(`[ok] ${rootName}: ${snap.size}건 → users/${TARGET_UID}/${rootName}`);

    if (deleteSource) {
        let delBatch = db.batch();
        let delOps = 0;
        const delCommits = [];
        for (const docSnap of snap.docs) {
            delBatch.delete(docSnap.ref);
            delOps++;
            if (delOps >= 450) {
                delCommits.push(delBatch.commit());
                delBatch = db.batch();
                delOps = 0;
            }
        }
        if (delOps > 0) delCommits.push(delBatch.commit());
        await Promise.all(delCommits);
        console.log(`[delete] ${rootName}: 루트 문서 삭제 완료`);
    }
}

async function ensureUserDoc() {
    await db.collection('users').doc(TARGET_UID).set(
        { migratedFromRootAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
    );
    console.log(`[ok] users/${TARGET_UID} 문서 생성/갱신`);
}

async function main() {
    console.log(`대상 UID: ${TARGET_UID}`);
    console.log(`루트 삭제: ${deleteSource ? '예 (--delete-source)' : '아니오 (복사만)'}`);
    await ensureUserDoc();
    for (const name of ROOT_COLLECTIONS) {
        await copyCollection(name);
    }
    console.log('완료.');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
