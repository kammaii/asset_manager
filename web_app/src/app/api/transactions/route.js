import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore/lite';

export async function GET() {
  try {
    const assetsRef = collection(db, 'assets');
    const trxRef = collection(db, 'transactions');

    const [assetsSnap, trxSnap] = await Promise.all([
      getDocs(assetsRef),
      getDocs(trxRef)
    ]);

    const assetsMap = {};
    assetsSnap.forEach(doc => {
      assetsMap[doc.id] = doc.data();
    });

    const transactions = trxSnap.docs.map(doc => {
      const data = doc.data();
      const asset = assetsMap[data.asset_id] || {};

      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate().toISOString();
      }

      return {
        id: doc.id,
        action: data.action,
        date: data.date,
        quantity: data.quantity,
        price: data.price,
        account: data.account || asset.account || '일반',
        createdAt: createdAt,
        type: asset.type,
        region: asset.region,
        symbol: asset.symbol,
        name: asset.name,
        asset_id: data.asset_id
      };
    });

    // Sort descending by date and createdAt
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return new Date(b.date) - new Date(a.date);
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
