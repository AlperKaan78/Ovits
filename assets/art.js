/* Original vector Canvas art. No external assets. Coordinates local to each sprite.
 * Art.draw(ctx, kind, xPixels, yPixels, sizePixels, {time, selected, ...}).
 */
(function () {
  'use strict';
  const palette = {stone: '#a69a87', shadow: '#39313e', light: '#d3c5a6', purple: '#8759bb', blue: '#61b8dc', orange: '#efad69', green: '#8ee1ad'};
  function poly(c, pts, fill, stroke = '#302c3c') { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.closePath(); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = .035; c.stroke(); }
  function ellipse(c, x, y, rx, ry, fill) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); }
  function line(c, pts, color, width = .04) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(...p) : c.moveTo(...p)); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); }
  function crystal(c, x, y, s, color = palette.purple) {
    c.save(); c.translate(x, y); c.scale(s, s);
    poly(c, [[0,-.7],[.3,-.2],[.18,.45],[-.22,.4],[-.3,-.15]], color);
    poly(c, [[0,-.7],[.07,.16],[-.22,.4],[-.3,-.15]], '#c4a4ef');
    line(c, [[0,-.7],[.07,.16],[.18,.45]], '#e7daff', .025); c.restore();
  }
  function house(c, type) {
    ellipse(c, .03, .38, .48, .16, '#17172366');
    poly(c, [[-.43,-.12],[.25,-.12],[.43,.03],[.43,.36],[-.28,.46],[-.43,.29]], '#746d70');
    poly(c, [[-.43,-.12],[-.28,.04],[-.28,.46],[-.43,.29]], '#58515e');
    poly(c, [[-.43,-.12],[.22,-.24],[.43,.03],[-.28,.13]], palette.light);
    poly(c, [[-.3,-.13],[.12,-.2],[.25,-.04],[-.17,.04]], '#a79b89');
    poly(c, [[-.22,-.15],[-.22,-.4],[.1,-.45],[.22,-.3],[.22,-.06]], palette.stone);
    poly(c, [[-.22,-.4],[.1,-.45],[.22,-.3],[-.1,-.24]], '#dfcba5');
    c.fillStyle = '#efb776'; c.fillRect(-.14,-.12,.12,.11); c.fillRect(.12,.12,.12,.1);
    c.fillStyle = '#39313e'; c.fillRect(-.14,.22,.13,.2);
    line(c, [[-.4,.17],[-.23,.29],[.3,.18]], '#9b79b5', .025);
    if (type === 'merkez') { line(c, [[0,-.45],[0,-.83]], '#d2c2ac'); poly(c, [[0,-.82],[.28,-.73],[0,-.64]], '#ab7cce'); }
    if (type === 'laboratuvar') { ellipse(c, .02,-.38,.18,.1,'#64b5c9'); crystal(c, .02,-.53,.3); }
    if (type === 'karakol') { line(c, [[.3,-.05],[.3,-.56]], '#d9c8a4'); poly(c, [[.3,-.56],[.52,-.48],[.3,-.38]], '#c9773a'); }
  }
  function person(c, kind, t) {
    const step = Math.sin(t * 7) * .06;
    ellipse(c, 0,.42,.26,.09,'#17172366');
    line(c,[[-.11,.17],[-.15,.39+step]],'#635b6c',.12); line(c,[[.11,.17],[.15,.39-step]],'#635b6c',.12);
    poly(c,[[-.19,-.15],[.18,-.15],[.23,.2],[-.23,.2]],kind === 'asker' ? '#82718f' : kind === 'bilimci' ? '#9ac4c7' : '#c29773');
    line(c,[[-.19,-.05],[-.3,.16]],'#c5b8a3',.09); line(c,[[.19,-.05],[.3,.13]],'#c5b8a3',.09);
    ellipse(c,0,-.32,.2,.22,'#ded1ac');
    line(c,[[-.14,-.51],[-.2,-.63]],'#bbaca1'); line(c,[[.14,-.51],[.2,-.63]],'#bbaca1');
    ellipse(c,-.07,-.33,.026,.04,'#353044'); ellipse(c,.07,-.33,.026,.04,'#353044');
    if (kind === 'asker') { poly(c,[[-.22,-.38],[-.2,-.55],[.17,-.55],[.23,-.36]],'#70627d'); line(c,[[.29,.2],[.33,-.35]],'#c7c1b6',.05); }
    if (kind === 'isci') { line(c,[[.3,.2],[.3,-.28]],'#95744d'); line(c,[[.15,-.23],[.43,-.33]],'#c6c3bc',.065); }
    if (kind === 'bilimci') { ellipse(c,0,-.33,.19,.075,'#65c6d6'); crystal(c,.32,.1,.18); }
  }
  function bug(c, queen, t) {
    const s = queen ? 1.13 : .85; c.scale(s,s);
    ellipse(c,0,.28,.44,.18,'#17172366');
    for (const side of [-1,1]) for (let i=0;i<3;i++) {
      const y=-.22+i*.2, sway=Math.sin(t*5+i)*.03;
      line(c,[[side*.15,y],[side*(.42+sway),y-.14],[side*.56,y+.12]],'#66868e',.045);
    }
    ellipse(c,0,.1,.27,.35,queen?'#8c609f':'#557b87');
    ellipse(c,0,-.18,.22,.23,queen?'#c09aca':'#80acb2');
    line(c,[[0,-.35],[0,.42]],'#304957',.025);
    for(const side of [-1,1]) { ellipse(c,side*.1,-.25,.035,.04,palette.orange); line(c,[[side*.12,-.35],[side*.25,-.55]],'#a9c9c5',.025); }
    if(queen) for(const x of [-.15,0,.15]) crystal(c,x,-.42,.2,'#a47cca');
  }
  function draw(c, kind, x, y, size, options = {}) {
    c.save(); c.translate(x,y); c.scale(size,size); const t=options.time || 0;
    if(options.selected) { c.strokeStyle='#eeb980'; c.lineWidth=.025; c.beginPath(); c.ellipse(0,.32,.52,.21,0,0,Math.PI*2); c.stroke(); }
    if(['ev','merkez','laboratuvar','karakol'].includes(kind)) house(c,kind);
    else if(['isci','asker','bilimci'].includes(kind)) person(c,kind,t);
    else if(kind==='yavru') { c.scale(.7,.7); person(c,'yavru',t); }
    else if(kind==='yumurta') { ellipse(c,0,.3,.3,.09,'#17172366'); ellipse(c,0,-.03,.23,.34,'#ead8b5'); line(c,[[-.15,-.1],[-.03,-.03],[.08,-.13],[.2,-.05]],'#b591b6',.02); }
    else if(kind==='koloni'||kind==='kralice') bug(c,kind==='kralice',t);
    else if(kind==='kristal') { crystal(c,-.16,.08,.6); crystal(c,.18,.13,.45,'#82bad3'); }
    else if(kind==='sarmasik') {
      for(let i=0;i<3;i++) { const a=i*Math.PI*2/3; c.save();c.rotate(a);line(c,[[0,.42],[.15,.17],[-.08,-.1],[.1,-.47]],'#7d4b9d',.09);ellipse(c,-.13,-.05,.18,.07,'#58a8c4');ellipse(c,.2,.16,.17,.07,'#78c4dc');c.restore(); }
    }
    else if(kind==='akinci') { ellipse(c,0,.3,.33,.12,'#17172366');poly(c,[[0,-.53],[.38,.3],[-.38,.3]],'#3e414c','#a9a8b6');poly(c,[[0,-.37],[.11,-.12],[-.12,-.12]],'#96939c');line(c,[[-.08,-.17],[.08,-.17]],'#e5a866',.035); }
    else if(kind==='tasOcagi') { poly(c,[[-.48,.25],[-.3,-.3],[0,-.48],[.41,-.2],[.49,.27],[0,.43]],'#837b7a');poly(c,[[-.3,-.3],[0,-.48],[.11,-.02],[-.15,.1]],'#c0b4a2');line(c,[[-.3,.3],[.25,-.22]],'#654869',.08); }
    else if(kind==='cekimKulesi'||kind==='kule'||kind==='taret') {
      poly(c,[[-.4,.23],[0,.05],[.4,.23],[0,.45]],'#736b76');poly(c,[[-.16,.23],[-.1,-.45],[.12,-.45],[.18,.23]],'#c1b4a1');
      if(kind==='taret') { ellipse(c,0,-.36,.24,.16,'#7d6c87');line(c,[[0,-.4],[.37,-.57]],'#ded0b6',.11); }
      else { ellipse(c,0,-.48,.33,.11,'#9a7aba');crystal(c,0,-.66,.36);c.strokeStyle='#8ee1ad';c.lineWidth=.025;c.beginPath();c.ellipse(0,-.6,.4,.15,Math.sin(t)*.1,0,Math.PI*2);c.stroke(); }
    }
    else if(kind==='meteor') { ellipse(c,0,.1,.46,.24,'#514953');poly(c,[[-.38,.03],[-.22,-.3],[.14,-.4],[.36,-.06],[.2,.27],[-.2,.24]],'#938275');crystal(c,0,-.01,.43); }
    else if(kind==='isiltı') {
      const urgent=options.remaining != null && options.remaining<=5;
      c.strokeStyle=urgent?'#efa85a':'#85c8ad';c.lineWidth=.025;
      for(let i=0;i<4;i++){c.globalAlpha=.7-i*.13;c.beginPath();c.ellipse(0,0,.18+i*.1+Math.sin(t*2+i)*.025,.1+i*.07,0,0,Math.PI*2);c.stroke();}
    }
    c.restore();
  }
  window.Art={draw,palette};
})();
