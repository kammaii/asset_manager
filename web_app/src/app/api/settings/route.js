import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';

export async function GET() {
    try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return NextResponse.json(docSnap.data());
        } else {
            // Return default values if document doesn't exist
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
        const body = await request.json();
        const { accountTypes, cashInstitutions } = body;

        const docRef = doc(db, 'settings', 'general');

        // Use setDoc with merge to only update provided fields if needed
        const updateData = {};
        if (accountTypes !== undefined) updateData.accountTypes = accountTypes;
        if (cashInstitutions !== undefined) updateData.cashInstitutions = cashInstitutions;

        await setDoc(docRef, updateData, { merge: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
