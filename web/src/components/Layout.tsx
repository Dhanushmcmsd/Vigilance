import { useState, useEffect } from 'react';
import { Menu, Sun, Moon } from 'lucide-react';
import Sidebar from './Sidebar';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';

const pageTitles: Record<string, string> = {
  '/head': 'Head Dashboard',
  '/head/review': 'Review Inspections',
  '/management': 'Management Dashboard',
  '/admin': 'Admin Panel',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role } = useAuth();
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const channel = supabase.channel('layout-realtime-check')
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      if (role !== 'head' && role !== 'admin') return 0;
      const { count } = await supabase
        .from('inspections')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted');
      return count ?? 0;
    },
    refetchInterval: 30_000,
    enabled: role === 'head' || role === 'admin',
  });

  const title = pageTitles[location.pathname] ?? 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-30 h-full transition-transform duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <Sidebar pendingCount={pendingCount} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4 no-print">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Menu className="w-5 h-5" aria-hidden />
          </button>
          <h1 className="font-semibold text-gray-800 dark:text-gray-200 flex-1">{title}</h1>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              realtimeConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`} />
            <span className="text-xs text-gray-500">{realtimeConnected ? 'Live' : 'Connecting'}</span>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />}
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
