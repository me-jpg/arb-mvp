import { useStore } from '../store'

export default function ConnectionStatus() {
  const { connected, lastPing } = useStore()
  
  const timeSincePing = lastPing 
    ? Math.floor((Date.now() - lastPing) / 1000) 
    : null
  
  return (
    <div className={`
      flex items-center gap-3 px-4 py-2 rounded-full
      ${connected 
        ? 'bg-accent-green/10 border border-accent-green/30' 
        : 'bg-accent-red/10 border border-accent-red/30'
      }
    `}>
      {/* Pulse indicator */}
      <div className="relative">
        <div className={`
          w-3 h-3 rounded-full
          ${connected ? 'bg-accent-green' : 'bg-accent-red'}
        `} />
        {connected && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-accent-green animate-ping opacity-75" />
        )}
      </div>
      
      {/* Status text */}
      <div className="flex flex-col">
        <span className={`
          text-sm font-medium
          ${connected ? 'text-accent-green' : 'text-accent-red'}
        `}>
          {connected ? 'Connected' : 'Disconnected'}
        </span>
        {connected && timeSincePing !== null && (
          <span className="text-xs text-zinc-500 mono">
            ping {timeSincePing}s ago
          </span>
        )}
      </div>
    </div>
  )
}


