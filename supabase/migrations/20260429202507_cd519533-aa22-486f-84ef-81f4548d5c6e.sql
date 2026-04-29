
-- Roles enum
create type public.app_role as enum ('admin', 'employee');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  hourly_rate numeric(10,2) default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

-- Has-role security definer function
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

-- Jobs
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Time entries
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  work_date date not null,
  clock_in time not null,
  clock_out time not null,
  break_minutes integer not null default 0,
  hours numeric(5,2) not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work_date)
);

create index time_entries_user_date_idx on public.time_entries(user_id, work_date);
create index time_entries_date_idx on public.time_entries(work_date);

-- Weekly reports
create table public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  week_end date not null,
  pdf_path text,
  total_regular_hours numeric(10,2) not null default 0,
  total_overtime_hours numeric(10,2) not null default 0,
  generated_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

-- Auto profile + employee role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_email boolean;
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    new.raw_user_meta_data->>'phone'
  );

  admin_email := lower(new.email) in ('gwd978@gmail.com', 'dwaynenoeconstructionllc@gmail.com');

  insert into public.user_roles (user_id, role)
  values (new.id, case when admin_email then 'admin'::public.app_role else 'employee'::public.app_role end);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.jobs enable row level security;
alter table public.time_entries enable row level security;
alter table public.weekly_reports enable row level security;

-- Profiles policies
create policy "Users view own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "Admins view all profiles" on public.profiles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id);
create policy "Admins update profiles" on public.profiles
  for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins insert profiles" on public.profiles
  for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));

-- user_roles policies
create policy "Users view own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all roles" on public.user_roles
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Jobs policies
create policy "Authenticated view jobs" on public.jobs
  for select to authenticated using (true);
create policy "Admins manage jobs" on public.jobs
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Time entries policies
create policy "Users view own entries" on public.time_entries
  for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all entries" on public.time_entries
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Users insert own entries" on public.time_entries
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own entries" on public.time_entries
  for update to authenticated using (auth.uid() = user_id);
create policy "Users delete own entries" on public.time_entries
  for delete to authenticated using (auth.uid() = user_id);
create policy "Admins manage entries" on public.time_entries
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Weekly reports
create policy "Admins view reports" on public.weekly_reports
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins manage reports" on public.weekly_reports
  for all to authenticated using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for weekly report PDFs
insert into storage.buckets (id, name, public) values ('weekly-reports', 'weekly-reports', false)
  on conflict (id) do nothing;

create policy "Admins read report files" on storage.objects
  for select to authenticated
  using (bucket_id = 'weekly-reports' and public.has_role(auth.uid(), 'admin'));
create policy "Service writes report files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'weekly-reports' and public.has_role(auth.uid(), 'admin'));

-- Seed a couple jobs
insert into public.jobs (name, address) values
  ('Shop / Yard', 'Main Shop'),
  ('Travel / Drive Time', null);
