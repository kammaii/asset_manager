import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore/lite';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');

    const assetsRef = collection(db, 'assets');
    const trxRef = collection(db, 'transactions');

    let trxQuery = trxRef;
    if (limitParam && limitParam !== 'all') {
      trxQuery = query(trxRef, orderBy('date', 'desc'), limit(parseInt(limitParam, 10)));
    } else {
      trxQuery = query(trxRef, orderBy('date', 'desc'));
    }

    const trxSnap = await getDocs(trxQuery);

    const neededAssetIds = new Set();
    trxSnap.docs.forEach(doc => {
      if (!doc.data().type) neededAssetIds.add(doc.data().asset_id);
    });

    const assetsMap = {};
    // Backward compatibility: Only load all assets if there are old transactions missing 'type'
    if (neededAssetIds.size > 0) {
      const assetsSnap = await getDocs(assetsRef);
      assetsSnap.forEach(doc => {
        assetsMap[doc.id] = doc.data();
      });
    }

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
        type: data.type || asset.type,
        region: data.region || asset.region,
        investmentCountry: data.investmentCountry || asset.investmentCountry || data.region || asset.region || 'KR',
        symbol: data.symbol !== undefined ? data.symbol : asset.symbol,
        name: data.name || asset.name,
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
