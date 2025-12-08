import React from 'react';

function RiskSummaryCard({ risk }) {
    if (!risk) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-red-300 mb-3">Risk Summary</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const exposureByBook = risk.exposureByBook || [];

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-red-300 mb-3">Risk Summary</h2>

            <div className="space-y-2 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Bankroll:</span>
                    <span className="text-white font-medium">${risk.bankroll?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Exposure:</span>
                    <span className="text-orange-400 font-medium">${risk.exposureTotal?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Day Loss:</span>
                    <span className={`font-medium ${risk.currentDayLoss < 0 ? 'text-red-400' : 'text-green-400'}`}>
                        ${risk.currentDayLoss?.toFixed(2) || '0.00'}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Mode:</span>
                    <span className="text-blue-400 font-medium">{risk.mode || 'N/A'}</span>
                </div>
            </div>

            {exposureByBook.length > 0 && (
                <div>
                    <div className="text-xs text-gray-400 mb-1">Exposure by Book:</div>
                    <div className="space-y-1">
                        {exposureByBook.slice(0, 3).map((item, idx) => (
                            <div key={idx} className="flex justify-between text-xs bg-gray-700 rounded px-2 py-1">
                                <span className="text-white">{item.book}</span>
                                <span className="text-orange-400">${item.exposure?.toFixed(0) || 0}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default RiskSummaryCard;
