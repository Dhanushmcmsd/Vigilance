import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Radio } from 'lucide-react';

/** Shows last data refresh time; pulses when TanStack Query refetches. */
export default function LiveSyncIndicator({ isFetching }: { isFetching: boolean }) {
  const [lastSync, setLastSync] = useState(() => new Date());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isFetching) return;
    setLastSync(new Date());
  }, [isFetching]);

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.fetchStatus === 'idle') {
        setLastSync(new Date());
      }
    });
    return unsub;
  }, [queryClient]);

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
      title="Updates when officers submit inspections (realtime + periodic refresh)"
    >
      <span className="relative flex h-2 w-2">
        <span
          className={`absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isFetching ? 'animate-ping' : ''}`}
        />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      <Radio className="h-3.5 w-3.5" aria-hidden />
      <span>
        {isFetching ? 'Syncing…' : `Live · ${lastSync.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`}
      </span>
    </div>
  );
}
