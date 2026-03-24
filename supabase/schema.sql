-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Public user profiles (exposes GitHub username for grant lookups)
create table users_public (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now()
);

-- Populate on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into users_public (id, username)
  values (new.id, new.raw_user_meta_data->>'user_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Peers (one row per active Claude Code session)
create table squad (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null unique, -- e.g. "arpan/cooperbench:main#a3f"
  status text not null default 'online' check (status in ('online', 'offline')),
  summary text,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  from_scope text not null,
  to_scope text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Grants (who can see/message which scopes)
create table grants (
  id uuid primary key default gen_random_uuid(),
  grantor_user_id uuid not null references auth.users(id) on delete cascade,
  grantee_user_id uuid not null references auth.users(id) on delete cascade,
  scope_pattern text not null, -- e.g. "arpan/cooperbench:main" or "arpan/*"
  created_at timestamptz not null default now(),
  unique (grantor_user_id, grantee_user_id, scope_pattern)
);

-- View: all squad visible to the current user
create or replace view visible_squad with (security_invoker = true) as
select p.*
from squad p
where
  -- Own squad
  p.user_id = auth.uid()
  or
  -- Peers granted to you (with wildcard support)
  exists (
    select 1 from grants g
    where g.grantee_user_id = auth.uid()
      and (
        p.scope = g.scope_pattern
        or (g.scope_pattern like '%/*' and p.scope like replace(g.scope_pattern, '*', '%'))
      )
  );

-- Auto-mark squad offline if last_seen > 2 minutes ago
create or replace function mark_stale_squad_offline()
returns void language sql security definer as $$
  update squad
  set status = 'offline'
  where status = 'online'
    and last_seen < now() - interval '2 minutes';
$$;

-- RLS
alter table squad enable row level security;
alter table messages enable row level security;
alter table grants enable row level security;
alter table users_public enable row level security;

-- squad: own rows only for write; reads go through visible_squad view
create policy "own squad" on squad
  for all using (user_id = auth.uid());

-- messages: send only to visible scopes (own or granted), read your own inbox
create policy "send messages" on messages
  for insert with check (
    to_scope in (select scope from visible_squad)
  );

create policy "read inbox" on messages
  for select using (
    to_scope in (select scope from visible_squad)
    or from_scope in (select scope from squad where user_id = auth.uid())
  );

create policy "mark read" on messages
  for update using (
    to_scope in (select scope from squad where user_id = auth.uid())
  );

create policy "delete own messages" on messages
  for delete using (
    from_scope in (select scope from squad where user_id = auth.uid())
    or to_scope in (select scope from squad where user_id = auth.uid())
  );

-- grants: manage your own grants
create policy "manage grants" on grants
  for all using (grantor_user_id = auth.uid());

create policy "view received grants" on grants
  for select using (grantee_user_id = auth.uid());

-- users_public: readable by all authenticated users
create policy "read users" on users_public
  for select using (auth.role() = 'authenticated');

-- Enable Realtime for messages
alter publication supabase_realtime add table messages;
