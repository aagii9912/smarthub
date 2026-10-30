(function(){
  const CSS = `
  #sc5{position:absolute;inset:0;font-family:var(--font);color:var(--c-text);}

  /* ---- ambient glow ---- */
  #sc5 .sc5-glow{position:absolute;width:1100px;height:1100px;right:-260px;top:-200px;border-radius:50%;
    background:radial-gradient(circle, rgba(251,191,36,0.16), transparent 62%);pointer-events:none;
    animation:sc5-glowpulse 7.5s ease-in-out both;}
  @keyframes sc5-glowpulse{0%{opacity:0;transform:scale(.82);}26%{opacity:1;transform:scale(1);}100%{opacity:.85;transform:scale(1.04);}}

  /* ---- header block ---- */
  #sc5 .sc5-head{position:absolute;left:90px;top:150px;width:740px;}
  #sc5 .sc5-kick{display:inline-flex;align-items:center;gap:12px;font-size:22px;font-weight:700;
    letter-spacing:.16em;text-transform:uppercase;color:var(--accent);animation:sc5-up .7s cubic-bezier(.16,1,.3,1) .05s both;}
  #sc5 .sc5-kick .sc5-dot{width:11px;height:11px;border-radius:50%;background:var(--accent);box-shadow:0 0 20px var(--accent);}
  #sc5 .sc5-title{margin-top:22px;font-size:80px;font-weight:800;line-height:1.03;letter-spacing:-0.03em;
    animation:sc5-up .8s cubic-bezier(.16,1,.3,1) .15s both;}
  #sc5 .sc5-title b{background:linear-gradient(100deg,var(--c-amber),#fcd34d 55%,var(--c-rose));
    -webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;}
  #sc5 .sc5-sub{margin-top:26px;font-size:29px;font-weight:500;line-height:1.45;color:var(--c-text-dim);max-width:680px;
    animation:sc5-up .8s cubic-bezier(.16,1,.3,1) .3s both;}

  /* ---- stat pills under sub ---- */
  #sc5 .sc5-stats{display:flex;gap:20px;margin-top:46px;}
  #sc5 .sc5-stat{position:relative;flex:1;padding:24px 26px;border-radius:22px;border:1px solid var(--c-line);
    background:linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
    backdrop-filter:blur(14px);box-shadow:0 24px 60px -30px rgba(0,0,0,.7);overflow:hidden;}
  #sc5 .sc5-stat.s1{animation:sc5-up .8s cubic-bezier(.16,1,.3,1) 2.9s both;}
  #sc5 .sc5-stat.s2{animation:sc5-up .8s cubic-bezier(.16,1,.3,1) 3.1s both;}
  #sc5 .sc5-stat .sc5-sv{font-size:54px;font-weight:900;letter-spacing:-0.03em;line-height:1;}
  #sc5 .sc5-stat.s1 .sc5-sv{color:var(--c-emerald);}
  #sc5 .sc5-stat.s2 .sc5-sv{color:var(--c-amber);}
  #sc5 .sc5-stat .sc5-sl{margin-top:12px;font-size:21px;font-weight:600;color:var(--c-text-dim);line-height:1.3;}
  #sc5 .sc5-stat::after{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;border-radius:5px;}
  #sc5 .sc5-stat.s1::after{background:var(--c-emerald);}
  #sc5 .sc5-stat.s2::after{background:var(--c-amber);}

  /* satisfaction emoji row */
  #sc5 .sc5-emoji{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:30px;}
  #sc5 .sc5-emoji span{opacity:.28;filter:grayscale(.6);transition:none;}
  #sc5 .sc5-emoji .e1{animation:sc5-emo .5s ease 2.7s both;}
  #sc5 .sc5-emoji .e2{animation:sc5-emo .5s ease 3.0s both;}
  #sc5 .sc5-emoji .e3{animation:sc5-emo .5s ease 3.3s both, sc5-bob 1.6s ease 3.8s infinite;}
  @keyframes sc5-emo{from{opacity:.28;filter:grayscale(.6);transform:scale(.8);}to{opacity:1;filter:none;transform:scale(1);}}
  @keyframes sc5-bob{0%,100%{transform:translateY(0) scale(1);}50%{transform:translateY(-7px) scale(1.06);}}
  #sc5 .sc5-emoji .sc5-arrow{font-size:22px;color:var(--c-text-faint);opacity:.5;}

  /* ---- inbox panel ---- */
  #sc5 .sc5-inbox{position:absolute;right:90px;top:172px;width:880px;
    border-radius:28px;border:1px solid var(--c-line);overflow:hidden;
    background:linear-gradient(180deg, rgba(18,18,42,0.78), rgba(8,8,20,0.72));
    backdrop-filter:blur(20px);box-shadow:0 50px 130px -40px rgba(0,0,0,.85), inset 0 0 0 1px rgba(255,255,255,0.04);
    animation:sc5-in .9s cubic-bezier(.16,1,.3,1) .25s both;}
  #sc5 .sc5-ibhead{display:flex;align-items:center;justify-content:space-between;padding:26px 32px;
    border-bottom:1px solid var(--c-line);background:rgba(255,255,255,0.025);}
  #sc5 .sc5-ibtitle{display:flex;align-items:center;gap:14px;font-size:27px;font-weight:800;letter-spacing:-0.01em;}
  #sc5 .sc5-ibtitle .sc5-ic{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;
    background:linear-gradient(135deg, var(--c-amber), #f59e0b);box-shadow:0 10px 28px -8px rgba(251,191,36,.6);}
  #sc5 .sc5-badge{padding:7px 16px;border-radius:99px;font-size:18px;font-weight:700;
    color:var(--c-amber);background:rgba(251,191,36,0.14);border:1px solid rgba(251,191,36,0.3);}

  #sc5 .sc5-list{padding:20px 24px 26px;display:flex;flex-direction:column;gap:16px;}

  /* complaint rows */
  #sc5 .sc5-row{position:relative;padding:22px 24px;border-radius:20px;border:1px solid var(--c-line);
    background:rgba(255,255,255,0.035);display:grid;grid-template-columns:64px 1fr auto;gap:20px;align-items:center;}
  #sc5 .sc5-row.r0{animation:sc5-slide .8s cubic-bezier(.16,1,.3,1) .9s both;
    box-shadow:0 18px 50px -26px rgba(251,191,36,.5);border-color:rgba(251,191,36,0.22);}
  #sc5 .sc5-row.r1{animation:sc5-slide .75s cubic-bezier(.16,1,.3,1) 1.15s both;}
  #sc5 .sc5-row.r2{animation:sc5-slide .75s cubic-bezier(.16,1,.3,1) 1.35s both;}
  @keyframes sc5-slide{from{opacity:0;transform:translateX(60px);}to{opacity:1;transform:translateX(0);}}

  #sc5 .sc5-av{width:64px;height:64px;border-radius:16px;display:grid;place-items:center;
    font-size:25px;font-weight:800;color:#fff;}
  #sc5 .sc5-av.a0{background:linear-gradient(135deg,var(--c-violet-600),var(--c-indigo-600));}
  #sc5 .sc5-av.a1{background:linear-gradient(135deg,var(--c-cyan),var(--c-blue));}
  #sc5 .sc5-av.a2{background:linear-gradient(135deg,var(--c-rose),var(--c-amber));}

  #sc5 .sc5-mid{min-width:0;}
  #sc5 .sc5-line1{display:flex;align-items:center;gap:14px;}
  #sc5 .sc5-name{font-size:26px;font-weight:800;letter-spacing:-0.01em;}
  #sc5 .sc5-time{font-size:18px;font-weight:600;color:var(--c-text-faint);}
  #sc5 .sc5-msg{margin-top:7px;font-size:23px;font-weight:500;color:var(--c-text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  #sc5 .sc5-tags{margin-top:13px;display:flex;gap:10px;align-items:center;}
  #sc5 .sc5-cat{padding:6px 15px;border-radius:99px;font-size:17px;font-weight:700;
    color:var(--c-sky);background:rgba(56,189,248,0.13);border:1px solid rgba(56,189,248,0.28);}
  #sc5 .sc5-row.r0 .sc5-cat{animation:sc5-pop .5s cubic-bezier(.16,1,.3,1) 1.75s both;}
  #sc5 .sc5-row.r1 .sc5-cat{animation:sc5-pop .5s cubic-bezier(.16,1,.3,1) 1.5s both;}
  #sc5 .sc5-row.r2 .sc5-cat{animation:sc5-pop .5s cubic-bezier(.16,1,.3,1) 1.7s both;}
  @keyframes sc5-pop{0%{opacity:0;transform:scale(.6);}60%{transform:scale(1.12);}100%{opacity:1;transform:scale(1);}}
  #sc5 .sc5-auto{font-size:15px;font-weight:600;color:var(--c-text-faint);letter-spacing:.04em;
    display:inline-flex;align-items:center;gap:5px;}

  /* status chip (right) */
  #sc5 .sc5-right{display:flex;flex-direction:column;align-items:flex-end;gap:12px;}
  #sc5 .sc5-chip{position:relative;padding:11px 20px;border-radius:99px;font-size:19px;font-weight:800;
    white-space:nowrap;border:1px solid transparent;}
  #sc5 .sc5-chip .sc5-cdot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px;vertical-align:middle;}

  /* status color states applied via JS class */
  #sc5 .sc5-chip.st-new{color:var(--c-amber);background:rgba(251,191,36,0.15);border-color:rgba(251,191,36,0.35);}
  #sc5 .sc5-chip.st-new .sc5-cdot{background:var(--c-amber);box-shadow:0 0 12px var(--c-amber);}
  #sc5 .sc5-chip.st-review{color:var(--c-blue);background:rgba(96,165,250,0.15);border-color:rgba(96,165,250,0.38);}
  #sc5 .sc5-chip.st-review .sc5-cdot{background:var(--c-blue);box-shadow:0 0 12px var(--c-blue);}
  #sc5 .sc5-chip.st-done{color:var(--c-emerald);background:rgba(52,211,153,0.16);border-color:rgba(52,211,153,0.4);}
  #sc5 .sc5-chip.st-done .sc5-cdot{background:var(--c-emerald);box-shadow:0 0 12px var(--c-emerald);}
  #sc5 .sc5-chip-swap{transition:opacity .3s ease, transform .3s ease;}

  /* progress mini-track on featured row */
  #sc5 .sc5-track{width:148px;height:7px;border-radius:99px;background:rgba(255,255,255,0.1);overflow:hidden;}
  #sc5 .sc5-track .sc5-fill{display:block;height:100%;width:0;border-radius:99px;
    background:linear-gradient(90deg,var(--c-amber),var(--c-blue),var(--c-emerald));
    animation:sc5-fill 3.2s cubic-bezier(.16,1,.3,1) 1.6s both;}
  @keyframes sc5-fill{from{width:0;}to{width:100%;}}

  /* static (already resolved) chips for other rows */
  #sc5 .sc5-row.r1 .sc5-chip{animation:sc5-pop .5s cubic-bezier(.16,1,.3,1) 1.6s both;}
  #sc5 .sc5-row.r2 .sc5-chip{animation:sc5-pop .5s cubic-bezier(.16,1,.3,1) 1.8s both;}

  /* resolved sparkle on featured row */
  #sc5 .sc5-spark{position:absolute;right:30px;top:18px;font-size:30px;opacity:0;
    animation:sc5-spark .8s cubic-bezier(.16,1,.3,1) 4.7s both;}
  @keyframes sc5-spark{0%{opacity:0;transform:scale(.4) rotate(-20deg);}55%{opacity:1;transform:scale(1.25) rotate(8deg);}100%{opacity:1;transform:scale(1) rotate(0);}}

  /* shared keyframes */
  @keyframes sc5-up{from{opacity:0;transform:translateY(38px);}to{opacity:1;transform:translateY(0);}}
  @keyframes sc5-in{from{opacity:0;transform:scale(.95) translateY(20px);}to{opacity:1;transform:scale(1) translateY(0);}}
  `;

  function mount(root){
    if(!document.getElementById('sc5-style')){ const s=document.createElement('style'); s.id='sc5-style'; s.textContent=CSS; document.head.appendChild(s); }

    root.innerHTML = `
    <div id="sc5">
      <div class="sc5-glow"></div>

      <div class="sc5-head">
        <div class="sc5-kick"><span class="sc5-dot"></span>ДАВУУ ТАЛ 05</div>
        <div class="sc5-title">Гомдол <b>барагдуулах</b></div>
        <div class="sc5-sub">Хэрэглэгчийн гомдлыг нэг цэгээс хүлээн авч, ангилж, шийдвэрлэн — үйлчилгээгээ сайжруул.</div>

        <div class="sc5-stats">
          <div class="sc5-stat s1">
            <div class="sc5-sv" id="sc5-csat">0%</div>
            <div class="sc5-emoji"><span class="e1">😟</span><span class="sc5-arrow">›</span><span class="e2">🙂</span><span class="sc5-arrow">›</span><span class="e3">😀</span></div>
            <div class="sc5-sl">Сэтгэл ханамж</div>
          </div>
          <div class="sc5-stat s2">
            <div class="sc5-sv"><span id="sc5-time">0</span> мин</div>
            <div class="sc5-sl">Дундаж шийдвэрлэх хугацаа</div>
          </div>
        </div>
      </div>

      <div class="sc5-inbox">
        <div class="sc5-ibhead">
          <div class="sc5-ibtitle">
            <div class="sc5-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="#1a1306" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            Гомдлын сан
          </div>
          <div class="sc5-badge">3 идэвхтэй</div>
        </div>

        <div class="sc5-list">

          <div class="sc5-row r0">
            <div class="sc5-spark">✓</div>
            <div class="sc5-av a0">С</div>
            <div class="sc5-mid">
              <div class="sc5-line1"><span class="sc5-name">Сараа</span><span class="sc5-time">· 2 цагийн өмнө</span></div>
              <div class="sc5-msg">Хүргэлт хоцорсон, захиалгаа хүлээгээд байна.</div>
              <div class="sc5-tags"><span class="sc5-cat">Хүргэлт</span><span class="sc5-auto">⚡ Автомат ангилал</span></div>
            </div>
            <div class="sc5-right">
              <div class="sc5-chip st-new" id="sc5-chip"><span class="sc5-cdot"></span><span class="sc5-chip-swap" id="sc5-chiptext">Шинэ</span></div>
              <div class="sc5-track"><span class="sc5-fill"></span></div>
            </div>
          </div>

          <div class="sc5-row r1">
            <div class="sc5-av a1">Б</div>
            <div class="sc5-mid">
              <div class="sc5-line1"><span class="sc5-name">Болд</span><span class="sc5-time">· 25 мин өмнө</span></div>
              <div class="sc5-msg">Барааны хэмжээ таарсангүй, солих боломжтой юу?</div>
              <div class="sc5-tags"><span class="sc5-cat">Бараа солих</span><span class="sc5-auto">⚡ Автомат ангилал</span></div>
            </div>
            <div class="sc5-right">
              <div class="sc5-chip st-review"><span class="sc5-cdot"></span>Хянагдаж буй</div>
            </div>
          </div>

          <div class="sc5-row r2">
            <div class="sc5-av a2">Н</div>
            <div class="sc5-mid">
              <div class="sc5-line1"><span class="sc5-name">Нараа</span><span class="sc5-time">· 1 цагийн өмнө</span></div>
              <div class="sc5-msg">Буцаалтын мөнгөө хүлээж авлаа, баярлалаа!</div>
              <div class="sc5-tags"><span class="sc5-cat">Төлбөр</span><span class="sc5-auto">⚡ Автомат ангилал</span></div>
            </div>
            <div class="sc5-right">
              <div class="sc5-chip st-done"><span class="sc5-cdot"></span>Шийдвэрлэгдсэн ✓</div>
            </div>
          </div>

        </div>
      </div>
    </div>`;

    // --- status chip animates Шинэ → Хянагдаж буй → Шийдвэрлэгдсэн ✓ on the featured row ---
    const chip = root.querySelector('#sc5-chip');
    const chipText = root.querySelector('#sc5-chiptext');
    function swap(stateClass, label){
      if(!chip) return;
      chipText.style.opacity = '0';
      chipText.style.transform = 'translateY(-8px)';
      setTimeout(()=>{
        chip.classList.remove('st-new','st-review','st-done');
        chip.classList.add(stateClass);
        chipText.textContent = label;
        chipText.style.opacity = '1';
        chipText.style.transform = 'translateY(0)';
      }, 300);
    }
    const t1 = setTimeout(()=> swap('st-review','Хянагдаж буй'), 2900);
    const t2 = setTimeout(()=> swap('st-done','Шийдвэрлэгдсэн ✓'), 4600);

    // --- count-up stats ---
    function countUp(el, target, suffix, dur, delay, fmt){
      if(!el) return;
      setTimeout(()=>{
        const start = performance.now();
        function tick(now){
          const p = Math.min(1, (now-start)/dur);
          const e = 1 - Math.pow(1-p, 3);
          const v = Math.round(target*e);
          el.textContent = (fmt? v : v) + suffix;
          if(p<1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      }, delay);
    }
    countUp(root.querySelector('#sc5-csat'), 94, '%', 1100, 2900);
    countUp(root.querySelector('#sc5-time'), 18, '', 1100, 3100);

    root._sc5Timers = [t1, t2];
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({ id:5, key:'complaints', title:'Гомдол барагдуулах', durationMs:10000, accent:'var(--c-amber)', mount });
})();
