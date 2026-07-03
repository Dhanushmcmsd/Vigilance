import { Link } from 'react-router-dom';

export function LegalFooter({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const linkClass =
    variant === 'dark'
      ? 'text-muted hover:text-text-primary transition-colors'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors';

  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Legal">
      <Link to="/legal/terms" className={linkClass}>
        Terms of Service
      </Link>
      <Link to="/legal/privacy" className={linkClass}>
        Privacy Policy
      </Link>
      <Link to="/legal/acceptable-use" className={linkClass}>
        Acceptable Use
      </Link>
    </nav>
  );
}
