const HAND_NAMES = {
  9: '皇家同花顺',
  8: '同花顺',
  7: '四条',
  6: '葫芦',
  5: '同花',
  4: '顺子',
  3: '三条',
  2: '两对',
  1: '一对',
  0: '高牌',
};

function normalizeCard(card) {
  if (typeof card.rank === 'number' && typeof card.suit === 'number') {
    return { rank: card.rank, suit: card.suit };
  }
  const valueMap = { '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  const suitMap = { 'spades': 0, 'hearts': 1, 'clubs': 2, 'diamonds': 3 };
  const rank = valueMap[card.value] || 0;
  const suit = suitMap[card.suit] !== undefined ? suitMap[card.suit] : (card.suit || 0);
  return { rank, suit };
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

function evaluateFiveCards(cards) {
  if (!cards || cards.length !== 5) {
    throw new Error('evaluateFiveCards 需要恰好5张牌');
  }

  const normalized = cards.map(normalizeCard);
  const ranks = normalized.map(c => c.rank).sort((a, b) => a - b);
  const suits = normalized.map(c => c.suit);

  const isFlush = suits[0] === suits[1] && suits[1] === suits[2] && suits[2] === suits[3] && suits[3] === suits[4];

  let straightHigh = getStraightHigh(ranks);
  const isStraight = straightHigh > 0;

  if (isFlush && isStraight) {
    if (straightHigh === 14) return [9, 0, 0, 0, 0, 0];
    return [8, straightHigh, 0, 0, 0, 0];
  }

  const freq = {};
  ranks.forEach(r => { freq[r] = (freq[r] || 0) + 1; });
  const entries = Object.entries(freq).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return parseInt(b[0]) - parseInt(a[0]);
  });
  const counts = entries.map(e => parseInt(e[0]));
  const freqValues = entries.map(e => e[1]);

  if (freqValues[0] === 4) {
    return [7, counts[0], counts[1], 0, 0, 0];
  }

  if (freqValues[0] === 3 && freqValues[1] === 2) {
    return [6, counts[0], counts[1], 0, 0, 0];
  }

  if (isFlush) {
    const descRanks = [...ranks].reverse();
    return [5, descRanks[0], descRanks[1], descRanks[2], descRanks[3], descRanks[4]];
  }

  if (isStraight) {
    return [4, straightHigh, 0, 0, 0, 0];
  }

  if (freqValues[0] === 3) {
    const kickers = counts.slice(1).sort((a, b) => b - a);
    return [3, counts[0], kickers[0] || 0, kickers[1] || 0, 0, 0];
  }

  if (freqValues[0] === 2 && freqValues[1] === 2) {
    const pairRanks = [counts[0], counts[1]].sort((a, b) => b - a);
    const kicker = counts[2] || 0;
    return [2, pairRanks[0], pairRanks[1], kicker, 0, 0];
  }

  if (freqValues[0] === 2) {
    const kickers = counts.slice(1).sort((a, b) => b - a);
    return [1, counts[0], kickers[0] || 0, kickers[1] || 0, kickers[2] || 0, 0];
  }

  const descRanks = [...ranks].reverse();
  return [0, descRanks[0], descRanks[1], descRanks[2], descRanks[3], descRanks[4]];
}

function getStraightHigh(sortedRanks) {
  const unique = [...new Set(sortedRanks)];
  if (unique.length < 5) return 0;

  let consecutive = 1;
  for (let i = 1; i < unique.length; i++) {
    if (unique[i] === unique[i - 1] + 1) {
      consecutive++;
      if (consecutive >= 5) return unique[i];
    } else {
      consecutive = 1;
    }
  }

  if (unique.includes(14) && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)) {
    return 5;
  }

  return 0;
}

function findBestHand(holeCards, communityCards) {
  if (!holeCards || holeCards.length !== 2) {
    throw new Error('findBestHand 需要2张底牌');
  }
  if (!communityCards || communityCards.length !== 5) {
    throw new Error('findBestHand 需要5张公共牌');
  }

  const allCards = [...holeCards, ...communityCards];
  const combos = getCombinations(allCards, 5);

  let bestScore = null;
  let bestCombo = null;

  for (const combo of combos) {
    const score = evaluateFiveCards(combo);
    if (!bestScore || compareScores(score, bestScore) > 0) {
      bestScore = score;
      bestCombo = combo;
    }
  }

  return {
    score: bestScore,
    bestHand: bestCombo,
    handRank: bestScore[0],
    handName: HAND_NAMES[bestScore[0]],
  };
}

function compareScores(a, b) {
  for (let i = 0; i < 6; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function showdown(playersInput, communityCards) {
  if (!communityCards || communityCards.length !== 5) {
    throw new Error('showdown 需要5张公共牌，当前数量: ' + (communityCards ? communityCards.length : 0));
  }

  const survivingPlayers = playersInput.filter(p => !p.isFolded);
  if (survivingPlayers.length === 0) {
    throw new Error('没有存活玩家');
  }

  const evaluatedPlayers = [];

  for (const player of survivingPlayers) {
    const holeCards = player.holeCards || [];
    if (holeCards.length !== 2) {
      throw new Error(`玩家 ${player.id} 的底牌数量不为2，当前: ${holeCards.length}`);
    }

    const result = findBestHand(holeCards, communityCards);

    evaluatedPlayers.push({
      id: player.id,
      isFolded: false,
      finalHand: result.bestHand,
      handRank: result.handRank,
      handName: result.handName,
      score: result.score,
    });
  }

  const maxScore = evaluatedPlayers.reduce((max, p) => {
    return compareScores(p.score, max) > 0 ? p.score : max;
  }, evaluatedPlayers[0].score);

  const winners = evaluatedPlayers
    .filter(p => compareScores(p.score, maxScore) === 0)
    .map(p => p.id);

  const isTie = winners.length > 1;

  const winnerNames = winners.map(wid => {
    const p = evaluatedPlayers.find(ep => ep.id === wid);
    const originalPlayer = playersInput.find(pp => pp.id === wid);
    return originalPlayer ? (originalPlayer.nickname || originalPlayer.name || String(wid)) : String(wid);
  });

  let resultMessage;
  if (isTie) {
    resultMessage = `平局！${winnerNames.join('、')} 平分底池（${evaluatedPlayers.find(p => p.id === winners[0]).handName}）`;
  } else {
    const winnerInfo = evaluatedPlayers.find(p => p.id === winners[0]);
    resultMessage = `${winnerNames[0]} 获胜（${winnerInfo.handName}）`;
  }

  return {
    communityCards: communityCards.map(normalizeCard),
    players: evaluatedPlayers,
    winners: winners,
    isTie: isTie,
    resultMessage: resultMessage,
  };
}

function runTests() {
  const passed = [];
  const failed = [];

  function assert(condition, testName) {
    if (condition) {
      passed.push(testName);
    } else {
      failed.push(testName);
    }
  }

  function makeCard(rank, suit) {
    return { rank, suit };
  }

  function makePlayer(id, holeCards, isFolded = false) {
    return { id, holeCards, isFolded };
  }

  console.log('\n========== 德州扑克手牌评估系统 测试 ==========\n');

  const rfHand = [makeCard(10, 0), makeCard(11, 0), makeCard(12, 0), makeCard(13, 0), makeCard(14, 0)];
  const sfHand = [makeCard(9, 1), makeCard(8, 1), makeCard(7, 1), makeCard(6, 1), makeCard(5, 1)];
  const rfScore = evaluateFiveCards(rfHand);
  const sfScore = evaluateFiveCards(sfHand);
  assert(rfScore[0] === 9 && compareScores(rfScore, sfScore) > 0, '测试1: 皇家同花顺 > 同花顺');

  const fourKind = [makeCard(13, 0), makeCard(13, 1), makeCard(13, 2), makeCard(13, 3), makeCard(7, 0)];
  const fullHouse = [makeCard(7, 0), makeCard(7, 1), makeCard(7, 2), makeCard(3, 0), makeCard(3, 1)];
  const fkScore = evaluateFiveCards(fourKind);
  const fhScore = evaluateFiveCards(fullHouse);
  assert(fkScore[0] === 7 && fhScore[0] === 6 && compareScores(fkScore, fhScore) > 0, '测试2: 四条 > 葫芦');

  const wheelStraight = [makeCard(14, 0), makeCard(2, 1), makeCard(3, 2), makeCard(4, 3), makeCard(5, 0)];
  const normalStraight = [makeCard(6, 0), makeCard(5, 1), makeCard(4, 2), makeCard(3, 3), makeCard(2, 0)];
  const wheelScore = evaluateFiveCards(wheelStraight);
  const normalScore = evaluateFiveCards(normalStraight);
  assert(wheelScore[0] === 4 && wheelScore[1] === 5, '测试3a: A-2-3-4-5 低顺子顶牌为5');
  assert(compareScores(normalScore, wheelScore) > 0, '测试3b: 2-3-4-5-6 > A-2-3-4-5');

  const pairAKQJ = [makeCard(14, 0), makeCard(14, 1), makeCard(13, 0), makeCard(12, 1), makeCard(11, 0)];
  const pairAKQ10 = [makeCard(14, 2), makeCard(14, 3), makeCard(13, 1), makeCard(12, 0), makeCard(10, 1)];
  const s1 = evaluateFiveCards(pairAKQJ);
  const s2 = evaluateFiveCards(pairAKQ10);
  assert(s1[0] === 1 && s2[0] === 1 && compareScores(s1, s2) > 0, '测试4: 一对A带KQJ > 一对A带KQ10');

  const commRF = [makeCard(10, 0), makeCard(11, 0), makeCard(12, 0), makeCard(13, 0), makeCard(14, 0)];
  const p1Hole = [makeCard(2, 1), makeCard(3, 1)];
  const p2Hole = [makeCard(4, 2), makeCard(5, 2)];
  const tieResult = showdown([
    makePlayer('P1', p1Hole),
    makePlayer('P2', p2Hole),
  ], commRF);
  assert(tieResult.isTie === true && tieResult.winners.length === 2, '测试5: 公共牌皇家同花顺 → 平局');

  const commStrong = [makeCard(10, 0), makeCard(11, 0), makeCard(12, 0), makeCard(13, 0), makeCard(9, 0)];
  const pHole = [makeCard(2, 1), makeCard(3, 1)];
  const noHoleResult = findBestHand(pHole, commStrong);
  assert(noHoleResult.handRank === 8, '测试6: 玩家完全不用底牌 → 公共牌组成同花顺');

  const twoPairHand = [makeCard(11, 0), makeCard(11, 1), makeCard(9, 0), makeCard(9, 1), makeCard(4, 0)];
  const onePairHand = [makeCard(14, 0), makeCard(14, 1), makeCard(8, 0), makeCard(7, 1), makeCard(6, 0)];
  const tpScore = evaluateFiveCards(twoPairHand);
  const opScore = evaluateFiveCards(onePairHand);
  assert(tpScore[0] === 2 && opScore[0] === 1 && compareScores(tpScore, opScore) > 0, '测试7: 两对 > 一对');

  const high1 = [makeCard(14, 0), makeCard(12, 1), makeCard(9, 2), makeCard(7, 3), makeCard(3, 0)];
  const high2 = [makeCard(13, 0), makeCard(11, 1), makeCard(8, 2), makeCard(6, 3), makeCard(4, 0)];
  const h1s = evaluateFiveCards(high1);
  const h2s = evaluateFiveCards(high2);
  assert(h1s[0] === 0 && h2s[0] === 0 && compareScores(h1s, h2s) > 0, '测试8: 高牌 AK973 > KQ864');

  const threeKindHand = [makeCard(10, 0), makeCard(10, 1), makeCard(10, 2), makeCard(7, 0), makeCard(5, 1)];
  const tkScore = evaluateFiveCards(threeKindHand);
  assert(tkScore[0] === 3 && tkScore[1] === 10 && tkScore[2] === 7 && tkScore[3] === 5, '测试9: 三条评分格式正确 [3,10,7,5,0,0]');

  try {
    evaluateFiveCards([makeCard(2, 0)]);
    assert(false, '错误处理: 不足5张牌应抛出异常');
  } catch (e) {
    assert(true, '错误处理: 不足5张牌正确抛出异常');
  }

  try {
    showdown([makePlayer('P1', [makeCard(2, 0)])], commRF);
    assert(false, '错误处理: 底牌不足应抛出异常');
  } catch (e) {
    assert(true, '错误处理: 底牌不足正确抛出异常');
  }

  console.log(`\n---------- 测试结果 ----------`);
  console.log(`通过: ${passed.length}/${passed.length + failed.length}`);
  if (failed.length > 0) {
    console.log(`失败: ${failed.join(', ')}`);
  } else {
    console.log('全部通过！');
  }
  console.log('==============================\n');

  return { passed, failed };
}

module.exports = {
  normalizeCard,
  getCombinations,
  evaluateFiveCards,
  findBestHand,
  compareScores,
  showdown,
  HAND_NAMES,
  runTests,
};
