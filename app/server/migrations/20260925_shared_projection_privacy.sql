-- Keep the driver-visible correction projection limited to operational fields.
CREATE OR REPLACE FUNCTION direct.list_bookings() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
SELECT coalesce(jsonb_agg(item || jsonb_build_object(
 'constructionOrgId',b.construction_org_id,
 'constructionCompany',org.name,
 'issues',coalesce((SELECT jsonb_agg(jsonb_build_object('id',i.id,'tripId',i.trip_id,'kind',i.kind,'reason',i.reason,'status',i.status,'actorId',i.actor_id,'actorName',p.display_name,'createdAt',i.created_at,'resolvedAt',i.resolved_at,'resolution',i.resolution,'version',i.version) ORDER BY i.created_at) FROM direct.trip_issues i JOIN public.profiles p ON p.id=i.actor_id WHERE i.trip_id=(item->'trip'->>'id')::uuid),'[]'::jsonb),
 'reportCorrections',coalesce((SELECT jsonb_agg(jsonb_build_object('actorId',a.actor_id,'actorName',p.display_name,'eventId',a.before_data->'event'->>'id','originalReportedAt',a.before_data->'event'->>'reported_at','correctedReportedAt',a.after_data->>'reportedAt','reason',a.after_data->>'reason','createdAt',a.created_at) ORDER BY a.created_at) FROM direct.audit a JOIN public.profiles p ON p.id=a.actor_id WHERE a.booking_id=b.id AND a.action='report_correct' AND (a.after_data->'trip'->>'id')=(item->'trip'->>'id')),'[]'::jsonb)
) ORDER BY (item->>'plannedAt')::timestamptz,(item->'trip'->>'rotation')::int),'[]'::jsonb)
FROM jsonb_array_elements(direct.list_bookings_before_shared_projection()) item
JOIN direct.bookings b ON b.id=(item->>'id')::uuid
JOIN public.organizations org ON org.id=b.construction_org_id;
$$;

