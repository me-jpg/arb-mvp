import React from 'react';

function HfMarketsCard({ hf }) {
    if (!hf) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-blue-300 mb-3">HF Top Volatile Markets</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const topMarkets = hf.topVolatileMarkets || [];

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-blue-300 mb-3">HF Top Volatile Markets</h2>

            {topMarkets.length === 0 ? (
                <p className="text-gray-400 text-sm">No volatile markets detected</p>
            ) : (
                <div className="space-y-2">
                    {topMarkets.slice(0, 5).map((market, idx) => (
                        <div key={idx} className="bg-gray-700 rounded p-2 text-sm">
                            <div className="flex justify-between">
                                <span className="font-medium text-white">{market.key || 'Unknown'}</span>
                                <span className="text-orange-400">Vol: {market.volatilityScore?.toFixed(1) || 'N/A'}</span>
                            </div>
                            {market.lineMovementMagnitude !== undefined && (
                                <div className="text-gray-400 text-xs mt-1">
                                    Line movement: {market.lineMovementMagnitude.toFixed(2)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default HfMarketsCard;
