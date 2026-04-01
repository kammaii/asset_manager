import { NextResponse } from 'next/server';
import { adminDb, FieldValue, getUserIdFromRequest } from '@/lib/firebase-admin';

export async function PUT(request, { params }) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const assetRef = adminDb.collection('users').doc(uid).collection('assets').doc(id);

        const updateData = { ...body };
        delete updateData.id;
        delete updateData.createdAt;

        await assetRef.update({
            ...updateData,
            updatedAt: FieldValue.serverTimestamp()
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update asset', error);
        return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const assetRef = adminDb.collection('users').doc(uid).collection('assets').doc(id);
        await assetRef.delete();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete asset', error);
        return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }
}
