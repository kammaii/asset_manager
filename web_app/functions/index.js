import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";
import yahooFinance from "yahoo-finance2";

admin.initializeApp();
const db = admin.firestore();

// In-memory cache for Yahoo Finance API responses to share across iterations during a single execution
let priceCache = {};
const getCachedQuote = async (symbol) => {
    if (priceCache[symbol]) {
        return priceCache[symbol];
    }
    const data = await yahooFinance.quote(symbol);
    priceCache[symbol] = data;
    return data;
};

export const takeDailySnapshot = onSchedule({
    schedule: "0 0 * * *", // Run at midnight every day
    timeZone: "Asia/Seoul",
    memory: "256MiB",
    timeoutSeconds: 300 // Allow up to 5 minutes to fetch external prices
}, async (event) => {
    try {
        console.log("Starting daily asset snapshot...");

        const currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        const currentDay = currentDate.getDate();
        const currentMonthStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const currentDayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;

        const assetsSnap = await db.collection('assets').get();

        let exchangeRate = 1400;
        try {
            const quote = await getCachedQuote('KRW=X');
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
            real_estate: 0,
            gold: 0,
            crypto: 0,
            car: 0
        };

        const batchSize = 10;
        const docs = assetsSnap.docs;

        // Process sequentially in small chunks to avoid rate limiting
        for (let i = 0; i < docs.length; i += batchSize) {
            const chunk = docs.slice(i, i + batchSize);
            await Promise.all(chunk.map(async (docSnap) => {
                const asset = docSnap.data();
                if (asset.type === 'real_estate') {
                    const currentPrice = asset.realEstateCurrentPrice || asset.avgPrice || 0;
                    const value = (currentPrice - (asset.deposit || 0)) * (asset.region === 'US' ? exchangeRate : 1);
                    balances['real_estate'] += value;
                    return;
                } else if (asset.type === 'gold') {
                    try {
                        const [goldQuote, krwQuote] = await Promise.all([
                            getCachedQuote('GC=F'),
                            getCachedQuote('KRW=X')
                        ]);
                        if (goldQuote && goldQuote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
                            const pricePerOz = goldQuote.regularMarketPrice;
                            const exchangeRateVal = krwQuote.regularMarketPrice;
                            const pricePerDon = (pricePerOz * exchangeRateVal) / 8.29426;
                            const value = asset.quantity * pricePerDon * (asset.region === 'US' ? exchangeRate : 1);
                            balances['gold'] += value;
                        } else {
                            const currentPrice = asset.goldCurrentPrice || asset.avgPrice || 0;
                            const value = asset.quantity * currentPrice * (asset.region === 'US' ? exchangeRate : 1);
                            balances['gold'] += value;
                        }
                    } catch (e) {
                        const currentPrice = asset.goldCurrentPrice || asset.avgPrice || 0;
                        const value = asset.quantity * currentPrice * (asset.region === 'US' ? exchangeRate : 1);
                        balances['gold'] += value;
                    }
                    return;
                } else if (asset.type === 'car') {
                    const currentPrice = asset.avgPrice || 0;
                    const value = asset.quantity * currentPrice * (asset.region === 'US' ? exchangeRate : 1);
                    balances['car'] += value;
                    return;
                }

                let currentPrice = asset.avgPrice || 0;

                if ((asset.type === 'stock' || asset.type === 'pension' || asset.type === 'crypto') && asset.symbol) {
                    let querySymbol = asset.symbol;
                    if (asset.type === 'crypto') {
                        if (!querySymbol.includes('-') && !querySymbol.includes('=')) {
                            querySymbol = querySymbol + (asset.region === 'US' ? '-USD' : '-KRW');
                        }
                    } else if (asset.region === 'KR' && !querySymbol.includes('.')) {
                        querySymbol = querySymbol + '.KS';
                    }

                    try {
                        const quote = await getCachedQuote(querySymbol);
                        if (quote && quote.regularMarketPrice) {
                            currentPrice = quote.regularMarketPrice;
                        }
                    } catch (error) {
                        if (asset.region === 'KR' && querySymbol.endsWith('.KS')) {
                            try {
                                const quote = await getCachedQuote(asset.symbol + '.KQ');
                                if (quote && quote.regularMarketPrice) {
                                    currentPrice = quote.regularMarketPrice;
                                }
                            } catch (e) { }
                        } else if (asset.type === 'crypto' && asset.region !== 'US' && querySymbol.endsWith('-KRW')) {
                            try {
                                const fallbackQuery = asset.symbol + '-USD';
                                const [quote, krwQuote] = await Promise.all([
                                    getCachedQuote(fallbackQuery),
                                    getCachedQuote('KRW=X')
                                ]);
                                if (quote && quote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
                                    currentPrice = quote.regularMarketPrice * krwQuote.regularMarketPrice;
                                }
                            } catch (e) { }
                        }
                    }
                } else if (asset.type === 'cash') {
                    currentPrice = 1;
                    if (asset.region === 'US') {
                        try {
                            const quote = await getCachedQuote('KRW=X');
                            if (quote && quote.regularMarketPrice) {
                                currentPrice = quote.regularMarketPrice;
                            }
                        } catch (e) { }
                    }
                }

                const value = asset.quantity * currentPrice * (asset.region === 'US' && asset.type !== 'cash' ? exchangeRate : 1);
                balances[asset.type] += value;
            }));
        }

        const totalValue = Object.values(balances).reduce((sum, val) => sum + (val || 0), 0);

        const currentBaseSnapshot = {
            stockValue: balances.stock || 0,
            cashValue: balances.cash || 0,
            pensionValue: balances.pension || 0,
            realEstateValue: balances.real_estate || 0,
            goldValue: balances.gold || 0,
            cryptoValue: balances.crypto || 0,
            carValue: balances.car || 0,
            totalValue: totalValue,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const currentMonthlySnapshot = { ...currentBaseSnapshot, month: currentMonthStr };
        const currentDailySnapshot = { ...currentBaseSnapshot, date: currentDayStr };

        await db.collection('monthly_snapshots').doc(currentMonthStr).set(currentMonthlySnapshot, { merge: true });
        await db.collection('daily_snapshots').doc(currentDayStr).set(currentDailySnapshot, { merge: true });

        console.log(`Successfully completed daily snapshot for ${currentDayStr}`);
    } catch (error) {
        console.error('Error recording daily snapshot:', error);
    }
});
