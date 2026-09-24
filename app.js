/* Botanical Bed Builder - recommendation engine and UI.
   No dependencies. Data comes from window.BB_DATA (data.js).
   Optional: zip_regions.json, written by fetch_authoritative.py, is loaded if present and
   overrides the prefix-based ZIP resolution with a true point-in-polygon result. */
(function () {
"use strict";

var D = window.BB_DATA;
if (!D) { document.getElementById("status").textContent =
  "Could not load data.js. Run: python3 build_reference_data.py && python3 build_data.py"; return; }

var PLANTS = D.plants, TEMPLATES = D.templates, REG = D.regions, SRC = D.sources;
var REGIONS = REG.regions, STATE_ZIPS = REG.state_zips, STATE_REGIONS = REG.state_regions,
    STATE_ZONES = REG.state_zone_range, ZIP3 = REG.zip3_overrides;
var ZIP_EXACT = null;

var MONTHS = ["J","F","M","A","M","J","J","A","S","O","N","D"];
var MONTHNAMES = ["January","February","March","April","May","June","July","August",
                  "September","October","November","December"];
var LAYER_NAME = {STRUCT:"Structural", SEASONAL:"Seasonal theme", MATRIX:"Groundcover matrix",
                  GRASS:"Matrix grass", FERN:"Fern layer", SHRUB:"Shrub backbone",
                  FILLER:"Dynamic filler"};
var LAYER_SHORT = {STRUCT:"Structural", SEASONAL:"Seasonal", MATRIX:"Groundcover",
                   GRASS:"Grass", FERN:"Fern", SHRUB:"Shrub", FILLER:"Filler"};
var FALLBACK = {FERN:["MATRIX","SHRUB"], GRASS:["MATRIX"], MATRIX:["GRASS","FILLER"],
                STRUCT:["SHRUB","SEASONAL"], SHRUB:["STRUCT"], FILLER:["SEASONAL","MATRIX"],
                SEASONAL:["FILLER","MATRIX"]};
var GROUND_LAYERS = {MATRIX:1, GRASS:1, FERN:1};

var HEX = {yellow:"#d9a72a",gold:"#c9911f",golden:"#c9a227",orange:"#d2802c",apricot:"#dd9a5e",
  coral:"#e07a5f",red:"#b8412c",scarlet:"#b8342a",maroon:"#6d3345",magenta:"#b03a78",
  rose:"#c4577e",pink:"#d98aa6",purple:"#7a4f9c",violet:"#6f4f9e",lavender:"#9b8fc4",
  blue:"#4f6fb5",sky:"#6f9bd1",light:"#8fb0d9",pale:"#a8c0dd",deep:"#3d5ba9",white:"#c9cdbe",
  cream:"#d8cfa8",greenish:"#9aab7f",green:"#7b9a5c",silver:"#b0b3a8",tan:"#bda878",
  bronze:"#a5793f",rust:"#b5773a",dusty:"#c99aa6",inconspicuous:"#a8ad9a",none:"#9fae93",
  brown:"#a08a6a",smoke:"#c9a3ad"};

function el(id){ return document.getElementById(id); }
function mk(t,c,txt){ var e=document.createElement(t); if(c)e.className=c;
  if(txt!==undefined)e.textContent=txt; return e; }
function esc(s){ return String(s).replace(/[&<>"']/g,function(m){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]; }); }
function genus(p){ return p.sci.split(" ")[0]; }
function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""); }
function colorHex(colors){
  for(var i=0;i<colors.length;i++){
    var words = colors[i].toLowerCase().split(/[\s-]+/);
    for(var j=0;j<words.length;j++) if(HEX[words[j]]) return HEX[words[j]];
  }
  return "#9fae93";
}

/* deterministic RNG: the same inputs always produce the same designs */
function rngFrom(str){
  var h=1779033703^str.length;
  for(var i=0;i<str.length;i++){ h=Math.imul(h^str.charCodeAt(i),3432918353); h=h<<13|h>>>19; }
  return function(){ h=Math.imul(h^h>>>16,2246822507); h=Math.imul(h^h>>>13,3266489909);
    return ((h^=h>>>16)>>>0)/4294967296; };
}

var SPREADY = /rhizomat|suckers|spreads|self-sow|reseed|stolon|coloni|runner|aggressiv|freely|runs /i;
PLANTS.forEach(function(p){
  p.spready   = SPREADY.test(p.notes);
  p.deerOK    = p.wildlife.indexOf("deer_resistant")>=0;
  p.winterInt = p.wildlife.indexOf("winter_seedhead")>=0 || p.wildlife.indexOf("winter_structure")>=0;
  p.hummer    = p.wildlife.indexOf("hummingbird")>=0;
  p.evergreen = p.wildlife.indexOf("evergreen")>=0;
  p.chex      = colorHex(p.colors);
});

/* ------------------------------------------------ ZIP resolution */
function resolveZip(zip){
  if(!/^\d{5}$/.test(zip)) return {error:"Enter a five-digit US ZIP code."};
  if(ZIP_EXACT && ZIP_EXACT[zip]){
    var x = ZIP_EXACT[zip];
    return {exact:true, state:x.state||"", place:x.place||x.epa_l3||"", regions:x.regions,
            zones:[x.zone_min||x.zone||5, x.zone_max||x.zone||9], epa:x.epa_l3||"",
            lat:x.lat, lon:x.lon};
  }
  var n = parseInt(zip,10), state=null;
  for(var s in STATE_ZIPS){
    var rr = STATE_ZIPS[s];
    for(var i=0;i<rr.length;i++){ if(n>=rr[i][0] && n<=rr[i][1]){ state=s; break; } }
    if(state) break;
  }
  if(!state) return {error:"ZIP "+zip+" is not inside any of the published United States ZIP "+
      "ranges. Check the digits."};
  var regs = (STATE_REGIONS[state]||[]).slice();
  var zones = (STATE_ZONES[state]||[5,8]).slice();
  var place = "", ov = ZIP3[zip.slice(0,3)];
  if(ov){ if(ov.regions&&ov.regions.length) regs = ov.regions.slice();
          if(ov.zones) zones = ov.zones.slice();
          if(ov.place) place = ov.place; }
  if(!regs.length) return {error:"ZIP "+zip+" is in "+state+", which this tool does not yet cover. "+
      "Alaska, Hawaii and the territories fall outside the ten continental ecoregions in the "+
      "database and need their own regional species lists."};
  return {state:state, place:place, regions:regs, zones:zones, refined:!!ov};
}

/* ------------------------------------------------ species pool */
function buildPool(c){
  return PLANTS.filter(function(p){
    if(p.regions.indexOf(c.region)<0) return false;
    if(c.zone < p.zmin) return false;              /* cold hardiness: hard limit */
    if(c.zone > p.zmax + 1) return false;          /* warm end: one zone of tolerance */
    if(p.light.indexOf(c.light)<0) return false;
    if(p.moist.indexOf(c.soil)<0) return false;
    if(p.hmax > c.maxh) return false;
    if(c.deer && !p.deerOK && p.layer!=="GRASS" && p.layer!=="FERN") return false;
    if(!c.spread && p.spready) return false;
    return true;
  });
}
function byLayer(pool){
  var m={}; Object.keys(LAYER_NAME).forEach(function(k){ m[k]=[]; });
  pool.forEach(function(p){ m[p.layer].push(p); }); return m;
}

var PAL = {
  warm:["yellow","gold","orange","red","scarlet","apricot","coral","bronze","rust","golden"],
  cool:["blue","violet","purple","lavender","white","silver","pale","greenish","sky"],
  hot:["red","scarlet","coral","orange","magenta","rose"],
  soft:["pink","lavender","white","cream","pale","rose","blue"],
  restrained:["white","cream","green","silver","tan","bronze","greenish","none"],
  any:null
};
function paletteBonus(p, pal){
  var want = PAL[pal||"any"]; if(!want) return 0;
  var txt = p.colors.join(" ").toLowerCase(), hit=0;
  want.forEach(function(w){ if(txt.indexOf(w)>=0) hit++; });
  return hit ? 9 : (p.colors[0]==="none" ? 3 : -4);
}

/* weighted draw without replacement, never two species of the same genus */
function pick(cands, n, rnd, scoreFn){
  var used={}, out=[], list=cands.slice();
  while(out.length<n && list.length){
    var scored = list.map(function(p){
      return {p:p, w: Math.pow(Math.max(1,scoreFn(p)),2.1) * (0.55+0.9*rnd())};
    });
    scored.sort(function(a,b){ return b.w-a.w; });
    var chosen=null;
    for(var i=0;i<scored.length;i++){ if(!used[genus(scored[i].p)]){ chosen=scored[i].p; break; } }
    if(!chosen) chosen = scored[0].p;
    used[genus(chosen)]=1; out.push(chosen);
    list = list.filter(function(p){ return p!==chosen; });
  }
  return out;
}
/* greedy bloom-coverage draw for the seasonal layer, so the flowering sequence has no gaps */
function pickSequenced(cands, n, rnd, scoreFn){
  var covered={}, out=[], used={}, list=cands.slice();
  while(out.length<n && list.length){
    var best=null, bestV=-1e9;
    list.forEach(function(p){
      if(used[genus(p)]) return;
      var gain=0; p.bloom_months.forEach(function(m){ if(!covered[m]) gain++; });
      var v = gain*14 + scoreFn(p)*0.7 + rnd()*13;
      if(v>bestV){ bestV=v; best=p; }
    });
    if(!best) best=list[0];
    used[genus(best)]=1; out.push(best);
    best.bloom_months.forEach(function(m){ covered[m]=1; });
    list = list.filter(function(p){ return p!==best; });
  }
  return out;
}

/* ------------------------------------------------ combination builder */
function templateFits(t, c, L){
  if(t.light.indexOf(c.light)<0) return false;
  if(t.moist.indexOf(c.soil)<0) return false;
  if(t.regions && t.regions.indexOf(c.region)<0) return false;
  var ok = true;
  Object.keys(t.counts).forEach(function(lay){
    var min = t.counts[lay][0], avail = (L[lay]||[]).length;
    (FALLBACK[lay]||[]).forEach(function(f){ avail += (L[f]||[]).length; });
    if(avail < min) ok = false;
  });
  if(t.require_host){
    var h = 0;
    Object.keys(L).forEach(function(k){ L[k].forEach(function(p){
      if(p.hosts.join(";").indexOf(t.require_host)>=0) h++; }); });
    if(h < (t.min_host_species||1)) ok = false;
  }
  if(t.require_tag && t.require_tag!=="winter_structure_or_seedhead"){
    var g=0;
    Object.keys(L).forEach(function(k){ L[k].forEach(function(p){
      if(p.wildlife.indexOf(t.require_tag)>=0) g++; }); });
    if(g < (t.min_tag_species||1)) ok = false;
  }
  return ok;
}
function qtyFor(p, sqft){
  var per = p.density_per_10sqft/10, q = Math.round(sqft*per);
  if(p.layer==="SHRUB" || p.hmax>=60) q = Math.max(1,q); else q = Math.max(3,q);
  if(q>2 && q<13 && q%2===0) q += 1;
  return q;
}
function buildCombo(t, c, L, seed, variant, usage){
  usage = usage || {};
  var rnd = rngFrom(c.key+"|"+t.id+"|"+seed+"|"+variant);
  var area = c.w*c.l, picks = [], rows = [];

  function scorer(lay){
    return function(p){
      var s = p.eco_score;
      if(t.rank_by==="lep") s += Math.min(35,(p.lep||0)*0.3);
      s += paletteBonus(p, t.palette);
      if(t.require_tag==="winter_structure_or_seedhead" && p.winterInt) s += 14;
      if(t.require_tag && p.wildlife.indexOf(t.require_tag)>=0) s += 16;
      if(t.require_host && p.hosts.join(";").indexOf(t.require_host)>=0) s += 26;
      if(t.max_height && p.hmax > t.max_height) s -= 28;
      if(lay==="STRUCT" && p.winterInt) s += 8;
      if(lay==="MATRIX" && p.evergreen) s += 6;
      if(c.deer && p.deerOK) s += 5;
      s -= (usage[p.id]||0)*7;               /* keep the designs from converging */
      return Math.max(1,s);
    };
  }
  function minSq(sq,p){ return Math.max(sq, (p.spacing*p.spacing*0.866)/144); }

  Object.keys(t.counts).forEach(function(lay){
    var rangeN = t.counts[lay];
    var n = rangeN[0] + Math.floor(rnd()*(rangeN[1]-rangeN[0]+1));
    var cands = (L[lay]||[]).slice();
    (FALLBACK[lay]||[]).forEach(function(f){
      if(cands.length < n) cands = cands.concat((L[f]||[]).filter(function(p){
        return cands.indexOf(p)<0; }));
    });
    cands = cands.filter(function(p){ return picks.indexOf(p)<0; });
    if(!cands.length) return;
    n = Math.min(n, cands.length);
    var chosen = (lay==="SEASONAL") ? pickSequenced(cands,n,rnd,scorer(lay))
                                    : pick(cands,n,rnd,scorer(lay));
    var layArea = area*(t.area[lay]||0.05);
    chosen.forEach(function(p,i){
      var wgt;
      if(chosen.length===1) wgt = 1;
      else if(lay==="MATRIX"||lay==="GRASS") wgt = i===0 ? 0.55 : 0.45/(chosen.length-1);
      else wgt = 1/chosen.length;
      var sq = layArea*wgt;
      picks.push(p);
      rows.push({p:p, layer:lay, sqft:Math.round(sq*10)/10, qty:qtyFor(p,minSq(sq,p))});
    });
  });
  if(rows.length < 5) return null;

  var months={}, monthCount={}, lepByGenus={}, sb=0, hosts={}, winter=0, ground=0, plants=0;
  rows.forEach(function(r){
    var p=r.p;
    p.bloom_months.forEach(function(m){ months[m]=1; monthCount[m]=(monthCount[m]||0)+1; });
    if(p.lep) lepByGenus[genus(p)] = Math.max(lepByGenus[genus(p)]||0, p.lep);
    if(p.sb) sb++;
    p.hosts.forEach(function(h){ hosts[h]=1; });
    if(p.winterInt) winter++;
    if(GROUND_LAYERS[r.layer]) ground += r.sqft;
    plants += r.qty;
  });
  var lepTotal = Object.keys(lepByGenus).reduce(function(a,k){ return a+lepByGenus[k]; },0);
  var ORD={STRUCT:0,SHRUB:1,SEASONAL:2,FERN:3,GRASS:4,MATRIX:5,FILLER:6};
  rows.sort(function(a,b){
    if(ORD[a.layer]!==ORD[b.layer]) return ORD[a.layer]-ORD[b.layer];
    return b.p.hmax-a.p.hmax;
  });
  return {t:t, rows:rows, area:area, variant:variant, m:{
    lep:lepTotal, sb:sb, hosts:Object.keys(hosts).sort(), winter:winter,
    bloomMonths:Object.keys(months).length,
    strongMonths:Object.keys(monthCount).filter(function(m){ return monthCount[m]>=3; }).length,
    groundPct:Math.round(100*ground/area), species:rows.length, plants:plants,
    monthCount:monthCount}};
}
function generate(c){
  var pool = buildPool(c), L = byLayer(pool), out = [], usage = {};
  function note(cb){ cb.rows.forEach(function(r){ usage[r.p.id]=(usage[r.p.id]||0)+1; }); }
  var fits = TEMPLATES.filter(function(t){ return templateFits(t,c,L); });
  fits.forEach(function(t){ var cb=buildCombo(t,c,L,c.seed,1,usage); if(cb){ out.push(cb); note(cb); } });
  var v = 2;
  while(out.length < 9 && v < 5){
    fits.forEach(function(t){
      if(out.length>=12) return;
      var cb=buildCombo(t,c,L,c.seed,v,usage);
      if(cb && !out.some(function(o){ return o.t.id===t.id &&
          o.rows.map(function(r){return r.p.id;}).join()===
          cb.rows.map(function(r){return r.p.id;}).join(); })){ out.push(cb); note(cb); }
    });
    v++;
  }
  return {combos: out.slice(0,12), pool: pool, fits: fits.length};
}

/* ------------------------------------------------ rendering */
function bloomClass(p){
  var c=p.colors.join(" ").toLowerCase();
  if(/pink|rose|magenta/.test(c)) return "p";
  if(/blue|violet|purple|lavender/.test(c)) return "b";
  if(/red|scarlet|coral/.test(c)) return "r";
  if(/orange|apricot/.test(c)) return "o";
  if(/white|cream|silver|green|tan|none/.test(c)) return "w";
  return "y";
}
function whyText(p){
  var bits=[];
  if(p.lep) bits.push("hosts ~"+p.lep+" caterpillar spp.");
  if(p.sb) bits.push("specialist-bee host");
  if(p.hosts.length) bits.push("larval host: "+p.hosts.slice(0,2).join(", "));
  if(p.hummer) bits.push("hummingbirds");
  if(p.wildlife.indexOf("birdseed")>=0) bits.push("bird seed");
  if(p.wildlife.indexOf("nfix")>=0) bits.push("fixes nitrogen");
  if(p.winterInt) bits.push("winter habitat");
  if(p.evergreen) bits.push("evergreen");
  return bits.slice(0,4).join(" \u00b7 ");
}
function bloomStr(p){
  if(!p.bloom_months.length) return "foliage only";
  var a=MONTHNAMES[p.bloom_start-1].slice(0,3), b=MONTHNAMES[p.bloom_end-1].slice(0,3);
  return a===b? a : a+"\u2013"+b;
}
function renderCalendar(combo){
  var wrap = mk("div","cal");
  wrap.appendChild(mk("h4",null,"Bloom sequence"));
  var tb = mk("table"), thead=mk("tr");
  var th0=mk("th","nm",""); thead.appendChild(th0);
  MONTHS.forEach(function(m,i){ var th=mk("th",null,m); th.title=MONTHNAMES[i]; thead.appendChild(th); });
  tb.appendChild(thead);
  combo.rows.filter(function(r){ return r.p.bloom_months.length; })
    .sort(function(a,b){ return a.p.bloom_start-b.p.bloom_start; })
    .forEach(function(r){
      var tr=mk("tr"), nm=mk("td","nm",r.p.common); nm.title=r.p.sci+" \u2014 "+bloomStr(r.p);
      tr.appendChild(nm);
      for(var m=1;m<=12;m++)
        tr.appendChild(mk("td","cell"+(r.p.bloom_months.indexOf(m)>=0?" on "+bloomClass(r.p):"")));
      tb.appendChild(tr);
    });
  var tot=mk("tr","total"), lbl=mk("td","nm");
  lbl.innerHTML="<b>species in bloom</b>"; tot.appendChild(lbl);
  for(var m=1;m<=12;m++){
    var n=combo.m.monthCount[m]||0;
    var td=mk("td","cell"+(n?" on":""));
    td.title=n+" species in flower in "+MONTHNAMES[m-1];
    if(n) td.style.opacity = String(Math.min(1, 0.35+n*0.18));
    tot.appendChild(td);
  }
  tb.appendChild(tot); wrap.appendChild(tb);
  var note = mk("div","muted small", combo.m.bloomMonths+" of 12 months carry bloom; "+
     combo.m.strongMonths+" month(s) have three or more species flowering at once.");
  note.style.marginTop="5px"; wrap.appendChild(note);
  return wrap;
}
function renderScore(combo){
  var s = mk("div","score");
  s.appendChild(mk("h4",null,"Habitat scorecard"));
  var g = mk("div","metrics");
  function metric(v,k,pct){
    var d=mk("div","metric"); d.appendChild(mk("div","v",v)); d.appendChild(mk("div","k",k));
    if(pct!==undefined){ var b=mk("div","bar"), i=mk("i");
      i.style.width=Math.max(3,Math.min(100,pct))+"%"; b.appendChild(i); d.appendChild(b); }
    return d;
  }
  g.appendChild(metric("~"+combo.m.lep,"butterfly & moth species whose caterpillars can feed here",combo.m.lep/6));
  g.appendChild(metric(combo.m.sb,"species that are documented pollen hosts for specialist bees",combo.m.sb*14));
  g.appendChild(metric(combo.m.bloomMonths+"/12","months with something in flower",combo.m.bloomMonths/12*100));
  g.appendChild(metric(combo.m.groundPct+"%","of the bed held by living groundcover",combo.m.groundPct));
  g.appendChild(metric(combo.m.winter,"species leaving standing winter habitat",combo.m.winter*18));
  g.appendChild(metric(combo.m.species+" / "+combo.m.plants,"species / plants to buy"));
  s.appendChild(g);
  if(combo.m.hosts.length){
    var h=mk("div","hostlist");
    h.innerHTML="<b>Named larval hosts in this bed:</b> "+esc(combo.m.hosts.join(", "))+".";
    s.appendChild(h);
  }
  return s;
}
function renderPlan(combo, c){
  var W=900, scale=W/c.l, H=Math.max(120, Math.round(c.w*scale));
  if(H>420){ H=420; scale=H/c.w; W=Math.round(c.l*scale); }
  var NS="http://www.w3.org/2000/svg";
  function n(tag,attrs){ var e=document.createElementNS(NS,tag);
    for(var k in attrs) e.setAttribute(k,attrs[k]); return e; }
  var svg=n("svg",{viewBox:"0 0 "+(W+2)+" "+(H+2), role:"img",
    "aria-label":"Schematic plan view of the bed, "+c.l+" by "+c.w+" feet"});

  var matrixRows = combo.rows.filter(function(r){ return GROUND_LAYERS[r.layer]; });
  var base = matrixRows.length ? matrixRows[0].p.chex : "#e9ece1";
  svg.appendChild(n("rect",{x:1,y:1,width:W,height:H,fill:base,"fill-opacity":.30,
    stroke:"#9aa48f","stroke-width":1.5,rx:4}));
  var rnd = rngFrom(combo.t.id+combo.variant+"stipple");
  var stipple = Math.round(W*H/1400);
  for(var i=0;i<stipple;i++){
    svg.appendChild(n("circle",{cx:(2+rnd()*(W-4)).toFixed(1), cy:(2+rnd()*(H-4)).toFixed(1),
      r:(1.1+rnd()*1.2).toFixed(1),
      fill: matrixRows.length? matrixRows[Math.floor(rnd()*matrixRows.length)].p.chex : "#9aa48f",
      "fill-opacity":.42}));
  }
  var drifts=[];
  combo.rows.forEach(function(r,idx){
    if(GROUND_LAYERS[r.layer] && r===matrixRows[0]) return;
    var reps = Math.min(r.layer==="FILLER"?4:3, Math.max(2, r.qty));
    var rad = Math.sqrt((r.sqft/reps)*scale*scale/Math.PI);
    for(var k=0;k<reps;k++)
      drifts.push({r:r, rad:Math.max(9, Math.min(rad, H*0.40, W*0.18)), i:idx});
  });
  drifts.sort(function(a,b){ return b.rad-a.rad; });
  var placed=[];
  drifts.forEach(function(d){
    var best=null,bestD=-1e9;
    for(var tries=0;tries<70;tries++){
      var x=d.rad*1.30+rnd()*Math.max(1,(W-d.rad*2.60)),
          y=d.rad*0.90+rnd()*Math.max(1,(H-d.rad*1.80));
      var md=1e9;
      placed.forEach(function(q){
        var dd=Math.sqrt((x-q.x)*(x-q.x)+(y-q.y)*(y-q.y))-(q.rad+d.rad)*0.55;
        if(dd<md) md=dd; });
      if(!placed.length){ best={x:x,y:y}; break; }
      if(md>bestD){ bestD=md; best={x:x,y:y}; }
      if(md>6) break;
    }
    placed.push({x:best.x,y:best.y,rad:d.rad});
    var pts=[], nseg=9;
    for(var s=0;s<nseg;s++){
      var ang=s/nseg*Math.PI*2, rr=d.rad*(0.72+rnd()*0.5);
      pts.push([best.x+Math.cos(ang)*rr*1.22, best.y+Math.sin(ang)*rr*0.85]);
    }
    var path="M"+pts[0][0].toFixed(1)+","+pts[0][1].toFixed(1);
    for(var s2=0;s2<pts.length;s2++){
      var a=pts[s2], b=pts[(s2+1)%pts.length];
      path+=" Q"+((a[0]+b[0])/2+(rnd()-0.5)*d.rad*0.35).toFixed(1)+","+
        ((a[1]+b[1])/2+(rnd()-0.5)*d.rad*0.35).toFixed(1)+" "+
        b[0].toFixed(1)+","+b[1].toFixed(1);
    }
    svg.appendChild(n("path",{d:path+"Z", fill:d.r.p.chex, "fill-opacity":.78,
      stroke:"#5d6b55","stroke-width":.7,"stroke-opacity":.5}));
    var lab=n("text",{x:best.x.toFixed(1), y:(best.y+3.5).toFixed(1), "text-anchor":"middle",
      "font-size":Math.max(9,Math.min(13,d.rad*0.55)).toFixed(1), "font-weight":"700",
      "font-family":"sans-serif", fill:"#20261c","fill-opacity":.85});
    lab.textContent=String(d.i+1);
    svg.appendChild(lab);
  });

  var wrap=mk("div","plan");
  wrap.appendChild(mk("h4",null,"Schematic plan \u2014 "+c.l+" ft \u00d7 "+c.w+" ft"));
  wrap.appendChild(svg);
  var lg=mk("div","legend");
  combo.rows.forEach(function(r,idx){
    var sp=mk("span");
    sp.innerHTML="<i style='background:"+r.p.chex+"'></i>"+(idx+1)+". "+esc(r.p.common);
    lg.appendChild(sp);
  });
  wrap.appendChild(lg);
  var note=mk("div","muted small","Numbers match the plant table. Blobs are drifts rather than "+
    "exact outlines, and the stippled background is the groundcover matrix, which runs "+
    "continuously beneath everything else.");
  note.style.marginTop="6px"; wrap.appendChild(note);
  return wrap;
}
function renderCombo(combo, idx, c){
  var card=mk("div","combo"), head=mk("div","head"), h3=mk("h3");
  h3.innerHTML="<span class='num'>"+("0"+(idx+1)).slice(-2)+"</span>"+esc(combo.t.name)+
    (combo.variant>1 ? " <span class='muted' style='font-size:.8rem;font-weight:400'>variation "+
      combo.variant+"</span>" : "");
  head.appendChild(h3);
  head.appendChild(mk("div","tag",combo.t.tagline));
  var chips=mk("div","chips");
  function chip(t,cl){ chips.appendChild(mk("span","chip"+(cl?" "+cl:""),t)); }
  chip({S:"Full sun",P:"Part shade",H:"Full shade"}[c.light]);
  chip({D:"Dry soil",M:"Average soil",W:"Moist to wet"}[c.soil]);
  chip("Zone "+c.zone);
  chip(REGIONS[c.region].name);
  chip(combo.m.species+" species","g");
  chip(combo.m.plants+" plants","g");
  chip("~"+combo.m.lep+" caterpillar spp.","g");
  if(combo.m.sb) chip(combo.m.sb+" specialist-bee hosts","b");
  chip(combo.m.bloomMonths+" months of bloom","o");
  head.appendChild(chips); card.appendChild(head);

  var body=mk("div","body"), cols=mk("div","cols"), left=mk("div"), right=mk("div");
  var tbl=mk("table","plants"), tr=mk("tr");
  ["#","Layer","Plant","Bloom","Height","Qty","Spacing"].forEach(function(x){
    tr.appendChild(mk("th",null,x)); });
  tbl.appendChild(tr);
  combo.rows.forEach(function(r,i){
    var p=r.p, row=mk("tr"), c0=mk("td");
    c0.innerHTML="<span class='qty'>"+(i+1)+"</span>"; row.appendChild(c0);
    var c1=mk("td");
    c1.innerHTML="<span class='layerTag "+r.layer+"'>"+LAYER_SHORT[r.layer]+"</span>";
    row.appendChild(c1);
    var c2=mk("td");
    c2.innerHTML="<span class='cn'>"+esc(p.common)+"</span><br><span class='sci muted'>"+
      esc(p.sci)+"</span><div class='why'>"+esc(whyText(p))+"</div>";
    row.appendChild(c2);
    row.appendChild(mk("td",null,bloomStr(p)));
    row.appendChild(mk("td",null,(p.hmin===p.hmax? p.hmax : p.hmin+"\u2013"+p.hmax)+'"'));
    var c5=mk("td"); c5.innerHTML="<span class='qty'>"+r.qty+"</span>"; row.appendChild(c5);
    row.appendChild(mk("td",null,p.spacing+'" o.c.'));
    tbl.appendChild(row);
  });
  left.appendChild(tbl);
  left.appendChild(renderPlan(combo,c));
  right.appendChild(renderScore(combo));
  right.appendChild(renderCalendar(combo));
  cols.appendChild(left); cols.appendChild(right); body.appendChild(cols);

  var det=mk("details","notes");
  det.appendChild(mk("summary",null,"Layout, establishment and maintenance for this design"));
  var inner=mk("div","inner");
  function para(label,txt){ inner.appendChild(mk("h5",null,label)); inner.appendChild(mk("p",null,txt)); }
  para("How to lay it out", combo.t.design);
  para("Maintenance", combo.t.care);
  para("Why it works ecologically", combo.t.eco);
  inner.appendChild(mk("h5",null,"Plant-by-plant notes"));
  var ul=mk("ul"); ul.style.paddingLeft="20px";
  combo.rows.forEach(function(r){
    var li=mk("li"); li.style.marginBottom="6px";
    var edge = c.zone > r.p.zmax ? " <strong>Zone "+c.zone+" is one step above its published limit "+
      "of "+r.p.zmax+": workable in most cases, but site it in the coolest part of the bed.</strong>" : "";
    li.innerHTML="<em>"+esc(r.p.sci)+"</em> (<b>"+esc(r.p.common)+"</b>) \u2014 "+esc(r.p.notes)+
      " <span class='muted'>Hardy in zones "+r.p.zmin+"\u2013"+r.p.zmax+"; family "+
      esc(r.p.family)+".</span>"+edge;
    ul.appendChild(li);
  });
  inner.appendChild(ul); det.appendChild(inner); body.appendChild(det);
  card.appendChild(body);

  var foot=mk("div","foot");
  var b1=mk("button","btn ghost sm","Copy plant list");
  b1.onclick=function(){ copyText(comboText(combo,c), b1); };
  var b2=mk("button","btn ghost sm","Download CSV");
  b2.onclick=function(){ downloadCSV(comboCSV(combo,c), slug(combo.t.name)+"-"+c.zip+".csv"); };
  var b3=mk("button","btn ghost sm","Verify these species at BONAP");
  b3.onclick=function(){ window.open("http://bonap.net/napa","_blank","noopener"); };
  foot.appendChild(b1); foot.appendChild(b2); foot.appendChild(b3);
  card.appendChild(foot);
  return card;
}

/* ------------------------------------------------ export */
function comboText(combo,c){
  var out = combo.t.name+"\n"+combo.t.tagline+"\n\n"+
    "Site: ZIP "+c.zip+" | "+REGIONS[c.region].name+" | USDA zone "+c.zone+" | "+
    {S:"full sun",P:"part shade",H:"full shade"}[c.light]+" | "+
    {D:"dry",M:"average",W:"moist to wet"}[c.soil]+" soil | "+
    c.l+" x "+c.w+" ft ("+combo.area+" sq ft)\n\n";
  combo.rows.forEach(function(r,i){
    out += (i+1)+". "+r.qty+" x "+r.p.sci+" ("+r.p.common+") - "+LAYER_NAME[r.layer]+
      ", "+r.p.spacing+'" o.c., '+bloomStr(r.p)+"\n";
  });
  out += "\nTotals: "+combo.m.species+" species, "+combo.m.plants+" plants. ~"+combo.m.lep+
    " Lepidoptera species supported; "+combo.m.sb+" specialist-bee host species; bloom in "+
    combo.m.bloomMonths+" of 12 months; "+combo.m.groundPct+"% living groundcover.\n";
  return out;
}
function comboCSV(combo,c){
  var rows=[["design","layer","qty","scientific_name","common_name","family","spacing_in",
    "height_in_min","height_in_max","bloom_start","bloom_end","flower_color","usda_zones",
    "lepidoptera_genus_approx","specialist_bee_host","larval_hosts","wildlife_value","notes"]];
  combo.rows.forEach(function(r){
    var p=r.p;
    rows.push([combo.t.name, LAYER_NAME[r.layer], r.qty, p.sci, p.common, p.family, p.spacing,
      p.hmin, p.hmax, p.bloom_start||"", p.bloom_end||"", p.colors.join(" "),
      p.zmin+"-"+p.zmax, p.lep||"", p.sb?"yes":"", p.hosts.join("; "),
      p.wildlife.join("; "), p.notes]);
  });
  return rows;
}
function csvString(rows){
  return rows.map(function(r){ return r.map(function(v){
    v=String(v==null?"":v);
    return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }).join(","); }).join("\n");
}
function downloadCSV(rows,name){
  var blob=new Blob(["\ufeff"+csvString(rows)],{type:"text/csv;charset=utf-8"});
  var a=document.createElement("a");
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(a.href); },2000);
}
function copyText(txt, btn){
  var label=btn.textContent;
  function done(){ btn.textContent="Copied"; setTimeout(function(){ btn.textContent=label; },1400); }
  function fallback(){
    var ta=document.createElement("textarea"); ta.value=txt;
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand("copy"); done(); }catch(e){}
    ta.remove();
  }
  if(navigator.clipboard&&navigator.clipboard.writeText)
    navigator.clipboard.writeText(txt).then(done,fallback);
  else fallback();
}

/* ------------------------------------------------ UI */
var LAST=null;
function readForm(){
  return {zip:el("zip").value.trim(), region:el("region").value,
    zone:parseInt(el("zone").value,10), soil:el("soil").value,
    light:(document.querySelector('input[name=light]:checked')||{}).value||"S",
    w:Math.max(2,parseInt(el("w").value,10)||6), l:Math.max(2,parseInt(el("l").value,10)||16),
    maxh:parseInt(el("maxh").value,10)||999, deer:el("deer").value==="1",
    spread:el("spread").value==="1", seed:(LAST&&LAST.seed)||1};
}
function updateZip(){
  var zip=el("zip").value.trim(), box=el("zipOut");
  if(zip.length<5){ box.className=""; box.innerHTML=""; return null; }
  var r=resolveZip(zip);
  box.className="show"+(r.error?" warn":"");
  if(r.error){
    box.innerHTML="<b>"+esc(r.error)+"</b>";
    el("region").innerHTML="<option value=''>\u2014</option>";
    el("zone").innerHTML="<option value=''>\u2014</option>";
    return null;
  }
  var rsel=el("region"); rsel.innerHTML="";
  r.regions.forEach(function(code,i){
    var o=mk("option",null,REGIONS[code].name+(i===0?"  (best match)":"")); o.value=code;
    rsel.appendChild(o);
  });
  Object.keys(REGIONS).forEach(function(code){
    if(r.regions.indexOf(code)<0){
      var o=mk("option",null,REGIONS[code].name+"  (other)"); o.value=code; rsel.appendChild(o);
    }
  });
  rsel.value = r.regions[0];
  var zsel=el("zone"); zsel.innerHTML="";
  var lo=r.zones[0], hi=r.zones[1];
  for(var z=Math.max(1,lo-1); z<=Math.min(13,hi+1); z++){
    var o=mk("option",null,"Zone "+z+(z>=lo&&z<=hi?"":"  (outside the usual range here)"));
    o.value=z; zsel.appendChild(o);
  }
  zsel.value = String(Math.floor((lo+hi)/2));
  var reg=REGIONS[r.regions[0]];
  box.innerHTML = "<b>"+esc(r.state)+(r.place? " \u2014 "+esc(r.place):"")+"</b>"+
    (r.exact? " <span class='small'>(exact ZIP lookup)</span>":"")+
    "<div class='small' style='margin-top:5px'><strong>"+esc(reg.name)+
    "</strong> &mdash; EPA Level I: "+esc(reg.epa_l1)+"<br>"+esc(reg.blurb)+"</div>"+
    "<div class='small' style='margin-top:6px'>Likely USDA hardiness zone "+
    (lo===hi? lo : lo+"\u2013"+hi)+". "+
    (r.exact? "Sampled from the USDA hardiness raster." :
      r.refined? "Refined using the three-digit ZIP prefix." :
      "Estimated from the state-wide range.")+
    " Confirm at <a href='https://planthardiness.ars.usda.gov/' target='_blank' "+
    "rel='noopener'>planthardiness.ars.usda.gov</a>.</div>";
  return r;
}
function run(){
  var c=readForm();
  if(!/^\d{5}$/.test(c.zip)){
    el("status").innerHTML="<span class='muted'>Enter a five-digit ZIP code to begin.</span>";
    return;
  }
  if(!c.region||!c.zone){
    var rz=updateZip(); c=readForm();
    if(!c.region && rz && rz.regions && rz.regions.length) c.region=rz.regions[0];
    if(!c.zone && rz && rz.zones) c.zone=Math.floor((rz.zones[0]+rz.zones[1])/2);
  }
  if(!c.region||!c.zone){
    el("status").innerHTML="<span class='muted'>That ZIP code could not be resolved to an "+
      "ecoregion. See the message above the button.</span>";
    return;
  }
  c.key=[c.zip,c.region,c.zone,c.soil,c.light,c.w,c.l,c.maxh,c.deer,c.spread].join("~");
  LAST=c;
  var res=generate(c), host=el("combos");
  host.innerHTML="";
  el("resultsHead").hidden = !res.combos.length;
  if(!res.combos.length){
    el("status").innerHTML="<div class='callout red'><strong>No combination could be assembled "+
      "from the "+res.pool.length+" eligible species.</strong> The filters are probably too tight. "+
      "Try removing the height limit, allowing spreading plants, turning off high deer pressure, "+
      "or choosing a neighbouring ecoregion. Full shade plus dry soil plus a low height cap is the "+
      "hardest combination in the database, and in the arid Southwest it is a real horticultural "+
      "constraint rather than a gap in the data.</div>";
    return;
  }
  el("status").innerHTML="";
  el("resultsSummary").innerHTML = res.combos.length+" combination"+
    (res.combos.length===1?"":"s")+" drawn from <b>"+res.pool.length+"</b> species native to "+
    esc(REGIONS[c.region].name)+" that tolerate "+
    {S:"full sun",P:"part shade",H:"full shade"}[c.light]+" and "+
    {D:"dry",M:"average",W:"moist to wet"}[c.soil]+" soil in zone "+c.zone+
    ". Bed area "+(c.w*c.l)+" sq ft.";
  res.combos.forEach(function(cb,i){ host.appendChild(renderCombo(cb,i,c)); });

  var q="?zip="+c.zip+"&region="+c.region+"&zone="+c.zone+"&soil="+c.soil+"&light="+c.light+
    "&w="+c.w+"&l="+c.l+"&maxh="+c.maxh+"&deer="+(c.deer?1:0)+"&spread="+(c.spread?1:0)+
    "&seed="+c.seed;
  var pl=el("permalink"); pl.href=q; el("permalinkWrap").hidden=false;
  pl.onclick=function(e){ e.preventDefault(); copyText(location.origin+location.pathname+q, pl); };
  LAST.res=res;
  if(el("results").scrollIntoView) el("results").scrollIntoView({behavior:"smooth",block:"start"});
}
el("zip").addEventListener("input",function(){ updateZip(); });
el("bed").addEventListener("submit",function(e){ e.preventDefault(); run(); });
el("shuffle").addEventListener("click",function(){
  if(!LAST){ run(); return; } LAST.seed=(LAST.seed||1)+1; run(); });
el("printBtn").addEventListener("click",function(){ window.print(); });
el("csvAll").addEventListener("click",function(){
  if(!LAST||!LAST.res) return;
  var rows=null;
  LAST.res.combos.forEach(function(cb){
    var r=comboCSV(cb,LAST);
    if(!rows) rows=r; else rows=rows.concat(r.slice(1));
  });
  downloadCSV(rows,"botanical-bed-combinations-"+LAST.zip+".csv");
});

/* ------------------------------------------------ plant database browser */
(function browse(){
  var breg=el("breg"), blay=el("blay");
  var o0=mk("option",null,"All regions"); o0.value=""; breg.appendChild(o0);
  Object.keys(REGIONS).forEach(function(k){
    var o=mk("option",null,REGIONS[k].name); o.value=k; breg.appendChild(o); });
  var o1=mk("option",null,"All layers"); o1.value=""; blay.appendChild(o1);
  Object.keys(LAYER_NAME).forEach(function(k){
    var o=mk("option",null,LAYER_NAME[k]); o.value=k; blay.appendChild(o); });

  function draw(){
    var q=el("bq").value.toLowerCase().trim(), rg=breg.value, ly=blay.value,
        lt=el("blight").value, sort=el("bsort").value;
    var rows=PLANTS.filter(function(p){
      if(rg && p.regions.indexOf(rg)<0) return false;
      if(ly && p.layer!==ly) return false;
      if(lt && p.light.indexOf(lt)<0) return false;
      if(q){
        var hay=(p.sci+" "+p.common+" "+p.family+" "+p.hosts.join(" ")+" "+
                 p.wildlife.join(" ")+" "+p.notes).toLowerCase();
        if(hay.indexOf(q)<0) return false;
      }
      return true;
    });
    rows.sort(function(a,b){
      if(sort==="eco") return b.eco_score-a.eco_score;
      if(sort==="lep") return (b.lep||0)-(a.lep||0);
      if(sort==="h")   return b.hmax-a.hmax;
      return a.sci.localeCompare(b.sci);
    });
    el("browseCount").textContent = rows.length+" of "+PLANTS.length+
      " species shown. Every entry is native to at least one United States ecoregion.";
    var t=el("browseTable"); t.innerHTML="";
    var hr=mk("tr");
    ["Plant","Family","Regions","Zones","Light","Soil","Height","Bloom","Caterpillars","Value"]
      .forEach(function(h){ hr.appendChild(mk("th",null,h)); });
    t.appendChild(hr);
    rows.slice(0,400).forEach(function(p){
      var tr=mk("tr"), c1=mk("td");
      c1.innerHTML="<span class='cn'>"+esc(p.common)+"</span><br><span class='sci muted'>"+
        esc(p.sci)+"</span> <span class='layerTag "+p.layer+"'>"+LAYER_SHORT[p.layer]+"</span>";
      tr.appendChild(c1);
      tr.appendChild(mk("td",null,p.family));
      tr.appendChild(mk("td",null,p.regions.join(" ")));
      tr.appendChild(mk("td",null,p.zmin+"\u2013"+p.zmax));
      tr.appendChild(mk("td",null,p.light.join("")));
      tr.appendChild(mk("td",null,p.moist.join("")));
      tr.appendChild(mk("td",null,p.hmax+'"'));
      tr.appendChild(mk("td",null,bloomStr(p)));
      tr.appendChild(mk("td",null,p.lep? "~"+p.lep : "\u2014"));
      var c2=mk("td","small",whyText(p)||"\u2014"); tr.appendChild(c2);
      t.appendChild(tr);
    });
    if(rows.length>400){
      var tr2=mk("tr"), td=mk("td","muted small",
        "Showing the first 400 matches \u2014 narrow the filters to see more.");
      td.colSpan=10; tr2.appendChild(td); t.appendChild(tr2);
    }
  }
  ["bq","breg","blay","blight","bsort"].forEach(function(id){
    el(id).addEventListener("input",draw); el(id).addEventListener("change",draw); });
  draw();
})();

/* ------------------------------------------------ sources */
(function sources(){
  var host=el("srcCards");
  SRC.forEach(function(s){
    var d=mk("div","src");
    d.innerHTML="<h4><a href='"+esc(s.url)+"' target='_blank' rel='noopener'>"+esc(s.name)+
      "</a></h4><div class='org'>"+esc(s.org)+"</div><p>"+esc(s.use)+
      "</p><div class='meta'><strong>Format:</strong> "+esc(s.format)+
      "<br><strong>Terms:</strong> "+esc(s.license)+
      (s.download? "<br><a href='"+esc(s.download)+"' target='_blank' rel='noopener'>Direct "+
        "download</a>":"")+"</div>";
    host.appendChild(d);
  });
  el("footStats").textContent = PLANTS.length+" species \u00b7 "+TEMPLATES.length+
    " design templates \u00b7 "+Object.keys(REGIONS).length+" ecoregions \u00b7 "+SRC.length+
    " cited data sources. Lepidoptera figures are approximate genus-level values; verify locally.";
})();

/* ------------------------------------------------ exact ZIP lookup + deep links */
function applyQuery(){
  var p;
  try { p = new URLSearchParams(location.search); } catch(e){ p = null; }
  if(!p || !p.get("zip")){
    el("status").innerHTML="<span class='muted'>Enter a ZIP code and shade level above, then "+
      "press <strong>Generate combinations</strong>.</span>";
    return;
  }
  el("zip").value=p.get("zip"); updateZip();
  ["region","zone","soil","w","l","maxh","deer","spread"].forEach(function(k){
    var v=p.get(k); if(v!==null && el(k)) el(k).value=v; });
  var lt=p.get("light");
  if(lt){ var r=document.querySelector('input[name=light][value="'+lt+'"]'); if(r) r.checked=true; }
  LAST={seed:parseInt(p.get("seed"),10)||1};
  run();
}
if(typeof fetch === "function"){
  fetch("zip_regions.json").then(function(r){ return r.ok? r.json():null; })
    .then(function(j){
      if(j){
        ZIP_EXACT=j.zips||j;
        var n=Object.keys(ZIP_EXACT).length;
        el("regionHint").innerHTML="Resolved from an exact per-ZIP lookup ("+
          n.toLocaleString()+" ZIP codes built from Census ZCTA centroids intersected with EPA "+
          "ecoregion polygons and the USDA hardiness raster).";
        if(el("zip").value.length===5) updateZip();
      }
    })
    .catch(function(){})
    .then(applyQuery, applyQuery);
} else { applyQuery(); }

})();
