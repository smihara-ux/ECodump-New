-- Keep a relational agreement reference in addition to the existing immutable snapshot.
ALTER TABLE direct.bookings ADD COLUMN match_agreement_id uuid UNIQUE REFERENCES direct.match_agreements(id);
UPDATE direct.bookings b SET match_agreement_id=a.id FROM direct.match_agreements a WHERE a.booking_id=b.id;
CREATE FUNCTION direct.link_matching_booking() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.booking_id IS NOT NULL THEN
  UPDATE direct.bookings SET match_agreement_id=NEW.id WHERE id=NEW.booking_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER match_booking_reference AFTER INSERT OR UPDATE OF booking_id ON direct.match_agreements FOR EACH ROW EXECUTE FUNCTION direct.link_matching_booking();
REVOKE ALL ON FUNCTION direct.link_matching_booking() FROM PUBLIC,anon,authenticated;
ALTER FUNCTION direct.list_bookings() RENAME TO list_bookings_before_match_reference;
CREATE FUNCTION direct.list_bookings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(item || CASE WHEN direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving') THEN jsonb_build_object('matchAgreementId',b.match_agreement_id) ELSE '{}'::jsonb END),'[]'::jsonb)
 FROM jsonb_array_elements(direct.list_bookings_before_match_reference()) item JOIN direct.bookings b ON b.id=(item->>'id')::uuid;
$$;
REVOKE ALL ON FUNCTION direct.list_bookings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.list_bookings() TO authenticated;
