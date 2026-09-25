-- Shared matching extends the same core sites, identities and direct bookings.
CREATE TABLE direct.match_cases(id uuid PRIMARY KEY, site_id uuid NOT NULL REFERENCES public.sites(id), side text NOT NULL CHECK(side IN ('construction','receiving')), status text NOT NULL CHECK(status IN ('draft','published','closed')), version integer NOT NULL DEFAULT 1, data jsonb NOT NULL, created_by uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.match_history(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, case_id uuid NOT NULL REFERENCES direct.match_cases(id), version integer NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id), snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(case_id,version));
CREATE TABLE direct.match_consultations(id uuid PRIMARY KEY, source_id uuid NOT NULL REFERENCES direct.match_cases(id), target_id uuid NOT NULL REFERENCES direct.match_cases(id), version integer NOT NULL DEFAULT 1, state text NOT NULL DEFAULT 'consulting' CHECK(state IN ('consulting','agreed')), UNIQUE(source_id,target_id));
CREATE TABLE direct.match_offers(id uuid PRIMARY KEY, consultation_id uuid NOT NULL REFERENCES direct.match_consultations(id), revision integer NOT NULL, terms jsonb NOT NULL, source_snapshot jsonb NOT NULL, target_snapshot jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id), side text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(consultation_id,revision));
CREATE TABLE direct.match_acceptances(offer_id uuid NOT NULL REFERENCES direct.match_offers(id), side text NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(offer_id,side));
CREATE TABLE direct.match_agreements(id uuid PRIMARY KEY, consultation_id uuid NOT NULL UNIQUE REFERENCES direct.match_consultations(id), offer_id uuid NOT NULL UNIQUE REFERENCES direct.match_offers(id), snapshot jsonb NOT NULL, booking_id uuid UNIQUE REFERENCES direct.bookings(id), agreed_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE direct.match_operations(actor_id uuid NOT NULL REFERENCES public.profiles(id), key uuid NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL, PRIMARY KEY(actor_id,key));
ALTER TABLE direct.match_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.match_operations ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION direct.match_owns(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT direct.has_scope(site_id,side) FROM direct.match_cases WHERE id=cid),false) $$;
CREATE FUNCTION direct.match_party(cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT direct.match_owns(source_id) OR direct.match_owns(target_id) FROM direct.match_consultations WHERE id=cid),false) $$;
CREATE FUNCTION direct.match_view(cid uuid, shared_only boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE c direct.match_cases; own boolean; shared boolean; d jsonb;
BEGIN
SELECT * INTO c FROM direct.match_cases WHERE id=cid; IF NOT FOUND THEN RETURN NULL; END IF;
own:=direct.match_owns(cid);
shared:=own OR EXISTS(SELECT 1 FROM direct.match_consultations co WHERE (co.source_id=cid OR co.target_id=cid) AND direct.match_party(co.id));
IF NOT own AND NOT shared AND c.status<>'published' THEN RETURN NULL; END IF;
d:=c.data-'internal'-'documents';
IF NOT shared THEN d:=d-'shared'; END IF;
IF own AND NOT shared_only THEN d:=d||jsonb_build_object('internal',c.data->'internal'); END IF;
d:=d||jsonb_build_object('documents',coalesce((SELECT jsonb_agg(doc-'base64') FROM jsonb_array_elements(c.data->'documents') doc WHERE (own AND NOT shared_only) OR doc->>'visibility'='public' OR (shared AND doc->>'visibility'='shared')),'[]'::jsonb));
RETURN d||jsonb_build_object('id',c.id,'siteId',c.site_id,'side',c.side,'status',c.status,'version',c.version,'updatedAt',c.updated_at,'canEdit',own AND NOT shared_only);
END $$;

CREATE FUNCTION direct.match_validate(d jsonb, terms_only boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE doc jsonb;
BEGIN
IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR jsonb_typeof(d->'quantity') IS DISTINCT FROM 'number' OR (d->>'quantity')::numeric<=0 OR (d->>'quantity')::numeric>100000000 OR d->>'unit' IS NULL OR d->>'unit' NOT IN ('m3','t') OR coalesce(length(trim(d->>'soil')),0) NOT BETWEEN 1 AND 200 OR coalesce(d->>'start','') !~ '^\d{4}-\d{2}-\d{2}$' OR coalesce(d->>'end','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'INVALID_MATCH_DATA' USING ERRCODE='22023'; END IF;
IF (d->>'start')::date>(d->>'end')::date THEN RAISE EXCEPTION 'INVALID_PERIOD' USING ERRCODE='22023'; END IF;
IF NOT terms_only THEN
IF coalesce(length(trim(d->>'title')),0) NOT BETWEEN 1 AND 200 OR coalesce(length(trim(d->>'region')),0) NOT BETWEEN 1 AND 200 OR jsonb_typeof(d->'documents') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'documents')>5 THEN RAISE EXCEPTION 'INVALID_MATCH_DATA' USING ERRCODE='22023'; END IF;
FOR doc IN SELECT * FROM jsonb_array_elements(d->'documents') LOOP
IF coalesce(doc->>'visibility','') NOT IN ('public','shared','internal') OR coalesce(length(doc->>'name'),0) NOT BETWEEN 1 AND 120 OR coalesce(doc->>'mime','') NOT IN ('application/pdf','image/png','image/jpeg') OR coalesce(octet_length(decode(doc->>'base64','base64')),0) NOT BETWEEN 1 AND 1048576 THEN RAISE EXCEPTION 'INVALID_DOCUMENT' USING ERRCODE='22023'; END IF;
END LOOP;
END IF;
END $$;

CREATE FUNCTION direct.match_list(side_arg text, filters jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE out jsonb;
BEGIN
IF NOT EXISTS(SELECT 1 FROM direct.scopes sc WHERE sc.user_id=auth.uid() AND sc.role=side_arg AND direct.has_scope(sc.site_id,side_arg)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
SELECT jsonb_build_object(
'ownCases',coalesce((SELECT jsonb_agg(direct.match_view(c.id) ORDER BY c.updated_at DESC) FROM direct.match_cases c WHERE c.side=side_arg AND direct.match_owns(c.id)),'[]'::jsonb),
'searchResults',coalesce((SELECT jsonb_agg(direct.match_view(c.id) ORDER BY c.updated_at DESC) FROM direct.match_cases c WHERE c.side<>side_arg AND c.status='published' AND NOT direct.match_owns(c.id) AND (coalesce(filters->>'region','')='' OR strpos(c.data->>'region',filters->>'region')>0) AND (coalesce(filters->>'soil','')='' OR strpos(c.data->>'soil',filters->>'soil')>0) AND (coalesce(filters->>'unit','')='' OR c.data->>'unit'=filters->>'unit') AND (coalesce(filters->>'quantity','')='' OR (c.data->>'quantity')::numeric>=(filters->>'quantity')::numeric) AND (coalesce(filters->>'start','')='' OR (c.data->>'end')::date>=(filters->>'start')::date) AND (coalesce(filters->>'end','')='' OR (c.data->>'start')::date<=(filters->>'end')::date)),'[]'::jsonb),
'consultations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',co.id,'version',co.version,'state',co.state,'source',direct.match_view(co.source_id,true),'target',direct.match_view(co.target_id,true),'offers',coalesce((SELECT jsonb_agg(to_jsonb(o)-'actor_id' ORDER BY o.revision) FROM direct.match_offers o WHERE o.consultation_id=co.id),'[]'::jsonb),'acceptances',coalesce((SELECT jsonb_agg(jsonb_build_object('offerId',a.offer_id,'side',a.side,'at',a.created_at)) FROM direct.match_acceptances a JOIN direct.match_offers o ON o.id=a.offer_id WHERE o.consultation_id=co.id),'[]'::jsonb))) FROM direct.match_consultations co WHERE direct.match_party(co.id)),'[]'::jsonb),
'agreements',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'snapshot',a.snapshot,'bookingId',a.booking_id,'agreedAt',a.agreed_at)) FROM direct.match_agreements a WHERE direct.match_party(a.consultation_id)),'[]'::jsonb),
'sites',coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name)) FROM public.sites s WHERE direct.has_scope(s.id,side_arg)),'[]'::jsonb),
'history',coalesce((SELECT jsonb_agg(jsonb_build_object('caseId',h.case_id,'version',h.version,'snapshot',h.snapshot,'at',h.created_at) ORDER BY h.id DESC) FROM direct.match_history h WHERE direct.match_owns(h.case_id)),'[]'::jsonb)) INTO out;
RETURN out;
END $$;

CREATE FUNCTION direct.match_mutate(action text, key_arg uuid, p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=auth.uid(); oldop direct.match_operations; c direct.match_cases; s direct.match_cases; dest direct.match_cases; co direct.match_consultations; offer direct.match_offers; agr direct.match_agreements; side_arg text; result jsonb; cid uuid; d jsonb; bid uuid; fingerprint text:=md5(action||p::text); n integer;
BEGIN
IF actor IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('match'||actor::text||key_arg::text,0));
SELECT * INTO oldop FROM direct.match_operations WHERE actor_id=actor AND key=key_arg;
IF FOUND THEN IF oldop.fingerprint<>fingerprint THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN oldop.result; END IF;
IF action='create' THEN
side_arg:=p->>'side'; IF NOT direct.has_scope((p->>'siteId')::uuid,side_arg) THEN RAISE EXCEPTION 'FORBIDDEN_SITE' USING ERRCODE='42501'; END IF;
IF side_arg='receiving' AND NOT EXISTS(SELECT 1 FROM direct.receiving_locations WHERE id=(p->>'siteId')::uuid) THEN RAISE EXCEPTION 'INVALID_LOCATION' USING ERRCODE='22023'; END IF;
d:=p->'data'; PERFORM direct.match_validate(d); cid:=(p->>'id')::uuid;
INSERT INTO direct.match_cases VALUES(cid,(p->>'siteId')::uuid,side_arg,'draft',1,d,actor,now(),now());
ELSIF action IN ('edit','publish','close') THEN
cid:=(p->>'id')::uuid; SELECT * INTO c FROM direct.match_cases WHERE id=cid FOR UPDATE;
IF NOT FOUND OR NOT direct.match_owns(cid) THEN RAISE EXCEPTION 'FORBIDDEN_CASE' USING ERRCODE='42501'; END IF;
IF (p->>'version')::integer IS DISTINCT FROM c.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
IF action='edit' THEN d:=p->'data'; PERFORM direct.match_validate(d); UPDATE direct.match_cases SET data=d,version=version+1,updated_at=now() WHERE id=cid;
ELSE
IF (action='publish' AND c.status NOT IN ('draft','closed')) OR (action='close' AND c.status<>'published') THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
UPDATE direct.match_cases SET status=CASE action WHEN 'publish' THEN 'published' ELSE 'closed' END,version=version+1,updated_at=now() WHERE id=cid;
END IF;
ELSIF action='consult' THEN
SELECT * INTO s FROM direct.match_cases WHERE id=(p->>'sourceId')::uuid;
SELECT * INTO dest FROM direct.match_cases WHERE id=(p->>'targetId')::uuid;
IF s.id IS NULL OR dest.id IS NULL OR NOT direct.match_owns(s.id) OR direct.match_owns(dest.id) OR s.side=dest.side OR s.status<>'published' OR dest.status<>'published' THEN RAISE EXCEPTION 'FORBIDDEN_CONSULT' USING ERRCODE='42501'; END IF;
-- Canonical orientation prevents duplicate receiver-initiated versus constructor-initiated threads.
IF s.side='receiving' THEN c:=s; s:=dest; dest:=c; END IF;
INSERT INTO direct.match_consultations(id,source_id,target_id) VALUES((p->>'id')::uuid,s.id,dest.id) RETURNING * INTO co;
result:=jsonb_build_object('consultationId',co.id);
ELSIF action IN ('offer','accept','reserve') THEN
SELECT * INTO co FROM direct.match_consultations WHERE id=(p->>'id')::uuid FOR UPDATE;
IF co.id IS NULL OR NOT direct.match_party(co.id) THEN RAISE EXCEPTION 'FORBIDDEN_CONSULT' USING ERRCODE='42501'; END IF;
SELECT * INTO s FROM direct.match_cases WHERE id=co.source_id; SELECT * INTO dest FROM direct.match_cases WHERE id=co.target_id;
side_arg:=CASE WHEN direct.match_owns(s.id) THEN 'construction' ELSE 'receiving' END;
IF action<>'reserve' AND (p->>'version')::integer IS DISTINCT FROM co.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
IF action IN ('offer','accept') AND co.state<>'consulting' THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
IF action='offer' THEN
 d:=p->'terms'; PERFORM direct.match_validate(d,true);
 IF d->>'unit' IS DISTINCT FROM s.data->>'unit' OR d->>'unit' IS DISTINCT FROM dest.data->>'unit' OR d->>'soil' IS DISTINCT FROM s.data->>'soil' OR d->>'soil' IS DISTINCT FROM dest.data->>'soil' OR (d->>'quantity')::numeric>least((s.data->>'quantity')::numeric,(dest.data->>'quantity')::numeric) OR (d->>'start')::date<greatest((s.data->>'start')::date,(dest.data->>'start')::date) OR (d->>'end')::date>least((s.data->>'end')::date,(dest.data->>'end')::date) THEN RAISE EXCEPTION 'TERMS_OUTSIDE_CASE' USING ERRCODE='22023'; END IF;
 SELECT coalesce(max(revision),0)+1 INTO n FROM direct.match_offers WHERE consultation_id=co.id;
 INSERT INTO direct.match_offers VALUES(gen_random_uuid(),co.id,n,d,direct.match_view(s.id,true),direct.match_view(dest.id,true),actor,side_arg,now());
ELSIF action='accept' THEN
 SELECT * INTO offer FROM direct.match_offers WHERE consultation_id=co.id ORDER BY revision DESC LIMIT 1;
 IF offer.id IS NULL OR offer.id IS DISTINCT FROM (p->>'offerId')::uuid THEN RAISE EXCEPTION 'STALE_OFFER' USING ERRCODE='40001'; END IF;
 INSERT INTO direct.match_acceptances VALUES(offer.id,side_arg,actor,now());
 IF (SELECT count(*) FROM direct.match_acceptances WHERE offer_id=offer.id)=2 THEN
 INSERT INTO direct.match_agreements(id,consultation_id,offer_id,snapshot) VALUES(gen_random_uuid(),co.id,offer.id,jsonb_build_object('terms',offer.terms,'source',offer.source_snapshot,'target',offer.target_snapshot,'revision',offer.revision));
 UPDATE direct.match_consultations SET state='agreed' WHERE id=co.id;
 END IF;
ELSE
 IF side_arg<>'construction' OR co.state<>'agreed' THEN RAISE EXCEPTION 'FORBIDDEN_RESERVATION' USING ERRCODE='42501'; END IF;
 SELECT * INTO agr FROM direct.match_agreements WHERE consultation_id=co.id FOR UPDATE;
 IF agr.booking_id IS NOT NULL THEN result:=jsonb_build_object('bookingId',agr.booking_id,'status','requested');
 ELSE
 d:=agr.snapshot->'terms'; bid:=gen_random_uuid();
 IF NOT direct.has_scope(s.site_id,'construction') THEN RAISE EXCEPTION 'FORBIDDEN_SITE' USING ERRCODE='42501'; END IF;
 INSERT INTO direct.bookings(id,construction_org_id,receiving_org_id,site_id,receiving_location_id,created_by,business_date,planned_at,soil,quantity,unit,agreement_note,agreement_state,status)
 SELECT bid,ss.organization_id,ds.organization_id,s.site_id,dest.site_id,actor,(d->>'start')::date,((d->>'start')||'T09:00:00+09:00')::timestamptz,d->>'soil',(d->>'quantity')::numeric,d->>'unit','発生土マッチ合意 '||agr.id::text||' / '||coalesce(d->>'conditions',''),'agreed','requested' FROM public.sites ss,public.sites ds WHERE ss.id=s.site_id AND ds.id=dest.site_id;
 UPDATE direct.match_agreements SET booking_id=bid WHERE id=agr.id;
 result:=jsonb_build_object('bookingId',bid,'status','requested');
 END IF;
END IF;
IF action<>'reserve' THEN UPDATE direct.match_consultations SET version=version+1 WHERE id=co.id; END IF;
result:=coalesce(result,jsonb_build_object('consultationId',co.id));
ELSE RAISE EXCEPTION 'UNKNOWN_ACTION' USING ERRCODE='22023'; END IF;
IF cid IS NOT NULL THEN
 INSERT INTO direct.match_history(case_id,version,actor_id,snapshot) SELECT id,version,actor,direct.match_view(id) FROM direct.match_cases WHERE id=cid;
 result:=jsonb_build_object('caseId',cid);
END IF;
INSERT INTO direct.match_operations VALUES(actor,key_arg,fingerprint,result);
RETURN result;
END $$;

CREATE FUNCTION direct.match_document(cid uuid, docid text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE view_data jsonb; doc jsonb;
BEGIN
IF NOT EXISTS(SELECT 1 FROM direct.scopes s WHERE s.user_id=auth.uid() AND direct.has_scope(s.site_id,s.role)) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
view_data:=direct.match_view(cid);
IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(view_data->'documents') d WHERE d->>'id'=docid) THEN RAISE EXCEPTION 'FORBIDDEN_DOCUMENT' USING ERRCODE='42501'; END IF;
SELECT d INTO doc FROM direct.match_cases c,jsonb_array_elements(c.data->'documents') d WHERE c.id=cid AND d->>'id'=docid;
RETURN doc;
END $$;
CREATE FUNCTION direct.match_operation(key_arg uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT jsonb_build_object('status','completed','result',result) FROM direct.match_operations WHERE actor_id=auth.uid() AND key=key_arg),'{"status":"unknown"}'::jsonb) $$;
REVOKE ALL ON direct.match_cases,direct.match_history,direct.match_consultations,direct.match_offers,direct.match_acceptances,direct.match_agreements,direct.match_operations FROM PUBLIC,authenticated,anon;
REVOKE ALL ON FUNCTION direct.match_owns(uuid),direct.match_party(uuid),direct.match_view(uuid,boolean),direct.match_validate(jsonb,boolean),direct.match_list(text,jsonb),direct.match_mutate(text,uuid,jsonb),direct.match_document(uuid,text),direct.match_operation(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION direct.match_list(text,jsonb),direct.match_mutate(text,uuid,jsonb),direct.match_document(uuid,text),direct.match_operation(uuid) TO authenticated;
