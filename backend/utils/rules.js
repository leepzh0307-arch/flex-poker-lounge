// 规则合法性校验工具

// 验证房间配置
function validateRoomConfig(config) {
  const errors = [];
  
  if (config.playerCards) {
    const playerCards = parseInt(config.playerCards);
    if (isNaN(playerCards) || playerCards < 1 || playerCards > 5) {
      errors.push('每人手牌数量必须在1-5之间');
    }
  }
  
  // 验证公共牌数量
  if (config.communityCards) {
    const communityCards = parseInt(config.communityCards);
    if (isNaN(communityCards) || communityCards < 0 || communityCards > 5) {
      errors.push('公共牌数量必须在0-5之间');
    }
  }
  
  // 验证初始筹码
  if (config.startingChips) {
    const startingChips = parseInt(config.startingChips);
    if (isNaN(startingChips) || startingChips < 100) {
      errors.push('初始筹码必须至少为100');
    }
  }
  
  // 验证盲注
  if (config.smallBlind) {
    const smallBlind = parseInt(config.smallBlind);
    if (isNaN(smallBlind) || smallBlind < 1) {
      errors.push('小盲注必须至少为1');
    }
  }
  
  if (config.bigBlind) {
    const bigBlind = parseInt(config.bigBlind);
    if (isNaN(bigBlind) || bigBlind < (config.smallBlind || 1) * 2) {
      errors.push('大盲注必须至少为小盲注的2倍');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

// 验证游戏操作
function validateGameAction(action, data, player, gameState) {
  const errors = [];
  
  // 检查玩家是否活跃
  if (!player.isActive) {
    errors.push('玩家当前不活跃');
  }
  
  // 检查是否轮到该玩家
  if (gameState.currentPlayer !== player.id) {
    errors.push('还没轮到该玩家行动');
  }
  
  // 验证具体操作
  switch (action) {
    case 'fold':
      // 弃牌不需要额外验证
      break;
    
    case 'check':
      // 检查是否可以过牌
      if (gameState.currentBet > (gameState.bets[player.id] || 0)) {
        errors.push('当前有下注，不能过牌');
      }
      break;
    
    case 'call':
      // 检查筹码是否足够
      const callAmount = gameState.currentBet - (gameState.bets[player.id] || 0);
      if (player.chips < callAmount) {
        errors.push('筹码不足，只能全押');
      }
      break;
    
    case 'raise':
      // 检查下注金额
      if (!data.amount || data.amount <= 0) {
        errors.push('下注金额必须大于0');
      }
      // 检查筹码是否足够
      if (player.chips < data.amount) {
        errors.push('筹码不足，只能全押');
      }
      break;
    
    case 'all-in':
      // 全押不需要额外验证
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
  };
}

// 导出函数
module.exports = {
  validateRoomConfig,
  validateGameAction,
};