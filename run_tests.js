/* Test suite: ZIP resolution, scenario coverage, hard-filter stress, structural invariants. */
const H = require('./test_harness.js');
const { byId, setLight, submit, setup, cards, cardTitle, plantTable } = H;

let fails = 0, warns = 0;
const ok   = (c,m)=>{ if(!c){ console.log('  FAIL  '+m); fails++; } };
const warn = (c,m)=>{ if(!c){ console.log('  warn  '+m); warns++; } };
const statusText = ()=> byId.status.innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

console.log('=== tabs ===');
(function(){
  const NAMES = ['build','how','plants','sources','before'];
  const LABELS = {build:'Build a Bed', how:'How it works', plants:'Plant Database',
                  sources:'Data Sources', before:'Before you plant'};
  ok(NAMES.length === 5, 'there must be exactly 5 tabs, found '+NAMES.length);
  // exactly one panel visible at any time, and it must match the selected tab
  NAMES.forEach(name => {
    H.clickTab(name);
    const vis = H.visibleTabs();
    ok(vis.length === 1, 'clicking '+name+' left '+vis.length+' panels visible');
    ok(vis[0] === name, 'clicking '+name+' showed panel '+vis[0]);
    const st = H.tabState();
    const sel = st.filter(t => t.selected === 'true').map(t => t.id);
    ok(sel.length === 1 && sel[0] === name,
       'aria-selected is '+JSON.stringify(sel)+' after clicking '+name);
    // roving tabindex: only the selected tab is reachable by Tab key
    const focusable = st.filter(t => t.tabindex === '0').map(t => t.id);
    ok(focusable.length === 1 && focusable[0] === name,
       'tabindex=0 on '+JSON.stringify(focusable)+' after clicking '+name);
  });
  // keyboard: arrows move between tabs and wrap
  H.clickTab('build');
  byId['tab-build'].dispatch('keydown', {key:'ArrowRight', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'how', 'ArrowRight from Build should open How it works');
  byId['tab-how'].dispatch('keydown', {key:'ArrowLeft', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'build', 'ArrowLeft should go back to Build');
  byId['tab-build'].dispatch('keydown', {key:'ArrowLeft', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'before', 'ArrowLeft from the first tab should wrap to the last');
  byId['tab-before'].dispatch('keydown', {key:'End', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'before', 'End should select the last tab');
  byId['tab-before'].dispatch('keydown', {key:'Home', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'build', 'Home should select the first tab');
  console.log('  5 tabs, one panel at a time, arrow/Home/End keys all work');
  H.clickTab('build');
})();

console.log('\n=== one combination at a time ===');
(function(){
  setup('53703','S','M',{w:8,l:20});
  const n = H.comboCount();
  ok(n >= 4, 'expected several combinations, got '+n);
  ok(byId.comboHost.children.length === 1,
     'the page must hold exactly one combination, holds '+byId.comboHost.children.length);
  ok(byId.comboNav.hidden === false, 'the navigation bar should be visible with results');
  ok(byId.comboNavFoot.hidden === false, 'the footer navigation should be visible with results');
  const label = () => byId.comboCount.innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  ok(/Combination 1 of /.test(label()), 'counter should start at 1, reads '+label());

  // forward, backward, and wrap in both directions
  byId.nextCombo.dispatch('click');
  ok(/Combination 2 of /.test(label()), 'Next Combination did not advance: '+label());
  ok(byId.comboHost.children.length === 1, 'paging left more than one combination in the page');
  byId.prevCombo.dispatch('click');
  ok(/Combination 1 of /.test(label()), 'Previous Combination did not go back: '+label());
  byId.prevCombo.dispatch('click');
  ok(label().indexOf('Combination '+n+' of ') === 0,
     'Previous from the first should wrap to the last, got '+label());
  byId.nextCombo.dispatch('click');
  ok(/Combination 1 of /.test(label()), 'Next from the last should wrap to the first: '+label());

  // duplicate controls at the foot of the card
  byId.nextCombo2.dispatch('click');
  ok(/Combination 2 of /.test(label()), 'footer Next Combination does not work');
  byId.prevCombo2.dispatch('click');
  ok(/Combination 1 of /.test(label()), 'footer Previous Combination does not work');

  // jump select
  ok(byId.comboJump.children.length === n,
     'jump list has '+byId.comboJump.children.length+' entries for '+n+' combinations');
  byId.comboJump.value = String(n-1);
  byId.comboJump.dispatch('change');
  ok(label().indexOf('Combination '+n+' of ') === 0, 'jump select did not move: '+label());

  // arrow keys on the nav
  byId.comboJump.value = '0'; byId.comboJump.dispatch('change');
  byId.comboNav.dispatch('keydown', {key:'ArrowRight'});
  ok(/Combination 2 of /.test(label()), 'ArrowRight on the nav should advance');
  byId.comboNav.dispatch('keydown', {key:'ArrowLeft'});
  ok(/Combination 1 of /.test(label()), 'ArrowLeft on the nav should go back');

  // cards are cached, not rebuilt
  const a = byId.comboHost.children[0];
  byId.nextCombo.dispatch('click'); byId.prevCombo.dispatch('click');
  ok(byId.comboHost.children[0] === a, 'paging away and back should reuse the rendered card');

  // every combination is reachable and distinct
  const titles = new Set();
  for(let i=0;i<n;i++){ H.gotoCombo(i); titles.add(cardTitle(byId.comboHost.children[0])); }
  ok(titles.size === n, 'only '+titles.size+' distinct combinations reachable out of '+n);
  console.log('  '+n+' combinations, one in the page at a time, '+titles.size+' distinct, wrap both ways');
})();

console.log('\n=== ZIP resolution ===');
[['53703','WI'],['02138','MA'],['85719','AZ'],['97214','OR'],['94110','CA'],['33139','FL'],
 ['80304','CO'],['78704','TX'],['10025','NY'],['59801','MT'],['30306','GA'],['87501','NM'],
 ['98105','WA'],['67601','KS'],['89109','NV'],['99501','ZIP 99501 is in AK'],
 ['00501','not inside'],['abcde','five-digit']
].forEach(([z,exp])=>{
  byId.zip.value=z; byId.zip.dispatch('input');
  const t = byId.zipOut.innerHTML.replace(/<[^>]*>/g,' ').replace(/&mdash;/g,'-')
              .replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
  console.log('  '+z.padEnd(7)+'-> '+t.slice(0,92));
  ok(t.indexOf(exp)>=0, z+' should mention '+JSON.stringify(exp));
});

console.log('\n=== scenario matrix (19 locations x light x soil) ===');
const scenarios = [
  ['Madison WI, sun, average','53703','S','M'],   ['Madison WI, part shade','53703','P','M'],
  ['Madison WI, full shade','53703','H','M'],     ['Madison WI, sun, wet','53703','S','W'],
  ['Madison WI, shade, dry','53703','H','D'],     ['Boston MA, part shade','02138','P','M'],
  ['Tucson AZ, sun, dry','85719','S','D'],        ['Tucson AZ, shade, dry','85719','H','D'],
  ['Portland OR, shade, moist','97214','H','M'],  ['San Francisco CA, sun, dry','94110','S','D'],
  ['Miami FL, part shade','33139','P','M'],       ['Boulder CO, sun, dry','80304','S','D'],
  ['Austin TX, sun, dry','78704','S','D'],        ['Manhattan NY, sun, average','10025','S','M'],
  ['Missoula MT, sun, average','59801','S','M'],  ['Atlanta GA, shade, average','30306','H','M'],
  ['Santa Fe NM, part shade','87501','P','M'],    ['Hays KS, sun, dry','67601','S','D'],
  ['Las Vegas NV, sun, dry','89109','S','D'],
];
let zeros=0;
scenarios.forEach(([label,zip,light,soil])=>{
  setup(zip,light,soil);
  const n = H.comboCount();   // counts the jump list, so it never renders 12 cards
  const summary = byId.resultsSummary.innerHTML.replace(/<[^>]*>/g,'');
  const pm = /from (\d+) species/.exec(summary);
  const pool = n ? (pm?+pm[1]:0) : (/the (\d+) eligible/.exec(statusText())||[0,0])[1];
  console.log('  '+label.padEnd(29)+' pool '+String(pool).padStart(3)+'   designs '+n);
  if(n===0){ zeros++; console.log('      -> '+statusText().slice(0,120)); }
  warn(n>=4, label+' produced only '+n+' design(s)');
});
ok(zeros<=1, zeros+' scenarios produced nothing (at most one extreme case is acceptable)');

console.log('\n=== hard-filter stress ===');
[['deer + no spreaders + under 30in','53703','S','D',{deer:1,spread:0,maxh:30}],
 ['shade + dry + 30in + deer (extreme)','30306','H','D',{deer:1,spread:0,maxh:30}],
 ['tiny bed 3x4 ft','53703','S','M',{w:3,l:4}],
 ['large bed 20x60 ft','53703','S','M',{w:20,l:60}],
 ['under 4 ft, part shade','02138','P','M',{maxh:48}],
].forEach(([label,zip,light,soil,extra])=>{
  setup(zip,light,soil,extra);
  const n=H.comboCount();
  console.log('  '+label.padEnd(36)+' designs '+n);
  if(n===0) ok(/No combination could be assembled/.test(statusText()),
               label+' produced 0 designs without an explanatory message');
});

console.log('\n=== structural invariants (Madison, sun, average, 8x20) ===');
setup('53703','S','M',{w:8,l:20});
const list = cards();
ok(list.length>0,'cards rendered');
const titles = new Set();
list.forEach((card,i)=>{
  const txt = card.textContent, tag='card '+(i+1);
  ok(card.children.length>=3, tag+': missing head/body/foot');
  ok(/Structural|Seasonal|Groundcover|Grass|Fern|Shrub|Filler/.test(txt), tag+': no layer tags');
  ok(/caterpillar/.test(txt), tag+': no scorecard');
  ok(/Spacing \(centre to centre\)/.test(txt), tag+': no spacing column');
  ok(/Planting plan/.test(txt), tag+': no planting plan');
  ok(/Bloom sequence/.test(txt), tag+': no bloom calendar');
  ok(/Plant-by-plant notes/.test(txt), tag+': no per-plant notes');
  // layout and maintenance must be generated for this specific bed
  ok(/Step by step/.test(txt), tag+': no step-by-step layout');
  ok(/centre to centre/.test(txt), tag+': spacing convention not explained');
  ok(/no bare soil is left anywhere/.test(txt), tag+': groundcover step does not say to fill all gaps');
  ok(/Your calendar/.test(txt), tag+': no zone calendar');
  ok(/Main cut-back window/.test(txt), tag+': no cut-back window');
  ok(/frost/.test(txt), tag+': no frost-date guidance');
  ok(/FRONT EDGE/.test(txt), tag+': plan does not label the front edge');
  // the brief called these out specifically: no abbreviated units anywhere
  var abbr = txt.match(/\d+\s?(?:in|ft)\b|\bo\.c\./g);
  ok(!abbr, tag+': abbreviated units in output ('+(abbr?abbr.slice(0,3).join(','):'')+')');
  // planting time, watering and appearance were all explicit requirements
  ok(/When to plant/.test(txt), tag+': no planting-season guidance');
  ok(/Best window/.test(txt), tag+': planting season has no recommended window');
  ok(/How much to water/.test(txt), tag+': no watering section');
  ok(/gallons/.test(txt), tag+': watering gives no actual quantity');
  ok(/Watering:/.test(txt), tag+': maintenance groups carry no watering advice');
  ok(/Looks like:/.test(txt), tag+': no appearance description');
  var allHtml = '';
  (function collect(e){ allHtml += (e._html||''); (e.children||[]).forEach(collect); })(card);
  var nrows = plantTable(card).children.length - 1;
  var wcs = (allHtml.match(/wildflower\.org\/plants\/search/g)||[]).length;
  var inat = (allHtml.match(/inaturalist\.org\/search/g)||[]).length;
  ok(wcs >= nrows, tag+': '+wcs+' Wildflower Center photo links for '+nrows+' plants');
  ok(inat >= nrows, tag+': '+inat+' iNaturalist photo links for '+nrows+' plants');
  ok(!/<img/.test(allHtml), tag+': embeds an image instead of linking out');
  const bad = txt.match(/undefined|NaN|\[object \w+/);
  ok(!bad, tag+': output contains '+(bad?bad[0]:''));
  const rows = plantTable(card).children.length-1;
  ok(rows>=5, tag+': only '+rows+' plant rows');
  titles.add(cardTitle(card).replace(/^\d+/,''));
});
console.log('  '+list.length+' cards, '+titles.size+' distinct design templates');
ok(titles.size>=6,'at least 6 distinct templates appear, got '+titles.size);

console.log('\n=== plan colours follow the layer code ===');
(function(){
  // Collect region fills and the layer of each species; every species sharing a layer must
  // share a hue family, and no two layers may collide on a colour.
  function walk(e, fn){ fn(e); (e.children||[]).forEach(function(c){ walk(c, fn); }); }
  var LAYER_OF = {};
  var problems = 0, checkedCards = 0;
  list.forEach(function(card){
    var rows = plantTable(card).children.slice(1);
    var layerByNum = {};
    rows.forEach(function(tr, i){
      layerByNum[i+1] = tr.children[1].innerHTML.replace(/<[^>]*>/g, '');
    });
    var fills = {};
    walk(card, function(e){
      if(e.tag === 'path' && e.attrs && e.attrs['data-sp'])
        fills[+e.attrs['data-sp']] = e.attrs.fill;
    });
    if(!Object.keys(fills).length) return;
    checkedCards++;
    // hue of each fill
    function hue(hex){
      var m = /#(..)(..)(..)/.exec(hex);
      var r = parseInt(m[1],16)/255, g = parseInt(m[2],16)/255, b = parseInt(m[3],16)/255;
      var mx = Math.max(r,g,b), mn = Math.min(r,g,b), d = mx-mn, h;
      if(!d) return -1;
      if(mx===r) h = ((g-b)/d + (g<b?6:0)); else if(mx===g) h = ((b-r)/d+2); else h = ((r-g)/d+4);
      return h*60;
    }
    var hueByLayer = {};
    Object.keys(fills).forEach(function(num){
      var lay = layerByNum[num];
      (hueByLayer[lay] = hueByLayer[lay] || []).push(hue(fills[num]));
    });
    Object.keys(hueByLayer).forEach(function(lay){
      var hs = hueByLayer[lay].filter(function(h){ return h >= 0; });
      if(hs.length < 2) return;
      var spread = Math.max.apply(null, hs) - Math.min.apply(null, hs);
      if(spread > 40){ problems++; console.log('  FAIL  layer '+lay+' hue spread '+spread.toFixed(0)+' degrees'); }
    });
    // layers must not collide
    var layHue = {};
    Object.keys(hueByLayer).forEach(function(lay){
      var hs = hueByLayer[lay].filter(function(h){ return h>=0; });
      if(hs.length) layHue[lay] = hs.reduce(function(a,b){return a+b;},0)/hs.length;
    });
    var keys = Object.keys(layHue);
    for(var i=0;i<keys.length;i++) for(var j=i+1;j<keys.length;j++){
      if(Math.abs(layHue[keys[i]]-layHue[keys[j]]) < 12){
        problems++;
        console.log('  FAIL  layers '+keys[i]+' and '+keys[j]+' share a hue');
      }
    }
  });
  console.log('  checked '+checkedCards+' plans, hue problems: '+problems);
  ok(problems === 0, problems+' plan colour problems');
  // number legibility
  var small = [];
  list.forEach(function(card){
    walk(card, function(e){
      if(e.tag === 'text' && e.attrs && e.attrs['font-weight'] === '700' && /^\d+$/.test(e._text||''))
        if(+e.attrs['font-size'] < 12) small.push(+e.attrs['font-size']);
    });
  });
  ok(small.length === 0, small.length+' region numbers under 12px');
  console.log('  region numbers all >= 12px: '+(small.length===0));
})();

console.log('\n=== quantities are sane ===');
let qtyIssues=0, totalPlants=0;
list.forEach(card=>{
  plantTable(card).children.slice(1).forEach(tr=>{
    const q = parseInt(tr.children[5].textContent,10);
    if(!(q>=1 && q<=400)) qtyIssues++;
    totalPlants += q;
  });
});
ok(qtyIssues===0, qtyIssues+' quantities outside the range 1-400');
const avg = Math.round(totalPlants/list.length);
console.log('  average '+avg+' plants per 160 sq ft design');
warn(avg>40 && avg<400,'average plant count per design is '+avg+', which looks unusual');

console.log('\n=== determinism and shuffle ===');
setup('53703','S','M',{w:8,l:20});
const a = cards().map(c=>c.textContent.slice(0,300)).join('|');
setup('53703','S','M',{w:8,l:20});
const b = cards().map(c=>c.textContent.slice(0,300)).join('|');
ok(a===b,'same inputs must produce identical designs');
byId.shuffle.dispatch('click');
const c2 = cards().map(c=>c.textContent.slice(0,300)).join('|');
ok(a!==c2,'shuffle must change the selection');

console.log('\n=== plant browser and sources ===');
ok(byId.browseTable.children.length>1,'browse table populated ('+(byId.browseTable.children.length-1)+' rows)');
ok(byId.srcCards.children.length>=10,'source cards populated ('+byId.srcCards.children.length+')');
ok(/species/.test(byId.footStats.textContent),'footer stats populated');
byId.bq.value='monarch'; byId.bq.dispatch('input');
const mrows = byId.browseTable.children.length-1;
console.log('  search "monarch" -> '+mrows+' rows');
ok(mrows>=4,'monarch search should return several plants');
byId.bq.value=''; byId.blight.value='H'; byId.blight.dispatch('change');
const srows = byId.browseTable.children.length-1;
console.log('  light = full shade -> '+srows+' rows');
ok(srows>40,'shade filter should return a substantial list');
byId.blight.value=''; byId.breg.value='SW'; byId.breg.dispatch('change');
console.log('  region = Southwest -> '+(byId.browseTable.children.length-1)+' rows');
byId.breg.value='';

console.log('\n'+(fails? 'FAILURES: '+fails : 'ALL CHECKS PASSED')+
            (warns? '   warnings: '+warns : ''));
process.exit(fails?1:0);
