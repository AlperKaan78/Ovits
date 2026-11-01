/* Kişi 3: Canvas arayüzü. docs/CONTRACT.md ile uyumlu. */
(function () {
  'use strict';
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
    buttons.push({x, y, w, h, enabled, action});
  }
  function init(G) { G.ui = G.ui || {}; }
  function drawUI(ctx, G) {
    init(G); buttons = []; regions = [];
    const w = ctx.canvas.width, h = ctx.canvas.height, r = G.res || G.resources || {}, flags = G.flags || {};
    const side = Math.min(290, w * .36), sx = w - side - 12;
    panel(ctx, 0, 0, w, 80);
    text(ctx, 'MOR SARMAŞIK', 16, 25, '#d0afee', 18);
    text(ctx, 'Öz ' + Math.floor(r.oz || 0) + '   Taş ' + Math.floor(r.tas || 0) + '   Kitin ' + Math.floor(r.kitin || 0), 16, 53);
    text(ctx, 'Meteor ' + time(flags.nextWaveIn) + '   Akın ' + time(flags.nextRaidIn), Math.max(270, w * .43), 25, colors.muted, 12);
    button(ctx, G.paused ? 'Devam' : 'Duraklat', w - 205, 41, 105, 29, true, () => { G.paused = !G.paused; });
    button(ctx, (G.speed || 1) + '× hız', w - 92, 41, 80, 29, true, () => { G.speed = G.speed === 2 ? 1 : 2; });
    const buildings = Object.entries(config().buildings || {}).filter(([id]) => id !== 'merkez');
    const cols = Math.max(1, Math.min(6, Math.floor((w - 24) / 155))), bw = (w - 24 - (cols - 1) * 6) / cols;
    const rows = Math.max(1, Math.ceil(buildings.length / cols)), bottom = h - rows * 57 - 16;
    regions.push({x: 0, y: 0, w, h: 80}, {x: 0, y: bottom - 10, w, h: h - bottom + 10});
    panel(ctx, 0, bottom - 10, w, h - bottom + 10);
    buildings.forEach(([id, b], i) => {
      const cost = b.cost || b.maliyet;
      button(ctx, (b.ad || b.name || id) + ' · ' + costs(cost), 12 + (i % cols) * (bw + 6), bottom + Math.floor(i / cols) * 57, bw, 49, affordable(G, cost), () => { G.ui.buildMode = G.ui.buildMode === id ? null : id; }, G.ui.buildMode === id);
    });
    const selected = G.ui.selected;
    if (selected) {
      const y = 92, panelH = Math.max(0, bottom - y - 24);
      regions.push({x: sx, y, w: side, h: panelH});
      panel(ctx, sx, y, side, panelH);
      ctx.save(); ctx.beginPath(); ctx.rect(sx, y, side, panelH); ctx.clip();
      const def = (config().buildings || {})[selected.type] || {};
      text(ctx, def.ad || def.name || selected.name || selected.kind || selected.type || 'Seçim', sx + 14, y + 28, '#dfc6f4', 18);
      const entity=selected.member||selected;
      if (entity.hp != null) text(ctx, 'Can: ' + Math.ceil(entity.hp) + ' / ' + (entity.maxHp || def.hp || '?'), sx + 14, y + 55);
      let by = y + 78;
      function action(label, api, args, cost, allowed = true) {
        if (by + 37 > y + panelH) return;
        const enabled = typeof api === 'function' && allowed && affordable(G, cost);
        button(ctx, label + (cost ? ' · ' + costs(cost) : '') + (typeof api === 'function' ? '' : ' (yakında)'), sx + 12, by, side - 24, 37, enabled, () => api(...args)); by += 45;
      }
      if ((selected.kind || selected.type) === 'yavru') {
        for (const [type, label] of [['isci', 'İşçi'], ['asker', 'Asker'], ['bilimci', 'Bilimci']]) {
          action(label, window.City && City.feed, [G, selected, type], config().population?.foods?.[type]?.cost || (config().units || {})[type]?.cost, !selected.food);
        }
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
        action('Avla', window.Colonies && Colonies.hunt, [G, member],null,member.hp>0&&member.state!=='fainted');
        const chip=window.Colonies && typeof Colonies.canChip==='function'?Colonies.canChip(G,member):null;
        action('Çiple',window.Colonies && Colonies.tryChip,[G,member],null,!chip||chip.ok);
        if(chip?.reason&&by<y+panelH)text(ctx,chip.reason,sx+14,by,colors.muted,11);
      }
      ctx.restore();
    }
    const now = G.time || 0;
    const messages = (G.messages || []).slice(-5);
    messages.forEach((msg, i) => {
      const age = Math.max(0, now - (msg.time ?? msg.t ?? now));
      if (age >= 8) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, (8 - age) / 2);
      const content = typeof msg === 'string' ? msg : msg.text || msg.message || '';
      panel(ctx, 14, 94 + i * 31, Math.min(w - side - 48, 510), 27);
      text(ctx, content, 23, 113 + i * 31, colors.text, 12); ctx.restore();
    });
    if (now < 30 && !selected) {
      panel(ctx, 14, Math.max(262, bottom - 116), Math.min(540, w - 28), 96);
      text(ctx, 'Şehri büyüt. Meteoru çek. İkmal hattını koru.', 28, Math.max(287, bottom - 91), '#dfc6f4');
      text(ctx, 'Alt çubuk: bina seç · Harita: yerleştir / birim seç', 28, Math.max(313, bottom - 65), colors.muted, 12);
      text(ctx, 'Amaç: '+(config().win?.oz || 500)+' Yıldız Özü veya kraliçeyi çiple. Merkezini koru!', 28, Math.max(337, bottom - 41), colors.muted, 12);
    }
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
    if (b) { if (b.enabled) b.action(); return true; }
    return !!G.over || regions.some(r => info.sx >= r.x && info.sx < r.x + r.w && info.sy >= r.y && info.sy < r.y + r.h);
  }
  function onMouseMove(G, info) { pointer = {x: info.sx, y: info.sy}; G.ui.mouse={...G.ui.mouse,sx:info.sx,sy:info.sy}; }
  window.UI = {init, drawUI, onClick, onMouseMove};
  Game.register({name: 'ui', init, drawUI, onClick, onMouseMove});
})();
