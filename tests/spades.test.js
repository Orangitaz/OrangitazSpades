const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadLogic, loadGame, read } = require('./harness');

const L = loadLogic();
// Card helper: C(14,0) is the ace of spades. Ranks 2..14 (14 = ace); suits 0 spades, 1 hearts, 2 diamonds, 3 clubs.
const C = (r, s = 0) => ({ r, s });
const T = (...xs) => xs.map(([seat, r, s]) => ({ seat, card: C(r, s) }));   // a trick: [seat, rank, suit] ...
const NOBAGS = 0;

/* ---------- deck ---------- */
test('deck has 52 distinct cards and shuffles keep them', () => {
  const d = L.newDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d.map(L.key)).size, 52);
  const s = L.shuffle(d.slice());
  assert.deepEqual(s.map(L.key).sort(), d.map(L.key).sort());
});

/* ---------- following suit and leading spades ---------- */
test('you must follow the suit led when you can', () => {
  const hand = [C(14, 0), C(5, 1), C(9, 1), C(3, 3)];
  const legal = L.legalPlays(hand, T([1, 10, 1]), false);
  assert.deepEqual(legal.map(L.key).sort(), [L.key(C(5, 1)), L.key(C(9, 1))].sort());
});
test('void in the suit led: any card is legal, spades included', () => {
  const hand = [C(14, 0), C(5, 2), C(3, 3)];
  assert.equal(L.legalPlays(hand, T([1, 10, 1]), false).length, 3);
});
test('cannot lead a spade until spades are broken, unless you hold only spades', () => {
  const hand = [C(14, 0), C(5, 2), C(3, 3)];
  assert.deepEqual(L.legalPlays(hand, [], false).map(L.key).sort(), [L.key(C(5, 2)), L.key(C(3, 3))].sort());
  assert.equal(L.legalPlays(hand, [], true).length, 3);
  const only = [C(14, 0), C(2, 0)];
  assert.equal(L.legalPlays(only, [], false).length, 2);
});
test('when spades are led you must follow with a spade', () => {
  const hand = [C(14, 0), C(5, 2)];
  assert.deepEqual(L.legalPlays(hand, T([1, 4, 0]), true).map(L.key), [L.key(C(14, 0))]);
});

/* ---------- who wins a trick ---------- */
test('highest card of the led suit wins when nobody trumps', () => {
  assert.equal(L.trickWinner(T([1, 5, 1], [2, 12, 1], [3, 14, 2], [0, 9, 1])), 2);
});
test('any spade beats any other suit, and the highest spade wins', () => {
  assert.equal(L.trickWinner(T([1, 14, 1], [2, 2, 0], [3, 13, 1], [0, 3, 0])), 0);
  assert.equal(L.trickWinner(T([1, 14, 1], [2, 2, 0], [3, 13, 1], [0, 12, 1])), 2);
});
test('off-suit discards never win', () => {
  assert.equal(L.trickWinner(T([1, 3, 1], [2, 14, 2], [3, 14, 3], [0, 5, 1])), 0);
});
test('leading spades: highest spade wins', () => {
  assert.equal(L.trickWinner(T([1, 7, 0], [2, 9, 0], [3, 14, 1], [0, 8, 0])), 2);
});

/* ---------- scoring a hand ---------- */
const sc = (t, bids, blind, tricks, bags = 0) => L.scoreTeam(t, bids, blind, tricks, bags);
const NB = [false, false, false, false];

test('made bid: 10 per trick bid, +1 per extra trick (bag)', () => {
  const r = sc(0, [3, 4, 2, 3], NB, [3, 0, 3, 0]);   // bid 5, took 6
  assert.equal(r.pts, 51); assert.equal(r.bagsNew, 1); assert.equal(r.bags, 1);
});
test('exact bid scores 10 per trick with no bags', () => {
  const r = sc(0, [2, 3, 2, 3], NB, [2, 0, 2, 0]);   // bid 4, took 4
  assert.equal(r.pts, 40); assert.equal(r.bagsNew, 0);
});
test('set: lose 10 per trick bid, no bags', () => {
  const r = sc(0, [4, 3, 3, 3], NB, [1, 0, 2, 0]);   // bid 7, took 3
  assert.equal(r.pts, -70); assert.equal(r.set, true); assert.equal(r.bagsNew, 0);
});
test('nil made is +100, nil failed is -100 and its tricks become bags', () => {
  const made = sc(0, [0, 3, 4, 3], NB, [0, 0, 4, 0]);   // partner bid 4 took 4, nil took none
  assert.equal(made.pts, 140); assert.equal(made.nilMade, 1);
  const failed = sc(0, [0, 3, 4, 3], NB, [2, 0, 4, 0]);
  assert.equal(failed.pts, 40 - 100); assert.equal(failed.bagsNew, 2); assert.equal(failed.nilFailed, 1);
});
test('blind nil is worth 200 either way', () => {
  const blind = [true, false, false, false];
  assert.equal(sc(0, [0, 3, 4, 3], blind, [0, 0, 4, 0]).pts, 240);
  assert.equal(sc(0, [0, 3, 4, 3], blind, [1, 0, 4, 0]).pts, 40 - 200);
});
test("a nil bidder's tricks never count towards the partner's bid", () => {
  const r = sc(0, [0, 3, 4, 3], NB, [2, 0, 3, 0]);   // partner bid 4 and took only 3; the nil bidder's 2 do not help
  assert.equal(r.set, true); assert.equal(r.pts, -40 - 100);
});
test('both partners nil: each is scored on its own', () => {
  const r = sc(0, [0, 3, 0, 3], NB, [0, 0, 1, 0]);
  assert.equal(r.pts, 100 - 100); assert.equal(r.bagsNew, 1);
});
test('ten bags cost 100 points and the count wraps', () => {
  const r = sc(0, [3, 3, 3, 3], NB, [3, 0, 4, 0], 5);   // bid 6 took 7 -> 1 bag; 5+1 = 6 (no penalty)
  assert.equal(r.bags, 6); assert.equal(r.pen, 0);
  const r2 = sc(0, [3, 3, 3, 3], NB, [5, 0, 5, 0], 7);  // bid 6 took 10 -> 4 bags; 7+4 = 11
  assert.equal(r2.bags, 1); assert.equal(r2.pen, 100); assert.equal(r2.pts, 60 + 4 - 100);
});
test('every hand: points only change by the rules (random deals, random bids)', () => {
  for (let k = 0; k < 2000; k++) {
    const tricks = [0, 0, 0, 0];
    for (let i = 0; i < 13; i++) tricks[Math.floor(Math.random() * 4)]++;
    const bids = [0, 0, 0, 0].map(() => (Math.random() < 0.15 ? 0 : 1 + Math.floor(Math.random() * 6)));
    const blind = bids.map(b => b === 0 && Math.random() < 0.3);
    for (const t of [0, 1]) {
      const bags = Math.floor(Math.random() * 10);
      const r = L.scoreTeam(t, bids, blind, tricks, bags);
      assert.ok(r.bags >= 0 && r.bags < 10);
      assert.equal(r.pts, r.items.reduce((a, i) => a + i.p, 0));
      assert.equal((bags + r.bagsNew) % 10, r.bags);
    }
  }
});

/* ---------- end of game ---------- */
test('game ends at the target, at -200, and plays on when tied above the target', () => {
  assert.equal(L.gameWinner([499, 300], 500), null);
  assert.equal(L.gameWinner([500, 300], 500), 0);
  assert.equal(L.gameWinner([300, 520], 500), 1);
  assert.equal(L.gameWinner([520, 510], 500), 0);
  assert.equal(L.gameWinner([510, 510], 500), null);
  assert.equal(L.gameWinner([-200, 10], 500), 1);
  assert.equal(L.gameWinner([10, -230], 500), 0);
  assert.equal(L.gameWinner([-199, 10], 500), null);
});

/* ---------- AI ---------- */
function randomDeal() {
  const d = L.shuffle(L.newDeck());
  return [0, 1, 2, 3].map(s => d.slice(s * 13, s * 13 + 13).sort(L.cmpHand));
}
test('bid estimate: strong hand is worth far more than a weak one', () => {
  const strong = [C(14, 0), C(13, 0), C(12, 0), C(11, 0), C(9, 0), C(14, 1), C(13, 1), C(14, 2), C(5, 2), C(14, 3), C(4, 3), C(3, 3), C(2, 3)];
  const weak = [C(2, 0), C(3, 0), C(4, 1), C(5, 1), C(6, 1), C(7, 2), C(8, 2), C(9, 2), C(10, 3), C(3, 3), C(4, 3), C(5, 3), C(6, 3)];
  assert.ok(L.bidEstimate(strong).est > 6);
  assert.ok(L.bidEstimate(weak).est < 1.5);
  assert.equal(L.chooseBid(weak, { level: 'normal' }).bid, 0);        // weak hand goes nil
  assert.ok(L.chooseBid(strong, { level: 'normal' }).bid >= 6);
});
test('bids are always 0..13 at every level', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    for (let k = 0; k < 40; k++) {
      const h = randomDeal()[0];
      const b = L.chooseBid(h, { level, seat: 1, dealer: 0, bids: [null, null, null, null], blind: NB, bags: [0, 0], samples: 6 }).bid;
      assert.ok(Number.isInteger(b) && b >= 0 && b <= 13, `${level} bid ${b}`);
    }
  }
});
test('greedyPlay and rankPlays always return a legal card', () => {
  for (let k = 0; k < 300; k++) {
    const hs = randomDeal();
    const seat = k % 4, lead = (seat + 4 - Math.floor(Math.random() * 4)) % 4;
    const trick = [];
    for (let s = lead; s !== seat; s = (s + 1) % 4) {
      const lg = L.legalPlays(hs[s], trick, false);
      const c = lg[Math.floor(Math.random() * lg.length)];
      trick.push({ seat: s, card: c });
    }
    const broken = trick.some(t => t.card.s === 0);
    const v = { seat, hand: hs[seat], trick, lead, broken, bids: [3, 3, 3, 3], blind: NB, tricks: [0, 0, 0, 0],
      pm: L.maskOf(trick.map(t => t.card)), voids: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], done: 0, scores: [0, 0], bags: [0, 0] };
    const legal = L.legalPlays(v.hand, trick, broken).map(L.key);
    assert.ok(legal.includes(L.key(L.greedyPlay(v))));
    const rk = L.rankPlays(v, { samples: 4 });
    if (rk) { assert.equal(rk.length, legal.length); assert.ok(legal.includes(L.key(rk[0].c))); }
  }
});
test('a nil bidder ducks: plays the highest card that still loses', () => {
  const v = { seat: 0, hand: [C(9, 1), C(4, 1), C(13, 1)], trick: T([1, 10, 1]), lead: 1, broken: false, bids: [0, 3, 3, 3],
    blind: NB, tricks: [0, 0, 0, 0], pm: L.maskOf([C(10, 1)]) };
  assert.equal(L.key(L.greedyPlay(v)), L.key(C(9, 1)));
});
test('a nil bidder discarding with no suit to follow throws a high card, not a low one', () => {
  const v = { seat: 0, hand: [C(14, 2), C(3, 2)], trick: T([1, 10, 1]), lead: 1, broken: false, bids: [0, 3, 3, 3],
    blind: NB, tricks: [0, 0, 0, 0], pm: L.maskOf([C(10, 1)]) };
  assert.equal(L.key(L.greedyPlay(v)), L.key(C(14, 2)));
});
test('dealUnseen respects counts and known voids', () => {
  const unseen = []; for (let s = 0; s < 4; s++) for (let r = 2; r <= 14; r++) if (r > 4) unseen.push({ r, s });
  const cnt = [0, 0, 0, 0]; let rest = unseen.length;
  const hs0 = [Math.floor(rest / 3), Math.floor(rest / 3)]; hs0.push(rest - hs0[0] - hs0[1]);
  cnt[1] = hs0[0]; cnt[2] = hs0[1]; cnt[3] = hs0[2];
  const voids = [[0, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];   // seat 1 has no hearts
  for (let k = 0; k < 50; k++) {
    const hs = L.dealUnseen(unseen, cnt, voids);
    for (let s = 1; s < 4; s++) assert.equal(hs[s].length, cnt[s]);
    assert.ok(hs[1].every(c => c.s !== 1));
  }
});
test('explanations are non-empty text', () => {
  const h = randomDeal()[0];
  const r = L.chooseBid(h, { level: 'normal' });
  assert.ok(L.explainBid(h, r).length > 10);
});

/* ---------- stats ---------- */
test('stats: merge tolerates junk, records games and rounds', () => {
  assert.deepEqual(L.mergeStats(null), L.emptyStats());
  assert.deepEqual(L.mergeStats({ games: 'x', w: 3, byDiff: { hard: { w: 2, l: 1 } } }).byDiff.hard, { w: 2, l: 1 });
  const st = L.emptyStats();
  const res = [L.scoreTeam(0, [4, 3, 3, 3], NB, [2, 0, 3, 0], 0), L.scoreTeam(1, [4, 3, 3, 3], NB, [2, 0, 3, 0], 0)];
  L.recordRound(st, { bid: 4, blind: false, took: 2, res });
  assert.equal(st.rounds, 1); assert.equal(st.bidsN, 1);
  L.recordGame(st, { won: true, level: 'normal', margin: 120 });
  L.recordGame(st, { won: false, level: 'normal', margin: -50 });
  assert.equal(st.w, 1); assert.equal(st.l, 1); assert.equal(st.bestStreak, 1); assert.equal(st.byDiff.normal.w, 1);
});

test('version compare', () => {
  assert.equal(L.cmpVer('1.2.0', '1.10.0'), -1);
  assert.equal(L.cmpVer('2.0.0', '1.99.99'), 1);
  assert.equal(L.cmpVer('1.0', '1.0.0'), 0);
});

/* ---------- version and release files stay in step ---------- */
test('APP_VERSION matches version.json', () => {
  const v = /const APP_VERSION='([^']+)'/.exec(read())[1];
  const j = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'version.json'), 'utf8'));
  assert.equal(v, j.version);
  assert.match(j.url, /^https:\/\/github\.com\//);
});

/* ---------- full simulated games ---------- */
function fullGame(level, target, check) {
  const g = loadGame();
  g.run(`settings.level=${JSON.stringify(level)};settings.target=${target};settings.fast=true;`);
  // Check every card played is legal and every round deals out cleanly.
  g.run(`
    var __plays=0,__rounds=0;
    var __pc=playCard;
    playCard=function(s,c){
      const legal=legalPlays(G.hands[s],G.trick,G.broken);
      if(!legal.includes(c))throw new Error('illegal play by seat '+s);
      __plays++;
      return __pc(s,c);
    };
    var __sr=scoreRound;
    scoreRound=async function(A){
      if(G.tricks.reduce((a,b)=>a+b,0)!==13)throw new Error('tricks do not add to 13');
      __rounds++;
      return __sr(A);
    };
  `);
  return g.run('newGame()').then(() => {
    assert.equal(g.run('G.over'), true);
    assert.ok(g.run('__plays') >= 52);
    if (check) check(g);
    return g;
  });
}
for (const level of ['easy', 'normal']) {
  test(`full games at ${level}: always legal, 13 tricks a hand, ends with a winner`, async () => {
    for (let i = 0; i < 6; i++) {
      const g = await fullGame(level, 250);
      const s = g.run('G.scores');
      assert.ok(s[0] >= 250 || s[1] >= 250 || s[0] <= -200 || s[1] <= -200, `scores ${s}`);
    }
    // stats were recorded
    assert.equal(JSON.parse((await fullGame(level, 250)).store.get('spades-stats')).games, 1);
  });
}
test('full game at hard (few samples): legal and completes', async () => {
  const src = read();
  assert.ok(src.includes('rankPlays'));
  const g = loadGame();
  g.run(`settings.level='hard';settings.target=250;settings.fast=true;`);
  // keep the lookahead cheap in the test
  g.run(`var __rp=rankPlays;rankPlays=(v,o)=>__rp(v,Object.assign({samples:3},o));
         var __bb=bidByRollout;bidByRollout=(h,o)=>__bb(h,Object.assign({samples:3},o));`);
  await g.run('newGame()');
  assert.equal(g.run('G.over'), true);
});
test('a saved game round-trips, resumes mid-hand and finishes', async () => {
  const g = loadGame();
  g.run(`settings.level='normal';settings.target=250;settings.fast=true;`);
  // Stop the first game part-way through a hand by throwing from the human seat.
  g.run(`var __n=0;humanPlay=()=>{if(++__n===4)return new Promise(()=>{});return Promise.resolve(greedyPlay(viewFor(0)))};`);
  g.run('newGame()');
  for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r));
  const raw = g.store.get('spades-save');
  assert.ok(raw, 'game was saved');
  const saved = L.unpackGame(JSON.parse(raw));
  assert.ok(saved, 'saved game validates');
  // resume it in a fresh page
  const h = loadGame();
  h.run(`settings.fast=true;`);
  h.ctx.__saved = saved;
  await h.run('newGame(__saved)');
  assert.equal(h.run('G.over'), true);
});
test('unpackGame rejects damaged saves', async () => {
  const g = loadGame();
  g.run(`settings.fast=true;humanPlay=()=>{if(__n++===2)return new Promise(()=>{});return Promise.resolve(greedyPlay(viewFor(0)))};var __n=0;`);
  g.run('newGame()');
  for (let i = 0; i < 50; i++) await new Promise(r => setImmediate(r));
  const good = JSON.parse(g.store.get('spades-save'));
  assert.ok(L.unpackGame(good));
  const bad = fn => { const c = JSON.parse(JSON.stringify(good)); fn(c); return L.unpackGame(c); };
  assert.equal(bad(c => { c.hands[1].pop(); }), null);
  assert.equal(bad(c => { c.hands[1][0] = c.hands[2][0]; }), null);   // duplicate card
  assert.equal(bad(c => { c.scores = [1]; }), null);
  assert.equal(bad(c => { c.level = 'insane'; }), null);
  assert.equal(bad(c => { c.v = 2; }), null);
  assert.equal(L.unpackGame(null), null);
  assert.equal(L.unpackGame('x'), null);
});
