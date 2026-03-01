import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
    try {
        // Fetch all transactions with asset type
        const txs = db.prepare(`
            SELECT t.date, t.action, t.quantity, t.price, a.type 
            FROM transactions t
            JOIN assets a ON t.asset_id = a.id
            ORDER BY t.date ASC
        `).all();

        if (txs.length === 0) {
            return NextResponse.json([]);
        }

        // Determine date range (from earliest tx to current month)
        const firstTxDate = new Date(txs[0].date);
        const currentDate = new Date();

        let startYear = firstTxDate.getFullYear();
        let startMonth = firstTxDate.getMonth() + 1;
        const endYear = currentDate.getFullYear();
        const endMonth = currentDate.getMonth() + 1;

        const historyData = [];

        // Running totals
        const balances = {
            stock: 0,
            pension: 0,
            cash: 0,
            real_estate: 0
        };

        let txIndex = 0;

        while (startYear < endYear || (startYear === endYear && startMonth <= endMonth)) {
            const currentMonthStr = `${startYear}-${String(startMonth).padStart(2, '0')}`;
            // End of the current iterative month
            const nextMonthYear = startMonth === 12 ? startYear + 1 : startYear;
            const nextMonth = startMonth === 12 ? 1 : startMonth + 1;
            // The string to compare dates against (all txs before the 1st of next month)
            const cutoffDateStr = `${nextMonthYear}-${String(nextMonth).padStart(2, '0')}-01`;

            // Process all transactions up to the end of this month
            while (txIndex < txs.length && txs[txIndex].date < cutoffDateStr) {
                const tx = txs[txIndex];
                const value = tx.quantity * tx.price;
                if (tx.action === 'buy') {
                    balances[tx.type] += value;
                } else if (tx.action === 'sell') {
                    balances[tx.type] -= value;
                }
                txIndex++;
            }

            historyData.push({
                month: currentMonthStr,
                stockValue: balances.stock > 0 ? balances.stock : 0,
                cashValue: balances.cash > 0 ? balances.cash : 0,
                pensionValue: balances.pension > 0 ? balances.pension : 0,
                realEstateValue: balances.real_estate > 0 ? balances.real_estate : 0,
                totalValue: Math.max(0, balances.stock) + Math.max(0, balances.cash) + Math.max(0, balances.pension) + Math.max(0, balances.real_estate)
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

