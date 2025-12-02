import { useStore } from '../store';

export function LineChangeFeed() {
  const lineChanges = useStore((state) => state.lineChanges);

  const getChangeColor = (changeType) => {
    if (changeType === 'price_up') return 'text-green-400';
    if (changeType === 'price_down') return 'text-red-400';
    if (changeType.includes('line')) return 'text-yellow-400';
    return 'text-slate-400';
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="bg-slate-800 rounded-lg p-4 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-green-400">📊 Line Changes Feed</h2>
      
      <div className="flex-1 overflow-y-auto space-y-2">
        {lineChanges.length === 0 ? (
          <p className="text-slate-400 text-sm">Waiting for line changes...</p>
        ) : (
          [...lineChanges].reverse().map((change, idx) => (
            <div key={idx} className="bg-slate-700 rounded p-3 text-sm">
              <div className="flex justify-between items-start mb-1">
                <span className="font-bold text-blue-400">{change.book}</span>
                <span className="text-slate-500 text-xs">
                  {formatTime(change.detectedAt)}
                </span>
              </div>
              <div className="text-slate-300">
                <span className="font-medium">{change.marketType}</span>
                {' '}
                <span className="text-slate-400">{change.side}</span>
              </div>
              {change.line && (
                <div className="text-xs text-slate-400">
                  Line: {change.oldLine} → {change.line}
                </div>
              )}
              {change.price && (
                <div className={`text-xs font-medium ${getChangeColor(change.changeType)}`}>
                  Price: {change.oldPrice} → {change.price}
                </div>
              )}
              <div className="text-xs text-slate-500 mt-1">
                {change.changeType.replace(/_/g, ' ')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}