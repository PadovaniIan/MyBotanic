/* Minimal DOM shim so assets in app.js can be exercised under Node (no jsdom available).
   Not a browser: it exists to prove the engine runs, produces sane output, and never emits
   undefined/NaN. Used by run_tests.js, sample_output.js, diversity_check.js, snapshot.js. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = __dirname;

class E {
  constructor(tag){
    this.tag=(tag||'div'); this.tagName=this.tag.toUpperCase();
    this.children=[]; this._text=''; this._html=''; this._hasOpt=false;
    this.style=Object.create({ setProperty(){} }); this.attrs={}; this.listeners={};
    this.className=''; this.value=''; this.hidden=false; this.checked=false;
  }
  appendChild(c){
    this.children.push(c); c.parentNode=this;
    if(this.tagName==='SELECT' && c.tagName==='OPTION' && !this._hasOpt){
      this._hasOpt=true; this.value=c.value;
    }
    return c;
  }
  removeChild(c){ this.children=this.children.filter(x=>x!==c); }
  remove(){ if(this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k,v){ this.attrs[k]=String(v); }
  getAttribute(k){ return this.attrs[k]; }
  addEventListener(t,f){ (this.listeners[t]=this.listeners[t]||[]).push(f); }
  dispatch(t,ev){ (this.listeners[t]||[]).forEach(f=>f(ev||{preventDefault(){}})); }
  click(){ if(this.onclick) this.onclick({preventDefault(){}}); this.dispatch('click'); }
  scrollIntoView(){}
  select(){}
  focus(){}
  set textContent(v){ this._text=String(v); this.children=[]; }
  get textContent(){ return this._text + this.children.map(c=>c.textContent).join(''); }
  set innerHTML(v){
    this._html=String(v); this.children=[]; this._hasOpt=false;
    this._text=String(v).replace(/<[^>]*>/g,'');
  }
  get innerHTML(){ return this._html; }
  querySelector(){ return null; }
}

const byId = {};
const SELECTS = /^(region|zone|soil|maxh|deer|spread|breg|blay|blight|bsort|comboJump|dxTiming|dxSymptom)$/;
const INPUTS  = /^(zip|w|l|bq|dxq)$/;
const IDS = ['zip','region','regionHint','zone','soil','w','l','maxh','deer','spread','zipOut',
 'bed','shuffle','printBtn','permalinkWrap','permalink','status','resultsHead','resultsSummary',
 'csvAll','results',
 // one-combination-at-a-time carousel
 'comboHost','comboNav','comboNavFoot','comboCount','comboCount2','comboJump',
 'prevCombo','prevCombo2','nextCombo','nextCombo2',
 // plant database
 'bq','breg','blay','blight','bsort','browseCount','browseTable',
 'srcCards','footStats',
 // diagnostics tab
 'dxq','dxResults','dxSearchBox','dxOut','dxGeneral','dxReset','dxSources',
 'dxTiming','dxSymptom',
 // tabs
 'tab-build','tab-dying','tab-how','tab-plants','tab-sources','tab-before',
 'panel-build','panel-dying','panel-how','panel-plants','panel-sources','panel-before'];
IDS.forEach(id => {
  const tag = id==='bed' ? 'form' : SELECTS.test(id) ? 'select' : INPUTS.test(id) ? 'input' : 'div';
  byId[id] = new E(tag); byId[id].id = id;
});
byId.zip.value=''; byId.soil.value='M'; byId.w.value='6'; byId.l.value='16';
byId.maxh.value='999'; byId.deer.value='0'; byId.spread.value='1';
byId.blight.value=''; byId.bsort.value='eco'; byId.breg.value=''; byId.blay.value='';
// mirror the shipped markup: Build a Bed selected, the other four panels hidden
['build','dying','how','plants','sources','before'].forEach((n,i) => {
  byId['tab-'+n].setAttribute('aria-selected', i===0 ? 'true' : 'false');
  byId['tab-'+n].setAttribute('tabindex', i===0 ? '0' : '-1');
  byId['panel-'+n].hidden = (i !== 0);
});
byId.comboNav.hidden = true; byId.comboNavFoot.hidden = true;

const lightRadios = {S:new E('input'), P:new E('input'), H:new E('input')};
Object.keys(lightRadios).forEach(k=>{ lightRadios[k].value=k; lightRadios[k].checked=(k==='S'); });

const document = {
  body: new E('body'),
  getElementById: id => byId[id] || (byId[id]=new E('div')),
  createElement: t => new E(t),
  createElementNS: (ns,t) => new E(t),
  execCommand: () => true,
  querySelector(sel){
    if(sel==='input[name=light]:checked')
      return Object.keys(lightRadios).map(k=>lightRadios[k]).find(r=>r.checked)||null;
    const m=/input\[name=light\]\[value="(\w)"\]/.exec(sel);
    return m ? (lightRadios[m[1]]||null) : null;
  }
};
const sandbox = {
  window:{ BB_DATA:null, print(){}, open(){}, scrollTo(){},
           location:{origin:'',pathname:'/',search:'',hash:''} },
  history:{ replaceState(){} },
  document, console,
  navigator:{ clipboard:{ writeText:()=>Promise.resolve() } },
  location:{ search:'', origin:'', pathname:'/', hash:'' },
  URLSearchParams, URL:{ createObjectURL:()=>'blob:x', revokeObjectURL(){} },
  Blob: class { constructor(){} },
  fetch: undefined,                 // exercise the no-fetch path deterministically
  setTimeout, Math, Object, Array, String, Number, JSON, Boolean, Date, RegExp, Error,
  isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Promise
};
sandbox.globalThis = sandbox;
sandbox.window.document = document;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT,'data.js'),'utf8'), ctx, {filename:'data.js'});
vm.runInContext(fs.readFileSync(path.join(ROOT,'app.js'),'utf8'), ctx, {filename:'app.js'});

function setLight(k){ Object.keys(lightRadios).forEach(x=>lightRadios[x].checked=(x===k)); }
function submit(){ byId.bed.dispatch('submit'); }

/* The page shows one combination at a time, so these helpers drive the real carousel:
   setting the jump select and dispatching change is exactly what a user does when they
   use the "Jump to" control. Declared as plain functions because the test files
   destructure them off the module, which would otherwise lose `this`. */
function comboCount(){ return byId.comboJump.children.length; }
function gotoCombo(i){
  byId.comboJump.value = String(i);
  byId.comboJump.dispatch('change');
  return byId.comboHost.children[0];
}
function currentCard(){ return byId.comboHost.children[0]; }
function cards(){
  const n = comboCount(), out = [];
  for(let i = 0; i < n; i++){
    const c = gotoCombo(i);
    if(c) out.push(c);
  }
  if(n) gotoCombo(0);
  return out;
}

module.exports = {
  byId, lightRadios, document, sandbox, E, setLight, submit,
  setup(zip,light,soil,extra){
    byId.zip.value=zip; byId.zip.dispatch('input');
    setLight(light); byId.soil.value=soil;
    byId.w.value='6'; byId.l.value='16'; byId.maxh.value='999';
    byId.deer.value='0'; byId.spread.value='1';
    if(extra) Object.keys(extra).forEach(k=>{ byId[k].value=String(extra[k]); });
    byId.comboHost.children=[];
    byId.comboJump.children=[]; byId.comboJump._hasOpt=false;
    submit();
  },
  comboCount, gotoCombo, currentCard, cards,
  clickTab(name){ byId['tab-'+name].dispatch('click'); },
  /* diagnostics tab: type a query, read the hit list, click a Diagnose button */
  dxSearch(q){
    byId.dxq.value = q;
    byId.dxq.dispatch('input');
    return this.dxHits();
  },
  dxHits(){
    const out = [];
    (function walk(e){
      if(e.className === 'dxhit') out.push(e);
      (e.children||[]).forEach(walk);
    })(byId.dxResults);
    return out;
  },
  dxHitNames(){
    return this.dxHits().map(h => {
      const m = /<span class='cn'>(.*?)<\/span>/.exec(h.children[0].innerHTML);
      return m ? m[1] : '?';
    });
  },
  dxPick(i){
    const hits = this.dxHits();
    if(!hits[i]) return null;
    hits[i].children[1].click();
    return byId.dxOut;
  },
  dxTests(){
    const out = [];
    (function walk(e){
      if(e.className && String(e.className).indexOf('dxcard') === 0) out.push(e);
      (e.children||[]).forEach(walk);
    })(byId.dxOut);
    return out.map(card => {
      const hd = card.children[0].innerHTML;
      const t = /<span class='dx-title'>(.*?)<\/span>/.exec(hd);
      const c = /<span class='dx-cat c-(\w+)'>/.exec(hd);
      const why = card.children.find(x => x.className === 'dx-why');
      return { title: t ? t[1] : '?', cat: c ? c[1] : '?',
               why: why ? why.innerHTML.replace(/<[^>]*>/g,'') : '' };
    });
  },
  /* The refinement selects are created by renderDiagnosis(), so they are not in the
     static byId map: find the real element and drive its own change handler. */
  dxSetAnswer(which, value){
    const id = which === 'timing' ? 'dxTiming' : 'dxSymptom';
    let found = null;
    (function walk(e){
      if(e.id === id) found = e;
      (e.children||[]).forEach(walk);
    })(byId.dxOut);
    if(!found) throw new Error('refinement select '+id+' not rendered');
    found.value = value;
    found.dispatch('change');
    return found;
  },
  visibleTabs(){
    return ['build','dying','how','plants','sources','before']
      .filter(n => byId['panel-'+n].hidden === false);
  },
  tabState(){
    return ['build','dying','how','plants','sources','before'].map(n => ({
      id: n,
      selected: byId['tab-'+n].getAttribute('aria-selected'),
      tabindex: byId['tab-'+n].getAttribute('tabindex'),
      panelHidden: byId['panel-'+n].hidden
    }));
  },
  cardTitle(card){
    const h3 = card.children[0] && card.children[0].children[0];
    return h3 ? h3.innerHTML.replace(/<[^>]*>/g,'').trim() : '?';
  },
  plantTable(card){
    return card.children[1].children[0].children[0].children[0];
  }
};
