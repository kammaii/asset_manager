import { create } from 'zustand';

const useAssetStore = create((set, get) => ({
    assets: [],
    history: [],
    dailyHistory: [],
    transactions: [],
    accountTypes: [],
    cashInstitutions: [],
    loading: false,
    error: null,

    fetchAssets: async () => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/assets');
            if (!res.ok) throw new Error('Failed to fetch assets');
            const data = await res.json();
            set({ assets: data, loading: false });
        } catch (error) {
            set({ error: error.message, loading: false });
        }
    },

    addAsset: async (assetData) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch('/api/assets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(assetData),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Failed to process transaction');
            }
            await get().fetchAssets();
            await get().fetchTransactions();
        } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    deleteTransaction: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete transaction');
            await get().fetchAssets();
            await get().fetchTransactions();
        } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    deleteAsset: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/assets/${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete asset');
            await get().fetchAssets();
            await get().fetchTransactions();
        } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    updateTransaction: async (id, updatedData) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });
            if (!res.ok) throw new Error('Failed to update transaction');
            await get().fetchAssets();
            await get().fetchTransactions();
        } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    updateAsset: async (id, updatedData) => {
        set({ loading: true, error: null });
        try {
            const res = await fetch(`/api/assets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData),
            });
            if (!res.ok) throw new Error('Failed to update asset');
            await get().fetchAssets();
            await get().fetchTransactions();
        } catch (error) {
            set({ error: error.message, loading: false });
            throw error;
        }
    },

    fetchHistory: async () => {
        try {
            const [monthlyRes, dailyRes] = await Promise.all([
                fetch('/api/history?type=monthly'),
                fetch('/api/history?type=daily')
            ]);
            let historyData = [];
            let dailyHistoryData = [];
            if (monthlyRes.ok) historyData = await monthlyRes.json();
            if (dailyRes.ok) dailyHistoryData = await dailyRes.json();

            set({ history: historyData, dailyHistory: dailyHistoryData });
        } catch (error) {
            console.error(error);
        }
    },

    fetchTransactions: async () => {
        try {
            const txRes = await fetch('/api/transactions');
            if (!txRes.ok) throw new Error('Failed to fetch transactions');
            const data = await txRes.json();
            set({ transactions: data });
        } catch (error) {
            console.error(error);
        }
    },

    fetchSettings: async () => {
        try {
            const res = await fetch('/api/settings');
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            set({
                accountTypes: data.accountTypes || ['키움증권', 'NH투자증권', '미래에셋', 'IRP', 'ISA', '일반'],
                cashInstitutions: data.cashInstitutions || ['NH투자증권', '토스뱅크', '카카오뱅크', 'KB국민은행', '신한은행']
            });
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    },

    updateSettings: async (newSettings) => {
        try {
            // Optimistically update local state
            set((state) => ({ ...state, ...newSettings }));

            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings),
            });
            if (!res.ok) throw new Error('Failed to update settings');
        } catch (error) {
            console.error('Failed to save settings:', error);
            // Revert might be needed here ideally, but for now we log it.
        }
    },

    getSummary: (exchangeRate = 1400) => {
        const { assets } = get();

        const convert = (val, asset) => (asset.region === 'US' && asset.type !== 'cash' ? (val || 0) * exchangeRate : (val || 0));

        // overall
        const totalAssets = assets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
        const totalPrincipal = assets.reduce((sum, a) => sum + convert(a.netInvestment !== undefined ? a.netInvestment : a.principal, a), 0);
        const totalProfit = assets.reduce((sum, a) => sum + convert(a.profitGain, a), 0);
        const profitRate = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;
        const dayChange = assets.reduce((sum, a) => sum + convert(a.dayChange, a), 0);

        // stock
        const stockAssets = assets.filter(a => a.type === 'stock');
        const totalStock = stockAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
        const stockPrincipal = stockAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
        const stockProfit = totalStock - stockPrincipal;
        const stockRate = stockPrincipal > 0 ? (stockProfit / stockPrincipal) * 100 : 0;

        // pension
        const pensionAssets = assets.filter(a => a.type === 'pension');
        const totalPension = pensionAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
        const pensionPrincipal = pensionAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
        const pensionProfit = totalPension - pensionPrincipal;
        const pensionRate = pensionPrincipal > 0 ? (pensionProfit / pensionPrincipal) * 100 : 0;

        // cash
        const cashAssets = assets.filter(a => a.type === 'cash');
        const totalCash = cashAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
        const cashPrincipal = cashAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
        const cashProfit = totalCash - cashPrincipal;
        const cashRate = cashPrincipal > 0 ? (cashProfit / cashPrincipal) * 100 : 0;

        // real_estate
        const realEstateAssets = assets.filter(a => a.type === 'real_estate');
        const totalRealEstate = realEstateAssets.reduce((sum, a) => sum + convert((a.netInvestment || 0) + (a.profitGain || 0), a), 0);
        const realEstatePrincipal = realEstateAssets.reduce((sum, a) => sum + convert(a.netInvestment || 0, a), 0);
        const realEstateProfit = realEstateAssets.reduce((sum, a) => sum + convert(a.profitGain || 0, a), 0);
        const realEstateRate = realEstatePrincipal > 0 ? (realEstateProfit / realEstatePrincipal) * 100 : 0;

        return {
            totalAssets, totalProfit, profitRate, dayChange,
            totalStock, stockProfit, stockRate,
            totalPension, pensionProfit, pensionRate,
            totalCash, cashProfit, cashRate,
            totalRealEstate, realEstateProfit, realEstateRate,
        };
    }
}));

export default useAssetStore;
