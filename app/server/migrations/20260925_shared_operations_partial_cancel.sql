-- Cancelling remaining assigned trips must not erase already confirmed actuals.
ALTER TABLE direct.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE direct.bookings ADD CONSTRAINT bookings_status_check CHECK(status IN ('requested','confirmed','change_requested','cancelled','rejected','partially_completed'));
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.extended_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,$find$UPDATE direct.bookings SET status = 'cancelled'::text, version = (version + 1)$find$,$repl$UPDATE direct.bookings SET status = CASE WHEN EXISTS(SELECT 1 FROM direct.trips t JOIN direct.actuals a ON a.trip_id=t.id WHERE t.booking_id=b.id) THEN 'partially_completed' ELSE 'cancelled' END, version = (version + 1)$repl$);
 EXECUTE body;
END $$;
