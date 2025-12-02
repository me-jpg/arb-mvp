import { useWebSocket } from './useWebSocket'
import { useStore } from './store'
import ConnectionStatus from './components/ConnectionStatus'
import LatencyPanel from './components/LatencyPanel'
import LineChangeFeed from './components/LineChangeFeed'

function App() {
  useWebSocket()
  const { stats, lineChanges } = useStore()
  
  return (
    <div className="min-h-screen bg-midnight p-6">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display gradient-text">
              ⚡ ARB Dashboard
            </h1>
            <p className="text-zinc-500 mt-1">
              Real-time arbitrage monitoring
            </p>
          </div>
          <ConnectionStatus />
        </div>
        
        {/* Quick Stats Bar */}
        <div className="mt-6 grid grid-cols-4 gap-4">
          <StatCard 
            label="Total Changes" 
            value={stats.totalChanges} 
            icon="🔄"
          />
          <StatCard 
            label="Active Lines" 
            value={lineChanges.length} 
            icon="📊"
          />
          <StatCard 
            label="Cycles" 
            value={stats.cycleCount} 
            icon="⚡"
          />
          <StatCard 
            label="Uptime" 
            value={formatUptime(stats.uptime)} 
            icon="⏱️"
          />
        </div>
      </header>
      
      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Latency Panel - Left */}
        <div className="col-span-4">
          <LatencyPanel />
        </div>
        
        {/* Line Change Feed - Right */}
        <div className="col-span-8">
          <LineChangeFeed />
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon }) {
  return (
    <div className="panel flex items-center gap-3">
      <span className="text-2xl">{icon}</span>
      <div>
        <div className="text-2xl font-bold mono text-white">{value}</div>
        <div className="text-xs text-zinc-500 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  )
}

function formatUptime(ms) {
  if (!ms) return '0s'
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

export default App


