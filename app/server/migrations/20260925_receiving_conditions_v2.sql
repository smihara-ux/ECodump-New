CREATE TABLE direct.receiving_conditions(
 location_id uuid PRIMARY KEY REFERENCES direct.receiving_locations(id),timezone text NOT NULL DEFAULT 'Asia/Tokyo',
 business_days smallint[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6],opens_at time NOT NULL DEFAULT '08:00',closes_at time NOT NULL DEFAULT '17:00',
 soil text NOT NULL,unit text NOT NULL CHECK(unit IN ('m3','t')),daily_limit numeric(12,3) NOT NULL CHECK(daily_limit>0 AND daily_limit<1000000000),
 version integer NOT NULL DEFAULT 1,updated_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO direct.receiving_conditions(location_id,soil,unit,daily_limit)
SELECT id,soil,unit,daily_capacity FROM direct.receiving_locations ON CONFLICT(location_id) DO NOTHING;
ALTER TABLE direct.receiving_conditions ENABLE ROW LEVEL SECURITY;
CREATE POLICY receiving_condition_read ON direct.receiving_conditions FOR SELECT USING(direct.has_scope(location_id,'receiving') OR EXISTS(SELECT 1 FROM direct.partner_locations p WHERE p.receiving_location_id=location_id AND direct.can_asset(p.construction_org_id)));
REVOKE ALL ON direct.receiving_conditions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON direct.receiving_conditions TO authenticated;

CREATE FUNCTION direct.list_receiving_conditions(day date DEFAULT CURRENT_DATE) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(jsonb_build_object(
 'locationId',c.location_id,'name',s.name,'timezone',c.timezone,'businessDays',c.business_days,'opensAt',c.opens_at,'closesAt',c.closes_at,
 'soil',c.soil,'unit',c.unit,'dailyLimit',c.daily_limit,'version',c.version,
 'reservedQuantity',coalesce((SELECT sum(b.quantity) FROM direct.bookings b WHERE b.receiving_location_id=c.location_id AND b.business_date=day AND b.unit=c.unit AND b.status IN ('confirmed','change_requested')),0),
 'confirmedActualQuantity',coalesce((SELECT sum(a.quantity) FROM direct.actuals a JOIN direct.trips t ON t.id=a.trip_id JOIN direct.bookings b ON b.id=t.booking_id WHERE b.receiving_location_id=c.location_id AND b.business_date=day AND a.unit=c.unit),0),
 'calculationStatus','provisional','calculationNote','予約枠の確定ルールは未確定です。確定空き容量として使用しないでください。'
) ORDER BY s.name),'[]'::jsonb)
FROM direct.receiving_conditions c JOIN public.sites s ON s.id=c.location_id
WHERE direct.has_scope(c.location_id,'receiving') OR EXISTS(SELECT 1 FROM direct.partner_locations p WHERE p.receiving_location_id=c.location_id AND direct.can_asset(p.construction_org_id)); $$;

CREATE FUNCTION direct.location_mutate(action text,key uuid,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();op direct.operations;fp text:=md5(action||payload::text);c direct.receiving_conditions;result jsonb;
BEGIN
 IF action<>'receiving_condition_update' OR actor IS NULL OR key IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));SELECT * INTO op FROM direct.operations WHERE actor_id=actor AND operation_key=key;
 IF FOUND THEN IF op.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001';END IF;RETURN op.result;END IF;
 SELECT * INTO c FROM direct.receiving_conditions WHERE location_id=(payload->>'locationId')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT direct.has_scope(c.location_id,'receiving') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 IF (payload->>'expectedVersion')::integer IS DISTINCT FROM c.version OR payload->>'unit' NOT IN ('m3','t') OR coalesce(length(trim(payload->>'soil')),0)=0 OR (payload->>'dailyLimit')::numeric<=0 OR (payload->>'opensAt')::time >= (payload->>'closesAt')::time OR jsonb_typeof(payload->'businessDays')<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements_text(payload->'businessDays') d WHERE d::integer NOT BETWEEN 0 AND 6) THEN RAISE EXCEPTION 'INVALID_CONDITIONS' USING ERRCODE='22023';END IF;
 UPDATE direct.receiving_conditions SET timezone=coalesce(payload->>'timezone',timezone),business_days=ARRAY(SELECT jsonb_array_elements_text(payload->'businessDays')::smallint),opens_at=(payload->>'opensAt')::time,closes_at=(payload->>'closesAt')::time,soil=payload->>'soil',unit=payload->>'unit',daily_limit=(payload->>'dailyLimit')::numeric,version=version+1,updated_by=actor,updated_at=now() WHERE location_id=c.location_id RETURNING * INTO c;
 UPDATE direct.receiving_locations SET soil=c.soil,unit=c.unit,daily_capacity=c.daily_limit WHERE id=c.location_id;
 result:=jsonb_build_object('locationId',c.location_id,'version',c.version,'status','updated');INSERT INTO direct.operations VALUES(actor,key,fp,result,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION direct.list_receiving_conditions(date),direct.location_mutate(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.list_receiving_conditions(date),direct.location_mutate(text,uuid,jsonb) TO authenticated;
