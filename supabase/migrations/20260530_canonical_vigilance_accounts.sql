-- Canonical Vigilance accounts (web + mobile). Run once on production.
--   admin@vigilance.app      admin       (web)     admin123
--   management@vigilance.app management  (web CEO) mgmt123
--   officer@vigilance.app    officer     (mobile)  officer123
--   audit@company.app        audit       (mobile)  audit123

BEGIN;

UPDATE auth.users
SET email = 'officer@vigilance.app',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email IN ('test@officer.com', 'officer@vigilance.com');

UPDATE auth.users
SET email = 'audit@company.app',
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email = 'audit@company.com';

UPDATE auth.identities i
SET identity_data = i.identity_data || jsonb_build_object('email', u.email)
FROM auth.users u
WHERE i.user_id = u.id
  AND i.provider = 'email'
  AND u.email IN (
    'admin@vigilance.app',
    'management@vigilance.app',
    'officer@vigilance.app',
    'audit@company.app'
  );

UPDATE public.user_roles ur
SET
  email = u.email,
  is_active = true,
  deleted_at = NULL,
  name = CASE u.email
    WHEN 'admin@vigilance.app' THEN 'Vigilance Admin'
    WHEN 'management@vigilance.app' THEN 'CEO Dashboard'
    WHEN 'officer@vigilance.app' THEN 'Field Officer'
    WHEN 'audit@company.app' THEN 'Audit Reviewer'
    ELSE ur.name
  END,
  role = CASE u.email
    WHEN 'admin@vigilance.app' THEN 'admin'
    WHEN 'management@vigilance.app' THEN 'management'
    WHEN 'officer@vigilance.app' THEN 'officer'
    WHEN 'audit@company.app' THEN 'audit'
    ELSE ur.role
  END
FROM auth.users u
WHERE ur.user_id = u.id
  AND u.email IN (
    'admin@vigilance.app',
    'management@vigilance.app',
    'officer@vigilance.app',
    'audit@company.app'
  );

DELETE FROM auth.users
WHERE email NOT IN (
  'admin@vigilance.app',
  'management@vigilance.app',
  'officer@vigilance.app',
  'audit@company.app'
);

UPDATE auth.users SET encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'admin@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('mgmt123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'management@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('officer123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'officer@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('audit123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'audit@company.app';

COMMIT;
