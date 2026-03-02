import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore/lite';

export async function GET() {
    try {
        const [assetsSnap, txsSnap] = await Promise.all([
            getDocs(collection(db, 'assets')),
            getDocs(collection(db, 'transactions'))
        ]);

        const assetsMap = {};
        assetsSnap.forEach(doc => {
            assetsMap[doc.id] = doc.data();
        });

        const txs = txsSnap.docs.map(doc => {
            const data = doc.data();
            const assetType = assetsMap[data.asset_id]?.type || 'unknown';
            return {
                date: data.date,
                action: data.action,
                quantity: data.quantity,
                price: data.price,
                type: assetType
            };
        });

        // sort ascending by date
        txs.sort((a, b) => new Date(a.date) - new Date(b.date));

        if (txs.length === 0) {
            return NextResponse.json([]);
        }

        const firstTxDate = new Date(txs[0].date);
        const currentDate = new Date();

        let startYear = firstTxDate.getFullYear();
        let startMonth = firstTxDate.getMonth() + 1;
        const endYear = currentDate.getFullYear();
        const endMonth = currentDate.getMonth() + 1;

        const historyData = [];

        const balances = {
            stock: 0,
            pension: 0,
            cash: 0,
            real_estate: 0
        };

        let txIndex = 0;

        while (startYear < endYear || (startYear === endYear && startMonth <= endMonth)) {
            const currentMonthStr = `${startYear}-${String(startMonth).padStart(2, '0')}`;
            const nextMonthYear = startMonth === 12 ? startYear + 1 : startYear;
            const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
            const cutoffDateStr = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

            while (txIndex < txs.length && txs[txIndex].date < cutoffDateStr) {
                const tx = txs[txIndex];
                const value = tx.quantity * tx.price;
                if (tx.action === 'buy') {
                    balances[tx.type] = (balances[tx.type] || 0) + value;
                } else if (tx.action === 'sell') {
                    balances[tx.type] = (balances[tx.type] || 0) - value;
                }
                txIndex++;
            }

            historyData.push({
                month: currentMonthStr,
                stockValue: balances.stock > 0 ? balances.stock : 0,
                cashValue: balances.cash > 0 ? balances.cash : 0,
                pensionValue: balances.pension > 0 ? balances.pension : 0,
                realEstateValue: balances.real_estate > 0 ? balances.real_estate : 0,
                totalValue: Math.max(0, balances.stock || 0) + Math.max(0, balances.cash || 0) + Math.max(0, balances.pension || 0) + Math.max(0, balances.real_estate || 0)
            });

            startMonth++;
            if (startMonth > 12) {
                startMonth = 1;
                startYear++;
            }
        }

        return NextResponse.json(historyData);
    } catch (error) {
        console.error('Error calculating dynamic history:', error);
        return NextResponse.json({ error: 'Failed to calculate history' }, { status: 500 });
    }
}
