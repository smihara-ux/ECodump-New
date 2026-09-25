CREATE TABLE direct.site_management(site_id uuid PRIMARY KEY REFERENCES public.sites(id),version integer NOT NULL DEFAULT 1,updated_by uuid REFERENCES public.profiles(id),updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO direct.site_management(site_id) SELECT id FROM public.sites ON CONFLICT DO NOTHING;
CREATE TABLE direct.site_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,site_id uuid NOT NULL REFERENCES public.sites(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),reason text NOT NULL,before_data jsonb NOT NULL,after_data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE direct.site_management ENABLE ROW LEVEL SECURITY;ALTER TABLE direct.site_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_management_read ON direct.site_management FOR SELECT USING(direct.has_scope(site_id,'construction'));
CREATE POLICY site_history_read ON direct.site_history FOR SELECT USING(direct.has_scope(site_id,'construction'));
REVOKE ALL ON direct.site_management,direct.site_history FROM PUBLIC,anon,authenticated;GRANT SELECT ON direct.site_management,direct.site_history TO authenticated;

CREATE FUNCTION direct.site_mutate(action text,key uuid,payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid();op direct.operations;fp text:=md5(action||payload::text);sid uuid:=(payload->>'siteId')::uuid;m direct.site_management;s public.sites;d direct.site_details;before_value jsonb;after_value jsonb;reason text:=trim(coalesce(payload->>'reason',''));result jsonb;
BEGIN
 IF action<>'site_update' OR actor IS NULL OR key IS NULL OR sid IS NULL THEN RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor::text||key::text,0));SELECT * INTO op FROM direct.operations WHERE actor_id=actor AND operation_key=key;IF FOUND THEN IF op.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001';END IF;RETURN op.result;END IF;
 IF NOT direct.has_scope(sid,'construction') THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501';END IF;
 SELECT * INTO m FROM direct.site_management WHERE site_id=sid FOR UPDATE;SELECT * INTO s FROM public.sites WHERE id=sid;SELECT * INTO d FROM direct.site_details WHERE site_id=sid;
 IF (payload->>'expectedVersion')::integer IS DISTINCT FROM m.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001';END IF;
 IF length(reason)<1 OR length(reason)>2000 OR length(trim(coalesce(payload->>'name','')))<1 OR length(payload->>'name')>200 OR length(coalesce(payload->>'address',''))>500 THEN RAISE EXCEPTION 'INVALID_SITE' USING ERRCODE='22023';END IF;
 before_value:=jsonb_build_object('site',s,'details',d,'version',m.version);
 UPDATE public.sites SET name=trim(payload->>'name'),address=trim(coalesce(payload->>'address','')) WHERE id=sid;
 INSERT INTO direct.site_details(site_id,entrance,contact_name,phone,notes) VALUES(sid,trim(coalesce(payload->>'entrance','')),trim(coalesce(payload->>'contact','')),nullif(trim(coalesce(payload->>'phone','')),''),trim(coalesce(payload->>'notes',''))) ON CONFLICT(site_id) DO UPDATE SET entrance=excluded.entrance,contact_name=excluded.contact_name,phone=excluded.phone,notes=excluded.notes;
 UPDATE direct.site_management SET version=version+1,updated_by=actor,updated_at=now() WHERE site_id=sid RETURNING * INTO m;
 SELECT jsonb_build_object('site',s2,'details',d2,'version',m.version) INTO after_value FROM public.sites s2 JOIN direct.site_details d2 ON d2.site_id=s2.id WHERE s2.id=sid;
 INSERT INTO direct.site_history(site_id,actor_id,reason,before_data,after_data) VALUES(sid,actor,reason,before_value,after_value);
 result:=jsonb_build_object('siteId',sid,'version',m.version,'status','updated');INSERT INTO direct.operations VALUES(actor,key,fp,result,now());RETURN result;
END $$;
REVOKE ALL ON FUNCTION direct.site_mutate(text,uuid,jsonb) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION direct.site_mutate(text,uuid,jsonb) TO authenticated;

