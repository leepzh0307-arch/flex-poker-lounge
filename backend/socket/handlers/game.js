// 游戏处理模块 - 德州扑克标准规则
const { generateDeck, shuffleDeck } = require('../../utils/deck');
const { showdown: pokerShowdown, findBestHand, HAND_NAMES } = require('../../utils/handEvaluator');
const { makeDecision, getThinkTime, pickAiName, clearRoomPersonality } = require('../../utils/aiEngine');
const StandUpGame = require('../../utils/standupGame');

function clearAiTimers(room) {
  if (room._aiTimerIds && room._aiTimerIds.length > 0) {
    room._aiTimerIds.forEach(id => clearTimeout(id));
    room._aiTimerIds = [];
  }
}

function trackAiTimer(room, timerId) {
  if (!room._aiTimerIds) room._aiTimerIds = [];
  room._aiTimerIds.push(timerId);
}

module.exports = (socket, rooms, io) => {
  socket.on('gameAction', ({ action, data }) => {
    try {
      console.log(`[后端] 收到游戏操作: ${action}`, data, `玩家: ${socket.id}`);
      if (!action) {
        console.error('[游戏] 缺少action参数');
        return;
      }

      let room = null;
      let roomId = null;
      
      console.log(`[后端] 遍历房间查找玩家: ${socket.id}`);
      for (const [id, r] of rooms.entries()) {
        if (r.players.some(p => p.id === socket.id)) {
          room = r;
          roomId = id;
          console.log(`[后端] 找到房间: ${roomId}, 玩家: ${socket.id}`);
          break;
        }
      }
      
      if (!room) {
        console.error('[游戏] 玩家不在任何房间中:', socket.id);
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        console.error('[游戏] 玩家不存在于房间中:', socket.id, roomId);
        return;
      }

      if (!player.isActive && action !== 'resetGame') {
        console.warn(`[游戏] 玩家 ${player.nickname} 已弃牌，无法执行操作`);
        return;
      }

      console.log(`[后端] 玩家 ${player.nickname} 执行操作: ${action}`, data);

      switch (action) {
        case 'startGame':
          startGame(room, roomId, io, data, rooms);
          break;
        case 'nextHand':
          nextHand(room, roomId, io, rooms);
          break;
        case 'resetGame':
          resetGame(room, roomId, io);
          break;
        case 'setPlayerChips':
          handleSetPlayerChips(room, roomId, io, socket.id, data);
          break;
        case 'addPlayerChips':
          handleAddPlayerChips(room, roomId, io, socket.id, data);
          break;
        case 'settleGame':
          handleSettleGame(room, roomId, io, socket.id);
          break;
        case 'fold':
          handleFold(room, roomId, io, socket.id, rooms);
          break;
        case 'check':
          handleCheck(room, roomId, io, socket.id, rooms);
          break;
        case 'call':
          handleCall(room, roomId, io, socket.id, rooms);
          break;
        case 'raise':
          handleRaise(room, roomId, io, socket.id, data?.amount, rooms);
          break;
        case 'all-in':
          handleAllIn(room, roomId, io, socket.id, rooms);
          break;
        case 'confirmContinue':
          handleConfirmContinue(room, roomId, io, socket.id, rooms);
          break;
        default:
          console.warn(`[游戏] 未知操作: ${action}`);
      }
    } catch (error) {
      console.error('[游戏] 游戏操作错误:', error);
      io.to(socket.id).emit('error', {
        message: '操作执行失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });
};

function sendGameUpdateWithCards(room, roomId, io, additionalMessage = null) {
  const activePlayers = room.players.filter(p => p.isActive);
  const isShowdownOrAfter = ['SHOWDOWN', 'HAND_END', 'CONFIRM_CONTINUE'].includes(room.gameState.phase);
  const showdownPlayerIds = room.gameState.showdownPlayerIds || [];

  room.players.forEach(player => {
    if (player.isAI) return;
    const playersWithCards = room.players.map(p => {
      const { cards, ...playerCopy } = { ...p };
      const isActive = p.isActive;
      const isSelf = p.id === player.id;
      if (isSelf) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (isShowdownOrAfter && showdownPlayerIds.includes(p.id)) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (isActive && room.gameState.phase === 'SHOWDOWN') {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else {
        playerCopy.cards = [{ hidden: true }, { hidden: true }];
      }
      return playerCopy;
    });
    io.to(player.id).emit('gameUpdate', {
      roomId: roomId,
      players: playersWithCards,
      communityCards: room.gameState.communityCards,
      pots: room.gameState.pots,
      currentBet: room.gameState.currentBet,
      gamePhase: room.gameState.phase,
      currentPlayer: room.gameState.currentPlayer,
      dealerButton: room.dealerButton,
      smallBlindAmount: room.smallBlindAmount || 10,
      bigBlindAmount: room.bigBlindAmount || 20,
      initialChips: room.config?.initialChips || 1000,
      roundBets: { ...room.gameState.roundBets },
      handBets: { ...room.gameState.handBets },
      standupGame: StandUpGame.getStatusForFrontend(room),
      message: additionalMessage,
    });
  });
}

function broadcastGameAction(rooms, io, roomId, actionType, playerId, amount) {
  const room = rooms.get(roomId);
  if (!room) return;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  room.players.forEach(p => {
    if (p.isAI) return;
    io.to(p.id).emit('gameAction', {
      type: actionType,
      playerId: playerId,
      nickname: player.nickname,
      amount: amount || null,
      timestamp: Date.now(),
    });
  });
}

function _broadcastStandUpEvent(room, roomId, io, suResult) {
  if (!suResult) return;
  room.players.forEach(p => {
    if (p.isAI) return;
    io.to(p.id).emit('gameAction', {
      type: 'standupGame',
      result: suResult,
      timestamp: Date.now(),
    });
  });
}

function getActivePlayers(room) {
  return room.players.filter(p => p.isActive);
}

function getActivePlayersSorted(room) {
  return getActivePlayers(room).sort((a, b) => a.seat - b.seat);
}

function isHeadsUp(room) {
  return getActivePlayers(room).length === 2;
}

function isThreePlayer(room) {
  return getActivePlayers(room).length === 3;
}

function getPlayerBySeatIndex(room, seatIndex) {
  return room.players.find(p => (p.seat - 1) === seatIndex);
}

function findNextActivePlayerClockwise(room, startSeatIndex) {
  const totalPlayers = room.players.length;
  for (let i = 1; i <= totalPlayers; i++) {
    const checkSeat = (startSeatIndex + i) % totalPlayers;
    const player = getPlayerBySeatIndex(room, checkSeat);
    if (player && player.isActive) return player;
  }
  return null;
}

// ==================== 状态机核心 ====================

function startGame(room, roomId, io, config, rooms) {
  clearAiTimers(room);
  room.players.forEach(p => { if (!p.isAI) io.to(p.id).emit('gameAction', { type: 'startGame', timestamp: Date.now() }); });
  if (config) {
    room.config = { ...room.config, ...config };
  }

  room.smallBlindAmount = config?.smallBlind || 10;
  room.bigBlindAmount = config?.bigBlind || (room.smallBlindAmount * 2);

  if (!room.initialChipsMap) room.initialChipsMap = {};
  if (!room.extraChipsMap) room.extraChipsMap = {};

  room.players.forEach(player => {
    if (room.initialChipsMap[player.playerId] === undefined) {
      const defaultChips = config?.initialChips || room.config?.initialChips || 1000;
      room.initialChipsMap[player.playerId] = defaultChips;
      if (player.chips === 1000 || player.chips === 0) {
        player.chips = defaultChips;
      }
    }
  });

  if (room.dealerButton === undefined) {
    room.dealerButton = Math.floor(Math.random() * room.players.length);
    console.log(`[位置] 首局庄位随机设为索引 ${room.dealerButton}`);
  }

  room.gameState = {
    phase: 'WAITING',
    communityCards: [],
    pots: [],
    currentBet: 0,
    minRaise: room.bigBlindAmount,
    currentPlayer: null,
    deck: [],
    playerCards: {},
    bets: {},
    roundBets: {},
    handBets: {},
    playersActedThisRound: new Set(),
    lastRaiserId: null,
  };

  room.players.forEach(player => {
    if (player.chips <= 0) {
      player.isActive = false;
      player.isEliminated = true;
    } else {
      player.isActive = true;
      player.isEliminated = false;
    }
    player.isTurn = false;
    player.isSmallBlind = false;
    player.isBigBlind = false;
    player.isButton = false;
    player.isUTG = false;
    player.hasActed = false;
    room.gameState.playerCards[player.id] = [];
    room.gameState.bets[player.id] = 0;
    room.gameState.roundBets[player.id] = 0;
    room.gameState.handBets[player.id] = 0;
  });

  if (config && config.enable_standup_game) {
    if (!room.standupGame || room.standupGame.is_round_finished) {
      room.standupGame = StandUpGame.create(room, config);
      if (room.standupGame) {
        console.log(`[站立游戏] 房间${roomId}已启用站立游戏附加规则，惩罚金额: ${config.standup_penalty_amount || 5000}`);
      }
    }
  }

  transitionTo(room, roomId, io, 'PRE_FLOP_BLINDS', rooms);
}

function transitionTo(room, roomId, io, nextPhase, rooms) {
  room.gameState.phase = nextPhase;
  console.log(`[状态机] 房间${roomId} -> ${nextPhase}`);

  switch (nextPhase) {
    case 'PRE_FLOP_BLINDS':
      doPreFlopBlinds(room, roomId, io, rooms);
      break;
    case 'PRE_FLOP_DEAL':
      doPreFlopDeal(room, roomId, io, rooms);
      break;
    case 'PRE_FLOP_BETTING':
      startBettingRound(room, roomId, io, '翻牌前下注开始', rooms);
      break;
    case 'FLOP_DEAL':
      doFlopDeal(room, roomId, io, rooms);
      break;
    case 'FLOP_BETTING':
      startBettingRound(room, roomId, io, '翻牌圈下注开始', rooms);
      break;
    case 'TURN_DEAL':
      doTurnDeal(room, roomId, io, rooms);
      break;
    case 'TURN_BETTING':
      startBettingRound(room, roomId, io, '转牌圈下注开始', rooms);
      break;
    case 'RIVER_DEAL':
      doRiverDeal(room, roomId, io, rooms);
      break;
    case 'RIVER_BETTING':
      startBettingRound(room, roomId, io, '河牌圈下注开始', rooms);
      break;
    case 'SHOWDOWN':
      doShowdown(room, roomId, io, rooms);
      break;
    case 'HAND_END':
      doHandEnd(room, roomId, io, rooms);
      break;
    case 'WAITING':
      sendGameUpdateWithCards(room, roomId, io, '等待房主开始下一局');
      break;
  }
}

// ==================== PRE_FLOP_BLINDS ====================

function doPreFlopBlinds(room, roomId, io, rooms) {
  const activePlayers = getActivePlayers(room);
  if (activePlayers.length < 1) {
    sendGameUpdateWithCards(room, roomId, io, '没有活跃玩家，无法开始游戏');
    return;
  }

  if (activePlayers.length === 1) {
    console.log(`[警告] 仅${activePlayers[0].nickname}一人，进入单机模式`);
  }

  const totalPlayers = room.players.length;
  const hu = isHeadsUp(room);

  let sbSeat, bbSeat;
  if (hu) {
    sbSeat = room.dealerButton % totalPlayers;
    bbSeat = (room.dealerButton + 1) % totalPlayers;
    console.log(`[两人局] BTN=SB(索引${sbSeat}), BB(索引${bbSeat})`);
  } else {
    sbSeat = (room.dealerButton + 1) % totalPlayers;
    bbSeat = (room.dealerButton + 2) % totalPlayers;
  }

  room.players.forEach(p => { p.isButton = false; p.isSmallBlind = false; p.isBigBlind = false; p.isUTG = false; });
  room.players[room.dealerButton].isButton = true;

  const sbPlayer = getPlayerBySeatIndex(room, sbSeat);
  const bbPlayer = getPlayerBySeatIndex(room, bbSeat);

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];
  room.gameState.deck = shuffleDeck(generateDeck());

  if (sbPlayer && sbPlayer.isActive) {
    const sbActual = Math.min(room.smallBlindAmount, sbPlayer.chips);
    sbPlayer.chips -= sbActual;
    room.gameState.bets[sbPlayer.id] = sbActual;
    room.gameState.roundBets[sbPlayer.id] = sbActual;
    room.gameState.handBets[sbPlayer.id] = (room.gameState.handBets[sbPlayer.id] || 0) + sbActual;
    sbPlayer.isSmallBlind = true;
  }

  if (bbPlayer && bbPlayer.isActive) {
    const bbActual = Math.min(room.bigBlindAmount, bbPlayer.chips);
    bbPlayer.chips -= bbActual;
    room.gameState.bets[bbPlayer.id] = bbActual;
    room.gameState.roundBets[bbPlayer.id] = bbActual;
    room.gameState.handBets[bbPlayer.id] = (room.gameState.handBets[bbPlayer.id] || 0) + bbActual;
    bbPlayer.isBigBlind = true;
  }

  recalculateSidePots(room);

  if (!hu) {
    const utgSeat = (room.dealerButton + 3) % totalPlayers;
    const utgPlayer = getPlayerBySeatIndex(room, utgSeat);
    if (utgPlayer) utgPlayer.isUTG = true;
  } else {
    console.log(`[两人局] 无UTG位置，SB(BTN)先行动`);
  }

  room.gameState.currentBet = room.bigBlindAmount;
  room.gameState.minRaise = room.bigBlindAmount;

  transitionTo(room, roomId, io, 'PRE_FLOP_DEAL', rooms);
}

// ==================== PRE_FLOP_DEAL ====================

function doPreFlopDeal(room, roomId, io, rooms) {
  dealPlayerCards(room);
  transitionTo(room, roomId, io, 'PRE_FLOP_BETTING', rooms);
}

function dealPlayerCards(room) {
  const { deck, playerCards } = room.gameState;
  const numCards = 2;
  const activePlayers = getActivePlayersSorted(room);
  if (activePlayers.length === 0) return;

  for (let round = 0; round < numCards; round++) {
    for (const player of activePlayers) {
      if (deck.length > 0) {
        playerCards[player.id].push(deck.pop());
      }
    }
  }
}

function isPlayerAllIn(player) {
  return player.chips === 0 && player.isActive;
}

function areAllActivePlayersAllIn(room) {
  const activePlayers = getActivePlayers(room);
  return activePlayers.length > 1 && activePlayers.every(p => p.chips === 0);
}

function communityCardsComplete(room) {
  return room.gameState.communityCards.length >= 5;
}

function fastForwardToShowdown(room, roomId, io, rooms) {
  console.log(`[快速发牌] 所有存活玩家已all-in，直接发放剩余公共牌`);
  sendGameUpdateWithCards(room, roomId, io, '所有玩家已all-in，自动发放剩余公共牌...');

  const cc = room.gameState.communityCards;

  if (cc.length < 3) {
    dealCommunityCards(room, 3 - cc.length);
  }
  if (cc.length < 4) {
    dealCommunityCards(room, 1);
  }
  if (cc.length < 5) {
    dealCommunityCards(room, 1);
  }

  setTimeout(() => {
    transitionTo(room, roomId, io, 'SHOWDOWN', rooms);
  }, 1500);
}

function getFirstActor(room) {
  const totalPlayers = room.players.length;
  let startSeat;

  if (room.gameState.phase === 'PRE_FLOP_BETTING') {
    if (isHeadsUp(room)) {
      startSeat = room.dealerButton % totalPlayers;
    } else {
      startSeat = (room.dealerButton + 3) % totalPlayers;
    }
  } else {
    startSeat = (room.dealerButton + 1) % totalPlayers;
  }

  let candidate = findNextActivePlayerClockwise(room, startSeat - 1);
  const maxLoops = totalPlayers;
  let loops = 0;

  while (candidate && isPlayerAllIn(candidate) && loops < maxLoops) {
    candidate = findNextActivePlayerClockwise(room, room.players.findIndex(p => p.id === candidate.id));
    loops++;
  }
  return candidate;
}

// ==================== 下注轮次核心逻辑 ====================

function startBettingRound(room, roomId, io, message, rooms) {
  const activePlayers = getActivePlayers(room);

  if (activePlayers.length <= 1) {
    earlyEndGame(room, roomId, io, rooms);
    return;
  }

  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    fastForwardToShowdown(room, roomId, io, rooms);
    return;
  }

  room.gameState.playersActedThisRound = new Set();
  room.gameState.lastRaiserId = null;

  activePlayers.forEach(p => {
    room.gameState.roundBets[p.id] = room.gameState.bets[p.id] || 0;
    p.hasActed = false;
    if (isPlayerAllIn(p) && !room.gameState.playersActedThisRound.has(p.id)) {
      p.hasActed = true;
      room.gameState.playersActedThisRound.add(p.id);
    }
  });

  const firstActor = getFirstActor(room);
  if (!firstActor) {
    endBettingRound(room, roomId, io, rooms);
    return;
  }

  room.gameState.currentPlayer = firstActor.id;
  firstActor.isTurn = true;
  firstActor.hasActed = true;
  room.gameState.playersActedThisRound.add(firstActor.id);

  sendGameUpdateWithCards(room, roomId, io, `${message}，轮到 ${firstActor.nickname} 行动`);

  if (firstActor.isAI) {
    scheduleAiAction(room, roomId, io, firstActor, rooms);
  }
}

function moveToNextPlayer(room, roomId, io, rooms) {
  const activePlayers = getActivePlayersSorted(room);

  if (activePlayers.length <= 1) {
    earlyEndGame(room, roomId, io, rooms);
    return;
  }

  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    fastForwardToShowdown(room, roomId, io, rooms);
    return;
  }

  const currentId = room.gameState.currentPlayer;
  let currentIdx = activePlayers.findIndex(p => p.id === currentId);

  if (currentIdx === -1) {
    currentIdx = activePlayers.length - 1;
  }

  let attempts = 0;
  while (attempts < activePlayers.length) {
    currentIdx = (currentIdx + 1) % activePlayers.length;
    let nextPlayer = activePlayers[currentIdx];

    if (isBettingRoundComplete(room)) {
      endBettingRound(room, roomId, io, rooms);
      return;
    }

    if (isPlayerAllIn(nextPlayer)) {
      if (!room.gameState.playersActedThisRound.has(nextPlayer.id)) {
        nextPlayer.hasActed = true;
        room.gameState.playersActedThisRound.add(nextPlayer.id);
      }
      attempts++;
      continue;
    }

    if (room.gameState.playersActedThisRound.has(nextPlayer.id)) {
      attempts++;
      continue;
    }

    room.gameState.currentPlayer = nextPlayer.id;
    nextPlayer.isTurn = true;

    nextPlayer.hasActed = true;
    room.gameState.playersActedThisRound.add(nextPlayer.id);

    sendGameUpdateWithCards(room, roomId, io, `轮到 ${nextPlayer.nickname} 行动`);

    if (nextPlayer.isAI) {
      scheduleAiAction(room, roomId, io, nextPlayer, rooms);
    }
    return;
  }

  endBettingRound(room, roomId, io, rooms);
}

function isBettingRoundComplete(room) {
  const activePlayers = getActivePlayers(room);
  if (activePlayers.length <= 1) return true;

  const canActPlayers = activePlayers.filter(p => p.chips > 0);
  if (canActPlayers.length === 0) return true;

  activePlayers.forEach(p => {
    if (p.chips === 0 && !room.gameState.playersActedThisRound.has(p.id)) {
      room.gameState.playersActedThisRound.add(p.id);
    }
  });

  const allActed = canActPlayers.every(p => room.gameState.playersActedThisRound.has(p.id));
  if (!allActed) return false;

  const allBetsMatch = canActPlayers.every(p => (room.gameState.roundBets[p.id] || 0) >= room.gameState.currentBet);
  if (!allBetsMatch) return false;

  if (room.gameState.lastRaiserId) {
    const lastRaiserActed = room.gameState.playersActedThisRound?.has(room.gameState.lastRaiserId);
    if (lastRaiserActed === false) return false;
  }

  return true;
}


// ==================== 玩家行动处理 ====================

function handleFold(room, roomId, io, playerId, rooms) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  player.isActive = false;
  player.isTurn = false;
  room.gameState.playersActedThisRound.delete(playerId);
  broadcastGameAction(rooms, io, roomId, 'fold', playerId);

  const activePlayers = getActivePlayers(room);
  if (activePlayers.length <= 1) {
    earlyEndGame(room, roomId, io, rooms);
    return;
  }
  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    fastForwardToShowdown(room, roomId, io, rooms);
    return;
  }
  if (isBettingRoundComplete(room)) {
    endBettingRound(room, roomId, io, rooms);
    return;
  }

  const startSeatIndex = player.seat - 1;
  const nextPlayer = findNextActivePlayerClockwise(room, startSeatIndex);

  if (!nextPlayer) {
    moveToNextPlayer(room, roomId, io, rooms);
    return;
  }

  room.gameState.currentPlayer = nextPlayer.id;
  nextPlayer.isTurn = true;
  nextPlayer.hasActed = true;
  room.gameState.playersActedThisRound.add(nextPlayer.id);

  sendGameUpdateWithCards(room, roomId, io, `轮到 ${nextPlayer.nickname} 行动`);

  if (nextPlayer.isAI) {
    scheduleAiAction(room, roomId, io, nextPlayer, rooms);
  }
}

function handleCheck(room, roomId, io, playerId, rooms) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  const myRoundBet = room.gameState.roundBets[playerId] || 0;
  if (room.gameState.currentBet > 0 && myRoundBet < room.gameState.currentBet) {
    console.warn(`[游戏] ${player.nickname} 尝试过牌但需要跟注 ${room.gameState.currentBet - myRoundBet}，转为跟注`);
    handleCall(room, roomId, io, playerId, rooms);
    return;
  }

  player.isTurn = false;
  broadcastGameAction(rooms, io, roomId, 'check', playerId);
  moveToNextPlayer(room, roomId, io, rooms);
}

function handleCall(room, roomId, io, playerId, rooms) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  const myRoundBet = room.gameState.roundBets[playerId] || 0;
  const callAmount = Math.max(0, room.gameState.currentBet - myRoundBet);

  if (callAmount <= 0) {
    handleCheck(room, roomId, io, playerId, rooms);
    return;
  }

  if (player.chips <= callAmount) {
    handleAllIn(room, roomId, io, playerId, rooms);
    return;
  }

  player.chips -= callAmount;
  room.gameState.bets[playerId] = (room.gameState.bets[playerId] || 0) + callAmount;
  room.gameState.roundBets[playerId] = room.gameState.currentBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + callAmount;
  if (!room.gameState.pots[0].eligiblePlayers.includes(playerId)) {
    room.gameState.pots[0].eligiblePlayers.push(playerId);
  }

  recalculateSidePots(room);

  player.isTurn = false;
  broadcastGameAction(rooms, io, roomId, 'call', playerId, callAmount);

  moveToNextPlayer(room, roomId, io, rooms);
}

function handleRaise(room, roomId, io, playerId, amount, rooms) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  const currentRoundBet = room.gameState.roundBets[playerId] || 0;
  const raiseTotal = Math.max(amount, 0);
  const raiseIncrement = Math.max(0, raiseTotal - currentRoundBet);

  if (room.gameState.currentBet === 0) {
    const minBet = room.bigBlindAmount;
    if (raiseTotal < minBet && player.chips > raiseTotal) {
      console.warn(`[游戏] ${player.nickname} 下注额 ${raiseTotal} 小于大盲 ${minBet}，转为过牌`);
      handleCheck(room, roomId, io, playerId, rooms);
      return;
    }
  }

  if (raiseTotal <= room.gameState.currentBet) {
    handleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseIncrement <= 0) {
    handleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseIncrement < room.gameState.minRaise && player.chips > raiseIncrement) {
    handleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseIncrement >= room.gameState.minRaise) {
    room.gameState.minRaise = raiseIncrement;
  }

  if (player.chips <= raiseIncrement) {
    handleAllIn(room, roomId, io, playerId, rooms);
    return;
  }

  player.chips -= raiseIncrement;
  room.gameState.bets[playerId] = (room.gameState.bets[playerId] || 0) + raiseIncrement;
  room.gameState.roundBets[playerId] = raiseTotal;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + raiseIncrement;
  if (!room.gameState.pots[0].eligiblePlayers.includes(playerId)) {
    room.gameState.pots[0].eligiblePlayers.push(playerId);
  }
  room.gameState.currentBet = raiseTotal;
  room.gameState.lastRaiserId = playerId;

  recalculateSidePots(room);

  player.isTurn = false;
  broadcastGameAction(rooms, io, roomId, 'raise', playerId, raiseTotal);

  room.gameState.playersActedThisRound = new Set();
  room.gameState.playersActedThisRound.add(playerId);

  activePlayersExceptCurrent(room).forEach(p => {
    p.hasActed = false;
  });

  moveToNextPlayer(room, roomId, io, rooms);
}

function activePlayersExceptCurrent(room) {
  return getActivePlayers(room).filter(p => p.id !== room.gameState.currentPlayer);
}

function handleAllIn(room, roomId, io, playerId, rooms) {
  const player = room.players.find(p => p.id === playerId);
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  const allInAmount = player.chips;
  if (allInAmount <= 0) {
    moveToNextPlayer(room, roomId, io, rooms);
    return;
  }

  player.chips = 0;
  const oldRoundBet = room.gameState.roundBets[playerId] || 0;
  const newRoundBet = oldRoundBet + allInAmount;

  room.gameState.bets[playerId] = newRoundBet;
  room.gameState.roundBets[playerId] = newRoundBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + allInAmount;

  recalculateSidePots(room);

  if (newRoundBet > room.gameState.currentBet) {
    const raiseIncrement = newRoundBet - room.gameState.currentBet;
    const isFullRaise = raiseIncrement >= room.gameState.minRaise;

    room.gameState.currentBet = newRoundBet;

    if (isFullRaise) {
      room.gameState.lastRaiserId = playerId;
      room.gameState.minRaise = raiseIncrement;
      room.gameState.playersActedThisRound = new Set();
      room.gameState.playersActedThisRound.add(playerId);
      activePlayersExceptCurrent(room).forEach(p => { p.hasActed = false; });
    }
  }

  player.isTurn = false;
  player.hasActed = true;
  room.gameState.playersActedThisRound.add(playerId);
  broadcastGameAction(rooms, io, roomId, 'all-in', playerId, newRoundBet);

  moveToNextPlayer(room, roomId, io, rooms);
}

function recalculateSidePots(room) {
  const activePlayers = getActivePlayers(room);

  const allPlayersWithBets = room.players.filter(p => (room.gameState.handBets[p.id] || 0) > 0);

  if (allPlayersWithBets.length === 0) {
    room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];
    return;
  }

  const playerBets = allPlayersWithBets.map(p => ({
    id: p.id,
    bet: room.gameState.handBets[p.id] || 0,
    isActive: p.isActive
  }));

  playerBets.sort((a, b) => a.bet - b.bet);

  const newPots = [];
  let previousBet = 0;

  for (let i = 0; i < playerBets.length; i++) {
    const currentBet = playerBets[i].bet;
    if (currentBet > previousBet) {
      const increment = currentBet - previousBet;

      const eligiblePlayers = activePlayers
        .filter(p => (room.gameState.handBets[p.id] || 0) >= currentBet)
        .map(p => p.id);

      let layerAmount = 0;
      room.players.forEach(p => {
        const playerBet = room.gameState.handBets[p.id] || 0;
        if (playerBet >= currentBet) {
          layerAmount += increment;
        } else if (playerBet > previousBet) {
          layerAmount += playerBet - previousBet;
        }
      });

      if (layerAmount > 0) {
        newPots.push({
          amount: layerAmount,
          eligiblePlayers: eligiblePlayers
        });
      }
      previousBet = currentBet;
    }
  }

  room.gameState.pots = newPots.length > 0 ? newPots : [{ amount: 0, eligiblePlayers: [] }];
  console.log(`[边池] 重新计算完成，共 ${newPots.length} 个底池，总金额: ${newPots.reduce((sum, p) => sum + p.amount, 0)}`);
}

// ==================== 结束下注轮 / 发公共牌 ====================

function endBettingRound(room, roomId, io, rooms) {
  recalculateSidePots(room);

  room.players.forEach(player => {
    player.isTurn = false;
    room.gameState.bets[player.id] = 0;
    room.gameState.roundBets[player.id] = 0;
  });
  room.gameState.currentBet = 0;
  room.gameState.minRaise = room.bigBlindAmount;
  room.gameState.lastRaiserId = null;

  switch (room.gameState.phase) {
    case 'PRE_FLOP_BETTING':
      transitionTo(room, roomId, io, 'FLOP_DEAL', rooms);
      break;
    case 'FLOP_BETTING':
      transitionTo(room, roomId, io, 'TURN_DEAL', rooms);
      break;
    case 'TURN_BETTING':
      transitionTo(room, roomId, io, 'RIVER_DEAL', rooms);
      break;
    case 'RIVER_BETTING':
      transitionTo(room, roomId, io, 'SHOWDOWN', rooms);
      break;
  }
}

function doFlopDeal(room, roomId, io, rooms) {
  dealCommunityCards(room, 3);
  transitionTo(room, roomId, io, 'FLOP_BETTING', rooms);
}

function doTurnDeal(room, roomId, io, rooms) {
  dealCommunityCards(room, 1);
  transitionTo(room, roomId, io, 'TURN_BETTING', rooms);
}

function doRiverDeal(room, roomId, io, rooms) {
  dealCommunityCards(room, 1);
  transitionTo(room, roomId, io, 'RIVER_BETTING', rooms);
}

function dealCommunityCards(room, count) {
  const { deck, communityCards } = room.gameState;
  for (let i = 0; i < count && deck.length > 0; i++) {
    communityCards.push(deck.pop());
  }
}

// ==================== 提前结束（仅剩一人）====================

function earlyEndGame(room, roomId, io, rooms) {
  const activePlayers = getActivePlayers(room);
  if (activePlayers.length === 0) return;
  const winner = activePlayers[0];
  let totalPot = 0;
  room.gameState.pots.forEach(pot => {
    totalPot += pot.amount;
    winner.chips += pot.amount;
  });

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];

  room.gameState.phase = 'HAND_END';
  room.gameState.showdownPlayerIds = [];

  var suResult = StandUpGame.onHandEnd(room, [winner.id]);
  if (suResult) {
    _broadcastStandUpEvent(room, roomId, io, suResult);
  }

  sendGameUpdateWithCards(room, roomId, io, `${winner.nickname} 获胜（其余玩家弃牌），赢得 ${totalPot} 筹码！`);

  // 发送获胜者事件到前端
  room.players.forEach(p => { if (!p.isAI) io.to(p.id).emit('gameAction', {
    type: 'winner',
    playerId: winner.id,
    nickname: winner.nickname,
    amount: totalPot,
    timestamp: Date.now(),
  }); });

  setTimeout(() => {
    finishHandEndTransition(room, roomId, io, rooms);
  }, 3000);
}

// ==================== SHOWDOWN 摊牌 ====================

function doShowdown(room, roomId, io, rooms) {
  room.gameState.phase = 'SHOWDOWN';
  const activePlayers = getActivePlayers(room);
  room.gameState.showdownPlayerIds = activePlayers.map(p => p.id);
  let results = [];

  room.gameState.pots.forEach((pot, potIndex) => {
    if (pot.amount <= 0) return;
    const eligible = activePlayers.filter(p => pot.eligiblePlayers.includes(p.id));
    if (eligible.length === 0) return;

    if (eligible.length === 1) {
      const potWinner = eligible[0];
      potWinner.chips += pot.amount;
      results.push({ potIndex, winner: potWinner.nickname, amount: pot.amount, reason: '唯一存活' });
    } else {
      try {
        const showdownInput = eligible.map(p => ({
          id: p.id,
          nickname: p.nickname,
          holeCards: room.gameState.playerCards[p.id] || [],
          isFolded: false,
        }));

        const sdResult = pokerShowdown(showdownInput, room.gameState.communityCards);

        const shareAmount = Math.floor(pot.amount / sdResult.winners.length);
        const remainder = pot.amount - shareAmount * sdResult.winners.length;

        sdResult.winners.forEach((wid, idx) => {
          const winnerPlayer = eligible.find(p => p.id === wid);
          if (winnerPlayer) {
            const winAmt = shareAmount + (idx < remainder ? 1 : 0);
            winnerPlayer.chips += winAmt;
            const winnerHandInfo = sdResult.players.find(ep => ep.id === wid);
            results.push({
              potIndex,
              winner: winnerPlayer.nickname,
              amount: winAmt,
              hand: winnerHandInfo ? winnerHandInfo.handName : '',
              isTie: sdResult.isTie && sdResult.winners.length > 1,
            });
          }
        });
      } catch (err) {
        console.error('开牌判定错误:', err.message);
        const fallback = eligible[0];
        fallback.chips += pot.amount;
        results.push({ potIndex, winner: fallback.nickname, amount: pot.amount, reason: '降级处理' });
      }
    }
  });

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];

  var showdownWinnerIds = [];
  results.forEach(function(r) {
    var wp = room.players.find(function(pl) { return pl.nickname === r.winner; });
    if (wp) showdownWinnerIds.push(wp.id);
  });
  var suResult = StandUpGame.onHandEnd(room, showdownWinnerIds);
  if (suResult) {
    _broadcastStandUpEvent(room, roomId, io, suResult);
  }

  const totalWon = results.reduce((s, r) => s + r.amount, 0);
  const resultMsg = results.map(r => {
    let msg = `${r.winner} 赢得 ${r.amount} 筹码`;
    if (r.hand) msg += `（${r.hand}）`;
    if (r.isTie) msg += ' [平局]';
    return msg;
  }).join('；');

  sendGameUpdateWithCards(room, roomId, io, `摊牌结束！${resultMsg}。总底池：${totalWon}`);

  // 发送获胜者事件到前端
  results.forEach(result => {
    room.players.forEach(p => { if (!p.isAI) io.to(p.id).emit('gameAction', {
      type: 'winner',
      playerId: room.players.find(pl => pl.nickname === result.winner)?.id || '',
      nickname: result.winner,
      amount: result.amount,
      hand: result.hand || '',
      isTie: result.isTie || false,
      timestamp: Date.now(),
    }); });
  });

  setTimeout(() => {
    transitionTo(room, roomId, io, 'HAND_END', rooms);
  }, 4000);
}

// ==================== HAND_END 本局结束 ====================

function doHandEnd(room, roomId, io, rooms) {
  room.players = room.players.filter(player => player.isOnline !== false || player.isAI);
  
  room.players.forEach(player => {
    if (player.chips <= 0) {
      if (player.isActive && !player.isEliminated) {
        var elimResult = StandUpGame.onAllInElimination(room, player.id);
        if (elimResult) {
          _broadcastStandUpEvent(room, roomId, io, elimResult);
        }
      }
      player.isActive = false;
      player.isEliminated = true;
    } else {
      player.isActive = true;
      player.isEliminated = false;
    }
    player.isTurn = false;
    player.isSmallBlind = false;
    player.isBigBlind = false;
    player.isButton = false;
    player.isUTG = false;
    player.hasActed = false;
  });

  if (room.players.length > 0) {
    if (room.dealerButton === undefined) {
      room.dealerButton = 0;
    } else {
      room.dealerButton = (room.dealerButton + 1) % room.players.length;
    }
    room.players[room.dealerButton].isButton = true;
  }

  const currentCommunityCards = [...room.gameState.communityCards];
  const currentPlayerCards = { ...room.gameState.playerCards };
  const currentShowdownPlayerIds = room.gameState.showdownPlayerIds || [];

  room.gameState = {
    phase: 'CONFIRM_CONTINUE',
    communityCards: currentCommunityCards,
    playerCards: currentPlayerCards,
    showdownPlayerIds: currentShowdownPlayerIds,
    pots: [{ amount: 0, eligiblePlayers: [] }],
    currentBet: 0,
    minRaise: room.bigBlindAmount || 20,
    currentPlayer: null,
    deck: [],
    bets: {},
    roundBets: {},
    handBets: {},
    playersActedThisRound: new Set(),
    lastRaiserId: null,
    playersConfirmedContinue: new Set(),
  };

  room.players.forEach(p => {
    if (p.isAI) {
      room.gameState.playersConfirmedContinue.add(p.id);
    }
  });

  const humanPlayers = room.players.filter(p => !p.isAI);
  if (humanPlayers.length <= 0) return;

  const allConfirmed = room.players.every(p => room.gameState.playersConfirmedContinue.has(p.id));
  if (allConfirmed) {
    nextHand(room, roomId, io, rooms);
  } else {
    sendGameUpdateWithCards(room, roomId, io, '本局结束，请确认是否继续游戏');
  }
}

function nextHand(room, roomId, io, rooms) {
  if (room.gameState.phase !== 'WAITING' && room.gameState.phase !== 'CONFIRM_CONTINUE') return;
  room.players.forEach(p => { if (!p.isAI) io.to(p.id).emit('gameAction', { type: 'nextHand', timestamp: Date.now() }); });
  startGame(room, roomId, io, room.config, rooms);
}

function finishHandEndTransition(room, roomId, io, rooms) {
  doHandEnd(room, roomId, io, rooms);
}

// ==================== 重置游戏 ====================

function resetGame(room, roomId, io) {
  clearAiTimers(room);
  room.dealerButton = undefined;
  room.initialChipsMap = {};
  room.extraChipsMap = {};
  StandUpGame._destroy(room);
  const defaultChips = room.config?.initialChips || 1000;
  room.players.forEach(player => {
    const resetChips = defaultChips;
    room.initialChipsMap[player.playerId] = resetChips;
    player.chips = resetChips;
    player.isActive = true;
    player.isTurn = false;
    player.isSmallBlind = false;
    player.isBigBlind = false;
    player.isButton = false;
    player.isUTG = false;
    player.hasActed = false;
  });

  room.gameState = {
    phase: 'WAITING',
    communityCards: [],
    pots: [{ amount: 0, eligiblePlayers: [] }],
    currentBet: 0,
    minRaise: 20,
    currentPlayer: null,
    deck: [],
    playerCards: {},
    bets: {},
    roundBets: {},
    handBets: {},
    playersActedThisRound: new Set(),
    lastRaiserId: null,
  };

  sendGameUpdateWithCards(room, roomId, io, '游戏已重置');
}

// ==================== 房主设定玩家筹码 ====================

function handleSetPlayerChips(room, roomId, io, hostSocketId, data) {
  if (room.host !== hostSocketId) return;
  if (!data || !data.playerId || data.chips === undefined) return;
  const chips = Math.max(0, parseInt(data.chips) || 0);
  const target = room.players.find(p => p.playerId === data.playerId);
  if (!target) return;

  if (!room.initialChipsMap) room.initialChipsMap = {};
  if (room.initialChipsMap[data.playerId] === undefined) {
    room.initialChipsMap[data.playerId] = target.chips;
  }
  room.initialChipsMap[data.playerId] = chips;
  target.chips = chips;

  if (chips > 0) {
    target.isActive = true;
    target.isEliminated = false;
  }

  sendGameUpdateWithCards(room, roomId, io, `${target.nickname} 的筹码已设为 ${chips}`);
}

// ==================== 房主追加玩家筹码 ====================

function handleAddPlayerChips(room, roomId, io, hostSocketId, data) {
  if (room.host !== hostSocketId) return;
  if (!data || !data.playerId || data.amount === undefined) return;
  const amount = Math.max(0, parseInt(data.amount) || 0);
  if (amount <= 0) return;
  const target = room.players.find(p => p.playerId === data.playerId);
  if (!target) return;

  if (!room.extraChipsMap) room.extraChipsMap = {};
  if (!room.extraChipsMap[data.playerId]) room.extraChipsMap[data.playerId] = 0;
  room.extraChipsMap[data.playerId] += amount;
  target.chips += amount;

  if (target.chips > 0) {
    target.isActive = true;
    target.isEliminated = false;
  }

  sendGameUpdateWithCards(room, roomId, io, `房主给 ${target.nickname} 追加了 ${amount} 筹码`);
}

// ==================== 结算牌局 ====================

function handleSettleGame(room, roomId, io, hostSocketId) {
  if (room.host !== hostSocketId) return;

  if (!room.initialChipsMap) room.initialChipsMap = {};
  if (!room.extraChipsMap) room.extraChipsMap = {};

  const scoreboard = room.players.map(p => {
    const initialChips = room.initialChipsMap[p.playerId] !== undefined
      ? room.initialChipsMap[p.playerId]
      : (room.config?.initialChips || 1000);
    const extraChips = room.extraChipsMap[p.playerId] || 0;
    const totalOriginal = initialChips + extraChips;
    const profit = p.chips - totalOriginal;
    return {
      playerId: p.playerId,
      nickname: p.nickname,
      currentChips: p.chips,
      profit: profit,
      totalOriginal: totalOriginal,
      isAI: p.isAI || false,
    };
  });

  scoreboard.sort((a, b) => b.currentChips - a.currentChips);

  room.gameState.phase = 'SETTLED';

  room.players.forEach(p => {
    if (p.isAI) return;
    io.to(p.id).emit('gameAction', {
      type: 'settleGame',
      scoreboard: scoreboard,
      timestamp: Date.now(),
    });
  });

  sendGameUpdateWithCards(room, roomId, io, '牌局已结算');
}

function handleConfirmContinue(room, roomId, io, playerId, rooms) {
  if (room.gameState.phase !== 'CONFIRM_CONTINUE') return;
  
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  
  room.gameState.playersConfirmedContinue.add(playerId);
  console.log(`[游戏] 玩家 ${player.nickname} 已确认继续游戏`);
  
  const allPlayersConfirmed = room.players.every(p => room.gameState.playersConfirmedContinue.has(p.id));
  if (allPlayersConfirmed) {
    console.log(`[游戏] 所有玩家都已确认继续，开始下一局`);
    nextHand(room, roomId, io, rooms);
  } else {
    const remainingPlayers = room.players.filter(p => !room.gameState.playersConfirmedContinue.has(p.id) && !p.isAI).map(p => p.nickname);
    if (remainingPlayers.length > 0) {
      sendGameUpdateWithCards(room, roomId, io, `等待 ${remainingPlayers.join('、')} 确认继续游戏`);
    }
  }
}

function scheduleAiAction(room, roomId, io, aiPlayer, rooms) {
  const thinkTime = getThinkTime(aiPlayer.aiDifficulty || 'medium', aiPlayer.personality);
  const timerId = setTimeout(() => {
    const idx = room._aiTimerIds ? room._aiTimerIds.indexOf(timerId) : -1;
    if (idx !== -1) room._aiTimerIds.splice(idx, 1);
    try {
      if (!room || room.gameState.currentPlayer !== aiPlayer.id) return;
      if (!aiPlayer.isActive || aiPlayer.chips === 0) return;

      const gameState = buildAiGameState(room, aiPlayer);
      const decision = makeDecision(aiPlayer.aiDifficulty || 'medium', gameState, aiPlayer.id);
      console.log(`[AI] ${aiPlayer.nickname} 决策: ${decision.action}`, decision.amount || '');

      switch (decision.action) {
        case 'fold':
          handleFold(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'check':
          handleCheck(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'call':
          handleCall(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'raise':
          handleRaise(room, roomId, io, aiPlayer.id, decision.amount, rooms);
          break;
        case 'all-in':
          handleAllIn(room, roomId, io, aiPlayer.id, rooms);
          break;
        default:
          handleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    } catch (error) {
      console.error(`[AI] ${aiPlayer.nickname} 行动异常:`, error);
      if (aiPlayer.isActive && room.gameState.currentPlayer === aiPlayer.id) {
        handleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    }
  }, thinkTime);
  trackAiTimer(room, timerId);
}

function buildAiGameState(room, aiPlayer) {
  return {
    phase: room.gameState.phase,
    communityCards: room.gameState.communityCards || [],
    pot: room.gameState.pots.reduce((sum, pot) => sum + pot.amount, 0),
    currentBet: room.gameState.currentBet || 0,
    minRaise: room.gameState.minRaise || room.bigBlindAmount || 20,
    bigBlind: room.bigBlindAmount || 20,
    smallBlind: room.smallBlindAmount || 10,
    dealerButton: room.dealerButton || 0,
    lastRaiserId: room.gameState.lastRaiserId || null,
    players: room.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      chips: p.chips,
      isActive: p.isActive,
      isAI: p.isAI || false,
      currentBet: room.gameState.roundBets[p.id] || 0,
      isAllIn: p.chips === 0 && p.isActive,
      seat: p.seat,
    })),
    myBet: room.gameState.roundBets[aiPlayer.id] || 0,
    myChips: aiPlayer.chips,
    myCards: room.gameState.playerCards[aiPlayer.id] || [],
  };
}


