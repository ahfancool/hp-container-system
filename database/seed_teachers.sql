-- TEMPLATE PENGISIAN AKUN GURU (HP CONTAINER SYSTEM)
-- File ini berisi contoh cara menambahkan akun guru ke sistem.
-- Karena sistem menggunakan Supabase Auth, data harus dimasukkan ke 'auth.users'
-- agar trigger otomatis mengisi tabel 'public.users'.

BEGIN;

-- 1. Contoh Menambahkan Guru (Role: teacher)
-- Password di bawah dienkripsi menggunakan pgcrypto (password bawaan: 'password123')
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'guru1@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Guru Satu, S.Pd", "role": "teacher"}', -- Penting: Metadata role menentukan hak akses
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- 2. Contoh Menambahkan Wali Kelas (Role: homeroom)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'walikelas1@example.com',
    crypt('password123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Wali Satu, M.Pd", "role": "homeroom"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

-- 3. Contoh Menambahkan Admin Kesiswaan (Role: admin)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin.kesiswaan@example.com',
    crypt('adminpass123', gen_salt('bf')),
    now(),
    '{"provider": "email", "providers": ["email"]}',
    '{"name": "Admin Kesiswaan", "role": "admin"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
);

COMMIT;
