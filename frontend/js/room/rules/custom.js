// 房主自定义规则
class CustomRules {
  constructor() {
    this.rules = {
      playerCards: 2,
      communityCards: 5,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
    };
  }
  
  // 设置规则
  setRules(rules) {
    this.rules = { ...this.rules, ...rules };
  }
  
  // 获取规则
  getRules() {
    return this.rules;
  }
  
  // 验证规则
  validateRules(rules) {
    const errors = [];
    
    if (rules.playerCards) {
      const playerCards = parseInt(rules.playerCards);
      if (isNaN(playerCards) || playerCards < 1 || playerCards > 5) {
        errors.push('每人手牌数量必须在1-5之间');
      }
    }
    
    // 验证公共牌数量
    if (rules.communityCards) {
      const communityCards = parseInt(rules.communityCards);
      if (isNaN(communityCards) || communityCards < 0 || communityCards > 5) {
        errors.push('公共牌数量必须在0-5之间');
      }
    }
    
    // 验证初始积分
    if (rules.startingChips) {
      const startingChips = parseInt(rules.startingChips);
      if (isNaN(startingChips) || startingChips < 100) {
        errors.push('初始积分必须至少为100');
      }
    }
    
    // 验证盲注
    if (rules.smallBlind) {
      const smallBlind = parseInt(rules.smallBlind);
      if (isNaN(smallBlind) || smallBlind < 1) {
        errors.push('小盲注必须至少为1');
      }
    }
    
    if (rules.bigBlind) {
      const bigBlind = parseInt(rules.bigBlind);
      if (isNaN(bigBlind) || bigBlind < rules.smallBlind * 2) {
        errors.push('大盲注必须至少为小盲注的2倍');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors,
    };
  }
  
  // 获取默认规则
  getDefaultRules() {
    return {
      playerCards: 2,
      communityCards: 5,
      startingChips: 1000,
      smallBlind: 10,
      bigBlind: 20,
    };
  }
}

// 导出规则
try {
  module.exports = CustomRules;
} catch (e) {
  // 浏览器环境下挂载到window
  window.CustomRules = CustomRules;
}