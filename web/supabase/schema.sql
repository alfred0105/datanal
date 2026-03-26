-- ============================================
--  Radar Analysis 웹앱 - Supabase 테이블 스키마
--  Supabase SQL Editor 에서 실행하세요
-- ============================================

-- 1) 실험 프로젝트
create table experiments (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  description text default '',
  variables   jsonb not null default '[]',   -- [{name, unit, min, max}]
  created_at  timestamptz default now()
);

alter table experiments enable row level security;
create policy "본인 실험만" on experiments
  for all using (auth.uid() = user_id);

-- 2) 실험 케이스 (행 하나 = 실험 1회)
create table cases (
  id            uuid default gen_random_uuid() primary key,
  experiment_id uuid references experiments(id) on delete cascade not null,
  name          text not null default '',
  vals          jsonb not null default '{}',   -- {변수명: 값, ...}
  result        text not null default '실패',   -- '성공' / '실패'
  created_at    timestamptz default now()
);

alter table cases enable row level security;
create policy "본인 실험 케이스만" on cases
  for all using (
    experiment_id in (
      select id from experiments where user_id = auth.uid()
    )
  );

-- 인덱스
create index idx_cases_experiment on cases(experiment_id);
create index idx_experiments_user on experiments(user_id);
