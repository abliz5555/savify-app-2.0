-- ════════════════════════════════════════════════════════════════════════════
--  SAVIFY — complete database setup (Supabase, free plan)
--
--  HOW TO USE
--  1. Open your Supabase project → SQL Editor → New query
--  2. Paste this whole file → press RUN
--  3. You should see "Success. No rows returned"
--
--  ⚠️  This file DELETES the old test tables (they used Clerk user ids,
--      which no longer work). Only run it while the app is still in testing.
--  It is safe to run again later — it always rebuilds the same structure.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Remove old tables & functions ─────────────────────────────────────────
drop table if exists loan_payments      cascade;
drop table if exists loans              cascade;
drop table if exists transactions       cascade;
drop table if exists savings_goals      cascade;
drop table if exists budget_goals       cascade;
drop table if exists recurring_expenses cascade;
drop table if exists financial_profiles cascade;
drop table if exists active_devices     cascade;
drop table if exists ai_usage           cascade;

-- ── 1. Tables ────────────────────────────────────────────────────────────────
-- Every row belongs to one user. user_id is filled in automatically from the
-- logged-in user, so the app can never write data for somebody else.

create table financial_profiles (
  user_id          uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  cash_on_hand     numeric(15,2) not null default 0,
  bank_balance     numeric(15,2) not null default 0,
  savings_balance  numeric(15,2) not null default 0,
  investments      numeric(15,2) not null default 0,
  other_assets     numeric(15,2) not null default 0,
  total_debts      numeric(15,2) not null default 0,
  monthly_income   numeric(15,2),
  monthly_expenses numeric(15,2),
  savings_goal     numeric(15,2),
  updated_at       timestamptz not null default now()
);

create table transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('income','expense','savings')),
  description text not null default '',
  amount      numeric(12,2) not null check (amount >= 0),
  category    text not null,
  account     text check (account is null or account in ('cash','bank','savings')),
  created_at  timestamptz not null default now()
);
create index transactions_user_date_idx on transactions (user_id, created_at desc);

create table loans (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lender_name  text not null,
  description  text not null default '',
  total_amount numeric(12,2) not null check (total_amount >= 0),
  direction    text not null default 'borrowed' check (direction in ('borrowed','lent')),
  due_date     date,
  created_at   timestamptz not null default now()
);
create index loans_user_idx on loans (user_id);

create table loan_payments (
  id      uuid primary key default gen_random_uuid(),
  loan_id uuid not null references loans(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount  numeric(12,2) not null check (amount > 0),
  note    text,
  paid_at timestamptz not null default now()
);
create index loan_payments_loan_idx on loan_payments (loan_id);
create index loan_payments_user_idx on loan_payments (user_id);

create table savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name           text not null,
  target_amount  numeric(12,2) not null check (target_amount >= 0),
  current_amount numeric(12,2) not null default 0,
  target_date    date,
  created_at     timestamptz not null default now()
);
create index savings_goals_user_idx on savings_goals (user_id);

create table budget_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  category      text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit >= 0),
  created_at    timestamptz not null default now()
);
create index budget_goals_user_idx on budget_goals (user_id);

create table recurring_expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name          text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  category      text not null,
  due_day       integer not null check (due_day between 1 and 31),
  active        boolean not null default true,
  frequency     text not null default 'monthly' check (frequency in ('daily','weekly','monthly','yearly')),
  notes         text,
  next_due_date date,
  paid_tx_id    uuid,
  created_at    timestamptz not null default now()
);
create index recurring_user_idx on recurring_expenses (user_id);

-- One active phone per account (used by "single device" protection)
create table active_devices (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  device_id  text not null,
  updated_at timestamptz not null default now()
);

-- Counts AI receipt scans per day, so nobody can use up your free Gemini quota
create table ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default current_date,
  count   integer not null default 0,
  primary key (user_id, day)
);

-- ── 2. Security: each user can only ever see and change their OWN rows ──────
do $$
declare t text;
begin
  foreach t in array array['financial_profiles','transactions','loans','loan_payments',
                           'savings_goals','budget_goals','recurring_expenses','active_devices']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "owner only" on %I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ai_usage: users may only READ their own counter (the server function writes it)
alter table ai_usage enable row level security;
create policy "read own usage" on ai_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Nobody who is logged out can touch anything
revoke all on all tables in schema public from anon;

-- ── 3. Helper: move money in/out of one account (cash / bank / savings) ─────
create or replace function _adjust_balance(p_account text, p_delta numeric)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_account is null or p_delta = 0 then return; end if;
  insert into financial_profiles (user_id) values (auth.uid())
    on conflict (user_id) do nothing;
  update financial_profiles set
    cash_on_hand    = cash_on_hand    + case when p_account = 'cash'    then p_delta else 0 end,
    bank_balance    = bank_balance    + case when p_account = 'bank'    then p_delta else 0 end,
    savings_balance = savings_balance + case when p_account = 'savings' then p_delta else 0 end,
    updated_at = now()
  where user_id = auth.uid();
end $$;

-- Next due date that never "drifts" (a bill on the 31st stays at month-end)
create or replace function _next_due(p_frequency text, p_from date, p_due_day int)
returns date language plpgsql immutable as $$
declare base date; last_day int;
begin
  if p_frequency = 'daily'  then return p_from + 1; end if;
  if p_frequency = 'weekly' then return p_from + 7; end if;
  if p_frequency = 'yearly' then base := date_trunc('month', p_from + interval '1 year')::date;
  else                           base := date_trunc('month', p_from + interval '1 month')::date;
  end if;
  last_day := extract(day from (base + interval '1 month' - interval '1 day'))::int;
  return base + (least(coalesce(p_due_day, extract(day from p_from)::int), last_day) - 1);
end $$;

-- ── 4. App actions (each one runs as ONE safe step: all or nothing) ─────────

create or replace function add_transaction(
  p_type text, p_description text, p_amount numeric, p_category text,
  p_account text default null, p_created_at timestamptz default null)
returns transactions language plpgsql security invoker set search_path = public as $$
declare r transactions;
begin
  insert into transactions (type, description, amount, category, account, created_at)
  values (p_type, coalesce(p_description,''), p_amount, p_category, p_account, coalesce(p_created_at, now()))
  returning * into r;
  perform _adjust_balance(p_account, case when p_type = 'income' then p_amount else -p_amount end);
  return r;
end $$;

create or replace function update_transaction(
  p_id uuid, p_type text, p_description text, p_amount numeric, p_category text, p_account text default null)
returns transactions language plpgsql security invoker set search_path = public as $$
declare old transactions; r transactions;
begin
  select * into old from transactions where id = p_id;
  if not found then raise exception 'Transaction not found'; end if;
  perform _adjust_balance(old.account, case when old.type = 'income' then -old.amount else old.amount end);
  update transactions set type = p_type, description = coalesce(p_description,''),
         amount = p_amount, category = p_category, account = p_account
   where id = p_id returning * into r;
  perform _adjust_balance(p_account, case when p_type = 'income' then p_amount else -p_amount end);
  return r;
end $$;

create or replace function delete_transaction(p_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare old transactions;
begin
  delete from transactions where id = p_id returning * into old;
  if not found then return; end if;
  perform _adjust_balance(old.account, case when old.type = 'income' then -old.amount else old.amount end);
  -- if this was a bill payment, the bill goes back to "unpaid"
  update recurring_expenses set paid_tx_id = null where paid_tx_id = p_id;
end $$;

create or replace function add_loan(
  p_lender_name text, p_description text, p_total_amount numeric, p_direction text,
  p_due_date date default null, p_account text default null)
returns loans language plpgsql security invoker set search_path = public as $$
declare r loans;
begin
  insert into loans (lender_name, description, total_amount, direction, due_date)
  values (p_lender_name, coalesce(p_description,''), p_total_amount, coalesce(p_direction,'borrowed'), p_due_date)
  returning * into r;
  -- borrowed money comes IN to your account, lent money goes OUT
  perform _adjust_balance(p_account, case when r.direction = 'borrowed' then p_total_amount else -p_total_amount end);
  return r;
end $$;

create or replace function add_loan_payment(
  p_loan_id uuid, p_amount numeric, p_note text default null, p_account text default null)
returns loan_payments language plpgsql security invoker set search_path = public as $$
declare l loans; r loan_payments;
begin
  select * into l from loans where id = p_loan_id;
  if not found then raise exception 'Loan not found'; end if;
  insert into loan_payments (loan_id, amount, note) values (p_loan_id, p_amount, p_note) returning * into r;
  -- you pay back a debt → money OUT; someone pays you back → money IN
  perform _adjust_balance(p_account, case when l.direction = 'borrowed' then -p_amount else p_amount end);
  return r;
end $$;

create or replace function pay_bill(p_id uuid, p_account text default null)
returns json language plpgsql security invoker set search_path = public as $$
declare b recurring_expenses; tx transactions; nxt date;
begin
  select * into b from recurring_expenses where id = p_id for update;
  if not found then raise exception 'Bill not found'; end if;
  tx := add_transaction('expense', b.name, b.amount, b.category, p_account, null);
  nxt := _next_due(b.frequency, coalesce(b.next_due_date, current_date), b.due_day);
  update recurring_expenses set next_due_date = nxt, paid_tx_id = tx.id where id = p_id;
  return json_build_object('transaction', row_to_json(tx), 'nextDueDate', nxt);
end $$;

create or replace function contribute_savings_goal(p_id uuid, p_amount numeric, p_account text default null)
returns savings_goals language plpgsql security invoker set search_path = public as $$
declare r savings_goals;
begin
  update savings_goals set current_amount = current_amount + p_amount where id = p_id returning * into r;
  if not found then raise exception 'Goal not found'; end if;
  perform _adjust_balance(p_account, -p_amount);
  perform _adjust_balance('savings', p_amount);
  return r;
end $$;

-- Delete all MY data (keeps the account)
create or replace function reset_my_data()
returns void language plpgsql security invoker set search_path = public as $$
begin
  delete from loan_payments      where user_id = auth.uid();
  delete from loans              where user_id = auth.uid();
  delete from transactions       where user_id = auth.uid();
  delete from savings_goals      where user_id = auth.uid();
  delete from budget_goals       where user_id = auth.uid();
  delete from recurring_expenses where user_id = auth.uid();
end $$;

-- Replace all MY data with a backup (if anything fails, nothing is changed)
create or replace function import_my_data(p jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare l jsonb; new_loan uuid;
begin
  perform reset_my_data();

  insert into transactions (type, description, amount, category, account, created_at)
  select x->>'type', coalesce(x->>'description',''), (x->>'amount')::numeric, x->>'category',
         nullif(x->>'account',''), coalesce((x->>'createdAt')::timestamptz, now())
  from jsonb_array_elements(coalesce(p->'transactions','[]')) x;

  for l in select * from jsonb_array_elements(coalesce(p->'loans','[]')) loop
    insert into loans (lender_name, description, total_amount, direction, due_date, created_at)
    values (l->>'lenderName', coalesce(l->>'description',''), (l->>'totalAmount')::numeric,
            coalesce(l->>'direction', case when l->>'lenderName' like '[Lent]%' then 'lent' else 'borrowed' end),
            (left(l->>'dueDate',10))::date, coalesce((l->>'createdAt')::timestamptz, now()))
    returning id into new_loan;
    insert into loan_payments (loan_id, amount, note, paid_at)
    select new_loan, (y->>'amount')::numeric, y->>'note', coalesce((y->>'paidAt')::timestamptz, now())
    from jsonb_array_elements(coalesce(l->'payments','[]')) y;
  end loop;

  insert into budget_goals (name, category, monthly_limit)
  select coalesce(x->>'name', x->>'category'), x->>'category', (x->>'monthlyLimit')::numeric
  from jsonb_array_elements(coalesce(p->'budgetGoals','[]')) x;

  insert into savings_goals (name, target_amount, current_amount, target_date)
  select x->>'name', (x->>'targetAmount')::numeric, coalesce((x->>'currentAmount')::numeric,0),
         (left(x->>'targetDate',10))::date
  from jsonb_array_elements(coalesce(p->'savingsGoals','[]')) x;

  insert into recurring_expenses (name, amount, category, due_day, active, frequency, notes, next_due_date)
  select x->>'name', (x->>'amount')::numeric, x->>'category', (x->>'dueDay')::int,
         coalesce((x->>'active')::boolean, true), coalesce(x->>'frequency','monthly'),
         x->>'notes', (left(x->>'nextDueDate',10))::date
  from jsonb_array_elements(coalesce(p->'recurring','[]')) x;
end $$;

-- Permanently delete MY account and all my data (Apple requires this option)
create or replace function delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();   -- every table cascades
end $$;

-- Only logged-in users may run these
do $$
declare f text;
begin
  foreach f in array array['add_transaction(text,text,numeric,text,text,timestamptz)',
    'update_transaction(uuid,text,text,numeric,text,text)','delete_transaction(uuid)',
    'add_loan(text,text,numeric,text,date,text)','add_loan_payment(uuid,numeric,text,text)',
    'pay_bill(uuid,text)','contribute_savings_goal(uuid,numeric,text)','reset_my_data()',
    'import_my_data(jsonb)','delete_my_account()','_adjust_balance(text,numeric)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
