import { useStore } from '../store'

const CHANGE_TYPE_STYLES = {
  price_up: { icon: '📈', color: 'text-accent-green', bg: 'bg-accent-green/10' },
  price_down: { icon: '📉', color: 'text-accent-red', bg: 'bg-accent-red/10' },
  line_move: { icon: '↔️', color: 'text-accent-cyan', bg: 'bg-accent-cyan/10' },
  new: { icon: '🆕', color: 'text-accent-amber', bg: 'bg-accent-amber/10' },
  removed: { icon: '❌', color: 'text-zinc-500', bg: 'bg-zinc-500/10' }
}

const BOOK_BADGES = {
  draftkings: { label: 'DK', color: 'bg-green-600' },
  fanduel: { label: 'FD', color: 'bg-blue-600' },
  betmgm: { label: 'MGM', color: 'bg-yellow-600' },
  espnbet: { label: 'ESPN', color: 'bg-red-600' }
}

export default function LineChangeFeed() {
  const { lineChanges, clearLineChanges } = useStore()
  
  return (
    <div className="panel h-[600px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🔔</span>
          Line Changes
          {lineChanges.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-accent-cyan/20 text-accent-cyan text-sm rounded-full mono">
              {lineChanges.length}
            </span>
          )}
        </h2>
        
        {lineChanges.length > 0 && (
          <button 
            onClick={clearLineChanges}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      
      {/* Feed container */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {lineChanges.length === 0 ? (
          <div className="text-zinc-500 text-center py-12">
            <div className="text-5xl mb-3">📭</div>
            <div className="text-lg">No line changes yet</div>
            <div className="text-sm mt-1">Changes will appear here in real-time</div>
          </div>
        ) : (
          lineChanges.map((change, index) => (
            <LineChangeCard 
              key={`${change.receivedAt}-${index}`} 
              change={change}
              isNew={index === 0}
            />
          ))
        )}
      </div>
    </div>
  )
}

function LineChangeCard({ change, isNew }) {
  const typeStyle = CHANGE_TYPE_STYLES[change.changeType] || CHANGE_TYPE_STYLES.new
  const bookBadge = BOOK_BADGES[change.book] || { label: change.book, color: 'bg-zinc-600' }
  
  const timeAgo = formatTimeAgo(change.receivedAt)
  
  return (
    <div className={`
      rounded-lg p-3 border border-zinc-800/50 
      ${typeStyle.bg}
      ${isNew ? 'animate-slide-up' : ''}
      hover:border-zinc-700/50 transition-colors
    `}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Icon + Content */}
        <div className="flex items-start gap-3">
          <span className="text-xl">{typeStyle.icon}</span>
          
          <div>
            {/* Market info */}
            <div className="flex items-center gap-2 mb-1">
              <span className={`
                px-1.5 py-0.5 rounded text-xs font-medium text-white
                ${bookBadge.color}
              `}>
                {bookBadge.label}
              </span>
              <span className="text-white font-medium">
                {change.marketType}
              </span>
              <span className="text-zinc-400">
                {change.side}
              </span>
            </div>
            
            {/* Change details */}
            <div className="mono text-sm">
              {change.line && (
                <span className="text-zinc-400">
                  Line: <span className="text-zinc-600">{change.oldLine}</span>
                  <span className="mx-1">→</span>
                  <span className={typeStyle.color}>{change.line}</span>
                </span>
              )}
              {change.line && change.price && <span className="mx-2 text-zinc-700">|</span>}
              {change.price && (
                <span className="text-zinc-400">
                  Price: <span className="text-zinc-600">{formatOdds(change.oldPrice)}</span>
                  <span className="mx-1">→</span>
                  <span className={typeStyle.color}>{formatOdds(change.price)}</span>
                </span>
              )}
            </div>
            
            {/* Event name if available */}
            {change.event && (
              <div className="text-xs text-zinc-500 mt-1 truncate max-w-md">
                {change.event}
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Timestamp */}
        <span className="text-xs text-zinc-600 mono whitespace-nowrap">
          {timeAgo}
        </span>
      </div>
    </div>
  )
}

function formatOdds(odds) {
  if (!odds) return '-'
  const num = Number(odds)
  return num > 0 ? `+${num}` : `${num}`
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return ''
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}


