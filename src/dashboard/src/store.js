import { create } from 'zustand';

export const useStore = create((set) => ({
  // Line changes state
  lineChanges: [],
  addLineChange: (change) => set((state) => ({
    lineChanges: [...state.lineChanges, change].slice(-50), // Keep last 50
  })),

  // Latency metrics state
  latencyMetrics: [],
  setLatencyMetrics: (metrics) => set({ latencyMetrics: metrics }),

  // WebSocket connection state
  wsConnected: false,
  setWsConnected: (connected) => set({ wsConnected: connected }),
}));