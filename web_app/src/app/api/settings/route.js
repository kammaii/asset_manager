import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { getUserIdFromRequest } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const docRef = doc(db, 'users', uid, 'settings', 'general');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return NextResponse.json(docSnap.data());
        } else {
            // 문서가 없으면 기본값 반환
            return NextResponse.json({
                accountTypes: ['키움증권', 'NH투자증권', '미래에셋', 'IRP', 'ISA', '일반'],
                cashInstitutions: ['NH투자증권', '토스뱅크', '카카오뱅크', 'KB국민은행', '신한은행']
            });
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            accountTypes,
            cashInstitutions,
            savedStockItems,
            savedPensionItems,
            savedCryptoItems,
            enabledAssetTypes,
            hasMigratedV2,
            targetAssetRatios,
            targetTotalAmount
        } = body;

        // UID 기반 경로로 저장 (users/{uid}/settings/general)
        const docRef = doc(db, 'users', uid, 'settings', 'general');

        // 전달된 필드만 업데이트 (merge)
        const updateData = {};
        if (accountTypes !== undefined) updateData.accountTypes = accountTypes;
        if (cashInstitutions !== undefined) updateData.cashInstitutions = cashInstitutions;
        if (savedStockItems !== undefined) updateData.savedStockItems = savedStockItems;
        if (savedPensionItems !== undefined) updateData.savedPensionItems = savedPensionItems;
        if (savedCryptoItems !== undefined) updateData.savedCryptoItems = savedCryptoItems;
        if (enabledAssetTypes !== undefined) updateData.enabledAssetTypes = enabledAssetTypes;
        if (hasMigratedV2 !== undefined) updateData.hasMigratedV2 = hasMigratedV2;
        if (targetAssetRatios !== undefined) updateData.targetAssetRatios = targetAssetRatios;
        if (targetTotalAmount !== undefined) updateData.targetTotalAmount = targetTotalAmount;

        await setDoc(docRef, updateData, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
