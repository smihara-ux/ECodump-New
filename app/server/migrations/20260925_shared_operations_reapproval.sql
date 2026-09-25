-- Important booking changes are explicit approval-waiting states.
DO $$ DECLARE body text;BEGIN
 SELECT pg_get_functiondef('direct.extended_mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,$find$status = 'requested'::text$find$,$repl$status = 'change_requested'::text$repl$);
 EXECUTE body;
 SELECT pg_get_functiondef('direct.mutate(text,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,$find$b.status <> 'requested'::text$find$,$repl$b.status NOT IN ('requested'::text,'change_requested'::text)$repl$);
 EXECUTE body;
END $$;
