// ===== Queller Runner engine: state, dice, cards, playability =====
(function(){
const F = window.QB_FLOW, CARDS = window.QB_CARDS;
const byId = {}; CARDS.forEach(c=>{ byId[c.id]=c; c.initN = typeof c.init==='number' ? c.init : (c.init==="3-5"?4:0); });
const rnd = n => Math.floor(Math.random()*n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a=a.slice(); for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };
const VERSION=53; // app version (shown in the debug log and stamped on saves)
const PALANTIR="sa045", BALROG="sa001b2";
const SHADOW_FACTIONS=["corsairs","dunlendings","spiders"];
const DIE_STATE={POOL:"pool",HUNT:"hunt",AVAIL:"avail",USED:"used",RESERVED:"reserved"};

// ---------- card flags ----------
// Static flags come from cards.js; only `preferred` and `factionInPlay` depend on the game state.
function cardFlags(c, S){
 const strat=S.strategy;
 return {
  revealed: !!c.revealed, tile: !!c.tile, corruption: !!c.corruption, init: c.initN,
  preferred: c.type ? (strat==='corruption' ? c.type==='Character' : c.type!=='Character') : false,
  factionInPlay: c.faction ? !!S.board.factions[c.faction.toLowerCase()] : false
 };
}
const FACTION_CAT = {sa_Faction01:"muster",sa_Faction02:"muster",sa_Faction03:"other",sa_Faction04:"attack",sa_Faction05:"attack",sa_Faction06:"muster",sa_Faction07:"muster",sa_Faction08:"attack",sa_Faction09:"attack",sa_Faction10:"other",sa_Faction11:"move",sa_Faction12:"move",sa_Faction13:"move",sa_Faction14:"other",sa_Faction15:"muster",sa_Faction16:"other",sa_Faction17:"other",sa_Faction18:"other",sa_Faction19:"other",sa_Faction20:"other"};
const MUSTER_CHOICE = {sa015:1,sa018:1,sa027:1,sa028b2:1,sa028:1,sa033:1};
const ON_TABLE = id => !!byId[id].onTable;
const handBy = (S,deck) => S.cards.hand.filter(i=>byId[i].deck===deck);
// Cards Queller may use as a combat card: the hand, plus table cards whose text allows it (Balrog of Moria).
const combatCandidates = S => S.cards.hand.concat(S.cards.table.filter(i=>byId[i].tableCombat));
const ctbCards = S => CARDS.filter(c=>c.deck==="B" && S.board.factions[c.faction.toLowerCase()]).map(c=>c.id);

// ---------- board helpers ----------
// Shadow nations on the Political Track: nations.sauron/isengard/se = steps above "At War" (0 = At War, 1-3 = Active +N). Start: Sauron 1, Isengard 1, S&E 2.
const SN_START={sauron:1,isengard:1,se:2};
function snAtWar(S,k){ return (S.board.nations[k]|0)===0; }
function snAllAtWar(S){ return snAtWar(S,"sauron")&&snAtWar(S,"isengard")&&snAtWar(S,"se"); }
function snLabel(v){ return v===0?"At War":"Active +"+v; }
function fpNationAtWar(S){ return ["gondor","rohan","north","dwarves","elves"].some(k=>S.board.nations[k]==="war"); }
function shadowFactionInPlay(S){ return S.settings.wome && SHADOW_FACTIONS.some(k=>S.board.factions[k]); }
function allShadowFactionsInPlay(S){ return SHADOW_FACTIONS.every(k=>S.board.factions[k]); }
// Whether the app knows how many Elven Rings the Shadow holds: the full tracker has the field, and so does the minimal tracker when dice are rolled.
function ringsKnown(S){ return !!(S.settings.tracker||S.settings.dice); }
function ringAvailable(S){ return !S.ringUsedThisTurn && (!ringsKnown(S) || S.board.rings>0); }
// Hunt box maximum (rulebook: the number of Companions, but always at least one) — rule 34 caps the flowchart allocations at it.
function huntCap(S){ return Math.max(1, S.board.fs.companions|0); }
// Minions Queller could muster now, in priority order (Muster page); the first is the one it musters.
function minionsAvailable(S){
 const c=S.board.chars, out=[];
 if(snAtWar(S,"isengard") && !c.saruman) out.push({name:"Saruman",key:"saruman",why:"Isengard at war"});
 if(snAtWar(S,"sauron") && fpNationAtWar(S) && !c.witchKing) out.push({name:"Witch King",key:"witchKing",why:"Sauron at war and a Free Peoples nation at war"});
 if(snAllAtWar(S) && !c.mouth) out.push({name:"Mouth of Sauron",key:"mouth",why:"all Shadow nations at war"});
 return out;
}
function migrate(o){
 if(o.settings&&o.settings.tracker===undefined){ o.settings.tracker=o.settings.walk!==false; delete o.settings.walk; }
 const n=o.board&&o.board.nations; if(n) for(const k of ["sauron","isengard","se"]){ if(typeof n[k]==="boolean") n[k]=n[k]?0:SN_START[k]; else if(typeof n[k]!=="number") n[k]=SN_START[k]; }
 if(o.board && o.board.rings===undefined) o.board.rings=0;
 delete o.shownCard; delete o.lastAction;
 return o;
}

// ---------- playability preconditions ----------
// Each returns true/false, or asks a situational question (answered once per turn) via situ().
const SITU_Q = {
 mtSiege:"Is Minas Tirith under siege by a Shadow army?",
 nazNearFP:"Is a Shadow army containing Nazgûl adjacent to, or in the same region as, a Free Peoples army?",
 wkBesieging:"Is the Witch-king with a Shadow army that is besieging a Stronghold?",
 isenBesieging:"Is an army containing an Isengard unit besieging a Stronghold?",
 elvenStronghold:"Does the Shadow control at least one Elven Stronghold?",
 fpNotWar:"Is the Fellowship or a Companion inside the borders of a Free Peoples nation that is not at war?",
 siegeEngine:"Is a Shadow Siege Engine in this battle?"
};
function situ(S,key){ const v=S.situ[key]; if(v===undefined) return {situ:key,q:SITU_Q[key]}; return v; }
const PRECONDITIONS = {
 fsNotInFPSettlement: S=>!S.board.fs.inFPSettlement,
 fsProgress1: S=>S.board.fs.progress>=1,
 fsRevealed: S=>S.board.fs.revealed,
 saruman: S=>S.board.chars.saruman, witchKing: S=>S.board.chars.witchKing, aragorn: S=>S.board.chars.aragorn,
 isengardAtWar: S=>snAtWar(S,"isengard"), sauronAtWar: S=>snAtWar(S,"sauron"), seAtWar: S=>snAtWar(S,"se"), allAtWar: snAllAtWar,
 dunlendings: S=>S.board.factions.dunlendings, corsairs: S=>S.board.factions.corsairs,
 fpFaction: S=>{ const f=S.board.factions; return f.ents||f.eagles||f.deadmen; },
 mtSiege: S=>situ(S,"mtSiege"), nazNearFP: S=>situ(S,"nazNearFP"), elvenStronghold: S=>situ(S,"elvenStronghold"), fpNotWar: S=>situ(S,"fpNotWar"),
 wkBesieging: S=>S.board.chars.witchKing ? situ(S,"wkBesieging") : false,
 isenBesieging: S=>S.board.chars.saruman ? situ(S,"isenBesieging") : false,
 // The Lidless Eye has no effect without an unused die (rule 17); only checkable when the app rolls the dice.
 unusedDice: S=>!S.settings.dice || availDice(S).some(d=>d.k==="A" && !(S.walk && S.dice.pool.indexOf(d)===S.walk.dieObj))
};
function precondition(id, S){ const k=byId[id].pre; return k ? PRECONDITIONS[k](S) : true; }
// combat-card precondition from the battle form
const COMBAT_PRECONDITIONS = {
 nazLead1: (S,B)=>(B.nazLead|0)>=1, nazLead2: (S,B)=>(B.nazLead|0)>=2, nazInBattle: (S,B)=>(B.nazLead|0)>0,
 siegeEngine: S=>situ(S,"siegeEngine"),
 isengardStronghold: (S,B)=>!!B.isengardStronghold, seElite: (S,B)=>!!B.seElite, shadowElite: (S,B)=>!!B.shadowElite,
 nearMoria: (S,B)=>!!B.nearMoria, defInFs: (S,B)=>!!B.defInFs,
 ctb: ()=>true, ctbNotBesieged: (S,B)=>!B.underSiege, ctbAttackingSiege: (S,B)=>!!B.attackingSiege
};
function combatPre(c, S){
 const B=S.battle||{};
 if(c.deck==="B"){ const fac=c.faction.toLowerCase(); if(!S.board.factions[fac] || !(B.figures&&B.figures[fac])) return false; }
 return c.cpre ? COMBAT_PRECONDITIONS[c.cpre](S,B) : true;
}

// ---------- initial state ----------
function newState(settings){
 const S = {
  appVersion:VERSION, createdVersion:VERSION, // the version that last saved this game, and the one that created it
  settings: Object.assign({dice:true,cards:true,tracker:true,wome:true},settings||{}),
  turn:1, strategy:null, phase:"setup",
  dice:{pool:[], base:7, hunt:0, factionDie:false},
  cards:{decks:{C:[],S:[],F:[]}, discards:{C:[],S:[],F:[]}, hand:[], factionHand:[], table:[], factionTable:[]},
  board:{
   fs:{progress:0, revealed:false, mordor:false, inFPSettlement:true, inStrongholdOrSea:true, atStart:true, guideGollum:false, companions:7},
   chars:{saruman:false,witchKing:false,mouth:false,gandalfWhite:false,aragorn:false},
   nations:{sauron:1,isengard:1,se:2, gondor:"passive", rohan:"passive", north:"passive", dwarves:"passive", elves:"active"},
   factions:{corsairs:false,dunlendings:false,spiders:false,ents:false,eagles:false,deadmen:false},
   nazgul:4, shadowVP:0, corruption:0, rings:0
  },
  ringUsedThisTurn:false, situ:{}, playable:{}, battle:null, battleOpen:false, minionReserved:false,
  walk:null, log:[]
 };
 buildDecks(S);
 return S;
}
function buildDecks(S){
 const w=S.settings.wome;
 const C=[],Sd=[],Fd=[];
 for(const c of CARDS){
  if(c.deck==="B") continue;
  if(c.set==="WoME" && !w) continue;
  if(c.id==="sa028b2"||c.id==="sa038b2"){ if(w) continue; }
  if(c.id==="sa028"||c.id==="sa038"){ if(!w) continue; }
  if(c.deck==="C") C.push(c.id); else if(c.deck==="S") Sd.push(c.id); else if(c.deck==="F") Fd.push(c.id);
 }
 S.cards.decks={C:shuffle(C),S:shuffle(Sd),F:shuffle(Fd)};
}

// ---------- dice ----------
const SHADOW_FACES=["Muster","Army/Muster","Army","Character","Event","Eye"];
const FACTION_FACES=["Recruit","Play/Draw","Recruit/Play","Recruit/Draw","Eye","Wild"];
function diceCount(S){ const c=S.board.chars; return 7+(c.saruman?1:0)+(c.witchKing?1:0)+(c.mouth?1:0); }
function recoverDice(S){
 const n=diceCount(S); S.dice.pool=[]; S.dice.hunt=0;
 for(let i=0;i<n;i++) S.dice.pool.push({k:"A",face:null,st:DIE_STATE.POOL});
 // WoME p.8: the Faction die joins the pool at the start of the turn after the first Shadow Faction enters play, and leaves it the turn after the last one is gone.
 S.dice.factionDie=shadowFactionInPlay(S);
 if(S.dice.factionDie) S.dice.pool.push({k:"F",face:null,st:DIE_STATE.POOL});
 S.minionReserved=false; S.ringUsedThisTurn=false; S.situ={}; S.playable={};
 log(S,"Recovered "+n+" action dice"+(S.dice.factionDie?" and the Faction die":"")+".");
}
function assignHunt(S,n){
 const pool=S.dice.pool.filter(d=>d.k==="A"&&d.st===DIE_STATE.POOL);
 const cap=huntCap(S), k=Math.min(n,cap,pool.length);
 for(let i=0;i<k;i++){pool[i].st=DIE_STATE.HUNT;pool[i].face="Eye";}
 S.dice.hunt+=k; log(S,"Placed "+k+" "+(k===1?"die":"dice")+" in the Hunt box before rolling"+(k<n&&cap<n?" (rule 34: maximum "+cap+" for "+(S.board.fs.companions|0)+" Companions)":"")+".");
 return k;
}
function rollRemaining(S){
 let eyes=0; const out=[];
 for(const d of S.dice.pool){ if(d.st!==DIE_STATE.POOL) continue;
  d.face = d.k==="A" ? pick(SHADOW_FACES) : pick(FACTION_FACES);
  if(d.face==="Eye"){d.st=DIE_STATE.HUNT;S.dice.hunt++;eyes++;} else d.st=DIE_STATE.AVAIL;
  out.push(d.face);
 }
 log(S,"Rolled: "+out.join(", ")+(eyes?" — "+eyes+" Eye"+(eyes>1?"s":"")+" to the Hunt box":"")+".");
 return out;
}
function preferredFaces(S){ return S.strategy==="corruption" ? ["Character"] : ["Army","Muster","Army/Muster"]; }
// which available dice satisfy a requirement
const REQ = {
 Army:["Army","Army/Muster","Wild"], Muster:["Muster","Army/Muster","Wild"], Character:["Character","Wild"], Event:["Event","Wild"],
 CharOrMuster:["Character","Muster","Army/Muster","Wild"],
 FRecruit:["Recruit","Recruit/Play","Recruit/Draw","Wild"], FPlay:["Play/Draw","Recruit/Play","Wild"], FDraw:["Play/Draw","Recruit/Draw","Wild"]
};
// Does a die already held for `have` satisfy a step that needs `need`?
function dieSatisfies(have,need){ return !!have && (have===need || (need==="CharOrMuster" && (have==="Character"||have==="Muster"))); }
function availDice(S){ return S.dice.pool.filter(d=>d.st===DIE_STATE.AVAIL); }
function findDie(S,req){
 const faces=REQ[req]||[req]; const av=availDice(S);
 for(const f of faces){ const d=av.find(x=>x.face===f); if(d) return d; }
 return null;
}
function spendDie(S,die,why){ if(!die) return; die.st=DIE_STATE.USED; log(S,"Used the "+die.face+" die"+(why?" — "+why:"")+"."); }
// rule 36 / 23 selection: at random from the dice that do not show a preferred result; from all dice if every die does
function nonPreferredFirst(S,dice,n){
 const pref=preferredFaces(S); let cands=dice.filter(d=>!pref.includes(d.face)); if(!cands.length) cands=dice.slice();
 const out=[]; while(out.length<n && cands.length){ const i=rnd(cands.length); out.push(cands.splice(i,1)[0]); }
 return out;
}
function ringChange(S,req){ // rule 36: change one non-preferred available die to the required result
 const av=availDice(S).filter(d=>d.k==="A"); if(!av.length) return null;
 const d=nonPreferredFirst(S,av,1)[0]; const from=d.face;
 d.face = req==="CharOrMuster"?"Character":(req.startsWith("F")?"Wild":req);
 S.board.rings=Math.max(0,S.board.rings-1); S.ringUsedThisTurn=true;
 log(S,"Used an Elven Ring: changed a "+from+" die to "+d.face+" (rule 36). Rings left: "+S.board.rings+".");
 return d;
}

// ---------- cards ----------
function drawCard(S,deck){
 const D=S.cards.decks[deck];
 if(!D.length){ const disc=S.cards.discards[deck]; if(!disc.length){log(S,"The "+deckName(deck)+" deck is empty."); return null;} S.cards.decks[deck]=shuffle(disc); S.cards.discards[deck]=[]; log(S,"Reshuffled the "+deckName(deck)+" discards into a new deck."); }
 const id=S.cards.decks[deck].shift();
 if(deck==="F") S.cards.factionHand.push(id); else S.cards.hand.push(id);
 log(S,"Drew a "+deckName(deck)+" card ("+(deck==="F"?S.cards.factionHand.length:S.cards.hand.length)+" in hand).");
 return id;
}
function deckName(d){ return d==="C"?"Character":d==="S"?"Strategy":"Faction Event"; }
function handCounts(S){ return {C:handBy(S,"C").length,S:handBy(S,"S").length,total:S.cards.hand.length,F:S.cards.factionHand.length}; }
function removeFromLists(S,id){ for(const l of [S.cards.hand,S.cards.factionHand,S.cards.table,S.cards.factionTable]){ const i=l.indexOf(id); if(i>=0){ l.splice(i,1); return true; } } return false; }
function discardCard(S,id,why){
 const c=byId[id]; removeFromLists(S,id);
 S.cards.discards[c.deck].push(id);
 log(S,"Discarded “"+c.title+"”"+(why?" — "+why:"")+".", {card:id});
}
function playCard(S,id,ctx){
 const c=byId[id]; const combat=!!(ctx&&ctx.combat); removeFromLists(S,id);
 const onTable = ON_TABLE(id) && !combat;
 if(onTable){ (c.deck==="F"?S.cards.factionTable:S.cards.table).push(id); }
 else if(c.deck!=="B") S.cards.discards[c.deck].push(id);
 delete S.playable[(combat?"B:":"")+id];
 log(S,(combat?"Combat card: ":"Played: ")+"“"+c.title+"”"+(onTable?" (stays on the table)":"")+".", {card:id, combat});
 return c;
}
// Card effects that change Queller's hand, dice or board and are not steps on a flowchart page. Returns trail entries.
const FACTION_PICK=["Preferred card","Faction in play"]; // rule 3 breaks the tie
function resolveCardEffects(S, id, ctx){
 const c=byId[id]; const out=[]; if(ctx&&ctx.combat) return out;
 const K=S.cards;
 if(c.effect==="servants"){
  if(K.decks.F.length<3 && K.discards.F.length){ K.decks.F=K.decks.F.concat(shuffle(K.discards.F)); K.discards.F=[]; }
  const drawn=K.decks.F.splice(0,3);
  const r=applyPriority(S,drawn,FACTION_PICK);
  if(r.chosen){ K.factionHand.push(r.chosen); }
  const rest=drawn.filter(x=>x!==r.chosen);
  K.decks.F=shuffle(K.decks.F.concat(rest, K.discards.F)); K.discards.F=[];
  log(S,"Servants of Sauron: drew "+drawn.length+" Faction Event cards, kept one, reshuffled the rest and the discards into the deck.");
  out.push({kind:"pri",text:"Servants of Sauron — keep one of "+drawn.length+" cards",items:FACTION_PICK.concat("Otherwise at random (rule 3)"),steps:r.steps,card:r.chosen});
 }
 else if(c.effect==="hisWill"){
  const r=applyPriority(S,K.discards.F.filter(x=>x!==id),FACTION_PICK);
  if(r.chosen){ K.discards.F.splice(K.discards.F.indexOf(r.chosen),1); K.factionHand.push(r.chosen); log(S,"His Will and His Malice: “"+byId[r.chosen].title+"” returned from the discard pile to the hand."); }
  else log(S,"His Will and His Malice: no Faction Event card in the discard pile.");
  out.push({kind:"pri",text:"His Will and His Malice — take a card from the Faction discard pile",items:FACTION_PICK.concat("Otherwise at random (rule 3)"),steps:r.chosen?r.steps:["Discard pile empty"],card:r.chosen});
 }
 else if(c.effect==="lidlessEye" && S.settings.dice){
  const chosen=nonPreferredFirst(S,availDice(S).filter(d=>d.k==="A"),3); const from=chosen.map(d=>d.face);
  for(const d of chosen){ d.face="Eye"; d.st=DIE_STATE.HUNT; S.dice.hunt++; }
  log(S,"The Lidless Eye: "+(chosen.length?"changed "+from.join(", ")+" to Eye and placed "+(chosen.length===1?"it":"them")+" in the Hunt box.":"no unused die to change."));
  out.push({kind:"note",text:"The Lidless Eye: "+(chosen.length?chosen.length+" "+(chosen.length===1?"die":"dice")+" ("+from.join(", ")+") to the Hunt box, non-preferred results first (rule 23)":"no unused die to change")});
 }
 else if(c.effect==="recruitFaction"){
  const k=c.faction.toLowerCase();
  if(!S.board.factions[k]){ S.board.factions[k]=true; S.playable={}; log(S,c.faction+" are now in play (tracker updated; the Faction die joins the pool next turn)."); out.push({kind:"note",text:c.faction+" enter play — tracker updated"}); }
 }
 // The Palantír of Orthanc: after an Event die plays an Event card, draw another card (a preferred one: Character under the corruption strategy, Strategy under military).
 if(ctx&&ctx.die==="Event" && (c.deck==="C"||c.deck==="S") && ctx.palantirBefore){
  const deck=S.strategy==="corruption"?"C":"S"; const got=drawCard(S,deck);
  log(S,"The Palantír of Orthanc: drew a "+deckName(deck)+" card after playing “"+c.title+"” with an Event die.");
  out.push({kind:"note",text:"The Palantír of Orthanc: drew a "+deckName(deck)+" card"+(got?"":" — deck empty")});
 }
 return out;
}
// Table cards whose discard condition the board tracker can see. `check` returns true (discard now), false, or a question to ask the player.
const TABLE_TRIGGERS = [
 {id:"sa051", check:(S,ch)=>ch.key==="chars.saruman"&&!ch.to ? "Saruman eliminated" : (ch.key==="nations.rohan"&&ch.from==="passive"&&ch.to!=="passive" ? "Rohan activated" : false)},
 {id:PALANTIR, check:(S,ch)=>ch.key==="chars.saruman"&&!ch.to ? "Saruman eliminated" : false},
 {id:"sa050", check:(S,ch)=>{ if(!/^nations\.(gondor|rohan|north|dwarves|elves)$/.test(ch.key)) return false; const r={passive:0,active:1,war:2}; if(r[ch.to]<=r[ch.from]) return false;
   if(ch.from==="passive") return "a Free Peoples nation advanced from passive (only an attack, a Companion or a Fellowship declaration can do that while the card is in play)";
   return {q:"Threats and Promises: did the nation go to war because of an attack or a Companion’s special ability (not a Muster die)?"}; }},
 {id:"sa009", check:(S,ch)=>fsDeclaredInFP(S,ch) ? {q:"Flocks of Crebain: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?"} : false},
 {id:"sa052", check:(S,ch)=>fsDeclaredInFP(S,ch) ? {q:"Worn with Sorrow and Toil: was the Fellowship declared in an unconquered Free Peoples City or Stronghold?"} : false}
];
function fsDeclaredInFP(S,ch){ return (ch.key==="fs.revealed"||ch.key==="fs.inFPSettlement") && !!ch.to && S.board.fs.revealed && S.board.fs.inFPSettlement; }
// After a tracker change {key, from, to}: discards the table cards whose condition is now met; returns the questions the app cannot answer itself.
function tableTriggers(S,ch){
 const asks=[];
 for(const t of TABLE_TRIGGERS){ if(!S.cards.table.includes(t.id)) continue; const r=t.check(S,ch); if(!r) continue;
  if(typeof r==="string") discardCard(S,t.id,r); else asks.push({card:t.id,q:r.q}); }
 return asks;
}
// priority-list filtering (rules 30, 31)
function applyPriority(S, ids, criteria, ctx){
 let opts=ids.slice(); const steps=[];
 const fullEvent = S.cards.hand.length>=6, fullFac = S.cards.factionHand.length>=4;
 for(const crit of criteria){
  if(opts.length<=1) break;
  const test = critFn(crit, S, ctx, {fullEvent,fullFac});
  if(!test){ steps.push(crit+" → not a card criterion, skipped"); continue; }
  let kept;
  if(test.rank){ // rank only the cards `only` selects; the others are kept alongside the best
   const ranked=opts.filter(id=>!test.only||test.only(byId[id])); let best=null;
   for(const id of ranked){const v=test.rank(byId[id]); if(best===null||(test.max?v>best:v<best)) best=v;}
   kept=opts.filter(id=>!ranked.includes(id)||test.rank(byId[id])===best); }
  else kept=opts.filter(id=>test(byId[id]));
  if(kept.length>0 && kept.length<opts.length){ steps.push(crit+" → "+kept.length+" left"); opts=kept; }
  else if(kept.length===0) steps.push(crit+" → no card, skipped");
 }
 let chosen=null;
 if(opts.length>1){ chosen=pick(opts); steps.push("Tie between "+opts.length+" cards — chosen at random (rule 3)"); }
 else chosen=opts[0]||null;
 return {chosen, steps};
}
const notCtB = c=>c.deck!=="B"; // rule 19: Call to Battle cards ignore initiative
function critFn(crit,S,ctx,H){
 const fl = c=>cardFlags(c,S); const t=crit.replace(/\*/g,"").toLowerCase();
 if(t.startsWith("doesn't use the term")) return c=>!fl(c).revealed;
 if(t.startsWith("doesn't place a tile or add corruption")) return c=>!fl(c).tile && !fl(c).corruption;
 if(t.startsWith("doesn't place a tile")) return c=>!fl(c).tile;
 if(t==="strategy card") return c=>c.deck==="S";
 if(t==="character card") return c=>c.deck==="C";
 if(t.startsWith("descending order")) return {rank:c=>fl(c).init,max:true,only:notCtB};
 if(t.startsWith("ascending order of initiative on character")) return {rank:c=>fl(c).init,max:false,only:c=>c.deck==="C"};
 if(t.startsWith("ascending order")) return {rank:c=>fl(c).init,max:false,only:notCtB};
 if(t==="no faction picture") return c=>!c.faction;
 if(t==="faction not in play") return c=>!!c.faction && !fl(c).factionInPlay;
 if(t==="faction in play") return c=>fl(c).factionInPlay;
 if(t==="not preferred card") return c=>!fl(c).preferred;
 if(t==="preferred card") return c=>fl(c).preferred;
 if(t==="preferred event card") return c=>fl(c).preferred && c.deck!=="F";
 if(t==="preferred faction event card") return c=>fl(c).preferred && c.deck==="F";
 if(t==="full hand with preferred card") return c=>fl(c).preferred && (c.deck==="F"?H.fullFac:H.fullEvent);
 if(t==="full hand") return c=>(c.deck==="F"?H.fullFac:H.fullEvent);
 if(t==="event card") return c=>c.deck==="C"||c.deck==="S";
 if(t==="faction event card") return c=>c.deck==="F";
 if(t.startsWith("strategy card which cancels")) return c=>c.deck==="S" && c.ct==="Swarm of Bats";
 if(t==="durin's bane") return c=>c.ct==="Durin's Bane";
 if(t==="call to battle card") return c=>c.deck==="B";
 if(t==="mobile army attacks target") return c=>FACTION_CAT[c.id]==="attack";
 if(t==="moves mobile army") return c=>FACTION_CAT[c.id]==="move";
 if(t==="muster") return c=>FACTION_CAT[c.id]==="muster";
 return null;
}
function autoDiscard(S, criteria, deck){ // discard down to the limit using a priority list (discard = the card that best fits)
 const limit = deck==="F"?4:6; const hand = deck==="F"?S.cards.factionHand:S.cards.hand; const done=[];
 let guard=0;
 while(hand.length>limit && guard++<10){
  const r=applyPriority(S,hand.slice(),criteria); if(!r.chosen) break;
  discardCard(S,r.chosen,"hand above the limit; "+r.steps.join("; ")); done.push(r.chosen);
 }
 return done;
}

function log(S,text,extra){ S.log.push(Object.assign({t:text,turn:S.turn},extra||{})); if(S.log.length>400) S.log.shift(); }

window.QB = { VERSION, PALANTIR, BALROG, SHADOW_FACTIONS, DIE_STATE, SN_START, snAtWar, snAllAtWar, snLabel, fpNationAtWar, shadowFactionInPlay, allShadowFactionsInPlay, ringsKnown, ringAvailable, huntCap, minionsAvailable,
 migrate, F, CARDS, byId, rnd, pick, shuffle, cardFlags, FACTION_CAT, MUSTER_CHOICE, ON_TABLE, handBy, combatCandidates, ctbCards, SITU_Q, precondition, combatPre,
 newState, buildDecks, SHADOW_FACES, FACTION_FACES, diceCount, recoverDice, assignHunt, rollRemaining, preferredFaces, REQ, dieSatisfies, availDice, findDie, spendDie, ringChange,
 drawCard, deckName, handCounts, discardCard, playCard, applyPriority, critFn, autoDiscard, resolveCardEffects, tableTriggers, log };
})();
