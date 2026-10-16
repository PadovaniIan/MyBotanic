/* Test suite: ZIP resolution, scenario coverage, hard-filter stress, structural invariants. */
const H = require('./test_harness.js');
const { byId, setLight, submit, setup, cards, cardTitle, plantTable } = H;

let fails = 0, warns = 0;
const ok   = (c,m)=>{ if(!c){ console.log('  FAIL  '+m); fails++; } };
const warn = (c,m)=>{ if(!c){ console.log('  warn  '+m); warns++; } };
const statusText = ()=> byId.status.innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

console.log('=== tabs ===');
(function(){
  const NAMES = ['build','dying','how','plants','sources','before'];
  const LABELS = {build:'Build a Bed', dying:'Help My Plant Keeps Dying',
                  how:'How it works', plants:'Plant Database',
                  sources:'Data Sources', before:'Before you plant'};
  ok(NAMES.length === 6, 'there must be exactly 6 tabs, found '+NAMES.length);
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
  ok(H.visibleTabs()[0] === 'dying', 'ArrowRight from Build should open the diagnosis tab');
  byId['tab-dying'].dispatch('keydown', {key:'ArrowLeft', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'build', 'ArrowLeft should go back to Build');
  byId['tab-build'].dispatch('keydown', {key:'ArrowLeft', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'before', 'ArrowLeft from the first tab should wrap to the last');
  byId['tab-before'].dispatch('keydown', {key:'End', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'before', 'End should select the last tab');
  byId['tab-before'].dispatch('keydown', {key:'Home', preventDefault(){}});
  ok(H.visibleTabs()[0] === 'build', 'Home should select the first tab');
  console.log('  6 tabs, one panel at a time, arrow/Home/End keys all work');
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

console.log('\n=== Help My Plant Keeps Dying ===');
(function(){
  H.clickTab('dying');
  const DIAG = require('./diagnostics.json');
  const N = DIAG.diagnostics.length;
  ok(N >= 35, 'expected a substantial test list, found '+N);

  // every test must be complete and cite a source
  let bad = [];
  DIAG.diagnostics.forEach(d => {
    ['id','cat','title','test','means','fix'].forEach(k => {
      if(!d[k]) bad.push(d.id+' missing '+k);
    });
    if(String(d.title).length < 12) bad.push(d.id+': title too terse');
    if(String(d.test).length < 80)  bad.push(d.id+': test too vague to perform');
    if(String(d.means).length < 60) bad.push(d.id+': no interpretation given');
    if(String(d.fix).length < 60)   bad.push(d.id+': no remedy given');
    if(!d.src || !d.src.length)     bad.push(d.id+': no source cited');
    (d.src||[]).forEach(k => { if(!DIAG.sources[k]) bad.push(d.id+': unknown source '+k); });
  });
  ok(bad.length === 0, 'incomplete diagnostics: '+bad.slice(0,4).join('; '));
  // no abbreviated units, to match the rest of the site
  const abbr = [];
  DIAG.diagnostics.forEach(d => {
    const t = d.test+' '+d.means+' '+d.fix;
    const m = t.match(/\d+\s?(?:in|ft)\b/g);
    if(m) abbr.push(d.id+': '+m[0]);
  });
  ok(abbr.length === 0, 'abbreviated units in diagnostics: '+abbr.slice(0,3).join(', '));

  // search
  const hits = H.dxSearch('butterfly');
  ok(hits.length >= 1, 'searching for butterfly weed returned nothing');
  ok(H.dxHitNames().indexOf('Butterfly Weed') >= 0, 'Butterfly Weed not in the results');
  ok(H.dxSearch('a').length === 0, 'a one-letter query should not run a search');
  ok(H.dxSearch('Asclepias').length >= 3, 'searching by genus should match several species');
  ok(H.dxSearch('Asteraceae').length >= 20, 'searching by family should work');
  ok(H.dxSearch('zzzznotaplant').length === 0, 'a nonsense query should return no hits');

  // selecting a plant produces the full ranked list
  H.dxSearch('butterfly'); H.dxPick(0);
  let tests = H.dxTests();
  ok(tests.length === N, 'expected all '+N+' tests rendered, got '+tests.length);
  ok(tests[tests.length-1].cat === 'LAST',
     'the laboratory referral must be last, found '+tests[tests.length-1].cat);
  ok(tests.filter(t => t.why).length >= 3,
     'at least a few tests should explain why they matter for this plant');

  // the ranking must actually differ between plants with different needs
  function topFor(q){ H.dxSearch(q); H.dxPick(0); return H.dxTests().map(t => t.title); }
  const agave = topFor('agave'), fern = topFor('maidenhair'), blue = topFor('lowbush');
  const rank = (list, frag) => list.findIndex(t => t.toLowerCase().indexOf(frag) >= 0);
  ok(rank(agave,'overwatering') < 3,
     'overwatering should lead for an agave, ranked '+(rank(agave,'overwatering')+1));
  ok(rank(fern,'underwatering') < rank(fern,'overwatering'),
     'drying out should outrank overwatering for a fern');
  ok(rank(blue,'soil ph') === 0,
     'soil pH should lead for an acid-soil blueberry, ranked '+(rank(blue,'soil ph')+1));
  ok(rank(agave,'overwatering') !== rank(fern,'overwatering') ||
     rank(agave,'soil ph') !== rank(fern,'soil ph'),
     'the ranking is identical for an agave and a fern, so it is not plant-specific');
  const taproot = topFor('prairie dock');
  ok(rank(taproot,'test pit') < 6,
     'the test pit should rank high for a deep-taprooted species, ranked '+(rank(taproot,'test pit')+1));
  const filler = topFor('black-eyed');
  ok(rank(filler,'natural life') < 3,
     'natural lifespan should lead for a short-lived self-sower');

  // symptom answers must re-rank
  H.dxSearch('purple conef'); H.dxPick(0);
  const before = H.dxTests().map(t => t.title);
  H.dxSetAnswer('symptom','distorted');
  const afterDistort = H.dxTests().map(t => t.title);
  ok(rank(afterDistort,'herbicide drift') < rank(before,'herbicide drift'),
     'reporting distorted growth should promote herbicide drift');
  ok(rank(afterDistort,'herbicide drift') < 4,
     'herbicide drift should be near the top for distorted growth, ranked '+
     (rank(afterDistort,'herbicide drift')+1));
  H.dxSetAnswer('symptom','vanished'); H.dxSetAnswer('timing','winter');
  const afterVole = H.dxTests().map(t => t.title);
  ok(rank(afterVole,'vole') < 3,
     'a plant that vanished over winter should promote voles, ranked '+(rank(afterVole,'vole')+1));
  ok(H.dxTests().length === N, 'the answers must not drop tests from the list');
  // answers must survive the re-render they trigger
  H.dxSetAnswer('timing','summer');
  ok(H.dxTests().length === N, 'list broken after changing an answer');

  // the general fallback for a plant that is not in the database
  byId.dxGeneral.dispatch('click');
  const gen = H.dxTests();
  ok(gen.length === N, 'the general list should still offer every test, got '+gen.length);
  ok(byId.dxOut.textContent.indexOf('General diagnosis') >= 0,
     'the general path should say so rather than naming a plant');

  // reset
  byId.dxReset.dispatch('click');
  ok(byId.dxOut.children.length === 0, 'Start again should clear the diagnosis');

  // source cards
  ok(byId.dxSources.children.length === Object.keys(DIAG.sources).length,
     'expected '+Object.keys(DIAG.sources).length+' source cards, got '+byId.dxSources.children.length);
  console.log('  '+N+' tests, search and selection work, ranking is plant-specific, '+
              'symptom answers re-rank, '+Object.keys(DIAG.sources).length+' sources cited');
  H.clickTab('build');
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


console.log('\n=== swapping plants ===');
(function(){
  const S = H.sandbox.window.__BB;
  function walk(e, fn){ fn(e); (e.children||[]).forEach(c=>walk(c, fn)); }
  function findAll(root, pred){ const o=[]; walk(root, e=>{ if(pred(e)) o.push(e); }); return o; }
  const byClass = (root, cls) => findAll(root, e => (' '+(e.className||'')+' ').indexOf(' '+cls+' ')>=0);
  const allText = root => { let t=''; walk(root, e=>{ t += (e._text||'')+' '+(e._html||'')+' '; }); return t; };
  const rowsOf = card => plantTable(card).children.slice(1);
  const swapBtn = (card, i) => rowsOf(card)[i].children[7].children[0];

  setup('53703','S','M',{w:8,l:20});
  let card = H.currentCard(), combo = S.LAST.res.combos[S.CUR];
  const before = allText(card);
  ok(rowsOf(card).every(tr => tr.children[7] && /Swap/.test(tr.children[7].textContent)),
     'every plant row should carry a Swap button');

  // every candidate offered anywhere must respect the role and the site
  let bad = 0, offered = 0, crossRole = 0;
  [['53703','S','M'],['85719','S','D'],['97214','H','M'],['33139','P','M'],['78704','S','D'],
   ['94110','S','D'],['30306','H','M']].forEach(([zip,l,soil])=>{
    setup(zip,l,soil,{w:8,l:20});
    const c = S.LAST;
    S.LAST.res.combos.forEach(cb => cb.rows.forEach((r, ri) => {
      const inBed = new Set(cb.rows.map(x=>x.p.id));
      S.swapCandidates(cb, ri, c).forEach(o => {
        offered++;
        const p = o.p;
        if(!S.roleMatch(r.layer, p)) bad++;
        if(inBed.has(p.id)) bad++;
        if(p.regions.indexOf(c.region)<0 || c.zone < p.zmin || c.zone > p.zmax+1 ||
           p.light.indexOf(c.light)<0 || p.moist.indexOf(c.soil)<0 || p.hmax > c.maxh) bad++;
        if(p.layer !== r.layer) crossRole++;
      });
    }));
  });
  console.log('  '+offered+' replacement offers checked across 7 sites, '+crossRole+' of them cross-role');
  ok(bad === 0, bad+' offered replacements break the role or the site constraints');
  ok(crossRole > 0, 'no cross-role replacements are ever offered');

  // the user's example: a shrub offered for a structural slot
  setup('53703','P','M',{w:8,l:20});
  let shrubForStruct = 0;
  S.LAST.res.combos.forEach(cb => cb.rows.forEach((r, ri) => {
    if(r.layer==='STRUCT' && S.swapCandidates(cb, ri, S.LAST).some(o=>o.p.layer==='SHRUB')) shrubForStruct++;
  }));
  ok(shrubForStruct > 0, 'a shrub should be offered for a structural slot');

  // open the chooser through the real button
  setup('53703','S','M',{w:8,l:20});
  card = H.currentCard(); combo = S.LAST.res.combos[S.CUR];
  const ri = combo.rows.findIndex(r => r.layer==='SEASONAL');
  const oldP = combo.rows[ri].p;
  swapBtn(card, ri).click();
  card = H.currentCard();
  const panel = byClass(card, 'swappanel')[0];
  ok(!!panel, 'clicking Swap should open the replacement panel');
  ok(/Close/.test(swapBtn(card, ri).textContent), 'the open row button should read Close');
  let opts = byClass(panel, 'sw-opt');
  ok(opts.length === 8, 'the panel should show 8 options at first, got '+opts.length);
  byClass(panel, 'sw-more')[0].click();
  opts = byClass(panel, 'sw-opt');
  ok(opts.length > 8, 'Show more should add options');

  // filter by name
  const all = S.swapCandidates(combo, ri, S.LAST);
  const target = all[all.length-1].p;                       // the lowest-ranked one
  const search = byClass(panel, 'sw-search')[0];
  search.value = target.common.slice(0, 6); search.dispatch('input');
  opts = byClass(panel, 'sw-opt');
  ok(opts.length >= 1 && opts.every(o => allText(o).toLowerCase().indexOf(target.common.slice(0,6).toLowerCase())>=0),
     'the filter should narrow the list to matching plants');

  // choose it
  const use = byClass(opts.find(o => allText(o).indexOf(target.common)>=0), 'sw-use')[0];
  use.click();
  card = H.currentCard(); combo = S.LAST.res.combos[S.CUR];
  const after = allText(card);
  ok(combo.rows[ri].p === target, 'the chosen plant should replace the row');
  ok(!byClass(card, 'swappanel').length, 'choosing should close the panel');
  ok(combo.rows[ri].qty === S.qtyFor(target, S.minSqFor(combo.rows[ri].sqft, target)),
     'quantity should be recalculated for the new spacing');
  const cardTxt = card.textContent;
  ['Planting plan','Bloom sequence','Step by step','Plant-by-plant notes','Your calendar']
    .forEach(sec => ok(cardTxt.indexOf(sec)>=0, 'section missing after swap: '+sec));
  // the new plant appears everywhere the old one did; the old one is gone
  const occ = (txt, name) => txt.split(name).length-1;
  const leg = byClass(card, 'legend')[0];
  ok(allText(leg).indexOf(target.common)>=0, 'plan legend should name the new plant');
  ok(findAll(card, e=>e.className==='cal').some(e=>allText(e).indexOf(target.common)>=0),
     'bloom calendar should include the new plant');
  ok(allText(card._det).indexOf(target.sci)>=0, 'layout and care notes should name the new plant');
  ok(occ(after, oldP.sci) === 0, 'the old plant still appears '+occ(after, oldP.sci)+' times');
  ok(after.indexOf('replaced '+oldP.common)>=0, 'the row should say which plant it replaced');
  ok(/1 plant swapped by you/.test(cardTxt), 'the chips should count the swap');
  // metrics are consistent with the rows
  const m = S.comboMetrics(combo.rows, combo.area);
  ok(JSON.stringify(m) === JSON.stringify(combo.m), 'metrics should be recomputed after a swap');
  const qtySum = rowsOf(card).reduce((a,tr)=>a+parseInt(tr.children[5].textContent,10),0);
  ok(cardTxt.indexOf(qtySum+' plants')>=0, 'plant total chip should match the table ('+qtySum+')');
  ok(!/undefined|NaN|\[object \w+/.test(after), 'swapped card contains undefined/NaN');
  const spPaths = findAll(card, e=>e.tag==='path' && e.attrs && e.attrs['data-sp']).length;
  ok(spPaths === combo.rows.length, 'plan should draw every species after the swap ('+spPaths+')');
  // exports follow
  ok(S.comboText(combo, S.LAST).indexOf(target.sci)>=0 &&
     /your swap, replacing/.test(S.comboText(combo, S.LAST)), 'plant list text should reflect the swap');
  const csv = S.comboCSV(combo, S.LAST);
  ok(csv[0][csv[0].length-1]==='swapped_in_for' && csv.some(r=>r[3]===target.sci && r[r.length-1].indexOf(oldP.sci)>=0),
     'CSV should carry the new plant and what it replaced');

  // paging away and back keeps the swap
  H.gotoCombo(1); H.gotoCombo(0);
  ok(S.LAST.res.combos[0].rows[ri].p === target, 'swap should survive paging');

  // shareable link round trip
  const sw = S.swapParam();
  ok(/^&sw=1\.\d+\.[a-z0-9_]+$/.test(sw), 'swap parameter looks wrong: '+sw);
  setup('53703','S','M',{w:8,l:20});
  ok(S.LAST.res.combos[0].rows[ri].p === oldP, 'regenerating should start from the original design');
  S.applySwapParam(sw.slice(4));
  ok(S.LAST.res.combos[0].rows[ri].p === target, 'the link should restore the swap');
  S.applySwapParam('9.9.not_a_plant~1.1.agave_parryi');      // junk and a wrong-site plant are ignored
  ok(S.LAST.res.combos[0].rows[0].p.id !== 'agave_parryi', 'a link must not inject an unsuitable plant');

  // Put back the original, then Undo all
  S.showCombo(0, {scroll:false});
  card = H.currentCard();
  swapBtn(card, ri).click(); card = H.currentCard();
  const back = findAll(card, e => /Put back the original/.test(e._text||''))[0];
  ok(!!back, 'a swapped row should offer to put the original back');
  back.click(); card = H.currentCard();
  ok(S.LAST.res.combos[0].rows[ri].p === oldP && !S.LAST.res.combos[0].rows[ri].orig,
     'putting back the original should clear the swap');
  ok(allText(card) === before, 'after putting the original back the card should match the original exactly');
  // several swaps, then Undo all
  combo = S.LAST.res.combos[0];
  [0,2,4].forEach(i => { const c = S.swapCandidates(combo, i, S.LAST); if(c.length) S.applySwap(combo, i, c[0].p); });
  S.refreshCard(0); card = H.currentCard();
  ok(/3 plants swapped by you/.test(card.textContent), 'three swaps should be counted');
  const undo = findAll(card, e => e._text === 'Undo all swaps')[0];
  ok(!!undo, 'an Undo all swaps button should appear');
  undo.click(); card = H.currentCard();
  ok(allText(card) === before, 'Undo all swaps should restore the original card exactly');

  // a host-dependent design warns when its hosts are all swapped out
  const wi = S.LAST.res.combos.findIndex(cb => cb.t.require_host === 'Monarch');
  if(wi >= 0){
    const cb = S.LAST.res.combos[wi];
    cb.rows.forEach((r, i) => {
      if(r.p.hosts.join(';').indexOf('Monarch')>=0){
        const alt = S.swapCandidates(cb, i, S.LAST).find(o => o.p.hosts.join(';').indexOf('Monarch')<0);
        if(alt) S.applySwap(cb, i, alt.p);
      }
    });
    ok(S.swapWarnings(cb).length === 1, 'removing every monarch host should raise a warning');
    S.resetSwaps(cb);
    ok(S.swapWarnings(cb).length === 0, 'undoing the swaps should clear the warning');
  }

  // stress: many random swaps across sites never break a card
  let broken = 0, done = 0;
  const rnd = S.rngFrom('swap-stress');
  [['53703','H','M'],['85719','S','D'],['33139','P','M'],['59801','S','M']].forEach(([zip,l,soil])=>{
    setup(zip,l,soil,{w:6,l:14});
    for(let k=0;k<25;k++){
      const ci = Math.floor(rnd()*S.LAST.res.combos.length), cb = S.LAST.res.combos[ci];
      const i = Math.floor(rnd()*cb.rows.length), c = S.swapCandidates(cb, i, S.LAST);
      if(!c.length) continue;
      S.applySwap(cb, i, c[Math.floor(rnd()*Math.min(c.length, 20))].p); done++;
      S.showCombo(ci, {scroll:false}); S.refreshCard(ci);
      const t = allText(H.currentCard());
      const paths = findAll(H.currentCard(), e=>e.tag==='path' && e.attrs && e.attrs['data-sp']).length;
      if(/undefined|NaN|\[object \w+/.test(t) || paths !== cb.rows.length) broken++;
    }
  });
  console.log('  '+done+' random swaps, broken cards: '+broken);
  ok(broken === 0, broken+' cards broke under random swapping');
})();

console.log('\n'+(fails? 'FAILURES: '+fails : 'ALL CHECKS PASSED')+
            (warns? '   warnings: '+warns : ''));
process.exit(fails?1:0);
