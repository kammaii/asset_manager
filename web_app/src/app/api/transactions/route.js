import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const query = `
      SELECT 
        t.id, t.action, t.date, t.quantity, t.price, t.createdAt,
        a.type, a.region, a.symbol, a.name
      FROM transactions t
      JOIN assets a ON t.asset_id = a.id
      ORDER BY t.date DESC, t.createdAt DESC
    `;
    const transactions = db.prepare(query).all();
    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
