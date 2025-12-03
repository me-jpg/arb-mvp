// dashboard/src/store.js
import { create } from 'zustand';

export const useStore = create((set) => ({
  lineChanges: [],
  latencyMetrics: [],
  arbitrageOpportunities: [],
  wsConnected: false,

  addLineChange: (change) => set((state) => ({
    lineChanges: [{ ...change, timestamp: Date.now() }, ...state.lineChanges].slice(0, 50)
  })),

  setLatencyMetrics: (metrics) => set({ latencyMetrics: metrics }),

  addArbitrageOpportunity: (opp) => set((state) => ({
    arbitrageOpportunities: [
      { ...opp, timestamp: Date.now() }, 
      ...state.arbitrageOpportunities
    ].slice(0, 20) // Keep last 20
  })),

  setWsConnected: (connected) => set({ wsConnected: connected })
}));