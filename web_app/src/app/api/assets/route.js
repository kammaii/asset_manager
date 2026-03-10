import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore/lite';
import { default as YahooFinance } from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const assetsRef = collection(db, 'assets');
        const snapshot = await getDocs(assetsRef);
        const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich stock assets with current prices
        const enrichedAssets = await Promise.all(assets.map(async (asset) => {
            let currentPrice = asset.avgPrice;
            let previousClose = asset.avgPrice;

            if ((asset.type === 'stock' || asset.type === 'pension') && asset.symbol) {
                let querySymbol = asset.symbol;
                if (asset.region === 'KR' && !querySymbol.includes('.')) {
                    querySymbol = querySymbol + '.KS'; // default to KOSPI
                }

                const fetchQuote = async (sym) => {
                    const yf = new YahooFinance();
                    return await yf.quote(sym);
                };

                try {
                    const quote = await fetchQuote(querySymbol);
                    if (quote && quote.regularMarketPrice) {
                        currentPrice = quote.regularMarketPrice;
                        previousClose = quote.regularMarketPreviousClose || currentPrice;
                    }
                } catch (error) {
                    console.error(`Failed to fetch price for ${querySymbol}:`, error.message);
                    // Try KOSDAQ if KOSPI failed
                    if (asset.region === 'KR' && querySymbol.endsWith('.KS')) {
                        try {
                            const quote = await fetchQuote(asset.symbol + '.KQ');
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
                const fetchQuote = async (sym) => {
                    const yf = new YahooFinance();
                    return await yf.quote(sym);
                };
                try {
                    const quote = await fetchQuote(querySymbol);
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
                                fetchQuote(fallbackQuery),
                                fetchQuote('KRW=X')
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
                const fetchQuote = async (sym) => {
                    const yf = new YahooFinance();
                    return await yf.quote(sym);
                };

                try {
                    // 'GC=F' is Gold Futures on Yahoo Finance (1 oz). 
                    // 1 oz = 28.3495g. 1 don = 3.75g.
                    // 1 oz = 28.3495 / 3.75 = 7.5598 don.
                    // Price per don = (GC price * exchangeRate) / 7.5598
                    const [goldQuote, krwQuote] = await Promise.all([
                        fetchQuote('GC=F'),
                        fetchQuote('KRW=X')
                    ]);

                    if (goldQuote && goldQuote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
                        const pricePerOz = goldQuote.regularMarketPrice;
                        const exchangeRate = krwQuote.regularMarketPrice;
                        const pricePerDon = (pricePerOz * exchangeRate) / 7.55986;
                        currentPrice = pricePerDon;
                        previousClose = (goldQuote.regularMarketPreviousClose * krwQuote.regularMarketPreviousClose) / 7.55986 || currentPrice;
                    }
                } catch (error) {
                    console.error('Failed to fetch gold price:', error.message);
                    currentPrice = asset.goldCurrentPrice || asset.avgPrice;
                    previousClose = currentPrice;
                }
            } else if (asset.type === 'cash') {
                if (asset.region === 'US') {
                    const fetchQuote = async (sym) => {
                        const yf = new YahooFinance();
                        return await yf.quote(sym);
                    };

                    try {
                        const quote = await fetchQuote('KRW=X');
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

        return NextResponse.json(enrichedAssets);
    } catch (error) {
        console.error('Error fetching assets:', error);
        return NextResponse.json({ error: 'Failed to fetch assets' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { type, region, symbol, name, quantity, price, action, date, account, expense, deposit, realEstateCurrentPrice, goldCurrentPrice, investmentCountry } = body;

        if (!type || !name || quantity === undefined || price === undefined || !action || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        const prc = parseFloat(price);

        const assetsRef = collection(db, 'assets');
        const queryConstraints = [
            where('type', '==', type),
            where('region', '==', region || 'KR'),
            where('name', '==', name),
        ];
        // 현금과 부동산은 account, symbol 등을 제외하고 이름 단위로 기존 자산을 매칭함
        if (type === 'stock' || type === 'pension') {
            queryConstraints.push(where('account', '==', account || '일반'));
            queryConstraints.push(where('symbol', '==', symbol || ''));
            if (investmentCountry) {
                queryConstraints.push(where('investmentCountry', '==', investmentCountry));
            }
        }
        const q = query(assetsRef, ...queryConstraints);
        const snapshot = await getDocs(q);

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

            const assetDoc = doc(db, 'assets', asset.id);
            const updateData = {
                quantity: newQty,
                avgPrice: newAvgPrice,
                principal: newPrincipal,
                updatedAt: serverTimestamp()
            };
            if (investmentCountry !== undefined) updateData.investmentCountry = investmentCountry;
            if (type === 'real_estate') {
                if (expense !== undefined) updateData.expense = parseFloat(expense) || 0;
                if (deposit !== undefined) updateData.deposit = parseFloat(deposit) || 0;
                if (realEstateCurrentPrice !== undefined) updateData.realEstateCurrentPrice = parseFloat(realEstateCurrentPrice) || 0;
            } else if (type === 'gold') {
                if (goldCurrentPrice !== undefined) updateData.goldCurrentPrice = parseFloat(goldCurrentPrice) || 0;
            }
            await updateDoc(assetDoc, updateData);
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
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            if (type === 'real_estate') {
                newAssetData.expense = expense ? parseFloat(expense) : 0;
                newAssetData.deposit = deposit ? parseFloat(deposit) : 0;
                newAssetData.realEstateCurrentPrice = realEstateCurrentPrice ? parseFloat(realEstateCurrentPrice) : newAvgPrice;
            } else if (type === 'gold') {
                newAssetData.goldCurrentPrice = goldCurrentPrice ? parseFloat(goldCurrentPrice) : newAvgPrice;
            }
            const newDocRef = await addDoc(assetsRef, newAssetData);
            assetId = newDocRef.id;
        }

        // Insert transaction record
        const trxRef = collection(db, 'transactions');
        await addDoc(trxRef, {
            asset_id: assetId,
            action,
            date,
            quantity: qty,
            price: prc,
            region: region || 'KR',
            investmentCountry: investmentCountry || region || 'KR',
            createdAt: serverTimestamp()
        });

        return NextResponse.json({ success: true, id: assetId }, { status: 201 });
    } catch (error) {
        console.error('Error handling asset POST:', error);
        return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
    }
}
