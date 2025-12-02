import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Connection state
  connected: false,
  lastPing: null,
  
  // Line changes feed
  lineChanges: [],
  maxChanges: 100,
  
  // Latency metrics
  latencyMetrics: {},
  
  // Stats
  stats: {
    totalChanges: 0,
    cycleCount: 0,
    uptime: 0
  },
  
  // Actions
  setConnected: (connected) => set({ connected }),
  
  setLastPing: (timestamp) => set({ lastPing: timestamp }),
  
  addLineChange: (change) => set((state) => {
    const newChanges = [change, ...state.lineChanges].slice(0, state.maxChanges)
    return { 
      lineChanges: newChanges,
      stats: {
        ...state.stats,
        totalChanges: state.stats.totalChanges + 1
      }
    }
  }),
  
  setLatencyMetrics: (metrics) => set({ latencyMetrics: metrics }),
  
  updateStats: (newStats) => set((state) => ({
    stats: { ...state.stats, ...newStats }
  })),
  
  clearLineChanges: () => set({ lineChanges: [] }),
  
  // Computed getters
  getBookLatency: (book) => {
    const metrics = get().latencyMetrics
    return metrics[book] || null
  },
  
  getRecentChanges: (count = 10) => {
    return get().lineChanges.slice(0, count)
  }
}))


