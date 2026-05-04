"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const api = {
    getDashboard: (month) => electron_1.ipcRenderer.invoke('cashflow:get-dashboard', month),
    getRecentTransactions: (limit = 10) => electron_1.ipcRenderer.invoke('cashflow:get-recent-transactions', limit),
    getTransactions: (filters) => electron_1.ipcRenderer.invoke('cashflow:get-transactions', filters),
    getSpendingBreakdown: (month, bankId) => electron_1.ipcRenderer.invoke('cashflow:get-spending-breakdown', month, bankId),
    getBanks: () => electron_1.ipcRenderer.invoke('cashflow:get-banks'),
    updateBank: (payload) => electron_1.ipcRenderer.invoke('cashflow:update-bank', payload),
    addManualTransaction: (payload) => electron_1.ipcRenderer.invoke('cashflow:add-manual-transaction', payload),
    deleteTransaction: (id) => electron_1.ipcRenderer.invoke('cashflow:delete-transaction', id),
    getExistingKeys: (candidates) => electron_1.ipcRenderer.invoke('cashflow:get-existing-keys', candidates),
    importTransactions: (rows) => electron_1.ipcRenderer.invoke('cashflow:import-transactions', rows),
    clearAllData: () => electron_1.ipcRenderer.invoke('cashflow:clear-all'),
    onOpenImport: (cb) => electron_1.ipcRenderer.on('open-import', () => cb()),
};
electron_1.contextBridge.exposeInMainWorld('cashflow', api);
