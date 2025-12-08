import React from 'react';

function ExecutionSummaryCard({ execution }) {
    if (!execution) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-green-300 mb-3">Execution Summary</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const fillRate = execution.totalOrders > 0
        ? ((execution.filled / execution.totalOrders) * 100).toFixed(1)
        : '0.0';

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-green-300 mb-3">Execution Summary</h2>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Total Orders</div>
                    <div className="text-xl font-bold text-white">{execution.totalOrders || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Filled</div>
                    <div className="text-xl font-bold text-green-400">{execution.filled || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Rejected</div>
                    <div className="text-xl font-bold text-red-400">{execution.rejected || 0}</div>
                </div>

                <div className="bg-gray-700 rounded p-2">
                    <div className="text-gray-400 text-xs">Fill Rate</div>
                    <div className="text-xl font-bold text-blue-400">{fillRate}%</div>
                </div>
            </div>

            {execution.blocked > 0 && (
                <div className="mt-2 bg-yellow-900 bg-opacity-30 rounded p-2 text-sm">
                    <span className="text-yellow-400">⚠ {execution.blocked} blocked</span>
                </div>
            )}
        </div>
    );
}

export default ExecutionSummaryCard;
