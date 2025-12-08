import React from 'react';

function ExecutionHealthCard({ executionHealth }) {
    if (!executionHealth) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-emerald-300 mb-3">Execution Health</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const { global, perBook, failureModes, systemicAlerts } = executionHealth;

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-emerald-300 mb-3">Execution Health</h2>

            {/* Global Stats */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Fill Rate</div>
                    <div className="text-lg font-bold text-green-400">
                        {(global.fillRate * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Reject Rate</div>
                    <div className="text-lg font-bold text-red-400">
                        {(global.rejectRate * 100).toFixed(1)}%
                    </div>
                </div>
                <div className="bg-gray-700 rounded p-2">
                    <div className="text-xs text-gray-400">Total</div>
                    <div className="text-lg font-bold text-white">{global.total}</div>
                </div>
            </div>

            {/* Systemic Alerts */}
            {systemicAlerts && systemicAlerts.length > 0 && (
                <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-1">Alerts:</div>
                    <div className="space-y-1">
                        {systemicAlerts.slice(0, 3).map((alert, idx) => (
                            <div
                                key={idx}
                                className={`text-xs px-2 py-1 rounded ${alert.severity === 'high'
                                        ? 'bg-red-900 bg-opacity-30 text-red-400'
                                        : 'bg-yellow-900 bg-opacity-30 text-yellow-400'
                                    }`}
                            >
                                {alert.book !== 'global' && <span className="font-medium">{alert.book}: </span>}
                                {alert.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Per-Book Top 3 */}
            {perBook && perBook.length > 0 && (
                <div className="border-t border-gray-700 pt-3 mb-3">
                    <div className="text-xs text-gray-400 mb-1">Top Books:</div>
                    <div className="space-y-1">
                        {perBook.slice(0, 3).map((book, idx) => (
                            <div key={idx} className="flex justify-between text-xs bg-gray-700 rounded px-2 py-1">
                                <span className="text-white font-medium">{book.book}</span>
                                <span className="text-green-400">{(book.fillRate * 100).toFixed(0)}%</span>
                                <span className="text-red-400">{(book.rejectRate * 100).toFixed(0)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Failure Modes */}
            {failureModes && failureModes.length > 0 && (
                <div className="border-t border-gray-700 pt-3">
                    <div className="text-xs text-gray-400 mb-1">Top Failure Modes:</div>
                    <div className="space-y-1">
                        {failureModes.slice(0, 3).map((mode, idx) => (
                            <div key={idx} className="flex justify-between text-xs">
                                <span className="text-gray-300">{mode.type.replace('_', ' ')}</span>
                                <span className="text-orange-400">
                                    {mode.count} ({(mode.pct * 100).toFixed(0)}%)
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ExecutionHealthCard;
