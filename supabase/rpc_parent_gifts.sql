-- RPCs for deterministic claim/unclaim using current auth.uid()

-- Claim a parent gift if unclaimed
create or replace function public.claim_parent_gift(p_id uuid)
returns parent_gifts
language sql
security definer
set search_path = public
as $$
  update parent_gifts
  set claimed_by = auth.uid(),
      claimed_at = now()
  where id = p_id
    and claimed_by is null
  returning *;
$$;

revoke all on function public.claim_parent_gift(uuid) from public;
grant execute on function public.claim_parent_gift(uuid) to authenticated;

-- Unclaim a parent gift if owned by current user
create or replace function public.unclaim_parent_gift(p_id uuid)
returns parent_gifts
language sql
security definer
set search_path = public
as $$
  update parent_gifts
  set claimed_by = null,
      claimed_at = null
  where id = p_id
    and claimed_by = auth.uid()
  returning *;
$$;

revoke all on function public.unclaim_parent_gift(uuid) from public;
grant execute on function public.unclaim_parent_gift(uuid) to authenticated;


