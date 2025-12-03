// dashboard/src/components/ArbitrageFeed.jsx
import { useStore } from '../store';

export default function ArbitrageFeed() {
  const arbitrageOpportunities = useStore(state => state.arbitrageOpportunities);

  if (arbitrageOpportunities.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 h-full flex flex-col">
        <h2 className="text-xl font-bold text-white mb-4">
          💰 Arbitrage Opportunities
        </h2>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl mb-4">🔍</div>
            <div className="text-slate-400 text-lg">
              No arbitrage opportunities detected yet
            </div>
            <div className="text-slate-500 text-sm mt-2">
              Scanning markets in real-time...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 h-full overflow-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-white">
          💰 Arbitrage Opportunities
        </h2>
        <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-semibold">
          {arbitrageOpportunities.length} Active
        </div>
      </div>
      
      <div className="space-y-3">
        {arbitrageOpportunities.map((opp, idx) => (
          <div 
            key={idx}
            className="bg-slate-700 rounded-lg p-4 border-l-4 border-green-500 hover:bg-slate-600 transition-colors"
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="text-slate-300 text-xs uppercase font-semibold mb-1">
                  {opp.marketType}
                </div>
                <div className="text-white text-sm font-medium">
                  {opp.eventId.split('_').slice(2).join(' vs ')}
                </div>
              </div>
              <div className="bg-green-500 text-white px-3 py-1 rounded font-bold text-lg">
                {opp.profitMargin}%
              </div>
            </div>

            {/* Books */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-slate-600 rounded p-3">
                <div className="text-slate-300 text-xs uppercase font-semibold mb-1">
                  {opp.bookA}
                </div>
                <div className="text-white font-mono text-sm mb-2">
                  <span className="text-slate-400 text-xs">{opp.sideA}</span>
                  <br />
                  {opp.lineA ? `${opp.lineA} ` : ''}
                  <span className={opp.priceA > 0 ? 'text-green-400' : 'text-red-400'}>
                    {opp.priceA > 0 ? '+' : ''}{opp.priceA}
                  </span>
                </div>
                <div className="text-slate-400 text-xs">
                  Stake: <span className="text-white font-semibold">${opp.stakeA}</span>
                </div>
              </div>

              <div className="bg-slate-600 rounded p-3">
                <div className="text-slate-300 text-xs uppercase font-semibold mb-1">
                  {opp.bookB}
                </div>
                <div className="text-white font-mono text-sm mb-2">
                  <span className="text-slate-400 text-xs">{opp.sideB}</span>
                  <br />
                  {opp.lineB ? `${opp.lineB} ` : ''}
                  <span className={opp.priceB > 0 ? 'text-green-400' : 'text-red-400'}>
                    {opp.priceB > 0 ? '+' : ''}{opp.priceB}
                  </span>
                </div>
                <div className="text-slate-400 text-xs">
                  Stake: <span className="text-white font-semibold">${opp.stakeB}</span>
                </div>
              </div>
            </div>

            {/* Profit */}
            <div className="bg-slate-800 rounded p-2 flex justify-between items-center">
              <div className="text-slate-400 text-xs">Expected Profit</div>
              <div className="text-green-400 font-bold text-lg">
                ${opp.expectedProfit}
              </div>
            </div>

            {/* Timestamp */}
            <div className="text-slate-500 text-xs mt-2 text-right">
              {new Date(opp.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}