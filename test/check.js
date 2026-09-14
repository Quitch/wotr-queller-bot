// Static consistency checks between walk.js / engine.js and the flowchart + card data. Exit 1 on any failure.
const fs=require('fs'), path=require('path');
const W=require('./load.js')(); const F=W.QB_FLOW, Q=W.QB;
let fails=0; const fail=m=>{ fails++; console.log('FAIL',m); };
// 1. every "PAGE.node" key in walk.js names a real node
const src=fs.readFileSync(path.join(__dirname,'..','src','walk.js'),'utf8');
for(const m of src.matchAll(/"([A-Z0-9]+)\.([A-Za-z0-9]+)"/g)){ const [p,n]=[m[1],m[2]]; if(F[p] && !F[p].nodes[n]) fail('walk.js refers to missing node '+p+'.'+n); }
// 2. every criterion on a card priority list is understood by critFn
const S=Q.newState({dice:true,cards:true,tracker:true,wome:true});
const cardLists=['C14.disc14','C14.disc18','C14.discF','M14.disc','M14.discF','EV.prefPri','EV.anyPri','EV.discPri','FA.playPri','FA.discPri','BA.sortiePri','BA.wkPri','BA.atkPri','BA.defPri'];
for(const k of cardLists){ const [p,id]=k.split('.'); const node=F[p]&&F[p].nodes[id]; if(!node){ fail('card list '+k+' missing'); continue; } for(const it of node[6].items) if(!Q.critFn(it,S,null,{})) fail(k+': critFn cannot resolve "'+it+'"'); }
// 3. every grey box has a JUMPS entry; every decision has two arrows; every non-action box has a way out
for(const p in F) for(const id in F[p].nodes){ const n=F[p].nodes[id]; const outs=F[p].edges.filter(e=>e[0]===id);
 if(n[0]==='J' && !Q.jumpSpec(n[5])) fail('no JUMPS entry for '+p+'.'+id+' "'+Q.norm(n[5])+'"');
 if((n[0]==='D'||n[0]==='d') && outs.length!==2) fail(p+'.'+id+' has '+outs.length+' arrows');
 if(!outs.length && !['A','J','N'].includes(n[0])) fail(p+'.'+id+' ('+n[0]+') has no arrow out'); }
// 4. every card flag key exists; every card the engine expects has its data
for(const c of W.QB_CARDS){
 if(c.pre){ try{ Q.precondition(c.id,S); }catch(e){ fail(c.id+' pre "'+c.pre+'": '+e.message); } }
 if(c.cpre){ try{ Q.combatPre(c,Object.assign({},S,{battle:{figures:{}}})); }catch(e){ fail(c.id+' cpre "'+c.cpre+'": '+e.message); } }
 if(c.deck==='B' && !c.faction) fail(c.id+' Call to Battle card without a faction');
 if(c.effect && !['servants','hisWill','lidlessEye','recruitFaction'].includes(c.effect)) fail(c.id+' unknown effect '+c.effect);
 if(c.effect==='recruitFaction' && !c.faction) fail(c.id+' recruitFaction without a faction');
 if(!!c.onTable!==/play on the table/i.test(c.cond||'')) fail(c.id+' onTable flag disagrees with its condition text');
}
console.log(fails?fails+' failure(s)':'all checks passed'); process.exit(fails?1:0);
