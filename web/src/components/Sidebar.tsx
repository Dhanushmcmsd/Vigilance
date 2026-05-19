import { NavLink, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Search,
  FolderArchive,
  BarChart3,
  Calendar,
  ClipboardList,
  Settings,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type NavItem = { label: string; path: string; icon: LucideIcon };

const navItems: Record<'head' | 'management' | 'admin', NavItem[]> = {
  head: [
    { label: 'Dashboard', path: '/head', icon: Home },
    { label: 'Review Inspections', path: '/head/review', icon: Search },
    { label: 'Audit Archive', path: '/head/archive', icon: FolderArchive },
  ],
  management: [
    { label: 'Live Dashboard', path: '/management', icon: BarChart3 },
    { label: 'Monthly Archive', path: '/management/archive', icon: Calendar },
    { label: 'Audit Reports', path: '/management/audit-archive', icon: FolderArchive },
  ],
  admin: [
    { label: 'Head Dashboard', path: '/head', icon: Home },
    { label: 'Review Inspections', path: '/head/review', icon: Search },
    { label: 'Audit Archive', path: '/head/archive', icon: FolderArchive },
    { label: 'Live Dashboard', path: '/management', icon: BarChart3 },
    { label: 'Monthly Archive', path: '/management/archive', icon: Calendar },
    { label: 'Audit Reports', path: '/management/audit-archive', icon: ClipboardList },
    { label: 'Admin Panel', path: '/admin', icon: Settings },
  ],
};

const roleBadgeColor: Record<string, string> = {
  head: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  management: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  admin: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

export default function Sidebar({ pendingCount = 0 }: { pendingCount?: number }) {
  const { user, role, name, signOut } = useAuth();
  const navigate = useNavigate();

  const links = role ? navItems[role as keyof typeof navItems] ?? [] : [];

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <aside className="flex flex-col h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800">
        <div className="text-lg font-bold text-brand-600 dark:text-brand-400 tracking-tight">VMS</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Vigilance Management</div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 border-r-2 border-brand-500'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span>{item.label}</span>
              {item.label === 'Review Inspections' && pendingCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[1.25rem] text-center">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="mb-1 font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{name}</div>
        <div className="mb-3">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              role ? roleBadgeColor[role] ?? '' : ''
            }`}
          >
            {role?.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">{user?.email}</div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
