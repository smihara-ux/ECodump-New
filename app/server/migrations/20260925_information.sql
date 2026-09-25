-- Explicit information grants are deliberately empty. No business role inherits editing.
CREATE TABLE direct.info_grants(id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES public.profiles(id), scope text NOT NULL CHECK(scope IN ('platform','company','site')), target_id uuid, CHECK((scope='platform')=(target_id IS NULL)));
CREATE TABLE direct.info_articles(id uuid PRIMARY KEY, scope text NOT NULL CHECK(scope IN ('platform','company','site')), target_id uuid, status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','withdrawn')), version integer NOT NULL DEFAULT 1, data jsonb NOT NULL, actor_id uuid NOT NULL REFERENCES public.profiles(id), updated_at timestamptz NOT NULL DEFAULT now(), CHECK((scope='platform')=(target_id IS NULL)));
CREATE TABLE direct.info_history(article_id uuid REFERENCES direct.info_articles(id), version integer NOT NULL, snapshot jsonb NOT NULL, actor_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL, at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(article_id,version));
CREATE TABLE direct.info_ack(article_id uuid REFERENCES direct.info_articles(id), version integer NOT NULL, user_id uuid REFERENCES public.profiles(id), at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(article_id,version,user_id));
CREATE TABLE direct.info_operations(actor_id uuid NOT NULL,key uuid NOT NULL,fingerprint text NOT NULL,result jsonb NOT NULL,PRIMARY KEY(actor_id,key));
ALTER TABLE direct.info_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.info_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.info_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.info_ack ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct.info_operations ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION direct.info_audience(s text,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND active) AND CASE s WHEN 'platform' THEN EXISTS(SELECT 1 FROM direct.scopes sc WHERE sc.user_id=auth.uid() AND direct.has_scope(sc.site_id,sc.role)) WHEN 'company' THEN direct.can_org(t) WHEN 'site' THEN direct.has_scope(t,'construction') OR direct.has_scope(t,'receiving') ELSE false END $$;
CREATE FUNCTION direct.info_edit(s text,t uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT EXISTS(SELECT 1 FROM direct.info_grants g WHERE user_id=auth.uid() AND scope=s AND target_id IS NOT DISTINCT FROM t) AND CASE WHEN s='platform' THEN EXISTS(SELECT 1 FROM public.memberships WHERE user_id=auth.uid() AND active) ELSE direct.info_audience(s,t) END $$;
CREATE FUNCTION direct.info_visible(i uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT direct.info_edit(scope,target_id) OR (status='published' AND direct.info_audience(scope,target_id) AND (data->>'start')::timestamptz<=now() AND (data->>'end')::timestamptz>now()) FROM direct.info_articles WHERE id=i),false) $$;
CREATE FUNCTION direct.info_list() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT jsonb_build_object('articles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'scope',a.scope,'targetId',a.target_id,'status',a.status,'version',a.version,'updatedAt',a.updated_at,'canEdit',direct.info_edit(a.scope,a.target_id),'data',a.data-'documents','documents',coalesce((SELECT jsonb_agg(d-'base64') FROM jsonb_array_elements(a.data->'documents') d),'[]'::jsonb),'acknowledged',EXISTS(SELECT 1 FROM direct.info_ack WHERE article_id=a.id AND version=a.version AND user_id=auth.uid()),'history',CASE WHEN direct.info_edit(a.scope,a.target_id) THEN coalesce((SELECT jsonb_agg(jsonb_build_object('version',h.version,'action',h.action,'reason',h.reason,'at',h.at,'actorId',h.actor_id,'snapshot',h.snapshot-'documents') ORDER BY version DESC) FROM direct.info_history h WHERE article_id=a.id),'[]'::jsonb) ELSE '[]'::jsonb END) ORDER BY a.updated_at DESC) FROM direct.info_articles a WHERE direct.info_visible(a.id)),'[]'::jsonb),'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('scope',scope,'targetId',target_id,'label',CASE scope WHEN 'platform' THEN '運営共通' WHEN 'company' THEN (SELECT name FROM public.organizations WHERE id=target_id) ELSE (SELECT name FROM public.sites WHERE id=target_id) END)) FROM direct.info_grants WHERE user_id=auth.uid() AND direct.info_edit(scope,target_id)),'[]'::jsonb),'notification','unconnected') $$;
CREATE FUNCTION direct.info_mutate(action text,k uuid,p jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a direct.info_articles; op direct.info_operations; d jsonb; doc jsonb; i uuid:=(p->>'id')::uuid; fp text:=md5(action||p::text); result jsonb; actor uuid:=auth.uid();
BEGIN
IF actor IS NULL OR k IS NULL THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended('info'||actor::text||k::text,0));
SELECT * INTO op FROM direct.info_operations WHERE actor_id=actor AND key=k;
IF FOUND THEN IF op.fingerprint<>fp THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF; RETURN op.result; END IF;
IF action='create' THEN
IF NOT direct.info_edit(p->>'scope',(p->>'targetId')::uuid) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
ELSE
SELECT * INTO a FROM direct.info_articles WHERE id=i FOR UPDATE;
IF NOT FOUND OR NOT direct.info_visible(i) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
IF (p->>'version')::int IS DISTINCT FROM a.version THEN RAISE EXCEPTION 'STALE_VERSION' USING ERRCODE='40001'; END IF;
IF action<>'ack' AND NOT direct.info_edit(a.scope,a.target_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
END IF;
IF action IN ('create','edit') THEN
IF action='edit' AND a.status='published' THEN RAISE EXCEPTION 'WITHDRAW_BEFORE_EDIT' USING ERRCODE='22023'; END IF;
d:=p->'data';
IF coalesce(length(trim(d->>'title')),0) NOT BETWEEN 1 AND 160 OR coalesce(length(trim(d->>'body')),0) NOT BETWEEN 1 AND 20000 OR coalesce(d->>'category','') NOT IN ('お知らせ','運用案内','安全・注意','保守情報') OR jsonb_typeof(d->'requiresAck') IS DISTINCT FROM 'boolean' OR (d->>'start') IS NULL OR (d->>'end') IS NULL OR (d->>'start')::timestamptz >= (d->>'end')::timestamptz OR jsonb_typeof(d->'documents') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'documents')>3 THEN RAISE EXCEPTION 'INVALID_ARTICLE' USING ERRCODE='22023'; END IF;
FOR doc IN SELECT * FROM jsonb_array_elements(d->'documents') LOOP
IF coalesce(doc->>'mime','') NOT IN ('application/pdf','image/png','image/jpeg') OR coalesce(length(doc->>'name'),0) NOT BETWEEN 1 AND 120 OR coalesce(octet_length(decode(doc->>'base64','base64')),0) NOT BETWEEN 1 AND 1048576 OR (doc->>'id') IS NULL THEN RAISE EXCEPTION 'INVALID_ATTACHMENT' USING ERRCODE='22023'; END IF;
END LOOP;
IF action='create' THEN INSERT INTO direct.info_articles(id,scope,target_id,data,actor_id) VALUES(i,p->>'scope',(p->>'targetId')::uuid,d,actor);
ELSE UPDATE direct.info_articles SET data=d,status='draft',version=version+1,actor_id=actor,updated_at=now() WHERE id=i; END IF;
ELSIF action='publish' THEN
IF a.status NOT IN ('draft','withdrawn') OR (a.data->>'end')::timestamptz<=now() THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
UPDATE direct.info_articles SET status='published',version=version+1,actor_id=actor,updated_at=now() WHERE id=i;
ELSIF action='withdraw' THEN
IF a.status<>'published' THEN RAISE EXCEPTION 'INVALID_STATE' USING ERRCODE='22023'; END IF;
UPDATE direct.info_articles SET status='withdrawn',version=version+1,actor_id=actor,updated_at=now() WHERE id=i;
ELSIF action='ack' THEN
IF a.status<>'published' OR (a.data->>'start')::timestamptz>now() OR (a.data->>'end')::timestamptz<=now() OR NOT direct.info_audience(a.scope,a.target_id) OR NOT (a.data->>'requiresAck')::boolean THEN RAISE EXCEPTION 'INVALID_ACK' USING ERRCODE='22023'; END IF;
INSERT INTO direct.info_ack VALUES(i,a.version,actor,now()) ON CONFLICT DO NOTHING;
ELSE RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
IF action<>'ack' THEN
IF action<>'create' AND coalesce(length(trim(p->>'reason')),0)=0 THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE='22023'; END IF;
INSERT INTO direct.info_history SELECT id,version,data,actor,action,coalesce(p->>'reason','初回作成'),now() FROM direct.info_articles WHERE id=i;
END IF;
SELECT jsonb_build_object('id',id,'version',version,'status',status,'notification','not_sent') INTO result FROM direct.info_articles WHERE id=i;
INSERT INTO direct.info_operations VALUES(actor,k,fp,result); RETURN result;
END $$;
CREATE FUNCTION direct.info_document(i uuid,did text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ DECLARE d jsonb; BEGIN IF NOT direct.info_visible(i) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF; SELECT x INTO d FROM direct.info_articles a,jsonb_array_elements(a.data->'documents') x WHERE a.id=i AND x->>'id'=did; IF d IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='22023'; END IF; RETURN d; END $$;
CREATE FUNCTION direct.info_operation(k uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT coalesce((SELECT jsonb_build_object('status','completed','result',result) FROM direct.info_operations WHERE actor_id=auth.uid() AND key=k),'{"status":"unknown"}'::jsonb) $$;
REVOKE ALL ON direct.info_articles,direct.info_grants,direct.info_history,direct.info_ack,direct.info_operations FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION direct.info_audience(text,uuid),direct.info_edit(text,uuid),direct.info_visible(uuid),direct.info_list(),direct.info_mutate(text,uuid,jsonb),direct.info_document(uuid,text),direct.info_operation(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION direct.info_list(),direct.info_mutate(text,uuid,jsonb),direct.info_document(uuid,text),direct.info_operation(uuid) TO authenticated;
