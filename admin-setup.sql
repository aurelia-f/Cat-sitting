-- Fonction admin : renvoie tous les comptes SEULEMENT si le code est bon.
-- Fonctionne sans être connecté. Change '0808' ici si tu veux un autre code.
create or replace function admin_list_accounts(admin_code text)
returns setof cat_sitting_data
language plpgsql
security definer
set search_path = public
as $$
begin
  if admin_code is distinct from '0808' then
    raise exception 'Code admin incorrect';
  end if;
  return query select * from cat_sitting_data order by updated_at desc;
end;
$$;

revoke all on function admin_list_accounts(text) from public;
grant execute on function admin_list_accounts(text) to anon, authenticated;

-- Sécurité : plus personne ne peut lire les lignes des autres directement
drop policy if exists "Authenticated users can read all rows" on cat_sitting_data;
create policy "Users can read their own row"
  on cat_sitting_data for select
  to authenticated
  using (auth.uid() = user_id);
notify pgrst, 'reload schema';
