// Luck-dependent and slow, so it only runs on request:  STRENGTH=1 node --test tests/strength.test.js
// GAMES=100 sets the number of games per matchup (default 60). Team A sits in seats 0 and 2, team B in seats 1 and 3,
// and the first dealer alternates so neither side gets a position advantage.
const test = require('node:test');
const { loadLogic } = require('./harness');
const L = loadLogic();

function playHand(levels, dealer, scores, bags) {
  const d = L.shuffle(L.newDeck());
  const hands = [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort(L.cmpHand));
  const bids = [null, null, null, null], blind = [false, false, false, false];
  for (let i = 1; i <= 4; i++) {
    const s = (dealer + i) % 4;
    bids[s] = L.chooseBid(hands[s], { level: levels[s], seat: s, dealer, bids: bids.slice(), blind: blind.slice(), bags }).bid;
  }
  const tricks = [0, 0, 0, 0], voids = [0, 0, 0, 0].map(() => [0, 0, 0, 0]), played = [];
  let lead = (dealer + 1) % 4, broken = false;
  for (let t = 0; t < 13; t++) {
    const trick = [];
    for (let i = 0; i < 4; i++) {
      const s = (lead + i) % 4;
      const legal = L.legalPlays(hands[s], trick, broken);
      let c = legal[0];
      if (legal.length > 1) {
        const v = { seat: s, hand: hands[s], trick, lead, broken, bids, blind, tricks, pm: L.maskOf([...played, ...trick.map(x => x.card)]),
          voids, done: t, scores, bags };
        if (levels[s] === 'easy' && Math.random() < 0.55) c = legal[Math.floor(Math.random() * legal.length)];
        else if (levels[s] === 'hard') { const rk = L.rankPlays(v); c = rk ? rk[0].c : L.greedyPlay(v); }
        else c = L.greedyPlay(v);
      }
      hands[s].splice(hands[s].indexOf(c), 1);
      if (trick.length && c.s !== trick[0].card.s) voids[s][trick[0].card.s] = 1;
      trick.push({ seat: s, card: c });
      if (c.s === 0) broken = true;
    }
    const w = L.trickWinner(trick);
    tricks[w]++; played.push(...trick.map(x => x.card)); lead = w;
  }
  return [0, 1].map(t => L.scoreTeam(t, bids, blind, tricks, bags[t]));
}
function playGame(la, lb, firstDealer) {
  const levels = [la, lb, la, lb], scores = [0, 0], bags = [0, 0];
  let dealer = firstDealer;
  for (let h = 0; h < 60; h++) {
    const res = playHand(levels, dealer, scores, bags);
    for (const t of [0, 1]) { scores[t] += res[t].pts; bags[t] = res[t].bags; }
    const w = L.gameWinner(scores, 500);
    if (w !== null) return w;
    dealer = (dealer + 1) % 4;
  }
  return scores[0] === scores[1] ? null : (scores[0] > scores[1] ? 0 : 1);
}
const N = +process.env.GAMES || 60;
for (const [a, b] of [['normal', 'easy'], ['hard', 'easy'], ['hard', 'normal']]) {
  test(`${a} vs ${b}`, { skip: !process.env.STRENGTH, timeout: 3600000 }, () => {
    let w = 0, n = 0;
    for (let i = 0; i < N; i++) {
      const r = playGame(a, b, i % 4);
      if (r === null) continue;
      n++; if (r === 0) w++;
    }
    console.log(`${a} beats ${b}: ${w}/${n} = ${Math.round(100 * w / n)}%`);
  });
}
