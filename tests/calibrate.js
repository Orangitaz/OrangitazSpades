// Calibrates the difficulty levels (slow, luck-dependent; not part of the normal tests).
//   node tests/calibrate.js            all three levels against the reference player, GAMES games each (default 200)
//   node tests/calibrate.js '{"base":"normal","rand":0.2,"noise":1}' 300     one custom policy
// The reference "average player" follows the rule-of-thumb play, throws a random card 20% of the time and bids up to +-1 off.
// The levels in LEVELS (spades.html) are tuned so the NPC team beats it about 30% (Easy), 60% (Normal) and 90% (Hard) of games.
// A policy is {base:'normal'|'hard', rand: chance of a random card, noise: bid wobble}. Team A is seats 0 and 2.
const { loadLogic } = require('./harness');
const L = loadLogic();
function bid(p, hand, s, dealer, bids, blind, bags) {
  let b = L.chooseBid(hand, { level: p.base, exact: true, seat: s, dealer, bids: bids.slice(), blind: blind.slice(), bags }).bid;
  if (b > 0 && p.noise) b = Math.max(1, Math.min(13, b + Math.round((Math.random() - 0.5) * 2 * p.noise)));
  return b;
}
function playHand(pol, dealer, scores, bags) {
  const d = L.shuffle(L.newDeck());
  const hands = [0,1,2,3].map(s => d.slice(s*13, s*13+13).sort(L.cmpHand));
  const bids=[null,null,null,null], blind=[false,false,false,false];
  for (let i=1;i<=4;i++){const s=(dealer+i)%4;bids[s]=bid(pol[s],hands[s],s,dealer,bids,blind,bags);}
  const tricks=[0,0,0,0], voids=[0,0,0,0].map(()=>[0,0,0,0]), played=[];
  let lead=(dealer+1)%4, broken=false;
  for (let t=0;t<13;t++){
    const trick=[];
    for (let i=0;i<4;i++){
      const s=(lead+i)%4, legal=L.legalPlays(hands[s],trick,broken); let c=legal[0];
      if (legal.length>1){
        const v={seat:s,hand:hands[s],trick,lead,broken,bids,blind,tricks,pm:L.maskOf([...played,...trick.map(x=>x.card)]),voids,done:t,scores,bags};
        if (Math.random()<pol[s].rand) c=legal[Math.floor(Math.random()*legal.length)];
        else if (pol[s].base==='hard'){const rk=L.rankPlays(v);c=rk?rk[0].c:L.greedyPlay(v);}
        else c=L.greedyPlay(v);
      }
      hands[s].splice(hands[s].indexOf(c),1);
      if(trick.length&&c.s!==trick[0].card.s)voids[s][trick[0].card.s]=1;
      trick.push({seat:s,card:c}); if(c.s===0)broken=true;
    }
    const w=L.trickWinner(trick); tricks[w]++; played.push(...trick.map(x=>x.card)); lead=w;
  }
  return [0,1].map(t=>L.scoreTeam(t,bids,blind,tricks,bags[t]));
}
function game(A,B,fd){
  const pol=[A,B,A,B],scores=[0,0],bags=[0,0]; let dealer=fd;
  for(let h=0;h<60;h++){
    const r=playHand(pol,dealer,scores,bags);
    for(const t of[0,1]){scores[t]+=r[t].pts;bags[t]=r[t].bags}
    const w=L.gameWinner(scores,500); if(w!==null)return w; dealer=(dealer+1)%4;
  }
  return scores[0]===scores[1]?null:(scores[0]>scores[1]?0:1);
}

const REF = { base: 'normal', rand: 0.2, noise: 1 };
function run(name, A, N) {
  let w = 0, n = 0;
  for (let i = 0; i < N; i++) { const r = game(A, REF, i % 4); if (r === null) continue; n++; if (r === 0) w++; }
  console.log(`${name} ${JSON.stringify(A)}: beats the reference ${w}/${n} = ${Math.round(100 * w / n)}%`);
}
if (process.argv[2]) run('custom', JSON.parse(process.argv[2]), +process.argv[3] || 200);
else for (const lv of ['easy', 'normal', 'hard']) run(lv, L.LEVELS[lv], +process.env.GAMES || 200);
