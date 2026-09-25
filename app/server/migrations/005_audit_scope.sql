-- Audit before_data may include agreement terms; keep it within management scopes.
DROP POLICY audit_read ON direct.audit;
CREATE POLICY audit_read ON direct.audit FOR SELECT USING(EXISTS(SELECT 1 FROM direct.bookings b WHERE b.id=booking_id AND (direct.has_scope(b.site_id,'construction') OR direct.has_scope(b.receiving_location_id,'receiving'))));
