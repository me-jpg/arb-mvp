import { useStore } from '../store';

export function LatencyPanel() {
  const latencyMetrics = useStore((state) => state.latencyMetrics);

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full">
      <h2 className="text-xl font-bold mb-4 text-purple-400">⚡ Book Speed Rankings</h2>
      
      <div className="space-y-3">
        {latencyMetrics.length === 0 ? (
          <p className="text-slate-400 text-sm">Waiting for latency metrics...</p>
        ) : (
          latencyMetrics.map((metric, idx) => (
            <div key={metric.book} className="bg-slate-700 rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-400">
                  #{idx + 1} {metric.book}
                </span>
                <span className="text-green-400 font-bold">
                  {(metric.firstMoverFraction * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  Avg Delay: <span className="text-slate-300">{Math.round(metric.avgDelayMs)}ms</span>
                </div>
                <div>
                  Windows: <span className="text-slate-300">{metric.totalWindows}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}