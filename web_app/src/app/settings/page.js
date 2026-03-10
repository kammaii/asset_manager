'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useAssetStore from '@/store/useAssetStore';
import { Wallet, Settings, CandlestickChart, PiggyBank, Banknote, Building, Gem, Bitcoin, Car, GripVertical, Plus, X, Check, ArrowLeft } from 'lucide-react';

// 앱에서 지원하는 모든 자산 유형 정의
const ALL_ASSET_TYPES = [
    { id: 'stock', icon: CandlestickChart, label: '주식', labelEn: 'Stocks', color: 'blue' },
    { id: 'crypto', icon: Bitcoin, label: '가상화폐', labelEn: 'Crypto', color: 'cyan' },
    { id: 'cash', icon: Banknote, label: '현금', labelEn: 'Cash', color: 'green' },
    { id: 'pension', icon: PiggyBank, label: '연금', labelEn: 'Pension', color: 'purple' },
    { id: 'gold', icon: Gem, label: '금', labelEn: 'Gold', color: 'amber' },
    { id: 'real_estate', icon: Building, label: '부동산', labelEn: 'Real Estate', color: 'orange' },
    { id: 'car', icon: Car, label: '자동차', labelEn: 'Vehicle', color: 'slate' },
];

const COLOR_CLASSES = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', ring: 'ring-blue-400' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200', ring: 'ring-purple-400' },
    green: { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200', ring: 'ring-green-400' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', ring: 'ring-orange-400' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', ring: 'ring-amber-400' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', ring: 'ring-cyan-400' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-300', ring: 'ring-slate-400' },
};

export default function SettingsPage() {
    const { enabledAssetTypes, fetchSettings, updateSettings, loading } = useAssetStore();
    const router = useRouter();
    const [localEnabled, setLocalEnabled] = useState([]);
    const [mounted, setMounted] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        if (enabledAssetTypes && enabledAssetTypes.length > 0) {
            setLocalEnabled([...enabledAssetTypes]);
        }
    }, [enabledAssetTypes]);

    const toggleAssetType = (id) => {
        setLocalEnabled(prev => {
            if (prev.includes(id)) {
                // 최소 1개는 남겨야 함
                if (prev.length <= 1) return prev;
                return prev.filter(t => t !== id);
            } else {
                return [...prev, id];
            }
        });
        setSaved(false);
    };

    const handleSave = async () => {
        setSaving(true);
        await updateSettings({ enabledAssetTypes: localEnabled });
        setSaving(false);
        setSaved(true);
        // 저장 후 바로 대시보드로 이동
        router.push('/');
    };

    const hasChanges = JSON.stringify(localEnabled.sort()) !== JSON.stringify([...(enabledAssetTypes || [])].sort());

    if (!mounted) {
        return (
            <div className="flex bg-[#f5f7f8] min-h-screen justify-center items-center">
                <div className="text-[#0d7ff2] animate-pulse font-bold">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="bg-[#f5f7f8] min-h-screen text-slate-900 font-sans flex flex-col">
            {/* 헤더 */}
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 px-6 py-4 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 text-slate-900">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-[#0d7ff2]">
                            <Wallet size={20} />
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-tight">Asset Manager</h2>
                    </div>
                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="/" className="text-slate-500 text-sm font-medium hover:text-[#0d7ff2] transition-colors">대시보드</Link>
                        <Link href="/entry" className="text-slate-500 text-sm font-medium hover:text-[#0d7ff2] transition-colors">자산 입력</Link>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-50 rounded-full text-[#0d7ff2]" title="설정">
                        <Settings size={22} />
                    </div>
                </div>
            </header>

            {/* 메인 콘텐츠 */}
            <main className="flex-1 w-full max-w-[800px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
                {/* 뒤로가기 + 타이틀 */}
                <div className="flex items-center gap-3">
                    <Link href="/" className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-500">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black leading-tight flex items-center gap-2">
                            <Settings size={28} className="text-slate-400" />
                            설정
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">대시보드와 입력 페이지에 표시할 자산 탭을 편집합니다.</p>
                    </div>
                </div>

                {/* 자산 탭 편집 영역 */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-200">
                        <h2 className="text-lg font-bold text-slate-900">내 자산 탭 편집</h2>
                        <p className="text-sm text-slate-500 mt-1">
                            활성화된 자산만 대시보드와 자산 입력 페이지에 표시됩니다. 최소 1개 이상의 자산이 활성화되어야 합니다.
                        </p>
                    </div>

                    <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ALL_ASSET_TYPES.map((assetType) => {
                            const isEnabled = localEnabled.includes(assetType.id);
                            const colorCls = COLOR_CLASSES[assetType.color];
                            const IconComp = assetType.icon;

                            return (
                                <button
                                    key={assetType.id}
                                    onClick={() => toggleAssetType(assetType.id)}
                                    className={`
                                        relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left
                                        ${isEnabled
                                            ? `${colorCls.border} ${colorCls.bg} ring-2 ${colorCls.ring} ring-opacity-30 shadow-sm`
                                            : 'border-slate-200 bg-slate-50 opacity-60 hover:opacity-80 hover:border-slate-300'
                                        }
                                    `}
                                >
                                    {/* 아이콘 */}
                                    <div className={`
                                        w-12 h-12 rounded-lg flex items-center justify-center shrink-0
                                        ${isEnabled ? `${colorCls.bg} ${colorCls.text}` : 'bg-slate-200 text-slate-400'}
                                    `}>
                                        <IconComp size={24} />
                                    </div>

                                    {/* 텍스트 */}
                                    <div className="flex flex-col flex-1">
                                        <span className={`font-bold text-base ${isEnabled ? 'text-slate-900' : 'text-slate-500'}`}>
                                            {assetType.label}
                                        </span>
                                        <span className={`text-xs ${isEnabled ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {assetType.labelEn}
                                        </span>
                                    </div>

                                    {/* 토글 표시 */}
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all
                                        ${isEnabled ? `bg-white ${colorCls.text} shadow-sm border ${colorCls.border}` : 'bg-slate-300 text-white'}
                                    `}>
                                        {isEnabled ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* 저장 버튼 */}
                    <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                        <p className="text-xs text-slate-400">
                            {localEnabled.length}개 자산 활성화됨
                        </p>
                        <div className="flex items-center gap-3">
                            {saved && (
                                <span className="text-sm text-green-600 font-medium flex items-center gap-1 animate-pulse">
                                    <Check size={16} /> 저장 완료!
                                </span>
                            )}
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChanges}
                                className={`
                                    px-5 py-2.5 rounded-lg font-bold text-sm transition-all
                                    ${hasChanges
                                        ? 'bg-[#0d7ff2] hover:bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    }
                                `}
                            >
                                {saving ? '저장 중...' : '변경 사항 저장'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* 안내 메시지 */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-xs font-bold">i</span>
                    </div>
                    <div className="text-sm text-blue-800">
                        <p className="font-semibold mb-1">안내</p>
                        <p className="text-blue-700">
                            비활성화한 자산의 데이터가 삭제되지는 않습니다.
                            다시 활성화하면 기존 데이터가 그대로 표시됩니다.
                        </p>
                    </div>
                </div>
            </main>
        </div>
    );
}
