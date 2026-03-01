import { NextResponse } from 'next/server';
import db from '@/lib/db';

function recalculateAsset(assetId) {
    const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(assetId);
    if (!asset) return;

    // Get all transactions for this asset in chronological order
    const txs = db.prepare('SELECT * FROM transactions WHERE asset_id = ? ORDER BY date ASC, createdAt ASC').all(assetId);

    if (txs.length === 0) {
        // No transactions left, delete the asset
        db.prepare('DELETE FROM assets WHERE id = ?').run(assetId);
        return;
    }

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

    db.prepare(`
        UPDATE assets 
        SET quantity = ?, avgPrice = ?, principal = ?, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(currentQty, currentAvgPrice, currentPrincipal, assetId);
}

export async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

        const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const assetId = tx.asset_id;

        // Execute inside a transaction
        const deleteTx = db.transaction(() => {
            db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
            recalculateAsset(assetId);
        });

        deleteTx();

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

        const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!tx) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });

        const oldAssetId = tx.asset_id;
        let newAssetId = oldAssetId;

        const updateTx = db.transaction(() => {
            const querySymbol = symbol || '';
            const queryRegion = region || 'KR';

            if (type && name) {
                const oldAsset = db.prepare('SELECT * FROM assets WHERE id = ?').get(oldAssetId);

                if (oldAsset.type !== type || oldAsset.region !== queryRegion || oldAsset.symbol !== querySymbol || oldAsset.name !== name) {
                    let targetAsset = db.prepare('SELECT * FROM assets WHERE type = ? AND region = ? AND symbol = ? AND name = ?').get(type, queryRegion, querySymbol, name);
                    if (!targetAsset) {
                        const info = db.prepare(`
                            INSERT INTO assets (type, region, symbol, name, quantity, avgPrice, principal)
                            VALUES (?, ?, ?, ?, 0, 0, 0)
                        `).run(type, queryRegion, querySymbol, name);
                        newAssetId = info.lastInsertRowid;
                    } else {
                        newAssetId = targetAsset.id;
                    }
                }
            }

            const resolvedPrice = (type === 'cash' && queryRegion === 'US' && !price) ? 1 : (price || tx.price);

            db.prepare(`
                UPDATE transactions 
                SET date = ?, quantity = ?, price = ?, action = ?, asset_id = ?
                WHERE id = ?
            `).run(date || tx.date, quantity || tx.quantity, resolvedPrice, action || tx.action, newAssetId, id);

            if (oldAssetId !== newAssetId) {
                recalculateAsset(oldAssetId);
                recalculateAsset(newAssetId);
            } else {
                recalculateAsset(oldAssetId);
            }
        });

        updateTx();

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('PUT transaction error:', error);
        return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }
}
