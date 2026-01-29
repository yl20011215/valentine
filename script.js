// ---------- helpers ----------
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const screens = $$('section.screen');
function showScreen(id){
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  handleNoMount(id);
  // reset letter typing when opening gift 1
  if(id === 'screen-gift-0') startLetter();
}

// ---------- story state ----------
const STATE_KEY = 'tinyUniverseState_v2';
const defaultState = {
  unlocked: 0,        // how many gifts are unlocked (0..4)
  opened: [false,false,false,false],
  tokensRedeemed: {}
};

function loadState(){
  try{
    const raw = localStorage.getItem(STATE_KEY);
    if(!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      opened: Array.isArray(parsed.opened) ? parsed.opened.slice(0,4).concat([false,false,false,false]).slice(0,4) : structuredClone(defaultState.opened),
      tokensRedeemed: parsed.tokensRedeemed || {}
    };
  }catch{ return structuredClone(defaultState); }
}
function saveState(){ localStorage.setItem(STATE_KEY, JSON.stringify(state)); }

let state = loadState();

// ---------- question flow ----------
$('#btn-start').addEventListener('click', () => {
  // Ensure music starts from the very first page (best-effort; browsers require a gesture to unmute).
  unlockMusicWithGesture?.();
  showScreen('screen-question');
});

const noBtn = $('#btn-no');
const noHint = $('#noHint');
let noCount = 0;
let noLastMove = 0;
let noMountedToBody = false;

const questionCard = $('#screen-question .card');
const questionBtnRow = $('#questionBtns');

function handleNoMount(activeScreenId){
  if(!noBtn) return;

  const shouldMount = activeScreenId === 'screen-question';
  if(shouldMount && !noMountedToBody){
    // Move the NO button outside the card so it can dodge around the whole screen
    noBtn.classList.add('runaway-no');
    document.body.appendChild(noBtn);
    placeNoButtonInitial();
    noMountedToBody = true;
  }

  if(!shouldMount && noMountedToBody){
    // Put it back into the card layout
    noBtn.classList.remove('runaway-no');
    noBtn.style.left = '';
    noBtn.style.top = '';
    noBtn.style.transform = '';
    questionBtnRow.appendChild(noBtn);
    noMountedToBody = false;
    noCount = 0;
    noHint.textContent = '';
  }
}

function placeNoButtonInitial(){
  // Start next to the YES button (but still free to move around the whole screen)
  const yes = $('#btn-yes');
  const pad = 18;

  const bw = noBtn.offsetWidth || 90;
  const bh = noBtn.offsetHeight || 44;

  if(yes){
    const r = yes.getBoundingClientRect();
    let x = r.right + 12;
    let y = r.top + (r.height/2) - (bh/2);

    x = Math.min(window.innerWidth - bw - pad, Math.max(pad, x));
    y = Math.min(window.innerHeight - bh - pad, Math.max(70, y)); // keep away from top controls

    noBtn.style.left = x + 'px';
    noBtn.style.top = y + 'px';
    noBtn.style.transform = 'none';
    return;
  }

  // fallback (bottom-right)
  noBtn.style.left = Math.max(pad, window.innerWidth - bw - pad) + 'px';
  noBtn.style.top = Math.max(pad, window.innerHeight - bh - pad) + 'px';
  noBtn.style.transform = 'none';
}

function dodgeNo(ev){
  const now = Date.now();
  if(now - noLastMove < 380) return; // prevent jitter / continuous movement
  noLastMove = now;

  const pad = 18;
  const bw = Math.max(80, noBtn.offsetWidth);
  const bh = Math.max(42, noBtn.offsetHeight);

  const cardRect = questionCard?.getBoundingClientRect?.() || {left:0, top:0, right:0, bottom:0};
  const safeTop = 70; // keep away from top controls

  let x = 0, y = 0;
  // Try a few times to find a spot NOT on the card
  for(let i=0;i<14;i++){
    x = Math.random() * (window.innerWidth - bw - pad*2) + pad;
    y = Math.random() * (window.innerHeight - bh - pad*2 - safeTop) + pad + safeTop;

    const withinCard = (
      x < cardRect.right - 10 &&
      x + bw > cardRect.left + 10 &&
      y < cardRect.bottom - 10 &&
      y + bh > cardRect.top + 10
    );
    if(!withinCard) break;
  }

  // If the pointer caused the move, ensure we don't land under the cursor again
  if(ev && 'clientX' in ev && 'clientY' in ev){
    const dx = Math.abs(ev.clientX - x);
    const dy = Math.abs(ev.clientY - y);
    if(dx < bw && dy < bh){
      x = Math.min(window.innerWidth - bw - pad, x + bw + 40);
      y = Math.min(window.innerHeight - bh - pad, y + bh + 30);
    }
  }

  noBtn.style.left = x + 'px';
  noBtn.style.top = y + 'px';
  noBtn.style.transform = 'none';

  noCount++;
  const lines = [
    "Try again… but with the other answer 💗",
    "Oops—my heart says ‘Yes’ 😊",
    "Hehe… not that one 🥺",
    "I’ll wait right here until you pick ‘Yes’ 💞"
  ];
  noHint.textContent = lines[Math.min(noCount-1, lines.length-1)];
}
// Make NO run away across the screen (but not continuously)
noBtn.addEventListener('pointerenter', dodgeNo);
noBtn.addEventListener('focus', dodgeNo);
noBtn.addEventListener('click', dodgeNo);

window.addEventListener('resize', () => {
  if(noMountedToBody) placeNoButtonInitial();
});

$('#btn-yes').addEventListener('click', () => {
  unlockMusicWithGesture?.();
  state.unlocked = Math.max(state.unlocked, 1);
  saveState();
  refreshHub();
  showScreen('screen-hub');
});

const replayBtn = document.getElementById('btn-replay');
if (replayBtn){
  replayBtn.addEventListener('click', () => {
    // keep state; just replay from start screen
    showScreen('screen-start');
  });
}

// ---------- hub tiles (4 squares + locked highlight) ----------
const unlockedPill = $('#unlockedPill');
const openedText = $('#openedText');
const progressFill = $('#progressFill');

function refreshHub(){
  const openedCount = state.opened.filter(Boolean).length;
  openedText.textContent = `${openedCount}/4 opened`;
  progressFill.style.width = `${(openedCount/4)*100}%`;
  unlockedPill.textContent = `Unlocked: ${Math.max(1, state.unlocked)}`;

  $$('.gift-tile', $('#giftTiles')).forEach(btn => {
    const idx = Number(btn.dataset.gift);
    const isUnlocked = idx < state.unlocked;
    const isOpened = !!state.opened[idx];

    btn.classList.toggle('locked', !isUnlocked);
    btn.classList.toggle('opened', isOpened);
    btn.setAttribute('aria-label', isUnlocked ? `Open ${btn.querySelector('.tile-title')?.textContent || 'gift'}` : `Locked ${btn.querySelector('.tile-title')?.textContent || 'gift'}`);
  });
}

$('#giftTiles').addEventListener('click', (e) => {
  const btn = e.target.closest('.gift-tile');
  if(!btn) return;
  const idx = Number(btn.dataset.gift);

  if(idx >= state.unlocked){
    btn.classList.remove('shake');
    void btn.offsetWidth;
    btn.classList.add('shake');
    // tiny toast-ish hint
    flashHint("Open the previous gift first 💗");
    return;
  }

  showScreen(`screen-gift-${idx}`);
});

function flashHint(text){
  const el = document.getElementById('secretHint');
  if(!el) return; // hint removed in the cleaner hub layout
  const prev = el.textContent;
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(flashHint._t);
  flashHint._t = setTimeout(() => {
    el.textContent = prev;
  }, 1600);
}

// secret tap...tap...tap
let secretClicks = 0;
const secretHintEl = document.getElementById('secretHint');
if (secretHintEl){
  secretHintEl.addEventListener('click', () => {
    secretClicks++;
    if(secretClicks >= 5){
      secretClicks = 0;
      burstHearts(24);
      flashHint("Surprise unlocked: extra hearts! 💞");
    }
  });
}

// ---------- gift actions ----------
function markOpened(idx){
  state.opened[idx] = true;
  saveState();
  refreshHub();
}

function unlockNext(idx){
  // unlock idx+1
  state.unlocked = Math.max(state.unlocked, idx + 2);
  markOpened(idx);
}

function backToHub(){
  refreshHub();
  showScreen('screen-hub');
}

// Buttons with data-action
$$('[data-action]').forEach(btn => {
  btn.addEventListener('click', () => {
    const screen = btn.closest('.screen');
    const idx = screen ? Number(screen.id.split('-').pop()) : null;
    const action = btn.dataset.action;

    if(action === 'backHub') return backToHub();

    if(action === 'nextGift'){
      if(Number.isFinite(idx)){
        unlockNext(idx);
        backToHub();
      }
      return;
    }

    if(action === 'finish'){
      if(Number.isFinite(idx)){
        markOpened(idx);
        state.unlocked = 4; // all unlocked
        saveState();
      }
      showScreen('screen-final');
      return;
    }

    if(action === 'downloadLetter') return downloadLetter();
  });
});

// ---------- Love letter (typewriter + colourful) ----------
const lead = "I made this little page because I needed a place where I could say it properly: you are my favorite part of every day.";
let typingTimer = null;
function startLetter(){
  const el = $('#typewriter');
  const sig = $('#signature');
  el.textContent = '';
  sig.classList.remove('show');
  let i = 0;

  clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    el.textContent += lead.charAt(i);
    i++;
    if(i >= lead.length){
      clearInterval(typingTimer);
      sig.classList.add('show');
    }
  }, 26);
}

function downloadLetter(){
  const text = [
    "Dearest,",
    "",
    lead,
    "",
    "If the world ever feels too loud, come closer — I’ll be your calm.",
    "If your heart ever feels heavy, let me hold it with you.",
    "",
    "I love you in the soft moments, the silly moments, and all the forever moments.",
    "",
    "Yours, Always. ♡"
  ].join("\n");

  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'love-note.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
  burstHearts(12);
}

// ---------- Tokens ----------
const tokenData = [
  { id:'date', title:'A Date Night', desc:'I plan it. You just show up and be cute.', icon:'🍿' },
  { id:'hug', title:'A Long Hug', desc:'No words. Just warmth. As long as you need.', icon:'🫂' },
  { id:'dessert', title:'Sweet Treat', desc:'You choose the dessert. I’ll get it.', icon:'🍰' },
  { id:'massage', title:'Cozy Massage', desc:'Soft music. Comfy vibes. Your favorite.', icon:'💆‍♀️' },
  { id:'picnic', title:'Mini Picnic', desc:'A blanket, snacks, and you. Perfect.', icon:'🧺' },
  { id:'movie', title:'Movie + Cuddles', desc:'Your movie pick. My shoulder guaranteed.', icon:'🎬' }
];

function renderTokens(){
  const wrap = $('#tokens');
  if(!wrap) return;
  wrap.innerHTML = '';

  tokenData.forEach(t => {
    const redeemed = !!state.tokensRedeemed[t.id];
    const card = document.createElement('div');
    card.className = 'token' + (redeemed ? ' redeemed' : '');

    card.innerHTML = `
      <div class="token-row">
        <b>${t.icon} ${t.title}</b>
        <button class="redeem" type="button">${redeemed ? 'Redeemed ✓' : 'Redeem'}</button>
      </div>
      <p>${t.desc}</p>
    `;

    card.querySelector('.redeem').addEventListener('click', () => {
      state.tokensRedeemed[t.id] = !state.tokensRedeemed[t.id];
      saveState();
      renderTokens();
      burstHearts(10);
    });

    wrap.appendChild(card);
  });
}

// ---------- Final actions ----------
// (Final page has no buttons now; video is optional)

// ---------- Music ----------
const music = $('#bgMusic');
let musicUnlocked = false;
let fadeTimer = null;

function fadeVolumeTo(target = 0.65, ms = 900){
  if(!music) return;
  clearInterval(fadeTimer);
  const start = music.volume;
  const t0 = performance.now();
  fadeTimer = setInterval(() => {
    const t = Math.min(1, (performance.now() - t0) / ms);
    // ease-out
    const eased = 1 - Math.pow(1 - t, 3);
    music.volume = start + (target - start) * eased;
    if(t >= 1){
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }, 16);
}

async function tryStartMusicMuted(){
  if(!music) return;
  // Start from the very first screen (autoplay muted). Then unmute + fade in on first interaction.
  music.muted = true;
  music.volume = 0;
  try{ await music.play(); }catch{}
}

async function unlockMusicWithGesture(){
  if(!music || musicUnlocked) return;
  try{
    music.muted = false;
    if(music.paused) await music.play();
    // smooth fade-in
    music.volume = Math.min(music.volume, 0.08);
    fadeVolumeTo(0.65, 900);
    musicUnlocked = true;
  }catch{}
}

// best-effort: begin muted immediately, then unmute on first user gesture
tryStartMusicMuted();
window.addEventListener('pointerdown', unlockMusicWithGesture, {once:true, capture:true});
window.addEventListener('keydown', unlockMusicWithGesture, {once:true, capture:true});

$('#musicBtn').addEventListener('click', async () => {
  if(!music) return;
  try{
    // Clicking the music button counts as a gesture, so we can safely unmute.
    if(music.paused){
      music.muted = false;
      await music.play();
      fadeVolumeTo(0.65, 600);
      flashHint('Music on ♪');
    } else {
      music.pause();
      flashHint('Music off');
    }
  }catch{
    flashHint('Music unavailable');
  }
});

// Extra sparkle button
$('#sparkleBtn').addEventListener('click', () => burstHearts(18));

// ---------- Hearts background (canvas = romantic hearts, not bubbles) ----------
const canvas = $('#heartCanvas');
const ctx = canvas.getContext('2d');

function resize(){
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize', resize);
resize();

function rand(min,max){ return Math.random()*(max-min)+min; }

const hearts = [];
function spawnHeart(x = rand(0, window.innerWidth), y = window.innerHeight + 20, big=false){
  hearts.push({
    x,
    y,
    s: big ? rand(18, 30) : rand(8, 18),
    vy: rand(0.35, 0.9),
    vx: rand(-0.15, 0.15),
    rot: rand(0, Math.PI*2),
    vr: rand(-0.015, 0.015),
    a: rand(0.16, 0.34)
  });
}

// draw heart path
function drawHeart(x,y,size,rot,alpha){
  ctx.save();
  ctx.translate(x,y);
  ctx.rotate(rot);
  ctx.scale(size/16, size/16);
  ctx.globalAlpha = alpha;

  // soft glow
  ctx.shadowBlur = 18;
  ctx.shadowColor = 'rgba(255,77,141,.25)';

  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(0, -2, -10, -2, -10, 6);
  ctx.bezierCurveTo(-10, 14, 0, 18, 0, 24);
  ctx.bezierCurveTo(0, 18, 10, 14, 10, 6);
  ctx.bezierCurveTo(10, -2, 0, -2, 0, 6);

  const grad = ctx.createLinearGradient(-10, 0, 10, 24);
  grad.addColorStop(0, 'rgba(255,77,141,.9)');
  grad.addColorStop(1, 'rgba(255,159,179,.55)');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.restore();
}

function tick(){
  ctx.clearRect(0,0,window.innerWidth, window.innerHeight);

  // keep a gentle stream of hearts
  if(hearts.length < 90 && Math.random() < 0.9) spawnHeart();

  for(let i=hearts.length-1;i>=0;i--){
    const h = hearts[i];
    h.x += h.vx;
    h.y -= h.vy * 2.2;
    h.rot += h.vr;
    h.a -= 0.0009;

    drawHeart(h.x, h.y, h.s, h.rot, Math.max(0, h.a));

    if(h.y < -60 || h.a <= 0) hearts.splice(i,1);
  }

  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

function burstHearts(n=18){
  const cx = window.innerWidth/2;
  const cy = window.innerHeight/2;
  for(let i=0;i<n;i++){
    const x = cx + rand(-220, 220);
    const y = cy + rand(-120, 220);
    spawnHeart(x,y,true);
  }
}

// tap background -> hearts
window.addEventListener('pointerdown', (e) => {
  // avoid when clicking buttons
  if(e.target.closest('button')) return;
  spawnHeart(e.clientX, e.clientY + 40, true);
});

// ---------- init ----------
refreshHub();
renderTokens();

// start screen always
showScreen('screen-start');
