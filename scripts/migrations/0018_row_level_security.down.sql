-- Deliberately a no-op. Turning RLS back off would reopen every table to the
-- public REST API; if that is ever genuinely wanted, do it by hand, per table.
select 1;
