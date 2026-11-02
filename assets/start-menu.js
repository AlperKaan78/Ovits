export async function chooseGame(){
  let status={lan:false};try{status=await (await fetch('/lan/status')).json();}catch{}
  const panel=document.createElement('div');panel.id='start-menu';panel.style.cssText='position:fixed;inset:0;background:#151b22f5;color:#eee;z-index:20;display:grid;place-items:center;font:16px system-ui';
  panel.innerHTML=`<form style="max-width:470px;padding:28px;border:1px solid #a68b54"><h1>Mor Sarmaşık</h1><fieldset><legend>Oyun modu</legend><label><input type="radio" name="mode" value="offline" checked> Çevrimdışı</label> <label><input type="radio" name="mode" value="online" ${status.lan?'':'disabled'}> Çevrimiçi (aynı Wi-Fi)</label></fieldset><p class="network-help">${status.lan?'Çevrimdışı tek başınıza oynayın veya çevrimiçi odaya katılın.':'Çevrimiçi oyun için lan-baslat.bat dosyasını açın ve sunucu adresine bağlanın.'}</p><p><label>Medeniyet adı <input name="name" maxlength="24" value="Sarmaşık Halkı" required></label></p><p><label>Bayrak <select name="flag"><option value="#c9773a">☀ Bakır Güneş</option><option value="#388fc4">◆ Mavi Kristal</option><option value="#799c44">♣ Yeşil Yaprak</option><option value="#aa64bd">✦ Mor Yıldız</option></select></label></p><p><label><input type="checkbox" name="raiders"> Akıncılar etkin olsun</label></p><p class="room-help"></p><p style="font-size:13px;color:#bbb">Ses kapalı başlar. Yeni oyun, önceki kaydedilmemiş oturumunuzu siler.</p><button type="submit">Yeni oyun başlat</button><p class="status" role="status"></p></form>`;
  document.body.append(panel);const form=panel.querySelector('form'),raiders=form.elements.raiders;
  function refresh(){const online=form.elements.mode.value==='online';raiders.disabled=online&&status.roomActive;if(raiders.disabled)raiders.checked=!!status.raiders;panel.querySelector('.room-help').textContent=raiders.disabled?'Mevcut çevrimiçi odanın akıncı ayarı kullanılır.':'';}
  form.addEventListener('change',refresh);refresh();
  return new Promise(resolve=>{form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button');button.disabled=true;try{
    let old=null;try{old=JSON.parse(sessionStorage.getItem('ovits-lan'));}catch{}
    if(old?.token&&status.lan){const r=await fetch('/lan/leave?token='+encodeURIComponent(old.token),{method:'POST'});if(!r.ok)throw Error('Önceki oturum temizlenemedi; tekrar deneyin.');}
    sessionStorage.removeItem('ovits-lan');
    const options={mode:form.elements.mode.value,name:form.elements.name.value,flag:form.elements.flag.value,raiders:raiders.checked};panel.remove();resolve(options);
  }catch(error){panel.querySelector('.status').textContent=error.message;button.disabled=false;}};});
}
