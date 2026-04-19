const { findBestHand, HAND_NAMES } = require('./handEvaluator');

// 9种独立AI人格（9人桌100%不重复）
const AI_PERSONALITIES = {
  TAG:     { name: "紧凶高手", vpip: 15, pfr: 12, bluff: 0.10, cbet: 0.80, fold: 0.30, allin: 0.05, slow: 0.10 },
  LAG:     { name: "松凶狂人", vpip: 35, pfr: 25, bluff: 0.30, cbet: 0.90, fold: 0.10, allin: 0.20, slow: 0.00 },
  TP:      { name: "紧弱怂货", vpip: 12, pfr: 3, bluff: 0.00, cbet: 0.20, fold: 0.50, allin: 0.02, slow: 0.20 },
  CALL:    { name: "跟注站",   vpip: 40, pfr: 2, bluff: 0.00, cbet: 0.10, fold: 0.05, allin: 0.10, slow: 0.00 },
  MANIAC:  { name: "疯子",     vpip: 50, pfr: 40, bluff: 0.40, cbet: 1.00, fold: 0.00, allin: 0.60, slow: 0.00 },
  SLOW:    { name: "埋伏流",   vpip: 20, pfr: 8, bluff: 0.10, cbet: 0.30, fold: 0.20, allin: 0.10, slow: 0.80 },
  FISH:    { name: "新手鱼",   vpip: 30, pfr: 10, bluff: 0.20, cbet: 0.40, fold: 0.20, allin: 0.30, slow: 0.10 },
  ROCK:    { name: "岩石流",   vpip: 8, pfr: 5, bluff: 0.02, cbet: 0.50, fold: 0.60, allin: 0.08, slow: 0.30 },
  BLASTER: { name: "爆破流",   vpip: 18, pfr: 16, bluff: 0.35, cbet: 0.70, fold: 0.25, allin: 0.15, slow: 0.05 }
};

// 充足AI名字池（无重名）
const AI_NAMES = [
  'AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot', 'OmegaBot',
  'SigmaBot', 'ThetaBot', 'ZetaBot', 'KappaBot', 'LambdaBot',
  'EpsilonBot', 'MuBot', 'NuBot', 'XiBot', 'PiBot'
];

// ========== 仅3档难度：简单 / 中等 / 困难 ==========
const AI_CONFIGS = {
  easy: {
    mul: 0.6,
    mistakeRate: 0.4,  // 高失误：乱打、乱弃
    winBonus: 0.0,     // 无胜率加成
    think: [600, 1200]
  },
  medium: {
    mul: 1.0,
    mistakeRate: 0.15, // 少量失误
    winBonus: 0.1,     // 正常胜率
    think: [1200, 2500]
  },
  hard: {
    mul: 1.4,
    mistakeRate: 0.02, // 几乎零失误
    winBonus: 0.25,    // 高手胜率
    think: [1500, 3500]
  }
};

// 房间人格缓存（保证9人不重复）
const roomPersonalityCache = new Map();

// 创建AI：自动分配不重复人格
function pickAiName(existingNames, roomId) {
  const freeNames = AI_NAMES.filter(n => !existingNames.includes(n));
  const name = freeNames.length
    ? freeNames[Math.floor(Math.random() * freeNames.length)]
    : `Bot_${Date.now() % 10000}`;

  if (!roomPersonalityCache.has(roomId)) roomPersonalityCache.set(roomId, new Set());
  const used = roomPersonalityCache.get(roomId);
  const all = Object.keys(AI_PERSONALITIES);
  const free = all.filter(s => !used.has(s));
  const personality = free.length
    ? free[Math.floor(Math.random() * free.length)]
    : all[Math.floor(Math.random() * all.length)];

  used.add(personality);
  return { name, personality };
}

// 房间销毁清空缓存（必须调用）
function clearRoomPersonality(roomId) {
  roomPersonalityCache.delete(roomId);
}

// 翻前强度（人格+难度修正）
function evaluatePreflopStrength(cards, personality, difficulty) {
  if (!cards || cards.length < 2) return 0.5;
  const rankMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const [r1, r2] = cards.map(c => rankMap[c.value] || 0);
  const [high, low] = [Math.max(r1, r2), Math.min(r1, r2)];
  const suited = cards[0].suit === cards[1].suit;
  const pair = r1 === r2;

  let score = pair
    ? 0.5 + (high / 14) * 0.4
    : (high + low) / 28 + (suited ? 0.06 : 0) + (high - low <= 2 ? 0.04 : 0);

  score *= (AI_PERSONALITIES[personality].vpip / 25);
  score += AI_CONFIGS[difficulty].winBonus;
  return Math.min(1, Math.max(0.1, score));
}

// 翻后强度（人格+难度修正）
function evaluatePostflopStrength(holeCards, communityCards, difficulty) {
  if (!holeCards || !communityCards || communityCards.length < 3) return 0.5;
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best = 0;
  for (const c of combos) best = Math.max(best, quickEvaluate(c));
  const score = best / 9 + AI_CONFIGS[difficulty].winBonus;
  return Math.min(1, Math.max(0.1, score));
}

function getCombinations(arr, k) {
  const res = [];
  const dfs = (s, p) => {
    p.length === k && res.push([...p]);
    for (let i = s; i < arr.length; i++) { p.push(arr[i]); dfs(i+1, p); p.pop(); }
  };
  dfs(0, []);
  return res;
}

function quickEvaluate(cards) {
  const m = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
  const ranks = cards.map(x => m[x.value] || 0).sort((a, b) => a - b);
  const suits = cards.map(x => x.suit);
  const flush = suits.every(s => s === suits[0]);
  const unique = [...new Set(ranks)];
  const straight = unique.length === 5 && (
    unique[4]-unique[0]===4 || (unique.includes(14)&&unique.includes(2)&&unique.includes(3)&&unique.includes(4)&&unique.includes(5))
  );
  const freq = {}; ranks.forEach(r => freq[r]=(freq[r]||0)+1);
  const cnt = Object.values(freq).sort((a,b)=>b-a);
  if (flush&&straight) return9; if (cnt[0]===4) return8; if (cnt[0]===3&&cnt[1]===2) return7;
  if (flush) return6; if (straight) return5; if (cnt[0]===3) return4; if (cnt[0]===2&&cnt[1]===2) return3; if (cnt[0]===2) return2;
  return1;
}

function calculatePotOdds(call, pot) { return call<=0 ? 1 : call/(pot+call); }

function getBetSize(str, pot, bb, p, cfg) {
  const mul = str>0.8 ? 0.7 : str>0.5 ? 0.4 : 0.3;
  return Math.max(Math.floor(pot * mul * (p.pfr/15) * cfg.mul), bb);
}

// 核心决策（3难度 + 9人格）
function makeDecision(difficulty, gameState, playerId) {
  const cfg = AI_CONFIGS[difficulty] || AI_CONFIGS.medium;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.isActive) return { action: 'fold' };

  const pers = player.personality || 'FISH';
  const p = AI_PERSONALITIES[pers];
  const rnd = Math.random();

  const hole = gameState.myCards || [];
  const comm = gameState.communityCards || [];
  const pre = comm.length === 0;
  const call = Math.max(0, gameState.currentBet - (gameState.myBet||0));
  const check = call <= 0;
  const pot = gameState.pot || 0;
  const bb = gameState.bigBlind || 20;
  const minRaise = gameState.minRaise || bb;

  const str = pre
    ? evaluatePreflopStrength(hole, pers, difficulty)
    : evaluatePostflopStrength(hole, comm, difficulty);
  const strong = str > 0.7;
  const nuts = str > 0.9;

  // 难度失误机制
  if (rnd < cfg.mistakeRate) {
    const mis = Math.random();
    if (mis < 0.4) return { action: 'fold' };
    if (mis < 0.7) return check ? { action: 'check' } : { action: 'call' };
    return { action: 'raise', amount: Math.min(gameState.currentBet + minRaise*2, player.chips) };
  }

  // 人格硬逻辑
  if (pers === 'MANIAC') {
    if (rnd < p.allin) return { action: 'all-in' };
    if (check) return { action: 'raise', amount: Math.min(gameState.currentBet+minRaise*3, player.chips) };
    return call < player.chips*0.5 ? { action: 'call' } : { action: 'all-in' };
  }
  if (pers === 'CALL') return check ? { action: 'check' } : (call<=player.chips ? { action: 'call' } : { action: 'all-in' });
  if (pers === 'SLOW' && nuts && check) return { action: 'check' };
  if (pers === 'ROCK' && !strong && !check) return { action: 'fold' };

  // 通用逻辑
  if (check) {
    if (gameState.lastRaiserId === playerId && rnd < p.cbet * cfg.mul) {
      const bet = getBetSize(str, pot, bb, p, cfg);
      return { action: 'raise', amount: Math.min(gameState.currentBet+bet, player.chips) };
    }
    if (strong && rnd < (p.pfr/20)*cfg.mul) {
      const bet = getBetSize(str, pot, bb, p, cfg)*1.5;
      return { action: 'raise', amount: Math.min(gameState.currentBet+bet, player.chips) };
    }
    if (!strong && rnd < p.bluff*cfg.mul) {
      return { action: 'raise', amount: Math.min(gameState.currentBet+minRaise*2, player.chips) };
    }
    return { action: 'check' };
  }

  if (rnd < p.fold*cfg.mul && !strong) return { action: 'fold' };
  if (strong && rnd < 0.4*cfg.mul) {
    const bet = getBetSize(str, pot+call, bb, p, cfg);
    return { action: 'raise', amount: Math.min(gameState.currentBet+bet, player.chips) };
  }
  if (strong && rnd < p.allin*cfg.mul) return { action: 'all-in' };
  return call <= player.chips ? { action: 'call' } : { action: 'fold' };
}

// 差异化思考时间
function getThinkTime(difficulty, personality) {
  const cfg = AI_CONFIGS[difficulty] || AI_CONFIGS.medium;
  const p = AI_PERSONALITIES[personality || 'FISH'];
  const speed = p.name === '疯子' ? 0.4 : p.name === '紧凶高手' ? 1.3 : 1;
  return Math.floor((cfg.think[0] + Math.random()*(cfg.think[1]-cfg.think[0])) * speed);
}

module.exports = {
  AI_NAMES,
  AI_PERSONALITIES,
  pickAiName,
  clearRoomPersonality,
  makeDecision,
  getThinkTime
};