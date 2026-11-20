-- REVIEW ONLY: do not apply without approval. No seeded medical wording.
-- pharmacy_id comes only from verified Auth app_metadata, never from request bodies.
BEGIN;
create table public.reasons (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null,
  text text not null check (char_length(text) between 1 and 200 and text ~ '[^[:space:]]' and text !~ E'[\\r\\n]'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  unique (pharmacy_id, text)
);
alter table public.reasons enable row level security;
-- Access only through the guarded Nest API using service_role, like existing API tables.
revoke all on public.reasons from public, anon, authenticated, service_role;
grant select, insert, update on public.reasons to service_role;
-- No FK to prescription_items: reasons and final_instruction_text remain immutable text snapshots.

-- Atomic audit metadata only: never copy medical wording into logs.
-- Actor is injected by the authenticated API, never accepted from request bodies.
create function public.audit_reason_catalogue_change() returns trigger
language plpgsql set search_path = public as $$
declare fields text[];
begin
  if TG_OP = 'UPDATE' then
    if NEW.pharmacy_id is distinct from OLD.pharmacy_id then
      raise exception 'A reason cannot change pharmacy' using errcode = '23514';
    end if;
    fields := array_remove(array[
      case when NEW.text is distinct from OLD.text then 'text' end,
      case when NEW.is_active is distinct from OLD.is_active then 'is_active' end
    ], null);
    if cardinality(fields) = 0 then return NEW; end if;
  else
    fields := array['text', 'is_active'];
  end if;
  insert into public.audit_log(actor_id, action, entity_type, entity_id, changed_fields)
    values (NEW.updated_by, TG_OP, 'reasons', NEW.id::text, fields);
  return NEW;
end $$;
revoke all on function public.audit_reason_catalogue_change() from public, anon, authenticated;
grant execute on function public.audit_reason_catalogue_change() to service_role;
create trigger trg_reasons_audit after insert or update on public.reasons
  for each row execute function public.audit_reason_catalogue_change();
COMMIT;

