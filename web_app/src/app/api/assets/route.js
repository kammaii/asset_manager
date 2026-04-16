import { NextResponse } from 'next/server';
import { adminDb, FieldValue, getUserIdFromRequest } from '@/lib/firebase-admin';
import { default as YahooFinance } from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

const priceCache = {};
async function getCachedQuote(symbol) {
    if (priceCache[symbol]) return priceCache[symbol];
    const yf = new YahooFinance();
    const data = await yf.quote(symbol);
    priceCache[symbol] = data;
    return data;
}

export async function GET(request) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const assetsSnap = await adminDb.collection('users').doc(uid).collection('assets').get();
        const assets = assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Enrichment logic remains exactly the same...
        const enrichedAssets = await Promise.all(assets.map(async (asset) => {
            let currentPrice = asset.avgPrice;
            let previousClose = asset.avgPrice;

            if ((asset.type === 'stock' || asset.type === 'pension') && asset.symbol) {
                let querySymbol = asset.symbol;
                if (asset.region === 'KR' && !querySymbol.includes('.')) {
                    querySymbol = querySymbol + '.KS'; // default to KOSPI
                }

                try {
                    const quote = await getCachedQuote(querySymbol);
                    if (quote && quote.regularMarketPrice) {
                        currentPrice = quote.regularMarketPrice;
                        previousClose = quote.regularMarketPreviousClose || currentPrice;
                    }
                } catch (error) {
                    console.error(`Failed to fetch price for ${querySymbol}:`, error.message);
                    // Try KOSDAQ if KOSPI failed
                    if (asset.region === 'KR' && querySymbol.endsWith('.KS')) {
                        try {
                            const quote = await getCachedQuote(asset.symbol + '.KQ');
                            if (quote && quote.regularMarketPrice) {
                                currentPrice = quote.regularMarketPrice;
                                previousClose = quote.regularMarketPreviousClose || currentPrice;
                            }
                        } catch (e) {
                            console.error(`Failed alternate fetch for ${asset.symbol}.KQ:`, e.message);
                        }
                    }
                }
            } else if (asset.type === 'crypto' && asset.symbol) {
                let querySymbol = asset.symbol;
                if (!querySymbol.includes('-') && !querySymbol.includes('=')) {
                    querySymbol = querySymbol + (asset.region === 'US' ? '-USD' : '-KRW');
                }

                try {
                    const quote = await getCachedQuote(querySymbol);
                    if (quote && quote.regularMarketPrice) {
                        currentPrice = quote.regularMarketPrice;
                        previousClose = quote.regularMarketPreviousClose || currentPrice;
                    }
                } catch (error) {
                    console.error(`Failed to fetch crypto price for ${querySymbol}:`, error.message);
                    if (asset.region !== 'US' && querySymbol.endsWith('-KRW')) {
                        try {
                            const fallbackQuery = asset.symbol + '-USD';
                            const [quote, krwQuote] = await Promise.all([
                                getCachedQuote(fallbackQuery),
                                getCachedQuote('KRW=X')
                            ]);
                            if (quote && quote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
                                currentPrice = quote.regularMarketPrice * krwQuote.regularMarketPrice;
                                previousClose = (quote.regularMarketPreviousClose || quote.regularMarketPrice) * (krwQuote.regularMarketPreviousClose || krwQuote.regularMarketPrice);
                            }
                        } catch (e) { }
                    }
                }
            } else if (asset.type === 'real_estate') {
                const expense = asset.expense || 0;
                const deposit = asset.deposit || 0;
                const buyPrice = asset.principal; // Purchase price

                currentPrice = asset.realEstateCurrentPrice || asset.avgPrice;
                previousClose = currentPrice;

                const netInvestment = buyPrice + expense - deposit;
                const profitGain = currentPrice - buyPrice - expense;
                const totalValue = netInvestment + profitGain;
                const profitRate = netInvestment > 0 ? (profitGain / netInvestment) * 100 : 0;

                return {
                    ...asset,
                    currentPrice,
                    totalValue,
                    profitGain,
                    profitRate,
                    dayChange: 0,
                    previousClose,
                    netInvestment,
                    expense,
                    deposit,
                    investmentCountry: asset.investmentCountry || asset.region || 'KR'
                };
            } else if (asset.type === 'gold') {
                try {
                    const [goldQuote, krwQuote] = await Promise.all([
                        getCachedQuote('GC=F'),
                        getCachedQuote('KRW=X')
                    ]);

                    if (goldQuote && goldQuote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
                        const pricePerOz = goldQuote.regularMarketPrice;
                        const exchangeRate = krwQuote.regularMarketPrice;
                        const pricePerDon = (pricePerOz * exchangeRate) / 8.29426;
                        currentPrice = pricePerDon;
                        previousClose = (goldQuote.regularMarketPreviousClose * krwQuote.regularMarketPreviousClose) / 8.29426 || currentPrice;
                    }
                } catch (error) {
                    console.error('Failed to fetch gold price:', error.message);
                    currentPrice = asset.goldCurrentPrice || asset.avgPrice;
                    previousClose = currentPrice;
                }
            } else if (asset.type === 'cash') {
                if (asset.region === 'US') {
                    try {
                        const quote = await getCachedQuote('KRW=X');
                        if (quote && quote.regularMarketPrice) {
                            currentPrice = quote.regularMarketPrice;
                            previousClose = quote.regularMarketPreviousClose || currentPrice;
                        }
                    } catch (error) {
                        console.error('Failed to fetch KRW=X exchange rate:', error.message);
                        currentPrice = 1400;
                        previousClose = 1400;
                    }
                } else {
                    currentPrice = 1;
                    previousClose = 1;
                }
            }

            const totalValue = currentPrice * asset.quantity;
            const profitGain = totalValue - asset.principal;
            const profitRate = asset.principal > 0 ? (profitGain / asset.principal) * 100 : 0;
            const dayChange = (currentPrice - previousClose) * asset.quantity;

            return {
                ...asset,
                currentPrice,
                totalValue,
                profitGain,
                profitRate,
                dayChange,
                previousClose,
                investmentCountry: asset.investmentCountry || asset.region || 'KR'
            };
        }));

        // 수량이 0인 자산 필터링 (보유하지 않은 자산 제외)
        const activeAssets = enrichedAssets.filter(asset => asset.quantity > 0);

        return NextResponse.json(activeAssets);
    } catch (error) {
        console.error('Error fetching assets:', error);
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { type, region, symbol, name, quantity, price, action, date, account, expense, deposit, realEstateCurrentPrice, goldCurrentPrice, investmentCountry, linkedCashAssetId, exchangeRate } = body;

        if (!type || !name || quantity === undefined || price === undefined || !action || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        const prc = parseFloat(price);

        const assetsCol = adminDb.collection('users').doc(uid).collection('assets');
        const trxCol = adminDb.collection('users').doc(uid).collection('transactions');

        let assetQuery = assetsCol
            .where('type', '==', type)
            .where('region', '==', region || 'KR')
            .where('name', '==', name);
        if (type === 'stock' || type === 'pension') {
            assetQuery = assetQuery
                .where('account', '==', account || '일반')
                .where('symbol', '==', symbol || '');
            if (investmentCountry) {
                assetQuery = assetQuery.where('investmentCountry', '==', investmentCountry);
            }
        }
        const snapshot = await assetQuery.get();

        let asset = null;
        if (!snapshot.empty) {
            asset = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }

        let newQty = qty;
        let newPrincipal = qty * prc;
        let newAvgPrice = prc;
        let assetId = asset ? asset.id : null;

        if (asset) {
            if (action === 'buy') {
                newQty = asset.quantity + qty;
                newPrincipal = asset.principal + (qty * prc);
                newAvgPrice = newQty > 0 ? newPrincipal / newQty : 0;
            } else if (action === 'sell') {
                newQty = asset.quantity - qty;
                if (newQty < 0) return NextResponse.json({ error: 'Cannot sell more than owned' }, { status: 400 });

                const proportion = asset.quantity > 0 ? newQty / asset.quantity : 0;
                newPrincipal = asset.principal * proportion;
                newAvgPrice = asset.avgPrice; // Avg price doesn't change on sell
            }

            const updateData = {
                quantity: newQty,
                avgPrice: newAvgPrice,
                principal: newPrincipal,
                updatedAt: FieldValue.serverTimestamp()
            };
            if (investmentCountry !== undefined) updateData.investmentCountry = investmentCountry;
            if (type === 'real_estate') {
                if (expense !== undefined) updateData.expense = parseFloat(expense) || 0;
                if (deposit !== undefined) updateData.deposit = parseFloat(deposit) || 0;
                if (realEstateCurrentPrice !== undefined) updateData.realEstateCurrentPrice = parseFloat(realEstateCurrentPrice) || 0;
            } else if (type === 'gold') {
                if (goldCurrentPrice !== undefined) updateData.goldCurrentPrice = parseFloat(goldCurrentPrice) || 0;
            }
            await assetsCol.doc(asset.id).update(updateData);
        } else {
            if (action === 'sell') {
                return NextResponse.json({ error: 'Cannot sell asset not owned' }, { status: 400 });
            }
            const newAssetData = {
                type,
                region: region || 'KR',
                investmentCountry: investmentCountry || region || 'KR',
                account: account || '일반',
                symbol: symbol || '',
                name,
                quantity: newQty,
                avgPrice: newAvgPrice,
                principal: newPrincipal,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };
            if (type === 'real_estate') {
                newAssetData.expense = expense ? parseFloat(expense) : 0;
                newAssetData.deposit = deposit ? parseFloat(deposit) : 0;
                newAssetData.realEstateCurrentPrice = realEstateCurrentPrice ? parseFloat(realEstateCurrentPrice) : newAvgPrice;
            } else if (type === 'gold') {
                newAssetData.goldCurrentPrice = goldCurrentPrice ? parseFloat(goldCurrentPrice) : newAvgPrice;
            }
            const newDocRef = assetsCol.doc();
            await newDocRef.set(newAssetData);
            assetId = newDocRef.id;
        }

        // Insert transaction record with denormalized asset info
        const mainTxRef = trxCol.doc();
        await mainTxRef.set({
            asset_id: assetId,
            action,
            date,
            quantity: qty,
            price: prc,
            region: region || 'KR',
            investmentCountry: investmentCountry || region || 'KR',
            type,
            name,
            symbol: symbol || '',
            account: account || '일반',
            createdAt: FieldValue.serverTimestamp()
        });

        // 3. Handle Linked Cash Asset if provided
        if (linkedCashAssetId) {
            try {
                const cashDocRef = assetsCol.doc(linkedCashAssetId);
                const cashSnapshot = await cashDocRef.get();

                if (cashSnapshot.exists && cashSnapshot.data().type === 'cash') {
                    const cashAsset = { id: cashSnapshot.id, ...cashSnapshot.data() };

                    let totalCost = type === 'real_estate'
                        ? (prc * qty) + (parseFloat(expense) || 0) - (parseFloat(deposit) || 0)
                        : qty * prc;

                    if (region === 'US') {
                        const rate = parseFloat(exchangeRate) || 1400;
                        totalCost = totalCost * rate;
                    }

                    let newCashQty = cashAsset.quantity;
                    const cashAction = action === 'buy' ? 'sell' : 'buy';

                    if (action === 'buy') {
                        newCashQty = cashAsset.quantity - totalCost;
                    } else if (action === 'sell') {
                        newCashQty = cashAsset.quantity + totalCost;
                    }

                    await cashDocRef.update({
                        quantity: newCashQty,
                        principal: newCashQty * (cashAsset.avgPrice || 1),
                        updatedAt: FieldValue.serverTimestamp()
                    });

                    // 현금 거래 추가 후 ID를 원본 거래에 저장
                    const cashTxRef = trxCol.doc();
                    await cashTxRef.set({
                        asset_id: cashAsset.id,
                        action: cashAction,
                        date,
                        quantity: totalCost,
                        price: 1,
                        region: cashAsset.region,
                        investmentCountry: cashAsset.investmentCountry || cashAsset.region,
                        type: 'cash',
                        name: cashAsset.name,
                        symbol: cashAsset.symbol || cashAsset.name,
                        account: cashAsset.account || '일반',
                        memo: '자동 연동',
                        createdAt: FieldValue.serverTimestamp()
                    });

                    // 원본 거래에 연동된 현금 거래 ID 저장 (삭제 시 역추적용)
                    await mainTxRef.update({ linkedCashTxId: cashTxRef.id });
                }
            } catch (cashError) {
                console.error("Failed to update linked cash asset:", cashError);
            }
        }

        return NextResponse.json({ success: true, id: assetId }, { status: 201 });
    } catch (error) {
        console.error('Error handling asset POST:', error);
        return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
    }
}
