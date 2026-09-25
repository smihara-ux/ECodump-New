-- Amend RPC guards with NULL-safe comparisons without editing applied migrations.
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body, 'payload->>''agree''<>''true''', 'payload->>''agree'' IS DISTINCT FROM ''true''');
body:=replace(body, '(payload->>''expectedVersion'')::integer<>b.version', '(payload->>''expectedVersion'')::integer IS DISTINCT FROM b.version');
body:=replace(body, 'tr.version<>(payload->>''expectedVersion'')::integer', 'tr.version IS DISTINCT FROM (payload->>''expectedVersion'')::integer');
EXECUTE body;
END $$;
-- Drivers consume the minimal shared projection, never the raw agreement row.
DROP POLICY bookings_read ON direct.bookings;
CREATE POLICY bookings_read ON direct.bookings FOR SELECT USING(direct.has_scope(site_id,'construction') OR direct.has_scope(receiving_location_id,'receiving'));
