'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import useAssetStore from '@/store/useAssetStore';
import { BarChart, Bar, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Wallet, TrendingUp, TrendingDown, Bell, Search, PlusCircle, User, GripHorizontal, MoreHorizontal } from 'lucide-react';

const COLORS = ['#a855f7', '#0d7ff2', '#eab308', '#ff4d4f'];

export default function Dashboard() {
  const { assets, fetchAssets, history, fetchHistory, loading, getSummary } = useAssetStore();
  const [filter, setFilter] = useState('1Y');
  const [currentExchangeRate, setCurrentExchangeRate] = useState(1400); // Default fallback

  useEffect(() => {
    fetchAssets();
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
  }, [fetchAssets, fetchHistory]);

  const summary = getSummary(currentExchangeRate);
  const formatCurrency = (val, region = 'KR') => {
    if (region === 'US') {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' }).format(val);
  };
  const formatPercent = (val) => `${val > 0 ? '+' : ''}${val.toFixed(2)}%`;

  // Process data for charts
  const assetAllocation = [
    { name: '주식', value: summary.totalStock },
    { name: '연금', value: summary.totalPension },
    { name: '현금', value: summary.totalCash },
    { name: '대체투자', value: assets.filter(a => a.type === 'real_estate').reduce((s, a) => s + (a.totalValue || 0), 0) },
  ].filter(item => item.value > 0);

  const chartHistory = history.length > 0 ? history : [
    { month: '2025-01', totalValue: 4000000 },
    { month: '2025-02', totalValue: 4500000 },
    { month: '2025-03', totalValue: 5200000 },
    { month: '2025-04', totalValue: 4800000 },
    { month: '2025-05', totalValue: 6100000 },
    { month: '2025-06', totalValue: summary.totalAssets || 6500000 },
  ];

  return (
    <div className="bg-[#f5f7f8] font-sans text-slate-900 min-h-screen flex flex-col overflow-x-hidden">
      {/* Top Navigation */}
      <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 px-6 py-4 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 text-slate-900">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-[#0d7ff2]">
              <Wallet size={20} />
            </div>
            <h2 className="text-lg font-bold leading-tight tracking-tight">Asset Master</h2>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <span className="text-slate-900 text-sm font-semibold hover:text-[#0d7ff2] transition-colors cursor-pointer">대시보드</span>
            <Link href="/entry" className="text-slate-500 text-sm font-medium hover:text-slate-900 transition-colors">자산 입력</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
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
              onClick={() => setFilter('1Y')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${filter === '1Y' ? 'bg-white shadow-sm font-semibold text-slate-900' : 'hover:bg-slate-200 font-medium text-slate-500'}`}
            >
              Last 1 Year
            </button>
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded text-xs transition-all ${filter === 'ALL' ? 'bg-white shadow-sm font-semibold text-slate-900' : 'hover:bg-slate-200 font-medium text-slate-500'}`}
            >
              All Time
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1">
            <p className="text-sm font-medium text-slate-500">전체 자산 (Total Assets)</p>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(summary.totalAssets)}</span>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold ${summary.totalProfit >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
              {summary.totalProfit >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              <span>{summary.totalProfit > 0 ? '+' : ''}{formatCurrency(summary.totalProfit)} ({formatPercent(summary.profitRate)})</span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1 relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-purple-50 transition-colors z-0"></div>
            <p className="text-sm font-medium text-slate-500 relative z-10">주식 총액 (Total Stocks)</p>
            <div className="flex items-end gap-2 mt-1 relative z-10">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(summary.totalStock)}</span>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold relative z-10 ${summary.stockProfit >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
              {summary.stockProfit > 0 ? '+' : ''}{formatCurrency(summary.stockProfit)} ({formatPercent(summary.stockRate)})
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1 relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-blue-50 transition-colors z-0"></div>
            <p className="text-sm font-medium text-slate-500 relative z-10">연금 총액 (Total Pension)</p>
            <div className="flex items-end gap-2 mt-1 relative z-10">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(summary.totalPension)}</span>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold relative z-10 ${summary.pensionProfit >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
              {summary.pensionProfit > 0 ? '+' : ''}{formatCurrency(summary.pensionProfit)} ({formatPercent(summary.pensionRate)})
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col gap-1 relative overflow-hidden group">
            <div className="absolute right-[-20px] top-[-20px] w-24 h-24 rounded-full bg-yellow-50 transition-colors z-0"></div>
            <p className="text-sm font-medium text-slate-500 relative z-10">현금 총액 (Total Cash)</p>
            <div className="flex items-end gap-2 mt-1 relative z-10">
              <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatCurrency(summary.totalCash)}</span>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs font-bold relative z-10 ${summary.cashProfit >= 0 ? 'text-[#ff4d4f]' : 'text-[#0d7ff2]'}`}>
              {summary.cashProfit > 0 ? '+' : ''}{formatCurrency(summary.cashProfit)} ({formatPercent(summary.cashRate)})
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Asset Allocation (Donut) */}
          <div className="rounded-xl bg-white border border-slate-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">비중 확인 (Allocation)</h3>
              <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal size={20} /></button>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center relative min-h-[250px]">
              {assetAllocation.length > 0 ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-sm font-medium text-slate-500">총합계</span>
                    <span className="text-xl font-bold text-slate-900 z-0">
                      {formatCurrency(summary.totalAssets)}
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={250} className="relative z-10">
                    <PieChart>
                      <Pie
                        data={assetAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={110}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {assetAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
              {assetAllocation.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <div className="flex flex-col">
                    <span className="text-xs text-slate-500">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">
                      {summary.totalAssets > 0 ? ((item.value / summary.totalAssets) * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly Asset Trend */}
          <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-6 flex flex-col">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-slate-900">월별 자산 변동 추이</h3>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-slate-900 tracking-tight">{formatCurrency(summary.totalAssets)}</span>
            </div>
            <div className="flex-1 w-full h-[250px] mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartHistory} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `${value / 10000}만`} />
                  <Tooltip
                    formatter={(value, name) => [
                      formatCurrency(value),
                      name
                    ]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                  <Bar dataKey="stockValue" name="주식" stackId="a" fill="#0d7ff2" radius={[0, 0, 4, 4]} />
                  <Bar dataKey="pensionValue" name="연금" stackId="a" fill="#8b5cf6" />
                  <Bar dataKey="cashValue" name="현금" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Portfolio Tables */}
        {['stock', 'pension', 'cash'].map(assetType => {
          const filteredAssets = assets.filter(a => a.type === assetType);
          const title = assetType === 'stock' ? '주식' : assetType === 'pension' ? '연금' : '현금';

          if (filteredAssets.length === 0 && assetType !== 'stock') return null; // Ensure at least stock table shows even if empty

          return (
            <div key={assetType} className="rounded-xl bg-white border border-slate-200 overflow-hidden mt-6">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">{title} 보유 현황 리스트</h3>
                <Link href="/entry" className="text-sm font-medium text-[#0d7ff2] hover:underline">자산 추가/관리하기</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    {assetType === 'cash' ? (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
                        <th className="p-4">금융기관명</th>
                        <th className="p-4 text-right">금액</th>
                      </tr>
                    ) : (
                      <tr className="border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider bg-slate-50">
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
                        <td colSpan={assetType === 'cash' ? "2" : "7"} className="p-8 text-center text-slate-500">
                          내역이 없습니다. "자산 추가" 버튼을 통해 시작해보세요.
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr key={asset.id} className="hover:bg-slate-50 transition-colors">
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
                          ) : (
                            <>
                              <td className="p-4">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-900">
                                    {asset.region === 'US' ? '🇺🇸 ' : asset.region === 'KR' ? '🇰🇷 ' : ''}{asset.name}
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
    </div>
  );
}
