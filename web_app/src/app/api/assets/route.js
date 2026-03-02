import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, query, where, serverTimestamp } from 'firebase/firestore/lite';
import { default as YahooFinance } from 'yahoo-finance2';

export async function GET() {
    try {
        const assetsRef = collection(db, 'assets');
        const snapshot = await getDocs(assetsRef);
        const assets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Enrich stock assets with current prices
        const enrichedAssets = await Promise.all(assets.map(async (asset) => {
            let currentPrice = asset.avgPrice;
            let previousClose = asset.avgPrice;

            if (asset.type === 'stock' && asset.symbol) {
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
                        // Fallback exchange rate if fetch fails
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
                previousClose
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
        const { type, region, symbol, name, quantity, price, action, date } = body;

        if (!type || !name || quantity === undefined || price === undefined || !action || !date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const qty = parseFloat(quantity);
        const prc = parseFloat(price);

        const assetsRef = collection(db, 'assets');
        const q = query(assetsRef, where('type', '==', type), where('region', '==', region || 'KR'), where('symbol', '==', symbol || ''), where('name', '==', name));
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
            await updateDoc(assetDoc, {
                quantity: newQty,
                avgPrice: newAvgPrice,
                principal: newPrincipal,
                updatedAt: serverTimestamp()
            });
        } else {
            if (action === 'sell') {
                return NextResponse.json({ error: 'Cannot sell asset not owned' }, { status: 400 });
            }
            const newDocRef = await addDoc(assetsRef, {
                type,
                region: region || 'KR',
                symbol: symbol || '',
                name,
                quantity: newQty,
                avgPrice: newAvgPrice,
                principal: newPrincipal,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
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
            createdAt: serverTimestamp()
        });

        return NextResponse.json({ success: true, id: assetId }, { status: 201 });
    } catch (error) {
        console.error('Error handling asset POST:', error);
        return NextResponse.json({ error: 'Failed to process transaction' }, { status: 500 });
    }
}
