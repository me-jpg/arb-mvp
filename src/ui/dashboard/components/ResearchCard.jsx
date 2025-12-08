import React from 'react';

function ResearchCard({ research }) {
    if (!research) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-purple-300 mb-3">Research & Edge Quality</h2>
                <p className="text-gray-400 text-sm">No data yet</p>
            </div>
        );
    }

    const topBooks = research.topBooks || [];
    const mlBaseline = research.mlBaseline || {};

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-purple-300 mb-3">Research & Edge Quality</h2>

            <div className="mb-3">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">Dataset Rows:</span>
                    <span className="text-white font-medium">{research.rowCount || 0}</span>
                </div>

                {mlBaseline.edgeDirectionAccuracy !== undefined && (
                    <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Edge Accuracy:</span>
                        <span className="text-green-400 font-medium">
                            {(mlBaseline.edgeDirectionAccuracy * 100).toFixed(1)}%
                        </span>
                    </div>
                )}
            </div>

            {topBooks.length > 0 && (
                <div>
                    <div className="text-xs text-gray-400 mb-1">Top Books by ROI:</div>
                    <div className="space-y-1">
                        {topBooks.slice(0, 3).map((book, idx) => (
                            <div key={idx} className="flex justify-between text-xs bg-gray-700 rounded px-2 py-1">
                                <span className="text-white">{book.book}</span>
                                <span className="text-green-400">ROI: {(book.roi * 100).toFixed(1)}%</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ResearchCard;
