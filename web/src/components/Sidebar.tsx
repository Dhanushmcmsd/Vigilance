import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = {
  head: [
    { label: 'Dashboard', path: '/head', icon: '🏠' },
    { label: 'Review Inspections', path: '/head/review', icon: '🔍' },
  ],
  management: [
    { label: 'Dashboard', path: '/management', icon: '📊' },
  ],
  admin: [
    { label: 'Head Dashboard', path: '/head', icon: '🏠' },
    { label: 'Review Inspections', path: '/head/review', icon: '🔍' },
    { label: 'Management Dashboard', path: '/management', icon: '📊' },
    { label: 'Admin Panel', path: '/admin', icon: '⚙️' },
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
        <div className="text-lg font-bold text-brand-600 dark:text-brand-400">VMS</div>
        <div className="text-xs text-gray-400">Vigilance Management</div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map((item) => (
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
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.label === 'Review Inspections' && pendingCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                {pendingCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800">
        <div className="mb-1 font-medium text-sm text-gray-800 dark:text-gray-200 truncate">{name}</div>
        <div className="mb-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            role ? roleBadgeColor[role] ?? '' : ''
          }`}>
            {role?.toUpperCase()}
          </span>
        </div>
        <div className="text-xs text-gray-400 mb-2 truncate">{user?.email}</div>
        <button
          onClick={handleSignOut}
          className="w-full text-sm text-left text-red-500 hover:text-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
