-- ============================================================
-- ULTRONIC TEAM MANAGER
-- Weekly Capacity + Per-Task Weekly Planning
-- ============================================================

create table if not exists public.weekly_capacity (
    id uuid primary key default gen_random_uuid(),

    member_id uuid not null
        references public.team_members(id)
        on delete cascade,

    week_start date not null,

    available_minutes integer not null default 0
        check (available_minutes >= 0 and available_minutes <= 10080),

    note text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (member_id, week_start),
    check (extract(isodow from week_start) = 1)
);


create table if not exists public.task_weekly_plans (
    id uuid primary key default gen_random_uuid(),

    task_id uuid not null,
    member_id uuid not null,
    week_start date not null,

    planned_minutes integer not null default 0
        check (planned_minutes >= 0 and planned_minutes <= 10080),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (task_id, member_id, week_start),

    constraint task_weekly_plans_assignment_fk
        foreign key (task_id, member_id)
        references public.task_assignments(task_id, member_id)
        on delete cascade,

    check (extract(isodow from week_start) = 1)
);


drop trigger if exists set_weekly_capacity_updated_at
on public.weekly_capacity;

create trigger set_weekly_capacity_updated_at
before update on public.weekly_capacity
for each row
execute function public.set_updated_at();


drop trigger if exists set_task_weekly_plans_updated_at
on public.task_weekly_plans;

create trigger set_task_weekly_plans_updated_at
before update on public.task_weekly_plans
for each row
execute function public.set_updated_at();


create index if not exists idx_weekly_capacity_week
on public.weekly_capacity(week_start);

create index if not exists idx_weekly_capacity_member
on public.weekly_capacity(member_id);

create index if not exists idx_task_weekly_plans_week
on public.task_weekly_plans(week_start);

create index if not exists idx_task_weekly_plans_member
on public.task_weekly_plans(member_id);

create index if not exists idx_task_weekly_plans_task
on public.task_weekly_plans(task_id);


alter table public.weekly_capacity enable row level security;
alter table public.task_weekly_plans enable row level security;


grant usage on schema public to service_role;

grant select, insert, update, delete
on table
    public.weekly_capacity,
    public.task_weekly_plans
to service_role;


-- Verify the tables exist.
select
    table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('weekly_capacity', 'task_weekly_plans')
order by table_name;
