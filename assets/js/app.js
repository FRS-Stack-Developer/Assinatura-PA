/* =========================================================================
   Gerador de Assinatura PMMG — lógica da aplicação
   Depende de: assets/js/shields.js (define a constante global SHIELDS)
   ========================================================================= */
const BG = "assets/img/fundo-classico.png";

const state = {
  layout: 'classico',
  shield: '8cia',
  custom: null,
  theme: 'escuro',
  shscale: 1,
  expmode: 'padrao',             // tamanho do arquivo exportado (fixo, ver EXPORT_MODES)
  nome: 'NOME COMPLETO, (POSTO/GRADUAÇÃO) PM',
  funcao: 'LOCAL/FUNÇÃO',
  end1: 'RUA/Nº/BAIRRO/CIDADE-MG',
  end2: 'E-mail: DIGITE SEU EMAIL INSTITUCIONAL OU CAIXA VINCULADA',
  end3: 'Telefone: DIGITE SEU TELEFONE.'
};

// ---------- persistência da última edição ----------
const STORE_KEY = 'assinatura_pmmg_v7';
// Cor e alinhamento nao sao mais escolhidos pelo usuario (padronizacao da
// assinatura): ficam fixos nos valores definidos em 'state' e por isso saem
// da lista do que e salvo no navegador.
const SAVE_KEYS = ['layout','shield','theme',
                   'shscale','nome','funcao','end1','end2','end3'];
const DEFAULTS = {}; SAVE_KEYS.forEach(k => DEFAULTS[k] = state[k]);

state.customSrc = null;                   // dataURL do escudo enviado
state.uplname   = 'nenhum arquivo';

let booted = false, dirty = false, savedAt = null;

function saveMsg(txt, cls){
  const el = document.getElementById('savemsg');
  if(!el) return;
  el.textContent = txt;
  el.className = 'savemsg' + (cls ? ' ' + cls : '');
}
function fmtWhen(ts){
  try{ return new Date(ts).toLocaleString('pt-BR'); }catch(e){ return ''; }
}
function updateSaveMsg(){
  if(dirty) saveMsg('\u25CF Alterações não salvas \u2014 clique em Salvar alterações (ou Ctrl+S).','warn');
  else if(savedAt) saveMsg('\u2713 Edição salva em ' + fmtWhen(savedAt) + ' \u2014 será carregada quando o arquivo for aberto de novo.','ok');
  else saveMsg('Nenhuma edição salva ainda.','');
}
function markDirty(){
  if(!booted) return;
  dirty = true;
  updateSaveMsg();
}
function collectSave(withImages){
  const o = {};
  SAVE_KEYS.forEach(k => o[k] = state[k]);
  o.savedAt = Date.now();
  if(withImages){
    o.customSrc = state.customSrc;
    o.uplname   = state.uplname;
  }
  return o;
}
function saveState(){
  let dados = collectSave(true), parcial = false;
  try{
    try{
      localStorage.setItem(STORE_KEY, JSON.stringify(dados));
    }catch(e){                        // estourou a cota: salva sem as imagens enviadas
      dados = collectSave(false); parcial = true;
      localStorage.setItem(STORE_KEY, JSON.stringify(dados));
    }
  }catch(e){
    saveMsg('\u2715 Não foi possível salvar: o navegador bloqueou o armazenamento local deste arquivo.','err');
    return false;
  }
  savedAt = dados.savedAt; dirty = false;
  if(parcial) saveMsg('\u2713 Textos e ajustes salvos em ' + fmtWhen(savedAt) + '. As imagens enviadas eram grandes demais e não foram guardadas.','warn');
  else updateSaveMsg();
  return true;
}
async function restoreState(){
  let raw = null;
  try{ raw = localStorage.getItem(STORE_KEY); }catch(e){ return null; }
  if(!raw) return null;
  let d;
  try{ d = JSON.parse(raw); }catch(e){ return null; }
  SAVE_KEYS.forEach(k => { if(d[k] !== undefined && d[k] !== null) state[k] = d[k]; });
  if(d.customSrc){
    state.customSrc = d.customSrc;
    state.uplname   = d.uplname || 'escudo salvo';
    state.custom    = await loadImg(d.customSrc);
  }
  savedAt = d.savedAt || null;
  return d;
}
function resetState(){
  if(!confirm('Restaurar os valores padrão e apagar a edição salva?')) return;
  SAVE_KEYS.forEach(k => state[k] = DEFAULTS[k]);
  state.custom = state.customSrc = null;
  state.uplname = 'nenhum arquivo';
  try{ localStorage.removeItem(STORE_KEY); }catch(e){}
  savedAt = null;
  syncUI(); applyTheme(); draw();
  dirty = false; updateSaveMsg();
}
// reflete o estado atual nos controles da tela
function syncUI(){
  [['theme','theme']].forEach(function(par){
    const w = document.getElementById(par[0]); if(!w) return;
    [...w.children].forEach(b => b.classList.toggle('on', b.dataset.v === state[par[1]]));
  });
  const lc = document.getElementById('layouts');
  if(lc) [...lc.children].forEach(b => b.classList.toggle('on', b.dataset.k === state.layout));
  const sel = document.getElementById('shield'); if(sel) sel.value = state.shield;
  ['nome','funcao','end1','end2','end3'].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = state[id];
  });
  const ss = document.getElementById('shscale');
  if(ss){
    ss.value = Math.round(state.shscale * 100);
    document.getElementById('shscalev').textContent = ss.value + '%';
  }
  const ex = document.getElementById('expsize');
  if(ex) [...ex.children].forEach(b =>
    b.classList.toggle('on', b.dataset.v === state.expmode));
  const un = document.getElementById('uplname');
  if(un) un.textContent = state.uplname;
}

// ---------- tela inicial: escolha da unidade ----------
const UNIT_KEY = 'assinatura_pmmg_unidade';   // {shield, skip}
let welcomePick = null, welcomeOk = false;

function unitPref(){
  try{ return JSON.parse(localStorage.getItem(UNIT_KEY) || 'null'); }catch(e){ return null; }
}
function rememberUnit(id, skip){
  const atual = unitPref() || {};
  if(skip === undefined) skip = !!atual.skip;
  try{ localStorage.setItem(UNIT_KEY, JSON.stringify({shield:id, skip:!!skip})); }catch(e){}
}
function unitLabel(id){
  const u = SHIELDS.find(x => x.id === id);
  return u ? u.label : '';
}
function buildWelcome(){
  const box = document.getElementById('wgroups');
  const grupos = {};
  SHIELDS.forEach(u => { (grupos[u.group] = grupos[u.group] || []).push(u); });
  Object.keys(grupos).forEach(g => {
    const sec = document.createElement('div'); sec.className = 'wsec';
    const tit = document.createElement('div'); tit.className = 'wsec-t'; tit.textContent = g;
    sec.appendChild(tit);
    const grid = document.createElement('div'); grid.className = 'wgrid';
    grupos[g].forEach(u => {
      const b = document.createElement('button');
      b.className = 'wopt'; b.type = 'button'; b.dataset.id = u.id;
      const im = document.createElement('img'); im.alt = u.label; im.src = u.src;
      const sp = document.createElement('span'); sp.textContent = u.label;
      b.appendChild(im); b.appendChild(sp);
      b.onclick = () => pickUnit(u.id);
      b.ondblclick = () => { pickUnit(u.id); enterApp(); };
      grid.appendChild(b);
    });
    sec.appendChild(grid); box.appendChild(sec);
  });
  document.getElementById('wgo').onclick = enterApp;
  document.addEventListener('keydown', e => {
    const w = document.getElementById('welcome');
    if(!w.hidden && e.key === 'Enter' && welcomeOk){ e.preventDefault(); enterApp(); }
  });
  const pref = unitPref();
  document.getElementById('wremember').checked = !!(pref && pref.skip);
  pickUnit(state.shield);
}
function pickUnit(id){
  welcomePick = id;
  [...document.querySelectorAll('#wgroups .wopt')].forEach(b => b.classList.toggle('on', b.dataset.id === id));
  const go = document.getElementById('wgo');
  if(welcomeOk) go.textContent = 'Continuar com ' + unitLabel(id) + '  \u2192';
}
function welcomeReady(){                 // libera o botão quando tudo terminou de carregar
  welcomeOk = true;
  document.getElementById('wgo').disabled = false;
  pickUnit(welcomePick || state.shield);
}
function showWelcome(){
  const w = document.getElementById('welcome');
  w.hidden = false; document.body.classList.add('welcome-open');
  pickUnit(state.shield);
  w.scrollTop = 0;
}
function hideWelcome(){
  document.getElementById('welcome').hidden = true;
  document.body.classList.remove('welcome-open');
}
function enterApp(){
  const trocou = welcomePick && welcomePick !== state.shield;
  if(welcomePick){
    state.shield = welcomePick;
    if(trocou){                          // unidade nova: descarta escudo enviado manualmente
      state.custom = null; state.customSrc = null; state.uplname = 'nenhum arquivo';
    }
  }
  rememberUnit(state.shield, document.getElementById('wremember').checked);
  hideWelcome();
  syncUI(); draw();
  if(!trocou){ dirty = false; updateSaveMsg(); }
}

// 100% da exportacao = 70% do tamanho em que a assinatura e desenhada
const EXPORT_BASE = 0.70;

// ---------- tamanho de exportacao ----------
// scale -> fator aplicado sobre o tamanho do layout (junto com EXPORT_BASE).
// Historico: 0.50 = tamanho original; 0.35 e 0.245 foram testados e ficaram
// grande/pequeno demais; 0.40 = 20% menor que o original (atual).
// O recorte e automatico (ver frameOf): a imagem termina logo em volta do
// conteudo, com a folga PAD.
// Para oferecer outro tamanho no futuro, basta acrescentar uma entrada aqui e
// um grupo de botoes com id="expsize" no index.html (um botao por entrada,
// com data-v igual a chave); o resto do codigo ja lida com isso.
const EXPORT_MODES = {
  padrao: { label: 'Padrão', scale: 0.40 }
};
function expMode(){ return EXPORT_MODES[state.expmode] || EXPORT_MODES.padrao; }

// ---------- recorte automatico ----------
// Cada layout desenha nas suas coordenadas de sempre (LAYOUTS: w x h), que
// tambem limitam o texto: se passar da largura, a fonte e reduzida (fitRatio).
// frame(W,H) devolve o retangulo {x, y, w, h} que vai para a imagem: o
// conteudo atual (escudo, textos e filetes) com a folga PAD em volta. Fundo e
// faixas decorativas sao desenhados sobre esse retangulo.
const PAD = 32;
function addrs(){ return [state.end1, state.end2, state.end3]; }
function shieldRect(img, boxX, boxY, boxW, boxH, align){
  if(!img) return null;
  const s = Math.min(boxW/img.width, boxH/img.height);
  const w = img.width*s, h = img.height*s;
  let x = boxX;
  if(align==='center') x = boxX + (boxW-w)/2;
  else if(align==='right') x = boxX + (boxW-w);
  return { x, y: boxY + (boxH-h)/2, w, h };
}
// caixa ocupada pelas linhas [texto, fonte, x, baseline, alinhamento, cor]
function textBox(lines){
  const b = { x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity };
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  lines.forEach(([t, font, x, y, align]) => {
    if(!t) return;
    ctx.font = font;
    const m = ctx.measureText(t);
    const w = Math.max(m.width, m.actualBoundingBoxRight || 0);
    const left = align === 'center' ? x - w/2 : x;
    b.x0 = Math.min(b.x0, left);  b.x1 = Math.max(b.x1, left + w);
    b.y0 = Math.min(b.y0, y - m.actualBoundingBoxAscent);
    b.y1 = Math.max(b.y1, y + m.actualBoundingBoxDescent);
  });
  return b;
}
function addRect(b, r){
  if(!r) return b;
  b.x0 = Math.min(b.x0, r.x);        b.y0 = Math.min(b.y0, r.y);
  b.x1 = Math.max(b.x1, r.x + r.w);  b.y1 = Math.max(b.y1, r.y + r.h);
  return b;
}
function frameOf(L){
  const f = L.frame ? L.frame(L.w, L.h) : { x:0, y:0, w:L.w, h:L.h };
  const x = Math.floor(f.x), y = Math.floor(f.y);
  return { x, y, w: Math.max(1, Math.ceil(f.x + f.w) - x), h: Math.max(1, Math.ceil(f.y + f.h) - y) };
}
function expSize(L){
  const F = frameOf(L), k = expMode().scale * EXPORT_BASE;
  return { w: Math.max(1, Math.round(F.w * k)), h: Math.max(1, Math.round(F.h * k)) };
}

// fontes de cada modelo (usadas no desenho e no calculo da largura)
const FONT = {
  classico: { N:'italic 600 62px Rawline, sans-serif', F:'italic 500 52px Rawline, sans-serif',
              A:'italic 400 43px Rawline, sans-serif' },
  clara:    { N:'700 60px Rawline, sans-serif', F:'italic 500 48px Rawline, sans-serif',
              A:'400 42px Rawline, sans-serif' },
  central:  { N:'italic 600 60px Rawline, sans-serif', F:'italic 500 48px Rawline, sans-serif',
              A:'400 40px Rawline, sans-serif' }
};

const images = {};       // id -> HTMLImageElement
let bgImg = null;

function loadImg(src){return new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src;});}

const cv = document.getElementById('cv');
let ctx = cv.getContext('2d');   // redirecionado durante a exportação

// ---------- layout definitions ----------
// w x h = coordenadas do desenho (e limite para o texto); frame = recorte.
const LAYOUTS = {
  classico: { w:2016, h:544, label:'Clássico', render:renderClassico, frame:frameClassico },
  clara:    { w:2016, h:520, label:'Faixa clara', render:renderClara, frame:frameClara },
  central:  { w:1500, h:820, label:'Centralizado', render:renderCentral, frame:frameCentral }
};

// ---------- ajuste automatico de texto ----------
// Impede que nome/funcao/endereco sejam cortados quando passam da largura
// disponivel: mede as linhas do bloco e reduz a fonte do bloco inteiro pelo
// mesmo fator, preservando a hierarquia visual entre as linhas.
function fitRatio(lines, maxW){
  let r = 1;
  if(!(maxW > 0)) return r;
  lines.forEach(([t, font]) => {
    if(!t) return;
    ctx.font = font;
    const w = ctx.measureText(t).width;
    if(w > maxW) r = Math.min(r, maxW / w);
  });
  return r;
}
function fitFont(font, r){
  if(r >= 1) return font;
  return font.replace(/(\d+(?:\.\d+)?)px/, (m, px) => Math.max(8, +px * r).toFixed(1) + 'px');
}


function curShieldImg(){
  if(state.custom) return state.custom;
  return images[state.shield] || null;
}

// cores fixas do texto da assinatura
const INK = {name:'#141414', sub:'#3a352b', addr:'#26231d'};
function inks(){ return INK; }
function applyTheme(){
  if(state.theme==='escuro') document.body.removeAttribute('data-theme');
  else document.body.dataset.theme = state.theme;
  markDirty();
}
// desenha escudo e linhas de texto calculados por xxxGeom()
function drawGeom(g){
  const c = inks(), img = curShieldImg();
  if(g.shield && img) ctx.drawImage(img, g.shield.x, g.shield.y, g.shield.w, g.shield.h);
  ctx.textBaseline = 'alphabetic';
  g.lines.forEach(([t, font, x, y, align, role]) => {
    if(!t) return;
    ctx.textAlign = align; ctx.font = font; ctx.fillStyle = c[role];
    ctx.fillText(t, x, y);
  });
}

// --- Classico: fundo com listras; recorta so a direita (cima, baixo e
// esquerda fazem parte do desenho do fundo)
function classicoGeom(W, H){
  const { N, F, A } = FONT.classico, sc = state.shscale, ax = 430, ay = 292, lh = 57;
  const rN = fitRatio([[state.nome, N], [state.funcao, F]], W-62-24);
  const rA = fitRatio(addrs().map(t => [t, A]), W-ax-24);
  const fN = fitFont(N, rN), fF = fitFont(F, rN), fA = fitFont(A, rA);
  return {
    shield: shieldRect(curShieldImg(), 34, H*0.30, 360*sc, (H*0.66)*sc, 'left'),
    lines: [[state.nome, fN, 60, 92, 'left', 'name'], [state.funcao, fF, 62, 156, 'left', 'sub'],
            [state.end1, fA, ax, ay, 'left', 'addr'], [state.end2, fA, ax, ay+lh, 'left', 'addr'],
            [state.end3, fA, ax, ay+lh*2, 'left', 'addr']]
  };
}
function frameClassico(W, H){
  const b = textBox(classicoGeom(W, H).lines);
  const right = isFinite(b.x1) ? b.x1 + 60 : W;     // 60 = mesma margem do nome a esquerda
  return { x:0, y:0, w: Math.min(W, Math.max(1180, right)), h:H };   // listras terminam em x=1104
}
function renderClassico(W, H, Fr){
  // fundo na largura original, recortado pelo frame (as listras nao deformam)
  if(bgImg) ctx.drawImage(bgImg, 0, 0, W, H);
  else { ctx.fillStyle = '#B2A582'; ctx.fillRect(Fr.x, Fr.y, Fr.w, Fr.h); }
  drawGeom(classicoGeom(W, H));
}

// --- Faixa clara: recorte justo nos quatro lados, faixa dourada embaixo
const BAR = 14;
function claraGeom(W, H){
  const { N, F, A } = FONT.clara, sc = state.shscale;
  const shield = shieldRect(curShieldImg(), 40, H*0.12, 340*sc, (H*0.74)*sc, 'left');
  const sb = shield || { x:40, y:H*0.12, w:0, h:0 };
  const dx = Math.max(sb.x + sb.w + 40, 420), tx = dx + 40, ay = 308, lh = 60;
  const rN = fitRatio([[state.nome, N], [state.funcao, F]], W-tx-40);
  const rA = fitRatio(addrs().map(t => [t, A]), W-tx-40);
  const fN = fitFont(N, rN), fF = fitFont(F, rN), fA = fitFont(A, rA);
  return {
    shield, dx, div: [H*0.20, H*0.80],
    lines: [[state.nome, fN, tx, 150, 'left', 'name'], [state.funcao, fF, tx, 214, 'left', 'sub'],
            [state.end1, fA, tx, ay, 'left', 'addr'], [state.end2, fA, tx, ay+lh, 'left', 'addr'],
            [state.end3, fA, tx, ay+lh*2, 'left', 'addr']]
  };
}
function frameClara(W, H){
  const g = claraGeom(W, H), b = textBox(g.lines);
  addRect(b, g.shield);
  addRect(b, { x: g.dx-2, y: g.div[0], w: 4, h: g.div[1]-g.div[0] });
  return { x: b.x0-PAD, y: b.y0-PAD, w: b.x1-b.x0 + 2*PAD, h: b.y1-b.y0 + 2*PAD + BAR };
}
function renderClara(W, H, Fr){
  ctx.fillStyle = '#F1EDE3'; ctx.fillRect(Fr.x, Fr.y, Fr.w, Fr.h);
  ctx.fillStyle = '#A8935B'; ctx.fillRect(Fr.x, Fr.y + Fr.h - BAR, Fr.w, BAR);
  const g = claraGeom(W, H);
  ctx.strokeStyle = '#A8935B'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(g.dx, g.div[0]); ctx.lineTo(g.dx, g.div[1]); ctx.stroke();
  drawGeom(g);
}

// --- Centralizado: recorte justo nos quatro lados, simetrico ao centro
function centralGeom(W, H){
  const { N, F, A } = FONT.central, sc = state.shscale, cx = W/2, ay = 648, lh = 58;
  const rN = fitRatio([[state.nome, N], [state.funcao, F]], W-180);
  const rA = fitRatio(addrs().map(t => [t, A]), W-180);
  const fN = fitFont(N, rN), fF = fitFont(F, rN), fA = fitFont(A, rA);
  return {
    shield: shieldRect(curShieldImg(), cx-190*sc, 40, 380*sc, 360*sc, 'center'), cx, rule: 576,
    lines: [[state.nome, fN, cx, 470, 'center', 'name'], [state.funcao, fF, cx, 534, 'center', 'sub'],
            [state.end1, fA, cx, ay, 'center', 'addr'], [state.end2, fA, cx, ay+lh, 'center', 'addr'],
            [state.end3, fA, cx, ay+lh*2, 'center', 'addr']]
  };
}
function frameCentral(W, H){
  const g = centralGeom(W, H), b = textBox(g.lines);
  addRect(b, g.shield);
  addRect(b, { x: g.cx-260, y: g.rule-2, w: 520, h: 4 });
  const half = Math.max(g.cx - b.x0, b.x1 - g.cx) + PAD;
  return { x: g.cx-half, y: b.y0-PAD, w: 2*half, h: b.y1-b.y0 + 2*PAD };
}
function renderCentral(W, H, Fr){
  ctx.fillStyle = '#ffffff'; ctx.fillRect(Fr.x, Fr.y, Fr.w, Fr.h);
  const g = centralGeom(W, H);
  ctx.strokeStyle = '#A8935B'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(g.cx-260, g.rule); ctx.lineTo(g.cx+260, g.rule); ctx.stroke();
  drawGeom(g);
}

function draw(){
  const L = LAYOUTS[state.layout], F = frameOf(L);
  cv.width = F.w; cv.height = F.h;
  ctx.setTransform(1, 0, 0, 1, -F.x, -F.y);
  L.render(L.w, L.h, F);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const e = expSize(L);
  document.getElementById('cap').textContent =
    L.label + ': ' + e.w + '×' + e.h + ' px na tela';
  markDirty();
}

// ---------- UI ----------
function buildUI(){
  // layouts
  const lc = document.getElementById('layouts');
  Object.keys(LAYOUTS).forEach(k=>{
    const b=document.createElement('button');
    b.textContent=LAYOUTS[k].label; b.dataset.k=k;
    if(k===state.layout) b.classList.add('on');
    b.onclick=()=>{state.layout=k; [...lc.children].forEach(c=>c.classList.toggle('on',c.dataset.k===k)); draw();};
    lc.appendChild(b);
  });
  // shields grouped
  const sel=document.getElementById('shield');
  const groups={};
  SHIELDS.forEach(s=>{(groups[s.group]=groups[s.group]||[]).push(s);});
  Object.keys(groups).forEach(g=>{
    const og=document.createElement('optgroup'); og.label=g;
    groups[g].forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.label;if(s.id===state.shield)o.selected=true;og.appendChild(o);});
    sel.appendChild(og);
  });
  sel.onchange=()=>{state.shield=sel.value; state.custom=null; state.customSrc=null;
    state.uplname='nenhum arquivo'; document.getElementById('uplname').textContent=state.uplname;
    rememberUnit(state.shield); draw();};
  document.getElementById('chgunit').onclick=()=>showWelcome();
  // upload
  document.getElementById('upl').onchange=e=>{
    const f=e.target.files[0]; if(!f) return;
    state.uplname=f.name;
    document.getElementById('uplname').textContent=f.name;
    const r=new FileReader();
    r.onload=ev=>{ state.customSrc=ev.target.result; loadImg(ev.target.result).then(im=>{state.custom=im; draw();}); };
    r.readAsDataURL(f);
  };
  // generic button-group toggle
  function toggle(id,key,after){
    const w=document.getElementById(id); if(!w) return;
    [...w.children].forEach(b=>{ b.onclick=()=>{
      state[key]=b.dataset.v;
      [...w.children].forEach(x=>x.classList.toggle('on',x===b));
      (after||draw)();
    };});
  }
  toggle('theme','theme',applyTheme);
  // text fields
  const bind=(id)=>{const el=document.getElementById(id); el.value=state[id]; el.oninput=()=>{state[id]=el.value; draw();};};
  ['nome','funcao','end1','end2','end3'].forEach(bind);
  // shield scale
  const ss=document.getElementById('shscale');
  ss.oninput=()=>{state.shscale=ss.value/100; document.getElementById('shscalev').textContent=ss.value+'%'; draw();};
  // tamanho do arquivo exportado
  const ex=document.getElementById('expsize');
  if(ex) [...ex.children].forEach(b=>{ b.onclick=()=>{
    state.expmode = b.dataset.v;
    [...ex.children].forEach(x=>x.classList.toggle('on', x===b));
    draw();
  };});
  // export
  document.getElementById('savecfg').onclick=()=>saveState();
  document.getElementById('resetcfg').onclick=()=>resetState();
  document.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey) && (e.key==='s'||e.key==='S')){ e.preventDefault(); saveState(); }
  });
  document.getElementById('dljpg').onclick=()=>download('image/jpeg','jpg',0.98);
  document.getElementById('dlpng').onclick=()=>download('image/png','png');
}

// Canvas final: a assinatura é REDESENHADA na resolução de saída
// (texto rasterizado no tamanho final = letras nítidas, em vez de imagem encolhida).
function exportCanvas(){
  const L = LAYOUTS[state.layout], F = frameOf(L);
  const { w, h } = expSize(L);
  const c2 = document.createElement('canvas');
  c2.width = w; c2.height = h;
  const x2 = c2.getContext('2d');
  x2.imageSmoothingEnabled = true;
  x2.imageSmoothingQuality = 'high';
  const real = ctx;
  ctx = x2;                                  // as funções de desenho usam 'ctx'
  try{
    const sx = w / F.w, sy = h / F.h;
    ctx.setTransform(sx, 0, 0, sy, -F.x*sx, -F.y*sy);
    L.render(L.w, L.h, F);
  } finally {
    ctx = real;
  }
  return c2;
}
function download(mime,ext,q){
  // JPEG needs opaque bg (canvas already opaque). Render fresh to be safe.
  draw();
  const out = exportCanvas();
  const url = out.toDataURL(mime, q);
  const a=document.createElement('a');
  a.download = 'assinatura_'+state.layout+'_'+out.width+'x'+out.height+'.'+ext;
  a.href=url; document.body.appendChild(a); a.click(); a.remove();
}

// ---------- boot ----------
async function boot(){
  const brand = (SHIELDS.find(s=>s.id==='inst_color')||{}).src;
  if(brand){
    document.getElementById('brandimg').src = brand;
    document.getElementById('wbrand').src = brand;
  }
  await restoreState();
  const pref = unitPref();
  if(pref && pref.shield && SHIELDS.some(u => u.id === pref.shield)) state.shield = pref.shield;
  applyTheme();
  buildWelcome();
  if(pref && pref.skip) hideWelcome();
  else document.body.classList.add('welcome-open');
  bgImg = await loadImg(BG);
  await Promise.all(SHIELDS.map(async s=>{ images[s.id]=await loadImg(s.src); }));
  try{
    await document.fonts.load('italic 600 62px Rawline');
    await document.fonts.load('italic 500 52px Rawline');
    await document.fonts.load('italic 400 44px Rawline');
    await document.fonts.load('700 60px Rawline');
    await document.fonts.load('400 42px Rawline');
    await document.fonts.ready;
  }catch(e){}
  try{
    buildUI();
    syncUI();
    draw();
  }catch(e){
    // nunca deixa a tela presa em "Carregando..." por causa de um erro isolado
    console.error('Falha ao montar a interface:', e);
  }
  booted = true; dirty = false;
  updateSaveMsg();
  welcomeReady();
}
boot();
