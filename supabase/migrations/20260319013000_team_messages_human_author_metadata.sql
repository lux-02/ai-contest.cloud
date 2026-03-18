alter table public.team_messages
  add column if not exists author_user_id uuid references auth.users(id) on delete set null,
  add column if not exists author_label text,
  add column if not exists author_role text;

create index if not exists team_messages_author_user_idx
  on public.team_messages (author_user_id, created_at desc);
