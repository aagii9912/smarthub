(function(){
  const CSS = `
  #sc3{ position:absolute; inset:0; font-family:var(--font); color:var(--c-text); overflow:hidden; }
  #sc3 *{ box-sizing:border-box; }

  /* ---- header ---- */
  #sc3 .sc3-head{ position:absolute; left:90px; top:150px; width:1740px; }
  #sc3 .sc3-kick{ display:inline-flex; align-items:center; gap:14px; font-size:22px; font-weight:700;
    letter-spacing:.22em; color:var(--c-cyan); text-transform:uppercase;
    opacity:0; animation:sc3-up .7s cubic-bezier(.16,1,.3,1) .05s both; }
  #sc3 .sc3-kick .sc3-dot{ width:12px; height:12px; border-radius:50%; background:var(--c-cyan);
    box-shadow:0 0 18px var(--c-cyan); }
  #sc3 .sc3-title{ margin:14px 0 0; font-size:72px; font-weight:800; line-height:1.02; letter-spacing:-.02em;
    opacity:0; animation:sc3-up .8s cubic-bezier(.16,1,.3,1) .16s both; }
  #sc3 .sc3-title b{ background:linear-gradient(100deg,var(--c-cyan),var(--c-sky) 55%,var(--c-blue));
    -webkit-background-clip:text; background-clip:text; color:transparent; }
  #sc3 .sc3-sub{ margin:18px 0 0; font-size:27px; font-weight:500; color:var(--c-text-dim); max-width:1180px;
    line-height:1.4; opacity:0; animation:sc3-up .8s cubic-bezier(.16,1,.3,1) .28s both; }

  /* ---- layout ---- */
  #sc3 .sc3-stage{ position:absolute; left:90px; top:430px; width:1740px; height:560px; }

  /* ---- form card ---- */
  #sc3 .sc3-form{ position:absolute; left:0; top:0; width:760px; height:560px; border-radius:26px;
    background:linear-gradient(160deg,rgba(34,211,238,.10),var(--c-card) 42%);
    border:1px solid rgba(34,211,238,.22); backdrop-filter:blur(22px);
    box-shadow:0 36px 90px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
    padding:30px 34px; opacity:0; animation:sc3-up .8s cubic-bezier(.16,1,.3,1) .4s both; }
  #sc3 .sc3-form-h{ display:flex; align-items:center; gap:14px; font-size:25px; font-weight:700; margin-bottom:20px; }
  #sc3 .sc3-form-h .sc3-pin{ width:38px; height:38px; border-radius:11px; display:grid; place-items:center;
    background:linear-gradient(150deg,var(--c-cyan),var(--c-blue)); color:#04121a; font-weight:900; font-size:22px;
    box-shadow:0 8px 22px rgba(34,211,238,.4); }

  #sc3 .sc3-field{ margin-bottom:16px; }
  #sc3 .sc3-lbl{ font-size:18px; font-weight:600; color:var(--c-text-faint); margin-bottom:7px; letter-spacing:.02em; }
  #sc3 .sc3-input{ position:relative; height:54px; border-radius:13px; background:rgba(255,255,255,.05);
    border:1px solid var(--c-line); display:flex; align-items:center; padding:0 18px; font-size:23px; font-weight:600;
    overflow:hidden; }
  #sc3 .sc3-input .sc3-val{ white-space:nowrap; }
  #sc3 .sc3-typed{ animation:sc3-type 1.1s steps(13,end) 1.05s both; }
  #sc3 .sc3-typed::after{ content:''; position:absolute; }
  #sc3 .sc3-caret{ display:inline-block; width:2px; height:26px; background:var(--c-cyan); margin-left:3px;
    vertical-align:middle; animation:sc3-blink .7s steps(1) 1.05s 3, sc3-caret-off .01s 2.6s both; }
  #sc3 .sc3-input.sc3-on{ border-color:rgba(34,211,238,.5); box-shadow:0 0 0 3px rgba(34,211,238,.13); }
  #sc3 .sc3-price{ color:var(--c-cyan); opacity:0; animation:sc3-fade .5s ease 2.0s both; }
  #sc3 .sc3-stock{ color:var(--c-text); opacity:0; animation:sc3-fade .5s ease 2.35s both; }

  /* row of two */
  #sc3 .sc3-row{ display:flex; gap:16px; }
  #sc3 .sc3-row .sc3-field{ flex:1; }

  /* image upload */
  #sc3 .sc3-upload{ height:96px; border-radius:13px; border:1.5px dashed rgba(34,211,238,.4);
    display:flex; align-items:center; gap:16px; padding:0 18px; overflow:hidden; position:relative; }
  #sc3 .sc3-thumb{ width:64px; height:64px; border-radius:11px; flex:0 0 auto; position:relative; overflow:hidden;
    background:linear-gradient(135deg,var(--c-violet),var(--c-cyan) 60%,var(--c-blue));
    transform:scale(.4); opacity:0; animation:sc3-pop .6s cubic-bezier(.16,1,.3,1) 1.5s both; }
  #sc3 .sc3-thumb .sc3-chk{ position:absolute; inset:0; display:grid; place-items:center; font-size:30px; color:#fff;
    text-shadow:0 2px 8px rgba(0,0,0,.4); opacity:0; animation:sc3-pop .5s cubic-bezier(.16,1,.3,1) 2.0s both; }
  #sc3 .sc3-upmeta .sc3-upt{ font-size:20px; font-weight:700; }
  #sc3 .sc3-upmeta .sc3-ups{ font-size:16px; color:var(--c-emerald); font-weight:600; margin-top:4px;
    opacity:0; animation:sc3-fade .5s ease 2.1s both; }
  #sc3 .sc3-prog{ position:absolute; left:0; bottom:0; height:4px; background:var(--c-cyan); width:0;
    box-shadow:0 0 12px var(--c-cyan); animation:sc3-bar 1.0s cubic-bezier(.16,1,.3,1) 1.5s both; }

  /* variant chips */
  #sc3 .sc3-chips{ display:flex; flex-wrap:wrap; gap:10px; margin-top:9px; }
  #sc3 .sc3-chip{ height:42px; padding:0 18px; border-radius:21px; display:inline-flex; align-items:center; gap:8px;
    font-size:19px; font-weight:600; background:rgba(34,211,238,.12); border:1px solid rgba(34,211,238,.35);
    color:var(--c-text); transform:scale(.5); opacity:0; animation:sc3-pop .5s cubic-bezier(.16,1,.3,1) both; }
  #sc3 .sc3-chip .sc3-sw{ width:14px; height:14px; border-radius:50%; }
  #sc3 .sc3-chip:nth-child(1){ animation-delay:2.5s; }
  #sc3 .sc3-chip:nth-child(2){ animation-delay:2.64s; }
  #sc3 .sc3-chip:nth-child(3){ animation-delay:2.78s; }
  #sc3 .sc3-chip:nth-child(4){ animation-delay:2.92s; }

  /* save button */
  #sc3 .sc3-save{ position:absolute; left:34px; right:34px; bottom:28px; height:62px; border-radius:15px;
    background:linear-gradient(100deg,var(--c-cyan),var(--c-blue)); color:#04121a; font-size:24px; font-weight:800;
    display:flex; align-items:center; justify-content:center; gap:12px; letter-spacing:.01em;
    box-shadow:0 16px 40px rgba(34,211,238,.4); opacity:0;
    animation:sc3-up .5s cubic-bezier(.16,1,.3,1) 3.1s both, sc3-press .5s ease 3.7s both; }

  /* ---- right column ---- */
  #sc3 .sc3-right{ position:absolute; left:806px; top:0; width:934px; height:560px; }

  /* product grid */
  #sc3 .sc3-grid{ position:absolute; left:0; top:0; width:934px; display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
  #sc3 .sc3-pcard{ height:236px; border-radius:18px; background:var(--c-card); border:1px solid var(--c-line);
    backdrop-filter:blur(14px); overflow:hidden; box-shadow:0 18px 44px rgba(0,0,0,.4);
    transform:translateY(28px) scale(.94); opacity:0; }
  #sc3 .sc3-pcard .sc3-pimg{ height:128px; position:relative; }
  #sc3 .sc3-pcard .sc3-pbody{ padding:14px 16px; }
  #sc3 .sc3-pname{ font-size:20px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #sc3 .sc3-pprice{ font-size:21px; font-weight:800; color:var(--c-cyan); margin-top:6px; }
  #sc3 .sc3-ptag{ position:absolute; top:10px; left:10px; font-size:14px; font-weight:700; padding:4px 11px;
    border-radius:9px; background:rgba(0,0,0,.45); backdrop-filter:blur(6px); color:var(--c-text); }
  #sc3 .sc3-pc1{ animation:sc3-fly .7s cubic-bezier(.16,1,.3,1) 3.95s both; }
  #sc3 .sc3-pc2{ animation:sc3-cardin .7s cubic-bezier(.16,1,.3,1) 4.5s both; }
  #sc3 .sc3-pc3{ animation:sc3-cardin .7s cubic-bezier(.16,1,.3,1) 4.66s both; }
  #sc3 .sc3-pc4{ animation:sc3-cardin .7s cubic-bezier(.16,1,.3,1) 4.82s both; }
  #sc3 .sc3-pc5{ animation:sc3-cardin .7s cubic-bezier(.16,1,.3,1) 4.98s both; }
  #sc3 .sc3-pc6{ animation:sc3-cardin .7s cubic-bezier(.16,1,.3,1) 5.14s both; }

  /* excel bulk panel */
  #sc3 .sc3-excel{ position:absolute; left:0; top:286px; width:934px; height:208px; border-radius:20px;
    background:linear-gradient(150deg,rgba(52,211,153,.10),var(--c-card) 50%);
    border:1px solid rgba(52,211,153,.24); backdrop-filter:blur(18px); padding:22px 26px;
    box-shadow:0 24px 60px rgba(0,0,0,.45); display:flex; gap:26px; align-items:center;
    opacity:0; animation:sc3-up .7s cubic-bezier(.16,1,.3,1) 5.3s both; }
  #sc3 .sc3-xleft{ flex:1; }
  #sc3 .sc3-xchip{ display:inline-flex; align-items:center; gap:11px; height:46px; padding:0 18px; border-radius:13px;
    background:rgba(52,211,153,.16); border:1px solid rgba(52,211,153,.4); font-size:21px; font-weight:700;
    color:var(--c-emerald); }
  #sc3 .sc3-xchip .sc3-xi{ width:26px; height:26px; }
  #sc3 .sc3-xcount{ margin-top:18px; font-size:42px; font-weight:800; letter-spacing:-.01em; }
  #sc3 .sc3-xcount b{ color:var(--c-emerald); }
  #sc3 .sc3-xcount .sc3-num{ font-variant-numeric:tabular-nums; }
  #sc3 .sc3-xsub{ font-size:18px; color:var(--c-text-dim); font-weight:500; margin-top:4px; }

  /* mini spreadsheet */
  #sc3 .sc3-sheet{ width:300px; flex:0 0 auto; border-radius:13px; overflow:hidden; border:1px solid var(--c-line);
    background:rgba(255,255,255,.03); }
  #sc3 .sc3-sheet .sc3-srow{ display:grid; grid-template-columns:1.6fr 1fr .8fr; height:26px; align-items:center;
    border-bottom:1px solid rgba(255,255,255,.05); font-size:13px; padding:0 10px; color:var(--c-text-dim); }
  #sc3 .sc3-sheet .sc3-shead{ background:rgba(52,211,153,.14); color:var(--c-emerald); font-weight:700; height:28px; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data{ opacity:0; transform:translateX(-12px); animation:sc3-rowin .35s ease both; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data:nth-child(2){ animation-delay:5.55s; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data:nth-child(3){ animation-delay:5.72s; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data:nth-child(4){ animation-delay:5.89s; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data:nth-child(5){ animation-delay:6.06s; }
  #sc3 .sc3-sheet .sc3-srow.sc3-data:nth-child(6){ animation-delay:6.23s; }
  #sc3 .sc3-sheet .sc3-srow b{ color:var(--c-text); }
  #sc3 .sc3-scan{ position:absolute; }

  /* ---- keyframes ---- */
  @keyframes sc3-up{ from{ opacity:0; transform:translateY(34px); } to{ opacity:1; transform:translateY(0); } }
  @keyframes sc3-fade{ from{ opacity:0; transform:translateY(8px); } to{ opacity:1; transform:translateY(0); } }
  @keyframes sc3-pop{ 0%{ opacity:0; transform:scale(.4); } 60%{ opacity:1; transform:scale(1.08); } 100%{ opacity:1; transform:scale(1); } }
  @keyframes sc3-type{ from{ width:0; } to{ width:13ch; } }
  @keyframes sc3-blink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes sc3-caret-off{ to{ opacity:0; visibility:hidden; } }
  @keyframes sc3-bar{ from{ width:0; } to{ width:100%; } }
  @keyframes sc3-press{ 0%{ transform:scale(1); } 40%{ transform:scale(.95); box-shadow:0 6px 18px rgba(34,211,238,.5); } 100%{ transform:scale(1); } }
  @keyframes sc3-fly{ 0%{ opacity:0; transform:translate(-520px,46px) scale(.6) rotate(-6deg); }
    60%{ opacity:1; } 100%{ opacity:1; transform:translate(0,0) scale(1) rotate(0); } }
  @keyframes sc3-cardin{ from{ opacity:0; transform:translateY(28px) scale(.94); } to{ opacity:1; transform:translateY(0) scale(1); } }
  @keyframes sc3-rowin{ from{ opacity:0; transform:translateX(-12px); } to{ opacity:1; transform:translateX(0); } }
  `;

  function mount(root){
    if(!document.getElementById('sc3-style')){
      const s=document.createElement('style'); s.id='sc3-style'; s.textContent=CSS; document.head.appendChild(s);
    }

    root.innerHTML = `
      <div id="sc3">
        <div class="sc3-head">
          <div class="sc3-kick"><span class="sc3-dot"></span>ДАВУУ ТАЛ 03</div>
          <h2 class="sc3-title">Бараа <b>хялбар оруулна</b></h2>
          <p class="sc3-sub">Нэг бүрчлэн эсвэл Excel-ээр бөөнөөр. Зураг, үнэ, үлдэгдэл, хувилбар — бүгд нэг дор.</p>
        </div>

        <div class="sc3-stage">
          <!-- FORM -->
          <div class="sc3-form">
            <div class="sc3-form-h"><span class="sc3-pin">+</span>Шинэ бараа нэмэх</div>

            <div class="sc3-field">
              <div class="sc3-lbl">Нэр</div>
              <div class="sc3-input sc3-on">
                <span class="sc3-val sc3-typed">iPhone 15 Pro</span><span class="sc3-caret"></span>
              </div>
            </div>

            <div class="sc3-row">
              <div class="sc3-field">
                <div class="sc3-lbl">Үнэ</div>
                <div class="sc3-input"><span class="sc3-val sc3-price">₮5,200,000</span></div>
              </div>
              <div class="sc3-field">
                <div class="sc3-lbl">Үлдэгдэл</div>
                <div class="sc3-input"><span class="sc3-val sc3-stock">20 ширхэг</span></div>
              </div>
            </div>

            <div class="sc3-field">
              <div class="sc3-lbl">Зураг</div>
              <div class="sc3-upload">
                <div class="sc3-thumb"><div class="sc3-chk">✓</div></div>
                <div class="sc3-upmeta">
                  <div class="sc3-upt">product-cover.png</div>
                  <div class="sc3-ups">✓ Амжилттай ачааллаа</div>
                </div>
                <div class="sc3-prog"></div>
              </div>
            </div>

            <div class="sc3-field">
              <div class="sc3-lbl">Хувилбар</div>
              <div class="sc3-chips">
                <span class="sc3-chip"><span class="sc3-sw" style="background:#1c1c22"></span>Хар</span>
                <span class="sc3-chip"><span class="sc3-sw" style="background:var(--c-sky)"></span>Цэнхэр</span>
                <span class="sc3-chip">256GB</span>
                <span class="sc3-chip">512GB</span>
              </div>
            </div>

            <div class="sc3-save">Хадгалах</div>
          </div>

          <!-- RIGHT -->
          <div class="sc3-right">
            <div class="sc3-grid">
              <div class="sc3-pcard sc3-pc1">
                <div class="sc3-pimg" style="background:linear-gradient(135deg,var(--c-violet),var(--c-cyan) 65%,var(--c-blue))">
                  <span class="sc3-ptag">Шинэ</span>
                </div>
                <div class="sc3-pbody"><div class="sc3-pname">iPhone 15 Pro</div><div class="sc3-pprice">₮5,200,000</div></div>
              </div>
              <div class="sc3-pcard sc3-pc2">
                <div class="sc3-pimg" style="background:linear-gradient(135deg,#1c1c22,#3a3a52)">
                  <span class="sc3-ptag">20 ш</span>
                </div>
                <div class="sc3-pbody"><div class="sc3-pname">AirPods Pro 2</div><div class="sc3-pprice">₮890,000</div></div>
              </div>
              <div class="sc3-pcard sc3-pc3">
                <div class="sc3-pimg" style="background:linear-gradient(135deg,var(--c-emerald),var(--c-cyan))"></div>
                <div class="sc3-pbody"><div class="sc3-pname">MacBook Air M3</div><div class="sc3-pprice">₮6,400,000</div></div>
              </div>
            </div>

            <!-- EXCEL BULK -->
            <div class="sc3-excel">
              <div class="sc3-xleft">
                <span class="sc3-xchip">
                  <svg class="sc3-xi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/>
                  </svg>
                  Excel-ээр бөөнөөр оруулах
                </span>
                <div class="sc3-xcount"><b><span class="sc3-num" id="sc3-cnt">0</span></b> бараа импортлогдлоо</div>
                <div class="sc3-xsub">Хүснэгтээ чирээд тавихад л болно</div>
              </div>
              <div class="sc3-sheet">
                <div class="sc3-srow sc3-shead"><span>Нэр</span><span>Үнэ</span><span>Тоо</span></div>
                <div class="sc3-srow sc3-data"><span><b>Samsung S24</b></span><span>₮4.1сая</span><span>15</span></div>
                <div class="sc3-srow sc3-data"><span><b>Xiaomi 14</b></span><span>₮2.8сая</span><span>30</span></div>
                <div class="sc3-srow sc3-data"><span><b>Кейс багц</b></span><span>₮45мянга</span><span>200</span></div>
                <div class="sc3-srow sc3-data"><span><b>Цэнэглэгч</b></span><span>₮90мянга</span><span>120</span></div>
                <div class="sc3-srow sc3-data"><span><b>Хамгаалалт</b></span><span>₮25мянга</span><span>340</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // counter: ramp to 120 during the excel import window (~5.5s -> 7.4s)
    const el = root.querySelector('#sc3-cnt');
    if(el){
      const START = 5500, DUR = 1900, TARGET = 120;
      const t0 = performance.now();
      function tick(now){
        if(!el.isConnected) return;
        const e = now - t0;
        if(e < START){ requestAnimationFrame(tick); return; }
        const p = Math.min(1, (e - START) / DUR);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(eased * TARGET);
        if(p < 1) requestAnimationFrame(tick);
        else el.textContent = TARGET;
      }
      requestAnimationFrame(tick);
    }
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({
    id:3, key:'products', title:'Бараа оруулах', durationMs:11000, accent:'var(--c-cyan)', mount
  });
})();
