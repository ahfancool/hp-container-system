begin;

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text not null,
  role text not null check (role in ('student', 'teacher', 'homeroom', 'admin')),
  email text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
  next_name text;
  next_email text;
begin
  next_role := coalesce(new.raw_user_meta_data ->> 'role', 'student');

  if next_role not in ('student', 'teacher', 'homeroom', 'admin') then
    next_role := 'student';
  end if;

  next_email := coalesce(new.email, new.id::text || '@auth.local');
  next_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(next_email, '@', 1),
    'Pengguna'
  );

  update public.users
  set
    email = next_email,
    name = next_name,
    role = next_role,
    is_active = true,
    updated_at = timezone('utc', now())
  where auth_user_id = new.id;

  if found then
    return new;
  end if;

  insert into public.users (
    auth_user_id,
    name,
    role,
    email,
    is_active
  )
  values (
    new.id,
    next_name,
    next_role,
    next_email,
    true
  )
  on conflict (email) do update
  set
    auth_user_id = excluded.auth_user_id,
    name = excluded.name,
    role = excluded.role,
    is_active = true,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.handle_deleted_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set
    auth_user_id = null,
    is_active = false,
    updated_at = timezone('utc', now())
  where auth_user_id = old.id;

  return old;
end;
$$;

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.users (id) on delete set null,
  nis text not null unique,
  name text not null,
  class_name text not null,
  major text,
  grade_level text not null,
  is_active boolean not null default true,
  device_fingerprint text,
  fingerprint_updated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  qr_code text not null unique,
  qr_secret_token text not null default encode(gen_random_bytes(16), 'hex'),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.phone_transactions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  container_id uuid not null references public.containers (id) on delete restrict,
  action text not null check (action in ('IN', 'OUT')),
  type text not null check (type in ('REGULAR', 'PEMBELAJARAN', 'DARURAT')),
  "timestamp" timestamptz not null default timezone('utc', now()),
  request_id text,
  operator_id uuid references public.users (id) on delete set null,
  is_late_sync boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  constraint phone_transactions_type_requires_operator_check
    check (type = 'REGULAR' or operator_id is not null)
);

alter table public.phone_transactions
  add column if not exists request_id text;

create table if not exists public.teacher_approvals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  container_id uuid not null references public.containers (id) on delete restrict,
  type text not null check (type in ('PEMBELAJARAN', 'DARURAT')),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'USED', 'CANCELLED')),
  approved_by uuid not null references public.users (id) on delete restrict,
  approved_at timestamptz not null default timezone('utc', now()),
  used_at timestamptz,
  request_id text,
  consumed_transaction_id uuid references public.phone_transactions (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  request_id text,
  event_type text not null,
  severity text not null check (severity in ('INFO', 'WARN', 'ERROR')),
  actor_user_id uuid references public.users (id) on delete set null,
  actor_role text not null default 'anonymous'
    check (actor_role in ('student', 'teacher', 'homeroom', 'admin', 'anonymous', 'system')),
  student_id uuid references public.students (id) on delete set null,
  container_id uuid references public.containers (id) on delete set null,
  transaction_id uuid references public.phone_transactions (id) on delete set null,
  route_method text not null,
  route_path text not null,
  status_code integer,
  ip_address text,
  user_agent text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.request_rate_limits (
  limit_key text not null,
  route_key text not null,
  window_started_at timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (limit_key, route_key, window_started_at)
);

create table if not exists public.student_violations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  violation_type text not null,
  timestamp timestamptz not null default timezone('utc', now()),
  resolved_at timestamptz,
  operator_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists student_violations_student_id_idx
  on public.student_violations (student_id, timestamp desc);

create index if not exists student_violations_unresolved_idx
  on public.student_violations (student_id)
  where resolved_at is null;

create or replace function public.validate_and_get_preview(
  p_student_id uuid,
  p_container_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_student_active boolean;
  v_container_active boolean;
  v_last_action text;
  v_last_timestamp timestamptz;
  v_last_type text;
  v_next_action text;
  v_active_approval record;
  v_violation_count integer;
  v_penalty_status jsonb := null;
  v_is_allowed boolean := true;
  v_error_message text := null;
  v_error_code text := null;
begin
  -- 1. Check Active Status
  select is_active into v_student_active from public.students where id = p_student_id;
  if v_student_active is not true then
    return jsonb_build_object('is_allowed', false, 'error_code', 'STUDENT_NOT_ACTIVE', 'error_message', 'Siswa tidak aktif.');
  end if;

  select is_active into v_container_active from public.containers where id = p_container_id;
  if v_container_active is not true then
    return jsonb_build_object('is_allowed', false, 'error_code', 'CONTAINER_NOT_ACTIVE', 'error_message', 'Kontainer tidak aktif.');
  end if;

  -- 2. Check Penalty Status (Milestone 24 logic)
  select count(*) into v_violation_count 
  from public.student_violations 
  where student_id = p_student_id and resolved_at is null;

  if v_violation_count >= 2 then
    v_is_allowed := false;
    v_penalty_status := jsonb_build_object(
      'is_penalized', true,
      'type', 'PARENT_PICKUP',
      'message', 'HP disita hingga diambil oleh orang tua melalui kesiswaan.'
    );
  elsif v_violation_count = 1 then
    -- Check if last violation was within 24 hours
    if exists (
      select 1 from public.student_violations 
      where student_id = p_student_id 
      and resolved_at is null 
      and timestamp > (timezone('utc', now()) - interval '24 hours')
    ) then
      v_is_allowed := false;
      v_penalty_status := jsonb_build_object(
        'is_penalized', true,
        'type', 'SEIZURE_24H',
        'message', 'HP sedang disita (1x24 jam).'
      );
    end if;
  end if;

  if v_is_allowed is false then
    return jsonb_build_object(
      'is_allowed', false,
      'penalty_status', v_penalty_status,
      'error_code', 'STUDENT_PENALIZED',
      'error_message', v_penalty_status->>'message'
    );
  end if;

  -- 3. Get Last Transaction for State Transition
  select action, "timestamp", type 
  into v_last_action, v_last_timestamp, v_last_type
  from public.phone_transactions
  where student_id = p_student_id
  order by "timestamp" desc, created_at desc
  limit 1;

  if v_last_action = 'IN' then
    v_next_action := 'OUT';
  else
    v_next_action := 'IN';
  end if;

  -- 4. Check Teacher Approvals (Only for OUT)
  if v_next_action = 'OUT' then
    select id, type, approved_at, approved_by 
    into v_active_approval
    from public.teacher_approvals
    where student_id = p_student_id 
      and container_id = p_container_id
      and status = 'PENDING'
    limit 1;
  end if;

  -- 5. Build Result
  return jsonb_build_object(
    'is_allowed', true,
    'action_preview', v_next_action,
    'transaction_type_preview', coalesce(v_active_approval.type, 'REGULAR'),
    'active_approval', case when v_active_approval.id is not null then 
      jsonb_build_object(
        'id', v_active_approval.id,
        'type', v_active_approval.type,
        'approved_at', v_active_approval.approved_at
      ) else null end,
    'last_transaction', case when v_last_action is not null then
      jsonb_build_object(
        'action', v_last_action,
        'timestamp', v_last_timestamp,
        'type', v_last_type
      ) else null end
  );
end;
$$;

create or replace function public.bulk_upsert_teacher_approvals(
  p_student_ids uuid[],
  p_container_id uuid,
  p_approval_type text,
  p_approved_by uuid,
  p_approved_at timestamptz default timezone('utc', now()),
  p_bulk_request_id text default null
)
returns table (
  student_id uuid,
  approval_id uuid,
  approval_status text,
  approved_at timestamptz,
  approval_request_id text,
  updated_at timestamptz,
  result text,
  latest_action text
)
language plpgsql
security definer
volatile
set search_path = public
as $$
begin
  if p_approval_type not in ('PEMBELAJARAN', 'DARURAT') then
    raise exception 'INVALID_APPROVAL_TYPE';
  end if;

  if not exists (
    select 1
    from public.containers
    where id = p_container_id
      and is_active = true
  ) then
    raise exception 'INVALID_CONTAINER';
  end if;

  if coalesce(array_length(p_student_ids, 1), 0) = 0 then
    return;
  end if;

  return query
  with requested_students as (
    select distinct on (items.student_id)
      items.student_id,
      items.ordinality
    from unnest(p_student_ids) with ordinality as items(student_id, ordinality)
    where items.student_id is not null
    order by items.student_id, items.ordinality
  ),
  student_state as (
    select
      requested.student_id,
      requested.ordinality,
      students.id as matched_student_id,
      students.is_active,
      latest.action as latest_action,
      pending.id as existing_pending_id,
      case
        when p_bulk_request_id is null then null
        else left(p_bulk_request_id, 80) || ':' || substr(md5(requested.student_id::text), 1, 12)
      end as derived_request_id
    from requested_students requested
    left join public.students students
      on students.id = requested.student_id
    left join lateral (
      select pt.action
      from public.phone_transactions pt
      where pt.student_id = requested.student_id
      order by pt."timestamp" desc, pt.created_at desc
      limit 1
    ) latest on true
    left join public.teacher_approvals pending
      on pending.student_id = requested.student_id
     and pending.status = 'PENDING'
  ),
  replayed as (
    select
      state.student_id,
      approvals.id as approval_id,
      approvals.status as approval_status,
      approvals.approved_at,
      approvals.request_id as approval_request_id,
      approvals.updated_at
    from student_state state
    join public.teacher_approvals approvals
      on approvals.request_id = state.derived_request_id
    where state.derived_request_id is not null
      and approvals.status = 'PENDING'
      and approvals.student_id = state.student_id
      and approvals.container_id = p_container_id
      and approvals.type = p_approval_type
  ),
  request_conflicts as (
    select state.student_id
    from student_state state
    join public.teacher_approvals approvals
      on approvals.request_id = state.derived_request_id
    where state.derived_request_id is not null
      and not (
        approvals.status = 'PENDING'
        and approvals.student_id = state.student_id
        and approvals.container_id = p_container_id
        and approvals.type = p_approval_type
      )
  ),
  eligible as (
    select
      state.student_id,
      state.existing_pending_id,
      state.derived_request_id
    from student_state state
    left join replayed replayed_rows
      on replayed_rows.student_id = state.student_id
    left join request_conflicts conflicts
      on conflicts.student_id = state.student_id
    where state.matched_student_id is not null
      and state.is_active is true
      and state.latest_action = 'IN'
      and replayed_rows.student_id is null
      and conflicts.student_id is null
  ),
  upserted as (
    insert into public.teacher_approvals (
      student_id,
      container_id,
      type,
      status,
      approved_by,
      approved_at,
      request_id
    )
    select
      eligible.student_id,
      p_container_id,
      p_approval_type,
      'PENDING',
      p_approved_by,
      p_approved_at,
      eligible.derived_request_id
    from eligible
    on conflict (student_id) where status = 'PENDING'
    do update set
      approved_at = excluded.approved_at,
      approved_by = excluded.approved_by,
      container_id = excluded.container_id,
      request_id = excluded.request_id,
      status = 'PENDING',
      type = excluded.type,
      used_at = null,
      consumed_transaction_id = null
    returning
      public.teacher_approvals.student_id,
      public.teacher_approvals.id as approval_id,
      public.teacher_approvals.status as approval_status,
      public.teacher_approvals.approved_at,
      public.teacher_approvals.request_id as approval_request_id,
      public.teacher_approvals.updated_at
  )
  select
    state.student_id,
    coalesce(upserted.approval_id, replayed.approval_id) as approval_id,
    coalesce(upserted.approval_status, replayed.approval_status) as approval_status,
    coalesce(upserted.approved_at, replayed.approved_at) as approved_at,
    coalesce(
      upserted.approval_request_id,
      replayed.approval_request_id
    ) as approval_request_id,
    coalesce(upserted.updated_at, replayed.updated_at) as updated_at,
    case
      when conflicts.student_id is not null then 'SKIPPED_REQUEST_CONFLICT'
      when state.matched_student_id is null then 'SKIPPED_NOT_FOUND'
      when state.is_active is not true then 'SKIPPED_INACTIVE'
      when state.latest_action is distinct from 'IN' then 'SKIPPED_INVALID_STATE'
      when replayed.student_id is not null then 'REPLAYED'
      when state.existing_pending_id is null then 'CREATED'
      else 'UPDATED'
    end as result,
    state.latest_action
  from student_state state
  left join upserted
    on upserted.student_id = state.student_id
  left join replayed
    on replayed.student_id = state.student_id
  left join request_conflicts conflicts
    on conflicts.student_id = state.student_id
  order by state.ordinality;
end;
$$;

create index if not exists teacher_approvals_pending_lookup_idx
  on public.teacher_approvals (student_id, container_id)
  where status = 'PENDING';

create index if not exists phone_transactions_student_id_idx
  on public.phone_transactions (student_id);

create index if not exists phone_transactions_container_id_idx
  on public.phone_transactions (container_id);

create index if not exists phone_transactions_timestamp_idx
  on public.phone_transactions ("timestamp" desc);

create index if not exists phone_transactions_student_timestamp_idx
  on public.phone_transactions (student_id, "timestamp" desc, created_at desc);

create unique index if not exists phone_transactions_request_id_uidx
  on public.phone_transactions (request_id)
  where request_id is not null;

create index if not exists teacher_approvals_student_id_idx
  on public.teacher_approvals (student_id, approved_at desc);

create unique index if not exists teacher_approvals_request_id_uidx
  on public.teacher_approvals (request_id)
  where request_id is not null;

create unique index if not exists teacher_approvals_pending_student_uidx
  on public.teacher_approvals (student_id)
  where status = 'PENDING';

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

create index if not exists audit_logs_event_type_idx
  on public.audit_logs (event_type);

create index if not exists audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id);

create index if not exists request_rate_limits_updated_at_idx
  on public.request_rate_limits (updated_at desc);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.sync_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update on auth.users
for each row
execute function public.sync_auth_user();

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
after delete on auth.users
for each row
execute function public.handle_deleted_auth_user();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
before update on public.students
for each row
execute function public.set_updated_at();

drop trigger if exists containers_set_updated_at on public.containers;
create trigger containers_set_updated_at
before update on public.containers
for each row
execute function public.set_updated_at();

drop trigger if exists teacher_approvals_set_updated_at on public.teacher_approvals;
create trigger teacher_approvals_set_updated_at
before update on public.teacher_approvals
for each row
execute function public.set_updated_at();

create or replace function public.current_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.is_active is true
  limit 1;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.role
      from public.users u
      where u.auth_user_id = auth.uid()
        and u.is_active is true
      limit 1
    ),
    'anonymous'
  );
$$;

create or replace function public.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.id
  from public.students s
  join public.users u on u.id = s.user_id
  where u.auth_user_id = auth.uid()
    and u.is_active is true
    and s.is_active is true
  limit 1;
$$;

create or replace function public.is_school_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() in ('teacher', 'homeroom', 'admin');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_app_role() = 'admin';
$$;

create or replace function public.enforce_phone_transaction_state()
returns trigger
language plpgsql
as $$
declare
  last_transaction public.phone_transactions%rowtype;
  operator_role text;
  student_active boolean;
  container_active boolean;
begin
  perform pg_advisory_xact_lock(1001, hashtext(new.student_id::text));

  select s.is_active
  into student_active
  from public.students s
  where s.id = new.student_id;

  if student_active is distinct from true then
    raise exception 'STUDENT_NOT_ACTIVE'
      using errcode = 'P0001',
            detail = 'Student must be active before a phone transaction can be created.';
  end if;

  select c.is_active
  into container_active
  from public.containers c
  where c.id = new.container_id;

  if container_active is distinct from true then
    raise exception 'INVALID_CONTAINER'
      using errcode = 'P0001',
            detail = 'Container must exist and be active before a phone transaction can be created.';
  end if;

  if new.type in ('PEMBELAJARAN', 'DARURAT') then
    select u.role
    into operator_role
    from public.users u
    where u.id = new.operator_id
      and u.is_active is true;

    if operator_role is null then
      raise exception 'UNAUTHORIZED_ACTION'
        using errcode = 'P0001',
              detail = 'Teacher override transactions require an active operator.';
    end if;

    if operator_role not in ('teacher', 'homeroom', 'admin') then
      raise exception 'UNAUTHORIZED_ACTION'
        using errcode = 'P0001',
              detail = 'Only teacher, homeroom, or admin roles may create override transactions.';
    end if;
  end if;

  select pt.*
  into last_transaction
  from public.phone_transactions pt
  where pt.student_id = new.student_id
  order by pt."timestamp" desc, pt.created_at desc
  limit 1;

  if found then
    if new."timestamp" < last_transaction."timestamp" then
      raise exception 'INVALID_TRANSACTION_TIMESTAMP'
        using errcode = 'P0001',
              detail = 'New transaction timestamp cannot be older than the latest transaction timestamp.';
    end if;

    if last_transaction.action = new.action then
      raise exception 'INVALID_STATE_TRANSITION'
        using errcode = 'P0001',
              detail = format(
                'Duplicate transition is not allowed. Last action for student %s was %s.',
                new.student_id,
                last_transaction.action
              );
    end if;
  elsif new.action = 'OUT' then
    raise exception 'INVALID_STATE_TRANSITION'
      using errcode = 'P0001',
            detail = 'A phone cannot be taken out before it has been deposited.';
  end if;

  return new;
end;
$$;

drop trigger if exists phone_transactions_enforce_state on public.phone_transactions;
create trigger phone_transactions_enforce_state
before insert on public.phone_transactions
for each row
execute function public.enforce_phone_transaction_state();

create or replace function public.register_rate_limit_hit(
  p_limit_key text,
  p_route_key text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table (
  allowed boolean,
  current_count integer,
  remaining integer,
  retry_after_seconds integer,
  window_started_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz;
  current_window timestamptz;
  current_hits integer;
  elapsed_seconds integer;
begin
  if coalesce(nullif(btrim(p_limit_key), ''), '') = '' then
    raise exception 'INVALID_RATE_LIMIT_KEY'
      using errcode = 'P0001';
  end if;

  if p_window_seconds <= 0 or p_max_hits <= 0 then
    raise exception 'INVALID_RATE_LIMIT_CONFIG'
      using errcode = 'P0001';
  end if;

  now_utc := timezone('utc', now());
  current_window := to_timestamp(
    floor(extract(epoch from now_utc) / p_window_seconds) * p_window_seconds
  );

  perform pg_advisory_xact_lock(
    2001,
    hashtext(p_limit_key || ':' || p_route_key || ':' || current_window::text)
  );

  insert into public.request_rate_limits (
    limit_key,
    route_key,
    window_started_at,
    hit_count,
    updated_at
  )
  values (
    p_limit_key,
    p_route_key,
    current_window,
    1,
    now_utc
  )
  on conflict on constraint request_rate_limits_pkey
  do update
  set
    hit_count = public.request_rate_limits.hit_count + 1,
    updated_at = excluded.updated_at
  returning hit_count into current_hits;

  elapsed_seconds := greatest(
    floor(extract(epoch from (now_utc - current_window)))::integer,
    0
  );

  return query
  select
    current_hits <= p_max_hits,
    current_hits,
    greatest(p_max_hits - current_hits, 0),
    greatest(p_window_seconds - elapsed_seconds, 1),
    current_window;
end;
$$;

create or replace function public.latest_student_transactions(student_ids uuid[] default null)
returns table (
  student_id uuid,
  container_id uuid,
  action text,
  type text,
  "timestamp" timestamptz,
  created_at timestamptz,
  operator_id uuid,
  request_id text
)
language sql
security definer
stable
set search_path = public
as $$
  select distinct on (pt.student_id)
    pt.student_id,
    pt.container_id,
    pt.action,
    pt.type,
    pt."timestamp",
    pt.created_at,
    pt.operator_id,
    pt.request_id
  from public.phone_transactions pt
  where student_ids is null
    or pt.student_id = any(student_ids)
  order by pt.student_id, pt."timestamp" desc, pt.created_at desc;
$$;

alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.containers enable row level security;
alter table public.phone_transactions enable row level security;
alter table public.teacher_approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.request_rate_limits enable row level security;

drop policy if exists users_select_self_or_staff on public.users;
create policy users_select_self_or_staff
on public.users
for select
to authenticated
using (
  id = public.current_user_id()
  or public.is_school_staff()
);

drop policy if exists users_manage_admin on public.users;
create policy users_manage_admin
on public.users
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists students_select_self_or_staff on public.students;
create policy students_select_self_or_staff
on public.students
for select
to authenticated
using (
  id = public.current_student_id()
  or public.is_school_staff()
);

drop policy if exists students_manage_admin on public.students;
create policy students_manage_admin
on public.students
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists containers_select_authenticated on public.containers;
create policy containers_select_authenticated
on public.containers
for select
to authenticated
using (public.current_user_id() is not null);

drop policy if exists containers_manage_admin on public.containers;
create policy containers_manage_admin
on public.containers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists phone_transactions_select_self_or_staff on public.phone_transactions;
create policy phone_transactions_select_self_or_staff
on public.phone_transactions
for select
to authenticated
using (
  student_id = public.current_student_id()
  or public.is_school_staff()
);

drop policy if exists teacher_approvals_select_self_or_staff on public.teacher_approvals;
create policy teacher_approvals_select_self_or_staff
on public.teacher_approvals
for select
to authenticated
using (
  student_id = public.current_student_id()
  or public.is_school_staff()
);

drop policy if exists teacher_approvals_manage_staff on public.teacher_approvals;
create policy teacher_approvals_manage_staff
on public.teacher_approvals
for all
to authenticated
using (public.is_school_staff())
with check (public.is_school_staff());

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using (public.is_admin());

grant execute on function public.current_user_id() to authenticated;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.current_student_id() to authenticated;
grant execute on function public.is_school_staff() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.latest_student_transactions(uuid[]) to authenticated;
grant execute on function public.bulk_upsert_teacher_approvals(uuid[], uuid, text, uuid, timestamptz, text) to authenticated;
grant execute on function public.bulk_upsert_teacher_approvals(uuid[], uuid, text, uuid, timestamptz, text) to service_role;
revoke all on function public.register_rate_limit_hit(text, text, integer, integer) from public;
grant execute on function public.register_rate_limit_hit(text, text, integer, integer) to authenticated;
grant execute on function public.register_rate_limit_hit(text, text, integer, integer) to service_role;

commit;
