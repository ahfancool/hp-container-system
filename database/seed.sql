begin;

insert into public.users (id, name, role, email, is_active)
values
  ('8b70963f-3f52-442d-8f64-9a44de1b6f01', 'Ahmad Siswa', 'student', 'ahmad.siswa@school.local', true),
  ('3cf32e30-94de-4737-980a-c44aafdf1f22', 'Bunga Siswa', 'student', 'bunga.siswa@school.local', true),
  ('de79c3be-f5be-4f68-b5f7-cd8114b00b33', 'Ibu Rina', 'teacher', 'rina.guru@school.local', true),
  ('f19f34c2-4b2d-4bcb-8e88-5c6466c7de44', 'Admin Sekolah', 'admin', 'admin@school.local', true)
on conflict (id) do update
set
  name = excluded.name,
  role = excluded.role,
  email = excluded.email,
  is_active = excluded.is_active;

insert into public.students (id, user_id, nis, name, class_name, major, grade_level, is_active)
values
  (
    '5b4fd9b8-3ef3-450d-9750-a9343b518f11',
    '8b70963f-3f52-442d-8f64-9a44de1b6f01',
    '2026001',
    'Ahmad Siswa',
    'XII-A',
    'IPA',
    '12',
    true
  ),
  (
    'f98d60dd-b55b-4663-b0ab-52db86c94f22',
    '3cf32e30-94de-4737-980a-c44aafdf1f22',
    '2026002',
    'Bunga Siswa',
    'XI-B',
    'IPS',
    '11',
    true
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  nis = excluded.nis,
  name = excluded.name,
  class_name = excluded.class_name,
  major = excluded.major,
  grade_level = excluded.grade_level,
  is_active = excluded.is_active;

insert into public.containers (id, name, location, qr_code, is_active)
values
  (
    '3a36be78-7a1d-47d2-a214-5d8f7c487f11',
    'Container A',
    'Ruang Tata Tertib',
    'container://3a36be78-7a1d-47d2-a214-5d8f7c487f11',
    true
  ),
  (
    '65050506-01fd-48fb-90bf-978339e89d22',
    'Container B',
    'Koridor Lantai 2',
    'container://65050506-01fd-48fb-90bf-978339e89d22',
    true
  )
on conflict (id) do update
set
  name = excluded.name,
  location = excluded.location,
  qr_code = excluded.qr_code,
  is_active = excluded.is_active;

insert into public.phone_transactions (
  id,
  student_id,
  container_id,
  action,
  type,
  "timestamp",
  operator_id
)
values (
  'b08bd1b2-d019-4c1e-8fa0-8d0f7443f111',
  '5b4fd9b8-3ef3-450d-9750-a9343b518f11',
  '3a36be78-7a1d-47d2-a214-5d8f7c487f11',
  'IN',
  'REGULAR',
  '2026-04-07T00:05:00Z',
  null
)
on conflict (id) do nothing;

insert into public.phone_transactions (
  id,
  student_id,
  container_id,
  action,
  type,
  "timestamp",
  operator_id
)
values (
  'f48d9d17-7f8f-43d8-bded-77049243f112',
  'f98d60dd-b55b-4663-b0ab-52db86c94f22',
  '65050506-01fd-48fb-90bf-978339e89d22',
  'IN',
  'REGULAR',
  '2026-04-07T00:06:00Z',
  null
)
on conflict (id) do nothing;

insert into public.phone_transactions (
  id,
  student_id,
  container_id,
  action,
  type,
  "timestamp",
  operator_id
)
values (
  '1a714f28-179f-4c80-ae86-5264b854f113',
  'f98d60dd-b55b-4663-b0ab-52db86c94f22',
  '65050506-01fd-48fb-90bf-978339e89d22',
  'OUT',
  'PEMBELAJARAN',
  '2026-04-07T02:00:00Z',
  'de79c3be-f5be-4f68-b5f7-cd8114b00b33'
)
on conflict (id) do nothing;

commit;
