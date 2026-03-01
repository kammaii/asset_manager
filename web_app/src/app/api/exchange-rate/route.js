import { NextResponse } from 'next/server';
import { default as YahooFinance } from 'yahoo-finance2';

export async function GET() {
    try {
        const yf = new YahooFinance();
        const quote = await yf.quote('KRW=X');

        if (quote && quote.regularMarketPrice) {
            return NextResponse.json({ rate: quote.regularMarketPrice });
        } else {
            return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
        }
    } catch (error) {
        console.error('Exchange rate fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch exchange rate' }, { status: 500 });
    }
}
