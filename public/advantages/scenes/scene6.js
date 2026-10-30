(function(){
  const CSS = `
  #sc6{ position:absolute; inset:0; font-family:var(--font); color:var(--c-text); overflow:hidden; --accent:var(--c-sky); }
  #sc6 *{ box-sizing:border-box; }

  /* ---- header ---- */
  #sc6 .sc6-head{ position:absolute; left:90px; top:150px; width:1740px; }
  #sc6 .sc6-kicker{ display:inline-flex; align-items:center; gap:14px; font-size:22px; font-weight:700; letter-spacing:.22em;
    color:var(--accent); text-transform:uppercase; opacity:0; animation:sc6-up .8s cubic-bezier(.16,1,.3,1) .05s both; }
  #sc6 .sc6-kicker .sc6-dot{ width:12px; height:12px; border-radius:50%; background:var(--accent); box-shadow:0 0 18px var(--c-sky); }
  #sc6 .sc6-title{ font-size:76px; font-weight:800; letter-spacing:-.02em; margin:14px 0 12px; line-height:1;
    opacity:0; animation:sc6-up .85s cubic-bezier(.16,1,.3,1) .16s both; }
  #sc6 .sc6-sub{ font-size:29px; font-weight:500; color:var(--c-text-dim); max-width:1180px; line-height:1.4;
    opacity:0; animation:sc6-up .85s cubic-bezier(.16,1,.3,1) .28s both; }

  /* ---- layout columns ---- */
  #sc6 .sc6-stage{ position:absolute; left:90px; top:400px; width:1740px; height:600px; }

  /* ---- chat phone (left) ---- */
  #sc6 .sc6-phone{ position:absolute; left:0; top:0; width:520px; height:600px; border-radius:42px;
    background:linear-gradient(160deg, rgba(18,18,42,.92), rgba(11,11,24,.96));
    border:1px solid var(--c-line); box-shadow:0 40px 90px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
    backdrop-filter:blur(18px); padding:34px 30px; opacity:0; animation:sc6-up .9s cubic-bezier(.16,1,.3,1) .4s both; }
  #sc6 .sc6-pbar{ display:flex; align-items:center; gap:14px; padding-bottom:24px; border-bottom:1px solid var(--c-line); }
  #sc6 .sc6-avatar{ width:54px; height:54px; border-radius:50%; flex:0 0 54px;
    background:linear-gradient(140deg,var(--c-sky),var(--c-blue)); display:grid; place-items:center; font-size:26px; }
  #sc6 .sc6-pname{ font-size:25px; font-weight:700; }
  #sc6 .sc6-pstat{ font-size:18px; color:var(--c-emerald); font-weight:600; display:flex; align-items:center; gap:8px; }
  #sc6 .sc6-pstat::before{ content:''; width:9px; height:9px; border-radius:50%; background:var(--c-emerald); box-shadow:0 0 10px var(--c-emerald); }

  #sc6 .sc6-msgs{ display:flex; flex-direction:column; gap:18px; padding-top:28px; }
  #sc6 .sc6-bub{ max-width:360px; padding:20px 24px; font-size:25px; line-height:1.35; border-radius:24px; opacity:0; }
  #sc6 .sc6-bub.in{ align-self:flex-start; background:var(--c-card); border:1px solid var(--c-line); border-bottom-left-radius:8px;
    color:var(--c-text); animation:sc6-pop .6s cubic-bezier(.16,1,.3,1) .8s both; }
  #sc6 .sc6-bub.out{ align-self:flex-end; background:linear-gradient(140deg,var(--c-sky),var(--c-blue)); color:#06121c;
    font-weight:600; border-bottom-right-radius:8px; box-shadow:0 14px 34px rgba(56,189,248,.35);
    animation:sc6-pop .6s cubic-bezier(.16,1,.3,1) 1.35s both; }
  #sc6 .sc6-time{ font-size:16px; color:var(--c-text-faint); margin-top:-8px; opacity:0; }
  #sc6 .sc6-time.t1{ align-self:flex-start; animation:sc6-fade .5s ease 1.05s both; }
  #sc6 .sc6-time.t2{ align-self:flex-end; animation:sc6-fade .5s ease 1.6s both; }

  /* ---- calendar card (center) ---- */
  #sc6 .sc6-cal{ position:absolute; left:580px; top:0; width:680px; height:600px; border-radius:32px;
    background:linear-gradient(165deg, rgba(20,20,46,.9), rgba(11,11,24,.94));
    border:1px solid var(--c-line); box-shadow:0 40px 90px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06);
    backdrop-filter:blur(18px); padding:34px 36px; opacity:0; animation:sc6-up .9s cubic-bezier(.16,1,.3,1) 1.9s both; }
  #sc6 .sc6-calhead{ display:flex; align-items:baseline; justify-content:space-between; margin-bottom:8px; }
  #sc6 .sc6-calmonth{ font-size:30px; font-weight:800; }
  #sc6 .sc6-calsvc{ font-size:21px; color:var(--c-text-dim); font-weight:600; }
  #sc6 .sc6-caldate{ font-size:20px; color:var(--accent); font-weight:700; margin-bottom:24px; }

  #sc6 .sc6-days{ display:flex; gap:14px; margin-bottom:28px; }
  #sc6 .sc6-day{ flex:1; text-align:center; padding:16px 0 18px; border-radius:18px; background:var(--c-card);
    border:1px solid var(--c-line); opacity:0; }
  #sc6 .sc6-day .dw{ font-size:17px; color:var(--c-text-faint); font-weight:600; }
  #sc6 .sc6-day .dn{ font-size:30px; font-weight:800; margin-top:6px; }
  #sc6 .sc6-day.sel{ background:linear-gradient(150deg, rgba(56,189,248,.22), rgba(96,165,250,.12));
    border-color:rgba(56,189,248,.5); }
  #sc6 .sc6-day.sel .dn{ color:var(--accent); }

  #sc6 .sc6-slotlbl{ font-size:21px; font-weight:700; color:var(--c-text-dim); margin-bottom:18px; opacity:0;
    animation:sc6-fade .6s ease 2.4s both; }
  #sc6 .sc6-slots{ display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
  #sc6 .sc6-slot{ position:relative; text-align:center; padding:22px 0; border-radius:18px; font-size:26px; font-weight:700;
    background:rgba(56,189,248,.1); border:1px solid rgba(56,189,248,.32); color:var(--c-sky); opacity:0; overflow:hidden; }
  #sc6 .sc6-slot.busy{ background:var(--c-card); border-color:var(--c-line); color:var(--c-text-faint); text-decoration:line-through; }
  #sc6 .sc6-slot.pick{ animation:sc6-pick 1s cubic-bezier(.16,1,.3,1) 3.0s both; }
  #sc6 .sc6-ripple{ position:absolute; left:50%; top:50%; width:14px; height:14px; border-radius:50%;
    background:rgba(255,255,255,.6); transform:translate(-50%,-50%) scale(0); opacity:0;
    animation:sc6-ripple 1.1s ease-out 3.0s both; }
  #sc6 .sc6-cursor{ position:absolute; left:0; top:0; font-size:42px; opacity:0; filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));
    animation:sc6-cursor 1.3s cubic-bezier(.16,1,.3,1) 2.55s both; z-index:5; pointer-events:none; }

  /* slot reveal stagger */
  #sc6 .sc6-s1{ animation:sc6-pop .55s cubic-bezier(.16,1,.3,1) 2.5s both; }
  #sc6 .sc6-s2{ animation:sc6-pop .55s cubic-bezier(.16,1,.3,1) 2.6s both; }
  #sc6 .sc6-s3{ animation:sc6-pop .55s cubic-bezier(.16,1,.3,1) 2.7s both; }
  #sc6 .sc6-s4{ animation:sc6-pop .55s cubic-bezier(.16,1,.3,1) 2.8s both; }
  #sc6 .sc6-d1{ animation:sc6-pop .5s cubic-bezier(.16,1,.3,1) 2.15s both; }
  #sc6 .sc6-d2{ animation:sc6-pop .5s cubic-bezier(.16,1,.3,1) 2.22s both; }
  #sc6 .sc6-d3{ animation:sc6-pop .5s cubic-bezier(.16,1,.3,1) 2.29s both; }
  #sc6 .sc6-d4{ animation:sc6-pop .5s cubic-bezier(.16,1,.3,1) 2.36s both; }

  /* ---- right rail: confirmation + reminder ---- */
  #sc6 .sc6-confirm{ position:absolute; left:1300px; top:0; width:440px; padding:40px 36px; border-radius:30px;
    background:linear-gradient(160deg, rgba(52,211,153,.16), rgba(20,20,46,.92));
    border:1px solid rgba(52,211,153,.4); box-shadow:0 40px 90px rgba(0,0,0,.5), 0 0 60px rgba(52,211,153,.18);
    backdrop-filter:blur(18px); opacity:0; animation:sc6-card .9s cubic-bezier(.16,1,.3,1) 4.1s both; }
  #sc6 .sc6-check{ width:90px; height:90px; border-radius:50%; margin:0 auto 24px;
    background:linear-gradient(140deg,var(--c-emerald),#10b981); display:grid; place-items:center; font-size:50px; color:#04130d;
    box-shadow:0 0 40px rgba(52,211,153,.5); animation:sc6-checkpop .7s cubic-bezier(.34,1.56,.64,1) 4.45s both; }
  #sc6 .sc6-ctitle{ text-align:center; font-size:32px; font-weight:800; margin-bottom:24px; color:var(--c-emerald); }
  #sc6 .sc6-crow{ display:flex; align-items:center; gap:16px; padding:16px 0; border-top:1px solid var(--c-line); }
  #sc6 .sc6-crow:first-of-type{ border-top:none; }
  #sc6 .sc6-cico{ width:44px; height:44px; border-radius:12px; flex:0 0 44px; display:grid; place-items:center; font-size:22px;
    background:var(--c-card); border:1px solid var(--c-line); }
  #sc6 .sc6-clbl{ font-size:18px; color:var(--c-text-faint); font-weight:600; }
  #sc6 .sc6-cval{ font-size:24px; font-weight:700; margin-top:2px; }

  #sc6 .sc6-toast{ position:absolute; left:1300px; top:430px; width:440px; padding:26px 28px; border-radius:24px;
    display:flex; align-items:center; gap:20px;
    background:linear-gradient(160deg, rgba(56,189,248,.18), rgba(20,20,46,.94));
    border:1px solid rgba(56,189,248,.45); box-shadow:0 30px 70px rgba(0,0,0,.45);
    backdrop-filter:blur(18px); opacity:0; animation:sc6-toast 1s cubic-bezier(.16,1,.3,1) 5.4s both; }
  #sc6 .sc6-bell{ width:60px; height:60px; border-radius:16px; flex:0 0 60px; display:grid; place-items:center; font-size:30px;
    background:rgba(56,189,248,.18); border:1px solid rgba(56,189,248,.4);
    animation:sc6-ring 1.4s ease 5.9s 2 both; }
  #sc6 .sc6-tlbl{ font-size:18px; color:var(--accent); font-weight:700; letter-spacing:.04em; }
  #sc6 .sc6-tval{ font-size:24px; font-weight:700; margin-top:4px; }
  #sc6 .sc6-tpulse{ position:absolute; inset:-1px; border-radius:24px; border:2px solid var(--accent); opacity:0;
    animation:sc6-tpulse 2s ease 5.9s infinite; }

  /* ---- keyframes ---- */
  @keyframes sc6-up{ from{ opacity:0; transform:translateY(34px); } to{ opacity:1; transform:translateY(0); } }
  @keyframes sc6-fade{ from{ opacity:0; } to{ opacity:1; } }
  @keyframes sc6-pop{ from{ opacity:0; transform:translateY(18px) scale(.94); } to{ opacity:1; transform:translateY(0) scale(1); } }
  @keyframes sc6-card{ from{ opacity:0; transform:translateX(40px) scale(.95); } to{ opacity:1; transform:translateX(0) scale(1); } }
  @keyframes sc6-checkpop{ 0%{ transform:scale(0) rotate(-30deg); } 70%{ transform:scale(1.12) rotate(4deg); } 100%{ transform:scale(1) rotate(0); } }
  @keyframes sc6-pick{
    0%{ transform:scale(1); background:rgba(56,189,248,.1); border-color:rgba(56,189,248,.32); color:var(--c-sky); box-shadow:none; }
    35%{ transform:scale(.92); }
    100%{ transform:scale(1.04); background:linear-gradient(140deg,var(--c-sky),var(--c-blue)); border-color:var(--c-sky);
      color:#06121c; box-shadow:0 14px 40px rgba(56,189,248,.55); }
  }
  @keyframes sc6-ripple{ 0%{ transform:translate(-50%,-50%) scale(0); opacity:.7; } 100%{ transform:translate(-50%,-50%) scale(22); opacity:0; } }
  @keyframes sc6-cursor{
    0%{ opacity:0; transform:translate(160px,-40px); }
    25%{ opacity:1; }
    70%{ opacity:1; transform:translate(60px,90px); }
    78%{ transform:translate(56px,86px) scale(.82); }
    88%{ transform:translate(60px,90px) scale(1); }
    100%{ opacity:0; transform:translate(60px,90px); }
  }
  @keyframes sc6-toast{ from{ opacity:0; transform:translateY(40px) scale(.92); } to{ opacity:1; transform:translateY(0) scale(1); } }
  @keyframes sc6-ring{ 0%,100%{ transform:rotate(0); } 20%{ transform:rotate(16deg); } 40%{ transform:rotate(-14deg); } 60%{ transform:rotate(9deg); } 80%{ transform:rotate(-5deg); } }
  @keyframes sc6-tpulse{ 0%{ opacity:.55; transform:scale(1); } 100%{ opacity:0; transform:scale(1.06); } }
  `;

  function mount(root){
    if(!document.getElementById('sc6-style')){
      const s=document.createElement('style'); s.id='sc6-style'; s.textContent=CSS; document.head.appendChild(s);
    }
    root.innerHTML = `
      <div id="sc6">
        <div class="sc6-head">
          <div class="sc6-kicker"><span class="sc6-dot"></span>ДАВУУ ТАЛ 06</div>
          <div class="sc6-title">Цаг захиалга</div>
          <div class="sc6-sub">Үйлчилгээний бизнест — харилцагч чатаар цагаа захиалж, сануулга автоматаар очно.</div>
        </div>

        <div class="sc6-stage">

          <!-- chat -->
          <div class="sc6-phone">
            <div class="sc6-pbar">
              <div class="sc6-avatar">💬</div>
              <div>
                <div class="sc6-pname">Үсчин Болд</div>
                <div class="sc6-pstat">Онлайн</div>
              </div>
            </div>
            <div class="sc6-msgs">
              <div class="sc6-bub in">Сайн байна уу! Маргааш цаг захиалъя 💇</div>
              <div class="sc6-time t1">14:02</div>
              <div class="sc6-bub out">Мэдээж! Боломжтой цагуудаа сонгоно уу 👇</div>
              <div class="sc6-time t2">14:02</div>
            </div>
          </div>

          <!-- calendar -->
          <div class="sc6-cal">
            <div class="sc6-calhead">
              <div class="sc6-calmonth">6-р сар</div>
              <div class="sc6-calsvc">Үсчин Болд</div>
            </div>
            <div class="sc6-caldate">Боломжтой өдрүүд</div>
            <div class="sc6-days">
              <div class="sc6-day sc6-d1"><div class="dw">Дав</div><div class="dn">16</div></div>
              <div class="sc6-day sc6-d2"><div class="dw">Мяг</div><div class="dn">17</div></div>
              <div class="sc6-day sel sc6-d3"><div class="dw">Лха</div><div class="dn">18</div></div>
              <div class="sc6-day sc6-d4"><div class="dw">Пүр</div><div class="dn">19</div></div>
            </div>
            <div class="sc6-slotlbl">6-р сар 18 — сул цагууд</div>
            <div class="sc6-slots">
              <div class="sc6-slot busy sc6-s1">11:00</div>
              <div class="sc6-slot sc6-s2">12:00</div>
              <div class="sc6-slot pick sc6-s3">14:00<span class="sc6-ripple"></span></div>
              <div class="sc6-slot sc6-s4">16:00</div>
            </div>
            <div class="sc6-cursor">👆</div>
          </div>

          <!-- confirmation -->
          <div class="sc6-confirm">
            <div class="sc6-check">✓</div>
            <div class="sc6-ctitle">Цаг баталгаажлаа</div>
            <div class="sc6-crow">
              <div class="sc6-cico">📅</div>
              <div><div class="sc6-clbl">Огноо ба цаг</div><div class="sc6-cval">6-р сар 18, 14:00</div></div>
            </div>
            <div class="sc6-crow">
              <div class="sc6-cico">💈</div>
              <div><div class="sc6-clbl">Үйлчилгээ</div><div class="sc6-cval">Үсчин Болд</div></div>
            </div>
          </div>

          <!-- reminder toast -->
          <div class="sc6-toast">
            <span class="sc6-tpulse"></span>
            <div class="sc6-bell">⏰</div>
            <div>
              <div class="sc6-tlbl">САНУУЛГА</div>
              <div class="sc6-tval">Маргааш 14:00 цаг</div>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  (window.SYNCLY_SCENES = window.SYNCLY_SCENES || []).push({ id:6, key:'booking', title:'Цаг захиалга', durationMs:11000, accent:'var(--c-sky)', mount });
})();
