function decode({root,nodes}){const out=nodes.map(n=>Array.isArray(n)?[]:{}),val=v=>v&&typeof v==='object'&&'$'in v?out[v.$]:v;nodes.forEach((n,i)=>{for(const [k,v]of Object.entries(n))out[i][k]=val(v);});return val(root);}
export async function connectLan(G,options){
  const response=await fetch('/lan/join',{method:'POST',body:JSON.stringify({name:options.name,flag:options.flag,raiders:options.raiders})});
  if(!response.ok)throw Error(await response.text());
  const credentials=await response.json();sessionStorage.setItem('ovits-lan',JSON.stringify(credentials));G.ui.network=true;
  const token=credentials.token,source=new EventSource('/lan/events?token='+token);let latest=null,ready;
  const first=new Promise(r=>ready=r);source.onmessage=e=>{latest=decode(JSON.parse(e.data));ready();};source.onerror=()=>{G.ui.networkStatus='Bağlantı koptu; yeniden bağlanılıyor…';};await first;
  function apply(){if(!latest)return;const incoming=latest;latest=null;const old=new Map([...G.units,...G.buildings,...G.enemies,...G.crystals,...(G.deposits||[]),...(G.visitors?.units||[]),...(G.visitors?.buildings||[]),...G.colonies.flatMap(c=>c.members)].filter(e=>e.id!=null).map(e=>[e.id,e]));const seen=new WeakMap();function stable(v){if(!v||typeof v!=='object')return v;if(seen.has(v))return seen.get(v);const target=v.id!=null&&old.get(v.id)|| (Array.isArray(v)?[]:{});seen.set(v,target);for(const k of Object.keys(target))if(!(k in v))delete target[k];for(const [k,x]of Object.entries(v))target[k]=stable(x);return target;}const state=stable(incoming);Object.assign(G,state);G.ui.selection=(G.ui.selection||[]).filter(u=>G.units.includes(u));if(G.ui.selected?.id&&!G.units.includes(G.ui.selected)&&!G.buildings.includes(G.ui.selected))G.ui.selected=null;G.ui.networkStatus='LAN · '+G.civilizations.length+' medeniyet';}
  function send(a){G.ui.commandMode=null;return fetch('/lan/action?token='+token,{method:'POST',body:JSON.stringify(a)}).then(async r=>{if(!r.ok)throw Error('Sunucu komutu kabul etmedi ('+r.status+')');const v=await r.json();if(!v.ok)Game.msg(G,'Görev için uygun birim, kaynak veya hedef bulunamadı.');return v.ok;}).catch(e=>Game.msg(G,e.message));}
  function bind(tasks){const ids=units=>(units||G.ui.selection||[]).map(u=>u.id);
    Civilization.setFlag=(state,flag)=>send({type:'flag',flag});
    tasks.command=info=>{send({type:'command',ids:ids(),x:info.wx,y:info.wy,mode:G.ui.commandMode});return true;};tasks.harvest=(area,units)=>{send({type:'harvest',ids:ids(units),area});return true;};tasks.update=()=>{};tasks.release=()=>{};
    City.build=(state,kind,x,y)=>{send({type:'build',ids:ids(),kind,x,y});return true;};City.feedNext=(state,kind)=>{send({type:'feed',kind});return true;};City.feed=(state,u,kind)=>City.feedNext(state,kind);City.release=(state,units)=>send({type:'assign',ids:ids(units),job:'hold'});
    Civilization.assign=(state,units,job,b)=>send({type:'assign',ids:ids(units),job,building:b?.id});Civilization.recall=()=>send({type:'recall'});Civilization.repair=(state,b)=>send({type:'repair',building:b.id});Civilization.upgrade=(state,b)=>send({type:'upgradeBuilding',building:b.id});Civilization.upgradeUnit=(state,units)=>send({type:'upgradeUnit',ids:ids(units)});Research.enqueue=(state,id)=>send({type:'research',id});
  }
  apply();return {apply,bind,send,close:()=>source.close()};
}
