import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleDisplayLabel, roleDisplaySublabel } from '../../lib/roleDisplay';
import { LegalFooter } from '../../components/legal/LegalFooter';

export default function CeoSettingsPage() {
  const { user, role, name, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="max-w-lg space-y-6">
      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <h1 className="text-lg font-semibold text-text-primary mb-4">Account</h1>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-muted text-xs uppercase tracking-wider">Name</dt>
            <dd className="text-text-primary font-medium mt-0.5">{name || '—'}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wider">Email</dt>
            <dd className="text-text-primary mt-0.5">{user?.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs uppercase tracking-wider">Role</dt>
            <dd className="text-text-primary mt-0.5">
              {roleDisplayLabel(role)}
              <span className="block text-xs text-muted mt-0.5">{roleDisplaySublabel(role)}</span>
            </dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-6 w-full rounded-md py-2.5 text-sm font-medium"
          style={{ backgroundColor: 'rgba(192,57,43,0.15)', color: '#F5F5F0', border: '1px solid rgba(192,57,43,0.35)' }}
        >
          Sign out
        </button>
      </div>

      <div
        className="rounded-lg border p-6"
        style={{ backgroundColor: '#111118', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <h2 className="text-sm font-semibold text-text-primary mb-3">Legal & compliance</h2>
        <LegalFooter variant="dark" />
      </div>
    </div>
  );
}
