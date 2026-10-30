(function(){
  const CSS = `
  /* ===== Scene 1 — AI борлуулалт 24/7 (all selectors scoped under sc1) ===== */
  #sc1{position:absolute;inset:0;font-family:var(--font);}
  #sc1 .sc1-stage{position:absolute;left:90px;top:150px;right:90px;bottom:80px;display:flex;align-items:center;gap:64px;}

  /* ---- Left: copy column ---- */
  #sc1 .sc1-copy{flex:0 0 720px;display:flex;flex-direction:column;align-items:flex-start;}
  #sc1 .sc1-kicker{display:inline-flex;align-items:center;gap:14px;font-size:24px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;color:var(--accent);animation:sc1-up .7s cubic-bezier(.16,1,.3,1) .05s both;}
  #sc1 .sc1-kicker .dot{width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 22px var(--accent);animation:sc1-pulse 1.8s ease-in-out infinite;}
  #sc1 .sc1-title{margin-top:30px;font-size:92px;font-weight:900;line-height:1.02;letter-spacing:-0.035em;color:var(--c-text);animation:sc1-up .8s cubic-bezier(.16,1,.3,1) .18s both;}
  #sc1 .sc1-title .grad{background:linear-gradient(100deg,var(--c-violet),var(--c-indigo),var(--c-cyan));-webkit-background-clip:text;background-clip:text;color:transparent;}
  #sc1 .sc1-sub{margin-top:34px;font-size:33px;font-weight:500;line-height:1.5;color:var(--c-text-dim);max-width:660px;animation:sc1-up .8s cubic-bezier(.16,1,.3,1) .34s both;}
  #sc1 .sc1-badges{margin-top:46px;display:flex;gap:18px;animation:sc1-up .8s cubic-bezier(.16,1,.3,1) .5s both;}
  #sc1 .sc1-badge{display:inline-flex;align-items:center;gap:14px;padding:18px 30px;border-radius:99px;border:1px solid var(--c-line);background:var(--c-card);backdrop-filter:blur(10px);color:var(--c-text);font-size:26px;font-weight:800;letter-spacing:.01em;}
  #sc1 .sc1-badge.lit{background:linear-gradient(135deg,rgba(139,92,246,0.30),rgba(99,102,241,0.18));border-color:rgba(167,139,250,0.45);box-shadow:0 18px 50px -20px rgba(139,92,246,0.8);}
  #sc1 .sc1-badge .ring{position:relative;width:18px;height:18px;border-radius:50%;background:var(--c-emerald);box-shadow:0 0 16px var(--c-emerald);}
  #sc1 .sc1-badge .ring::after{content:"";position:absolute;inset:-7px;border-radius:50%;border:2px solid var(--c-emerald);animation:sc1-radar 2s ease-out infinite;}

  /* ---- Right: phone mockup ---- */
  #sc1 .sc1-phonewrap{flex:1 1 auto;position:relative;display:flex;justify-content:center;align-items:center;height:100%;}
  #sc1 .sc1-glow{position:absolute;width:760px;height:760px;border-radius:50%;background:radial-gradient(circle,rgba(139,92,246,0.26),transparent 62%);filter:blur(8px);animation:sc1-in 1s ease both;}
  #sc1 .sc1-phone{position:relative;width:560px;height:830px;border-radius:54px;padding:18px;background:linear-gradient(160deg,rgba(255,255,255,0.10),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.12);box-shadow:0 60px 140px -40px rgba(0,0,0,0.85),inset 0 1px 0 rgba(255,255,255,0.18);backdrop-filter:blur(14px);animation:sc1-phone-in 1s cubic-bezier(.16,1,.3,1) .12s both;}
  #sc1 .sc1-screen{position:relative;width:100%;height:100%;border-radius:40px;overflow:hidden;background:linear-gradient(180deg,#0d0d1f,#08081a);border:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;}

  /* chat header */
  #sc1 .sc1-chead{display:flex;align-items:center;gap:16px;padding:26px 28px;border-bottom:1px solid var(--c-line);background:rgba(255,255,255,0.03);}
  #sc1 .sc1-ava{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--c-indigo-600),var(--c-violet-600));display:grid;place-items:center;color:#fff;font-weight:900;font-size:26px;box-shadow:0 8px 24px -6px rgba(99,102,241,0.7);}
  #sc1 .sc1-cinfo .n{color:var(--c-text);font-weight:800;font-size:26px;letter-spacing:-0.01em;}
  #sc1 .sc1-cinfo .s{margin-top:4px;display:flex;align-items:center;gap:8px;color:var(--c-emerald);font-weight:600;font-size:18px;}
  #sc1 .sc1-cinfo .s .d{width:9px;height:9px;border-radius:50%;background:var(--c-emerald);box-shadow:0 0 10px var(--c-emerald);}
  #sc1 .sc1-aitag{margin-left:auto;padding:8px 16px;border-radius:99px;background:linear-gradient(135deg,rgba(167,139,250,0.28),rgba(99,102,241,0.20));border:1px solid rgba(167,139,250,0.4);color:var(--c-violet);font-weight:800;font-size:17px;letter-spacing:.04em;}

  /* chat body */
  #sc1 .sc1-body{flex:1;position:relative;padding:26px 24px;display:flex;flex-direction:column;gap:18px;overflow:hidden;}
  #sc1 .sc1-row{display:flex;width:100%;}
  #sc1 .sc1-row.in{justify-content:flex-start;}
  #sc1 .sc1-row.out{justify-content:flex-end;}
  #sc1 .sc1-bub{max-width:78%;padding:18px 22px;font-size:25px;line-height:1.34;font-weight:500;border-radius:24px;opacity:0;transform:translateY(16px) scale(.96);}
  #sc1 .sc1-bub.cust{background:rgba(255,255,255,0.07);border:1px solid var(--c-line);color:var(--c-text);border-bottom-left-radius:8px;}
  #sc1 .sc1-bub.ai{background:linear-gradient(135deg,var(--c-violet-600),var(--c-indigo-600));color:#fff;border-bottom-right-radius:8px;box-shadow:0 16px 40px -16px rgba(139,92,246,0.8);}
  #sc1 .sc1-bub.ai b{font-weight:900;}
  #sc1 .sc1-bub.show{animation:sc1-bub .55s cubic-bezier(.16,1,.3,1) forwards;}

  /* typing indicator */
  #sc1 .sc1-typing{display:inline-flex;gap:9px;align-items:center;padding:22px 24px;background:linear-gradient(135deg,var(--c-violet-600),var(--c-indigo-600));border-radius:24px;border-bottom-right-radius:8px;opacity:0;transform:translateY(16px) scale(.96);}
  #sc1 .sc1-typing.show{animation:sc1-typein .45s cubic-bezier(.16,1,.3,1) forwards;}
  #sc1 .sc1-typing.hide{animation:sc1-typeout .35s ease forwards;}
  #sc1 .sc1-typing .dt{width:14px;height:14px;border-radius:50%;background:rgba(255,255,255,0.92);animation:sc1-blink 1.2s infinite ease-in-out;}
  #sc1 .sc1-typing .dt:nth-child(2){animation-delay:.18s;}
  #sc1 .sc1-typing .dt:nth-child(3){animation-delay:.36s;}

  /* product card bubble */
  #sc1 .sc1-prod{margin-top:-2px;max-width:82%;border-radius:24px;border-bottom-right-radius:8px;overflow:hidden;background:rgba(255,255,255,0.06);border:1px solid rgba(167,139,250,0.30);opacity:0;transform:translateY(16px) scale(.96);align-self:flex-end;}
  #sc1 .sc1-prod.show{animation:sc1-bub .55s cubic-bezier(.16,1,.3,1) forwards;}
  #sc1 .sc1-prod .img{height:118px;background:linear-gradient(135deg,rgba(99,102,241,0.35),rgba(34,211,238,0.18));display:flex;align-items:center;justify-content:center;font-size:54px;}
  #sc1 .sc1-prod .meta{padding:16px 20px;}
  #sc1 .sc1-prod .pn{color:var(--c-text);font-weight:800;font-size:23px;}
  #sc1 .sc1-prod .pp{margin-top:6px;color:var(--c-violet);font-weight:900;font-size:30px;letter-spacing:-0.01em;}

  /* QPay checkout link bubble */
  #sc1 .sc1-pay{max-width:82%;align-self:flex-end;display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:24px;border-bottom-right-radius:8px;background:linear-gradient(135deg,rgba(34,211,238,0.16),rgba(96,165,250,0.12));border:1px solid rgba(56,189,248,0.4);opacity:0;transform:translateY(16px) scale(.96);}
  #sc1 .sc1-pay.show{animation:sc1-bub .55s cubic-bezier(.16,1,.3,1) forwards;}
  #sc1 .sc1-pay .qi{width:50px;height:50px;border-radius:14px;background:#fff;display:grid;place-items:center;flex:0 0 auto;}
  #sc1 .sc1-pay .qi svg{width:34px;height:34px;}
  #sc1 .sc1-pay .pt{display:flex;flex-direction:column;}
  #sc1 .sc1-pay .pt .t1{color:var(--c-text);font-weight:800;font-size:23px;}
  #sc1 .sc1-pay .pt .t2{color:var(--c-sky);font-weight:600;font-size:18px;}

  /* order confirmed chip */
  #sc1 .sc1-confrow{display:flex;justify-content:center;margin-top:4px;}
  #sc1 .sc1-conf{display:inline-flex;align-items:center;gap:12px;padding:14px 26px;border-radius:99px;background:linear-gradient(135deg,rgba(52,211,153,0.22),rgba(52,211,153,0.10));border:1px solid rgba(52,211,153,0.5);color:var(--c-emerald);font-weight:800;font-size:23px;opacity:0;transform:scale(.85);}
  #sc1 .sc1-conf.show{animation:sc1-pop .6s cubic-bezier(.16,1,.3,1) forwards;}
  #sc1 .sc1-conf .ck{width:30px;height:30px;border-radius:50%;background:var(--c-emerald);color:#06231a;display:grid;place-items:center;font-size:18px;font-weight:900;}

  /* ---- Owner notification toast (top-right of safe area) ---- */
  #sc1 .sc1-toast{position:absolute;top:0;right:0;width:430px;display:flex;align-items:center;gap:18px;padding:22px 24px;border-radius:22px;background:linear-gradient(135deg,rgba(20,20,42,0.92),rgba(14,14,30,0.92));border:1px solid rgba(167,139,250,0.4);box-shadow:0 30px 80px -24px rgba(0,0,0,0.85),0 0 0 1px rgba(255,255,255,0.04);backdrop-filter:blur(16px);opacity:0;transform:translateX(60px);}
  #sc1 .sc1-toast.show{animation:sc1-toast-in .7s cubic-bezier(.16,1,.3,1) forwards;}
  #sc1 .sc1-bell{position:relative;width:60px;height:60px;flex:0 0 auto;border-radius:16px;background:linear-gradient(135deg,var(--c-violet-600),var(--c-indigo-600));display:grid;place-items:center;font-size:30px;box-shadow:0 12px 30px -10px rgba(139,92,246,0.8);}
  #sc1 .sc1-bell::after{content:"";position:absolute;inset:0;border-radius:16px;border:2px solid var(--c-violet);opacity:0;}
  #sc1 .sc1-toast.show .sc1-bell::after{animation:sc1-bellpulse 1.4s ease-out infinite .5s;}
  #sc1 .sc1-toast .tx .l1{display:flex;align-items:center;gap:8px;color:var(--c-text);font-weight:800;font-size:24px;}
  #sc1 .sc1-toast .tx .l1 .new{font-size:15px;font-weight:800;letter-spacing:.06em;color:var(--c-violet);text-transform:uppercase;}
  #sc1 .sc1-toast .tx .l2{margin-top:6px;color:var(--c-emerald);font-weight:900;font-size:30px;letter-spacing:-0.01em;}
  #sc1 .sc1-toast .tx .l3{margin-top:3px;color:var(--c-text-faint);font-weight:600;font-size:17px;}

  /* ===== keyframes (scoped) ===== */
  @keyframes sc1-up{from{opacity:0;transform:translateY(42px);}to{opacity:1;transform:translateY(0);}}
  @keyframes sc1-in{from{opacity:0;transform:scale(.9);}to{opacity:1;transform:scale(1);}}
  @keyframes sc1-phone-in{from{opacity:0;transform:translateY(60px) scale(.95) rotate(1.5deg);}to{opacity:1;transform:translateY(0) scale(1) rotate(0);}}
  @keyframes sc1-bub{from{opacity:0;transform:translateY(16px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes sc1-typein{from{opacity:0;transform:translateY(16px) scale(.96);}to{opacity:1;transform:translateY(0) scale(1);}}
  @keyframes sc1-typeout{from{opacity:1;transform:translateY(0) scale(1);}to{opacity:0;transform:translateY(-8px) scale(.9);height:0;padding-top:0;padding-bottom:0;margin:0;}}
  @keyframes sc1-blink{0%,80%,100%{opacity:.35;transform:translateY(0);}40%{opacity:1;transform:translateY(-5px);}}
  @keyframes sc1-pop{0%{opacity:0;transform:scale(.85);}55%{transform:scale(1.06);}100%{opacity:1;transform:scale(1);}}
  @keyframes sc1-toast-in{0%{opacity:0;transform:translateX(60px) scale(.96);}60%{opacity:1;transform:translateX(-6px) scale(1.01);}100%{opacity:1;transform:translateX(0) scale(1);}}
  @keyframes sc1-bellpulse{0%{opacity:.8;transform:scale(1);}100%{opacity:0;transform:scale(1.5);}}
  @keyframes sc1-pulse{0%,100%{transform:scale(1);opacity:1;}50%{transform:scale(1.25);opacity:.7;}}
  @keyframes sc1-radar{0%{transform:scale(1);opacity:.7;}100%{transform:scale(2.2);opacity:0;}}
  `;

  function mount(root){
    if(!document.getElementById('sc1-style')){ const s=document.createElement('style'); s.id='sc1-style'; s.textContent=CSS; document.head.appendChild(s); }

    root.innerHTML = `
    <div id="sc1">
      <div class="sc1-stage">

        <!-- LEFT: copy -->
        <div class="sc1-copy">
          <div class="sc1-kicker"><span class="dot"></span>Давуу тал 01</div>
          <div class="sc1-title">AI борлуулалт<br/><span class="grad">— 24/7</span></div>
          <div class="sc1-sub">Чат бүрт AI хүн шиг хариулж, бараа санал болгож, захиалга авна. Эзэнд нь шууд мэдэгдэл очно.</div>
          <div class="sc1-badges">
            <div class="sc1-badge lit">24/7 ажиллана</div>
            <div class="sc1-badge"><span class="ring"></span>Бодит цаг</div>
          </div>
        </div>

        <!-- RIGHT: phone + toast -->
        <div class="sc1-phonewrap">
          <div class="sc1-glow"></div>

          <div class="sc1-phone">
            <div class="sc1-screen">
              <div class="sc1-chead">
                <div class="sc1-ava">S</div>
                <div class="sc1-cinfo">
                  <div class="n">Syncly дэлгүүр</div>
                  <div class="s"><span class="d"></span>Онлайн</div>
                </div>
                <div class="sc1-aitag">AI</div>
              </div>

              <div class="sc1-body">
                <div class="sc1-row in"><div class="sc1-bub cust" id="sc1-m1">Сайн уу, iPhone 15 Pro байгаа юу?</div></div>

                <div class="sc1-row out"><div class="sc1-typing" id="sc1-typ"><span class="dt"></span><span class="dt"></span><span class="dt"></span></div></div>

                <div class="sc1-row out"><div class="sc1-bub ai" id="sc1-m2">Тийм ээ! <b>iPhone 15 Pro</b> бэлэн байна 👇</div></div>

                <div class="sc1-prod" id="sc1-prod">
                  <div class="img">📱</div>
                  <div class="meta">
                    <div class="pn">iPhone 15 Pro · 256GB</div>
                    <div class="pp">₮5,200,000</div>
                  </div>
                </div>

                <div class="sc1-row out"><div class="sc1-bub ai" id="sc1-m3">Захиалах уу? 🛒</div></div>

                <div class="sc1-row in"><div class="sc1-bub cust" id="sc1-m4">Тийм</div></div>

                <div class="sc1-pay" id="sc1-pay">
                  <div class="qi">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="3" y="3" width="7" height="7" rx="1.4" fill="#0a0a16"/>
                      <rect x="14" y="3" width="7" height="7" rx="1.4" fill="#0a0a16"/>
                      <rect x="3" y="14" width="7" height="7" rx="1.4" fill="#0a0a16"/>
                      <rect x="14" y="14" width="3" height="3" rx="0.6" fill="#0a0a16"/>
                      <rect x="18" y="18" width="3" height="3" rx="0.6" fill="#0a0a16"/>
                    </svg>
                  </div>
                  <div class="pt"><span class="t1">QPay төлбөрийн холбоос</span><span class="t2">Энд дарж төлнө үү →</span></div>
                </div>

                <div class="sc1-confrow"><div class="sc1-conf" id="sc1-conf"><span class="ck">✓</span>Захиалга баталгаажлаа</div></div>
              </div>
            </div>
          </div>

          <!-- owner notification toast -->
          <div class="sc1-toast" id="sc1-toast">
            <div class="sc1-bell">🔔</div>
            <div class="tx">
              <div class="l1"><span class="new">Шинэ захиалга</span></div>
              <div class="l2">₮5,200,000</div>
              <div class="l3">iPhone 15 Pro · яг одоо</div>
            </div>
          </div>

        </div>
      </div>
    </div>`;

    // --- choreography (vanilla JS timeline; restarts each mount) ---
    const T = (id)=>root.querySelector(id);
    const timers = [];
    const at = (ms, fn)=>{ timers.push(setTimeout(fn, ms)); };

    // customer first message
    at(900,  ()=> T('#sc1-m1').classList.add('show'));
    // typing indicator
    at(1500, ()=> T('#sc1-typ').classList.add('show'));
    at(3100, ()=> T('#sc1-typ').classList.add('hide'));
    // AI reply + product card
    at(3250, ()=> T('#sc1-m2').classList.add('show'));
    at(3750, ()=> T('#sc1-prod').classList.add('show'));
    at(4350, ()=> T('#sc1-m3').classList.add('show'));
    // customer says yes
    at(5050, ()=> T('#sc1-m4').classList.add('show'));
    // QPay link
    at(5650, ()=> T('#sc1-pay').classList.add('show'));
    // order confirmed + owner toast (simultaneous)
    at(6500, ()=> T('#sc1-conf').classList.add('show'));
    at(6700, ()=> T('#sc1-toast').classList.add('show'));
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({ id:1, key:'ai-sales', title:'AI борлуулалт 24/7', durationMs:12000, accent:'var(--c-violet-600)', mount });
})();
