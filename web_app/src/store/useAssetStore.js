import { create } from 'zustand';

const useAssetStore = create((set, get) => ({
    assets: [],
    history: [],
    transactions: [],
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

    fetchHistory: async () => {
        try {
            const res = await fetch('/api/history');
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            set({ history: data });
        } catch (error) {
            console.error(error);
        }
    },

    fetchTransactions: async () => {
        try {
            const res = await fetch('/api/history'); // Using history endpoint as shortcut since transactions route wasn't created, or create transactions route. Wait, history yields month groups. I will create an api/transactions/route.js later or fetch from assets. Let's create transactions fetch.
            // I should use api/transactions
            const txRes = await fetch('/api/transactions');
            if (!txRes.ok) throw new Error('Failed to fetch transactions');
            const data = await txRes.json();
            set({ transactions: data });
        } catch (error) {
            console.error(error);
        }
    },

    getSummary: () => {
        const { assets } = get();

        // overall
        const totalAssets = assets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const totalPrincipal = assets.reduce((sum, a) => sum + (a.principal || 0), 0);
        const totalProfit = totalAssets - totalPrincipal;
        const profitRate = totalPrincipal > 0 ? (totalProfit / totalPrincipal) * 100 : 0;
        const dayChange = assets.reduce((sum, a) => sum + (a.dayChange || 0), 0);

        // stock
        const stockAssets = assets.filter(a => a.type === 'stock');
        const totalStock = stockAssets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const stockPrincipal = stockAssets.reduce((sum, a) => sum + (a.principal || 0), 0);
        const stockProfit = totalStock - stockPrincipal;
        const stockRate = stockPrincipal > 0 ? (stockProfit / stockPrincipal) * 100 : 0;

        // pension
        const pensionAssets = assets.filter(a => a.type === 'pension');
        const totalPension = pensionAssets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const pensionPrincipal = pensionAssets.reduce((sum, a) => sum + (a.principal || 0), 0);
        const pensionProfit = totalPension - pensionPrincipal;
        const pensionRate = pensionPrincipal > 0 ? (pensionProfit / pensionPrincipal) * 100 : 0;

        // cash
        const cashAssets = assets.filter(a => a.type === 'cash');
        const totalCash = cashAssets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
        const cashPrincipal = cashAssets.reduce((sum, a) => sum + (a.principal || 0), 0);
        const cashProfit = totalCash - cashPrincipal;
        const cashRate = cashPrincipal > 0 ? (cashProfit / cashPrincipal) * 100 : 0;

        return {
            totalAssets, totalProfit, profitRate, dayChange,
            totalStock, stockProfit, stockRate,
            totalPension, pensionProfit, pensionRate,
            totalCash, cashProfit, cashRate,
        };
    }
}));

export default useAssetStore;
