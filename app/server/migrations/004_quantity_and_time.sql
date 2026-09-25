ALTER TABLE direct.bookings ADD CONSTRAINT booking_finite_quantity CHECK(quantity<1000000000);
ALTER TABLE direct.actuals ADD CONSTRAINT actual_finite_quantity CHECK(quantity<1000000000);
ALTER TABLE direct.receiving_locations ADD CONSTRAINT capacity_finite CHECK(daily_capacity<1000000000);
DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
body:=replace(body, 'INSERT INTO direct.trip_events(trip_id,actor_id,state,reported_at,operation_key)',
'IF (payload->>''reportedAt'')::timestamptz < (SELECT max(reported_at) FROM direct.trip_events WHERE trip_id=tr.id) THEN RAISE EXCEPTION ''INVALID_TIME_ORDER'' USING ERRCODE=''22023''; END IF;
      INSERT INTO direct.trip_events(trip_id,actor_id,state,reported_at,operation_key)');
EXECUTE body;
END $$;
