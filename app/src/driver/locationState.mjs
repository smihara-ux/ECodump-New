export function locationState(fix,acquiring,error,now=Date.now()){
 if(acquiring)return '取得中';
 if(error)return '取得不可';
 if(!fix)return '未取得';
 return now-fix.timestamp>300000?'古い':'取得済み';
}
