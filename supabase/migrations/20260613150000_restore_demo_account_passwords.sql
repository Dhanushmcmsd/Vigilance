-- Restore canonical demo account passwords (dev/staging).
-- Affected: admin@vigilance.app, management@vigilance.app,
--           officer@vigilance.app, audit@company.app

UPDATE auth.users SET encrypted_password = extensions.crypt('admin123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'admin@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('mgmt123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'management@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('officer123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'officer@vigilance.app';

UPDATE auth.users SET encrypted_password = extensions.crypt('audit123', extensions.gen_salt('bf')), updated_at = now()
WHERE email = 'audit@company.app';
