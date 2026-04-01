import { NextResponse } from 'next/server';
import { adminDb, getUserIdFromRequest } from '@/lib/firebase-admin';
import { default as YahooFinance } from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const uid = await getUserIdFromRequest(request);
        if (!uid) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'monthly';

        const currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

        if (type === 'daily') {
            const snapshotsSnap = await adminDb
                .collection('users')
                .doc(uid)
                .collection('daily_snapshots')
                .orderBy('date', 'desc')
                .limit(40)
                .get();
            let data = snapshotsSnap.docs.map((docSnap) => docSnap.data());
            data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            if (data.length === 0) {
                return NextResponse.json([]);
            }

            const backfilled = [];
            const startDate = new Date(data[0].date);
            startDate.setHours(12, 0, 0, 0);
            const endDate = new Date(currentDate);
            endDate.setDate(endDate.getDate() - 1);
            endDate.setHours(12, 0, 0, 0);

            let dataIdx = 0;
            let lastSnap = data[0];

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const dYear = d.getFullYear();
                const dMonth = String(d.getMonth() + 1).padStart(2, '0');
                const dDay = String(d.getDate()).padStart(2, '0');
                const dateStr = `${dYear}-${dMonth}-${dDay}`;

                while (dataIdx < data.length && data[dataIdx].date < dateStr) {
                    lastSnap = data[dataIdx];
                    dataIdx++;
                }

                if (dataIdx < data.length && data[dataIdx].date === dateStr) {
                    lastSnap = data[dataIdx];
                    dataIdx++;
                }

                backfilled.push({ ...lastSnap, date: dateStr });
            }

            return NextResponse.json(backfilled.length > 0 ? backfilled : data);
        }

        const snapshotsSnap = await adminDb
            .collection('users')
            .doc(uid)
            .collection('monthly_snapshots')
            .orderBy('month', 'desc')
            .limit(24)
            .get();
        let historyData = snapshotsSnap.docs.map((docSnap) => docSnap.data());
        historyData.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

        return NextResponse.json(historyData);
    } catch (error) {
        console.error('Error fetching/updating snapshots for history API:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
