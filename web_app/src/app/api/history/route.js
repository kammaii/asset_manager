import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, query, orderBy, limit } from 'firebase/firestore/lite';
import { default as YahooFinance } from 'yahoo-finance2';

export const dynamic = 'force-dynamic'; // Prevent Next.js from caching API routes

export async function GET(request) {
    try {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') || 'monthly';

        // Use Korean timezone (Asia/Seoul)
        const currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));

        // Fetch snapshots and backfill if necessary
        if (type === 'daily') {
            const snapshotsRef = collection(db, 'daily_snapshots');
            const q = query(snapshotsRef, orderBy('date', 'desc'), limit(40));
            const snapshotsSnap = await getDocs(q);
            let data = snapshotsSnap.docs.map(docSnap => docSnap.data());
            // Reverse for ascending order (needed for backfill loop)
            data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

            if (data.length === 0) {
                return NextResponse.json([]);
            }

            // Backfill missing days
            const backfilled = [];
            const startDate = new Date(data[0].date);
            startDate.setHours(12, 0, 0, 0); // Avoid timezone issues
            const endDate = new Date(currentDate);
            // End date is yesterday to not write today, frontend attaches today
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
        } else {
            const snapshotsRef = collection(db, 'monthly_snapshots');
            const q = query(snapshotsRef, orderBy('month', 'desc'), limit(24)); // Last 2 years
            const snapshotsSnap = await getDocs(q);
            let historyData = snapshotsSnap.docs.map(docSnap => docSnap.data());
            historyData.sort((a, b) => (a.month || '').localeCompare(b.month || ''));

            return NextResponse.json(historyData);
        }
    } catch (error) {
        console.error('Error fetching/updating snapshots for history API:', error);
        return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
    }
}
