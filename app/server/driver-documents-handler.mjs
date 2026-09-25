export async function driverDocuments(req,client,url,readBody){
 if(req.method==='GET'&&url.pathname==='/api/direct/driver-identity')return (await client.query('SELECT direct.driver_identity() AS data')).rows[0].data;
 if(req.method==='GET'&&url.pathname==='/api/direct/driver-document-fields'){
  const bookingId=url.searchParams.get('bookingId'),tripId=url.searchParams.get('tripId');
  return {documents:(await client.query(`SELECT f.* FROM direct.driver_document_fields f JOIN direct.attachments a ON a.id=f.attachment_id WHERE f.booking_id=$1 AND ($2::uuid IS NULL OR a.trip_id=$2::uuid) ORDER BY f.submitted_at`,[bookingId,tripId||null])).rows};
 }
 if(req.method==='POST'&&url.pathname==='/api/direct/driver-document-submit'){
  const key=req.headers['idempotency-key'];if(!/^[0-9a-f-]{36}$/i.test(key||''))throw Object.assign(new Error('操作IDが必要です。'),{status:400});
  return (await client.query('SELECT direct.driver_document_submit($1,$2::jsonb) AS data',[key,JSON.stringify(await readBody(req))])).rows[0].data;
 }
 throw Object.assign(new Error('APIが見つかりません。'),{status:404});
}
