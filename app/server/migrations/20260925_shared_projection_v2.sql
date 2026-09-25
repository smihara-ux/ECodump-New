-- Add issue/correction/company fields to the shared projection without changing
-- the existing compatibility projection.
ALTER FUNCTION direct.list_bookings() RENAME TO list_bookings_before_shared_projection;
CREATE FUNCTION direct.list_bookings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(item || jsonb_build_object(
 'constructionOrgId',b.construction_org_id,
 'constructionCompany',org.name,
 'issues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'tripId',i.trip_id,'kind',i.kind,'reason',i.reason,'status',i.status,'actorId',i.actor_id,'actorName',p.display_name,'createdAt',i.created_at,'resolvedAt',i.resolved_at,'resolution',i.resolution,'version',i.version) ORDER BY i.created_at) FROM direct.trip_issues i JOIN public.profiles p ON p.id=i.actor_id WHERE i.trip_id=(item->'trip'->>'id')::uuid),'[]'::jsonb),
 'reportCorrections',coalesce((SELECT jsonb_agg(jsonb_build_object('actorId',a.actor_id,'actorName',p.display_name,'before',a.before_data,'after',a.after_data,'createdAt',a.created_at) ORDER BY a.created_at) FROM direct.audit a JOIN public.profiles p ON p.id=a.actor_id WHERE a.booking_id=b.id AND a.action='report_correct' AND (a.after_data->'trip'->>'id')=(item->'trip'->>'id')),'[]'::jsonb)
) ORDER BY (item->>'plannedAt')::timestamptz,(item->'trip'->>'rotation')::int),'[]'::jsonb)
FROM jsonb_array_elements(direct.list_bookings_before_shared_projection()) item
JOIN direct.bookings b ON b.id=(item->>'id')::uuid
JOIN public.organizations org ON org.id=b.construction_org_id;
$$;
REVOKE ALL ON FUNCTION direct.list_bookings() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.list_bookings() TO authenticated;

CREATE TABLE direct.receiving_condition_history(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,location_id uuid NOT NULL REFERENCES direct.receiving_locations(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),before_data jsonb NOT NULL,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE direct.receiving_condition_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY receiving_condition_history_read ON direct.receiving_condition_history FOR SELECT USING(direct.has_scope(location_id,'receiving'));
REVOKE ALL ON direct.receiving_condition_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON direct.receiving_condition_history TO authenticated;
CREATE FUNCTION direct.capture_receiving_condition_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND OLD IS DISTINCT FROM NEW THEN INSERT INTO direct.receiving_condition_history(location_id,actor_id,before_data,after_data) VALUES(NEW.location_id,auth.uid(),to_jsonb(OLD),to_jsonb(NEW));END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_condition_history AFTER UPDATE ON direct.receiving_conditions FOR EACH ROW EXECUTE FUNCTION direct.capture_receiving_condition_history();
REVOKE ALL ON FUNCTION direct.capture_receiving_condition_history() FROM PUBLIC,anon;
