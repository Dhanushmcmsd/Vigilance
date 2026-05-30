import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Sidebar } from './layout/Sidebar';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { resolvePageTitle } from '../lib/pageTitles';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role } = useAuth();
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [sidebarWidth, setSidebarWidth] = useState(240);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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

  const title = resolvePageTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar onWidthChange={setSidebarWidth} pendingCount={pendingCount} />

      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden transition-[margin-left] duration-300"
        style={{ marginLeft: window.innerWidth < 768 ? 0 : sidebarWidth }}
      >
        <header className="h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-4">
          <div className="lg:hidden w-10" /> {/* Spacer for mobile hamburger */}
          <h1 className="font-semibold text-gray-800 dark:text-gray-200 flex-1">{title}</h1>
          <div className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-lg"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
