import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { Sidebar } from './layout/Sidebar';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { resolvePageTitle } from '../lib/pageTitles';

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { role } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [sidebarWidth, setSidebarWidth] = useState(240);

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
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <Sidebar onWidthChange={setSidebarWidth} pendingCount={pendingCount} />

      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden transition-[margin-left] duration-300"
        style={{ marginLeft: window.innerWidth < 768 ? 0 : sidebarWidth }}
      >
        <header
          className="h-14 flex items-center px-4 gap-4"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div className="lg:hidden w-10" />
          <h1 className="font-semibold flex-1" style={{ color: 'var(--text-heading)' }}>
            {title}
          </h1>
          <div className="text-sm hidden sm:block" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'short',
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
          <button
            onClick={toggleTheme}
            className="text-lg transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-5 h-5" aria-hidden /> : <Moon className="w-5 h-5" aria-hidden />}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
