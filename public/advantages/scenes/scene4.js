(function(){
  const CSS = `
  #sc4{position:absolute;inset:0;font-family:var(--font);overflow:hidden;}
  #sc4 .sc4-glow{position:absolute;border-radius:50%;filter:blur(70px);pointer-events:none;z-index:0;}
  #sc4 .sc4-g1{width:760px;height:760px;left:-160px;top:-120px;background:radial-gradient(circle,rgba(232,121,249,0.20),transparent 62%);animation:sc4-breathe 7s ease-in-out infinite;}
  #sc4 .sc4-g2{width:680px;height:680px;right:-140px;bottom:-160px;background:radial-gradient(circle,rgba(167,139,250,0.18),transparent 62%);animation:sc4-breathe 8s ease-in-out infinite .8s;}

  /* ---- header ---- */
  #sc4 .sc4-head{position:absolute;left:90px;top:150px;width:1740px;z-index:5;}
  #sc4 .sc4-kicker{display:inline-flex;align-items:center;gap:12px;font-size:22px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .05s both;}
  #sc4 .sc4-kicker .dot{width:10px;height:10px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px var(--accent);}
  #sc4 .sc4-title{margin-top:16px;font-size:72px;font-weight:800;line-height:1.04;letter-spacing:-0.03em;color:var(--c-text);animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .15s both;}
  #sc4 .sc4-title .g{background:linear-gradient(90deg,var(--c-fuchsia),var(--c-violet));-webkit-background-clip:text;background-clip:text;color:transparent;}
  #sc4 .sc4-sub{margin-top:14px;font-size:27px;font-weight:500;line-height:1.42;color:var(--c-text-dim);max-width:1180px;animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .25s both;}

  /* ---- layout ---- */
  #sc4 .sc4-stage{position:absolute;left:90px;top:360px;width:1740px;height:630px;display:grid;grid-template-columns:560px 1140px;gap:40px;z-index:5;}

  /* ---- orb column ---- */
  #sc4 .sc4-orbwrap{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:30px;}
  #sc4 .sc4-orbfield{position:relative;width:380px;height:380px;display:grid;place-items:center;animation:sc4-in .8s cubic-bezier(.16,1,.3,1) .35s both;}
  #sc4 .sc4-orb{width:210px;height:210px;border-radius:50%;background:radial-gradient(circle at 34% 30%,#fbe6ff 0%,var(--c-fuchsia) 36%,var(--c-violet-600) 74%,#5b21b6 100%);box-shadow:0 0 70px -6px rgba(232,121,249,.7),inset 0 -22px 50px rgba(76,29,149,.6),inset 0 16px 36px rgba(255,255,255,.4);position:relative;animation:sc4-bob 5s ease-in-out infinite;}
  #sc4 .sc4-orb::after{content:"";position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,transparent,rgba(255,255,255,.35),transparent 40%);mix-blend-mode:screen;animation:sc4-spin 6s linear infinite;}
  #sc4 .sc4-face{position:absolute;inset:0;display:grid;place-items:center;font-size:78px;z-index:2;filter:drop-shadow(0 4px 10px rgba(0,0,0,.3));}
  #sc4 .sc4-ring{position:absolute;border-radius:50%;border:1.5px dashed rgba(232,121,249,.35);}
  #sc4 .sc4-ring.r1{width:300px;height:300px;animation:sc4-spin 22s linear infinite;}
  #sc4 .sc4-ring.r2{width:380px;height:380px;border-color:rgba(167,139,250,.28);animation:sc4-spin 30s linear infinite reverse;}

  /* knowledge nodes orbiting */
  #sc4 .sc4-node{position:absolute;left:50%;top:50%;width:0;height:0;}
  #sc4 .sc4-node .chip{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:8px;padding:9px 15px;border-radius:14px;background:rgba(18,18,42,.82);border:1px solid var(--c-line);color:var(--c-text);font-size:18px;font-weight:600;white-space:nowrap;backdrop-filter:blur(8px);box-shadow:0 10px 26px -10px rgba(0,0,0,.6);opacity:0;}
  #sc4 .sc4-node .chip .ic{font-size:20px;}
  #sc4 .sc4-n1{transform:translate(150px,-118px);animation:sc4-chipin .55s cubic-bezier(.16,1,.3,1) 4.1s both;}
  #sc4 .sc4-n1 .chip{animation:sc4-chipin .55s cubic-bezier(.16,1,.3,1) 4.1s both;}
  #sc4 .sc4-n2{transform:translate(-168px,-46px);}
  #sc4 .sc4-n2 .chip{animation:sc4-chipin .55s cubic-bezier(.16,1,.3,1) 4.4s both;}
  #sc4 .sc4-n3{transform:translate(140px,128px);}
  #sc4 .sc4-n3 .chip{animation:sc4-chipin .55s cubic-bezier(.16,1,.3,1) 4.7s both;}
  #sc4 .sc4-n4{transform:translate(-150px,118px);}
  #sc4 .sc4-n4 .chip{animation:sc4-chipin .55s cubic-bezier(.16,1,.3,1) 5.0s both;}

  /* name field under orb */
  #sc4 .sc4-namefield{margin-top:26px;width:340px;animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .55s both;}
  #sc4 .sc4-lbl{font-size:17px;font-weight:700;letter-spacing:.04em;color:var(--c-text-faint);text-transform:uppercase;margin-bottom:9px;}
  #sc4 .sc4-input{display:flex;align-items:center;height:64px;padding:0 20px;border-radius:16px;background:var(--c-card);border:1px solid var(--c-line);font-size:30px;font-weight:700;color:var(--c-text);box-shadow:inset 0 0 0 1px rgba(232,121,249,.0);transition:box-shadow .3s;}
  #sc4 .sc4-input.lit{box-shadow:inset 0 0 0 1.5px rgba(232,121,249,.5),0 0 32px -10px rgba(232,121,249,.6);}
  #sc4 .sc4-caret{display:inline-block;width:3px;height:34px;background:var(--c-fuchsia);margin-left:3px;animation:sc4-blink 1s step-end infinite;border-radius:2px;}

  /* ---- right config column ---- */
  #sc4 .sc4-panel{display:grid;grid-template-rows:auto auto auto;gap:24px;align-content:start;}

  /* success strip (replaces floating test chat to avoid overlap) */
  #sc4 .sc4-done{display:flex;align-items:center;gap:18px;padding:20px 26px;border-radius:18px;
    background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(34,211,238,.10));border:1px solid rgba(52,211,153,.4);
    box-shadow:0 24px 60px -34px rgba(52,211,153,.5);opacity:0;animation:sc4-up .7s cubic-bezier(.16,1,.3,1) 6.6s both;}
  #sc4 .sc4-done .chk{width:46px;height:46px;border-radius:50%;background:var(--c-emerald);color:#06281d;display:grid;place-items:center;font-size:24px;font-weight:900;flex:0 0 auto;box-shadow:0 0 22px -4px var(--c-emerald);}
  #sc4 .sc4-done .dtxt{font-size:28px;font-weight:800;color:var(--c-emerald);}
  #sc4 .sc4-done .dqa{font-size:21px;font-weight:500;color:var(--c-text-dim);margin-left:auto;}
  #sc4 .sc4-done .dqa b{color:var(--c-text);font-weight:700;}
  #sc4 .sc4-card{background:var(--c-card);border:1px solid var(--c-line);border-radius:24px;padding:26px 30px;backdrop-filter:blur(12px);box-shadow:0 30px 70px -34px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.05);}
  #sc4 .sc4-rules{animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .45s both;}
  #sc4 .sc4-cardlbl{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:700;color:var(--c-text);margin-bottom:16px;}
  #sc4 .sc4-cardlbl .ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;font-size:19px;background:linear-gradient(135deg,rgba(232,121,249,.25),rgba(167,139,250,.18));border:1px solid rgba(232,121,249,.3);}
  #sc4 .sc4-textarea{min-height:118px;border-radius:14px;background:rgba(0,0,0,.22);border:1px solid var(--c-line);padding:18px 20px;font-size:25px;line-height:1.5;font-weight:500;color:var(--c-text);}
  #sc4 .sc4-rule{display:inline;}
  #sc4 .sc4-rule b{color:var(--c-fuchsia);font-weight:800;}

  /* sliders + knowledge in lower split */
  #sc4 .sc4-lower{display:grid;grid-template-columns:1fr 1fr;gap:26px;}
  #sc4 .sc4-tone{animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .6s both;}
  #sc4 .sc4-slider{margin-bottom:20px;}
  #sc4 .sc4-slider:last-child{margin-bottom:0;}
  #sc4 .sc4-srow{display:flex;justify-content:space-between;font-size:19px;font-weight:600;color:var(--c-text-dim);margin-bottom:10px;}
  #sc4 .sc4-srow .sc4-l{color:var(--c-text);}
  #sc4 .sc4-track{position:relative;height:12px;border-radius:99px;background:rgba(255,255,255,.08);overflow:visible;}
  #sc4 .sc4-fill{position:absolute;left:0;top:0;height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--c-violet),var(--c-fuchsia));box-shadow:0 0 18px -2px rgba(232,121,249,.7);}
  #sc4 .sc4-knob{position:absolute;top:50%;width:26px;height:26px;border-radius:50%;background:#fff;border:3px solid var(--c-fuchsia);transform:translate(-50%,-50%);box-shadow:0 4px 14px rgba(0,0,0,.5);left:0;}
  #sc4 .sc4-s1 .sc4-fill{animation:sc4-fill1 1s cubic-bezier(.16,1,.3,1) 1.2s both;}
  #sc4 .sc4-s1 .sc4-knob{animation:sc4-knob1 1s cubic-bezier(.16,1,.3,1) 1.2s both;}
  #sc4 .sc4-s2 .sc4-fill{animation:sc4-fill2 1s cubic-bezier(.16,1,.3,1) 1.5s both;}
  #sc4 .sc4-s2 .sc4-knob{animation:sc4-knob2 1s cubic-bezier(.16,1,.3,1) 1.5s both;}
  #sc4 .sc4-s3 .sc4-fill{animation:sc4-fill3 1s cubic-bezier(.16,1,.3,1) 1.8s both;}
  #sc4 .sc4-s3 .sc4-knob{animation:sc4-knob3 1s cubic-bezier(.16,1,.3,1) 1.8s both;}

  /* knowledge card */
  #sc4 .sc4-know{display:flex;flex-direction:column;animation:sc4-up .7s cubic-bezier(.16,1,.3,1) .7s both;}
  #sc4 .sc4-kpct{margin-left:auto;font-size:30px;font-weight:900;letter-spacing:-.02em;background:linear-gradient(90deg,var(--c-fuchsia),var(--c-violet));-webkit-background-clip:text;background-clip:text;color:transparent;}
  #sc4 .sc4-kbar{height:18px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:6px;}
  #sc4 .sc4-kbarfill{height:100%;width:0;border-radius:99px;background:linear-gradient(90deg,var(--c-violet),var(--c-fuchsia),var(--c-cyan));box-shadow:0 0 22px -2px rgba(232,121,249,.7);animation:sc4-know 2.6s cubic-bezier(.5,0,.2,1) 3.0s both;}
  #sc4 .sc4-ktags{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px;}
  #sc4 .sc4-ktag{display:flex;align-items:center;gap:7px;padding:8px 13px;border-radius:11px;background:rgba(232,121,249,.10);border:1px solid rgba(232,121,249,.28);font-size:17px;font-weight:600;color:var(--c-text);opacity:0;}
  #sc4 .sc4-ktag:nth-child(1){animation:sc4-tagpop .45s cubic-bezier(.16,1,.3,1) 3.2s both;}
  #sc4 .sc4-ktag:nth-child(2){animation:sc4-tagpop .45s cubic-bezier(.16,1,.3,1) 3.5s both;}
  #sc4 .sc4-ktag:nth-child(3){animation:sc4-tagpop .45s cubic-bezier(.16,1,.3,1) 3.8s both;}
  #sc4 .sc4-ktag:nth-child(4){animation:sc4-tagpop .45s cubic-bezier(.16,1,.3,1) 4.1s both;}

  /* ---- test chat overlay ---- */
  #sc4 .sc4-test{position:absolute;right:46px;bottom:30px;width:430px;z-index:8;opacity:0;animation:sc4-in .7s cubic-bezier(.16,1,.3,1) 6.1s both;}
  #sc4 .sc4-testbox{background:rgba(11,11,24,.92);border:1px solid var(--c-line);border-radius:22px;padding:20px;backdrop-filter:blur(16px);box-shadow:0 36px 80px -30px rgba(0,0,0,.85);}
  #sc4 .sc4-thead{display:flex;align-items:center;gap:10px;font-size:17px;font-weight:700;color:var(--c-text-faint);text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;}
  #sc4 .sc4-thead .liveDot{width:9px;height:9px;border-radius:50%;background:var(--c-emerald);box-shadow:0 0 12px var(--c-emerald);animation:sc4-pulse 1.4s ease-in-out infinite;}
  #sc4 .sc4-bub{max-width:78%;padding:13px 17px;font-size:21px;font-weight:500;line-height:1.4;border-radius:18px;margin-bottom:10px;}
  #sc4 .sc4-bub.user{margin-left:auto;background:linear-gradient(135deg,var(--c-indigo-600),var(--c-violet-600));color:#fff;border-bottom-right-radius:6px;opacity:0;animation:sc4-bubin .5s cubic-bezier(.16,1,.3,1) 6.4s both;}
  #sc4 .sc4-bub.ai{background:rgba(255,255,255,.06);border:1px solid var(--c-line);color:var(--c-text);border-bottom-left-radius:6px;opacity:0;animation:sc4-bubin .5s cubic-bezier(.16,1,.3,1) 6.9s both;}
  #sc4 .sc4-ready{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:6px;padding:13px;border-radius:14px;background:linear-gradient(135deg,rgba(52,211,153,.18),rgba(34,211,238,.12));border:1px solid rgba(52,211,153,.4);color:var(--c-emerald);font-size:22px;font-weight:800;opacity:0;animation:sc4-readyin .6s cubic-bezier(.16,1,.3,1) 7.5s both;}
  #sc4 .sc4-ready .chk{width:30px;height:30px;border-radius:50%;background:var(--c-emerald);color:#06281d;display:grid;place-items:center;font-size:18px;font-weight:900;}

  /* ---- keyframes ---- */
  @keyframes sc4-up{from{opacity:0;transform:translateY(38px);}to{opacity:1;transform:translateY(0);}}
  @keyframes sc4-in{from{opacity:0;transform:scale(.94);}to{opacity:1;transform:scale(1);}}
  @keyframes sc4-bob{0%,100%{transform:translateY(0);}50%{transform:translateY(-14px);}}
  @keyframes sc4-spin{to{transform:rotate(360deg);}}
  @keyframes sc4-breathe{0%,100%{opacity:.7;transform:scale(1);}50%{opacity:1;transform:scale(1.08);}}
  @keyframes sc4-blink{0%,100%{opacity:1;}50%{opacity:0;}}
  @keyframes sc4-chipin{from{opacity:0;transform:translate(var(--tx,0),var(--ty,0)) scale(.6);}to{opacity:1;}}
  @keyframes sc4-fill1{to{width:34%;}}
  @keyframes sc4-knob1{to{left:34%;}}
  @keyframes sc4-fill2{to{width:62%;}}
  @keyframes sc4-knob2{to{left:62%;}}
  @keyframes sc4-fill3{to{width:45%;}}
  @keyframes sc4-knob3{to{left:45%;}}
  @keyframes sc4-know{to{width:100%;}}
  @keyframes sc4-tagpop{from{opacity:0;transform:translateY(12px) scale(.9);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes sc4-pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.4);opacity:.5;}}
  @keyframes sc4-bubin{from{opacity:0;transform:translateY(14px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes sc4-readyin{from{opacity:0;transform:scale(.9);}to{opacity:1;transform:scale(1);}}
  `;

  function mount(root){
    if(!document.getElementById('sc4-style')){ const s=document.createElement('style'); s.id='sc4-style'; s.textContent=CSS; document.head.appendChild(s); }
    root.innerHTML = `
    <div id="sc4">
      <div class="sc4-glow sc4-g1"></div>
      <div class="sc4-glow sc4-g2"></div>

      <div class="sc4-head">
        <div class="sc4-kicker"><span class="dot"></span>Давуу тал 04</div>
        <div class="sc4-title">AI-гаа <span class="g">бизнестээ сургана</span></div>
        <div class="sc4-sub">Нэр, дүрэм журам, өнгө аяс, мэдлэгийг нь тааруулаад — AI чинь танай дэлгүүрийг бүрэн мэддэг болно.</div>
      </div>

      <div class="sc4-stage">
        <!-- LEFT: orb + name -->
        <div class="sc4-orbwrap">
          <div class="sc4-orbfield">
            <div class="sc4-ring r2"></div>
            <div class="sc4-ring r1"></div>
            <div class="sc4-orb"><div class="sc4-face">🤖</div></div>
            <div class="sc4-node sc4-n1"><div class="chip"><span class="ic">📦</span>Бараа 248</div></div>
            <div class="sc4-node sc4-n2"><div class="chip"><span class="ic">❓</span>FAQ 36</div></div>
            <div class="sc4-node sc4-n3"><div class="chip"><span class="ic">🚚</span>Хүргэлт</div></div>
            <div class="sc4-node sc4-n4"><div class="chip"><span class="ic">💳</span>Төлбөр</div></div>
          </div>
          <div class="sc4-namefield">
            <div class="sc4-lbl">AI-н нэр</div>
            <div class="sc4-input" id="sc4-name"><span id="sc4-nametxt"></span><span class="sc4-caret"></span></div>
          </div>
        </div>

        <!-- RIGHT: config -->
        <div class="sc4-panel">
          <div class="sc4-card sc4-rules">
            <div class="sc4-cardlbl"><span class="ic">📋</span>Дүрэм журам</div>
            <div class="sc4-textarea"><span class="sc4-rule" id="sc4-rules"></span></div>
          </div>

          <div class="sc4-lower">
            <div class="sc4-card sc4-tone">
              <div class="sc4-cardlbl"><span class="ic">🎚️</span>Өнгө аяс</div>
              <div class="sc4-slider sc4-s1">
                <div class="sc4-srow"><span class="sc4-l">Найрсаг</span><span>Албан</span></div>
                <div class="sc4-track"><div class="sc4-fill"></div><div class="sc4-knob"></div></div>
              </div>
              <div class="sc4-slider sc4-s2">
                <div class="sc4-srow"><span class="sc4-l">Хариултын урт</span><span>Дэлгэрэнгүй</span></div>
                <div class="sc4-track"><div class="sc4-fill"></div><div class="sc4-knob"></div></div>
              </div>
              <div class="sc4-slider sc4-s3">
                <div class="sc4-srow"><span class="sc4-l">Emoji хэрэглээ</span><span>Их</span></div>
                <div class="sc4-track"><div class="sc4-fill"></div><div class="sc4-knob"></div></div>
              </div>
            </div>

            <div class="sc4-card sc4-know">
              <div class="sc4-cardlbl"><span class="ic">📚</span>Мэдлэг<span class="sc4-kpct" id="sc4-kpct">0%</span></div>
              <div class="sc4-kbar"><div class="sc4-kbarfill"></div></div>
              <div class="sc4-ktags">
                <div class="sc4-ktag">📦 Бараа</div>
                <div class="sc4-ktag">🚚 Хүргэлт</div>
                <div class="sc4-ktag">↩️ Буцаалт</div>
                <div class="sc4-ktag">❓ FAQ</div>
              </div>
            </div>
          </div>

          <div class="sc4-done">
            <span class="chk">✓</span>
            <span class="dtxt">AI бэлэн боллоо</span>
            <span class="dqa">«Хүргэлт хэдэн цагт?» → <b>«УБ хотод 24 цагт 🚚»</b></span>
          </div>
        </div>
      </div>
    </div>`;

    // typing: name
    const nameTxt = root.querySelector('#sc4-nametxt');
    const nameBox = root.querySelector('#sc4-name');
    const rulesTxt = root.querySelector('#sc4-rules');
    const kpct = root.querySelector('#sc4-kpct');
    const timers = [];

    function typeInto(el, text, startMs, perChar, done){
      let n = 0;
      timers.push(setTimeout(function tick(){
        n++;
        el.textContent = text.slice(0, n);
        if(n < text.length){ timers.push(setTimeout(tick, perChar)); }
        else if(done){ done(); }
      }, startMs));
    }

    if(nameTxt){
      timers.push(setTimeout(()=>{ if(nameBox) nameBox.classList.add('lit'); }, 650));
      typeInto(nameTxt, 'Болд', 700, 130);
    }
    if(rulesTxt){
      typeInto(rulesTxt, 'Хүргэлт: УБ хотод 24 цагт. Буцаалт: 7 хоног дотор солино.', 1500, 34);
    }

    // knowledge percent counter (matches bar fill 3.0s..5.6s)
    if(kpct){
      const start = 3000, dur = 2600;
      timers.push(setTimeout(function run(){
        const t0 = performance.now();
        function frame(now){
          const p = Math.min(1, (now - t0) / dur);
          const eased = p < 1 ? (1 - Math.pow(1 - p, 2.2)) : 1;
          kpct.textContent = Math.round(eased * 100) + '%';
          if(p < 1){ requestAnimationFrame(frame); }
        }
        requestAnimationFrame(frame);
      }, start));
    }

    root._sc4timers = timers;
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({ id:4, key:'ai-training', title:'AI-г сургах', durationMs:12000, accent:'var(--c-fuchsia)', mount });
})();
