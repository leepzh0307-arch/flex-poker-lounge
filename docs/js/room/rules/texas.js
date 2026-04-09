// 德州扑克默认规则
class TexasHoldemRules {
  constructor() {
    this.rules = {
      playerCards: 2, // 每人2张手牌
      communityCards: 5, // 5张公共牌
      bettingRounds: ['preflop', 'flop', 'turn', 'river'], // 下注轮次
      handRanks: [
        { name: '皇家同花顺', value: 10 },
        { name: '同花顺', value: 9 },
        { name: '四条', value: 8 },
        { name: '葫芦', value: 7 },
        { name: '同花', value: 6 },
        { name: '顺子', value: 5 },
        { name: '三条', value: 4 },
        { name: '两对', value: 3 },
        { name: '一对', value: 2 },
        { name: '高牌', value: 1 },
      ],
    };
  }
  
  // 评估手牌
  evaluateHand(holeCards, communityCards) {
    // 合并手牌和公共牌
    const allCards = [...holeCards, ...communityCards];
    
    // 生成所有可能的5张牌组合
    const combinations = this.generateCombinations(allCards, 5);
    
    // 评估每个组合
    let bestHand = null;
    let bestRank = 0;
    
    for (const combination of combinations) {
      const rank = this.getHandRank(combination);
      if (rank.value > bestRank) {
        bestRank = rank.value;
        bestHand = {
          cards: combination,
          rank: rank,
        };
      }
    }
    
    return bestHand;
  }
  
  // 生成组合
  generateCombinations(cards, size) {
    const result = [];
    
    function combine(start, current) {
      if (current.length === size) {
        result.push([...current]);
        return;
      }
      
      for (let i = start; i < cards.length; i++) {
        current.push(cards[i]);
        combine(i + 1, current);
        current.pop();
      }
    }
    
    combine(0, []);
    return result;
  }
  
  // 获取手牌排名
  getHandRank(cards) {
    // 按数值排序
    const sortedCards = [...cards].sort((a, b) => this.getCardValue(a) - this.getCardValue(b));
    
    // 检查皇家同花顺
    if (this.isRoyalFlush(sortedCards)) {
      return this.rules.handRanks[0];
    }
    
    // 检查同花顺
    if (this.isStraightFlush(sortedCards)) {
      return this.rules.handRanks[1];
    }
    
    // 检查四条
    if (this.isFourOfAKind(sortedCards)) {
      return this.rules.handRanks[2];
    }
    
    // 检查葫芦
    if (this.isFullHouse(sortedCards)) {
      return this.rules.handRanks[3];
    }
    
    // 检查同花
    if (this.isFlush(sortedCards)) {
      return this.rules.handRanks[4];
    }
    
    // 检查顺子
    if (this.isStraight(sortedCards)) {
      return this.rules.handRanks[5];
    }
    
    // 检查三条
    if (this.isThreeOfAKind(sortedCards)) {
      return this.rules.handRanks[6];
    }
    
    // 检查两对
    if (this.isTwoPair(sortedCards)) {
      return this.rules.handRanks[7];
    }
    
    // 检查一对
    if (this.isOnePair(sortedCards)) {
      return this.rules.handRanks[8];
    }
    
    // 高牌
    return this.rules.handRanks[9];
  }
  
  // 检查皇家同花顺
  isRoyalFlush(cards) {
    return this.isStraightFlush(cards) && 
           this.getCardValue(cards[0]) === 10 &&
           this.getCardValue(cards[4]) === 14; // A
  }
  
  // 检查同花顺
  isStraightFlush(cards) {
    return this.isFlush(cards) && this.isStraight(cards);
  }
  
  // 检查四条
  isFourOfAKind(cards) {
    const values = cards.map(card => this.getCardValue(card));
    const counts = this.getCounts(values);
    return Object.values(counts).includes(4);
  }
  
  // 检查葫芦
  isFullHouse(cards) {
    const values = cards.map(card => this.getCardValue(card));
    const counts = this.getCounts(values);
    const countValues = Object.values(counts);
    return countValues.includes(3) && countValues.includes(2);
  }
  
  // 检查同花
  isFlush(cards) {
    const suit = cards[0].suit;
    return cards.every(card => card.suit === suit);
  }
  
  // 检查顺子
  isStraight(cards) {
    const values = cards.map(card => this.getCardValue(card)).sort((a, b) => a - b);
    
    // 检查是否连续
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i + 1] - values[i] !== 1) {
        // 特殊情况：A-2-3-4-5
        if (i === 0 && values[0] === 2 && values[4] === 14) {
          continue;
        }
        return false;
      }
    }
    
    return true;
  }
  
  // 检查三条
  isThreeOfAKind(cards) {
    const values = cards.map(card => this.getCardValue(card));
    const counts = this.getCounts(values);
    return Object.values(counts).includes(3);
  }
  
  // 检查两对
  isTwoPair(cards) {
    const values = cards.map(card => this.getCardValue(card));
    const counts = this.getCounts(values);
    const pairCounts = Object.values(counts).filter(count => count === 2);
    return pairCounts.length === 2;
  }
  
  // 检查一对
  isOnePair(cards) {
    const values = cards.map(card => this.getCardValue(card));
    const counts = this.getCounts(values);
    return Object.values(counts).includes(2);
  }
  
  // 获取牌值
  getCardValue(card) {
    const valueMap = {
      '2': 2,
      '3': 3,
      '4': 4,
      '5': 5,
      '6': 6,
      '7': 7,
      '8': 8,
      '9': 9,
      '10': 10,
      'J': 11,
      'Q': 12,
      'K': 13,
      'A': 14,
    };
    return valueMap[card.value] || 0;
  }
  
  // 获取计数
  getCounts(values) {
    const counts = {};
    values.forEach(value => {
      counts[value] = (counts[value] || 0) + 1;
    });
    return counts;
  }
  
  // 比较两手牌
  compareHands(hand1, hand2) {
    if (hand1.rank.value > hand2.rank.value) {
      return 1;
    } else if (hand1.rank.value < hand2.rank.value) {
      return -1;
    } else {
      // 同等级别，比较高牌
      const values1 = hand1.cards.map(card => this.getCardValue(card)).sort((a, b) => b - a);
      const values2 = hand2.cards.map(card => this.getCardValue(card)).sort((a, b) => b - a);
      
      for (let i = 0; i < values1.length; i++) {
        if (values1[i] > values2[i]) {
          return 1;
        } else if (values1[i] < values2[i]) {
          return -1;
        }
      }
      
      return 0;
    }
  }
  
  // 获取规则
  getRules() {
    return this.rules;
  }
}

// 导出规则
try {
  module.exports = TexasHoldemRules;
} catch (e) {
  // 浏览器环境下挂载到window
  window.TexasHoldemRules = TexasHoldemRules;
}