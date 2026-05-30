import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface LastUpdatedProps {
  isFetching: boolean;
  dataUpdatedAt?: number;
}

export default function LastUpdated({ isFetching, dataUpdatedAt }: LastUpdatedProps) {
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const queryClient = useQueryClient();

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastUpdated(new Date(dataUpdatedAt));
    }
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (isFetching) return;
    setLastUpdated(new Date());
  }, [isFetching]);

  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.fetchStatus === 'idle') {
        setLastUpdated(new Date());
      }
    });
    return unsub;
  }, [queryClient]);

  const formatted = lastUpdated.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <p className="dashboard-last-updated text-right text-xs font-medium tracking-wide text-slate-400/80">
      Last updated on {formatted}
    </p>
  );
}
