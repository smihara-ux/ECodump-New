-- Preserve bookings when a validation-only agreement row is removed. In normal
-- operation agreements remain immutable; deleting one must never cascade into
-- reservation or transport history.
ALTER TABLE direct.bookings
  DROP CONSTRAINT bookings_match_agreement_id_fkey;

ALTER TABLE direct.bookings
  ADD CONSTRAINT bookings_match_agreement_id_fkey
  FOREIGN KEY (match_agreement_id)
  REFERENCES direct.match_agreements(id)
  ON DELETE SET NULL;
