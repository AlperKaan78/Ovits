/* Kişi 3: Canvas arayüzü. docs/CONTRACT.md ile uyumlu. */
(function () {
  'use strict';
  const portraits={};
  let buttons = [], regions = [], pointer = {x: -1, y: -1};
  const colors = {panel: 'rgba(19,20,30,.94)', text: '#f3eee8', muted: '#aea9bb', accent: '#c9773a'};
  const config = () => window.CONFIG || {};
  const time = n => { n = Math.max(0, Math.ceil(Number(n) || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };
  const affordable = (G, cost) => !cost || (Game.canAfford ? Game.canAfford(G, cost) : Object.entries(cost).every(([k, v]) => (G.resources && G.resources[k] || 0) >= v));
  const costs = cost => Game.costText ? Game.costText(cost || {}) : Object.entries(cost || {}).map(([k, v]) => v + ' ' + k).join(' / ');
  function text(ctx, str, x, y, color = colors.text, size = 14) { ctx.fillStyle = color; ctx.font = size + 'px system-ui, sans-serif'; ctx.fillText(String(str), x, y); }
  function panel(ctx, x, y, w, h) { ctx.fillStyle = colors.panel; ctx.fillRect(x, y, w, h); ctx.strokeStyle = '#51435e'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  function button(ctx, label, x, y, w, h, enabled, action, active) {
    const hover = pointer.x >= x && pointer.x < x + w && pointer.y >= y && pointer.y < y + h;
    ctx.fillStyle = !enabled ? '#30303b' : active ? '#8c522e' : hover ? '#684b49' : '#403442'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = active || hover && enabled ? colors.accent : '#625367'; ctx.strokeRect(x + .5, y + .5, w - 1, h - 1);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 6, y, w - 12, h); ctx.clip();
    text(ctx, label, x + 9, y + h / 2 + 5, enabled ? colors.text : colors.muted, 12); ctx.restore();
    buttons.push({label,x, y, w, h, enabled, action});
  }
  function init(G) { G.ui = G.ui || {}; }
  function population(G){
    const units=(G.units||[]).filter(u=>u.owner==='player'&&u.hp>0),waiting=units.filter(u=>u.kind==='yavru'&&!u.food),eggs=units.filter(u=>u.kind==='yumurta'),growing=units.filter(u=>u.kind==='yavru'&&u.food);
    const houses=(G.buildings||[]).filter(b=>b.type==='ev'&&b.hp>0&&b.built!==false),p=config().population||{},ev=config().buildings?.ev||{};
    const nextEgg=houses.length?Math.min(...houses.map(b=>Math.max(0,(ev.eggEvery||0)-(b.data?.eggT||0)))):null;
    return {units,waiting,eggs,growing,houses,nextEgg,adults:units.filter(u=>!['yumurta','yavru'].includes(u.kind)),soldiers:units.filter(u=>u.kind==='asker'||u.kind==='savasci'),growTime:p.growTime||0};
  }
  function feedNext(G,type){if(window.City&&typeof City.feedNext==='function')return City.feedNext(G,type);const child=population(G).waiting[0];if(child&&window.City&&typeof City.feed==='function')return City.feed(G,child,type);}
  function populationStatus(G,p){
    if(G.paused)return 'Duraklatıldı: sürelerin ilerlemesi için Devam’a basın.';
    if(p.waiting.length)return p.waiting.length+' yavru hazır: aşağıdan yetiştireceğiniz rolü seçin.';
    if(p.growing.length)return 'Yetişiyor: '+p.growing.length+' · İlk yetişkin '+time(Math.min(...p.growing.map(u=>u.grow||0)))+' sonra.';
    if(p.eggs.length)return 'Yumurta açılıyor: '+time(Math.min(...p.eggs.map(u=>u.t||0)))+' sonra besin seçebilirsiniz.';
    if(!p.houses.length)return 'Nüfus için bir Ev kurun; işçilerin inşaatı bitirmesini bekleyin.';
    return 'Sonraki yumurta '+time(p.nextEgg)+' · Ardından '+time(config().population?.hatchTime)+' kuluçka.';
  }
  function choose(G,unit,append=false){if(!unit||unit.hp<=0)return;const selection=G.ui.selection||[];G.ui.selection=append?[...new Set([...selection,unit])]:[unit];G.ui.selected=unit;G.ui.buildMode=null;G.ui.commandMode=null;if(typeof Game.centerOn==='function')Game.centerOn(G,unit.x,unit.y);}
  function minimap(ctx,G,w,h,bottom){
    const mw=198,mh=132,mx=22,my=bottom-150,outer={x:mx-8,y:my-22,w:214,h:166};
    panel(ctx,outer.x,outer.y,outer.w,outer.h);regions.push(outer);text(ctx,'ZEYRA-9 · HARİTA',mx,my-7,'#b3d2ce',11);
    const width=G.map?.w||60,height=G.map?.h||40,sx=mw/width,sy=mh/height,terrain=G.map?.terrain||[];
    ctx.fillStyle='#777668';ctx.fillRect(mx,my,mw,mh);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const kind=terrain[y*width+x];if(kind){ctx.fillStyle=kind==='forest'?'#3b354c':kind==='rock'?'#68666a':'#858473';ctx.fillRect(mx+x*sx,my+y*sy,sx+.2,sy+.2);}if(G.map?.vine?.[y*width+x]){ctx.fillStyle='#9365b5';ctx.fillRect(mx+x*sx,my+y*sy,sx+.3,sy+.3);}}
    const dot=(e,color,size=2)=>{ctx.fillStyle=color;ctx.fillRect(mx+e.x*sx-size/2,my+e.y*sy-size/2,size,size);};
    for(const d of G.deposits||[])if(d.remaining>0)dot(d,'#ded7bf',4);
    for(const b of G.visitors?.buildings||[])dot({x:b.x+b.size/2,y:b.y+b.size/2},b.flag||'#6cbbdf',5);
    for(const b of G.buildings||[])if(b.hp>0)dot({x:b.x+(b.size||1)/2,y:b.y+(b.size||1)/2},'#e5c38d',Math.max(3,b.size*sx));
    for(const cr of G.crystals||[])if(!cr.carriedBy)dot(cr,'#b5a1f0',3);
    for(const u of G.units||[])if(u.hp>0)dot(u,(G.ui.selection||[]).includes(u)?'#ffffff':'#83d5b4',3);
    for(const e of G.enemies||[])if(e.hp>0)dot(e,'#ef8a78',3);
    for(const c of G.colonies||[])for(const m of c.members)if(m.hp>0)dot(m,m.role==='kralice'?'#d0a9ed':'#62afbb',m.role==='kralice'?4:2);
    for(const m of G.meteors||[]){ctx.strokeStyle=m.t<=(config().meteors?.focusTime||5)?'#ffbc72':'#8ce7b4';ctx.beginPath();ctx.arc(mx+m.x*sx,my+m.y*sy,4,0,Math.PI*2);ctx.stroke();}
    const footprint=G.ui.cameraFootprint;
    if(footprint){ctx.save();ctx.beginPath();ctx.rect(mx,my,mw,mh);ctx.clip();ctx.strokeStyle='#f1e9d0';ctx.lineWidth=1;ctx.beginPath();footprint.forEach((p,i)=>i?ctx.lineTo(mx+p.x*sx,my+p.y*sy):ctx.moveTo(mx+p.x*sx,my+p.y*sy));ctx.closePath();ctx.stroke();ctx.restore();}
    buttons.push({x:mx,y:my,w:mw,h:mh,enabled:true,action:info=>{const x=(info.sx-mx)/mw*width,y=(info.sy-my)/mh*height;if(typeof Game.centerOn==='function')Game.centerOn(G,x,y);}});
    return outer;
  }
  function roster(ctx,G){const units=(G.units||[]).filter(u=>u.owner==='player'&&u.hp>0&&u.kind!=='yumurta'&&(!G.ui.unitFilter||u.kind===G.ui.unitFilter)),page=Math.max(0,Math.min(G.ui.unitPage||0,Math.max(0,Math.ceil(units.length/6)-1)));G.ui.unitPage=page;
    const x=14,y=86,w=216,shown=units.slice(page*6,page*6+6),h=84+shown.length*30+(units.length>6?30:0);panel(ctx,x,y,w,h);regions.push({x,y,w,h});text(ctx,'BİRİMLER · '+units.length,x+12,y+21,'#b3d2ce',12);
    if(window.Civilization){[['isci','İşçi'],['asker','Asker'],['bilimci','Bilimci'],[null,'Tümü']].forEach(([k,label],i)=>button(ctx,label,x+8+i*51,y+30,48,25,true,()=>Civilization.select(G,k),G.ui.unitFilter===k));}
    const labels={isci:'İşçi',asker:'Asker',bilimci:'Bilimci',yavru:'Yavru',tasiyici:'Taşıyıcı',savasci:'Savaşçı'};
    shown.forEach((u,i)=>button(ctx,(labels[u.kind]||u.kind)+' #'+u.id+(u.order||u.assignment||['lab','toCrystal','carry','pruneWait'].includes(u.state)?' · görevde':''),x+8,y+67+i*30,w-16,26,true,()=>choose(G,u),(G.ui.selection||[]).includes(u)));
    if(!units.length)text(ctx,'Yeni birimler için Ev kurun.',x+12,y+39,colors.muted,11);
    if(units.length>6){const by=y+69+shown.length*30;button(ctx,'Önceki',x+8,by,94,24,page>0,()=>G.ui.unitPage--);button(ctx,'Sonraki',x+110,by,98,24,(page+1)*6<units.length,()=>G.ui.unitPage++);}
    return y+h;
  }
  function drawUI(ctx, G) {
    init(G); buttons = []; regions = [];
    if(G.ui.mouse)pointer={x:G.ui.mouse.sx,y:G.ui.mouse.sy};
    const w = ctx.canvas.width, h = ctx.canvas.height, r = G.res || G.resources || {}, flags = G.flags || {};
    const side = Math.min(290, w * .36), sx = w - side - 12;
    panel(ctx, 0, 0, w, 80);
    text(ctx, 'MOR SARMAŞIK', 16, 25, '#d0afee', 18);
    text(ctx, 'Öz ' + Math.floor(r.oz || 0) + '   Taş ' + Math.floor(r.tas || 0) + '   Kitin ' + Math.floor(r.kitin || 0), 16, 53);
    if(G.ui.networkStatus)text(ctx,G.ui.networkStatus,Math.max(295,w*.3),72,'#98d2b5',11);
    if(r.lif!=null||r.ozsu!=null)text(ctx,'Mor Lif '+Math.floor(r.lif||0)+' · Azur Özsu '+Math.floor(r.ozsu||0),Math.max(295,w*.3),53,'#92c9c8',12);
    text(ctx, 'Meteor ' + time(flags.nextWaveIn) + '   Akın ' + (G.options?.raiders===false?'Kapalı':time(flags.nextRaidIn)), Math.max(270, w * .43), 25, colors.muted, 12);
    button(ctx, G.paused ? 'Devam' : 'Duraklat', w - 205, 41, 105, 29, !G.ui.network, () => { G.paused = !G.paused; });
    button(ctx, (G.speed || 1) + '× hız', w - 92, 41, 80, 29, !G.ui.network, () => { G.speed = G.speed === 3 ? 1 : (G.speed || 1)+1; });
    const buildings = Object.entries(config().buildings || {}).filter(([id]) => id !== 'merkez');
    const cols = Math.max(1, Math.min(5, Math.floor((w - 24) / 145))), bw = (w - 24 - (cols - 1) * 6) / cols;
    const rows = Math.max(1, Math.ceil(buildings.length / cols)), bottom = h - rows * 57 - 16;
    regions.push({x: 0, y: 0, w, h: 80}, {x: 0, y: bottom - 10, w, h: h - bottom + 10});
    panel(ctx, 0, bottom - 10, w, h - bottom + 10);
    buildings.forEach(([id, b], i) => {
      const cost = b.cost || b.maliyet;
      button(ctx, (b.ad || b.name || id) + ' · ' + costs(cost), 12 + (i % cols) * (bw + 6), bottom + Math.floor(i / cols) * 57, bw, 49, affordable(G, cost), () => { G.ui.buildMode = G.ui.buildMode === id ? null : id; }, G.ui.buildMode === id);
    });
    const mini=minimap(ctx,G,w,h,bottom),rosterBottom=roster(ctx,G);
    const soundReady=G.ui.soundReady;
    button(ctx,G.ui.soundMuted?'Ses: kapalı':soundReady?'Ses: açık':'Sesi etkinleştir',w-342,7,120,28,typeof G.ui.toggleSound==='function',()=>G.ui.toggleSound(!soundReady));
    button(ctx,'Yeni oyun',w-590,7,110,28,true,()=>location.reload());
    if(window.Civilization)button(ctx,'Tüm işçiler merkeze dön',246,84,215,28,true,()=>{G.ui.cancelTasks?.(G.units.filter(u=>u.kind==='isci'));Civilization.recall(G);});
    const selected = G.ui.selected;
    if(window.Civilization){button(ctx,'Bayrak seç',w-470,7,120,28,true,()=>G.ui.flagMenu=!G.ui.flagMenu);if(G.ui.flagMenu){const fx=w-470,fy=83;panel(ctx,fx,fy,165,144);regions.push({x:fx,y:fy,w:165,h:144});[['#c9773a','☀ Bakır Güneş'],['#388fc4','◆ Mavi Kristal'],['#799c44','♣ Yeşil Yaprak'],['#aa64bd','✦ Mor Yıldız']].forEach(([flag,name],i)=>button(ctx,name,fx+5,fy+5+i*34,155,29,true,()=>{Civilization.setFlag(G,flag);G.ui.flagMenu=false;}));}}
    if (selected) {
      const y = 90, panelH = Math.max(0, bottom - y - 24);
      G.ui.selectionPanelTop=y;
      regions.push({x: sx, y, w: side, h: panelH});
      panel(ctx, sx, y, side, panelH);
      ctx.save(); ctx.beginPath(); ctx.rect(sx, y, side, panelH); ctx.clip();
      const def = (config().buildings || {})[selected.type] || {};
      const roleNames={kralice:'Kraliçe',toplayici:'Toplayıcı',muhafiz:'Muhafız',yumurta:'Yumurta',yavru:'Yavru',isci:'İşçi',asker:'Asker',bilimci:'Bilimci',tasiyici:'Taşıyıcı',savasci:'Savaşçı'};
      const selectionName=selected.member?((selected.colony?.ad?selected.colony.ad+' · ':'')+(roleNames[selected.member.role]||'Koloni bireyi')):def.ad||def.name||selected.name||roleNames[selected.kind]||selected.kind||selected.type||'Seçim';
      text(ctx, selectionName, sx + 14, y + 28, '#dfc6f4', 18);
      const entity=selected.member||selected;
      text(ctx,'Tekerlek: paneli kaydır',sx+14,y+panelH-8,colors.muted,10);
      if (entity.hp != null) text(ctx, 'Can: ' + Math.ceil(entity.hp) + ' / ' + (entity.maxHp || def.hp || '?'), sx + 14, y + 55);
      let by = y + 78;
      const scroll=Math.max(0,G.ui.panelScroll||0);by-=scroll;
      function action(label, api, args, cost, allowed = true) {
        const row=by;by+=35;if(row<y+75||row+30>y+panelH)return;
        const enabled = typeof api === 'function' && allowed && affordable(G, cost);
        button(ctx, label + (cost ? ' · ' + costs(cost) : '') + (typeof api === 'function' ? '' : ' (yakında)'), sx + 12, row, side - 24, 30, enabled, () => api(...args));
      }
      if(selected.kind&&!['yumurta','yavru'].includes(selected.kind)){
        if(typeof Image!=='undefined'&&['isci','asker','bilimci'].includes(selected.kind)){const key=selected.kind+'-'+(selected.gender||'male');if(!portraits[key]){const img=new Image();img.src=new URL('./people/'+key+'.png',document.currentScript?.src||location.href);portraits[key]=img;}const img=portraits[key];if(img.complete&&img.naturalWidth)ctx.drawImage(img,220,70,600,630,sx+side-76,y+7,60,64);}
        const orderLabels={hold:'Dur emri / bekliyor',return:'Merkeze dönüyor',mine:'Taş kazıyor',repair:'Tamir ediyor',hospital:'Hastanede çalışıyor',heal:'Tedavi bekliyor',upgrade:'Geliştiriyor',move:'Yürüyor',prune:'Sarmaşık biçiyor',build:'İnşa ediyor',gather:'Kristal topluyor',attack:'Saldırıyor',post:'Karakola gidiyor',lab:'Araştırmaya gidiyor'};
        text(ctx,'Görev: '+(orderLabels[selected.order?.type]||selected.state==='lab'&&'Araştırıyor'||'Otomatik / boşta'),sx+14,by,colors.muted,12);by+=24;
        const setMode=mode=>{G.ui.buildMode=null;G.ui.commandMode=mode;};
        action('Hedefe yürü · sol tıkla yer seç',()=>setMode('move'),[]);
        action('Görev ver · hedefe sol/sağ tıkla',()=>setMode('context'),[]);
        if(['isci','tasiyici'].includes(selected.kind))action('Sarmaşık biç / topla · alan seç',()=>setMode('harvest'),[]);
        if(window.Civilization){
          const selectedUnits=()=>G.ui.selection?.length?G.ui.selection:[selected];
          action('Dur · yeni emir bekle',()=>{G.ui.cancelTasks?.(selectedUnits());Civilization.assign(G,selectedUnits(),'hold');},[]);
          if(['isci','tasiyici'].includes(selected.kind))action('Otomatik yıldız topla',()=>{G.ui.cancelTasks?.(selectedUnits());Civilization.assign(G,selectedUnits(),'gather');},[]);
          if(['isci','asker'].includes(selected.kind))action('Birimi geliştir · Sv '+(selected.level||1),()=>Civilization.upgradeUnit(G,selectedUnits()),[],{tas:30*(selected.level||1),oz:10*(selected.level||1)});
          const hospital=Game.nearest(G.buildings,selected.x,selected.y,b=>b.type==='hastane'&&b.hp>0&&b.built!==false);
          if(hospital)action(selected.kind==='bilimci'?'Hastanede çalış':'Hastanede tedavi ol',()=>Civilization.assign(G,selectedUnits(),selected.kind==='bilimci'?'hospital':'heal',hospital),[]);
        }
        if(selected.kind==='bilimci'){text(ctx,'Laboratuvara: araştır · baygın böceğe: çip',sx+14,by,colors.muted,10);by+=22;}
        action('Görevi bırak / dur',()=>{const selection=G.ui.selection?.length?G.ui.selection:[selected];G.ui.cancelTasks?.(selection);if(window.City?.release)City.release(G,selection);G.ui.commandMode=null;},[]);
      }
      if ((selected.kind || selected.type) === 'yavru') {
        for (const [type, label] of [['isci', 'İşçi'], ['asker', 'Asker'], ['bilimci', 'Bilimci']]) {
          action(label, window.City && City.feed, [G, selected, type], config().population?.foods?.[type]?.cost || (config().units || {})[type]?.cost, !selected.food);
        }
        if(selected.food&&by<y+panelH)text(ctx,'Yetişmesine '+time(selected.grow)+' kaldı.',sx+14,by,colors.muted,12);
      }
      if(selected.type==='ev'||selected.type==='merkez'){
        const pop=population(G),hasFeed=window.City&&(typeof City.feedNext==='function'||typeof City.feed==='function');
        if(selected.built===false){text(ctx,'Önce inşaat tamamlanmalı.',sx+14,by,colors.muted,12);by+=25;}
        text(ctx,'Hazır yavru: '+pop.waiting.length+' · Yumurta: '+pop.eggs.length,sx+14,by,colors.muted,12);by+=23;
        for(const [type,label]of [['isci','İşçi yetiştir'],['asker','Asker yetiştir'],['bilimci','Bilimci yetiştir']])action(label,hasFeed?feedNext:null,[G,type],config().population?.foods?.[type]?.cost,pop.waiting.length>0);
        if(by<y+panelH){text(ctx,'Yeni evler daha çok yumurta üretir.',sx+14,by,colors.muted,11);by+=20;}
      }
      if(selected.kind==='yumurta'){
        text(ctx,'Yavru çıkmasına '+time(selected.t)+' kaldı.',sx+14,by,colors.muted,12);by+=24;
        text(ctx,'Ardından İşçi, Asker veya Bilimci seçin.',sx+14,by,colors.muted,11);
      }
      if(window.Civilization&&selected.size&&selected.built!==false){
        if(selected.hp<selected.maxHp)action('İşçilerle tamir et · 1 Taş / 5 can',Civilization.repair,[G,selected]);
        if(['ev','ocak'].includes(selected.type))action('Bilimciyle geliştir · Sv '+(selected.level||1),Civilization.upgrade,[G,selected],{tas:60*(selected.level||1),oz:15*(selected.level||1)},!selected.data.upgrading);
        if(selected.type==='ocak')action('İşçileri taş kazmaya gönder',()=>Civilization.assign(G,G.units.filter(u=>u.kind==='isci'),'mine',selected),[]);
        if(selected.type==='hastane')action('Bilimcileri hastaneye gönder',()=>Civilization.assign(G,G.units.filter(u=>u.kind==='bilimci'),'hospital',selected),[]);
        if(selected.type==='kule'){text(ctx,'Meteor çeker; düşmana ateş etmez.',sx+14,by,colors.muted,11);by+=20;}
        if(selected.type==='taret'){text(ctx,'Düşmana ateş eder; meteor çekmez.',sx+14,by,colors.muted,11);by+=20;}
      }
      if (selected.type === 'karakol') action('Asker gönder', window.City && City.sendSoldier, [G, selected]);
      if (selected.type === 'laboratuvar' || selected.type === 'lab') {
        if(window.Research && typeof Research.info==='function'){
          const info=Research.info(G);
          if(info){text(ctx,info.ad+' · '+Math.floor(info.pct*100)+'%',sx+14,by,colors.muted,12);by+=22;}
        }
        if (window.Research && typeof Research.available === 'function') {
          const available = Research.available(G) || [];
          if (!available.length) text(ctx, 'Araştırma bekleniyor / tamamlandı', sx + 14, by, colors.muted, 12);
          for (const item of available) {
            const id = typeof item === 'string' ? item : item.id;
            const research = typeof item === 'string' ? (config().research || {})[id] || {} : item;
            action(research.ad || research.name || id, Research.enqueue, [G, id], research.cost, research.ok !== false && research.available !== false);
            if(research.reason && by+15<y+panelH){text(ctx,research.reason,sx+15,by-5,colors.muted,10);by+=14;}
          }
        } else action('Araştırma', null, []);
      }
      if (selected.colonyId != null || selected.type === 'member') {
        const member=selected.member||selected;
        action('Avla', window.Colonies && Colonies.hunt, [G, member],null,member.hp>0&&member.state!=='fainted'&&member.role!=='kralice');
        const chip=window.Colonies && typeof Colonies.canChip==='function'?Colonies.canChip(G,member):null;
        action('Çiple',window.Colonies && Colonies.tryChip,[G,member],null,!chip||chip.ok);
        if(chip?.reason&&by<y+panelH)text(ctx,chip.reason,sx+14,by,colors.muted,11);
      }
      ctx.restore();
    }
    const now = G.time || 0;
    const messages = (G.messages || []).slice(-2);
    messages.forEach((msg, i) => {
      const age = Math.max(0, now - (msg.time ?? msg.t ?? now));
      if (age >= 8) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, (8 - age) / 2);
      const content = typeof msg === 'string' ? msg : msg.text || msg.message || '';
      const mw=Math.max(150,Math.min(w - side - 280, 510));
      const messageY=140+i*28;
      panel(ctx, 246, messageY, mw, 27);
      ctx.beginPath();ctx.rect(252,messageY,mw-12,27);ctx.clip();
      text(ctx, content, 255, messageY+19, msg.color||colors.text, 12); ctx.restore();
    });
    const pop=population(G),px=246,py=bottom-132,pw=Math.max(220,Math.min(610,w-px-(selected?side+24:14)));
    panel(ctx,px,py,pw,112);regions.push({x:px,y:py,w:pw,h:112});
    ctx.save();ctx.beginPath();ctx.rect(px+8,py+5,pw-16,103);ctx.clip();
    text(ctx,'Nüfus '+(pop.units.length-pop.eggs.length)+' · Yetişkin '+pop.adults.length+' · Asker '+pop.soldiers.length+' · Yavru '+pop.waiting.length+' · Yumurta '+pop.eggs.length,px+12,py+22,'#dfc6f4',13);
    text(ctx,populationStatus(G,pop),px+12,py+43,colors.muted,11);
    const training=[['isci','İşçi'],['asker','Asker'],['bilimci','Bilimci']],tbw=(pw-36)/3,hasFeed=window.City&&(typeof City.feedNext==='function'||typeof City.feed==='function');
    training.forEach(([type,label],i)=>{const cost=config().population?.foods?.[type]?.cost,enabled=!!hasFeed&&pop.waiting.length>0&&affordable(G,cost);
      button(ctx,label+' yetiştir · '+costs(cost),px+12+i*(tbw+6),py+57,tbw,36,enabled,()=>feedNext(G,type));});
    if(pop.waiting.length&&!training.some(([type])=>affordable(G,config().population?.foods?.[type]?.cost)))text(ctx,'Yetersiz kaynak: Taş veya meteor kristallerinden Öz toplayın.',px+12,py+105,'#e9ad86',10);
    else text(ctx,'Ev → yumurta → yavru → besin seç → yetişkin ('+time(pop.growTime)+')',px+12,py+105,colors.muted,10);
    ctx.restore();
    if(G.ui.commandMode){const message=G.ui.commandMode==='harvest'?'İşçi hasadı: sarmaşık alanını sürükleyin veya bir kareye tıklayın.':G.ui.commandMode==='move'?'Yürünecek yere sol tıklayın.':'Görev için kristale, binaya, düşmana veya yere tıklayın.';panel(ctx,250,84,Math.max(100,w-500),40);ctx.save();ctx.beginPath();ctx.rect(258,84,Math.max(80,w-516),40);ctx.clip();text(ctx,message,260,109,'#dcd4ac',12);ctx.restore();}
    if (G.over) {
      buttons = [];
      ctx.fillStyle = 'rgba(8,8,16,.83)'; ctx.fillRect(0, 0, w, h);
      const won = G.over === 'win' || G.over === 'won' || G.over === 'kazandin' || G.over.win === true;
      panel(ctx, w / 2 - 200, h / 2 - 140, 400, 280);
      text(ctx, won ? 'Kazandın!' : 'Kaybettin', w / 2 - 155, h / 2 - 85, won ? '#cbb0ed' : '#eb9c84', 30);
      text(ctx, 'Süre: ' + time(now), w / 2 - 155, h / 2 - 35);
      text(ctx, (G.stats?.collectedOz != null ? 'Toplanan Öz: ' : 'Depodaki Öz: ') + Math.floor(G.stats?.collectedOz ?? r.oz ?? 0), w / 2 - 155, h / 2);
      button(ctx, 'Yeniden başlat', w / 2 - 155, h / 2 + 40, 310, 45, true, () => location.reload());
    }
  }
  function onClick(G, info) {
    const b = buttons.slice().reverse().find(b => info.sx >= b.x && info.sx < b.x + b.w && info.sy >= b.y && info.sy < b.y + b.h);
    if (b) { if (b.enabled) b.action(info); return true; }
    return !!G.over || regions.some(r => info.sx >= r.x && info.sx < r.x + r.w && info.sy >= r.y && info.sy < r.y + r.h);
  }
  function onMouseMove(G, info) { pointer = {x: info.sx, y: info.sy}; G.ui.mouse={...G.ui.mouse,sx:info.sx,sy:info.sy}; }
  function blocksWorld(G,sx,sy){return !!G.over||regions.some(r=>sx>=r.x&&sx<r.x+r.w&&sy>=r.y&&sy<r.y+r.h)||buttons.some(r=>sx>=r.x&&sx<r.x+r.w&&sy>=r.y&&sy<r.y+r.h);}
  window.UI = {init, drawUI, onClick, onMouseMove, population,blocksWorld,get controls(){return buttons.map(({label,x,y,w,h,enabled})=>({label,x,y,w,h,enabled}));}};
  Game.register({name: 'ui', init, drawUI, onClick, onMouseMove});
})();
