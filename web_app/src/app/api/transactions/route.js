import { NextResponse } from 'next/server';
import { adminDb, getUserIdFromRequest } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const uid = await getUserIdFromRequest(request);
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');

    const assetsCol = adminDb.collection('users').doc(uid).collection('assets');
    const trxCol = adminDb.collection('users').doc(uid).collection('transactions');

    let trxQuery = trxCol.orderBy('date', 'desc');
    if (limitParam && limitParam !== 'all') {
      trxQuery = trxQuery.limit(parseInt(limitParam, 10));
    }

    const trxSnap = await trxQuery.get();

    const neededAssetIds = new Set();
    trxSnap.docs.forEach((d) => {
      if (!d.data().type) neededAssetIds.add(d.data().asset_id);
    });

    const assetsMap = {};
    if (neededAssetIds.size > 0) {
      const assetsSnap = await assetsCol.get();
      assetsSnap.forEach((d) => {
        assetsMap[d.id] = d.data();
      });
    }

    const transactions = trxSnap.docs.map((docSnap) => {
      const data = docSnap.data();
      const asset = assetsMap[data.asset_id] || {};

      let createdAt = data.createdAt;
      if (createdAt && typeof createdAt.toDate === 'function') {
        createdAt = createdAt.toDate().toISOString();
      }

      return {
        id: docSnap.id,
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
        asset_id: data.asset_id,
        ...(data.interestRate !== undefined ? { interestRate: data.interestRate } : asset.interestRate !== undefined ? { interestRate: asset.interestRate } : {})
      };
    });

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
