-- Match the booking -> trip lock order used by the shared receiving mutations.
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('direct.driver_document_submit(uuid,jsonb)'::regprocedure);
 definition:=replace(definition,' SELECT * INTO tr FROM direct.trips',E' PERFORM 1 FROM direct.bookings WHERE id=(payload->>''bookingId'')::uuid FOR UPDATE;\n SELECT * INTO tr FROM direct.trips');
 EXECUTE definition;
END $$;
