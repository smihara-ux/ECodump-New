DO $$ DECLARE body text; BEGIN
SELECT pg_get_functiondef('direct.list_bookings()'::regprocedure) INTO body;
body:=replace(body, '''vehicleCompany'',', '''vehiclePlate'',(SELECT v.registration_number FROM public.vehicles v WHERE v.id=(item->''trip''->>''vehicleId'')::uuid),
 ''driverDocumentFields'',(SELECT d.fields FROM direct.driver_document_fields d JOIN direct.receipts r ON r.attachment_id=d.attachment_id WHERE r.trip_id=(item->''trip''->>''id'')::uuid),
 ''vehicleCompany'',');
EXECUTE body;
END $$;
