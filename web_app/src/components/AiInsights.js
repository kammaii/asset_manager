'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, Info, ChevronRight, RefreshCw, X, Check } from 'lucide-react';
import useAssetStore from '@/store/useAssetStore';

const AiInsights = () => {
    const { assets, history, dailyHistory, isLoggedIn } = useAssetStore();
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchInsights = async (force = false) => {
        if (!isLoggedIn) return;

        const CACHE_KEY = 'ai_insights_cache';
        const CACHE_TIME_KEY = 'ai_insights_time';
        const ASSETS_HASH_KEY = 'ai_insights_assets_hash';
        const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

        const currentAssetsHash = JSON.stringify((assets || []).map(a => ({ id: a.id, value: a.totalValue })));
        const cachedInsights = localStorage.getItem(CACHE_KEY);
        const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
        const cachedHash = localStorage.getItem(ASSETS_HASH_KEY);
        const now = Date.now();

        if (!force && cachedInsights && cachedTime && cachedHash === currentAssetsHash && (now - parseInt(cachedTime) < TWENTY_FOUR_HOURS)) {
            setInsights(JSON.parse(cachedInsights));
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const token = await useAssetStore.getState().getAuthHeaders?.().then(h => h.Authorization);
            const response = await fetch('/api/ai-insights', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...(token && { 'Authorization': token })
                },
                body: JSON.stringify({
                    assets: assets,
                    history: dailyHistory || history
                })
            });
            if (!response.ok) throw new Error('인사이트를 가져오지 못했습니다.');
            const data = await response.json();
            
            setInsights(data);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TIME_KEY, now.toString());
            localStorage.setItem(ASSETS_HASH_KEY, currentAssetsHash);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isLoggedIn && assets && assets.length > 0) {
            fetchInsights(false);
        }
    }, [assets?.length, isLoggedIn]);

    const handleRefresh = () => {
        if (!isLoggedIn) return;
        fetchInsights(true);
    };

    const getIcon = (type) => {
        switch (type) {
            case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
            case 'success': return <TrendingUp className="w-5 h-5 text-emerald-500" />;
            case 'info': return <Info className="w-5 h-5 text-blue-500" />;
            default: return <Lightbulb className="w-5 h-5 text-purple-500" />;
        }
    };

    const getBgColor = (type) => {
        switch (type) {
            case 'warning': return 'bg-amber-50 border-amber-100';
            case 'success': return 'bg-emerald-50 border-emerald-100';
            case 'info': return 'bg-blue-50 border-blue-100';
            default: return 'bg-white border-gray-100';
        }
    };

    // 비로그인 (무료 유저)를 위한 가입 유도 플레이스홀더
    if (!isLoggedIn) {
        return (
            <div className="mb-8 rounded-3xl bg-gradient-to-br from-indigo-50/50 via-white to-white border border-indigo-100 p-8 shadow-sm overflow-hidden relative group">
                {/* 배경 장식 */}
                <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-indigo-100/30 rounded-full blur-3xl group-hover:bg-indigo-200/40 transition-colors"></div>
                <div className="absolute bottom-[-20px] left-[-20px] w-40 h-40 bg-blue-50/30 rounded-full blur-3xl"></div>

                <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md border border-indigo-50 shrink-0">
                        <Lightbulb size={32} className="text-indigo-500" />
                    </div>
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-xl font-black text-slate-800 mb-2">포트폴리오의 미래를 예측해보세요</h2>
                        <p className="text-slate-500 text-sm leading-relaxed max-w-[500px]">
                            매일 아침, 내 자산 데이터를 분석한 AI 인사이트를 보내드립니다. 리밸런싱 타이밍부터 수익률 개선 방안까지, **Pro 멤버**가 되어 개인 자산관리사를 곁에 두세요!
                        </p>
                    </div>
                    <div className="shrink-0 flex flex-col gap-3 w-full md:w-auto">
                        <a 
                            href="/settings"
                            className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-100 transition-all text-center transform active:scale-95"
                        >
                            지금 1개월 무료 Pro 시작하기
                        </a>
                        <div className="flex items-center justify-center gap-2">
                            <Check size={12} className="text-indigo-500" />
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">AI Analysis Exclusive for PRO</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl border border-gray-200"></div>
                ))}
            </div>
        );
    }

    if (error) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                        <Lightbulb className="w-4 h-4 text-purple-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">AI 투자 인사이트</h2>
                </div>
                <button
                    onClick={handleRefresh}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    title="새로고침"
                >
                    <RefreshCw className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {insights.map((insight, index) => (
                    <div
                        key={index}
                        className={`p-5 rounded-2xl border transition-all hover:shadow-md group ${getBgColor(insight.type)}`}
                    >
                        <div className="flex items-start gap-4">
                            <div className="mt-1 group-hover:scale-110 transition-transform">{getIcon(insight.type)}</div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-800 text-sm mb-1">{insight.title}</h3>
                                <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AiInsights;
