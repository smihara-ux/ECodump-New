ALTER TABLE direct.receiving_condition_history ADD COLUMN reason text NOT NULL DEFAULT '条件変更';
CREATE OR REPLACE FUNCTION direct.capture_receiving_condition_history() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE change_reason text:=nullif(current_setting('ecodump.change_reason',true),'');
BEGIN
 IF auth.uid() IS NOT NULL AND OLD IS DISTINCT FROM NEW THEN INSERT INTO direct.receiving_condition_history(location_id,actor_id,before_data,after_data,reason) VALUES(NEW.location_id,auth.uid(),to_jsonb(OLD),to_jsonb(NEW),coalesce(change_reason,'条件変更'));END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.location_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'UPDATE direct.receiving_conditions SET','IF length(trim(coalesce(payload->>''reason'','''')))<1 OR length(payload->>''reason'')>2000 THEN RAISE EXCEPTION ''REASON_REQUIRED'' USING ERRCODE=''22023'';END IF; PERFORM set_config(''ecodump.change_reason'',trim(payload->>''reason''),true); UPDATE direct.receiving_conditions SET');
 EXECUTE body;
END $$;

