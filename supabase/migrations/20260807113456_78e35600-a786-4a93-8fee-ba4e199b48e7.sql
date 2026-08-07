alter table public.crm_leads add column if not exists name text;

-- Backfill existing opportunities with a sensible default name.
update public.crm_leads
set name = coalesce(nullif(trim(company_name), '') || ' opportunity', 'Opportunity')
where name is null or trim(name) = '';
