import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore/lite';
import { default as YahooFinance } from 'yahoo-finance2';

export async function GET() {
    try {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

        // 1. Calculate current month's totals using real-time Yahoo Finance prices and current assets
        const assetsSnap = await getDocs(collection(db, 'assets'));

        let exchangeRate = 1400;
        try {
            const yf = new YahooFinance();
            const quote = await yf.quote('KRW=X');
            if (quote && quote.regularMarketPrice) {
                exchangeRate = quote.regularMarketPrice;
            }
        } catch (e) {
            console.error('Failed to fetch exchange rate for history:', e);
        }

        const balances = {
            stock: 0,
            pension: 0,
            cash: 0,
            real_estate: 0
        };

        await Promise.all(assetsSnap.docs.map(async (docSnap) => {
            const asset = docSnap.data();
            let currentPrice = asset.avgPrice || 0;

            if (asset.type === 'stock' && asset.symbol) {
                let querySymbol = asset.symbol;
                if (asset.region === 'KR' && !querySymbol.includes('.')) {
                    querySymbol = querySymbol + '.KS';
                }

                const fetchQuote = async (sym) => {
                    const yf = new YahooFinance();
                    return await yf.quote(sym);
                };

                try {
                    const quote = await fetchQuote(querySymbol);
                    if (quote && quote.regularMarketPrice) {
                        currentPrice = quote.regularMarketPrice;
                    }
                } catch (error) {
                    if (asset.region === 'KR' && querySymbol.endsWith('.KS')) {
                        try {
                            const quote = await fetchQuote(asset.symbol + '.KQ');
                            if (quote && quote.regularMarketPrice) {
                                currentPrice = quote.regularMarketPrice;
                            }
                        } catch (e) { }
                    }
                }
            } else if (asset.type === 'cash') {
                currentPrice = 1;
            }

            const value = asset.quantity * currentPrice * (asset.region === 'US' ? exchangeRate : 1);
            balances[asset.type] = (balances[asset.type] || 0) + value;
        }));

        const totalValue = (balances.stock || 0) + (balances.cash || 0) + (balances.pension || 0) + (balances.real_estate || 0);

        const currentSnapshot = {
            month: currentMonthStr,
            stockValue: balances.stock || 0,
            cashValue: balances.cash || 0,
            pensionValue: balances.pension || 0,
            realEstateValue: balances.real_estate || 0,
            totalValue: totalValue,
            updatedAt: new Date().toISOString()
        };

        // 2. Save current snapshot to Firestore's monthly_snapshots collection
        // This acts as an upsert (overwrites if exists, creates if new)
        const snapshotDocRef = doc(db, 'monthly_snapshots', currentMonthStr);
        await setDoc(snapshotDocRef, currentSnapshot);

        // 3. Fetch all snapshots to build the complete history data
        const snapshotsRef = collection(db, 'monthly_snapshots');
        const snapshotsSnap = await getDocs(snapshotsRef);

        let historyData = snapshotsSnap.docs.map(docSnap => docSnap.data());

        // sort ascending by month
        historyData.sort((a, b) => a.month.localeCompare(b.month));

        // If historyData is somehow empty, fallback to the current snapshot
        if (historyData.length === 0) {
            historyData = [currentSnapshot];
        }

        return NextResponse.json(historyData);
    } catch (error) {
        console.error('Error fetching/updating snapshots for history API:', error);
        return NextResponse.json({ error: 'Failed to calculate history' }, { status: 500 });
    }
}
