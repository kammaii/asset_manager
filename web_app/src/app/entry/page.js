'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAssetStore from '@/store/useAssetStore';
import { Wallet, TrendingUp, TrendingDown, Bell, Search, PlusCircle, User, CandlestickChart, PiggyBank, Banknote, Building, Check, Edit2, X, Trash2, ChevronDown, Plus, Trash } from 'lucide-react';

export default function EntryPage() {
    const { assets, fetchAssets, transactions, fetchTransactions, addAsset, updateTransaction, deleteTransaction, accountTypes, cashInstitutions, fetchSettings, updateSettings, loading } = useAssetStore();
    const [activeTab, setActiveTab] = useState('stock');
    const [editingId, setEditingId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [newInstitution, setNewInstitution] = useState('');
    const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);
    const [newAccountType, setNewAccountType] = useState('');
    const [currentExchangeRate, setCurrentExchangeRate] = useState(null);

    const [formData, setFormData] = useState({
        action: 'buy',
        date: new Date().toISOString().split('T')[0],
        region: 'KR',
        account: '일반',
        symbol: '',
        name: '',
        quantity: '',
        price: ''
    });

    useEffect(() => {
        fetchSettings();
        fetchAssets();
        fetchTransactions();

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
    }, [fetchAssets, fetchTransactions]);

    const addInstitution = async () => {
        if (newInstitution.trim() && !cashInstitutions.includes(newInstitution.trim())) {
            const updated = [...cashInstitutions, newInstitution.trim()];
            await updateSettings({ cashInstitutions: updated });
            setFormData(prev => ({ ...prev, name: newInstitution.trim(), symbol: newInstitution.trim() }));
            setNewInstitution('');
            setIsDropdownOpen(false);
        }
    };

    const removeInstitution = async (instToRemove, e) => {
        e.stopPropagation();
        const updated = cashInstitutions.filter(inst => inst !== instToRemove);
        await updateSettings({ cashInstitutions: updated });
        if (formData.name === instToRemove) {
            setFormData(prev => ({ ...prev, name: '', symbol: '' }));
        }
    };

    const handleInstitutionSelect = (inst) => {
        setFormData(prev => ({ ...prev, name: inst, symbol: inst }));
        setIsDropdownOpen(false);
    };

    const addAccountType = async () => {
        if (newAccountType.trim() && !accountTypes.includes(newAccountType.trim())) {
            const updated = [...accountTypes, newAccountType.trim()];
            await updateSettings({ accountTypes: updated });
            setFormData(prev => ({ ...prev, account: newAccountType.trim() }));
            setNewAccountType('');
            setIsAccountDropdownOpen(false);
        }
    };

    const removeAccountType = async (typeToRemove, e) => {
        e.stopPropagation();
        const updated = accountTypes.filter(t => t !== typeToRemove);
        await updateSettings({ accountTypes: updated });
        if (formData.account === typeToRemove) {
            setFormData(prev => ({ ...prev, account: '일반' }));
        }
    };

    const handleAccountSelect = (type) => {
        setFormData(prev => ({ ...prev, account: type }));
        setIsAccountDropdownOpen(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleEdit = (trx) => {
        setEditingId(trx.id);
        setFormData({
            action: trx.action,
            date: trx.date,
            region: trx.region || 'KR',
            account: trx.account || '일반',
            symbol: trx.symbol || '',
            name: trx.name || '',
            quantity: trx.quantity.toString(),
            price: trx.price.toString()
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({ action: 'buy', date: new Date().toISOString().split('T')[0], region: 'KR', account: '일반', symbol: '', name: '', quantity: '', price: '' });
    };

    const handleDeleteClick = (id) => {
        setDeletingId(id);
    };

    const confirmDelete = async (id) => {
        try {
            await deleteTransaction(id);
            alert("삭제 성공!");
        } catch (e) {
            alert("삭제 실패: " + e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const cancelDelete = () => {
        setDeletingId(null);
    };

    const handleSubmit = async () => {
        try {
            const isCashBalanceMatch = activeTab === 'cash' && !editingId;

            if (isCashBalanceMatch) {
                if (!formData.name || !formData.quantity || !formData.date) {
                    alert("필수 항목을 모두 입력해주세요 (기관명, 현재 잔고, 날짜).");
                    return;
                }
            } else {
                if (!formData.name || !formData.quantity || !formData.price || !formData.action || !formData.date) {
                    alert("필수 항목을 모두 입력해주세요 (종목명, 수량, 단가, 날짜, 매수/매도).");
                    return;
                }
            }

            if (editingId) {
                await updateTransaction(editingId, {
                    type: activeTab,
                    region: formData.region,
                    account: formData.account || '일반',
                    symbol: formData.symbol.toUpperCase(),
                    name: formData.name,
                    action: formData.action,
                    date: formData.date,
                    quantity: parseFloat(formData.quantity),
                    price: parseFloat(formData.price)
                });
                cancelEdit();
            } else if (isCashBalanceMatch) {
                const targetBalance = parseFloat(formData.quantity);
                const exchangeRate = formData.region === 'US' ? (currentExchangeRate || 1400) : 1;

                // Find existing asset to get current balance
                const existingAsset = assets.find(a => a.type === 'cash' && a.region === formData.region && a.name === formData.name);
                const currentBalance = existingAsset ? existingAsset.quantity : 0;

                const diff = targetBalance - currentBalance;

                if (diff === 0) {
                    return;
                }

                const action = diff > 0 ? 'buy' : 'sell';
                const transactionQuantity = Math.abs(diff);

                await addAsset({
                    type: 'cash',
                    action: action,
                    date: formData.date,
                    region: formData.region,
                    symbol: formData.symbol || formData.name, // Use name as symbol
                    name: formData.name,
                    quantity: transactionQuantity,
                    price: exchangeRate
                });

                setFormData(prev => ({ ...prev, name: '', quantity: '', price: '' }));
            } else {
                await addAsset({
                    type: activeTab,
                    action: formData.action,
                    date: formData.date,
                    region: formData.region,
                    account: formData.account || '일반',
                    symbol: formData.symbol.toUpperCase(),
                    name: formData.name,
                    quantity: parseFloat(formData.quantity),
                    price: parseFloat(formData.price)
                });

                setFormData(prev => ({ ...prev, symbol: '', name: '', quantity: '', price: '' }));
            }
        } catch (e) {
            console.error("오류 발생: " + e.message);
        }
    };

    const formatCurrency = (val, region = 'KR') => {
        if (region === 'US') {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KRW' }).format(val);
    };

    const filteredTransactions = transactions?.filter(t => t.type === activeTab) || [];
    const filteredAssets = assets.filter(a => a.type === activeTab);
    const totalCategoryValue = filteredAssets.reduce((sum, a) => sum + (a.totalValue || 0), 0);

    return (
        <div className="bg-[#f5f7f8] min-h-screen text-slate-900 font-sans flex flex-col">
            <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 px-6 py-4 bg-white sticky top-0 z-50">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3 text-slate-900">
                        <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-50 text-[#0d7ff2]">
                            <Wallet size={20} />
                        </div>
                        <h2 className="text-lg font-bold leading-tight tracking-tight">Asset Master</h2>
                    </div>
                    <nav className="hidden md:flex items-center gap-6">
                        <Link href="/" className="text-slate-500 text-sm font-medium hover:text-[#0d7ff2] transition-colors">대시보드</Link>
                        <span className="text-slate-900 text-sm font-semibold cursor-pointer">자산 입력</span>
                    </nav>
                </div>
                <div className="flex items-center gap-4">
                    <label className="hidden sm:flex flex-col min-w-40 h-9 max-w-64 relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Search size={18} />
                        </div>
                        <input className="block w-full h-full rounded-full bg-slate-100 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-[#0d7ff2]" placeholder="Search assets..." />
                    </label>
                </div>
            </header>

            <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-3xl sm:text-4xl font-black leading-tight">자산 관리 목록</h1>
                        <p className="text-slate-500 max-w-2xl text-sm">
                            거래 내역을 기록하여 포트폴리오를 관리하세요. (Date 및 Buy/Sell 항목 추가)
                        </p>
                    </div>
                </div>

                <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="border-b border-slate-200">
                        <div className="flex px-6 gap-8 overflow-x-auto border-b border-slate-200">
                            {[
                                { id: 'stock', icon: CandlestickChart, label: '주식 (Stocks)' },
                                { id: 'pension', icon: PiggyBank, label: '연금 (Pension)' },
                                { id: 'cash', icon: Banknote, label: '현금 (Cash)' },
                                { id: 'real_estate', icon: Building, label: '부동산 (Real Est.)' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 pb-3 pt-4 px-2 border-b-[3px] transition-all ${activeTab === tab.id ? 'border-[#0d7ff2] text-[#0d7ff2]' : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'}`}
                                >
                                    <tab.icon size={20} />
                                    <p className="text-sm font-bold">{tab.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 pb-4 border-b border-slate-100 bg-slate-50/50">
                        <h3 className="text-md font-bold mb-3 text-slate-800">{activeTab === 'cash' ? '현금 현황 입력' : '새로운 거래 기록 추가'}</h3>
                        <div className="flex flex-wrap items-end gap-3 bg-white p-4 rounded border border-slate-200 shadow-sm">
                            {activeTab === 'cash' && !editingId ? (
                                <>
                                    <div className="flex flex-col gap-1 min-w-[130px]">
                                        <label className="text-xs font-semibold text-slate-500">날짜</label>
                                        <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1 min-w-[200px] relative">
                                        <label className="text-xs font-semibold text-slate-500">금융 기관명 (자산 이름)</label>
                                        <div
                                            className="border border-slate-300 rounded px-2 py-1.5 text-sm flex justify-between items-center cursor-pointer bg-white"
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        >
                                            <span className={formData.name ? "text-slate-900" : "text-slate-400"}>
                                                {formData.name || "기관 선택..."}
                                            </span>
                                            <ChevronDown size={16} className="text-slate-400" />
                                        </div>
                                        {isDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                                                {cashInstitutions.map((inst, idx) => (
                                                    <div key={idx} className="flex justify-between items-center px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0" onClick={() => handleInstitutionSelect(inst)}>
                                                        <span className="text-sm font-medium text-slate-700">{inst}</span>
                                                        <button
                                                            onClick={(e) => removeInstitution(inst, e)}
                                                            className="text-slate-300 hover:text-red-500 p-1"
                                                            title="삭제"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="p-2 flex gap-2 border-t border-slate-200 bg-slate-50">
                                                    <input
                                                        type="text"
                                                        value={newInstitution}
                                                        onChange={(e) => setNewInstitution(e.target.value)}
                                                        placeholder="새 기관 입력..."
                                                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => e.key === 'Enter' && addInstitution()}
                                                    />
                                                    <button onClick={addInstitution} className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded transition-colors">
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[100px]">
                                        <label className="text-xs font-semibold text-slate-500">통화</label>
                                        <select name="region" value={formData.region} onChange={handleInputChange} className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-slate-50">
                                            <option value="KR">KRW (원화)</option>
                                            <option value="US">USD (달러)</option>
                                        </select>
                                    </div>
                                    {/* Removed exchange rate input as per request */}
                                    <div className="flex flex-col gap-1 min-w-[150px]">
                                        <label className="text-xs font-semibold text-slate-500">현재 총 잔고 (예상 금액)</label>
                                        <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} placeholder="Ex: 5000000" className="border border-slate-300 rounded px-2 py-1.5 text-sm text-right font-mono" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                        <label className="text-xs font-semibold text-slate-500">거래 조건 (매수/매도)</label>
                                        <select name="action" value={formData.action} onChange={handleInputChange} className="border border-slate-300 rounded px-2 py-1.5 text-sm">
                                            <option value="buy">매수 (Buy)</option>
                                            <option value="sell">매도 (Sell)</option>
                                        </select>
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[130px]">
                                        <label className="text-xs font-semibold text-slate-500">날짜</label>
                                        <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[130px] relative">
                                        <label className="text-xs font-semibold text-slate-500">구분 (계좌)</label>
                                        <div
                                            className="border border-slate-300 rounded px-2 py-1.5 text-sm flex justify-between items-center cursor-pointer bg-white"
                                            onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                                        >
                                            <span className={formData.account ? "text-slate-900" : "text-slate-400"}>
                                                {formData.account || "일반"}
                                            </span>
                                            <ChevronDown size={16} className="text-slate-400" />
                                        </div>
                                        {isAccountDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-60 overflow-y-auto">
                                                {accountTypes.map((type, idx) => (
                                                    <div key={idx} className="flex justify-between items-center px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0" onClick={() => handleAccountSelect(type)}>
                                                        <span className="text-sm font-medium text-slate-700">{type}</span>
                                                        <button
                                                            onClick={(e) => removeAccountType(type, e)}
                                                            className="text-slate-300 hover:text-red-500 p-1"
                                                            title="삭제"
                                                        >
                                                            <Trash size={14} />
                                                        </button>
                                                    </div>
                                                ))}
                                                <div className="p-2 flex gap-2 border-t border-slate-200 bg-slate-50">
                                                    <input
                                                        type="text"
                                                        value={newAccountType}
                                                        onChange={(e) => setNewAccountType(e.target.value)}
                                                        placeholder="새 항목..."
                                                        className="flex-1 w-full border border-slate-300 rounded px-2 py-1 text-sm bg-white"
                                                        onClick={(e) => e.stopPropagation()}
                                                        onKeyDown={(e) => e.key === 'Enter' && addAccountType()}
                                                    />
                                                    <button onClick={(e) => { e.preventDefault(); addAccountType(); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1.5 rounded transition-colors">
                                                        <Plus size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {(activeTab === 'stock' || activeTab === 'cash') && (
                                        <div className="flex flex-col gap-1 min-w-[100px]">
                                            <label className="text-xs font-semibold text-slate-500">통화/국가</label>
                                            <select name="region" value={formData.region} onChange={handleInputChange} className="border border-slate-300 rounded px-2 py-1.5 text-sm bg-slate-50">
                                                <option value="KR">한국 (원화)</option>
                                                <option value="US">미국 (달러)</option>
                                            </select>
                                        </div>
                                    )}
                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                        <label className="text-xs font-semibold text-slate-500">종목코드 (심볼)</label>
                                        <input name="symbol" value={formData.symbol} onChange={handleInputChange} placeholder={activeTab === 'cash' ? "Ex: NH" : "Ex: 005930"} className="border border-slate-300 rounded px-2 py-1.5 text-sm uppercase" />
                                    </div>
                                    <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                                        <label className="text-xs font-semibold text-slate-500">자산 이름</label>
                                        <input name="name" value={formData.name} onChange={handleInputChange} placeholder="Ex: 삼성전자" className="border border-slate-300 rounded px-2 py-1.5 text-sm" />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[120px]">
                                        <label className="text-xs font-semibold text-slate-500">체결 단가 (환율)</label>
                                        <input type="number" name="price" value={formData.price} onChange={handleInputChange} placeholder={activeTab === 'cash' ? "원화는 1" : "0"} className="border border-slate-300 rounded px-2 py-1.5 text-sm text-right font-mono" />
                                    </div>
                                    <div className="flex flex-col gap-1 min-w-[100px]">
                                        <label className="text-xs font-semibold text-slate-500">거래 수량</label>
                                        <input type="number" name="quantity" value={formData.quantity} onChange={handleInputChange} placeholder="0" className="border border-slate-300 rounded px-2 py-1.5 text-sm text-right font-mono" />
                                    </div>
                                </>
                            )}
                            <div className="flex flex-col justify-end gap-2 flex-row">
                                {editingId && (
                                    <button onClick={cancelEdit} disabled={loading} className="h-[34px] px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 font-semibold rounded shadow-sm transition-colors flex items-center justify-center gap-1">
                                        <X size={16} /> 취소
                                    </button>
                                )}
                                <button onClick={handleSubmit} disabled={loading} className="h-[34px] px-4 bg-[#0d7ff2] hover:bg-blue-600 disabled:bg-blue-300 text-white font-bold rounded shadow-sm transition-colors flex items-center justify-center gap-1">
                                    {editingId ? <><Edit2 size={16} /> 수정하기</> : <><Check size={16} /> 추가하기</>}
                                </button>
                            </div>
                        </div>
                        {loading && <div className="text-sm mt-2 text-[#0d7ff2] animate-pulse">요청을 처리중입니다...</div>}
                    </div>

                    <div className="p-4 sm:p-6 pb-4 flex justify-between items-center bg-white border-b border-slate-200">
                        <h3 className="text-md font-bold text-slate-800">
                            {activeTab === 'cash' ? '현금 현황' : '거래 내역 (Transaction History)'}
                        </h3>
                        {activeTab === 'cash' && currentExchangeRate && (
                            <div className="text-sm font-semibold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                                <span className="text-slate-400">USD/KRW:</span>
                                <span className="text-[#0d7ff2]">{currentExchangeRate.toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 원</span>
                            </div>
                        )}
                    </div>

                    <div className="p-0 sm:p-6 sm:pt-4">
                        <div className="border border-slate-200 rounded-lg overflow-x-auto">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead className="uppercase tracking-wider border-b border-slate-200 bg-slate-50 text-slate-500">
                                    {activeTab === 'cash' ? (
                                        <tr className="table-fixed w-full">
                                            <th className="px-4 py-3 font-semibold w-1/6">날짜</th>
                                            <th className="px-4 py-3 font-semibold w-1/6">금융기관명</th>
                                            <th className="px-4 py-3 font-semibold w-1/6">통화</th>
                                            <th className="px-4 py-3 font-semibold text-right w-1/6">금액</th>
                                            <th className="px-4 py-3 font-semibold text-center w-1/6">증감</th>
                                            <th className="px-4 py-3 font-semibold text-center w-1/6">관리</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-center w-16">국가</th>
                                            <th className="px-4 py-3 font-semibold w-24">구분</th>
                                            <th className="px-4 py-3 font-semibold w-24">유형</th>
                                            <th className="px-4 py-3 font-semibold w-24">날짜</th>
                                            <th className="px-4 py-3 font-semibold w-24">종목코드</th>
                                            <th className="px-4 py-3 font-semibold min-w-[150px]">이름</th>
                                            <th className="px-4 py-3 font-semibold text-right">체결 단가</th>
                                            <th className="px-4 py-3 font-semibold text-right">수량</th>
                                            <th className="px-4 py-3 font-semibold text-right">총액</th>
                                            <th className="px-4 py-3 font-semibold text-center w-24">관리</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredTransactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={activeTab === 'cash' ? "6" : "10"} className="p-8 text-center text-slate-500">해당 카테고리의 거래 내역이 없습니다. (No Transactions)</td>
                                        </tr>
                                    ) : (
                                        filteredTransactions.map(trx => (
                                            <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                                                {activeTab === 'cash' ? (
                                                    // Cash Table Row Rendering
                                                    <>
                                                        <td className="px-4 py-3 text-slate-500">{trx.date}</td>
                                                        <td className="px-4 py-3 text-slate-800 font-bold">{trx.name}</td>
                                                        <td className="px-4 py-3 font-bold text-slate-700 bg-slate-50/50">
                                                            {trx.region === 'US' ? '달러 (USD)' : '원 (KRW)'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-900 font-bold font-mono">
                                                            {formatCurrency(trx.quantity, trx.region)}
                                                        </td>
                                                        <td className={`px-4 py-3 font-bold text-center ${trx.action === 'buy' ? 'text-green-500' : 'text-[#ff4d4f]'}`}>
                                                            {trx.action === 'buy' ? '증가' : '감소'}
                                                        </td>
                                                    </>
                                                ) : (
                                                    // Original Table Row Rendering
                                                    <>
                                                        <td className="px-4 py-3 font-bold text-center text-slate-700 bg-slate-50/50">
                                                            {trx.region === 'US' ? '🇺🇸' : trx.region === 'KR' ? '🇰🇷' : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-700 font-medium">
                                                            {trx.account || '일반'}
                                                        </td>
                                                        <td className={`px-4 py-3 font-bold ${trx.action === 'buy' ? 'text-red-500' : 'text-blue-500'}`}>
                                                            {trx.action === 'buy' ? '매수' : '매도'}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-500">{trx.date}</td>
                                                        <td className="px-4 py-3 font-medium text-slate-900">{trx.symbol || '-'}</td>
                                                        <td className="px-4 py-3 text-slate-600 font-medium">{trx.name}</td>
                                                        <td className="px-4 py-3 text-right text-slate-600 font-mono">{formatCurrency(trx.price, trx.region)}</td>
                                                        <td className="px-4 py-3 text-right text-slate-600 font-mono">{trx.quantity.toLocaleString()}</td>
                                                        <td className="px-4 py-3 text-right text-slate-900 font-bold font-mono">{formatCurrency(trx.price * trx.quantity, trx.region)}</td>
                                                    </>
                                                )}
                                                {/* Common Management Actions Column */}
                                                <td className="px-4 py-3 text-center">
                                                    {deletingId === trx.id ? (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <span className="text-xs text-red-500 font-bold mr-1">삭제콜?</span>
                                                            <button onClick={() => confirmDelete(trx.id)} className="px-2 py-1 text-white bg-red-500 hover:bg-red-600 rounded text-xs font-bold transition-colors">Y</button>
                                                            <button onClick={cancelDelete} className="px-2 py-1 text-slate-500 bg-slate-200 hover:bg-slate-300 rounded text-xs transition-colors">N</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={() => handleEdit(trx)}
                                                                className="p-1.5 text-slate-400 hover:text-[#0d7ff2] hover:bg-blue-50 rounded transition-colors"
                                                                title="수정"
                                                            >
                                                                <Edit2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteClick(trx.id)}
                                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                                                title="삭제"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
