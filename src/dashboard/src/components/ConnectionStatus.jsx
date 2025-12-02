import { useStore } from '../store';

export function ConnectionStatus() {
  const wsConnected = useStore((state) => state.wsConnected);

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
      <span className="text-sm text-slate-300">
        {wsConnected ? 'Connected' : 'Disconnected'}
      </span>
    </div>
  );
}