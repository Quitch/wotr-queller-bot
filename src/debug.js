// ===== Debug log: action history, error capture and the exportable report =====
// Everything here lives outside the game state (S), so it is never saved, undone or shown to the player during play.
// The action history and errors are kept in localStorage (qb.debug) so a log can still be exported after a reload — including the
// reload that failed to render a saved game.
(function(){
const Q=window.QB, F=Q.F;
const FORMAT="queller-debug/1";
const LIMITS={actions:300, errors:30, walks:8, states:5};
const D={actions:[], errors:[], walks:[], inflight:null, preWalk:null, storage:null};

function push(arr,e,lim){ arr.push(e); while(arr.length>lim) arr.shift(); }
function store(){ if(!D.storage) return; try{ D.storage.set(JSON.stringify({actions:D.actions,errors:D.errors,walks:D.walks})); }catch(e){} }
// storage: {get():string|null, set(string)} — localStorage in the app, anything in tests
function restore(storage){ D.storage=storage||null; if(!storage) return; try{ const o=JSON.parse(storage.get()||"null"); if(o){ D.actions=(o.actions||[]).slice(-LIMITS.actions); D.errors=(o.errors||[]).slice(-LIMITS.errors); D.walks=(o.walks||[]).slice(-LIMITS.walks); } }catch(e){} }

// A one-line picture of the game after an action: enough to follow the timeline without opening the full state.
function digest(S){
 if(!S) return null;
 const w=S.walk, pool=S.dice.pool||[];
 return {turn:S.turn, phase:S.phase, strategy:S.strategy, walk:w?(w.page+"."+w.node):null, prompt:w&&w.prompt?w.prompt.type:null, done:w?!!w.done:null, result:w?w.result:null, trail:w?w.trail.length:0,
  dice:pool.length?pool.map(d=>(d.k==="F"?"F:":"")+(d.face||"-").replace("/","+")+"/"+d.st[0]).join(" "):null, hunt:S.dice.hunt, hand:S.cards.hand.length, faction:S.cards.factionHand.length, table:S.cards.table.length, rings:S.board.rings, log:S.log.length};
}
function safeDigest(S){ try{ return digest(S); }catch(e){ return {digestFailed:String(e&&e.message||e)}; } }
function walkKey(S,w){ return S.turn+"|"+w.entry.page+"|"+w.entry.start+"|"+w.trail.length+"|"+(w.result||""); }
function compactWalk(S,w,note){ return {t:Date.now(), turn:S.turn, entry:w.entry, page:w.page, node:w.node, result:w.result, note:note||null, die:w.die, mode:w.mode, trail:w.trail.map(e=>{ const o={kind:e.kind,text:e.text,page:e.page,node:e.node}; if(e.answer!=null) o.answer=e.answer; if(e.auto) o.auto=true; if(e.why) o.why=e.why; if(e.card) o.card=e.card; if(e.choice) o.choice=e.choice; if(e.steps) o.steps=e.steps; return o; })}; }
// Walks are recorded once they finish (or are abandoned), so the trail of a walk the player has moved on from is still in the log.
function noteWalk(S,w,note){ const key=walkKey(S,w); const last=D.walks[D.walks.length-1]; if(last&&last.key===key) return; const c=compactWalk(S,w,note); c.key=key; push(D.walks,c,LIMITS.walks); }

// begin/end bracket a state-changing action (ui.js act()); action() records something that changed no game state.
function begin(info,S){ D.inflight=Object.assign({t:Date.now()},info||{a:"act"}); D.preWalk=S?S.walk:null; if(S) D.inflight.before=safeDigest(S); }
function end(S){
 const e=D.inflight||{t:Date.now(),a:"act"}; D.inflight=null;
 if(S){ e.after=safeDigest(S); const w=S&&S.walk;
  if(D.preWalk && D.preWalk!==w && !D.preWalk.done && e.a!=="undo" && e.a!=="load") noteWalk(S,D.preWalk,"replaced or abandoned");
  if(w && w.done) noteWalk(S,w); }
 D.preWalk=null; push(D.actions,e,LIMITS.actions); store(); return e;
}
function action(info,S){ begin(info,S); return end(S); }
function error(err,info,S){
 const e=Object.assign({t:Date.now()}, info||{});
 if(err&&typeof err==="object"){ e.message=String(err.message||err); e.name=err.name; if(err.stack) e.stack=String(err.stack).split("\n").slice(0,12).join("\n"); }
 else e.message=String(err);
 if(D.inflight&&!e.during) e.during=D.inflight;
 else if(!e.during && D.actions.length) e.lastAction=D.actions[D.actions.length-1];
 if(S) e.state=safeDigest(S);
 push(D.errors,e,LIMITS.errors); D.inflight=null; store(); return e;
}

const iso=t=>{ try{ return new Date(t).toISOString(); }catch(e){ return String(t); } };
const withTimes=list=>list.map(e=>Object.assign({when:iso(e.t)},e));
function summary(S,env,errors){
 const s=[];
 s.push("Queller Bot Runner version "+Q.VERSION+(env&&env.built?" (built "+env.built+")":""));
 if(!S) s.push("No game in progress (New game screen)");
 else {
  s.push("Turn "+S.turn+", "+S.phase+(S.strategy?", "+S.strategy+" strategy":"")+"; settings: dice "+(S.settings.dice?"on":"off")+", cards "+(S.settings.cards?"on":"off")+", tracker "+(S.settings.tracker?"on":"off")+", WoME "+(S.settings.wome?"on":"off"));
  const w=S.walk; if(w) s.push("Walk: "+(F[w.entry.page]?F[w.entry.page].name:w.entry.page)+" from “"+Q.norm(w.entry.start)+"”, now at "+w.page+"."+w.node+(w.prompt?", prompt "+w.prompt.type:"")+(w.done?", finished ("+w.result+")":"")+", "+w.trail.length+" trail entries");
  else s.push("No walk in progress");
 }
 if(errors.length) s.push(errors.length+" error"+(errors.length===1?"":"s")+" recorded; latest: "+errors[errors.length-1].message);
 else s.push("No errors recorded");
 s.push(D.actions.length+" actions in the history");
 return s;
}
// Build the log. ctx: {S, history (undo snapshots, JSON strings), report, env, dom, storage, brokenAutosave, opts}
function build(ctx){
 ctx=ctx||{}; const S=ctx.S||null;
 const prev=(ctx.history||[]).slice(-LIMITS.states).reverse().map(j=>{ try{ return JSON.parse(j); }catch(e){ return {unparseable:String(e)}; } });
 let broken=null; if(ctx.brokenAutosave){ try{ broken=JSON.parse(ctx.brokenAutosave); }catch(e){ broken={unparseable:String(e), head:String(ctx.brokenAutosave).slice(0,400)}; } }
 const errors=withTimes(D.errors);
 return {
  format:FORMAT, app:{version:Q.VERSION, built:(ctx.env&&ctx.env.built)||null}, exported:iso(Date.now()),
  report:ctx.report||"", summary:summary(S,ctx.env,errors),
  environment:ctx.env||null, dom:ctx.dom||null, storage:ctx.storage||null, options:ctx.opts||null,
  errors, actions:withTimes(D.actions), walks:withTimes(D.walks).map(w=>{ const o=Object.assign({},w); delete o.key; return o; }),
  state:S, previousStates:prev, undoDepth:(ctx.history||[]).length, brokenAutosave:broken,
  data:{pages:Object.keys(F).length, nodes:Object.keys(F).reduce((n,k)=>n+Object.keys(F[k].nodes).length,0), edges:Object.keys(F).reduce((n,k)=>n+F[k].edges.length,0), cards:Q.CARDS.length}
 };
}
function text(ctx){ return JSON.stringify(build(ctx),null,1); }
function fileName(S){ return "queller-debug"+(S?"-turn"+S.turn:"")+"-"+iso(Date.now()).replace(/[:.]/g,"-").slice(0,19)+".json"; }
function reset(){ D.actions=[]; D.errors=[]; D.walks=[]; D.inflight=null; store(); }

window.QB_DEBUG={ FORMAT, LIMITS, restore, begin, end, action, error, digest, build, text, fileName, reset, get errors(){ return D.errors; }, get actions(){ return D.actions; }, get walks(){ return D.walks; } };
})();
