import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useAssetStore = create(
    persist(
        (set, get) => ({
            assets: [],
            history: [],
            dailyHistory: [],
            transactions: [],
            allTransactionsLoaded: false,
            accountTypes: [],
            cashInstitutions: [],
            savedStockItems: [],
            savedPensionItems: [],
            savedCryptoItems: [],
            enabledAssetTypes: ['stock', 'crypto', 'cash', 'pension', 'gold', 'real_estate', 'car'],
            loading: false,
            error: null,

            fetchAssets: async () => {
                set({ loading: true, error: null });
                try {
                    const res = await fetch('/api/assets');
                    if (!res.ok) throw new Error('Failed to fetch assets');
                    const data = await res.json();

                    // Generate savedStockItems and savedPensionItems from existing assets if not exist
                    const state = get();
                    const currentStockItems = [...(state.savedStockItems || [])];
                    const currentPensionItems = [...(state.savedPensionItems || [])];
                    let hasNewStockItem = false;
                    let hasNewPensionItem = false;
                    const updatePayload = {};

                    data.forEach(asset => {
                        if (asset.type === 'stock' && asset.symbol && asset.name) {
                            const exists = currentStockItems.some(i => i.symbol === asset.symbol && i.name === asset.name);
                            if (!exists) {
                                currentStockItems.push({ symbol: asset.symbol, name: asset.name });
                                hasNewStockItem = true;
                            }
                        } else if (asset.type === 'pension' && asset.symbol && asset.name) {
                            const exists = currentPensionItems.some(i => i.symbol === asset.symbol && i.name === asset.name);
                            if (!exists) {
                                currentPensionItems.push({ symbol: asset.symbol, name: asset.name });
                                hasNewPensionItem = true;
                            }
                        } else if (asset.type === 'crypto' && asset.symbol && asset.name) {
                            const exists = (state.savedCryptoItems || []).some(i => i.symbol === asset.symbol && i.name === asset.name);
                            if (!exists) {
                                if (!updatePayload.savedCryptoItems) updatePayload.savedCryptoItems = [...(state.savedCryptoItems || [])];
                                // Prevent duplicates within the payload in the same pass
                                const payloadExists = updatePayload.savedCryptoItems.some(i => i.symbol === asset.symbol && i.name === asset.name);
                                if (!payloadExists) {
                                    updatePayload.savedCryptoItems.push({ symbol: asset.symbol, name: asset.name });
                                }
                            }
                        }
                    });

                    if (hasNewStockItem || hasNewPensionItem || updatePayload.savedCryptoItems) {
                        // Update settings silently with the new generated items using current local state to merge if needed
                        if (hasNewStockItem) updatePayload.savedStockItems = currentStockItems;
                        if (hasNewPensionItem) updatePayload.savedPensionItems = currentPensionItems;

                        fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(updatePayload)
                        });
                        if (hasNewStockItem) set({ savedStockItems: currentStockItems });
                        if (hasNewPensionItem) set({ savedPensionItems: currentPensionItems });
                        if (updatePayload.savedCryptoItems) set({ savedCryptoItems: updatePayload.savedCryptoItems });
                    }

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

            fetchTransactions: async (forceAll = false) => {
                try {
                    const shouldLoadAll = forceAll || get().allTransactionsLoaded;
                    const limit = shouldLoadAll ? 'all' : '20';
                    const txRes = await fetch(`/api/transactions?limit=${limit}`);
                    if (!txRes.ok) throw new Error('Failed to fetch transactions');
                    const data = await txRes.json();
                    set({ transactions: data, allTransactionsLoaded: shouldLoadAll });
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
                        cashInstitutions: data.cashInstitutions || ['NH투자증권', '토스뱅크', '카카오뱅크', 'KB국민은행', '신한은행'],
                        savedStockItems: data.savedStockItems || [],
                        savedPensionItems: data.savedPensionItems || [],
                        savedCryptoItems: data.savedCryptoItems || [],
                        enabledAssetTypes: (() => {
                            let types = data.enabledAssetTypes || ['stock', 'pension', 'cash', 'real_estate', 'gold', 'crypto', 'car'];
                            // Force append crypto and car if they are entirely missing from a legacy user's config
                            if (!types.includes('crypto')) types.push('crypto');
                            if (!types.includes('car')) types.push('car');
                            return [...new Set(types)];
                        })(),
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

                // gold
                const goldAssets = assets.filter(a => a.type === 'gold');
                const totalGold = goldAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
                const goldPrincipal = goldAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
                const goldProfit = totalGold - goldPrincipal;
                const goldRate = goldPrincipal > 0 ? (goldProfit / goldPrincipal) * 100 : 0;

                // crypto
                const cryptoAssets = assets.filter(a => a.type === 'crypto');
                const totalCrypto = cryptoAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
                const cryptoPrincipal = cryptoAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
                const cryptoProfit = totalCrypto - cryptoPrincipal;
                const cryptoRate = cryptoPrincipal > 0 ? (cryptoProfit / cryptoPrincipal) * 100 : 0;

                // car
                const carAssets = assets.filter(a => a.type === 'car');
                const totalCar = carAssets.reduce((sum, a) => sum + convert(a.totalValue, a), 0);
                const carPrincipal = carAssets.reduce((sum, a) => sum + convert(a.principal, a), 0);
                const carProfit = totalCar - carPrincipal;
                const carRate = carPrincipal > 0 ? (carProfit / carPrincipal) * 100 : 0;

                return {
                    totalAssets, totalPrincipal, totalProfit, profitRate, dayChange,
                    totalStock, stockProfit, stockRate, stockPrincipal,
                    totalPension, pensionProfit, pensionRate, pensionPrincipal,
                    totalCash, cashProfit, cashRate, cashPrincipal,
                    totalRealEstate, realEstateProfit, realEstateRate, realEstatePrincipal,
                    totalGold, goldProfit, goldRate, goldPrincipal,
                    totalCrypto, cryptoProfit, cryptoRate, cryptoPrincipal,
                    totalCar, carProfit, carRate, carPrincipal
                };
            },
        }),
        {
            name: 'asset-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                assets: state.assets,
                history: state.history,
                dailyHistory: state.dailyHistory,
                transactions: state.transactions.slice(0, 50), // Cache only latest 50 for speed
                accountTypes: state.accountTypes,
                cashInstitutions: state.cashInstitutions,
                savedStockItems: state.savedStockItems,
                savedPensionItems: state.savedPensionItems,
                savedCryptoItems: state.savedCryptoItems,
                enabledAssetTypes: state.enabledAssetTypes
            }),
        }
    )
);

export default useAssetStore;
