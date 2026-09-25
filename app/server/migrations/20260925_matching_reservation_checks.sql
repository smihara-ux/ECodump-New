DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.match_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body,'INSERT INTO direct.bookings(id,construction_org_id', 'IF NOT EXISTS(SELECT 1 FROM direct.receiving_locations l WHERE l.id=dest.site_id AND l.unit=d->>''unit'' AND l.soil=d->>''soil'') THEN RAISE EXCEPTION ''LOCATION_CONDITIONS_CHANGED'' USING ERRCODE=''22023''; END IF;
 INSERT INTO direct.bookings(id,construction_org_id');
EXECUTE body;
END $$;
