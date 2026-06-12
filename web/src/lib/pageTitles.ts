const PAGE_TITLES: Record<string, string> = {
  '/management': 'Analytics Dashboard',
  '/management/archive': 'Monthly Archive',
  '/management/audit-archive': 'Audit Reports',
  '/admin': 'Admin Panel',
  '/map': 'Store Map',
};

export function resolvePageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/dashboard')) return 'Overview';
  if (pathname.startsWith('/management')) return 'Management';
  return 'Dashboard';
}
