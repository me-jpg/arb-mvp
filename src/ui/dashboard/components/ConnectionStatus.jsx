import React from 'react';

function ConnectionStatus({ connected }) {
    return (
        <div className="flex items-center space-x-2">
            <div
                className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'
                    }`}
            />
            <span className="text-sm font-medium">
                {connected ? 'Connected' : 'Disconnected'}
            </span>
        </div>
    );
}

export default ConnectionStatus;
