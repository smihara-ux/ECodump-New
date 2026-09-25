export async function handleInformation(req,client,url,body){
 const tail=url.pathname.slice('/api/direct/information'.length), fail=(status,message)=>Object.assign(new Error(message),{status});
 // Business sessions must not expose articles, attachments, history or writes.
 // A future operator endpoint requires separate operator authentication; never
 // infer operator access from a business role or an information editing grant.
 if(url.pathname.startsWith('/api/direct/information'))throw fail(403,'総合インフォメーションは運営管理画面でのみ閲覧できます。');
 if(req.method==='GET'&&tail==='')return (await client.query('SELECT direct.info_list() AS data')).rows[0].data;
 if(req.method==='GET'&&tail.startsWith('/operations/'))return (await client.query('SELECT direct.info_operation($1) AS data',[tail.split('/')[2]])).rows[0].data;
 if(req.method==='GET'&&tail.startsWith('/documents/'))return (await client.query('SELECT direct.info_document($1,$2) AS data',[tail.split('/')[2],tail.split('/')[3]])).rows[0].data;
 if(req.method==='POST'&&tail.startsWith('/actions/')){
  const key=req.headers['idempotency-key'];if(!/^[0-9a-f-]{36}$/i.test(key||''))throw fail(400,'操作IDが必要です。');
  const p=await body(req);
  for(const d of p.data?.documents||[]){const b=Buffer.from(d.base64||'','base64');const ok=d.mime==='application/pdf'?b.subarray(0,5).toString()==='%PDF-':d.mime==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):d.mime==='image/jpeg'&&b[0]===255&&b[1]===216&&b[2]===255;if(!ok)throw fail(422,'添付はPDF・PNG・JPEGに限定しています。');}
  return (await client.query('SELECT direct.info_mutate($1,$2,$3) AS data',[tail.split('/')[2],key,p])).rows[0].data;
 }
 throw fail(404,'該当する情報APIがありません。');
}
