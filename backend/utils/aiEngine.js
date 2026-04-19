const { findBestHand, HAND_NAMES } = require('./handEvaluator');

const AI_NAMES = [
  'AlphaBot', 'BetaBot', 'GammaBot', 'DeltaBot', 'OmegaBot',
  'SigmaBot', 'ThetaBot', 'ZetaBot', 'KappaBot', 'LambdaBot',
];

const AI_CONFIGS = {
  easy: {
    label: '简单',
    foldProb: 0.15,
    raiseProb: 0.15,
    callProb: 0.70,
    bluffProb: 0.05,
    thinkTimeMin: 800,
    thinkTimeMax: 1500,
  },
  medium: {
    label: '中等',
    foldProb: 0.10,
    raiseProb: 0.25,
    callProb: 0.65,
    bluffProb: 0.10,
    thinkTimeMin: 1200,
    thinkTimeMax: 2500,
  },
  hard: {
    label: '困难',
    foldProb: 0.08,
    raiseProb: 0.35,
    callProb: 0.57,
    bluffProb: 0.15,
    thinkTimeMin: 1500,
    thinkTimeMax: 3000,
  },
};

function pickAiName(existingNames) {
  const available = AI_NAMES.filter(n => !existingNames.includes(n));
  if (available.length === 0) return 'Bot_' + Math.floor(Math.random() * 9000 + 1000);
  return available[Math.floor(Math.random() * available.length)];
}

function evaluatePreflopStrength(cards) {
  if (!cards || cards.length < 2) return 0.5;

  const rankMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const r1 = rankMap[cards[0].value] || 0;
  const r2 = rankMap[cards[1].value] || 0;
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = cards[0].suit === cards[1].suit;
  const pair = r1 === r2;

  let score = 0;

  if (pair) {
    score = 0.5 + (high / 14) * 0.5;
  } else {
    score = (high + low) / 28;
    if (suited) score += 0.06;
    if (high - low <= 2) score += 0.04;
    if (high >= 12) score += 0.08;
  }

  return Math.min(1, Math.max(0, score));
}

function evaluatePostflopStrength(holeCards, communityCards) {
  if (!holeCards || holeCards.length < 2) return 0.5;
  if (!communityCards || communityCards.length < 3) return evaluatePreflopStrength(holeCards);

  const allCards = [...holeCards, ...communityCards];

  if (allCards.length >= 5) {
    try {
      const combos = getCombinations(allCards, 5);
      let bestRank = -1;
      for (const combo of combos) {
        const result = quickEvaluate(combo);
        if (result > bestRank) bestRank = result;
      }
      return bestRank / 9;
    } catch (e) {
      return 0.5;
    }
  }

  return 0.5;
}

function getCombinations(arr, k) {
  const result = [];
  function combine(start, combo) {
    if (combo.length === k) { result.push([...combo]); return; }
    for (let i = start; i < arr.length; i++) { combo.push(arr[i]); combine(i + 1, combo); combo.pop(); }
  }
  combine(0, []);
  return result;
}

function quickEvaluate(cards) {
  const rankMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const ranks = cards.map(c => rankMap[c.value] || (typeof c.rank === 'number' ? c.rank : 0)).sort((a, b) => a - b);
  const suits = cards.map(c => c.suit);

  const isFlush = suits.every(s => s === suits[0]);

  let isStraight = false;
  let straightHigh = 0;
  const unique = [...new Set(ranks)];
  if (unique.length === 5) {
    if (unique[4] - unique[0] === 4) { isStraight = true; straightHigh = unique[4]; }
    if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
      isStraight = true; straightHigh = 5;
    }
  }

  const freq = {};
  ranks.forEach(r => { freq[r] = (freq[r] || 0) + 1; });
  const counts = Object.values(freq).sort((a, b) => b - a);

  if (isFlush && isStraight) return straightHigh === 14 ? 9 : 8;
  if (counts[0] === 4) return 7;
  if (counts[0] === 3 && counts[1] === 2) return 6;
  if (isFlush) return 5;
  if (isStraight) return 4;
  if (counts[0] === 3) return 3;
  if (counts[0] === 2 && counts[1] === 2) return 2;
  if (counts[0] === 2) return 1;
  return 0;
}

function calculatePotOdds(callAmount, potAmount) {
  if (callAmount <= 0) return 1;
  const totalPot = potAmount + callAmount;
  return callAmount / totalPot;
}

function analyzeHandStrength(handStrength, communityCardsLength) {
  const isPostflop = communityCardsLength >= 3;

  let tier;
  let isStrong = false;
  let isVeryStrong = false;
  let isNuts = false;

  if (!isPostflop) {
    if (handStrength >= 0.75) {
      tier = 'premium';
      isStrong = true;
      isVeryStrong = handStrength >= 0.85;
    } else if (handStrength >= 0.5) {
      tier = 'playable';
    } else {
      tier = 'marginal';
    }
  } else {
    if (handStrength >= 0.9) {
      tier = 'nuts';
      isNuts = true;
      isVeryStrong = true;
      isStrong = true;
    } else if (handStrength >= 0.75) {
      tier = 'veryStrong';
      isVeryStrong = true;
      isStrong = true;
    } else if (handStrength >= 0.55) {
      tier = 'strong';
      isStrong = true;
    } else if (handStrength >= 0.35) {
      tier = 'medium';
    } else {
      tier = 'weak';
    }
  }

  return { tier, isStrong, isVeryStrong, isNuts };
}

function getPositionInfo(seat, dealerSeat, totalPlayers) {
  if (!seat || dealerSeat === undefined || !totalPlayers) {
    return { relativePos: -1, isLate: false, isEarly: false, isButton: false, isBlind: false };
  }
  let relativePos = (seat - 1 - dealerSeat + totalPlayers) % totalPlayers;

  const isLate = relativePos <= 2;
  const isEarly = relativePos >= totalPlayers - 2 && totalPlayers > 4;

  return {
    relativePos,
    isLate,
    isEarly,
    isButton: relativePos === 0,
    isBlind: relativePos === 1 || relativePos === 2
  };
}

function getRoundAggressionLevel(gameState) {
  return gameState.lastRaiserId ? 'high' : 'low';
}

function makeDecision(difficulty, gameState, playerId) {
  const config = AI_CONFIGS[difficulty] || AI_CONFIGS.easy;
  const player = gameState.players.find(p => p.id === playerId);
  if (!player || !player.isActive) return { action: 'fold' };

  const holeCards = gameState.myCards || [];
  const communityCards = gameState.communityCards || [];
  const currentBet = gameState.currentBet || 0;
  const myRoundBet = gameState.myBet || 0;
  const callAmount = currentBet - myRoundBet;
  const canCheck = callAmount <= 0;
  const totalPot = gameState.pot || 0;
  const bigBlind = gameState.bigBlind || 20;
  const minRaise = gameState.minRaise || bigBlind;

  let handStrength;
  if (communityCards.length === 0) {
    handStrength = evaluatePreflopStrength(holeCards);
  } else {
    handStrength = evaluatePostflopStrength(holeCards, communityCards);
  }

  const potOdds = calculatePotOdds(callAmount, totalPot);
  const chipRatio = player.chips / (totalPot || 1);
  const activePlayers = gameState.players.filter(p => p.isActive).length;
  const communityLength = communityCards.length;

  const playerSeat = player.seat;
  const dealerSeat = gameState.dealerButton;
  const totalPlayers = gameState.players.length;
  const positionInfo = getPositionInfo(playerSeat, dealerSeat, totalPlayers);

  if (difficulty === 'easy') {
    return makeEasyDecision(config, canCheck, callAmount, handStrength, currentBet, minRaise, player, totalPot, bigBlind, communityLength);
  } else if (difficulty === 'medium') {
    return makeMediumDecision(config, canCheck, callAmount, handStrength, potOdds, currentBet, minRaise, player, totalPot, bigBlind, activePlayers, communityLength);
  } else {
    return makeHardDecision(config, canCheck, callAmount, handStrength, potOdds, currentBet, minRaise, player, totalPot, bigBlind, activePlayers, chipRatio, communityLength, positionInfo, gameState);
  }
}

function makeEasyDecision(config, canCheck, callAmount, handStrength, currentBet, minRaise, player, totalPot, bigBlind, communityLength) {
  const roll = Math.random();
  const { isStrong } = analyzeHandStrength(handStrength, communityLength);

  if (canCheck) {
    let raiseProb = config.raiseProb;
    if (isStrong) {
      raiseProb = 0.85;
      if (handStrength > 0.8) raiseProb = 0.95;
    }

    if (roll < raiseProb) {
      let raiseAmt = currentBet + minRaise + Math.floor(Math.random() * bigBlind);
      if (isStrong) raiseAmt += Math.floor(bigBlind * 0.5);
      return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
    }
    return { action: 'check' };
  }

  if (callAmount >= player.chips) {
    return handStrength > 0.3 ? { action: 'all-in' } : { action: 'fold' };
  }

  if (handStrength < 0.2 && roll < 0.6) return { action: 'fold' };
  if (handStrength < 0.35 && callAmount > player.chips * 0.3) return { action: 'fold' };

  if (roll < config.foldProb) return { action: 'fold' };
  if (roll < config.foldProb + config.raiseProb && handStrength > 0.5) {
    const raiseAmt = currentBet + minRaise;
    return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
  }

  return { action: 'call' };
}

function makeMediumDecision(config, canCheck, callAmount, handStrength, potOdds, currentBet, minRaise, player, totalPot, bigBlind, activePlayers, communityLength) {
  const roll = Math.random();
  const { tier, isStrong, isVeryStrong } = analyzeHandStrength(handStrength, communityLength);

  if (canCheck) {
    let raiseProb = 0;
    let raiseMultiplier = 1.0;

    if (isVeryStrong) {
      raiseProb = 0.9;
      raiseMultiplier = 1.8;
    } else if (isStrong) {
      raiseProb = 0.7;
      raiseMultiplier = 1.3;
    } else if (handStrength > 0.35) {
      raiseProb = 0.2;
    } else {
      raiseProb = 0.05;
    }

    if (activePlayers <= 2) raiseProb *= 1.2;

    if (roll < raiseProb) {
      const baseRaise = currentBet + minRaise;
      const extra = Math.floor(handStrength * bigBlind * raiseMultiplier);
      const raiseAmt = baseRaise + extra;
      return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
    }

    if (isVeryStrong && handStrength >= 0.85 && roll < 0.15) {
      return { action: 'check' };
    }

    return { action: 'check' };
  }

  if (callAmount >= player.chips) {
    return handStrength > 0.4 ? { action: 'all-in' } : { action: 'fold' };
  }

  if (handStrength < 0.2) return { action: 'fold' };
  if (handStrength < 0.35 && potOdds > 0.3) return { action: 'fold' };
  if (handStrength < 0.3 && callAmount > player.chips * 0.25 && activePlayers > 2) return { action: 'fold' };

  if (handStrength > 0.7) {
    if (roll < 0.5) {
      const raiseAmt = currentBet + minRaise + Math.floor(handStrength * bigBlind * 1.5);
      return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
    }
    return { action: 'call' };
  }

  if (handStrength > 0.5 && roll < 0.25) {
    const raiseAmt = currentBet + minRaise + Math.floor(handStrength * bigBlind);
    return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
  }

  return { action: 'call' };
}

function makeHardDecision(config, canCheck, callAmount, handStrength, potOdds, currentBet, minRaise, player, totalPot, bigBlind, activePlayers, chipRatio, communityLength, positionInfo, gameState) {
  const roll = Math.random();
  const { tier, isStrong, isVeryStrong, isNuts } = analyzeHandStrength(handStrength, communityLength);
  const shouldBluff = roll < config.bluffProb && activePlayers <= 3 && handStrength < 0.4;
  const aggressionLevel = getRoundAggressionLevel(gameState);

  if (canCheck) {
    let raiseProb = 0;
    let raiseMultiplier = 1.0;

    if (isNuts) {
      raiseProb = 0.95;
      raiseMultiplier = 2.5;
    } else if (isVeryStrong) {
      raiseProb = 0.85;
      raiseMultiplier = 2.0;
    } else if (isStrong) {
      raiseProb = 0.7;
      raiseMultiplier = 1.5;
    } else if (handStrength >= 0.4) {
      raiseProb = 0.25;
    } else {
      raiseProb = 0.08;
    }

    if (positionInfo && positionInfo.isLate) {
      raiseProb *= 1.3;
      raiseMultiplier *= 1.2;
    }

    if (chipRatio > 5) {
      raiseMultiplier *= 1.3;
    }

    if (aggressionLevel === 'low' && isStrong) {
      raiseProb *= 1.2;
    }

    if (shouldBluff && handStrength < 0.35) {
      const bluffAmt = currentBet + minRaise + Math.floor(bigBlind * 2);
      return { action: 'raise', amount: Math.min(bluffAmt, player.chips + currentBet) };
    }

    if (roll < raiseProb) {
      const baseRaise = currentBet + minRaise;
      const extra = Math.floor(handStrength * bigBlind * raiseMultiplier);
      const raiseAmt = baseRaise + extra;
      return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
    }

    if (isNuts && roll < 0.08 && activePlayers > 1) {
      return { action: 'check' };
    }

    return { action: 'check' };
  }

  if (callAmount >= player.chips) {
    return handStrength > 0.35 ? { action: 'all-in' } : { action: 'fold' };
  }

  const equityNeeded = potOdds;
  const shouldCall = handStrength > equityNeeded * 0.8;

  if (handStrength < 0.15 && !shouldBluff) return { action: 'fold' };
  if (handStrength < 0.3 && potOdds > 0.35 && !shouldBluff) return { action: 'fold' };
  if (handStrength < 0.25 && callAmount > player.chips * 0.2 && activePlayers > 2 && !shouldBluff) return { action: 'fold' };

  if (handStrength > 0.75) {
    const aggression = handStrength > 0.9 ? 3 : 2;
    const raiseAmt = currentBet + minRaise + Math.floor(aggression * bigBlind);
    if (chipRatio > 2 && roll < 0.3) {
      return { action: 'raise', amount: Math.min(Math.floor(raiseAmt * 1.2), player.chips + currentBet) };
    }
    return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
  }

  if (handStrength > 0.5) {
    if (roll < 0.35) {
      const raiseAmt = currentBet + minRaise + Math.floor(bigBlind * handStrength);
      return { action: 'raise', amount: Math.min(raiseAmt, player.chips + currentBet) };
    }
    return { action: 'call' };
  }

  if (shouldBluff) {
    const bluffAmt = currentBet + minRaise + Math.floor(bigBlind * 1.5);
    return { action: 'raise', amount: Math.min(bluffAmt, player.chips + currentBet) };
  }

  if (shouldCall) {
    return { action: 'call' };
  }

  if (callAmount < bigBlind * 2 && handStrength > 0.25) {
    return { action: 'call' };
  }

  return { action: 'fold' };
}

function getThinkTime(difficulty) {
  const config = AI_CONFIGS[difficulty] || AI_CONFIGS.easy;
  return config.thinkTimeMin + Math.random() * (config.thinkTimeMax - config.thinkTimeMin);
}

module.exports = {
  AI_NAMES,
  AI_CONFIGS,
  pickAiName,
  evaluatePreflopStrength,
  evaluatePostflopStrength,
  makeDecision,
  getThinkTime,
};
