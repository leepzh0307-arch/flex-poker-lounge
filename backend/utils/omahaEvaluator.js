var { evaluateFiveCards, compareScores, normalizeCard, getCombinations, HAND_NAMES } = require('./handEvaluator');

function findBestOmahaHand(holeCards, communityCards) {
  if (!holeCards || holeCards.length !== 4) {
    throw new Error('findBestOmahaHand 需要4张底牌，当前: ' + (holeCards ? holeCards.length : 0));
  }
  if (!communityCards || communityCards.length !== 5) {
    throw new Error('findBestOmahaHand 需要5张公共牌，当前: ' + (communityCards ? communityCards.length : 0));
  }

  var holeCombos = getCombinations(holeCards, 2);
  var boardCombos = getCombinations(communityCards, 3);

  var bestScore = null;
  var bestCombo = null;

  for (var h = 0; h < holeCombos.length; h++) {
    for (var b = 0; b < boardCombos.length; b++) {
      var fiveCards = holeCombos[h].concat(boardCombos[b]);
      var score = evaluateFiveCards(fiveCards);
      if (!bestScore || compareScores(score, bestScore) > 0) {
        bestScore = score;
        bestCombo = fiveCards;
      }
    }
  }

  return {
    score: bestScore,
    bestHand: bestCombo,
    handRank: bestScore[0],
    handName: HAND_NAMES[bestScore[0]],
  };
}

function omahaShowdown(playersInput, communityCards) {
  if (!communityCards || communityCards.length !== 5) {
    throw new Error('omahaShowdown 需要5张公共牌，当前数量: ' + (communityCards ? communityCards.length : 0));
  }

  var survivingPlayers = playersInput.filter(function(p) { return !p.isFolded; });
  if (survivingPlayers.length === 0) {
    throw new Error('没有存活玩家');
  }

  var evaluatedPlayers = [];

  for (var i = 0; i < survivingPlayers.length; i++) {
    var player = survivingPlayers[i];
    var holeCards = player.holeCards || [];
    if (holeCards.length !== 4) {
      throw new Error('玩家 ' + player.id + ' 的底牌数量不为4，当前: ' + holeCards.length);
    }

    var result = findBestOmahaHand(holeCards, communityCards);

    evaluatedPlayers.push({
      id: player.id,
      isFolded: false,
      finalHand: result.bestHand,
      handRank: result.handRank,
      handName: result.handName,
      score: result.score,
    });
  }

  var maxScore = evaluatedPlayers.reduce(function(max, p) {
    return compareScores(p.score, max) > 0 ? p.score : max;
  }, evaluatedPlayers[0].score);

  var winners = evaluatedPlayers
    .filter(function(p) { return compareScores(p.score, maxScore) === 0; })
    .map(function(p) { return p.id; });

  var isTie = winners.length > 1;

  var winnerNames = winners.map(function(wid) {
    var p = evaluatedPlayers.find(function(ep) { return ep.id === wid; });
    var originalPlayer = playersInput.find(function(pp) { return pp.id === wid; });
    return originalPlayer ? (originalPlayer.nickname || originalPlayer.name || String(wid)) : String(wid);
  });

  var resultMessage;
  if (isTie) {
    resultMessage = '平局！' + winnerNames.join('、') + ' 平分底池（' + evaluatedPlayers.find(function(p) { return p.id === winners[0]; }).handName + '）';
  } else {
    var winnerInfo = evaluatedPlayers.find(function(p) { return p.id === winners[0]; });
    resultMessage = winnerNames[0] + ' 获胜（' + winnerInfo.handName + '）';
  }

  return {
    communityCards: communityCards.map(normalizeCard),
    players: evaluatedPlayers,
    winners: winners,
    isTie: isTie,
    resultMessage: resultMessage,
  };
}

function evaluateOmahaPreflopStrength(holeCards) {
  if (!holeCards || holeCards.length !== 4) return 0;

  var ranks = holeCards.map(function(c) {
    return typeof c.rank === 'number' ? c.rank : (typeof c.value === 'string' ? { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 }[c.value] || 0 : c.rank);
  }).sort(function(a, b) { return b - a; });

  var suits = holeCards.map(function(c) {
    return typeof c.suit === 'number' ? c.suit : 0;
  });

  var score = 0;

  var pairCount = 0;
  for (var i = 0; i < 4; i++) {
    for (var j = i + 1; j < 4; j++) {
      if (ranks[i] === ranks[j]) pairCount++;
    }
  }

  if (pairCount >= 2) score += 0.35;
  else if (pairCount === 1) score += 0.15;

  score += (ranks[0] / 14) * 0.15;
  score += (ranks[1] / 14) * 0.1;

  var suitedCount = 0;
  for (var s = 0; s < 4; s++) {
    for (var t = s + 1; t < 4; t++) {
      if (suits[s] === suits[t]) suitedCount++;
    }
  }
  if (suitedCount >= 2) score += 0.15;
  else if (suitedCount === 1) score += 0.05;

  var isConnected = 0;
  for (var m = 0; m < 3; m++) {
    var gap = ranks[m] - ranks[m + 1];
    if (gap <= 2) isConnected++;
  }
  score += (isConnected / 3) * 0.1;

  return Math.min(1, Math.max(0, score));
}

function calculatePotLimitRaise(potSize, currentBet, playerRoundBet) {
  var callAmount = currentBet - playerRoundBet;
  if (callAmount < 0) callAmount = 0;

  var potAfterCall = potSize + callAmount + playerRoundBet;
  var maxRaiseTotal = potAfterCall + callAmount;
  var maxRaiseIncrement = maxRaiseTotal - playerRoundBet;

  return {
    callAmount: callAmount,
    minRaise: currentBet === 0 ? 0 : currentBet + (currentBet - (currentBet - callAmount)),
    maxRaise: maxRaiseTotal,
    maxRaiseIncrement: maxRaiseIncrement,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    findBestOmahaHand: findBestOmahaHand,
    omahaShowdown: omahaShowdown,
    evaluateOmahaPreflopStrength: evaluateOmahaPreflopStrength,
    calculatePotLimitRaise: calculatePotLimitRaise,
  };
}
