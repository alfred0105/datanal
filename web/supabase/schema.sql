-- ============================================
--  Radar Analysis - DB 스키마 v2
--  그룹 + 멤버 초대 + 공유 실험
--  Supabase SQL Editor 에서 실행
-- ============================================

-- ── 1. 테이블 생성 (순서: 참조 의존성) ──

create table profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  email        text not null,
  display_name text default '',
  created_at   timestamptz default now()
);

create table groups (
  id         uuid default gen_random_uuid() primary key,
  name       text not null,
  owner_id   uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now()
);

create table group_members (
  id        uuid default gen_random_uuid() primary key,
  group_id  uuid references groups(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  role      text not null default 'member',
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

create table experiments (
  id          uuid default gen_random_uuid() primary key,
  group_id    uuid references groups(id) on delete cascade not null,
  created_by  uuid references auth.users(id) on delete set null,
  name        text not null,
  description text default '',
  variables   jsonb not null default '[]',
  created_at  timestamptz default now()
);

create table cases (
  id            uuid default gen_random_uuid() primary key,
  experiment_id uuid references experiments(id) on delete cascade not null,
  name          text not null default '',
  vals          jsonb not null default '{}',
  result        text not null default '실패',
  created_at    timestamptz default now()
);

-- ── 2. 인덱스 ──

create index idx_group_members_user on group_members(user_id);
create index idx_group_members_group on group_members(group_id);
create index idx_experiments_group on experiments(group_id);
create index idx_cases_experiment on cases(experiment_id);

-- ── 3. RLS 활성화 ──

alter table profiles enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table experiments enable row level security;
alter table cases enable row level security;

-- ── 4. RLS 정책 (테이블이 모두 존재하므로 참조 안전) ──

-- profiles
create policy "프로필 전체 열람" on profiles for select using (true);
create policy "본인 프로필 수정" on profiles for update using (auth.uid() = id);

-- groups
create policy "그룹 멤버만 조회" on groups for select using (
  id in (select group_id from group_members where user_id = auth.uid())
);
create policy "그룹 생성" on groups for insert with check (auth.uid() = owner_id);
create policy "그룹장만 수정" on groups for update using (auth.uid() = owner_id);
create policy "그룹장만 삭제" on groups for delete using (auth.uid() = owner_id);

-- group_members
create policy "멤버 목록 조회" on group_members for select using (
  group_id in (select group_id from group_members gm where gm.user_id = auth.uid())
);
create policy "그룹장이 멤버 추가" on group_members for insert with check (
  group_id in (select id from groups where owner_id = auth.uid())
  or user_id = auth.uid()
);
create policy "그룹장이 멤버 삭제" on group_members for delete using (
  group_id in (select id from groups where owner_id = auth.uid())
);

-- experiments
create policy "그룹 멤버만 실험 조회" on experiments for select using (
  group_id in (select group_id from group_members where user_id = auth.uid())
);
create policy "그룹 멤버가 실험 생성" on experiments for insert with check (
  group_id in (select group_id from group_members where user_id = auth.uid())
);
create policy "그룹 멤버가 실험 수정" on experiments for update using (
  group_id in (select group_id from group_members where user_id = auth.uid())
);
create policy "그룹 멤버가 실험 삭제" on experiments for delete using (
  group_id in (select group_id from group_members where user_id = auth.uid())
);

-- cases
create policy "그룹 멤버만 케이스 조회" on cases for select using (
  experiment_id in (
    select e.id from experiments e
    join group_members gm on gm.group_id = e.group_id
    where gm.user_id = auth.uid()
  )
);
create policy "그룹 멤버가 케이스 생성" on cases for insert with check (
  experiment_id in (
    select e.id from experiments e
    join group_members gm on gm.group_id = e.group_id
    where gm.user_id = auth.uid()
  )
);
create policy "그룹 멤버가 케이스 수정" on cases for update using (
  experiment_id in (
    select e.id from experiments e
    join group_members gm on gm.group_id = e.group_id
    where gm.user_id = auth.uid()
  )
);
create policy "그룹 멤버가 케이스 삭제" on cases for delete using (
  experiment_id in (
    select e.id from experiments e
    join group_members gm on gm.group_id = e.group_id
    where gm.user_id = auth.uid()
  )
);

-- ── 5. 가입 시 프로필 자동 생성 트리거 ──

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
