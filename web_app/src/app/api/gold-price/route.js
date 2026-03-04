import { NextResponse } from 'next/server';
import { default as YahooFinance } from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const yf = new YahooFinance();

        // 'GC=F' is Gold Futures on Yahoo Finance (1 oz). 
        // 1 oz = 31.1034768g. 1 don = 3.75g.
        // 1 oz = 31.1034768 / 3.75 = 8.29426 don.
        const [goldQuote, krwQuote] = await Promise.all([
            yf.quote('GC=F'),
            yf.quote('KRW=X')
        ]);

        if (goldQuote && goldQuote.regularMarketPrice && krwQuote && krwQuote.regularMarketPrice) {
            const pricePerOz = goldQuote.regularMarketPrice;
            const exchangeRate = krwQuote.regularMarketPrice;
            const pricePerDon = (pricePerOz * exchangeRate) / 8.29426;

            return NextResponse.json({
                pricePerDon,
                exchangeRate,
                goldPriceOz: pricePerOz
            });
        } else {
            return NextResponse.json({ error: 'Failed to fetch gold price' }, { status: 500 });
        }
    } catch (error) {
        console.error('Gold price fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch gold price' }, { status: 500 });
    }
}
