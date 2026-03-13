'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useAssetStore from '@/store/useAssetStore';
import { ComposedChart, Bar, Line, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Bell, Search, PlusCircle, User, GripHorizontal, MoreHorizontal, ArrowLeft, Settings, CandlestickChart, PiggyBank, Banknote, Building, Gem, Bitcoin, Car, AlertTriangle } from 'lucide-react';
import AiAdvisor from '@/components/AiAdvisor';
import AiInsights from '@/components/AiInsights';
// 모든 자산 유형 메타데이터: id -> { label, labelEn, color(hex), bgColor, activeClass, icon }
const ASSET_META = {
  stock: { label: '주식', labelEn: 'Stocks', color: '#3b82f6', bgClass: 'bg-blue-50', activeClass: 'bg-blue-100 text-blue-600', icon: CandlestickChart },
  pension: { label: '연금', labelEn: 'Pension', color: '#a855f7', bgClass: 'bg-purple-50', activeClass: 'bg-purple-100 text-purple-600', icon: PiggyBank },
  cash: { label: '현금', labelEn: 'Cash', color: '#22c55e', bgClass: 'bg-green-50', activeClass: 'bg-green-100 text-green-600', icon: Banknote },
  real_estate: { label: '부동산', labelEn: 'Real Estate', color: '#ff7f50', bgClass: 'bg-orange-50', activeClass: 'bg-orange-100 text-orange-600', icon: Building },
  gold: { label: '금(Gold)', labelEn: 'Gold', color: '#eab308', bgClass: 'bg-amber-50', activeClass: 'bg-amber-100 text-amber-600', icon: Gem },
  crypto: { label: '가상화폐', labelEn: 'Crypto', color: '#06b6d4', bgClass: 'bg-cyan-50', activeClass: 'bg-cyan-100 text-cyan-600', icon: Bitcoin },
  car: { label: '자동차', labelEn: 'Vehicle', color: '#64748b', bgClass: 'bg-slate-100', activeClass: 'bg-slate-200 text-slate-600', icon: Car },
};

// Recharts에서 쓰는 색상 맵 (라벨 기반)
const ASSET_COLORS = Object.fromEntries(
  Object.values(ASSET_META).map(m => [m.label, m.color])
);

const DRILLDOWN_COLORS = {
  '한국': '#ef4444',
  '미국': '#3b82f6',
  '원화 (KRW)': '#22c55e',
  '달러 (USD)': '#f59e0b'
};

export default function Dashboard() {
  const { assets, fetchAssets, history, dailyHistory, fetchHistory, loading, getSummary, enabledAssetTypes, fetchSettings, transactions, fetchTransactions, preferredIncludeMap, setPreferredIncludeMap, targetAssetRatios, targetTotalAmount } = useAssetStore();
  const [filter, setFilter] = useState('DAILY');
  // 각 자산 유형의 포함 여부를 동적으로 관리 (저장된 설정 없으면 true)
  const includeMap = {};
  (enabledAssetTypes || []).forEach(type => {
    includeMap[type] = preferredIncludeMap?.[type] ?? true;
  });

  const [currentExchangeRate, setCurrentExchangeRate] = useState(1400); // Default fallback
  const [drillDownCategory, setDrillDownCategory] = useState(null);
  const [mounted, setMounted] = useState(false);
  const [actionMenu, setActionMenu] = useState({ visible: false, x: 0, y: 0, asset: null, assetType: null });

  useEffect(() => {
    setMounted(true);
    fetchSettings();
    fetchAssets();
    fetchTransactions();
    fetchHistory();

    // Fetch current exchange rate
    const fetchRate = async () => {
      try {
        const res = await fetch('/api/exchange-rate');
        if (res.ok) {
          const data = await res.json();
          if (data.rate) setCurrentExchangeRate(data.rate);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rate", error);
      }
    };
    fetchRate();
  }, [fetchAssets, fetchTransactions, fetchHistory, fetchSettings]);

  useEffect(() => {
    const handleClickOutside = () => {
      if (actionMenu.visible) setActionMenu(prev => ({ ...prev, visible: false }));
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [actionMenu.visible]);

  const handleRowClick = (e, asset, assetType) => {
    if (['stock', 'crypto', 'pension'].includes(assetType)) {
      e.stopPropagation();
      setActionMenu({
        visible: true,
        x: e.pageX,
        y: e.pageY,
        asset,
        assetType
      });
    }
  };

  // 자산 유형 정렬 순서 정의
  const PREFERRED_ORDER = ['stock', 'crypto', 'cash', 'pension', 'gold', 'real_estate', 'car'];

  const toggleInclude = (typeId) => {
    const nextValue = !(preferredIncludeMap?.[typeId] ?? true);
    setPreferredIncludeMap({
      ...preferredIncludeMap,
      [typeId]: nextValue
    });
  };

  const summary = getSummary(currentExchangeRate);
  const formatCurrency = (val, region = 'KR') => {
    if (region === 'US') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' }).format(val);
  };
  const formatPercent = (val) => `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;

  const SUMMARY_KEYS = {
    stock: { total: 'totalStock', profit: 'stockProfit', rate: 'stockRate' },
    crypto: { total: 'totalCrypto', profit: 'cryptoProfit', rate: 'cryptoRate' },
    cash: { total: 'totalCash', profit: 'cashProfit', rate: 'cashRate' },
    pension: { total: 'totalPension', profit: 'pensionProfit', rate: 'pensionRate' },
    gold: { total: 'totalGold', profit: 'goldProfit', rate: 'goldRate' },
    real_estate: { total: 'totalRealEstate', profit: 'realEstateProfit', rate: 'realEstateRate' },
    car: { total: 'totalCar', profit: 'carProfit', rate: 'carRate' },
  };

  const HISTORY_KEYS = {
    stock: 'stockValue',
    pension: 'pensionValue',
    cash: 'cashValue',
    real_estate: 'realEstateValue',
    gold: 'goldValue',
    crypto: 'cryptoValue',
    car: 'carValue'
  };

  const sortedEnabledTypes = [...(enabledAssetTypes || [])].sort((a, b) => {
    return PREFERRED_ORDER.indexOf(a) - PREFERRED_ORDER.indexOf(b);
  });

  const displayTotalAssets = (enabledAssetTypes || []).reduce((sum, type) => {
    const key = SUMMARY_KEYS[type];
    return sum + (key ? (summary[key.total] || 0) : 0);
  }, 0);

  const displayTotalProfit = (enabledAssetTypes || []).reduce((sum, type) => {
    const key = SUMMARY_KEYS[type];
    return sum + (key ? (summary[key.profit] || 0) : 0);
  }, 0);

  const displayTotalPrincipal = displayTotalAssets - displayTotalProfit;
  const displayProfitRate = displayTotalPrincipal > 0 ? (displayTotalProfit / displayTotalPrincipal) * 100 : 0;

  const achievementRate = targetTotalAmount > 0 ? (displayTotalAssets / targetTotalAmount) * 100 : 0;


  // 리밸런싱 알림 계산
  const rebalancingAlerts = [];
  if (targetAssetRatios && Object.keys(targetAssetRatios).length > 0) {
    const totalActualValue = (enabledAssetTypes || []).reduce((sum, type) => {
      const key = SUMMARY_KEYS[type];
      return sum + (key ? (summary[key.total] || 0) : 0);
    }, 0);

    if (totalActualValue > 0) {
      Object.entries(targetAssetRatios).forEach(([type, targetPct]) => {
        if (targetPct > 0) {
          const key = SUMMARY_KEYS[type];
          const actualValue = key ? (summary[key.total] || 0) : 0;
          const actualPct = (actualValue / totalActualValue) * 100;
          const diff = actualPct - targetPct;

          if (Math.abs(diff) >= 5) {
            rebalancingAlerts.push({
              type,
              label: ASSET_META[type]?.label || type,
              actualPct,
              targetPct,
              diff
            });
          }
        }
      });
    }
  }

  // 그래프용 포함된 자산 합계 계산
  const includedTotalAssets = (enabledAssetTypes || []).reduce((sum, typeId) => {
    if (!includeMap[typeId]) return sum;
    const key = SUMMARY_KEYS[typeId];
    return sum + (key ? (summary[key.total] || 0) : 0);
  }, 0);

  // Process data for charts
  let allocationTitle = '비중 확인 (Allocation)';
  let displayAllocation = [];
  let drillDownTotal = 0;

  if (!drillDownCategory) {
    displayAllocation = (enabledAssetTypes || []).map(type => {
      const meta = ASSET_META[type];
      const key = SUMMARY_KEYS[type];
      if (!meta || !key) return null;
      const value = summary[key.total] || 0;
      if (value <= 0) return null;
      return { name: meta.label, value, typeId: type };
    }).filter(Boolean);
    
    // 필터링 적용 (실제 차트에 보일 데이터)
    displayAllocation = displayAllocation.filter(item => includeMap[item.typeId]);
  } else {
    allocationTitle = `${drillDownCategory} 상세 비중`;
    let items = [];
    const convert = (val, region) => (region === 'US' ? (val || 0) * currentExchangeRate : (val || 0));

    if (drillDownCategory === '주식' || drillDownCategory === '연금') {
      const typeStr = drillDownCategory === '주식' ? 'stock' : 'pension';
      const categoryAssets = assets.filter(a => a.type === typeStr);

      const krValue = categoryAssets.filter(a => a.investmentCountry === 'KR' || (!a.investmentCountry && a.region === 'KR')).reduce((sum, a) => sum + convert(a.totalValue, a.region), 0);
      const usValue = categoryAssets.filter(a => a.investmentCountry === 'US' || (!a.investmentCountry && a.region === 'US')).reduce((sum, a) => sum + convert(a.totalValue, a.region), 0);

      if (krValue > 0) items.push({ name: '한국', value: krValue });
      if (usValue > 0) items.push({ name: '미국', value: usValue });
    } else if (drillDownCategory === '현금') {
      const categoryAssets = assets.filter(a => a.type === 'cash');
      const krValue = categoryAssets.filter(a => a.region === 'KR').reduce((sum, a) => sum + (a.totalValue || 0), 0);
      const usValue = categoryAssets.filter(a => a.region === 'US').reduce((sum, a) => sum + (a.totalValue || 0), 0);

      if (krValue > 0) items.push({ name: '원화 (KRW)', value: krValue });
      if (usValue > 0) items.push({ name: '달러 (USD)', value: usValue });
    }

    displayAllocation = items;
    drillDownTotal = items.reduce((sum, item) => sum + item.value, 0);
  }

  // 범례 클릭 핸들러
  const handleLegendClick = (data) => {
    let typeId = data.typeId;
    if (!typeId && data.value) {
      // Line 차트 범례에서 온 경우 label로 찾기
      typeId = Object.keys(ASSET_META).find(key => ASSET_META[key].label === data.value);
    }
    if (typeId) toggleInclude(typeId);
  };

  const currentDate = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  const todayDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const currentSummaryData = {
    stockValue: summary.totalStock || 0,
    cashValue: summary.totalCash || 0,
    pensionValue: summary.totalPension || 0,
    realEstateValue: summary.totalRealEstate || 0,
    goldValue: summary.totalGold || 0,
    cryptoValue: summary.totalCrypto || 0,
    carValue: summary.totalCar || 0,
    totalValue: displayTotalAssets
  };

  let processedDailyHistory = [...(dailyHistory || [])];
  if (processedDailyHistory.length > 0 && processedDailyHistory[processedDailyHistory.length - 1].date !== todayDateStr) {
    processedDailyHistory.push({ ...currentSummaryData, date: todayDateStr });
  } else if (processedDailyHistory.length > 0) {
    processedDailyHistory[processedDailyHistory.length - 1] = { ...currentSummaryData, date: todayDateStr };
  } else if (!loading) {
    processedDailyHistory = [{ ...currentSummaryData, date: todayDateStr }];
  }

  let processedMonthlyHistory = [...(history || [])];
  if (processedMonthlyHistory.length > 0 && processedMonthlyHistory[processedMonthlyHistory.length - 1].month !== currentMonthStr) {
    processedMonthlyHistory.push({ ...currentSummaryData, month: currentMonthStr });
  } else if (processedMonthlyHistory.length > 0) {
    processedMonthlyHistory[processedMonthlyHistory.length - 1] = { ...currentSummaryData, month: currentMonthStr };
  } else if (!loading) {
    processedMonthlyHistory = [{ ...currentSummaryData, month: currentMonthStr }];
  }

  let chartHistory = [];
  if (filter === 'DAILY') {
    chartHistory = processedDailyHistory?.length > 0 ? processedDailyHistory.slice(-30).map(d => ({
      ...d,
      displayLabel: d.date ? d.date.substring(5) : '', // MM-DD
    })) : [];
  } else if (filter === 'MONTHLY') {
    chartHistory = processedMonthlyHistory?.length > 0 ? processedMonthlyHistory.slice(-12).map(m => ({
      ...m,
      displayLabel: m.month ? `${m.month.split('-')[0].slice(2)}.${m.month.split('-')[1]}` : '', // YY.MM
    })) : [];
  } else {
    chartHistory = processedMonthlyHistory?.length > 0 ? processedMonthlyHistory.map(m => ({
      ...m,
      displayLabel: m.month ? `${m.month.split('-')[0].slice(2)}.${m.month.split('-')[1]}` : '', // YY.MM
    })) : [];
  }

  // 각 시점의 "포함된 자산 합계" 계산
  chartHistory = chartHistory.map(item => {
    const includedTotal = (enabledAssetTypes || []).reduce((sum, typeId) => {
      if (!includeMap[typeId]) return sum;
      return sum + (item[HISTORY_KEYS[typeId]] || 0);
    }, 0);
    return { ...item, includedTotal };
  });

  // Fallback
  if (chartHistory.length === 0) {
    chartHistory = [
      { displayLabel: '01.01', totalValue: summary.totalAssets || 0 }
    ];
  }

  if (!mounted) {
    return (
      <div className="flex bg-[#f5f7f8] min-h-screen justify-center items-center">
        <div className="text-[#0d7ff2] animate-pulse font-bold">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="bg-[#f5f7f8] font-sans text-slate-900 min-h-screen flex flex-col overflow-x-hidden">
      {/* Top Navigation */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 px-6 py-4 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-[#339af0]">
              <Wallet size={20} />
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight">Asset Manager</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-slate-900 text-sm font-semibold hover:text-[#0d7ff2] transition-colors cursor-pointer">대시보드</span>
            <Link href="/entry" className="text-slate-500 text-sm font-medium hover:text-slate-900 transition-colors">자산 입력</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/settings" className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500" title="설정">
            <Settings size={22} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 flex flex-col gap-6">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">내 자산 대시보드</h1>
            <p className="text-slate-500 mt-1">포트폴리오 요약 정보입니다.</p>
          </div>
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              onClick={() => setFilter('DAILY')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${filter === 'DAILY' ? 'bg-white shadow-sm font-semibold text-slate-900' : 'hover:bg-slate-200 font-medium text-slate-500'}`}
            >
              일별 (최근 1달)
            </button>
            <button
              onClick={() => setFilter('MONTHLY')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${filter === 'MONTHLY' ? 'bg-white shadow-sm font-semibold text-slate-900' : 'hover:bg-slate-200 font-medium text-slate-500'}`}
            >
              월별 (1년)
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${filter === 'ALL' ? 'bg-white shadow-sm font-semibold text-slate-900' : 'hover:bg-slate-200 font-medium text-slate-500'}`}
            >
              전체
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div className="sm:col-span-2 p-6 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden group">
            <div className="flex-1 flex flex-col gap-1 w-full">
              <div className="flex justify-between items-center relative z-10">
                <p className="text-sm font-medium text-slate-500 flex flex-col">
                  <span>전체 자산 요약</span>
                  <span className="text-[11px] opacity-70">Portfolio Summary</span>
                </p>
              </div>
              <div className="flex items-end gap-2 mt-1 relative z-10">
                <span className="text-3xl font-bold text-slate-900 tracking-tight">{formatCurrency(displayTotalAssets)}</span>
              </div>

              <div className={`flex items-center gap-2 mt-2 text-sm font-bold relative z-10 ${displayTotalProfit >= 0 ? 'text-[#ef4444]' : 'text-[#3b82f6]'}`}>
                {displayTotalProfit >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                <span>{displayTotalProfit > 0 ? '+' : ''}{formatCurrency(displayTotalProfit)}</span>
                <span className="opacity-80">({formatPercent(displayProfitRate)})</span>
              </div>
            </div>

            {targetTotalAmount > 0 && (
              <div className="flex-1 w-full bg-slate-50/50 p-4 rounded-lg border border-slate-100 relative z-10">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">목표 달성 현황</span>
                  <span className="text-sm text-blue-600 font-black">{achievementRate.toFixed(1)}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${Math.min(achievementRate, 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col items-end w-full">
                    <span className="text-[10px] text-slate-400 font-medium">최종 목표</span>
                    <span className="text-xs font-bold text-slate-900">{formatCurrency(targetTotalAmount)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {sortedEnabledTypes.map(typeId => {
            const meta = ASSET_META[typeId];
            const keys = SUMMARY_KEYS[typeId];
            if (!meta || !keys) return null;
            const totalVal = summary[keys.total] || 0;
            const profitVal = summary[keys.profit] || 0;
            const rateVal = summary[keys.rate] || 0;

            return (
              <div key={typeId} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1 relative overflow-hidden group">
                <div className={`absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full transition-colors z-0 ${meta.bgClass}`}></div>
                <div className="flex justify-between items-center relative z-10">
                  <p className="text-sm font-medium text-slate-500 flex flex-col">
                    <span>{meta.label} 자산</span>
                    <span className="text-[11px] opacity-70">Total {meta.labelEn}</span>
                  </p>
                </div>
                <div className="flex items-end gap-2 mt-1 relative z-10">
                  <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(totalVal)}</span>
                </div>
                <div className={`flex flex-col mt-2 text-xs font-bold relative z-10 ${profitVal >= 0 ? 'text-[#ef4444]' : 'text-[#3b82f6]'}`}>
                  <div className="flex items-center gap-1">
                    {profitVal >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span>{profitVal > 0 ? '+' : ''}{formatCurrency(profitVal)}</span>
                  </div>
                  <span className="ml-[20px] opacity-80">({formatPercent(rateVal)})</span>
                </div>
              </div>
            );
          })}
        </div>

        <AiInsights />

        {/* 리밸런싱 알림 섹션 */}
        {rebalancingAlerts.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-sm font-black text-amber-900">리밸런싱이 필요한 자산이 있습니다</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {rebalancingAlerts.map((alert) => (
                <div key={alert.type} className="bg-white/60 p-3 rounded-lg border border-amber-100 flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800 text-sm">{alert.label}</span>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${alert.diff > 0 ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                      {alert.diff > 0 ? '비중 초과' : '비중 부족'} ({Math.abs(alert.diff).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>현재 {alert.actualPct.toFixed(1)}%</span>
                    <span className="text-slate-300">→</span>
                    <span className="font-medium">목표 {alert.targetPct}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('openAiAdvisor', {
                    detail: { prompt: '내 목표 비중에 맞춰서 현재 포트폴리오를 어떻게 조정하면 좋을지 구체적인 매수/매도 금액을 제안해줘. (리밸런싱 상담)' }
                  }));
                }}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 bg-amber-100/50 px-3 py-1.5 rounded-lg transition-colors"
              >
                AI 어드바이저에게 리밸런싱 상담하기 →
              </button>
            </div>
          </div>
        )}

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Allocation (Donut) */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                {drillDownCategory && (
                  <button
                    onClick={() => setDrillDownCategory(null)}
                    className="p-1 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                  >
                    <ArrowLeft size={18} />
                  </button>
                )}
                <h3 className="text-lg font-bold text-slate-900">{allocationTitle}</h3>
              </div>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
              {displayAllocation.length > 0 || (drillDownCategory && displayAllocation.length > 0) ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-medium text-slate-500">총합계</span>
                    <span className="text-xl font-bold text-slate-900 z-0">
                      {formatCurrency(drillDownCategory ? drillDownTotal : includedTotalAssets)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={250} className="relative z-10">
                    <PieChart>
                      <Pie
                        data={displayAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                        onClick={(data) => {
                          if (!drillDownCategory && (data.name === '주식' || data.name === '연금' || data.name === '현금')) {
                            setDrillDownCategory(data.name);
                          }
                        }}
                        className={!drillDownCategory ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
                      >
                        {displayAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={drillDownCategory ? DRILLDOWN_COLORS[entry.name] : ASSET_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ backgroundColor: '#ffffff', opacity: 1, borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">자산 데이터가 없습니다.</div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              {!drillDownCategory ? (
                // 일반 모드: 전체 자산 유형 범례
                (enabledAssetTypes || []).map((typeId) => {
                  const meta = ASSET_META[typeId];
                  if (!meta) return null;
                  const value = summary[SUMMARY_KEYS[typeId]?.total] || 0;
                  if (value <= 0) return null;
                  
                  const isIncluded = includeMap[typeId];
                  return (
                    <div 
                      key={typeId} 
                      className={`flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-all ${!isIncluded ? 'opacity-40 grayscale-[0.5]' : ''}`}
                      onClick={() => toggleInclude(typeId)}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ASSET_COLORS[meta.label] }}></span>
                      <div className="flex flex-col">
                        <span className="text-xs text-slate-500">{meta.label}</span>
                        <span className="text-sm font-bold text-slate-900">
                          {includedTotalAssets > 0 ? ((value / includedTotalAssets) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                // 드릴다운 모드: 상세 항목 범례 (한국, 미국, 원화 등)
                displayAllocation.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 p-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: DRILLDOWN_COLORS[item.name] }}></span>
                    <div className="flex flex-col">
                      <span className="text-xs text-slate-500">{item.name}</span>
                      <span className="text-sm font-bold text-slate-900">
                        {drillDownTotal > 0 ? ((item.value / drillDownTotal) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Monthly Asset Trend */}
          <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-slate-900">자산 변동 추이</h3>
            </div>
            <div className="flex-1 w-full h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="displayLabel" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => value === 0 ? '0' : `${parseFloat((value / 100000000).toFixed(2))}억`} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(value),
                      name === 'includedTotal' ? '선택 자산 합계' : name
                    ]}
                    labelFormatter={(label) => `시점: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend
                    iconType="circle"
                    onClick={handleLegendClick}
                    wrapperStyle={{ fontSize: '12px', paddingTop: '10px', cursor: 'pointer' }}
                    payload={[
                      ...((enabledAssetTypes || []).map(typeId => {
                        const meta = ASSET_META[typeId];
                        const isIncluded = includeMap[typeId];
                        return meta ? { 
                          value: meta.label, 
                          type: 'circle', 
                          id: HISTORY_KEYS[typeId], 
                          color: isIncluded ? meta.color : '#cbd5e1', // 비활성 시 회색
                          inactive: !isIncluded 
                        } : null;
                      }).filter(Boolean)),
                      { value: '합계(Line)', type: 'line', id: 'includedTotal', color: '#0f172a' }
                    ]}
                  />
                  {(enabledAssetTypes || []).map((typeId) => {
                    const meta = ASSET_META[typeId];
                    if (!meta || !includeMap[typeId]) return null;
                    return (
                      <Line
                        key={typeId}
                        type="monotone"
                        dataKey={HISTORY_KEYS[typeId]}
                        name={meta.label}
                        stroke={meta.color}
                        strokeWidth={2}
                        dot={{ r: 2, fill: meta.color }}
                        activeDot={{ r: 4 }}
                      />
                    );
                  })}
                  <Line
                    type="monotone"
                    dataKey="includedTotal"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={{ r: 2, fill: '#0f172a' }}
                    activeDot={{ r: 4 }}
                    name="전체"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Portfolio Tables */}
        {sortedEnabledTypes.map(assetType => {
          const filteredAssets = assets
            .filter(a => a.type === assetType && (a.quantity > 0))
            .sort((a, b) => {
              const valA = (a.type === 'real_estate' ? (a.netInvestment || 0) + (a.profitGain || 0) : a.totalValue) * (a.region === 'US' ? (currentExchangeRate || 1400) : 1);
              const valB = (b.type === 'real_estate' ? (b.netInvestment || 0) + (b.profitGain || 0) : b.totalValue) * (b.region === 'US' ? (currentExchangeRate || 1400) : 1);
              return valB - valA;
            });
          const meta = ASSET_META[assetType];
          if (!meta) return null;
          const title = meta.label;

          // 최소한 주식 테이블은 내역이 없어도 보이도록 (또는 첫 번째 활성화된 자산)
          // 가상화폐와 자동차도 내역이 없더라도 보이도록 설정 (유저 요청 반영)
          if (filteredAssets.length === 0 && !['stock', 'crypto', 'car', sortedEnabledTypes[0]].includes(assetType)) return null;

          return (
            <div key={assetType} className="rounded-xl bg-white border border-slate-200 overflow-hidden mt-6">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">{title} 보유 현황 리스트</h3>
                <Link href={`/entry?tab=${assetType}`} className="text-sm font-medium text-[#0d7ff2] hover:underline">자산 추가/관리하기</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    {assetType === 'cash' ? (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4">금융기관명</th>
                        <th className="p-4 text-right">금액</th>
                      </tr>
                    ) : assetType === 'gold' ? (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4">자산명</th>
                        <th className="p-4 text-right">보유량 (돈)</th>
                        <th className="p-4 text-right">매수 단가 (평균)</th>
                        <th className="p-4 text-right">현재가</th>
                        <th className="p-4 text-right">현재 평가액</th>
                        <th className="p-4 text-right">수익금 / 수익률</th>
                      </tr>
                    ) : assetType === 'real_estate' ? (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4">부동산명</th>
                        <th className="p-4 text-right">매수가(비용포함)</th>
                        <th className="p-4 text-right">현재가</th>
                        <th className="p-4 text-right">수익금 / 수익률</th>
                      </tr>
                    ) : assetType === 'car' ? (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4 w-32">날짜</th>
                        <th className="p-4 w-40">차량번호</th>
                        <th className="p-4 min-w-[150px]">이름</th>
                        <th className="p-4 text-right">매수가</th>
                      </tr>
                    ) : (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4">구분</th>
                        <th className="p-4">종목 코드 (이름)</th>
                        <th className="p-4 text-right">수량</th>
                        <th className="p-4 text-right">매수 단가 (평균)</th>
                        <th className="p-4 text-right">현재가</th>
                        <th className="p-4 text-right">투자 원금</th>
                        <th className="p-4 text-right">현재 평가액</th>
                        <th className="p-4 text-right">수익금 / 수익률</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="text-sm divide-y divide-slate-100">
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={assetType === 'cash' ? "2" : assetType === 'car' ? "4" : "8"} className="p-8 text-center text-slate-500">
                          내역이 없습니다. "자산 추가" 버튼을 통해 시작해보세요.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr
                          key={asset.id}
                          className={`hover:bg-slate-50 transition-colors ${['stock', 'crypto', 'pension'].includes(assetType) ? 'cursor-pointer' : ''}`}
                          onClick={(e) => handleRowClick(e, asset, assetType)}
                        >
                          {assetType === 'cash' ? (
                            <>
                              <td className="p-4 font-bold text-slate-900">{asset.name}</td>
                              <td className="p-4 text-right font-bold text-slate-900 pr-5">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(asset.quantity, asset.region)}</span>
                                  {asset.region === 'US' && (
                                    <span className="text-xs text-slate-400 mt-0.5 font-normal">
                                      ≈ {formatCurrency(asset.quantity * currentExchangeRate, 'KR')}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          ) : assetType === 'gold' ? (
                            <>
                              <td className="p-4 font-bold text-slate-900">{asset.name}</td>
                              <td className="p-4 text-right font-medium text-slate-700">{asset.quantity.toLocaleString()}</td>
                              <td className="p-4 text-right text-slate-600 pr-5">{formatCurrency(asset.avgPrice, 'KR')}</td>
                              <td className="p-4 text-right text-slate-600 pr-5">{formatCurrency(asset.goldCurrentPrice || asset.avgPrice, 'KR')}</td>
                              <td className="p-4 text-right font-bold text-slate-900">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(asset.totalValue, 'KR')}</span>
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className={`font-bold ${asset.profitGain >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
                                    {asset.profitGain > 0 ? '+' : ''}{formatCurrency(asset.profitGain, 'KR')}
                                  </span>
                                  <span className={`text-xs mt-0.5 px-1.5 py-0.5 rounded ${asset.profitRate >= 0 ? 'text-[#ff4d4f] bg-red-50' : 'text-[#0d7ff2] bg-blue-50'}`}>
                                    {asset.profitRate > 0 ? '+' : ''}{asset.profitRate.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </>
                          ) : assetType === 'real_estate' ? (
                            <>
                              <td className="p-4 font-bold text-slate-900 whitespace-nowrap">{asset.name}</td>
                              <td className="p-4 text-right text-slate-600 font-medium pr-5">
                                {formatCurrency(asset.principal + (asset.expense || 0), asset.region)}
                              </td>
                              <td className="p-4 text-right font-bold text-slate-900 pr-5">
                                {formatCurrency(asset.currentPrice || 0, asset.region)}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className={`font-bold ${asset.profitGain >= 0 ? 'text-[#ff4d4f]' : 'text-[#339af0]'}`}>
                                    {asset.profitGain > 0 ? '+' : ''}{formatCurrency(asset.profitGain || 0, asset.region)}
                                  </span>
                                  <span className={`text-xs mt-0.5 px-1.5 py-0.5 rounded ${(asset.profitGain || 0) >= 0 ? 'text-[#ff4d4f] bg-red-50' : 'text-[#0d7ff2] bg-blue-50'}`}>
                                    {asset.profitGain > 0 ? '+' : ''}{asset.netInvestment > 0 ? ((asset.profitGain / asset.netInvestment) * 100).toFixed(2) : 0}%
                                  </span>
                                </div>
                              </td>
                            </>
                          ) : assetType === 'car' ? (
                            <>
                              <td className="p-4 text-slate-500 whitespace-nowrap">
                                {transactions?.find(t => t.asset_id === asset.id)?.date || '-'}
                              </td>
                              <td className="p-4 font-bold text-slate-900">{asset.symbol || '-'}</td>
                              <td className="p-4 font-bold text-slate-900">{asset.name}</td>
                              <td className="p-4 text-right font-bold text-slate-900 font-mono">
                                {formatCurrency(asset.principal, 'KR')}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="p-4 text-slate-700 font-bold whitespace-nowrap">
                                <span className="px-2 py-1 bg-slate-100 rounded-md text-xs">{asset.account || '일반'}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">
                                    {asset.investmentCountry === 'US' || (!asset.investmentCountry && asset.region === 'US') ? '🇺🇸 ' : asset.investmentCountry === 'KR' || (!asset.investmentCountry && asset.region === 'KR') ? '🇰🇷 ' : ''}{asset.name}
                                  </span>
                                  <span className="text-xs text-slate-500">{asset.symbol || '-'}</span>
                                </div>
                              </td>
                              <td className="p-4 text-right font-medium text-slate-700">{asset.quantity.toLocaleString()}</td>
                              <td className="p-4 text-right text-slate-600 pr-5">{formatCurrency(asset.avgPrice, asset.region)}</td>
                              <td className="p-4 text-right text-slate-600 pr-5">{formatCurrency(asset.currentPrice, asset.region)}</td>
                              <td className="p-4 text-right font-medium text-slate-700 pr-5">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(asset.principal, asset.region)}</span>
                                  {asset.region === 'US' && (
                                    <span className="text-xs text-slate-400 mt-0.5">
                                      ≈ {formatCurrency(asset.principal * currentExchangeRate, 'KR')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-right font-bold text-slate-900">
                                <div className="flex flex-col items-end">
                                  <span>{formatCurrency(asset.totalValue, asset.region)}</span>
                                  {asset.region === 'US' && (
                                    <span className="text-xs text-slate-400 mt-0.5 font-normal">
                                      ≈ {formatCurrency(asset.totalValue * currentExchangeRate, 'KR')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex flex-col items-end">
                                  <span className={`font-bold ${asset.profitGain >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
                                    {asset.profitGain > 0 ? '+' : ''}{formatCurrency(asset.profitGain, asset.region)}
                                  </span>
                                  <span className={`text-xs mt-0.5 px-1.5 py-0.5 rounded ${asset.profitRate >= 0 ? 'text-[#ff4d4f] bg-red-50' : 'text-[#0d7ff2] bg-blue-50'}`}>
                                    {asset.profitRate > 0 ? '+' : ''}{asset.profitRate.toFixed(2)}%
                                  </span>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </main>

      {/* Floating Action Menu */}
      {actionMenu.visible && actionMenu.asset && (
        <div
          className="absolute z-[100] bg-white rounded-lg shadow-xl border border-slate-200 p-2 flex gap-2"
          style={{ top: actionMenu.y, left: actionMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <Link
            href={`/entry?tab=${actionMenu.assetType}&action=buy&name=${encodeURIComponent(actionMenu.asset.name)}&symbol=${encodeURIComponent(actionMenu.asset.symbol || '')}&region=${actionMenu.asset.region || 'KR'}&investmentCountry=${actionMenu.asset.investmentCountry || actionMenu.asset.region || 'KR'}&account=${encodeURIComponent(actionMenu.asset.account || '일반')}`}
            className="px-4 py-2 text-sm font-bold rounded bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
          >
            매수
          </Link>
          <Link
            href={`/entry?tab=${actionMenu.assetType}&action=sell&name=${encodeURIComponent(actionMenu.asset.name)}&symbol=${encodeURIComponent(actionMenu.asset.symbol || '')}&region=${actionMenu.asset.region || 'KR'}&investmentCountry=${actionMenu.asset.investmentCountry || actionMenu.asset.region || 'KR'}&account=${encodeURIComponent(actionMenu.asset.account || '일반')}`}
            className="px-4 py-2 text-sm font-bold rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            매도
          </Link>
        </div>
      )}

      {/* AI 어드바이저 챗봇 */}
      <AiAdvisor />
    </div>
  );
}
