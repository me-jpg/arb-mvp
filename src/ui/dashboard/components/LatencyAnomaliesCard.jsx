import React from 'react';

function LatencyAnomaliesCard({ latency }) {
    if (!latency) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-yellow-300 mb-3">Latency Anomalies</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const anomalies = latency.anomalies || [];

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-yellow-300 mb-3">Latency Anomalies</h2>

            {anomalies.length === 0 ? (
                <p className="text-green-400 text-sm">✓ No anomalies detected</p>
            ) : (
                <div className="space-y-2">
                    {anomalies.slice(0, 5).map((anomaly, idx) => (
                        <div key={idx} className="bg-gray-700 rounded p-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="font-medium text-white">{anomaly.book}</span>
                                <span className={`px-2 py-1 rounded text-xs ${anomaly.severity === 'high' ? 'bg-red-600' :
                                        anomaly.severity === 'medium' ? 'bg-orange-600' : 'bg-yellow-600'
                                    }`}>
                                    {anomaly.severity}
                                </span>
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                                Z-score: {anomaly.zScore?.toFixed(2)} | Lag: {anomaly.observedLagMs?.toFixed(0)}ms
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default LatencyAnomaliesCard;
