// Local-only browser failure test proxy. No credentials or payloads are logged.
import http from 'node:http';import{readFile}from'node:fs/promises';
http.createServer(async(req,res)=>{let mode='normal';try{mode=(await readFile('/tmp/ecodump-driver-fault-mode','utf8')).trim();}catch{}
 if(mode==='offline'&&req.url.startsWith('/api/')){res.destroy();return;}
 const drop=mode==='drop'&&req.method==='POST'&&req.url==='/api/direct/driver-document-submit';
 const upstream=http.request({hostname:'127.0.0.1',port:5202,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:5202'}},r=>{if(drop){r.resume();r.on('end',()=>res.destroy());return;}res.writeHead(r.statusCode,r.headers);r.pipe(res);});upstream.on('error',()=>res.destroy());req.pipe(upstream);
}).listen(5206,'127.0.0.1',()=>console.log('Local browser fault proxy 5206'));
