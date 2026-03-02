import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, getDocs, collection, query, where, deleteDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore/lite';

async function recalculateAsset(assetId) {
    const assetRef = doc(db, 'assets', assetId);
    const assetSnap = await getDoc(assetRef);
    if (!assetSnap.exists()) return;

    // Get all transactions for this asset
    const txsRef = collection(db, 'transactions');
    const q = query(txsRef, where('asset_id', '==', assetId));
    const txsSnap = await getDocs(q);

    if (txsSnap.empty) {
        // No transactions left, delete the asset
        await deleteDoc(assetRef);
        return;
    }

    const txs = txsSnap.docs.map(doc => doc.data());
    // chronologoical order
    txs.sort((a, b) => {
        if (a.date !== b.date) {
            return new Date(a.date) - new Date(b.date);
        }
        return new Date(a.createdAt?.toDate?.() || 0) - new Date(b.createdAt?.toDate?.() || 0);
    });

    let currentQty = 0;
    let currentPrincipal = 0;
    let currentAvgPrice = 0;

    for (const tx of txs) {
        if (tx.action === 'buy') {
            currentQty += tx.quantity;
            currentPrincipal += (tx.quantity * tx.price);
            currentAvgPrice = currentQty > 0 ? currentPrincipal / currentQty : 0;
        } else if (tx.action === 'sell') {
            const sellQty = tx.quantity;
            currentQty -= sellQty;
            if (currentQty < 0) currentQty = 0; // Prevent negative quantity in logical errors

            // On sell, principal is reduced proportionally, average price remains the same
            const proportion = (currentQty + sellQty) > 0 ? currentQty / (currentQty + sellQty) : 0;
            currentPrincipal = currentPrincipal * proportion;
        }
    }

    await updateDoc(assetRef, {
        quantity: currentQty,
        avgPrice: currentAvgPrice,
        principal: currentPrincipal,
        updatedAt: serverTimestamp()
    });
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const txRef = doc(db, 'transactions', id);
        const txSnap = await getDoc(txRef);
        if (!txSnap.exists()) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const assetId = txSnap.data().asset_id;

        await deleteDoc(txRef);
        await recalculateAsset(assetId);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('DELETE transaction error:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();
        const { date, quantity, price, action, type, region, symbol, name } = body;

        const txRef = doc(db, 'transactions', id);
        const txSnap = await getDoc(txRef);
        if (!txSnap.exists()) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const tx = txSnap.data();
        const oldAssetId = tx.asset_id;
        let newAssetId = oldAssetId;

        const querySymbol = symbol || '';
        const queryRegion = region || 'KR';

        if (type && name) {
            const oldAssetRef = doc(db, 'assets', oldAssetId);
            const oldAssetSnap = await getDoc(oldAssetRef);
            const oldAsset = oldAssetSnap.data();

            if (oldAsset && (oldAsset.type !== type || oldAsset.region !== queryRegion || oldAsset.symbol !== querySymbol || oldAsset.name !== name)) {

                const assetsRef = collection(db, 'assets');
                const targetQ = query(assetsRef, where('type', '==', type), where('region', '==', queryRegion), where('symbol', '==', querySymbol), where('name', '==', name));
                const targetSnap = await getDocs(targetQ);

                if (targetSnap.empty) {
                    const newAssetRef = doc(collection(db, 'assets'));
                    await setDoc(newAssetRef, {
                        type,
                        region: queryRegion,
                        symbol: querySymbol,
                        name,
                        quantity: 0,
                        avgPrice: 0,
                        principal: 0,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                    newAssetId = newAssetRef.id;
                } else {
                    newAssetId = targetSnap.docs[0].id;
                }
            }
        }

        const resolvedPrice = (type === 'cash' && queryRegion === 'US' && !price) ? 1 : (price || tx.price);

        await updateDoc(txRef, {
            date: date || tx.date,
            quantity: quantity || tx.quantity,
            price: resolvedPrice,
            action: action || tx.action,
            asset_id: newAssetId
        });

        if (oldAssetId !== newAssetId) {
            await recalculateAsset(oldAssetId);
            await recalculateAsset(newAssetId);
        } else {
            await recalculateAsset(oldAssetId);
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('PUT transaction error:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}
