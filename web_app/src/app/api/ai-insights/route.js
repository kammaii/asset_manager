import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request) {
    try {
        const { assets: providedAssets, history: providedHistory } = await request.json().catch(() => ({}));

        let assets = providedAssets;
        let history = providedHistory;

        // 데이터가 없는 경우에만 내부 API 호출
        if (!assets || !history) {
            const reqHeaders = await headers();
            const host = reqHeaders.get('host') || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const baseUrl = `${protocol}://${host}`;

            const [assetsRes, historyRes] = await Promise.all([
                !assets ? fetch(`${baseUrl}/api/assets`) : Promise.resolve(null),
                !history ? fetch(`${baseUrl}/api/history?type=daily`) : Promise.resolve(null)
            ]);

            if (assetsRes && assetsRes.ok) assets = await assetsRes.json();
            if (historyRes && historyRes.ok) history = await historyRes.json();
        }

        if (!assets) throw new Error('자산 데이터 조회 실패');
        if (!history) history = [];

        // 데이터 요약
        const totalValue = assets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const assetSummary = assets.map(a => ({
            type: a.type,
            name: a.name,
            totalValue: a.totalValue,
            profitRate: a.profitRate
        }));

        // 시계열 데이터 요약 (최근 7일)
        const recentHistory = history.slice(-7).map(h => ({
            date: h.date,
            totalValue: h.totalAmount
        }));

        const prompt = `
            당신은 전문 자산관리 데이터 분석가입니다. 
            사용자의 현재 자산 상태와 최근 7일간의 변동 내역을 바탕으로 3개의 핵심 인사이트를 도출하세요.
            
            데이터:
            - 현재 총 자산: ₩${totalValue.toLocaleString()}
            - 자산 구성: ${JSON.stringify(assetSummary)}
            - 최근 7일 변동: ${JSON.stringify(recentHistory)}
            
            요구사항:
            1. 결과는 반드시 JSON 배열 형식으로 출력하세요. [{"type": "warning|info|success", "title": "제목", "description": "상세내용"}]
            2. type 종류:
               - warning: 리스크 주의, 비중 편중, 현금 부족 등
               - success: 수익 달성, 자산 증가 추세 등
               - info: 일반적인 분석, 시장 상황 연계 등
            3. 문장은 한국어로 매우 간결하고 명확하게 작성하세요. (한 문장 권장)
            4. 구체적인 숫자가 있다면 포함하세요.
        `;

        // Gemini API 호출 (최신 SDK 형식)
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            config: {
                responseMimeType: "application/json"
            }
        });

        // Gemini API 응답에서 텍스트 추출 (SDK 3.0 구조)
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error('AI 응답이 비어있습니다.');

        // JSON 파싱 시도 (Gemini가 마크다운 코드 블록으로 감쌀 경우 대비)
        const jsonMatch = text.match(/\[.*\]/s);
        const insights = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(text);

        return NextResponse.json(insights);
    } catch (error) {
        console.error('AI Insights API Error:', error);
        return NextResponse.json([
            { type: 'info', title: '분석 준비 중', description: '자산 데이터를 분석하여 곧 맞춤형 인사이트를 제공해 드립니다.' }
        ]);
    }
}
