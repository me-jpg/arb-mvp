import { useStore } from '../store'

const BOOK_COLORS = {
  draftkings: '#53d769',
  fanduel: '#1877f2', 
  betmgm: '#c4a747',
  espnbet: '#d00'
}

const BOOK_NAMES = {
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  betmgm: 'BetMGM',
  espnbet: 'ESPN Bet'
}

export default function LatencyPanel() {
  const { latencyMetrics } = useStore()
  
  const books = Object.entries(latencyMetrics)
  const hasData = books.length > 0
  
  // Sort by average latency (fastest first)
  const sortedBooks = [...books].sort((a, b) => {
    return (a[1]?.avgMs || 999999) - (b[1]?.avgMs || 999999)
  })
  
  return (
    <div className="panel h-full">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📡</span>
        Book Latency
      </h2>
      
      {!hasData ? (
        <div className="text-zinc-500 text-center py-8">
          <div className="text-4xl mb-2">📊</div>
          <div>Waiting for latency data...</div>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBooks.map(([book, metrics], index) => (
            <BookLatencyCard 
              key={book} 
              book={book} 
              metrics={metrics}
              rank={index + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function BookLatencyCard({ book, metrics, rank }) {
  const color = BOOK_COLORS[book] || '#888'
  const name = BOOK_NAMES[book] || book
  
  const avgMs = metrics?.avgMs || 0
  const minMs = metrics?.minMs || 0
  const maxMs = metrics?.maxMs || 0
  const samples = metrics?.samples || 0
  
  // Determine latency quality
  const quality = avgMs < 500 ? 'fast' : avgMs < 1500 ? 'medium' : 'slow'
  const qualityColors = {
    fast: 'text-accent-green',
    medium: 'text-accent-amber',
    slow: 'text-accent-red'
  }
  
  // Calculate bar width (max 3000ms)
  const barWidth = Math.min((avgMs / 3000) * 100, 100)
  
  return (
    <div 
      className="bg-midnight/50 rounded-lg p-3 border-l-4 animate-fade-in"
      style={{ borderLeftColor: color }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">#{rank}</span>
          <span className="font-medium text-white">{name}</span>
        </div>
        <span className={`mono text-lg font-bold ${qualityColors[quality]}`}>
          {avgMs.toFixed(0)}ms
        </span>
      </div>
      
      {/* Latency bar */}
      <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ 
            width: `${barWidth}%`,
            backgroundColor: color
          }}
        />
      </div>
      
      {/* Stats row */}
      <div className="flex justify-between text-xs text-zinc-500 mono">
        <span>min: {minMs.toFixed(0)}ms</span>
        <span>max: {maxMs.toFixed(0)}ms</span>
        <span>{samples} samples</span>
      </div>
    </div>
  )
}


