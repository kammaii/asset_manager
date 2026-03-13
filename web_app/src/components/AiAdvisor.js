'use client';

import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Bot, User, Loader2, Trash2 } from 'lucide-react';
import useAssetStore from '@/store/useAssetStore';

const QUICK_PROMPTS = [
    { label: '📊 포트폴리오 분석', prompt: '내 포트폴리오를 종합적으로 분석해줘. 자산 배분, 수익률, 리스크 요인을 평가하고 개선 제안을 해줘.' },
    { label: '⚖️ 리밸런싱 추천', prompt: '현재 자산 배분이 적절한지 평가하고, 리밸런싱이 필요하다면 구체적인 조정 금액과 방향을 제안해줘.' },
    { label: '⚠️ 리스크 진단', prompt: '내 포트폴리오의 주요 리스크 요인(환율, 집중도, 유동성 등)을 진단하고 대응 방안을 제시해줘.' },
    { label: '📈 이달의 요약', prompt: '현재 자산 현황을 간단히 요약하고, 주목할 만한 포인트와 향후 관심 사항을 알려줘.' },
];

export default function AiAdvisor() {
    const { assets, currentExchangeRate, targetAssetRatios } = useAssetStore();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const panelRef = useRef(null);

    // 자동 스크롤: 새로운 메시지가 추가될 때만 맨 아래로 이동
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length]); // 메시지 개수가 변할 때만 (스트리밍 중에는 변하지 않음)

    // 패널 열릴 때 입력 포커스
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // 외부 트리거 리스너 (예: 대시보드 알림 버튼)
    useEffect(() => {
        const handleTrigger = (e) => {
            const { prompt } = e.detail || {};
            setIsOpen(true);
            if (prompt) {
                // 패널이 열리는 애니메이션 시간을 고려하여 지연 발송
                setTimeout(() => sendMessage(prompt), 500);
            }
        };

        window.addEventListener('openAiAdvisor', handleTrigger);
        return () => window.removeEventListener('openAiAdvisor', handleTrigger);
    }, []);

    // 바깥 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event) => {
            // 트리거 버튼(플로팅 버튼)이나 패널 내부를 클릭한 게 아니라면 닫음
            if (isOpen &&
                panelRef.current &&
                !panelRef.current.contains(event.target) &&
                !event.target.closest('[data-ai-advisor-trigger]')) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const sendMessage = async (content) => {
        if (!content.trim() || isLoading) return;

        const userMessage = { role: 'user', content: content.trim() };
        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        // AI 응답 플레이스홀더 추가
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const res = await fetch('/api/ai-advisor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: newMessages,
                    assets: assets,
                    exchangeRate: currentExchangeRate,
                    targetAssetRatios: targetAssetRatios
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'API 요청 실패');
            }

            // SSE 스트리밍 읽기
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullResponse += parsed.content;
                                setMessages(prev => {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = {
                                        role: 'assistant',
                                        content: fullResponse
                                    };
                                    return updated;
                                });
                            }
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            if (e.message !== 'Unexpected end of JSON input') {
                                console.warn('SSE parse warning:', e);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('AI Advisor error:', error);
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                    role: 'assistant',
                    content: `❌ 오류가 발생했습니다: ${error.message}\n\n.env.local에 GEMINI_API_KEY가 설정되어 있는지 확인해주세요.`
                };
                return updated;
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const clearChat = () => {
        setMessages([]);
    };

    // 간단한 마크다운 렌더링 (볼드, 리스트, 테이블)
    const renderMarkdown = (text) => {
        if (!text) return null;

        const lines = text.split('\n');
        const elements = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];

            // 빈 줄
            if (line.trim() === '') {
                elements.push(<br key={`br-${i}`} />);
                i++;
                continue;
            }

            // 헤딩 (### ## #)
            const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const content = formatInline(headingMatch[2]);
                if (level === 1) elements.push(<h3 key={`h-${i}`} className="text-base font-bold mt-4 mb-2 text-slate-900 border-b pb-1">{content}</h3>);
                else if (level === 2) elements.push(<h4 key={`h-${i}`} className="text-sm font-bold mt-3 mb-1.5 text-slate-800">{content}</h4>);
                else elements.push(<h5 key={`h-${i}`} className="text-sm font-semibold mt-2.5 mb-1 text-slate-700">{content}</h5>);
                i++;
                continue;
            }

            // 테이블 감지 (| ... |)
            if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                const tableRows = [];
                let isHeader = true;

                while (i < lines.length && lines[i].trim().startsWith('|')) {
                    const rowLine = lines[i].trim();
                    // 구분선 (|---|) 제외
                    if (rowLine.match(/^\|[\s:-|]+\|$/)) {
                        i++;
                        isHeader = false;
                        continue;
                    }

                    const cells = rowLine.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
                    tableRows.push(
                        <tr key={`tr-${i}`} className={isHeader ? 'bg-slate-100' : 'border-b border-slate-100 hover:bg-slate-50 transition-colors'}>
                            {cells.map((cell, cIdx) => (
                                <td
                                    key={`td-${i}-${cIdx}`}
                                    className={`px-2 py-1.5 text-[11px] ${isHeader ? 'font-bold text-slate-700' : 'text-slate-600'}`}
                                >
                                    {formatInline(cell.trim())}
                                </td>
                            ))}
                        </tr>
                    );

                    if (isHeader) isHeader = false;
                    i++;
                }

                if (tableRows.length > 0) {
                    elements.push(
                        <div key={`table-wrapper-${i}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200">
                            <table className="min-w-full divide-y divide-slate-200">
                                <tbody>{tableRows}</tbody>
                            </table>
                        </div>
                    );
                    continue;
                }
            }

            // 리스트 아이템 (- 또는 숫자.)
            if (line.match(/^\s*[-•*]\s/) || line.match(/^\s*\d+\.\s/)) {
                const listItems = [];
                while (i < lines.length && (lines[i].match(/^\s*[-•*]\s/) || lines[i].match(/^\s*\d+\.\s/))) {
                    const itemContent = lines[i].replace(/^\s*[-•*\d.]+\s*/, '');
                    const indent = lines[i].match(/^(\s*)/)[1].length;
                    listItems.push(
                        <li key={`li-${i}`} className={`text-[13px] leading-relaxed mb-1 ${indent > 0 ? 'ml-4' : ''}`}>
                            {formatInline(itemContent)}
                        </li>
                    );
                    i++;
                }
                elements.push(<ul key={`ul-${i}`} className="list-disc list-inside space-y-0.5 my-2 pl-1">{listItems}</ul>);
                continue;
            }

            // 일반 텍스트
            elements.push(<p key={`p-${i}`} className="text-[13px] leading-relaxed mb-1.5">{formatInline(line)}</p>);
            i++;
        }

        return elements;
    };

    // 인라인 마크다운 (볼드, 이탤릭, 코드)
    const formatInline = (text) => {
        const parts = [];
        let lastIndex = 0;
        // **bold** 처리
        const boldRegex = /\*\*(.+?)\*\*/g;
        let match;
        while ((match = boldRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.slice(lastIndex, match.index));
            }
            parts.push(<strong key={`b-${match.index}`} className="font-bold">{match[1]}</strong>);
            lastIndex = match.index + match[0].length;
        }
        if (lastIndex < text.length) {
            parts.push(text.slice(lastIndex));
        }
        return parts.length > 0 ? parts : text;
    };

    return (
        <>
            {/* 플로팅 버튼 */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                data-ai-advisor-trigger="true"
                className={`fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${isOpen
                    ? 'bg-slate-700 hover:bg-slate-800'
                    : 'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                    }`}
                title="AI 자산관리사"
            >
                {isOpen ? (
                    <X size={24} className="text-white" />
                ) : (
                    <div className="relative">
                        <MessageCircle size={24} className="text-white" />
                        <Sparkles size={12} className="text-yellow-300 absolute -top-1 -right-1" />
                    </div>
                )}
            </button>

            {/* 챗봇 패널 */}
            <div
                ref={panelRef}
                className={`fixed bottom-24 right-6 z-[70] w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border border-slate-200 bg-white flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${isOpen
                    ? 'opacity-100 scale-100 translate-y-0'
                    : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
                    }`}
                style={{ height: 'min(600px, calc(100vh - 8rem))' }}
            >
                {/* 헤더 */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-5 py-4 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Bot size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm">AI 자산관리사</h3>
                            <p className="text-white/70 text-[11px]">포트폴리오 기반 맞춤 분석</p>
                        </div>
                    </div>
                    {messages.length > 0 && (
                        <button
                            onClick={clearChat}
                            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white/70 hover:text-white"
                            title="대화 초기화"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>

                {/* 메시지 영역 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                    {messages.length === 0 ? (
                        // 초기 상태: 빠른 질문 버튼
                        <div className="flex flex-col h-full justify-center items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                                <Sparkles size={28} className="text-blue-500" />
                            </div>
                            <div className="text-center">
                                <h4 className="font-bold text-slate-800 text-sm">무엇이든 물어보세요!</h4>
                                <p className="text-xs text-slate-500 mt-1">실제 자산 데이터를 기반으로 분석합니다</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 w-full max-w-[320px] mt-2">
                                {QUICK_PROMPTS.map((qp, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => sendMessage(qp.prompt)}
                                        className="text-left px-3 py-2.5 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all text-[12px] font-medium text-slate-700 hover:text-blue-700 shadow-sm hover:shadow"
                                    >
                                        {qp.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            {messages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'assistant' && (
                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <Bot size={14} className="text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                            ? 'bg-blue-500 text-white rounded-br-md'
                                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-sm'
                                            }`}
                                    >
                                        {msg.role === 'user' ? (
                                            <p className="text-[13px] leading-relaxed">{msg.content}</p>
                                        ) : msg.content ? (
                                            <div className="prose-sm">{renderMarkdown(msg.content)}</div>
                                        ) : (
                                            <div className="flex items-center gap-2 text-slate-400">
                                                <Loader2 size={14} className="animate-spin" />
                                                <span className="text-xs">분석 중...</span>
                                            </div>
                                        )}
                                    </div>
                                    {msg.role === 'user' && (
                                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <User size={14} className="text-slate-600" />
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </>
                    )}
                </div>

                {/* 입력 영역 */}
                <div className="border-t border-slate-200 bg-white p-3 flex-shrink-0">
                    <form onSubmit={handleSubmit} className="flex items-center gap-2">
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="포트폴리오에 대해 질문하세요..."
                            className="flex-1 text-sm px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all placeholder:text-slate-400"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 flex items-center justify-center transition-colors flex-shrink-0"
                        >
                            {isLoading ? (
                                <Loader2 size={18} className="text-white animate-spin" />
                            ) : (
                                <Send size={18} className="text-white" />
                            )}
                        </button>
                    </form>
                    <p className="text-[10px] text-slate-400 text-center mt-2">AI가 생성한 참고용 분석이며, 투자 권유가 아닙니다.</p>
                </div>
            </div>
        </>
    );
}
