import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Map,
  TrendingUp,
  Archive,
  FileText,
  ChevronLeft,
  LogOut,
  Menu,
  X,
  Search,
  FolderArchive,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { roleDisplayLabel, roleDisplaySublabel, roleInitial } from '../../lib/roleDisplay';

interface NavItem {
  label: string;
  path: string;
  icon: any;
}

const ROLE_NAV_ITEMS: Record<string, NavItem[]> = {
  management: [
    { label: 'Overview', path: '/dashboard', icon: Home },
    { label: 'Analytics', path: '/dashboard/analytics', icon: TrendingUp },
    { label: 'Store Map', path: '/dashboard/map', icon: Map },
    { label: 'Monthly Archive', path: '/dashboard/archive', icon: Archive },
    { label: 'Vigilance Report', path: '/dashboard/audit-archive', icon: FileText },
  ],
  head: [
    { label: 'Dashboard', path: '/head', icon: Home },
    { label: 'Review Inspections', path: '/head/review', icon: Search },
    { label: 'Audit Archive', path: '/head/archive', icon: FolderArchive },
  ],
  admin: [
    { label: 'Admin Panel', path: '/admin', icon: Settings },
  ],
};

interface SidebarProps {
  onWidthChange?: (width: number) => void;
  pendingCount?: number;
}

export function Sidebar({ onWidthChange, pendingCount = 0 }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const navigate = useNavigate();
  const { name, role, signOut } = useAuth();

  const navItems = role ? ROLE_NAV_ITEMS[role] || [] : [];

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(false);
        setMobileOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate sidebar width based on device and state
  const getWidth = () => {
    if (isMobile) return mobileOpen ? 280 : 0;
    return collapsed ? 64 : 240;
  };

  const width = getWidth();

  useEffect(() => {
    onWidthChange?.(width);
  }, [width, onWidthChange]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/dashboard/';
    return location.pathname.startsWith(path);
  };

  const handleNavClick = () => {
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  // Desktop sidebar
  if (!isMobile) {
    return (
      <motion.aside
        initial={false}
        animate={{ width }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="vms-sidebar fixed left-0 top-0 z-40 flex h-screen flex-col border-r"
      >
        {/* Header */}
        <div className="p-6 border-b sidebar-user-block" style={{ borderTop: 'none' }}>
          <div className="font-bold tracking-tight text-sm user-name">
            {!collapsed && 'VIGILANCE'}
          </div>
          {!collapsed && (
            <p className="text-xs user-role mt-2 font-medium">Executive Command</p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                data-cursor="pointer"
                aria-current={active ? 'page' : undefined}
                className={`sidebar-link relative mx-2 flex h-11 items-center ${active ? 'active vms-sidebar-nav-active' : ''}`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden />
                {!collapsed && <span className="ml-3 truncate">{item.label}</span>}
                {!collapsed && item.label === 'Review Inspections' && pendingCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Section */}
        <div className="sidebar-user-block">
          {/* User Info */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{
                border: '2px solid rgba(99,102,241,0.3)',
                backgroundColor: 'rgba(99,102,241,0.12)',
                color: 'var(--accent-blue)',
              }}
            >
              {roleInitial(name, role)}
            </div>

            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="user-name truncate">{name || 'Signed in'}</div>
                <div className="user-role truncate">{roleDisplayLabel(role)}</div>
                {roleDisplaySublabel(role) && (
                  <div className="user-role truncate opacity-80">{roleDisplaySublabel(role)}</div>
                )}
              </div>
            )}
          </div>

          {/* Sign Out Button */}
          {!collapsed && (
            <button
              type="button"
              onClick={() => void handleSignOut()}
              data-cursor="pointer"
              className="admin-btn-destructive w-full flex items-center justify-center gap-2 h-9 text-xs font-medium mb-3"
            >
              <LogOut className="w-4 h-4" aria-hidden />
              Sign Out
            </button>
          )}

          {/* Collapse Toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            data-cursor="pointer"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="admin-btn-secondary w-full flex items-center justify-center h-9"
          >
            <ChevronLeft
              className="w-5 h-5 transition-transform"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
            />
          </button>
        </div>
      </motion.aside>
    );
  }

  // Mobile sidebar (drawer overlay)
  return (
    <>
      {/* Hamburger Button - Fixed in TopBar area */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        data-cursor="pointer"
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        className="fixed top-4 left-4 z-50 flex items-center justify-center w-10 h-10 rounded-md lg:hidden"
        style={{
          backgroundColor: 'rgba(37,99,235,0.2)',
          color: '#3B82F6',
        }}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-30 bg-black/40"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="vms-sidebar fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r"
            >
              {/* Header */}
              <div className="p-6 border-b sidebar-user-block" style={{ borderTop: 'none' }}>
                <div className="font-bold tracking-tight text-sm user-name">VIGILANCE</div>
                <p className="text-xs user-role mt-2 font-medium">Executive Command</p>
              </div>

              <nav className="flex-1 py-4 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      data-cursor="pointer"
                      onClick={handleNavClick}
                      aria-current={active ? 'page' : undefined}
                      className={`sidebar-link relative mb-2 flex h-11 items-center ${active ? 'active vms-sidebar-nav-active' : ''}`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" aria-hidden />
                      <span className="ml-3">{item.label}</span>
                      {item.label === 'Review Inspections' && pendingCount > 0 && (
                        <span className="ml-auto bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">
                          {pendingCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>

              {/* Footer Section */}
              <div className="sidebar-user-block">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      border: '2px solid rgba(99,102,241,0.3)',
                      backgroundColor: 'rgba(99,102,241,0.12)',
                      color: 'var(--accent-blue)',
                    }}
                  >
                    {roleInitial(name, role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="user-name truncate">{name || 'Signed in'}</div>
                    <div className="user-role truncate">{roleDisplayLabel(role)}</div>
                    {roleDisplaySublabel(role) && (
                      <div className="user-role truncate opacity-80">{roleDisplaySublabel(role)}</div>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    void handleSignOut();
                    setMobileOpen(false);
                  }}
                  data-cursor="pointer"
                  className="admin-btn-destructive w-full flex items-center justify-center gap-2 h-9 text-xs font-medium"
                >
                  <LogOut className="w-4 h-4" aria-hidden />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
