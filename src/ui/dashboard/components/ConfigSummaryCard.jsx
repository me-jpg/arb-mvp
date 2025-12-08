import React from 'react';

function formatPct(p) {
    if (p == null) return '—';
    return `${(p * 100).toFixed(1)}%`;
}

function ConfigSummaryCard({ config }) {
    if (!config) {
        return (
            <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
                <h2 className="text-lg font-bold text-cyan-300 mb-3">Config / Regime Summary</h2>
                <p className="text-gray-400 text-sm">Config not available yet</p>
            </div>
        );
    }

    const ml = config.mlScoring || {};
    const mlModel = config.mlModel || {};
    const stake = config.stakeSizing || {};
    const risk = config.riskCaps || {};
    const hf = config.hf || {};

    const modelName = mlModel.modelPath
        ? mlModel.modelPath.split(/[\\/]/).pop()
        : 'none';

    return (
        <div className="bg-gray-800 rounded-lg p-4 shadow-lg">
            <h2 className="text-lg font-bold text-cyan-300 mb-3">Config / Regime Summary</h2>

            {/* ML Scoring */}
            <div className="space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ML scoring</span>
                    <span className="text-white">{ml.mode || 'none'} ({ml.enabled ? 'on' : 'off'})</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">ML model</span>
                    <span className="text-white truncate ml-2 max-w-xs">
                        {mlModel.enabled ? `${mlModel.mode || 'linear'} (${modelName})` : 'disabled'}
                    </span>
                </div>
            </div>

            {/* Stake Sizing */}
            <div className="border-t border-gray-700 pt-3 space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Stake sizing</span>
                    <span className="text-white">{stake.mode || 'flat'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Flat / min</span>
                    <span className="text-white">${stake.flatStake ?? '—'} / ${stake.minStake ?? '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Kelly × / max%</span>
                    <span className="text-white">{stake.kellyBaseFraction ?? '—'} × / {formatPct(stake.maxStakePctBankroll)}</span>
                </div>
            </div>

            {/* Risk Caps */}
            <div className="border-t border-gray-700 pt-3 space-y-1 mb-3">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Risk caps</span>
                    <span className="text-white">{risk.mode || 'normal'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Order / Event</span>
                    <span className="text-white">{formatPct(risk.maxStakePctPerOrder)} / {formatPct(risk.maxExposurePctPerEvent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Book / Daily loss</span>
                    <span className="text-white">{formatPct(risk.maxExposurePctPerBook)} / {formatPct(risk.maxDailyLossPct)}</span>
                </div>
            </div>

            {/* HF */}
            <div className="border-t border-gray-700 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">HF books</span>
                    <span className="text-white text-xs truncate ml-2 max-w-xs">
                        {(hf.enabledBooks && hf.enabledBooks.join(', ')) || '—'}
                    </span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-gray-400">HF maxEvents / interval</span>
                    <span className="text-white">{hf.maxEvents ?? '—'} / {hf.intervalMs ?? '—'}ms</span>
                </div>
            </div>
        </div>
    );
}

export default ConfigSummaryCard;
