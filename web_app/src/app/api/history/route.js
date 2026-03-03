import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc } from 'firebase/firestore/lite';
import { default as YahooFinance } from 'yahoo-finance2';

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'monthly';

        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const currentDay = currentDate.getDate();
        const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const currentDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

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
            if (asset.type === 'real_estate') {
                const currentPrice = asset.realEstateCurrentPrice || asset.avgPrice || 0;
                const value = (currentPrice - (asset.deposit || 0)) * (asset.region === 'US' ? exchangeRate : 1);
                balances['real_estate'] = (balances['real_estate'] || 0) + value;
                return;
            }

            let currentPrice = asset.avgPrice || 0;

            if ((asset.type === 'stock' || asset.type === 'pension') && asset.symbol) {
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

        const currentBaseSnapshot = {
            stockValue: balances.stock || 0,
            cashValue: balances.cash || 0,
            pensionValue: balances.pension || 0,
            realEstateValue: balances.real_estate || 0,
            totalValue: totalValue,
            updatedAt: new Date().toISOString()
        };

        const currentMonthlySnapshot = { ...currentBaseSnapshot, month: currentMonthStr };
        const currentDailySnapshot = { ...currentBaseSnapshot, date: currentDayStr };

        // 2. Save current snapshot to Firestore (Upsert)
        await setDoc(doc(db, 'monthly_snapshots', currentMonthStr), currentMonthlySnapshot);
        await setDoc(doc(db, 'daily_snapshots', currentDayStr), currentDailySnapshot);

        // 3. Fetch snapshots and backfill if necessary
        if (type === 'daily') {
            const snapshotsSnap = await getDocs(collection(db, 'daily_snapshots'));
            let data = snapshotsSnap.docs.map(docSnap => docSnap.data());
            data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            if (data.length === 0) {
                return NextResponse.json([currentDailySnapshot]);
            }

            // Backfill missing days
            const backfilled = [];
            const startDate = new Date(data[0].date);
            startDate.setHours(12, 0, 0, 0); // Avoid timezone issues
            const endDate = new Date(currentDate);
            endDate.setHours(12, 0, 0, 0);

            let dataIdx = 0;
            let lastSnap = data[0];

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dYear = d.getFullYear();
                const dMonth = String(d.getMonth() + 1).padStart(2, '0');
                const dDay = String(d.getDate()).padStart(2, '0');
                const dateStr = `${dYear}-${dMonth}-${dDay}`;

                // Fast-forward lastSnap to the latest available snapshot on or before dateStr
                while (dataIdx < data.length && data[dataIdx].date < dateStr) {
                    lastSnap = data[dataIdx];
                    dataIdx++;
                }

                if (dataIdx < data.length && data[dataIdx].date === dateStr) {
                    lastSnap = data[dataIdx];
                    dataIdx++;
                }

                backfilled.push({ ...lastSnap, date: dateStr });
            }

            return NextResponse.json(backfilled);
        } else {
            const snapshotsSnap = await getDocs(collection(db, 'monthly_snapshots'));
            let historyData = snapshotsSnap.docs.map(docSnap => docSnap.data());
            historyData.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

            if (historyData.length === 0) {
                historyData = [currentMonthlySnapshot];
            }
            return NextResponse.json(historyData);
        }
    } catch (error) {
        console.error('Error fetching/updating snapshots for history API:', error);
        return NextResponse.json({ error: 'Failed to calculate history' }, { status: 500 });
    }
}
