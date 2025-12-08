import React from 'react';

function ArbExposureCard({ arbExposure }) {
    if (!arbExposure) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-indigo-300 mb-3">Arb Exposure & Hedge Quality</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const worstUnhedged = arbExposure.worstUnhedged || [];

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-indigo-300 mb-3">Arb Exposure & Hedge Quality</h2>

            <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Groups</div>
                    <div className="text-lg font-bold text-white">{arbExposure.groups || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Pairs</div>
                    <div className="text-lg font-bold text-white">{arbExposure.pairs || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Fully Hedged</div>
                    <div className="text-lg font-bold text-green-400">{arbExposure.fullyHedged || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Unhedged</div>
                    <div className="text-lg font-bold text-red-400">{arbExposure.unhedgedSingleLeg || 0}</div>
                </div>
            </div>

            <div className="bg-orange-900 bg-opacity-30 rounded p-2 mb-3">
                <div className="text-xs text-gray-400">Total Unhedged Exposure</div>
                <div className="text-xl font-bold text-orange-400">
                    ${arbExposure.totalUnhedgedExposure?.toFixed(2) || '0.00'}
                </div>
            </div>

            {worstUnhedged.length > 0 && (
                <div>
                    <div className="text-xs text-gray-400 mb-1">Worst Unhedged:</div>
                    <div className="space-y-1">
                        {worstUnhedged.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-xs bg-gray-700 rounded px-2 py-1">
                                <div className="text-white truncate">{item.eventId || item.groupId}</div>
                                <div className="text-red-400">${item.exposure?.toFixed(0) || 0}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ArbExposureCard;
