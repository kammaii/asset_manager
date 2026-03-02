import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore/lite';

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const assetRef = doc(db, 'assets', id);

        // Remove id and createdAt if they happen to be in the body to avoid overwriting them incorrectly
        const updateData = { ...body };
        delete updateData.id;
        delete updateData.createdAt;

        await updateDoc(assetRef, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to update asset', error);
        return NextResponse.json({ error: 'Failed to update asset' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        const assetRef = doc(db, 'assets', id);
        await deleteDoc(assetRef);
        // Maybe we also need to delete transactions associated with this asset?
        // Let's assume for real estate it's fine for now, or we can handle it if needed.
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete asset', error);
        return NextResponse.json({ error: 'Failed to delete asset' }, { status: 500 });
    }
}
