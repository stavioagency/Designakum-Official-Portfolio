-- page_views and portfolio_events(kind='view') counted the same thing twice, in
-- two tables free to drift apart. portfolio_events is the general store, so
-- page_views folds into it and goes away.
--
-- page_views is dropped from schema.pg.sql in the same commit, so on a fresh
-- database the table never exists and this migration has nothing to do.
DO $$
BEGIN
  IF to_regclass('public.page_views') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO portfolio_events (id, portfolio_id, kind, day, count)
  SELECT 'pev_' || pv.id, pv.portfolio_id, 'view', pv.day, pv.count
    FROM page_views pv
      ON CONFLICT (portfolio_id, kind, day) DO UPDATE
         SET count = GREATEST(portfolio_events.count, EXCLUDED.count);

  DROP TABLE page_views;
END
$$;
