-- Expand operational issue vocabulary without changing the applied v2 migration.
ALTER TABLE direct.trip_issues DROP CONSTRAINT IF EXISTS trip_issues_kind_check;
ALTER TABLE direct.trip_issues ADD CONSTRAINT trip_issues_kind_check CHECK(kind IN ('delay','not_arrived','refused','vehicle_trouble','receiving_unavailable','assignment_mismatch','other'));
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.extended_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'payload->>''kind'' NOT IN (''delay'',''not_arrived'',''refused'')','payload->>''kind'' NOT IN (''delay'',''not_arrived'',''refused'',''vehicle_trouble'',''receiving_unavailable'',''assignment_mismatch'',''other'')');
 EXECUTE body;
END $$;
