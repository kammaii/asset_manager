import { NextResponse } from 'next/server';
import { adminDb, FieldValue, getUserIdFromRequest } from '@/lib/firebase-admin';

async function recalculateAsset(uid, assetId) {
    const assetRef = adminDb.collection('users').doc(uid).collection('assets').doc(assetId);
    const assetSnap = await assetRef.get();
    if (!assetSnap.exists) return;

    const txsSnap = await adminDb
        .collection('users')
        .doc(uid)
        .collection('transactions')
        .where('asset_id', '==', assetId)
        .get();

    if (txsSnap.empty) {
        await assetRef.delete();
        return;
    }

    const txs = txsSnap.docs.map((d) => d.data());
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
            if (currentQty < 0) currentQty = 0;

            const proportion = (currentQty + sellQty) > 0 ? currentQty / (currentQty + sellQty) : 0;
            currentPrincipal = currentPrincipal * proportion;
        }
    }

    await assetRef.update({
        quantity: currentQty,
        avgPrice: currentAvgPrice,
        principal: currentPrincipal,
        updatedAt: FieldValue.serverTimestamp()
    });
}

export async function DELETE(request, { params }) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const txRef = adminDb.collection('users').doc(uid).collection('transactions').doc(id);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const { asset_id: assetId, linkedCashTxId } = txSnap.data();

        await txRef.delete();

        // 연동 현금 거래가 있으면 함께 삭제 후 현금 자산 재계산
        if (linkedCashTxId) {
            const cashTxRef = adminDb.collection('users').doc(uid).collection('transactions').doc(linkedCashTxId);
            const cashTxSnap = await cashTxRef.get();
            if (cashTxSnap.exists) {
                const cashAssetId = cashTxSnap.data().asset_id;
                await cashTxRef.delete();
                await recalculateAsset(uid, cashAssetId);
            }
        }

        await recalculateAsset(uid, assetId);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('DELETE transaction error:', error);
        return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
    }
}

export async function PUT(request, { params }) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const body = await request.json();
        const { date, quantity, price, action, type, region, symbol, name, account, expense, deposit, realEstateCurrentPrice, investmentCountry, interestRate } = body;

        const assetsCol = adminDb.collection('users').doc(uid).collection('assets');
        const txRef = adminDb.collection('users').doc(uid).collection('transactions').doc(id);
        const txSnap = await txRef.get();
        if (!txSnap.exists) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const tx = txSnap.data();
        const oldAssetId = tx.asset_id;
        let newAssetId = oldAssetId;

        const querySymbol = symbol || '';
        const queryRegion = region || 'KR';
        const queryInvestmentCountry = investmentCountry || region || 'KR';

        if (type && name) {
            const oldAssetSnap = await assetsCol.doc(oldAssetId).get();
            const oldAsset = oldAssetSnap.data();

            if (oldAsset && (oldAsset.type !== type || oldAsset.region !== queryRegion || oldAsset.symbol !== querySymbol || oldAsset.name !== name || oldAsset.account !== (account || '일반') || oldAsset.investmentCountry !== queryInvestmentCountry)) {

                let targetQ = assetsCol
                    .where('type', '==', type)
                    .where('region', '==', queryRegion)
                    .where('symbol', '==', querySymbol)
                    .where('name', '==', name)
                    .where('account', '==', account || '일반');
                if (investmentCountry) targetQ = targetQ.where('investmentCountry', '==', queryInvestmentCountry);

                const targetSnap = await targetQ.get();

                if (targetSnap.empty) {
                    const newDocRef = assetsCol.doc();
                    await newDocRef.set({
                        type,
                        region: queryRegion,
                        investmentCountry: queryInvestmentCountry,
                        account: account || '일반',
                        symbol: querySymbol,
                        name,
                        quantity: 0,
                        avgPrice: 0,
                        principal: 0,
                        createdAt: FieldValue.serverTimestamp(),
                        updatedAt: FieldValue.serverTimestamp()
                    });
                    newAssetId = newDocRef.id;
                } else {
                    newAssetId = targetSnap.docs[0].id;
                }
            }
        }

        const resolvedPrice = (type === 'cash' && queryRegion === 'US' && !price) ? 1 : (price || tx.price);

        const txUpdateData = {
            date: date || tx.date,
            quantity: quantity || tx.quantity,
            price: resolvedPrice,
            action: action || tx.action,
            asset_id: newAssetId,
            region: queryRegion,
            investmentCountry: queryInvestmentCountry,
            type: type || tx.type,
            name: name || tx.name,
            symbol: querySymbol,
            account: account || tx.account || '일반'
        };

        if (type === 'liability' && interestRate !== undefined) {
            txUpdateData.interestRate = parseFloat(interestRate) || 0;
        }

        await txRef.update(txUpdateData);

        if (oldAssetId !== newAssetId) {
            await recalculateAsset(uid, oldAssetId);
            await recalculateAsset(uid, newAssetId);
        } else {
            await recalculateAsset(uid, oldAssetId);
        }

        if (type === 'real_estate') {
            await assetsCol.doc(newAssetId).update({
                expense: parseFloat(expense) || 0,
                deposit: parseFloat(deposit) || 0,
                realEstateCurrentPrice: parseFloat(realEstateCurrentPrice) || 0,
            });
        } else if (type === 'liability') {
            await assetsCol.doc(newAssetId).update({
                interestRate: parseFloat(interestRate) || 0,
            });
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('PUT transaction error:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}
