import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 최대 60초 실행 허용

// Gemini 클라이언트 초기화
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 자산 데이터를 텍스트 요약으로 변환
function buildPortfolioContext(assets, exchangeRate, targetAssetRatios = {}) {
    const convert = (val, asset) =>
        asset.region === 'US' && asset.type !== 'cash'
            ? (val || 0) * exchangeRate
            : (val || 0);

    // 유형별 분류
    const byType = {};
    assets.forEach(a => {
        if (!byType[a.type]) byType[a.type] = [];
        byType[a.type].push(a);
    });

    const typeLabels = {
        stock: '주식', crypto: '가상화폐', cash: '현금',
        pension: '연금', gold: '금(Gold)', real_estate: '부동산', car: '자동차'
    };

    let totalAssets = 0;
    const sections = [];

    for (const [type, items] of Object.entries(byType)) {
        const label = typeLabels[type] || type;
        let typeTotal = 0;
        let typePrincipal = 0;
        const details = [];

        items.forEach(a => {
            const value = convert(a.totalValue || 0, a);
            const principal = convert(a.netInvestment !== undefined ? a.netInvestment : a.principal || 0, a);
            typeTotal += value;
            typePrincipal += principal;

            if (type === 'stock' || type === 'crypto' || type === 'pension') {
                const profit = value - convert(a.principal || 0, a);
                const profitRate = a.principal > 0 ? (profit / convert(a.principal || 0, a) * 100) : 0;
                const country = a.investmentCountry === 'US' || a.region === 'US' ? '🇺🇸' : '🇰🇷';
                details.push(
                    `  - ${country} ${a.name} (${a.symbol || '-'}): ` +
                    `평가액 ₩${Math.round(value).toLocaleString()}, ` +
                    `수량 ${a.quantity || 0}, ` +
                    `수익률 ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(1)}%`
                );
            } else if (type === 'cash') {
                const currency = a.region === 'US' ? 'USD' : 'KRW';
                details.push(`  - ${a.name}: ${currency} ${(a.quantity || 0).toLocaleString()} (≈₩${Math.round(value).toLocaleString()})`);
            } else if (type === 'real_estate') {
                details.push(`  - ${a.name}: 매수가 ₩${Math.round(a.principal || 0).toLocaleString()}, 현재가 ₩${Math.round(a.currentPrice || 0).toLocaleString()}`);
            } else if (type === 'gold') {
                details.push(`  - ${a.name}: ${a.quantity || 0}돈, 평가액 ₩${Math.round(value).toLocaleString()}`);
            } else if (type === 'car') {
                details.push(`  - ${a.name}: 매수가 ₩${Math.round(a.principal || 0).toLocaleString()}`);
            }
        });

        const typeProfit = typeTotal - typePrincipal;
        const typeRate = typePrincipal > 0 ? (typeProfit / typePrincipal * 100) : 0;
        totalAssets += typeTotal;

        sections.push(
            `### ${label} (₩${Math.round(typeTotal).toLocaleString()})` +
            (typePrincipal > 0 ? ` | 수익: ${typeProfit >= 0 ? '+' : ''}₩${Math.round(typeProfit).toLocaleString()} (${typeRate >= 0 ? '+' : ''}${typeRate.toFixed(1)}%)` : '') +
            '\n' + details.join('\n')
        );
    }

    // 비중 계산
    const allocations = Object.entries(byType).map(([type, items]) => {
        const typeTotal = items.reduce((sum, a) => sum + convert(a.totalValue || 0, a), 0);
        const pct = totalAssets > 0 ? (typeTotal / totalAssets * 100).toFixed(1) : '0.0';
        return `  - ${typeLabels[type] || type}: ${pct}%`;
    }).join('\n');

    // 목표 비중 텍스트 구성
    const targetAllocations = Object.entries(targetAssetRatios)
        .filter(([_, ratio]) => ratio > 0)
        .map(([type, ratio]) => `  - ${typeLabels[type] || type}: ${ratio}%`)
        .join('\n');

    const targetText = targetAllocations
        ? `\n## 사용자의 리밸런싱 목표 자산 비중\n${targetAllocations}\n`
        : '\n## 사용자의 리밸런싱 목표 자산 비중\n- 현재 설정된 목표 비중이 없습니다. 표준적인 포트폴리오 이론을 바탕으로 제안해주세요.\n';

    return `## 포트폴리오 요약
- **총 자산**: ₩${Math.round(totalAssets).toLocaleString()}
- **현재 환율 (USD/KRW)**: ${exchangeRate.toLocaleString()}원

## 현재 자산 배분 비중
${allocations}
${targetText}
## 자산별 상세
${sections.join('\n\n')}`;
}

// 시스템 프롬프트
function getSystemPrompt(portfolioContext) {
    return `당신은 "AI 자산관리사"입니다. 사용자의 실제 포트폴리오 데이터를 바탕으로 전문적이면서도 이해하기 쉬운 자산 분석과 조언을 제공합니다.

## 사용자 포트폴리오 데이터
${portfolioContext}

## 응답 규칙
1. 항상 **한국어**로 답변합니다.
2. 구체적인 숫자와 비율을 근거로 제시합니다.
3. 리스크와 기회를 균형 있게 분석합니다.
4. **리밸런싱 제안 시**: 사용자가 설정한 '목표 자산 비중'이 있다면 이를 최우선 기준으로 삼아 현재 비중과의 괴리를 분석하고, 구체적인 매수/매도 방향과 금액을 제안합니다. 목표 비중이 없다면 일반적인 자산 배분 원칙을 제안합니다.
5. **시나리오 시뮬레이션 시**: "환율이 변한다면?", "특정 자산을 매수/매도한다면?" 등의 가상 질문에 대해 현재 데이터를 바탕으로 예상되는 자산 총액 변화, 비중 변화, 수익률 변화 등을 계산하여 논리적으로 답변합니다.
6. 자산 배분, 리밸런싱, 투자 전략에 대해 실행 가능한 제안을 합니다.
7. 마크다운 형식(볼드, 리스트 등)을 활용하여 가독성 좋게 답변합니다.
8. 답변 마지막에 반드시 "*본 정보는 AI가 생성한 참고용 분석이며, 투자 권유가 아닙니다.*" 면책 문구를 포함합니다.
9. 핵심 포인트 위주로 최대한 간결하고 명확하게 답변합니다. 장황한 설명은 지양하세요.
10. 표(Table)는 꼭 필요한 경우에만 최소한으로 사용하며, 핵심 데이터 위주로 구성합니다.
11. 답변 전체 길이를 짧게 유지하여 사용자가 한눈에 핵심을 파악할 수 있게 하세요.`;
}

export async function POST(request) {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return NextResponse.json(
                { error: 'GEMINI_API_KEY가 설정되지 않았습니다. .env.local 파일에 추가해주세요.' },
                { status: 500 }
            );
        }

        const { messages, assets: providedAssets, exchangeRate: providedExchangeRate, targetAssetRatios: providedTargetAssetRatios } = await request.json();
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 });
        }

        let assets = providedAssets;
        let exchangeRate = providedExchangeRate || 1400;

        // 클라이언트에서 데이터를 전달하지 않은 경우에만 내부 API 호출 (하위 호환성 및 보수적 처리)
        if (!assets) {
            console.log('Fetching assets internally as they were not provided in request body');
            const reqHeaders = await headers();
            const host = reqHeaders.get('host') || 'localhost:3000';
            const protocol = host.includes('localhost') ? 'http' : 'https';
            const baseUrl = `${protocol}://${host}`;

            const [assetsRes, exchangeRes] = await Promise.all([
                fetch(`${baseUrl}/api/assets`),
                fetch(`${baseUrl}/api/exchange-rate`)
            ]);

            if (assetsRes.ok) {
                assets = await assetsRes.json();
            }
            if (exchangeRes.ok && !providedExchangeRate) {
                const exchangeData = await exchangeRes.json();
                if (exchangeData?.rate) exchangeRate = exchangeData.rate;
            }
        }

        if (!assets) throw new Error('자산 데이터를 불러올 수 없습니다.');

        // 포트폴리오 컨텍스트 구성
        const portfolioContext = buildPortfolioContext(assets, exchangeRate, providedTargetAssetRatios);
        const systemPrompt = getSystemPrompt(portfolioContext);

        // Gemini 대화 히스토리 구성
        const geminiContents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        // Gemini API 스트리밍 호출
        const streamResult = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash-lite',
            contents: geminiContents,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7,
                maxOutputTokens: 8192, // 토큰 제한 대폭 상향 유도
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                ]
            },
        });

        // SSE 스트리밍 응답 구성
        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let chunkCount = 0;
                    for await (const chunk of streamResult) {
                        chunkCount++;
                        let text = '';
                        try {
                            text = typeof chunk.text === 'function' ? chunk.text() : (chunk.text || '');
                        } catch (e) {
                            console.warn(`[AI Advisor] Chunk ${chunkCount} text extraction warning:`, e.message);
                        }

                        if (text) {
                            const data = JSON.stringify({ content: text });
                            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                        }

                        // 디버깅을 위한 종료 사유 출력
                        if (chunk.candidates?.[0]?.finishReason) {
                            const reason = chunk.candidates[0].finishReason;
                            console.log(`[AI Advisor] Stream finished at chunk ${chunkCount}. Reason: ${reason}`);
                            if (reason !== 'STOP' && reason !== 'MAX_TOKENS') {
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: `\n\n*(주의: AI 응답이 종료 사유(${reason})로 인해 중단되었을 수 있습니다.)*` })}\n\n`));
                            }
                        }
                    }
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();
                } catch (error) {
                    console.error('Streaming error:', error);
                    const errData = JSON.stringify({ error: error.message });
                    controller.enqueue(encoder.encode(`data: ${errData}\n\n`));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('AI Advisor error:', error);

        // Rate Limit (429) 에러를 사용자 친화적으로 처리
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED')) {
            return NextResponse.json(
                { error: '⏳ API 요청 한도에 도달했습니다. 잠시 후(약 1분) 다시 시도해주세요.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'AI 응답 생성에 실패했습니다: ' + error.message },
            { status: 500 }
        );
    }
}
