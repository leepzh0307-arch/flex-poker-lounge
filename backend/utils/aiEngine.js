const { findBestHand, HAND_NAMES } = require('./handEvaluator');

const AI_PERSONALITIES = {
  TAG:     { name: "紧凶高手", vpip: 18, pfr: 14, aggression: 0.65, bluff: 0.08, foldToBet: 0.35, slowPlay: 0.15, allinMinStr: 0.90 },
  LAG:     { name: "松凶狂人", vpip: 35, pfr: 28, aggression: 0.75, bluff: 0.20, foldToBet: 0.15, slowPlay: 0.05, allinMinStr: 0.80 },
  TP:      { name: "紧弱怂货", vpip: 14, pfr: 5,  aggression: 0.25, bluff: 0.02, foldToBet: 0.55, slowPlay: 0.25, allinMinStr: 0.92 },
  CALL:    { name: "跟注站",   vpip: 38, pfr: 4,  aggression: 0.15, bluff: 0.02, foldToBet: 0.08, slowPlay: 0.05, allinMinStr: 0.88 },
  MANIAC:  { name: "疯子",     vpip: 45, pfr: 35, aggression: 0.85, bluff: 0.30, foldToBet: 0.05, slowPlay: 0.00, allinMinStr: 0.70 },
  SLOW:    { name: "埋伏流",   vpip: 20, pfr: 8,  aggression: 0.30, bluff: 0.05, foldToBet: 0.30, slowPlay: 0.70, allinMinStr: 0.90 },
  FISH:    { name: "新手鱼",   vpip: 30, pfr: 10, aggression: 0.40, bluff: 0.12, foldToBet: 0.25, slowPlay: 0.08, allinMinStr: 0.85 },
  ROCK:    { name: "岩石流",   vpip: 10, pfr: 6,  aggression: 0.35, bluff: 0.02, foldToBet: 0.60, slowPlay: 0.30, allinMinStr: 0.93 },
  BLASTER: { name: "爆破流",   vpip: 20, pfr: 18, aggression: 0.70, bluff: 0.22, foldToBet: 0.30, slowPlay: 0.05, allinMinStr: 0.82 }
};

const AI_NAMES = [
  'BOT1', 'BOT2', 'BOT3', 'BOT4', 'BOT5',
  'BOT6', 'BOT7', 'BOT8', 'BOT9', 'BOT10',
  'BOT11', 'BOT12', 'BOT13', 'BOT14', 'BOT15'
];

const AI_CONFIGS = {
  easy: {
    label: '简单',
    mistakeRate: 0.20,
    winBonus: 0.0,
    think: [1500, 2500]
  },
  medium: {
    label: '中等',
    mistakeRate: 0.08,
    winBonus: 0.05,
    think: [1800, 3200]
  },
  hard: {
    label: '困难',
    mistakeRate: 0.02,
    winBonus: 0.10,
    think: [2000, 4000]
  }
};

const roomPersonalityCache = new Map();

function pickAiName(existingNames, roomId) {
  const freeNames = AI_NAMES.filter(n => !existingNames.includes(n));
  const name = freeNames.length
    ? freeNames[Math.floor(Math.random() * freeNames.length)]
    : `BOT_${Date.now() % 10000}`;

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

function clearRoomPersonality(roomId) {
  roomPersonalityCache.delete(roomId);
}

function evaluatePreflopStrength(cards) {
  if (!cards || cards.length < 2) return 0.3;
  const rankMap = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };
  const [r1, r2] = cards.map(c => rankMap[c.value] || 0);
  const [high, low] = [Math.max(r1, r2), Math.min(r1, r2)];
  const suited = cards[0].suit === cards[1].suit;
  const pair = r1 === r2;

  if (pair) {
    if (high >= 13) return 0.95;
    if (high >= 10) return 0.85;
    if (high >= 7) return 0.65;
    return 0.50;
  }

  let score = 0;
  if (high === 14) {
    if (low >= 12) score = 0.85;
    else if (low >= 10) score = 0.70;
    else if (low >= 8) score = suited ? 0.60 : 0.50;
    else if (suited) score = 0.50;
    else score = 0.30;
  } else if (high === 13) {
    if (low >= 11) score = suited ? 0.70 : 0.60;
    else if (low >= 9) score = suited ? 0.55 : 0.45;
    else score = suited ? 0.40 : 0.25;
  } else if (high === 12) {
    if (low >= 10) score = suited ? 0.60 : 0.50;
    else score = suited ? 0.38 : 0.22;
  } else if (high >= 10 && low >= 9) {
    score = suited ? 0.50 : 0.40;
  } else if (suited && high - low <= 2 && high >= 7) {
    score = 0.40;
  } else if (suited && high - low <= 1) {
    score = 0.35;
  } else if (high - low <= 1 && high >= 7) {
    score = 0.30;
  } else {
    score = 0.15;
  }

  return score;
}

function evaluatePostflopStrength(holeCards, communityCards, difficulty) {
  if (!holeCards || !communityCards || communityCards.length < 3) return 0.4;
  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);
  let best = 0;
  for (const c of combos) best = Math.max(best, quickEvaluate(c));
  let score;
  if (best >= 8) score = 0.95;
  else if (best === 7) score = 0.90;
  else if (best === 6) score = 0.80;
  else if (best === 5) score = 0.65;
  else if (best === 4) score = 0.60;
  else if (best === 3) score = 0.50;
  else if (best === 2) score = 0.35;
  else score = 0.15;

  const hasOvercard = holeCards.some(c => {
    const m = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
    return (m[c.value]||0) >= 12;
  });
  if (best <= 1 && hasOvercard) score += 0.08;

  const hasFlushDraw = communityCards.length >= 3 && (() => {
    const suitCount = {};
    for (const c of allCards) { suitCount[c.suit] = (suitCount[c.suit]||0)+1; }
    return Object.values(suitCount).some(v => v === 4);
  })();
  if (hasFlushDraw && best <= 2) score += 0.10;

  const hasStraightDraw = communityCards.length >= 3 && (() => {
    const m = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14};
    const vals = [...new Set(allCards.map(c => m[c.value]||0))].sort((a,b)=>a-b);
    for (let i = 0; i < vals.length - 3; i++) {
      if (vals[i+3] - vals[i] <= 4) return true;
    }
    return false;
  })();
  if (hasStraightDraw && best <= 2) score += 0.07;

  score += AI_CONFIGS[difficulty].winBonus;
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
  if (flush && straight) return 9;
  if (cnt[0] === 4) return 8;
  if (cnt[0] === 3 && cnt[1] === 2) return 7;
  if (flush) return 6;
  if (straight) return 5;
  if (cnt[0] === 3) return 4;
  if (cnt[0] === 2 && cnt[1] === 2) return 3;
  if (cnt[0] === 2) return 2;
  return 1;
}

function calculatePotOdds(call, pot) {
  return call <= 0 ? 0 : call / (pot + call);
}

function getBetSize(str, pot, bb, personality) {
  if (str > 0.8) return Math.max(Math.floor(pot * 0.65), bb);
  if (str > 0.6) return Math.max(Math.floor(pot * 0.45), bb);
  if (str > 0.4) return Math.max(Math.floor(pot * 0.30), bb);
  return Math.max(Math.floor(pot * 0.25), bb);
}

function isShortStacked(chips, bb) {
  return chips > 0 && chips <= bb * 12;
}

function isVeryShortStacked(chips, bb) {
  return chips > 0 && chips <= bb * 6;
}

function shouldGoAllIn(str, pers, p, pre, chips, bb, call, pot) {
  if (chips <= 0) return false;

  if (isVeryShortStacked(chips, bb)) {
    return str >= 0.35;
  }

  if (isShortStacked(chips, bb)) {
    return str >= 0.55;
  }

  if (chips > bb * 30) {
    if (pre) return false;
    return str >= 0.92 && Math.random() < 0.15;
  }

  const allinThreshold = p.allinMinStr;

  if (pre) {
    return str >= allinThreshold && str >= 0.85 && Math.random() < 0.2;
  }

  return str >= allinThreshold && Math.random() < 0.3;
}

function makeDecision(difficulty, gameState, playerId) {
  const cfg = AI_CONFIGS[difficulty] || AI_CONFIGS.medium;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.isActive) return { action: 'fold' };

  const pers = player.personality || 'FISH';
  const p = AI_PERSONALITIES[pers];

  const hole = gameState.myCards || [];
  const comm = gameState.communityCards || [];
  const pre = comm.length === 0;
  const call = Math.max(0, gameState.currentBet - (gameState.myBet || 0));
  const check = call <= 0;
  const pot = gameState.pot || 0;
  const bb = gameState.bigBlind || 20;
  const minRaise = gameState.minRaise || bb;
  const chips = player.chips || 0;
  const spr = pot > 0 ? chips / pot : 999;

  const baseStr = pre
    ? evaluatePreflopStrength(hole)
    : evaluatePostflopStrength(hole, comm, difficulty);

  const str = Math.min(1, Math.max(0.1, baseStr));
  const weak = str < 0.35;
  const medium = str >= 0.35 && str < 0.6;
  const strong = str >= 0.6 && str < 0.8;
  const veryStrong = str >= 0.8;
  const nuts = str >= 0.9;

  const potOdds = calculatePotOdds(call, pot);
  const callTooBig = call > chips * 0.4 && !veryStrong;
  const callMassive = call > chips * 0.7;

  // === 难度失误机制 ===
  if (Math.random() < cfg.mistakeRate) {
    const mis = Math.random();
    if (check) {
      if (mis < 0.5) return { action: 'check' };
      if (mis < 0.8 && str > 0.4) return { action: 'raise', amount: Math.min(gameState.currentBet + minRaise, chips) };
      return { action: 'check' };
    }
    if (mis < 0.3 && weak) return { action: 'fold' };
    if (mis < 0.7) return call <= chips ? { action: 'call' } : { action: 'fold' };
    if (str > 0.5) return { action: 'raise', amount: Math.min(gameState.currentBet + minRaise * 2, chips) };
    return call <= chips ? { action: 'call' } : { action: 'fold' };
  }

  // === 绝对规则：可过牌时绝不弃牌 ===
  if (check) {
    return decideWhenCanCheck(str, pre, pot, bb, minRaise, chips, gameState, playerId, pers, p, difficulty);
  }

  // === 必须跟注时的决策 ===
  return decideWhenMustCall(str, pre, call, pot, bb, minRaise, chips, spr, potOdds, callTooBig, callMassive, gameState, playerId, pers, p, difficulty);
}

function decideWhenCanCheck(str, pre, pot, bb, minRaise, chips, gameState, playerId, pers, p, difficulty) {
  const rnd = Math.random();
  const weak = str < 0.35;
  const medium = str >= 0.35 && str < 0.6;
  const strong = str >= 0.6 && str < 0.8;
  const veryStrong = str >= 0.8;
  const nuts = str >= 0.9;

  if (p.slowPlay > 0 && veryStrong && rnd < p.slowPlay) {
    return { action: 'check' };
  }

  if (pre) {
    let raiseProb = 0;
    if (veryStrong) raiseProb = 0.7 + p.pfr / 100;
    else if (strong) raiseProb = 0.3 + p.pfr / 200;
    else if (medium) raiseProb = p.pfr / 200;
    else raiseProb = p.bluff * 0.3;
    raiseProb = Math.min(raiseProb, 0.95);

    if (rnd < raiseProb) {
      const raiseAmt = Math.min(gameState.currentBet + bb * (2 + Math.floor(str * 3)), chips);
      if (raiseAmt > gameState.currentBet && raiseAmt <= chips) {
        return { action: 'raise', amount: raiseAmt };
      }
    }
    return { action: 'check' };
  }

  if (gameState.lastRaiserId === playerId && rnd < p.aggression * 0.6) {
    const bet = getBetSize(str, pot, bb, p);
    const raiseAmt = Math.min(gameState.currentBet + bet, chips);
    if (raiseAmt > gameState.currentBet) {
      return { action: 'raise', amount: raiseAmt };
    }
  }

  if (veryStrong && rnd < p.aggression * 0.8) {
    const bet = getBetSize(str, pot, bb, p);
    const raiseAmt = Math.min(gameState.currentBet + bet, chips);
    if (raiseAmt > gameState.currentBet) {
      return { action: 'raise', amount: raiseAmt };
    }
  }

  if (strong && rnd < p.aggression * 0.4) {
    const bet = getBetSize(str, pot, bb, p);
    const raiseAmt = Math.min(gameState.currentBet + bet, chips);
    if (raiseAmt > gameState.currentBet) {
      return { action: 'raise', amount: raiseAmt };
    }
  }

  if (weak && rnd < p.bluff * 0.5) {
    const bluffAmt = Math.min(gameState.currentBet + bb * 2, chips);
    if (bluffAmt > gameState.currentBet) {
      return { action: 'raise', amount: bluffAmt };
    }
  }

  return { action: 'check' };
}

function decideWhenMustCall(str, pre, call, pot, bb, minRaise, chips, spr, potOdds, callTooBig, callMassive, gameState, playerId, pers, p, difficulty) {
  const rnd = Math.random();
  const weak = str < 0.35;
  const medium = str >= 0.35 && str < 0.6;
  const strong = str >= 0.6 && str < 0.8;
  const veryStrong = str >= 0.8;
  const nuts = str >= 0.9;

  if (shouldGoAllIn(str, pers, p, pre, chips, bb, call, pot)) {
    return { action: 'all-in' };
  }

  if (weak) {
    let foldProb = p.foldToBet;
    if (str < 0.2) foldProb = Math.min(foldProb + 0.3, 0.9);
    if (callMassive || callTooBig) {
      return { action: 'fold' };
    }
    if (potOdds < 0.15 && rnd < foldProb * 0.5) {
      return call <= chips ? { action: 'call' } : { action: 'fold' };
    }
    if (rnd < foldProb) {
      return { action: 'fold' };
    }
    return call <= chips ? { action: 'call' } : { action: 'fold' };
  }

  if (medium) {
    if (callMassive && !isShortStacked(chips, bb)) {
      return { action: 'fold' };
    }
    if (callTooBig && rnd < p.foldToBet * 0.5) {
      return { action: 'fold' };
    }
    if (rnd < p.aggression * 0.2 && potOdds < 0.3) {
      const bet = getBetSize(str, pot + call, bb, p);
      const raiseAmt = Math.min(gameState.currentBet + bet, chips);
      if (raiseAmt > gameState.currentBet + minRaise) {
        return { action: 'raise', amount: raiseAmt };
      }
    }
    return call <= chips ? { action: 'call' } : { action: 'fold' };
  }

  if (strong) {
    if (callMassive && !isShortStacked(chips, bb) && !nuts) {
      if (rnd < 0.3) return { action: 'fold' };
      return call <= chips ? { action: 'call' } : { action: 'fold' };
    }
    if (rnd < p.aggression * 0.5) {
      const bet = getBetSize(str, pot + call, bb, p);
      const raiseAmt = Math.min(gameState.currentBet + bet, chips);
      if (raiseAmt > gameState.currentBet + minRaise) {
        return { action: 'raise', amount: raiseAmt };
      }
    }
    return call <= chips ? { action: 'call' } : { action: 'fold' };
  }

  if (veryStrong) {
    if (p.slowPlay > 0 && rnd < p.slowPlay * 0.3) {
      return call <= chips ? { action: 'call' } : { action: 'all-in' };
    }
    if (rnd < p.aggression * 0.7) {
      const bet = getBetSize(str, pot + call, bb, p);
      const raiseAmt = Math.min(gameState.currentBet + bet, chips);
      if (raiseAmt > gameState.currentBet + minRaise) {
        return { action: 'raise', amount: raiseAmt };
      }
    }
    return call <= chips ? { action: 'call' } : { action: 'all-in' };
  }

  return call <= chips ? { action: 'call' } : { action: 'fold' };
}

function getThinkTime(difficulty, personality) {
  const cfg = AI_CONFIGS[difficulty] || AI_CONFIGS.medium;
  const p = AI_PERSONALITIES[personality || 'FISH'];
  const speedMul = p.aggression > 0.7 ? 0.85 : p.aggression < 0.3 ? 1.2 : 1.0;
  const base = cfg.think[0] + Math.random() * (cfg.think[1] - cfg.think[0]);
  return Math.max(1500, Math.floor(base * speedMul));
}

module.exports = {
  AI_NAMES,
  AI_PERSONALITIES,
  AI_CONFIGS,
  pickAiName,
  clearRoomPersonality,
  makeDecision,
  getThinkTime
};
