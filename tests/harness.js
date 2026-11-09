// Loads the game out of spades.html so it can be tested in Node without a browser.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = path.join(__dirname, '..', 'spades.html');
const read = () => fs.readFileSync(HTML, 'utf8');
const script = () => read().split('<script>')[1].split('</script>')[0];

// Just the pure rules/AI/stats code between the LOGIC markers.
function loadLogic() {
  const code = script().split('// ==LOGIC==')[1].split('// ==END LOGIC==')[0];
  return new Function(code + `
    return {SUITS,RANKS,key,SORT,cmpHand,newDeck,shuffle,maskOf,legalPlays,beats,curWinner,trickWinner,scoreTeam,gameWinner,diffFor,
            isMaster,greedyPlay,bidEstimate,nilDanger,finishRound,bidByRollout,chooseBid,LEVELS,wantsBlindNil,dealUnseen,rankPlays,
            explainBid,explainPlay,cmpVer,emptyStats,mergeStats,recordRound,recordGame,packGame,unpackGame};`)();
}

// The whole game script, with a fake DOM and instant timers, for running full games. The human seat is played by
// the rule-of-thumb policy (or by opts.human(view) when given), so a whole game runs with no input.
function loadGame(opts = {}) {
  const store = new Map();
  const stub = () => ({
    innerHTML: '', textContent: '', className: '', disabled: false, dataset: {}, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener() {}, querySelectorAll() { return []; }, onclick: null, onchange: null,
  });
  const els = {};
  const ctx = {
    document: { getElementById: id => els[id] || (els[id] = stub()), body: stub(), addEventListener() {}, hidden: false },
    window: { addEventListener() {} },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => { store.delete(k); },
    },
    fetch: () => Promise.reject(new Error('offline')),
    console, Math, Promise, Date, JSON, Set, Map, Array, Object, Number, String, parseInt, isFinite,
    setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Error,
  };
  vm.createContext(ctx);
  const js = script()
    .replace('const sleep=ms=>new Promise(r=>setTimeout(r,ms));', 'var sleep=()=>Promise.resolve();')
    .replace(/\nstart\(\);\s*$/, '\n');
  vm.runInContext(js, ctx);
  const run = code => vm.runInContext(code, ctx);
  // Auto-play the human seat.
  ctx.__human = opts.human || null;
  run(`
    humanBid=()=>Promise.resolve(chooseBid(G.hands[0],{level:'normal'}).bid);
    askBlind=()=>Promise.resolve(false);
    showRound=()=>Promise.resolve();
    humanPlay=()=>Promise.resolve(__human?__human(viewFor(0)):greedyPlay(viewFor(0)));
  `);
  return { ctx, run, store };
}

module.exports = { loadLogic, loadGame, read };
