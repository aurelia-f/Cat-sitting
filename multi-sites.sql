-- ================================================================
-- Cat Sitting : MULTI-SITES
-- À lancer UNE FOIS dans Supabase > SQL Editor, APRÈS admin-tout-en-un.sql.
-- Ajoute : la liste des sites (qui se remplit toute seule), le site de chaque compte,
-- un admin par site, et la fusion des doublons pour toi (propriétaire).
-- ================================================================

-- ---------- 1) Sites ----------
create table if not exists sites (
  id bigint generated always as identity primary key,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists sites_name_unique on sites (lower(btrim(name)));
alter table sites enable row level security;   -- aucune règle : accès uniquement via les fonctions ci-dessous

-- Sites auxquels chaque compte est rattaché
alter table cat_sitting_data add column if not exists sites text[] not null default '{}';

-- ---------- 2) Liste publique des noms de sites (pour les suggestions à l'inscription) ----------
create or replace function list_sites()
returns setof text
language sql security definer set search_path = public as $$
  select name from sites order by lower(name);
$$;
revoke all on function list_sites() from public;
grant execute on function list_sites() to anon, authenticated;

-- ---------- 3) Enregistrer un nouveau site (renvoie le nom officiel, sans doublon) ----------
create or replace function register_site(site_name text)
returns text
language plpgsql security definer set search_path = public as $$
declare clean text; existing text;
begin
  clean := left(regexp_replace(btrim(coalesce(site_name,'')), '\s+', ' ', 'g'), 60);
  if clean = '' then return null; end if;
  select name into existing from sites where lower(btrim(name)) = lower(clean);
  if existing is not null then return existing; end if;
  insert into sites (name) values (clean);
  return clean;
end; $$;
revoke all on function register_site(text) from public, anon;
grant execute on function register_site(text) to authenticated;

-- ---------- 4) Admins : nouveau rôle « site » (un admin par site) ----------
alter table admins add column if not exists site text;
alter table admins drop constraint if exists admins_role_check;
alter table admins add constraint admins_role_check check (role in ('owner','viewer','site'));
create unique index if not exists admins_one_per_site on admins (lower(btrim(site))) where role = 'site';

drop function if exists my_admin_info();
create or replace function my_admin_info()
returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('role', role, 'site', site) from admins where user_id = auth.uid();
$$;
revoke all on function my_admin_info() from public, anon;
grant execute on function my_admin_info() to authenticated;

-- Renvoie le site d'un admin de site (null pour les autres)
create or replace function admin_site(admin_code text)
returns text
language plpgsql security definer set search_path = public as $$
declare s text;
begin
  perform admin_role(admin_code);
  select site into s from admins where user_id = auth.uid();
  return s;
end; $$;
revoke all on function admin_site(text) from public, anon, authenticated;

-- ---------- 5) Liste des comptes ----------
drop function if exists admin_list_accounts(text);
create or replace function admin_list_accounts(admin_code text)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
declare r text; s text;
begin
  r := admin_role(admin_code);
  if r = 'owner' then
    return query
      select to_jsonb(c) || jsonb_build_object('last_sign_in_at', u.last_sign_in_at, 'signed_up_at', u.created_at)
      from cat_sitting_data c left join auth.users u on u.id = c.user_id
      order by u.last_sign_in_at desc nulls last;
  else
    -- admin de site / consultation : ni fiches, ni chiffre d'affaires, ni bugs
    s := admin_site(admin_code);
    return query
      select jsonb_build_object(
               'user_id', c.user_id, 'name', c.name, 'email', c.email, 'sites', c.sites,
               'last_sign_in_at', u.last_sign_in_at, 'signed_up_at', u.created_at,
               'fiche_count', (select count(*) from jsonb_object_keys(coalesce(c.profiles,'{}'::jsonb))))
      from cat_sitting_data c left join auth.users u on u.id = c.user_id
      where r <> 'site' or exists (select 1 from unnest(c.sites) x where lower(btrim(x)) = lower(btrim(s)))
      order by u.last_sign_in_at desc nulls last;
  end if;
end; $$;
revoke all on function admin_list_accounts(text) from public, anon;
grant execute on function admin_list_accounts(text) to authenticated;

-- ---------- 6) Gestion des admins (propriétaire uniquement) ----------
drop function if exists admin_list_admins(text);
create or replace function admin_list_admins(admin_code text)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if admin_role(admin_code) <> 'owner' then raise exception 'Réservé à la propriétaire'; end if;
  return query select jsonb_build_object('email', email, 'role', role, 'site', site, 'created_at', created_at)
               from admins order by role desc, created_at;
end; $$;
revoke all on function admin_list_admins(text) from public, anon;
grant execute on function admin_list_admins(text) to authenticated;

drop function if exists admin_add_admin(text, text);
drop function if exists admin_add_admin(text, text, text);
create or replace function admin_add_admin(admin_code text, target_email text, target_site text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid; clean text;
begin
  if admin_role(admin_code) <> 'owner' then raise exception 'Réservé à la propriétaire'; end if;
  select id into uid from auth.users where lower(email) = lower(btrim(target_email));
  if uid is null then raise exception 'Aucun compte avec cet email (la personne doit d''abord créer un compte)'; end if;
  clean := nullif(btrim(coalesce(target_site,'')), '');
  if clean is null then
    insert into admins (user_id, email, role) values (uid, lower(btrim(target_email)), 'viewer')
    on conflict (user_id) do nothing;
  else
    clean := register_site(clean);
    if exists (select 1 from admins where role = 'site' and lower(btrim(site)) = lower(clean) and user_id <> uid) then
      raise exception 'Ce site a déjà un admin. Retire-le d''abord.';
    end if;
    insert into admins (user_id, email, role, site) values (uid, lower(btrim(target_email)), 'site', clean)
    on conflict (user_id) do update set role = 'site', site = excluded.site
      where admins.role <> 'owner';
  end if;
end; $$;
revoke all on function admin_add_admin(text, text, text) from public, anon;
grant execute on function admin_add_admin(text, text, text) to authenticated;

drop function if exists admin_remove_admin(text, text);
create or replace function admin_remove_admin(admin_code text, target_email text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if admin_role(admin_code) <> 'owner' then raise exception 'Réservé à la propriétaire'; end if;
  delete from admins where lower(email) = lower(btrim(target_email)) and role <> 'owner';
end; $$;
revoke all on function admin_remove_admin(text, text) from public, anon;
grant execute on function admin_remove_admin(text, text) to authenticated;

-- ---------- 7) Sites : liste complète + fusion des doublons (propriétaire uniquement) ----------
create or replace function admin_list_sites(admin_code text)
returns setof jsonb
language plpgsql security definer set search_path = public as $$
begin
  if admin_role(admin_code) <> 'owner' then raise exception 'Réservé à la propriétaire'; end if;
  return query
    select jsonb_build_object(
      'name', s.name,
      'accounts', (select count(*) from cat_sitting_data c where exists
                    (select 1 from unnest(c.sites) x where lower(btrim(x)) = lower(btrim(s.name)))),
      'admin_email', (select a.email from admins a where a.role = 'site' and lower(btrim(a.site)) = lower(btrim(s.name)) limit 1))
    from sites s order by lower(s.name);
end; $$;
revoke all on function admin_list_sites(text) from public, anon;
grant execute on function admin_list_sites(text) to authenticated;

-- Fusionne (ou renomme) un site : tous les comptes, fiches et admins passent sur le nouveau nom
create or replace function admin_merge_sites(admin_code text, from_name text, to_name text)
returns void
language plpgsql security definer set search_path = public as $$
declare f text; t text;
begin
  if admin_role(admin_code) <> 'owner' then raise exception 'Réservé à la propriétaire'; end if;
  f := btrim(from_name);
  t := register_site(to_name);
  if t is null then raise exception 'Nouveau nom vide'; end if;
  if lower(f) = lower(t) and f = t then return; end if;

  -- liste des sites du compte
  update cat_sitting_data c
     set sites = (select coalesce(array_agg(distinct case when lower(btrim(x)) = lower(f) then t else x end), '{}')
                  from unnest(c.sites) x)
   where exists (select 1 from unnest(c.sites) x where lower(btrim(x)) = lower(f));

  -- site écrit dans chaque fiche + dans les préférences
  update cat_sitting_data c
     set profiles = (select coalesce(jsonb_object_agg(k,
                        case when lower(btrim(coalesce(v->>'site',''))) = lower(f) then jsonb_set(v, '{site}', to_jsonb(t)) else v end), '{}'::jsonb)
                     from jsonb_each(c.profiles) as e(k, v))
   where c.profiles::text ilike '%' || replace(f, '%', '') || '%';

  update cat_sitting_data c
     set prefs = jsonb_set(c.prefs, '{my_sites}',
                   (select coalesce(jsonb_agg(distinct case when lower(btrim(x)) = lower(f) then t else x end), '[]'::jsonb)
                    from jsonb_array_elements_text(c.prefs->'my_sites') x))
   where jsonb_typeof(c.prefs->'my_sites') = 'array';

  update admins set site = t where role = 'site' and lower(btrim(site)) = lower(f);

  delete from sites where lower(btrim(name)) = lower(f) and lower(btrim(name)) <> lower(t);
end; $$;
revoke all on function admin_merge_sites(text, text, text) from public, anon;
grant execute on function admin_merge_sites(text, text, text) to authenticated;

notify pgrst, 'reload schema';

-- Vérification : doit afficher les colonnes "sites" et la table sites vide
select column_name from information_schema.columns where table_name = 'cat_sitting_data' and column_name = 'sites';
