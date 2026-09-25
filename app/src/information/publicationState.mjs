// Display-only clock. API/DB remains authoritative for access and acknowledgement.
export function publicationState(article, now=Date.now()) {
 if(article.status==='draft') return '下書き';
 if(article.status==='withdrawn') return '取下げ';
 if(article.status!=='published') return '状態を確認してください';
 const start=Date.parse(article.data.start),end=Date.parse(article.data.end);
 if(!Number.isFinite(start)||!Number.isFinite(end)) return '公開期間を確認してください';
 if(now<start) return '公開前';
 if(now>=end) return '期限切れ';
 return '公開中';
}
