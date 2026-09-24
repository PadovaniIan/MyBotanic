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
const SELECTS = /^(region|zone|soil|maxh|deer|spread|breg|blay|blight|bsort)$/;
const INPUTS  = /^(zip|w|l|bq)$/;
const IDS = ['zip','region','regionHint','zone','soil','w','l','maxh','deer','spread','zipOut',
 'bed','shuffle','printBtn','permalinkWrap','permalink','status','resultsHead','resultsSummary',
 'csvAll','combos','bq','breg','blay','blight','bsort','browseCount','browseTable','srcCards',
 'footStats','results'];
IDS.forEach(id => {
  const tag = id==='bed' ? 'form' : SELECTS.test(id) ? 'select' : INPUTS.test(id) ? 'input' : 'div';
  byId[id] = new E(tag); byId[id].id = id;
});
byId.zip.value=''; byId.soil.value='M'; byId.w.value='6'; byId.l.value='16';
byId.maxh.value='999'; byId.deer.value='0'; byId.spread.value='1';
byId.blight.value=''; byId.bsort.value='eco'; byId.breg.value=''; byId.blay.value='';

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
  window:{ BB_DATA:null, print(){}, open(){}, location:{origin:'',pathname:'/',search:''} },
  document, console,
  navigator:{ clipboard:{ writeText:()=>Promise.resolve() } },
  location:{ search:'', origin:'', pathname:'/' },
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

module.exports = {
  byId, lightRadios, document, sandbox, E, setLight, submit,
  setup(zip,light,soil,extra){
    byId.zip.value=zip; byId.zip.dispatch('input');
    setLight(light); byId.soil.value=soil;
    byId.w.value='6'; byId.l.value='16'; byId.maxh.value='999';
    byId.deer.value='0'; byId.spread.value='1';
    if(extra) Object.keys(extra).forEach(k=>{ byId[k].value=String(extra[k]); });
    byId.combos.children=[]; submit();
  },
  cards(){ return byId.combos.children; },
  cardTitle(card){
    const h3 = card.children[0] && card.children[0].children[0];
    return h3 ? h3.innerHTML.replace(/<[^>]*>/g,'').trim() : '?';
  },
  plantTable(card){
    return card.children[1].children[0].children[0].children[0];
  }
};
