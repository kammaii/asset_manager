'use client';

import React, { useState, useEffect } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, Info, ChevronRight, RefreshCw } from 'lucide-react';
import useAssetStore from '@/store/useAssetStore';

const AiInsights = () => {
    const { assets, history, dailyHistory } = useAssetStore();
    const [insights, setInsights] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/ai-insights', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assets: assets,
                    history: dailyHistory || history
                })
            });
            if (!response.ok) throw new Error('인사이트를 가져오지 못했습니다.');
            const data = await response.json();
            setInsights(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (assets && assets.length > 0) {
            fetchInsights();
        }
    }, [assets.length > 0]); // 자산이 처음으로 로드될 때 실행

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

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-2xl border border-gray-200"></div>
                ))}
            </div>
        );
    }

    if (error) return null; // 에러 시 조용히 숨깁니다.

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-purple-100 rounded-lg">
                        <Lightbulb className="w-4 h-4 text-purple-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-800">AI 투자 인사이트</h2>
                </div>
                <button
                    onClick={fetchInsights}
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
                        className={`p-4 rounded-2xl border transition-all hover:shadow-md cursor-default ${getBgColor(insight.type)}`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5">{getIcon(insight.type)}</div>
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-1">{insight.title}</h3>
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
