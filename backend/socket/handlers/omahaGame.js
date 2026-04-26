var { generateDeck, shuffleDeck } = require('../../utils/deck');
var { omahaShowdown: omahaPokerShowdown, findBestOmahaHand, calculatePotLimitRaise, evaluateOmahaPreflopStrength } = require('../../utils/omahaEvaluator');
var { makeDecision, getThinkTime, pickAiName, clearRoomPersonality } = require('../../utils/aiEngine');

module.exports = function(socket, rooms, io) {
  socket.on('omahaAction', function(data) {
    try {
      var action = data.action;
      var actionData = data.data;
      if (!action) return;

      var room = null;
      var roomId = null;

      for (var entry of rooms.entries()) {
        if (entry[1].players.some(function(p) { return p.id === socket.id; }) && entry[1].gameType === 'omaha') {
          room = entry[1];
          roomId = entry[0];
          break;
        }
      }

      if (!room) return;

      var player = room.players.find(function(p) { return p.id === socket.id; });
      if (!player) return;

      if (!player.isActive && action !== 'resetGame') return;

      switch (action) {
        case 'startGame':
          omahaStartGame(room, roomId, io, actionData, rooms);
          break;
        case 'nextHand':
          omahaNextHand(room, roomId, io, rooms);
          break;
        case 'resetGame':
          omahaResetGame(room, roomId, io);
          break;
        case 'setPlayerChips':
          omahaSetPlayerChips(room, roomId, io, socket.id, actionData);
          break;
        case 'addPlayerChips':
          omahaAddPlayerChips(room, roomId, io, socket.id, actionData);
          break;
        case 'settleGame':
          omahaSettleGame(room, roomId, io, socket.id);
          break;
        case 'fold':
          omahaHandleFold(room, roomId, io, socket.id, rooms);
          break;
        case 'check':
          omahaHandleCheck(room, roomId, io, socket.id, rooms);
          break;
        case 'call':
          omahaHandleCall(room, roomId, io, socket.id, rooms);
          break;
        case 'raise':
          omahaHandleRaise(room, roomId, io, socket.id, actionData ? actionData.amount : 0, rooms);
          break;
        case 'all-in':
          omahaHandleAllIn(room, roomId, io, socket.id, rooms);
          break;
        case 'confirmContinue':
          omahaConfirmContinue(room, roomId, io, socket.id, rooms);
          break;
      }
    } catch (error) {
      console.error('[奥马哈] 操作错误:', error);
      io.to(socket.id).emit('error', { message: '操作执行失败' });
    }
  });
};

function omahaSendUpdate(room, roomId, io, additionalMessage) {
  var isShowdownOrAfter = ['SHOWDOWN', 'HAND_END', 'CONFIRM_CONTINUE'].includes(room.gameState.phase);
  var showdownPlayerIds = room.gameState.showdownPlayerIds || [];

  room.players.forEach(function(player) {
    if (player.isAI) return;
    var playersWithCards = room.players.map(function(p) {
      var playerCopy = Object.assign({}, p);
      delete playerCopy.cards;
      playerCopy.cards = undefined;
      var isSelf = p.id === player.id;
      if (isSelf) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (isShowdownOrAfter && showdownPlayerIds.includes(p.id)) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (p.isActive && room.gameState.phase === 'SHOWDOWN') {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else {
        playerCopy.cards = [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      }
      return playerCopy;
    });

    var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
    var maxRaiseInfo = null;
    if (player.isActive && room.gameState.currentPlayer === player.id && room.gameState.phase.includes('BETTING')) {
      maxRaiseInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, room.gameState.roundBets[player.id] || 0);
    }

    io.to(player.id).emit('omahaUpdate', {
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
      roundBets: Object.assign({}, room.gameState.roundBets),
      handBets: Object.assign({}, room.gameState.handBets),
      potLimitRaise: maxRaiseInfo,
      message: additionalMessage,
    });
  });
}

function omahaBroadcastAction(rooms, io, roomId, actionType, playerId, amount) {
  var room = rooms.get(roomId);
  if (!room) return;
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;
  room.players.forEach(function(p) {
    if (p.isAI) return;
    io.to(p.id).emit('omahaAction', {
      type: actionType,
      playerId: playerId,
      nickname: player.nickname,
      amount: amount || null,
      timestamp: Date.now(),
    });
  });
}

function getActivePlayers(room) {
  return room.players.filter(function(p) { return p.isActive; });
}

function getActivePlayersSorted(room) {
  return getActivePlayers(room).sort(function(a, b) { return a.seat - b.seat; });
}

function isHeadsUp(room) {
  return getActivePlayers(room).length === 2;
}

function getPlayerBySeatIndex(room, seatIndex) {
  return room.players.find(function(p) { return (p.seat - 1) === seatIndex; });
}

function findNextActivePlayerClockwise(room, startSeatIndex) {
  var totalPlayers = room.players.length;
  for (var i = 1; i <= totalPlayers; i++) {
    var checkSeat = (startSeatIndex + i) % totalPlayers;
    var player = getPlayerBySeatIndex(room, checkSeat);
    if (player && player.isActive) return player;
  }
  return null;
}

function isPlayerAllIn(player) {
  return player.chips === 0 && player.isActive;
}

function areAllActivePlayersAllIn(room) {
  var activePlayers = getActivePlayers(room);
  return activePlayers.length > 1 && activePlayers.every(function(p) { return p.chips === 0; });
}

function communityCardsComplete(room) {
  return room.gameState.communityCards.length >= 5;
}

function omahaStartGame(room, roomId, io, config, rooms) {
  room.players.forEach(function(p) { if (!p.isAI) io.to(p.id).emit('omahaAction', { type: 'startGame', timestamp: Date.now() }); });

  if (config) {
    room.config = Object.assign({}, room.config, config);
  }

  room.smallBlindAmount = config && config.smallBlind ? config.smallBlind : 10;
  room.bigBlindAmount = config && config.bigBlind ? config.bigBlind : (room.smallBlindAmount * 2);

  if (!room.initialChipsMap) room.initialChipsMap = {};
  if (!room.extraChipsMap) room.extraChipsMap = {};

  room.players.forEach(function(player) {
    if (room.initialChipsMap[player.playerId] === undefined) {
      var defaultChips = (config && config.initialChips) || (room.config && room.config.initialChips) || 1000;
      room.initialChipsMap[player.playerId] = defaultChips;
      if (player.chips === 1000 || player.chips === 0) {
        player.chips = defaultChips;
      }
    }
  });

  if (room.dealerButton === undefined) {
    room.dealerButton = Math.floor(Math.random() * room.players.length);
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

  room.players.forEach(function(player) {
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

  omahaTransitionTo(room, roomId, io, 'PRE_FLOP_BLINDS', rooms);
}

function omahaTransitionTo(room, roomId, io, nextPhase, rooms) {
  room.gameState.phase = nextPhase;
  console.log('[奥马哈] 房间' + roomId + ' -> ' + nextPhase);

  switch (nextPhase) {
    case 'PRE_FLOP_BLINDS':
      omahaDoPreFlopBlinds(room, roomId, io, rooms);
      break;
    case 'PRE_FLOP_DEAL':
      omahaDoPreFlopDeal(room, roomId, io, rooms);
      break;
    case 'PRE_FLOP_BETTING':
      omahaStartBettingRound(room, roomId, io, '翻牌前下注开始', rooms);
      break;
    case 'FLOP_DEAL':
      omahaDoFlopDeal(room, roomId, io, rooms);
      break;
    case 'FLOP_BETTING':
      omahaStartBettingRound(room, roomId, io, '翻牌圈下注开始', rooms);
      break;
    case 'TURN_DEAL':
      omahaDoTurnDeal(room, roomId, io, rooms);
      break;
    case 'TURN_BETTING':
      omahaStartBettingRound(room, roomId, io, '转牌圈下注开始', rooms);
      break;
    case 'RIVER_DEAL':
      omahaDoRiverDeal(room, roomId, io, rooms);
      break;
    case 'RIVER_BETTING':
      omahaStartBettingRound(room, roomId, io, '河牌圈下注开始', rooms);
      break;
    case 'SHOWDOWN':
      omahaDoShowdown(room, roomId, io, rooms);
      break;
    case 'HAND_END':
      omahaDoHandEnd(room, roomId, io, rooms);
      break;
    case 'WAITING':
      omahaSendUpdate(room, roomId, io, '等待房主开始下一局');
      break;
  }
}

function omahaDoPreFlopBlinds(room, roomId, io, rooms) {
  var activePlayers = getActivePlayers(room);
  if (activePlayers.length < 1) {
    omahaSendUpdate(room, roomId, io, '没有活跃玩家');
    return;
  }

  var totalPlayers = room.players.length;
  var hu = isHeadsUp(room);

  var sbSeat, bbSeat;
  if (hu) {
    sbSeat = room.dealerButton % totalPlayers;
    bbSeat = (room.dealerButton + 1) % totalPlayers;
  } else {
    sbSeat = (room.dealerButton + 1) % totalPlayers;
    bbSeat = (room.dealerButton + 2) % totalPlayers;
  }

  room.players.forEach(function(p) { p.isButton = false; p.isSmallBlind = false; p.isBigBlind = false; p.isUTG = false; });
  room.players[room.dealerButton].isButton = true;

  var sbPlayer = getPlayerBySeatIndex(room, sbSeat);
  var bbPlayer = getPlayerBySeatIndex(room, bbSeat);

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];
  room.gameState.deck = shuffleDeck(generateDeck());

  if (sbPlayer && sbPlayer.isActive) {
    var sbActual = Math.min(room.smallBlindAmount, sbPlayer.chips);
    sbPlayer.chips -= sbActual;
    room.gameState.bets[sbPlayer.id] = sbActual;
    room.gameState.roundBets[sbPlayer.id] = sbActual;
    room.gameState.handBets[sbPlayer.id] = (room.gameState.handBets[sbPlayer.id] || 0) + sbActual;
    sbPlayer.isSmallBlind = true;
  }

  if (bbPlayer && bbPlayer.isActive) {
    var bbActual = Math.min(room.bigBlindAmount, bbPlayer.chips);
    bbPlayer.chips -= bbActual;
    room.gameState.bets[bbPlayer.id] = bbActual;
    room.gameState.roundBets[bbPlayer.id] = bbActual;
    room.gameState.handBets[bbPlayer.id] = (room.gameState.handBets[bbPlayer.id] || 0) + bbActual;
    bbPlayer.isBigBlind = true;
  }

  omahaRecalculateSidePots(room);

  if (!hu) {
    var utgSeat = (room.dealerButton + 3) % totalPlayers;
    var utgPlayer = getPlayerBySeatIndex(room, utgSeat);
    if (utgPlayer) utgPlayer.isUTG = true;
  }

  room.gameState.currentBet = room.bigBlindAmount;
  room.gameState.minRaise = room.bigBlindAmount;

  omahaTransitionTo(room, roomId, io, 'PRE_FLOP_DEAL', rooms);
}

function omahaDoPreFlopDeal(room, roomId, io, rooms) {
  omahaDealPlayerCards(room);
  omahaTransitionTo(room, roomId, io, 'PRE_FLOP_BETTING', rooms);
}

function omahaDealPlayerCards(room) {
  var deck = room.gameState.deck;
  var playerCards = room.gameState.playerCards;
  var numCards = 4;
  var activePlayers = getActivePlayersSorted(room);
  if (activePlayers.length === 0) return;

  for (var round = 0; round < numCards; round++) {
    for (var i = 0; i < activePlayers.length; i++) {
      if (deck.length > 0) {
        playerCards[activePlayers[i].id].push(deck.pop());
      }
    }
  }
}

function omahaGetFirstActor(room) {
  var totalPlayers = room.players.length;
  var startSeat;

  if (room.gameState.phase === 'PRE_FLOP_BETTING') {
    if (isHeadsUp(room)) {
      startSeat = room.dealerButton % totalPlayers;
    } else {
      startSeat = (room.dealerButton + 3) % totalPlayers;
    }
  } else {
    startSeat = (room.dealerButton + 1) % totalPlayers;
  }

  var candidate = findNextActivePlayerClockwise(room, startSeat - 1);
  var maxLoops = totalPlayers;
  var loops = 0;

  while (candidate && isPlayerAllIn(candidate) && loops < maxLoops) {
    candidate = findNextActivePlayerClockwise(room, room.players.findIndex(function(p) { return p.id === candidate.id; }));
    loops++;
  }
  return candidate;
}

function omahaStartBettingRound(room, roomId, io, message, rooms) {
  var activePlayers = getActivePlayers(room);

  if (activePlayers.length <= 1) {
    omahaEarlyEndGame(room, roomId, io, rooms);
    return;
  }

  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    omahaFastForwardToShowdown(room, roomId, io, rooms);
    return;
  }

  room.gameState.playersActedThisRound = new Set();
  room.gameState.lastRaiserId = null;

  activePlayers.forEach(function(p) {
    room.gameState.roundBets[p.id] = room.gameState.bets[p.id] || 0;
    p.hasActed = false;
    if (isPlayerAllIn(p) && !room.gameState.playersActedThisRound.has(p.id)) {
      p.hasActed = true;
      room.gameState.playersActedThisRound.add(p.id);
    }
  });

  var firstActor = omahaGetFirstActor(room);
  if (!firstActor) {
    omahaEndBettingRound(room, roomId, io, rooms);
    return;
  }

  room.gameState.currentPlayer = firstActor.id;
  firstActor.isTurn = true;
  firstActor.hasActed = true;
  room.gameState.playersActedThisRound.add(firstActor.id);

  omahaSendUpdate(room, roomId, io, message + '，轮到 ' + firstActor.nickname + ' 行动');

  if (firstActor.isAI) {
    omahaScheduleAiAction(room, roomId, io, firstActor, rooms);
  }
}

function omahaMoveToNextPlayer(room, roomId, io, rooms) {
  var activePlayers = getActivePlayersSorted(room);

  if (activePlayers.length <= 1) {
    omahaEarlyEndGame(room, roomId, io, rooms);
    return;
  }

  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    omahaFastForwardToShowdown(room, roomId, io, rooms);
    return;
  }

  var currentId = room.gameState.currentPlayer;
  var currentIdx = activePlayers.findIndex(function(p) { return p.id === currentId; });
  if (currentIdx === -1) currentIdx = activePlayers.length - 1;

  var attempts = 0;
  while (attempts < activePlayers.length) {
    currentIdx = (currentIdx + 1) % activePlayers.length;
    var nextPlayer = activePlayers[currentIdx];

    if (omahaIsBettingRoundComplete(room)) {
      omahaEndBettingRound(room, roomId, io, rooms);
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

    omahaSendUpdate(room, roomId, io, '轮到 ' + nextPlayer.nickname + ' 行动');

    if (nextPlayer.isAI) {
      omahaScheduleAiAction(room, roomId, io, nextPlayer, rooms);
    }
    return;
  }

  omahaEndBettingRound(room, roomId, io, rooms);
}

function omahaIsBettingRoundComplete(room) {
  var activePlayers = getActivePlayers(room);
  if (activePlayers.length <= 1) return true;

  var canActPlayers = activePlayers.filter(function(p) { return p.chips > 0; });
  if (canActPlayers.length === 0) return true;

  activePlayers.forEach(function(p) {
    if (p.chips === 0 && !room.gameState.playersActedThisRound.has(p.id)) {
      room.gameState.playersActedThisRound.add(p.id);
    }
  });

  var allActed = canActPlayers.every(function(p) { return room.gameState.playersActedThisRound.has(p.id); });
  if (!allActed) return false;

  var allBetsMatch = canActPlayers.every(function(p) { return (room.gameState.roundBets[p.id] || 0) >= room.gameState.currentBet; });
  if (!allBetsMatch) return false;

  return true;
}

function omahaHandleFold(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  player.isActive = false;
  player.isTurn = false;
  room.gameState.playersActedThisRound.delete(playerId);
  omahaBroadcastAction(rooms, io, roomId, 'fold', playerId);

  var activePlayers = getActivePlayers(room);
  if (activePlayers.length <= 1) {
    omahaEarlyEndGame(room, roomId, io, rooms);
    return;
  }
  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) {
    omahaFastForwardToShowdown(room, roomId, io, rooms);
    return;
  }
  if (omahaIsBettingRoundComplete(room)) {
    omahaEndBettingRound(room, roomId, io, rooms);
    return;
  }

  var startSeatIndex = player.seat - 1;
  var nextPlayer = findNextActivePlayerClockwise(room, startSeatIndex);
  if (!nextPlayer) {
    omahaMoveToNextPlayer(room, roomId, io, rooms);
    return;
  }

  room.gameState.currentPlayer = nextPlayer.id;
  nextPlayer.isTurn = true;
  nextPlayer.hasActed = true;
  room.gameState.playersActedThisRound.add(nextPlayer.id);

  omahaSendUpdate(room, roomId, io, '轮到 ' + nextPlayer.nickname + ' 行动');

  if (nextPlayer.isAI) {
    omahaScheduleAiAction(room, roomId, io, nextPlayer, rooms);
  }
}

function omahaHandleCheck(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var myRoundBet = room.gameState.roundBets[playerId] || 0;
  if (room.gameState.currentBet > 0 && myRoundBet < room.gameState.currentBet) {
    omahaHandleCall(room, roomId, io, playerId, rooms);
    return;
  }

  player.isTurn = false;
  omahaBroadcastAction(rooms, io, roomId, 'check', playerId);
  omahaMoveToNextPlayer(room, roomId, io, rooms);
}

function omahaHandleCall(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var myRoundBet = room.gameState.roundBets[playerId] || 0;
  var callAmount = Math.max(0, room.gameState.currentBet - myRoundBet);

  if (callAmount <= 0) {
    omahaHandleCheck(room, roomId, io, playerId, rooms);
    return;
  }

  if (player.chips <= callAmount) {
    omahaHandleAllIn(room, roomId, io, playerId, rooms);
    return;
  }

  player.chips -= callAmount;
  room.gameState.bets[playerId] = (room.gameState.bets[playerId] || 0) + callAmount;
  room.gameState.roundBets[playerId] = room.gameState.currentBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + callAmount;
  if (!room.gameState.pots[0].eligiblePlayers.includes(playerId)) {
    room.gameState.pots[0].eligiblePlayers.push(playerId);
  }

  omahaRecalculateSidePots(room);

  player.isTurn = false;
  omahaBroadcastAction(rooms, io, roomId, 'call', playerId, callAmount);
  omahaMoveToNextPlayer(room, roomId, io, rooms);
}

function omahaHandleRaise(room, roomId, io, playerId, amount, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var currentRoundBet = room.gameState.roundBets[playerId] || 0;
  var raiseTotal = Math.max(amount, 0);
  var raiseIncrement = Math.max(0, raiseTotal - currentRoundBet);

  var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
  var potLimitInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, currentRoundBet);

  if (room.gameState.currentBet === 0) {
    var minBet = room.bigBlindAmount;
    if (raiseTotal < minBet && player.chips > raiseTotal) {
      omahaHandleCheck(room, roomId, io, playerId, rooms);
      return;
    }
  }

  if (raiseTotal <= room.gameState.currentBet) {
    omahaHandleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseTotal > potLimitInfo.maxRaise && player.chips > raiseIncrement) {
    raiseTotal = potLimitInfo.maxRaise;
    raiseIncrement = raiseTotal - currentRoundBet;
    console.log('[奥马哈] 底池限注：加注上限调整为 ' + raiseTotal);
  }

  if (raiseIncrement <= 0) {
    omahaHandleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseIncrement < room.gameState.minRaise && player.chips > raiseIncrement) {
    omahaHandleCall(room, roomId, io, playerId, rooms);
    return;
  }

  if (raiseIncrement >= room.gameState.minRaise) {
    room.gameState.minRaise = raiseIncrement;
  }

  if (player.chips <= raiseIncrement) {
    omahaHandleAllIn(room, roomId, io, playerId, rooms);
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

  omahaRecalculateSidePots(room);

  player.isTurn = false;
  omahaBroadcastAction(rooms, io, roomId, 'raise', playerId, raiseTotal);

  room.gameState.playersActedThisRound = new Set();
  room.gameState.playersActedThisRound.add(playerId);

  getActivePlayers(room).filter(function(p) { return p.id !== room.gameState.currentPlayer; }).forEach(function(p) {
    p.hasActed = false;
  });

  omahaMoveToNextPlayer(room, roomId, io, rooms);
}

function omahaHandleAllIn(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var allInAmount = player.chips;
  if (allInAmount <= 0) {
    omahaMoveToNextPlayer(room, roomId, io, rooms);
    return;
  }

  player.chips = 0;
  var oldRoundBet = room.gameState.roundBets[playerId] || 0;
  var newRoundBet = oldRoundBet + allInAmount;

  room.gameState.bets[playerId] = newRoundBet;
  room.gameState.roundBets[playerId] = newRoundBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + allInAmount;

  omahaRecalculateSidePots(room);

  if (newRoundBet > room.gameState.currentBet) {
    var raiseIncrement = newRoundBet - room.gameState.currentBet;
    var isFullRaise = raiseIncrement >= room.gameState.minRaise;

    room.gameState.currentBet = newRoundBet;

    if (isFullRaise) {
      room.gameState.lastRaiserId = playerId;
      room.gameState.minRaise = raiseIncrement;
      room.gameState.playersActedThisRound = new Set();
      room.gameState.playersActedThisRound.add(playerId);
      getActivePlayers(room).filter(function(p) { return p.id !== room.gameState.currentPlayer; }).forEach(function(p) {
        p.hasActed = false;
      });
    }
  }

  player.isTurn = false;
  player.hasActed = true;
  room.gameState.playersActedThisRound.add(playerId);
  omahaBroadcastAction(rooms, io, roomId, 'all-in', playerId, newRoundBet);

  omahaMoveToNextPlayer(room, roomId, io, rooms);
}

function omahaRecalculateSidePots(room) {
  var activePlayers = getActivePlayers(room);
  var allPlayersWithBets = room.players.filter(function(p) { return (room.gameState.handBets[p.id] || 0) > 0; });

  if (allPlayersWithBets.length === 0) {
    room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];
    return;
  }

  var playerBets = allPlayersWithBets.map(function(p) {
    return { id: p.id, bet: room.gameState.handBets[p.id] || 0, isActive: p.isActive };
  });

  playerBets.sort(function(a, b) { return a.bet - b.bet; });

  var newPots = [];
  var previousBet = 0;

  for (var i = 0; i < playerBets.length; i++) {
    var currentBet = playerBets[i].bet;
    if (currentBet > previousBet) {
      var increment = currentBet - previousBet;
      var eligiblePlayers = activePlayers
        .filter(function(p) { return (room.gameState.handBets[p.id] || 0) >= currentBet; })
        .map(function(p) { return p.id; });

      var layerAmount = 0;
      room.players.forEach(function(p) {
        var playerBet = room.gameState.handBets[p.id] || 0;
        if (playerBet >= currentBet) {
          layerAmount += increment;
        } else if (playerBet > previousBet) {
          layerAmount += playerBet - previousBet;
        }
      });

      if (layerAmount > 0) {
        newPots.push({ amount: layerAmount, eligiblePlayers: eligiblePlayers });
      }
      previousBet = currentBet;
    }
  }

  room.gameState.pots = newPots.length > 0 ? newPots : [{ amount: 0, eligiblePlayers: [] }];
}

function omahaEndBettingRound(room, roomId, io, rooms) {
  omahaRecalculateSidePots(room);

  room.players.forEach(function(player) {
    player.isTurn = false;
    room.gameState.bets[player.id] = 0;
    room.gameState.roundBets[player.id] = 0;
  });
  room.gameState.currentBet = 0;
  room.gameState.minRaise = room.bigBlindAmount;
  room.gameState.lastRaiserId = null;

  switch (room.gameState.phase) {
    case 'PRE_FLOP_BETTING':
      omahaTransitionTo(room, roomId, io, 'FLOP_DEAL', rooms);
      break;
    case 'FLOP_BETTING':
      omahaTransitionTo(room, roomId, io, 'TURN_DEAL', rooms);
      break;
    case 'TURN_BETTING':
      omahaTransitionTo(room, roomId, io, 'RIVER_DEAL', rooms);
      break;
    case 'RIVER_BETTING':
      omahaTransitionTo(room, roomId, io, 'SHOWDOWN', rooms);
      break;
  }
}

function omahaDealCommunityCards(room, count) {
  var deck = room.gameState.deck;
  var communityCards = room.gameState.communityCards;
  for (var i = 0; i < count && deck.length > 0; i++) {
    communityCards.push(deck.pop());
  }
}

function omahaDoFlopDeal(room, roomId, io, rooms) {
  omahaDealCommunityCards(room, 3);
  omahaTransitionTo(room, roomId, io, 'FLOP_BETTING', rooms);
}

function omahaDoTurnDeal(room, roomId, io, rooms) {
  omahaDealCommunityCards(room, 1);
  omahaTransitionTo(room, roomId, io, 'TURN_BETTING', rooms);
}

function omahaDoRiverDeal(room, roomId, io, rooms) {
  omahaDealCommunityCards(room, 1);
  omahaTransitionTo(room, roomId, io, 'RIVER_BETTING', rooms);
}

function omahaFastForwardToShowdown(room, roomId, io, rooms) {
  omahaSendUpdate(room, roomId, io, '所有玩家已all-in，自动发放剩余公共牌...');

  var cc = room.gameState.communityCards;
  if (cc.length < 3) omahaDealCommunityCards(room, 3 - cc.length);
  if (cc.length < 4) omahaDealCommunityCards(room, 1);
  if (cc.length < 5) omahaDealCommunityCards(room, 1);

  setTimeout(function() {
    omahaTransitionTo(room, roomId, io, 'SHOWDOWN', rooms);
  }, 1500);
}

function omahaEarlyEndGame(room, roomId, io, rooms) {
  var activePlayers = getActivePlayers(room);
  if (activePlayers.length === 0) return;
  var winner = activePlayers[0];
  var totalPot = 0;
  room.gameState.pots.forEach(function(pot) {
    totalPot += pot.amount;
    winner.chips += pot.amount;
  });

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];
  room.gameState.phase = 'HAND_END';
  room.gameState.showdownPlayerIds = [];

  omahaSendUpdate(room, roomId, io, winner.nickname + ' 获胜（其余玩家弃牌），赢得 ' + totalPot + ' 筹码！');

  room.players.forEach(function(p) {
    if (!p.isAI) io.to(p.id).emit('omahaAction', {
      type: 'winner',
      playerId: winner.id,
      nickname: winner.nickname,
      amount: totalPot,
      timestamp: Date.now(),
    });
  });

  setTimeout(function() {
    omahaDoHandEnd(room, roomId, io, rooms);
  }, 3000);
}

function omahaDoShowdown(room, roomId, io, rooms) {
  room.gameState.phase = 'SHOWDOWN';
  var activePlayers = getActivePlayers(room);
  room.gameState.showdownPlayerIds = activePlayers.map(function(p) { return p.id; });
  var results = [];

  room.gameState.pots.forEach(function(pot, potIndex) {
    if (pot.amount <= 0) return;
    var eligible = activePlayers.filter(function(p) { return pot.eligiblePlayers.includes(p.id); });
    if (eligible.length === 0) return;

    if (eligible.length === 1) {
      var potWinner = eligible[0];
      potWinner.chips += pot.amount;
      results.push({ potIndex: potIndex, winner: potWinner.nickname, amount: pot.amount, reason: '唯一存活' });
    } else {
      try {
        var showdownInput = eligible.map(function(p) {
          return {
            id: p.id,
            nickname: p.nickname,
            holeCards: room.gameState.playerCards[p.id] || [],
            isFolded: false,
          };
        });

        var sdResult = omahaPokerShowdown(showdownInput, room.gameState.communityCards);

        var shareAmount = Math.floor(pot.amount / sdResult.winners.length);
        var remainder = pot.amount - shareAmount * sdResult.winners.length;

        sdResult.winners.forEach(function(wid, idx) {
          var winnerPlayer = eligible.find(function(p) { return p.id === wid; });
          if (winnerPlayer) {
            var winAmt = shareAmount + (idx < remainder ? 1 : 0);
            winnerPlayer.chips += winAmt;
            var winnerHandInfo = sdResult.players.find(function(ep) { return ep.id === wid; });
            results.push({
              potIndex: potIndex,
              winner: winnerPlayer.nickname,
              amount: winAmt,
              hand: winnerHandInfo ? winnerHandInfo.handName : '',
              isTie: sdResult.isTie && sdResult.winners.length > 1,
            });
          }
        });
      } catch (err) {
        console.error('[奥马哈] 开牌判定错误:', err.message);
        var fallback = eligible[0];
        fallback.chips += pot.amount;
        results.push({ potIndex: potIndex, winner: fallback.nickname, amount: pot.amount, reason: '降级处理' });
      }
    }
  });

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];

  var totalWon = results.reduce(function(s, r) { return s + r.amount; }, 0);
  var resultMsg = results.map(function(r) {
    var msg = r.winner + ' 赢得 ' + r.amount + ' 筹码';
    if (r.hand) msg += '（' + r.hand + '）';
    if (r.isTie) msg += ' [平局]';
    return msg;
  }).join('；');

  omahaSendUpdate(room, roomId, io, '摊牌结束！' + resultMsg + '。总底池：' + totalWon);

  results.forEach(function(result) {
    room.players.forEach(function(p) {
      if (!p.isAI) io.to(p.id).emit('omahaAction', {
        type: 'winner',
        playerId: room.players.find(function(pl) { return pl.nickname === result.winner; }) ? room.players.find(function(pl) { return pl.nickname === result.winner; }).id : '',
        nickname: result.winner,
        amount: result.amount,
        hand: result.hand || '',
        isTie: result.isTie || false,
        timestamp: Date.now(),
      });
    });
  });

  setTimeout(function() {
    omahaTransitionTo(room, roomId, io, 'HAND_END', rooms);
  }, 4000);
}

function omahaDoHandEnd(room, roomId, io, rooms) {
  room.players = room.players.filter(function(player) { return player.isOnline !== false || player.isAI; });

  room.players.forEach(function(player) {
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
  });

  if (room.players.length > 0) {
    if (room.dealerButton === undefined) {
      room.dealerButton = 0;
    } else {
      room.dealerButton = (room.dealerButton + 1) % room.players.length;
    }
    room.players[room.dealerButton].isButton = true;
  }

  var currentCommunityCards = room.gameState.communityCards.slice();
  var currentPlayerCards = Object.assign({}, room.gameState.playerCards);
  var currentShowdownPlayerIds = room.gameState.showdownPlayerIds || [];

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

  room.players.forEach(function(p) {
    if (p.isAI) {
      room.gameState.playersConfirmedContinue.add(p.id);
    }
  });

  var humanPlayers = room.players.filter(function(p) { return !p.isAI; });
  if (humanPlayers.length <= 0) return;

  var allConfirmed = room.players.every(function(p) { return room.gameState.playersConfirmedContinue.has(p.id); });
  if (allConfirmed) {
    omahaNextHand(room, roomId, io, rooms);
  } else {
    omahaSendUpdate(room, roomId, io, '本局结束，请确认是否继续游戏');
  }
}

function omahaNextHand(room, roomId, io, rooms) {
  if (room.gameState.phase !== 'WAITING' && room.gameState.phase !== 'CONFIRM_CONTINUE') return;
  room.players.forEach(function(p) { if (!p.isAI) io.to(p.id).emit('omahaAction', { type: 'nextHand', timestamp: Date.now() }); });
  omahaStartGame(room, roomId, io, room.config, rooms);
}

function omahaResetGame(room, roomId, io) {
  room.dealerButton = undefined;
  room.initialChipsMap = {};
  room.extraChipsMap = {};
  var defaultChips = (room.config && room.config.initialChips) || 1000;
  room.players.forEach(function(player) {
    room.initialChipsMap[player.playerId] = defaultChips;
    player.chips = defaultChips;
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

  omahaSendUpdate(room, roomId, io, '游戏已重置');
}

function omahaSetPlayerChips(room, roomId, io, hostSocketId, data) {
  if (room.host !== hostSocketId) return;
  if (!data || !data.playerId || data.chips === undefined) return;
  var chips = Math.max(0, parseInt(data.chips) || 0);
  var target = room.players.find(function(p) { return p.playerId === data.playerId; });
  if (!target) return;

  if (!room.initialChipsMap) room.initialChipsMap = {};
  room.initialChipsMap[data.playerId] = chips;
  target.chips = chips;

  if (chips > 0) {
    target.isActive = true;
    target.isEliminated = false;
  }

  omahaSendUpdate(room, roomId, io, target.nickname + ' 的筹码已设为 ' + chips);
}

function omahaAddPlayerChips(room, roomId, io, hostSocketId, data) {
  if (room.host !== hostSocketId) return;
  if (!data || !data.playerId || data.amount === undefined) return;
  var amount = Math.max(0, parseInt(data.amount) || 0);
  if (amount <= 0) return;
  var target = room.players.find(function(p) { return p.playerId === data.playerId; });
  if (!target) return;

  if (!room.extraChipsMap) room.extraChipsMap = {};
  if (!room.extraChipsMap[data.playerId]) room.extraChipsMap[data.playerId] = 0;
  room.extraChipsMap[data.playerId] += amount;
  target.chips += amount;

  if (target.chips > 0) {
    target.isActive = true;
    target.isEliminated = false;
  }

  omahaSendUpdate(room, roomId, io, '房主给 ' + target.nickname + ' 追加了 ' + amount + ' 筹码');
}

function omahaSettleGame(room, roomId, io, hostSocketId) {
  if (room.host !== hostSocketId) return;

  var scoreboard = room.players.map(function(p) {
    var initialChips = room.initialChipsMap[p.playerId] !== undefined ? room.initialChipsMap[p.playerId] : ((room.config && room.config.initialChips) || 1000);
    var extraChips = (room.extraChipsMap && room.extraChipsMap[p.playerId]) || 0;
    var totalOriginal = initialChips + extraChips;
    var profit = p.chips - totalOriginal;
    return {
      playerId: p.playerId,
      nickname: p.nickname,
      currentChips: p.chips,
      profit: profit,
      totalOriginal: totalOriginal,
      isAI: p.isAI || false,
    };
  });

  scoreboard.sort(function(a, b) { return b.currentChips - a.currentChips; });

  room.gameState.phase = 'SETTLED';

  room.players.forEach(function(p) {
    if (p.isAI) return;
    io.to(p.id).emit('omahaAction', {
      type: 'settleGame',
      scoreboard: scoreboard,
      timestamp: Date.now(),
    });
  });

  omahaSendUpdate(room, roomId, io, '牌局已结算');
}

function omahaConfirmContinue(room, roomId, io, playerId, rooms) {
  if (room.gameState.phase !== 'CONFIRM_CONTINUE') return;

  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;

  room.gameState.playersConfirmedContinue.add(playerId);

  var allPlayersConfirmed = room.players.every(function(p) { return room.gameState.playersConfirmedContinue.has(p.id); });
  if (allPlayersConfirmed) {
    omahaNextHand(room, roomId, io, rooms);
  } else {
    var remainingPlayers = room.players.filter(function(p) { return !room.gameState.playersConfirmedContinue.has(p.id) && !p.isAI; }).map(function(p) { return p.nickname; });
    if (remainingPlayers.length > 0) {
      omahaSendUpdate(room, roomId, io, '等待 ' + remainingPlayers.join('、') + ' 确认继续游戏');
    }
  }
}

function omahaScheduleAiAction(room, roomId, io, aiPlayer, rooms) {
  var thinkTime = getThinkTime(aiPlayer.aiDifficulty || 'medium', aiPlayer.personality);
  setTimeout(function() {
    try {
      if (!room || room.gameState.currentPlayer !== aiPlayer.id) return;
      if (!aiPlayer.isActive || aiPlayer.chips === 0) return;

      var gameState = omahaBuildAiGameState(room, aiPlayer);
      var decision = makeDecision(aiPlayer.aiDifficulty || 'medium', gameState, aiPlayer.id);

      switch (decision.action) {
        case 'fold':
          omahaHandleFold(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'check':
          omahaHandleCheck(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'call':
          omahaHandleCall(room, roomId, io, aiPlayer.id, rooms);
          break;
        case 'raise':
          var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
          var potInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, room.gameState.roundBets[aiPlayer.id] || 0);
          var raiseAmount = decision.amount || potInfo.maxRaise;
          raiseAmount = Math.min(raiseAmount, potInfo.maxRaise);
          raiseAmount = Math.max(raiseAmount, room.gameState.currentBet + room.gameState.minRaise);
          omahaHandleRaise(room, roomId, io, aiPlayer.id, raiseAmount, rooms);
          break;
        case 'all-in':
          omahaHandleAllIn(room, roomId, io, aiPlayer.id, rooms);
          break;
        default:
          omahaHandleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    } catch (error) {
      console.error('[奥马哈AI] ' + aiPlayer.nickname + ' 行动异常:', error);
      if (aiPlayer.isActive && room.gameState.currentPlayer === aiPlayer.id) {
        omahaHandleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    }
  }, thinkTime);
}

function omahaBuildAiGameState(room, aiPlayer) {
  return {
    phase: room.gameState.phase,
    communityCards: room.gameState.communityCards || [],
    pot: room.gameState.pots.reduce(function(sum, pot) { return sum + pot.amount; }, 0),
    currentBet: room.gameState.currentBet || 0,
    minRaise: room.gameState.minRaise || room.bigBlindAmount || 20,
    bigBlind: room.bigBlindAmount || 20,
    smallBlind: room.smallBlindAmount || 10,
    dealerButton: room.dealerButton || 0,
    lastRaiserId: room.gameState.lastRaiserId || null,
    players: room.players.map(function(p) {
      return {
        id: p.id,
        nickname: p.nickname,
        chips: p.chips,
        isActive: p.isActive,
        isAI: p.isAI || false,
        currentBet: room.gameState.roundBets[p.id] || 0,
        isAllIn: p.chips === 0 && p.isActive,
        seat: p.seat,
      };
    }),
    myBet: room.gameState.roundBets[aiPlayer.id] || 0,
    myChips: aiPlayer.chips,
    myCards: room.gameState.playerCards[aiPlayer.id] || [],
    isOmaha: true,
  };
}
