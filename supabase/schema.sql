-- Схема облака для «Японии». Живёт в том же проекте Supabase, что и «Планер», — все таблицы с префиксом jp_.
-- Выполнить: npm run supabase -- schema (или Supabase → SQL Editor). Повторный запуск безопасен.

/* ===================== Участники и роли ===================== */

-- owner — владелец, admin — добавляет и правит записи, приглашает людей, viewer — только смотрит.
-- Новых участников добавляет функция jp-invite (секретным ключом), поэтому политики на insert нет.
create table if not exists public.jp_members (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  email    text        not null,
  name     text        not null default '',
  role     text        not null check (role in ('owner', 'admin', 'viewer')),
  added_at timestamptz not null default now()
);

-- Роль того, кто делает запрос (null — не участник). security definer — чтобы политики jp_members не зациклились.
create or replace function public.jp_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.jp_members where user_id = (select auth.uid())
$$;

revoke all on function public.jp_role() from public, anon;
grant execute on function public.jp_role() to authenticated, service_role;

alter table public.jp_members enable row level security;

drop policy if exists "jp_members: read" on public.jp_members;
create policy "jp_members: read" on public.jp_members
  for select to authenticated
  using ((select public.jp_role()) is not null);

-- Менять роль и удалять участника могут owner и admin; владельца не трогает никто, и назначить владельца нельзя.
drop policy if exists "jp_members: update" on public.jp_members;
create policy "jp_members: update" on public.jp_members
  for update to authenticated
  using ((select public.jp_role()) in ('owner', 'admin') and role <> 'owner')
  with check ((select public.jp_role()) in ('owner', 'admin') and role <> 'owner');

drop policy if exists "jp_members: delete" on public.jp_members;
create policy "jp_members: delete" on public.jp_members
  for delete to authenticated
  using ((select public.jp_role()) in ('owner', 'admin') and role <> 'owner');

revoke all on public.jp_members from anon;
grant select, update, delete on public.jp_members to authenticated;
grant select, insert, update, delete on public.jp_members to service_role;

/* ===================== Записи (места, категории, гайды, входящие) ===================== */

-- Как records в «Планере», но общая для всех участников: без user_id, доступ — по роли.
create table if not exists public.jp_records (
  id                text        primary key,
  kind              text        not null,
  data              jsonb       not null default '{}'::jsonb,
  updated_at        bigint      not null,                  -- время изменения на устройстве, мс (кто позже — тот и прав)
  deleted           boolean     not null default false,    -- удаление = пометка, чтобы оно доехало до других устройств
  server_updated_at timestamptz not null default now(),    -- курсор для скачивания изменений
  created_by        uuid        default auth.uid() references auth.users (id) on delete set null
);

create index if not exists jp_records_server_updated_idx on public.jp_records (server_updated_at);

alter table public.jp_records enable row level security;

drop policy if exists "jp_records: read" on public.jp_records;
create policy "jp_records: read" on public.jp_records
  for select to authenticated
  using ((select public.jp_role()) is not null);

drop policy if exists "jp_records: insert" on public.jp_records;
create policy "jp_records: insert" on public.jp_records
  for insert to authenticated
  with check ((select public.jp_role()) in ('owner', 'admin'));

drop policy if exists "jp_records: update" on public.jp_records;
create policy "jp_records: update" on public.jp_records
  for update to authenticated
  using ((select public.jp_role()) in ('owner', 'admin'))
  with check ((select public.jp_role()) in ('owner', 'admin'));

revoke all on public.jp_records from anon;
grant select, insert, update on public.jp_records to authenticated;
-- Для scripts/japan.ts (секретный ключ, только на компьютере владельца).
grant select, insert, update, delete on public.jp_records to service_role;

-- Сервер сам ставит server_updated_at и не даёт более старой правке затереть более новую.
create or replace function public.jp_records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- пришла устаревшая версия — молча пропускаем
    end if;
    new.created_by := old.created_by;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists jp_records_before_write on public.jp_records;
create trigger jp_records_before_write
  before insert or update on public.jp_records
  for each row execute function public.jp_records_before_write();

/* ===================== Фото ===================== */

-- Публичное чтение по ссылке (имена файлов случайные), загружать и удалять — owner и admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jp-photos', 'jp-photos', true, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "jp-photos: insert" on storage.objects;
create policy "jp-photos: insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'jp-photos' and (select public.jp_role()) in ('owner', 'admin'));

-- Удаление через API хранилища сначала читает строку файла — без select-политики удалить нельзя.
drop policy if exists "jp-photos: select" on storage.objects;
create policy "jp-photos: select" on storage.objects
  for select to authenticated
  using (bucket_id = 'jp-photos' and (select public.jp_role()) is not null);

drop policy if exists "jp-photos: delete" on storage.objects;
create policy "jp-photos: delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'jp-photos' and (select public.jp_role()) in ('owner', 'admin'));
