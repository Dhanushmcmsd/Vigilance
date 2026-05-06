import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LiveIndicator() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const channel = supabase.channel('live-indicator')
      .on('presence', { event: 'sync' }, () => setConnected(true))
      .subscribe(status => {
        setConnected(status === 'SUBSCRIBED');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`inline-block w-2 h-2 rounded-full ${
          connected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
        }`}
      />
      <span className={connected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
        {connected ? 'Live' : 'Connecting…'}
      </span>
    </div>
  );
}
