(function(){
  const CSS = `
  #sc2{ position:absolute; inset:0; font-family:var(--font); color:var(--c-text); --accent:var(--c-emerald); overflow:hidden; }
  #sc2 *{ box-sizing:border-box; }

  /* soft accent glow behind the dashboard */
  #sc2 .sc2-glow{ position:absolute; width:900px; height:900px; right:-180px; top:-160px;
    background:radial-gradient(circle at center, rgba(52,211,153,.16), transparent 62%); pointer-events:none;
    filter:blur(8px); opacity:0; animation:sc2-glowin 1200ms cubic-bezier(.16,1,.3,1) 120ms forwards; }
  #sc2 .sc2-glow.b{ left:-220px; top:auto; bottom:-260px; width:760px; height:760px;
    background:radial-gradient(circle at center, rgba(96,165,250,.10), transparent 64%); }

  /* header block */
  #sc2 .sc2-head{ position:absolute; left:90px; top:150px; width:1740px; }
  #sc2 .sc2-kicker{ display:inline-flex; align-items:center; gap:12px; font-size:22px; font-weight:700;
    letter-spacing:.28em; color:var(--accent); text-transform:uppercase;
    opacity:0; transform:translateY(14px); animation:sc2-up 760ms cubic-bezier(.16,1,.3,1) 120ms forwards; }
  #sc2 .sc2-kicker .dot{ width:12px; height:12px; border-radius:50%; background:var(--accent);
    box-shadow:0 0 18px var(--accent); }
  #sc2 .sc2-title{ font-size:74px; font-weight:800; line-height:1.02; margin:14px 0 0; letter-spacing:-.02em;
    opacity:0; transform:translateY(18px); animation:sc2-up 820ms cubic-bezier(.16,1,.3,1) 220ms forwards; }
  #sc2 .sc2-sub{ font-size:27px; font-weight:500; color:var(--c-text-dim); margin:14px 0 0; max-width:1180px; line-height:1.4;
    opacity:0; transform:translateY(18px); animation:sc2-up 820ms cubic-bezier(.16,1,.3,1) 320ms forwards; }

  /* dashboard glass panel */
  #sc2 .sc2-panel{ position:absolute; left:90px; top:384px; width:1740px; height:616px;
    background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
    border:1px solid var(--c-line); border-radius:28px; padding:30px 34px;
    backdrop-filter:blur(18px); -webkit-backdrop-filter:blur(18px);
    box-shadow:0 40px 90px -40px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.06);
    opacity:0; transform:translateY(34px) scale(.985); transform-origin:top center;
    animation:sc2-panel 900ms cubic-bezier(.16,1,.3,1) 420ms forwards; }

  /* stat tiles row */
  #sc2 .sc2-stats{ display:flex; gap:24px; }
  #sc2 .sc2-tile{ flex:1; background:rgba(255,255,255,.04); border:1px solid var(--c-line); border-radius:20px;
    padding:24px 28px; position:relative; overflow:hidden;
    opacity:0; transform:translateY(20px); animation:sc2-up 700ms cubic-bezier(.16,1,.3,1) forwards; }
  #sc2 .sc2-tile.t1{ animation-delay:620ms; }
  #sc2 .sc2-tile.t2{ animation-delay:720ms; }
  #sc2 .sc2-tile .lab{ font-size:24px; color:var(--c-text-dim); font-weight:600; display:flex; align-items:center; gap:12px; }
  #sc2 .sc2-tile .lab .ic{ width:42px; height:42px; border-radius:12px; display:grid; place-items:center;
    background:rgba(52,211,153,.14); color:var(--accent); }
  #sc2 .sc2-tile.t2 .lab .ic{ background:rgba(96,165,250,.14); color:var(--c-blue); }
  #sc2 .sc2-tile .num{ font-size:56px; font-weight:800; letter-spacing:-.02em; margin-top:10px; font-variant-numeric:tabular-nums; }
  #sc2 .sc2-tile .trend{ position:absolute; right:24px; top:26px; font-size:20px; font-weight:700; color:var(--accent);
    background:rgba(52,211,153,.12); padding:6px 12px; border-radius:999px; }

  /* filter row */
  #sc2 .sc2-filters{ display:flex; gap:14px; margin-top:26px; }
  #sc2 .sc2-chip{ font-size:21px; font-weight:600; color:var(--c-text-dim); padding:11px 22px; border-radius:999px;
    border:1px solid var(--c-line); background:rgba(255,255,255,.03); white-space:nowrap;
    opacity:0; transform:translateY(14px); animation:sc2-up 560ms cubic-bezier(.16,1,.3,1) forwards; }
  #sc2 .sc2-chip.on{ color:#06120c; background:var(--accent); border-color:transparent; box-shadow:0 8px 22px -8px var(--accent); }
  #sc2 .sc2-chip.f1{ animation-delay:840ms; }
  #sc2 .sc2-chip.f2{ animation-delay:900ms; }
  #sc2 .sc2-chip.f3{ animation-delay:960ms; }
  #sc2 .sc2-chip.f4{ animation-delay:1020ms; }
  #sc2 .sc2-chip.f5{ animation-delay:1080ms; }
  #sc2 .sc2-exp{ margin-left:auto; font-size:21px; font-weight:700; color:var(--accent); padding:11px 22px; border-radius:999px;
    border:1px solid rgba(52,211,153,.4); background:rgba(52,211,153,.10); display:inline-flex; align-items:center; gap:10px;
    opacity:0; transform:translateY(14px); animation:sc2-up 560ms cubic-bezier(.16,1,.3,1) 1140ms forwards; }

  /* table */
  #sc2 .sc2-table{ margin-top:24px; }
  #sc2 .sc2-thead{ display:grid; grid-template-columns:1.4fr 1.7fr 1fr 1.2fr; gap:18px; padding:0 18px 14px;
    font-size:19px; font-weight:700; letter-spacing:.04em; color:var(--c-text-faint); text-transform:uppercase;
    border-bottom:1px solid var(--c-line);
    opacity:0; animation:sc2-fade 500ms ease 1180ms forwards; }
  #sc2 .sc2-row{ display:grid; grid-template-columns:1.4fr 1.7fr 1fr 1.2fr; gap:18px; align-items:center;
    padding:13px 18px; border-radius:16px; margin-top:6px;
    opacity:0; transform:translateX(-26px); animation:sc2-row 620ms cubic-bezier(.16,1,.3,1) forwards; }
  #sc2 .sc2-row:nth-child(2){ animation-delay:1260ms; }
  #sc2 .sc2-row:nth-child(3){ animation-delay:1380ms; }
  #sc2 .sc2-row:nth-child(4){ animation-delay:1500ms; }
  #sc2 .sc2-row:nth-child(5){ animation-delay:1620ms; }
  #sc2 .sc2-row:nth-child(6){ animation-delay:1740ms; }
  #sc2 .sc2-row.hl{ background:rgba(52,211,153,.06); box-shadow:inset 0 0 0 1px rgba(52,211,153,.22); }

  #sc2 .sc2-cust{ display:flex; align-items:center; gap:14px; }
  #sc2 .sc2-av{ width:46px; height:46px; border-radius:50%; display:grid; place-items:center; font-size:20px; font-weight:800;
    color:#06120c; flex-shrink:0; }
  #sc2 .sc2-name{ font-size:25px; font-weight:700; }
  #sc2 .sc2-id{ font-size:18px; color:var(--c-text-faint); margin-top:2px; }
  #sc2 .sc2-prod{ font-size:23px; font-weight:500; color:var(--c-text-dim); }
  #sc2 .sc2-amt{ font-size:25px; font-weight:700; font-variant-numeric:tabular-nums; }

  /* status pill */
  #sc2 .sc2-pill{ justify-self:start; font-size:20px; font-weight:700; padding:9px 18px; border-radius:999px;
    display:inline-flex; align-items:center; gap:9px; white-space:nowrap;
    transition:background .45s ease, color .45s ease; }
  #sc2 .sc2-pill .pdot{ width:10px; height:10px; border-radius:50%; background:currentColor; box-shadow:0 0 10px currentColor; }
  #sc2 .pill-amber{ color:var(--c-amber); background:rgba(251,191,36,.14); }
  #sc2 .pill-blue{ color:var(--c-blue); background:rgba(96,165,250,.14); }
  #sc2 .pill-violet{ color:var(--c-violet); background:rgba(167,139,250,.14); }
  #sc2 .pill-green{ color:var(--c-emerald); background:rgba(52,211,153,.16); }
  #sc2 .pill-rose{ color:var(--c-rose); background:rgba(251,113,133,.14); }

  /* animated pill on the highlighted row cycles through stages */
  #sc2 .sc2-pill.live{ animation:sc2-pillcycle 5400ms cubic-bezier(.16,1,.3,1) 2000ms forwards; }

  @keyframes sc2-glowin{ to{ opacity:1; } }
  @keyframes sc2-up{ to{ opacity:1; transform:translateY(0); } }
  @keyframes sc2-fade{ to{ opacity:1; } }
  @keyframes sc2-panel{ to{ opacity:1; transform:translateY(0) scale(1); } }
  @keyframes sc2-row{ to{ opacity:1; transform:translateX(0); } }

  /* color cycle: amber -> blue -> violet -> green */
  @keyframes sc2-pillcycle{
    0%   { color:var(--c-amber);   background:rgba(251,191,36,.14); }
    24%  { color:var(--c-amber);   background:rgba(251,191,36,.14); }
    25%  { color:var(--c-blue);    background:rgba(96,165,250,.16); }
    49%  { color:var(--c-blue);    background:rgba(96,165,250,.16); }
    50%  { color:var(--c-violet);  background:rgba(167,139,250,.16); }
    74%  { color:var(--c-violet);  background:rgba(167,139,250,.16); }
    75%  { color:var(--c-emerald); background:rgba(52,211,153,.20); }
    100% { color:var(--c-emerald); background:rgba(52,211,153,.20); }
  }
  /* swap label text in lockstep with the color cycle */
  @keyframes sc2-pilltxt{
    0%,24%   { } 25%,49%{ } 50%,74%{ } 75%,100%{ }
  }
  `;

  function mount(root){
    if(!document.getElementById('sc2-style')){
      const s=document.createElement('style'); s.id='sc2-style'; s.textContent=CSS; document.head.appendChild(s);
    }

    root.innerHTML = `
    <div id="sc2">
      <div class="sc2-glow"></div>
      <div class="sc2-glow b"></div>

      <div class="sc2-head">
        <div class="sc2-kicker"><span class="dot"></span>ДАВУУ ТАЛ 02</div>
        <h2 class="sc2-title">Захиалга удирдлага</h2>
        <p class="sc2-sub">Бүх захиалгыг нэг дороос — төлөв, төлбөр, хүргэлтийг хянаж, шүүж, экспортол.</p>
      </div>

      <div class="sc2-panel">
        <div class="sc2-stats">
          <div class="sc2-tile t1">
            <div class="lab"><span class="ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </span>Өнөөдрийн захиалга</div>
            <div class="num" data-count="24" data-from="0">0</div>
            <div class="trend">▲ 18%</div>
          </div>
          <div class="sc2-tile t2">
            <div class="lab"><span class="ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </span>Орлого</div>
            <div class="num" data-count="1240000" data-from="0" data-prefix="₮" data-comma="1">₮0</div>
            <div class="trend">▲ 24%</div>
          </div>
        </div>

        <div class="sc2-filters">
          <span class="sc2-chip on f1">Бүгд</span>
          <span class="sc2-chip f2">Хүлээгдэж буй</span>
          <span class="sc2-chip f3">Төлбөр төлөгдсөн</span>
          <span class="sc2-chip f4">Хүргэлтэд</span>
          <span class="sc2-chip f5">Дууссан</span>
          <span class="sc2-exp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>
            Экспортлох
          </span>
        </div>

        <div class="sc2-table">
          <div class="sc2-thead">
            <div>Захиалагч</div>
            <div>Бараа</div>
            <div>Дүн</div>
            <div>Төлөв</div>
          </div>

          <div class="sc2-row hl">
            <div class="sc2-cust">
              <div class="sc2-av" style="background:linear-gradient(135deg,#34d399,#22d3ee)">Б</div>
              <div><div class="sc2-name">Болд</div><div class="sc2-id">#SY-2048</div></div>
            </div>
            <div class="sc2-prod">iPhone 15 Pro</div>
            <div class="sc2-amt">₮5,200,000</div>
            <div>
              <span class="sc2-pill live pill-amber"><span class="pdot"></span><span class="ptxt"></span></span>
            </div>
          </div>

          <div class="sc2-row">
            <div class="sc2-cust">
              <div class="sc2-av" style="background:linear-gradient(135deg,#a78bfa,#818cf8)">С</div>
              <div><div class="sc2-name">Сараа</div><div class="sc2-id">#SY-2047</div></div>
            </div>
            <div class="sc2-prod">Цамц × 2</div>
            <div class="sc2-amt">₮90,000</div>
            <div><span class="sc2-pill pill-green"><span class="pdot"></span>Дууссан ✓</span></div>
          </div>

          <div class="sc2-row">
            <div class="sc2-cust">
              <div class="sc2-av" style="background:linear-gradient(135deg,#60a5fa,#38bdf8)">Э</div>
              <div><div class="sc2-name">Энхээ</div><div class="sc2-id">#SY-2046</div></div>
            </div>
            <div class="sc2-prod">AirPods Pro 2</div>
            <div class="sc2-amt">₮780,000</div>
            <div><span class="sc2-pill pill-violet"><span class="pdot"></span>Хүргэлтэд</span></div>
          </div>

          <div class="sc2-row">
            <div class="sc2-cust">
              <div class="sc2-av" style="background:linear-gradient(135deg,#fbbf24,#fb7185)">Т</div>
              <div><div class="sc2-name">Тэмүүлэн</div><div class="sc2-id">#SY-2045</div></div>
            </div>
            <div class="sc2-prod">Гутал — Nike Air</div>
            <div class="sc2-amt">₮420,000</div>
            <div><span class="sc2-pill pill-blue"><span class="pdot"></span>Төлбөр төлөгдсөн</span></div>
          </div>

        </div>
      </div>
    </div>`;

    // count-up for the two stat tiles
    const ease = t => 1 - Math.pow(1 - t, 3);
    const nums = root.querySelectorAll('#sc2 .num[data-count]');
    nums.forEach(el=>{
      const target = parseFloat(el.getAttribute('data-count'));
      const from = parseFloat(el.getAttribute('data-from')) || 0;
      const prefix = el.getAttribute('data-prefix') || '';
      const comma = el.getAttribute('data-comma') === '1';
      const dur = 1400, delay = 760;
      const fmt = v => { const n = Math.round(v); return prefix + (comma ? n.toLocaleString('en-US') : String(n)); };
      const start = performance.now() + delay;
      function tick(now){
        if(!el.isConnected) return;
        const p = Math.min(1, Math.max(0, (now - start) / dur));
        el.textContent = fmt(from + (target - from) * ease(p));
        if(p < 1) requestAnimationFrame(tick);
      }
      el.textContent = fmt(from);
      requestAnimationFrame(tick);
    });

    // drive the live status pill label through 4 stages in sync with the CSS color cycle
    const live = root.querySelector('#sc2 .sc2-pill.live .ptxt');
    if(live){
      const stages = ['Хүлээгдэж буй','Төлбөр төлөгдсөн','Хүргэлтэд','Дууссан ✓'];
      live.textContent = stages[0];
      const baseDelay = 2000, step = 5400 / 4;
      stages.forEach((label, i)=>{
        setTimeout(()=>{ if(live.isConnected) live.textContent = label; }, baseDelay + i * step);
      });
    }
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({ id:2, key:'orders', title:'Захиалга удирдлага', durationMs:11000, accent:'var(--c-emerald)', mount });
})();
