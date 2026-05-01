const { generateDeck, shuffleDeck } = require('./deck');
const { makeDecision, getThinkTime } = require('./aiEngine');

function clearAiTimers(room) {
  if (room._aiTimerIds && room._aiTimerIds.length > 0) {
    room._aiTimerIds.forEach(function(id) { clearTimeout(id); });
    room._aiTimerIds = [];
  }
}

function trackAiTimer(room, timerId) {
  if (!room._aiTimerIds) room._aiTimerIds = [];
  room._aiTimerIds.push(timerId);
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

function recalculateSidePots(room) {
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

function dealCommunityCards(room, count) {
  var deck = room.gameState.deck;
  var communityCards = room.gameState.communityCards;
  for (var i = 0; i < count && deck.length > 0; i++) {
    communityCards.push(deck.pop());
  }
}

function PokerEngine(config) {
  this.numCards = config.numCards || 2;
  this.logPrefix = config.logPrefix || '[扑克]';
  this.eventName = config.eventName || 'gameUpdate';
  this.actionEventName = config.actionEventName || 'gameAction';
  this.showdownFn = config.showdownFn;
  this.validateRaiseFn = config.validateRaiseFn || null;
  this.onHandEndFn = config.onHandEndFn || null;
  this.onEliminationFn = config.onEliminationFn || null;
  this.onResetFn = config.onResetFn || null;
  this.buildAiStateExtraFn = config.buildAiStateExtraFn || null;
}

PokerEngine.prototype.clearAiTimers = clearAiTimers;
PokerEngine.prototype.trackAiTimer = trackAiTimer;

PokerEngine.prototype.startGame = function(room, roomId, io, config, rooms) {
  this.clearAiTimers(room);
  var self = this;
  room.players.forEach(function(p) {
    if (!p.isAI) io.to(p.id).emit(self.actionEventName, { type: 'startGame', timestamp: Date.now() });
  });

  if (config) {
    room.config = Object.assign({}, room.config || {}, config);
  }

  room.smallBlindAmount = (config && config.smallBlind) || 10;
  room.bigBlindAmount = (config && config.bigBlind) || (room.smallBlindAmount * 2);

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

  this.transitionTo(room, roomId, io, 'PRE_FLOP_BLINDS', rooms);
};

PokerEngine.prototype.transitionTo = function(room, roomId, io, nextPhase, rooms) {
  room.gameState.phase = nextPhase;
  console.log(this.logPrefix + ' 房间' + roomId + ' -> ' + nextPhase);

  switch (nextPhase) {
    case 'PRE_FLOP_BLINDS': this.doPreFlopBlinds(room, roomId, io, rooms); break;
    case 'PRE_FLOP_DEAL': this.doPreFlopDeal(room, roomId, io, rooms); break;
    case 'PRE_FLOP_BETTING': this.startBettingRound(room, roomId, io, '翻牌前下注开始', rooms); break;
    case 'FLOP_DEAL': this.doFlopDeal(room, roomId, io, rooms); break;
    case 'FLOP_BETTING': this.startBettingRound(room, roomId, io, '翻牌圈下注开始', rooms); break;
    case 'TURN_DEAL': this.doTurnDeal(room, roomId, io, rooms); break;
    case 'TURN_BETTING': this.startBettingRound(room, roomId, io, '转牌圈下注开始', rooms); break;
    case 'RIVER_DEAL': this.doRiverDeal(room, roomId, io, rooms); break;
    case 'RIVER_BETTING': this.startBettingRound(room, roomId, io, '河牌圈下注开始', rooms); break;
    case 'SHOWDOWN': this.doShowdown(room, roomId, io, rooms); break;
    case 'HAND_END': this.doHandEnd(room, roomId, io, rooms); break;
    case 'WAITING': this.sendUpdate(room, roomId, io, '等待房主开始下一局'); break;
  }
};

PokerEngine.prototype.doPreFlopBlinds = function(room, roomId, io, rooms) {
  var activePlayers = getActivePlayers(room);
  if (activePlayers.length < 1) {
    this.sendUpdate(room, roomId, io, '没有活跃玩家');
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

  recalculateSidePots(room);

  if (!hu) {
    var utgSeat = (room.dealerButton + 3) % totalPlayers;
    var utgPlayer = getPlayerBySeatIndex(room, utgSeat);
    if (utgPlayer) utgPlayer.isUTG = true;
  }

  room.gameState.currentBet = room.bigBlindAmount;
  room.gameState.minRaise = room.bigBlindAmount;

  this.transitionTo(room, roomId, io, 'PRE_FLOP_DEAL', rooms);
};

PokerEngine.prototype.doPreFlopDeal = function(room, roomId, io, rooms) {
  this.dealPlayerCards(room);
  this.transitionTo(room, roomId, io, 'PRE_FLOP_BETTING', rooms);
};

PokerEngine.prototype.dealPlayerCards = function(room) {
  var deck = room.gameState.deck;
  var playerCards = room.gameState.playerCards;
  var numCards = this.numCards;
  var activePlayers = getActivePlayersSorted(room);
  if (activePlayers.length === 0) return;

  for (var round = 0; round < numCards; round++) {
    for (var i = 0; i < activePlayers.length; i++) {
      if (deck.length > 0) {
        playerCards[activePlayers[i].id].push(deck.pop());
      }
    }
  }
};

PokerEngine.prototype.getFirstActor = function(room) {
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
};

PokerEngine.prototype.startBettingRound = function(room, roomId, io, message, rooms) {
  var self = this;
  var activePlayers = getActivePlayers(room);

  if (activePlayers.length <= 1) { this.earlyEndGame(room, roomId, io, rooms); return; }
  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) { this.fastForwardToShowdown(room, roomId, io, rooms); return; }

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

  var firstActor = this.getFirstActor(room);
  if (!firstActor) { this.endBettingRound(room, roomId, io, rooms); return; }

  room.gameState.currentPlayer = firstActor.id;
  firstActor.isTurn = true;
  firstActor.hasActed = true;
  room.gameState.playersActedThisRound.add(firstActor.id);

  this.sendUpdate(room, roomId, io, message + '，轮到 ' + firstActor.nickname + ' 行动');

  if (firstActor.isAI) {
    this.scheduleAiAction(room, roomId, io, firstActor, rooms);
  }
};

PokerEngine.prototype.moveToNextPlayer = function(room, roomId, io, rooms) {
  var activePlayers = getActivePlayersSorted(room);

  if (activePlayers.length <= 1) { this.earlyEndGame(room, roomId, io, rooms); return; }
  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) { this.fastForwardToShowdown(room, roomId, io, rooms); return; }
  if (this.isBettingRoundComplete(room)) { this.endBettingRound(room, roomId, io, rooms); return; }

  var currentId = room.gameState.currentPlayer;
  var currentIdx = activePlayers.findIndex(function(p) { return p.id === currentId; });

  if (currentIdx === -1) {
    var foldedPlayer = room.players.find(function(p) { return p.id === currentId; });
    if (foldedPlayer) {
      currentIdx = activePlayers.findIndex(function(p) { return p.seat > foldedPlayer.seat; });
      if (currentIdx === -1) currentIdx = activePlayers.length - 1;
    } else {
      currentIdx = activePlayers.length - 1;
    }
  }

  var attempts = 0;
  while (attempts < activePlayers.length) {
    currentIdx = (currentIdx + 1) % activePlayers.length;
    var nextPlayer = activePlayers[currentIdx];

    if (this.isBettingRoundComplete(room)) { this.endBettingRound(room, roomId, io, rooms); return; }

    if (isPlayerAllIn(nextPlayer)) {
      if (!room.gameState.playersActedThisRound.has(nextPlayer.id)) {
        nextPlayer.hasActed = true;
        room.gameState.playersActedThisRound.add(nextPlayer.id);
      }
      attempts++;
      continue;
    }

    if (room.gameState.playersActedThisRound.has(nextPlayer.id)) { attempts++; continue; }

    room.gameState.currentPlayer = nextPlayer.id;
    nextPlayer.isTurn = true;
    nextPlayer.hasActed = true;
    room.gameState.playersActedThisRound.add(nextPlayer.id);

    this.sendUpdate(room, roomId, io, '轮到 ' + nextPlayer.nickname + ' 行动');

    if (nextPlayer.isAI) { this.scheduleAiAction(room, roomId, io, nextPlayer, rooms); }
    return;
  }

  this.endBettingRound(room, roomId, io, rooms);
};

PokerEngine.prototype.isBettingRoundComplete = function(room) {
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
};

PokerEngine.prototype.handleFold = function(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  player.isActive = false;
  player.isTurn = false;
  room.gameState.playersActedThisRound.delete(playerId);
  this.broadcastAction(rooms, io, roomId, 'fold', playerId);

  var activePlayers = getActivePlayers(room);
  if (activePlayers.length <= 1) { this.earlyEndGame(room, roomId, io, rooms); return; }
  if (areAllActivePlayersAllIn(room) && !communityCardsComplete(room)) { this.fastForwardToShowdown(room, roomId, io, rooms); return; }
  if (this.isBettingRoundComplete(room)) { this.endBettingRound(room, roomId, io, rooms); return; }

  this.moveToNextPlayer(room, roomId, io, rooms);
};

PokerEngine.prototype.handleCheck = function(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var myRoundBet = room.gameState.roundBets[playerId] || 0;
  if (room.gameState.currentBet > 0 && myRoundBet < room.gameState.currentBet) {
    this.handleCall(room, roomId, io, playerId, rooms);
    return;
  }

  player.isTurn = false;
  this.broadcastAction(rooms, io, roomId, 'check', playerId);
  this.moveToNextPlayer(room, roomId, io, rooms);
};

PokerEngine.prototype.handleCall = function(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var myRoundBet = room.gameState.roundBets[playerId] || 0;
  var callAmount = Math.max(0, room.gameState.currentBet - myRoundBet);

  if (callAmount <= 0) { this.handleCheck(room, roomId, io, playerId, rooms); return; }
  if (player.chips <= callAmount) { this.handleAllIn(room, roomId, io, playerId, rooms); return; }

  player.chips -= callAmount;
  room.gameState.bets[playerId] = (room.gameState.bets[playerId] || 0) + callAmount;
  room.gameState.roundBets[playerId] = room.gameState.currentBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + callAmount;
  if (!room.gameState.pots[0].eligiblePlayers.includes(playerId)) {
    room.gameState.pots[0].eligiblePlayers.push(playerId);
  }

  recalculateSidePots(room);
  player.isTurn = false;
  this.broadcastAction(rooms, io, roomId, 'call', playerId, callAmount);
  this.moveToNextPlayer(room, roomId, io, rooms);
};

PokerEngine.prototype.handleRaise = function(room, roomId, io, playerId, amount, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var currentRoundBet = room.gameState.roundBets[playerId] || 0;
  var raiseTotal = Math.max(amount, 0);
  var raiseIncrement = Math.max(0, raiseTotal - currentRoundBet);

  if (this.validateRaiseFn) {
    var result = this.validateRaiseFn(room, player, raiseTotal, raiseIncrement);
    if (result.action === 'check') { this.handleCheck(room, roomId, io, playerId, rooms); return; }
    if (result.action === 'call') { this.handleCall(room, roomId, io, playerId, rooms); return; }
    if (result.adjustedTotal !== undefined) {
      raiseTotal = result.adjustedTotal;
      raiseIncrement = raiseTotal - currentRoundBet;
    }
  } else {
    if (room.gameState.currentBet === 0) {
      var minBet = room.bigBlindAmount;
      if (raiseTotal < minBet && player.chips > raiseTotal) { this.handleCheck(room, roomId, io, playerId, rooms); return; }
    }
    if (raiseTotal <= room.gameState.currentBet) { this.handleCall(room, roomId, io, playerId, rooms); return; }
    if (raiseIncrement <= 0) { this.handleCall(room, roomId, io, playerId, rooms); return; }
    if (raiseIncrement < room.gameState.minRaise && player.chips > raiseIncrement) { this.handleCall(room, roomId, io, playerId, rooms); return; }
  }

  if (raiseIncrement >= room.gameState.minRaise) {
    room.gameState.minRaise = raiseIncrement;
  }

  if (player.chips <= raiseIncrement) { this.handleAllIn(room, roomId, io, playerId, rooms); return; }

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
  this.broadcastAction(rooms, io, roomId, 'raise', playerId, raiseTotal);

  room.gameState.playersActedThisRound = new Set();
  room.gameState.playersActedThisRound.add(playerId);
  getActivePlayers(room).filter(function(p) { return p.id !== room.gameState.currentPlayer; }).forEach(function(p) { p.hasActed = false; });

  this.moveToNextPlayer(room, roomId, io, rooms);
};

PokerEngine.prototype.handleAllIn = function(room, roomId, io, playerId, rooms) {
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player || !player.isActive || room.gameState.currentPlayer !== playerId) return;

  var allInAmount = player.chips;
  if (allInAmount <= 0) { this.moveToNextPlayer(room, roomId, io, rooms); return; }

  player.chips = 0;
  var oldRoundBet = room.gameState.roundBets[playerId] || 0;
  var newRoundBet = oldRoundBet + allInAmount;

  room.gameState.bets[playerId] = newRoundBet;
  room.gameState.roundBets[playerId] = newRoundBet;
  room.gameState.handBets[playerId] = (room.gameState.handBets[playerId] || 0) + allInAmount;

  recalculateSidePots(room);

  if (newRoundBet > room.gameState.currentBet) {
    var raiseIncrement = newRoundBet - room.gameState.currentBet;
    var isFullRaise = raiseIncrement >= room.gameState.minRaise;
    room.gameState.currentBet = newRoundBet;

    if (isFullRaise) {
      room.gameState.lastRaiserId = playerId;
      room.gameState.minRaise = raiseIncrement;
      room.gameState.playersActedThisRound = new Set();
      room.gameState.playersActedThisRound.add(playerId);
      getActivePlayers(room).filter(function(p) { return p.id !== room.gameState.currentPlayer; }).forEach(function(p) { p.hasActed = false; });
    }
  }

  player.isTurn = false;
  player.hasActed = true;
  room.gameState.playersActedThisRound.add(playerId);
  this.broadcastAction(rooms, io, roomId, 'all-in', playerId, newRoundBet);
  this.moveToNextPlayer(room, roomId, io, rooms);
};

PokerEngine.prototype.endBettingRound = function(room, roomId, io, rooms) {
  recalculateSidePots(room);

  room.players.forEach(function(player) {
    player.isTurn = false;
    room.gameState.bets[player.id] = 0;
    room.gameState.roundBets[player.id] = 0;
  });
  room.gameState.currentBet = 0;
  room.gameState.minRaise = room.bigBlindAmount;
  room.gameState.lastRaiserId = null;

  switch (room.gameState.phase) {
    case 'PRE_FLOP_BETTING': this.transitionTo(room, roomId, io, 'FLOP_DEAL', rooms); break;
    case 'FLOP_BETTING': this.transitionTo(room, roomId, io, 'TURN_DEAL', rooms); break;
    case 'TURN_BETTING': this.transitionTo(room, roomId, io, 'RIVER_DEAL', rooms); break;
    case 'RIVER_BETTING': this.transitionTo(room, roomId, io, 'SHOWDOWN', rooms); break;
  }
};

PokerEngine.prototype.doFlopDeal = function(room, roomId, io, rooms) {
  dealCommunityCards(room, 3);
  this.transitionTo(room, roomId, io, 'FLOP_BETTING', rooms);
};

PokerEngine.prototype.doTurnDeal = function(room, roomId, io, rooms) {
  dealCommunityCards(room, 1);
  this.transitionTo(room, roomId, io, 'TURN_BETTING', rooms);
};

PokerEngine.prototype.doRiverDeal = function(room, roomId, io, rooms) {
  dealCommunityCards(room, 1);
  this.transitionTo(room, roomId, io, 'RIVER_BETTING', rooms);
};

PokerEngine.prototype.fastForwardToShowdown = function(room, roomId, io, rooms) {
  var self = this;
  this.sendUpdate(room, roomId, io, '所有玩家已all-in，自动发放剩余公共牌...');

  var cc = room.gameState.communityCards;
  if (cc.length < 3) dealCommunityCards(room, 3 - cc.length);
  if (cc.length < 4) dealCommunityCards(room, 1);
  if (cc.length < 5) dealCommunityCards(room, 1);

  setTimeout(function() {
    self.transitionTo(room, roomId, io, 'SHOWDOWN', rooms);
  }, 1500);
};

PokerEngine.prototype.earlyEndGame = function(room, roomId, io, rooms) {
  var self = this;
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

  if (this.onHandEndFn) { this.onHandEndFn(room, [winner.id]); }

  this.sendUpdate(room, roomId, io, winner.nickname + ' 获胜（其余玩家弃牌），赢得 ' + totalPot + ' 筹码！');

  room.players.forEach(function(p) {
    if (!p.isAI) io.to(p.id).emit(self.actionEventName, {
      type: 'winner', playerId: winner.id, nickname: winner.nickname, amount: totalPot, timestamp: Date.now(),
    });
  });

  setTimeout(function() {
    self.doHandEnd(room, roomId, io, rooms);
  }, 3000);
};

PokerEngine.prototype.doShowdown = function(room, roomId, io, rooms) {
  var self = this;
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
          return { id: p.id, nickname: p.nickname, holeCards: room.gameState.playerCards[p.id] || [], isFolded: false };
        });

        var sdResult = self.showdownFn(showdownInput, room.gameState.communityCards);

        var shareAmount = Math.floor(pot.amount / sdResult.winners.length);
        var remainder = pot.amount - shareAmount * sdResult.winners.length;

        sdResult.winners.forEach(function(wid, idx) {
          var winnerPlayer = eligible.find(function(p) { return p.id === wid; });
          if (winnerPlayer) {
            var winAmt = shareAmount + (idx < remainder ? 1 : 0);
            winnerPlayer.chips += winAmt;
            var winnerHandInfo = sdResult.players.find(function(ep) { return ep.id === wid; });
            results.push({
              potIndex: potIndex, winner: winnerPlayer.nickname, amount: winAmt,
              hand: winnerHandInfo ? winnerHandInfo.handName : '',
              isTie: sdResult.isTie && sdResult.winners.length > 1,
            });
          }
        });
      } catch (err) {
        console.error(self.logPrefix + ' 开牌判定错误:', err.message);
        var fallback = eligible[0];
        fallback.chips += pot.amount;
        results.push({ potIndex: potIndex, winner: fallback.nickname, amount: pot.amount, reason: '降级处理' });
      }
    }
  });

  room.gameState.pots = [{ amount: 0, eligiblePlayers: [] }];

  var showdownWinnerIds = [];
  results.forEach(function(r) {
    var wp = room.players.find(function(pl) { return pl.nickname === r.winner; });
    if (wp) showdownWinnerIds.push(wp.id);
  });
  if (this.onHandEndFn) { this.onHandEndFn(room, showdownWinnerIds); }

  var totalWon = results.reduce(function(s, r) { return s + r.amount; }, 0);
  var resultMsg = results.map(function(r) {
    var msg = r.winner + ' 赢得 ' + r.amount + ' 筹码';
    if (r.hand) msg += '（' + r.hand + '）';
    if (r.isTie) msg += ' [平局]';
    return msg;
  }).join('；');

  this.sendUpdate(room, roomId, io, '摊牌结束！' + resultMsg + '。总底池：' + totalWon);

  results.forEach(function(result) {
    room.players.forEach(function(p) {
      if (!p.isAI) io.to(p.id).emit(self.actionEventName, {
        type: 'winner',
        playerId: room.players.find(function(pl) { return pl.nickname === result.winner; }) ? room.players.find(function(pl) { return pl.nickname === result.winner; }).id : '',
        nickname: result.winner, amount: result.amount, hand: result.hand || '',
        isTie: result.isTie || false, timestamp: Date.now(),
      });
    });
  });

  setTimeout(function() {
    self.transitionTo(room, roomId, io, 'HAND_END', rooms);
  }, 4000);
};

PokerEngine.prototype.doHandEnd = function(room, roomId, io, rooms) {
  var self = this;
  room.players = room.players.filter(function(player) { return player.isOnline !== false || player.isAI; });

  room.players.forEach(function(player) {
    if (player.chips <= 0) {
      if (player.isActive && !player.isEliminated && self.onEliminationFn) {
        self.onEliminationFn(room, player.id);
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
    if (p.isAI) room.gameState.playersConfirmedContinue.add(p.id);
  });

  var humanPlayers = room.players.filter(function(p) { return !p.isAI; });
  if (humanPlayers.length <= 0) return;

  var allConfirmed = room.players.every(function(p) { return room.gameState.playersConfirmedContinue.has(p.id); });
  if (allConfirmed) {
    this.nextHand(room, roomId, io, rooms);
  } else {
    this.sendUpdate(room, roomId, io, '本局结束，请确认是否继续游戏');
  }
};

PokerEngine.prototype.nextHand = function(room, roomId, io, rooms) {
  if (room.gameState.phase !== 'WAITING' && room.gameState.phase !== 'CONFIRM_CONTINUE') return;
  var self = this;
  room.players.forEach(function(p) {
    if (!p.isAI) io.to(p.id).emit(self.actionEventName, { type: 'nextHand', timestamp: Date.now() });
  });
  this.startGame(room, roomId, io, room.config, rooms);
};

PokerEngine.prototype.resetGame = function(room, roomId, io) {
  this.clearAiTimers(room);
  if (this.onResetFn) { this.onResetFn(room); }
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

  this.sendUpdate(room, roomId, io, '游戏已重置');
};

PokerEngine.prototype.handleSetPlayerChips = function(room, roomId, io, hostSocketId, data) {
  if (room.host !== hostSocketId) return;
  if (!data || !data.playerId || data.chips === undefined) return;
  var chips = Math.max(0, parseInt(data.chips) || 0);
  var target = room.players.find(function(p) { return p.playerId === data.playerId; });
  if (!target) return;

  if (!room.initialChipsMap) room.initialChipsMap = {};
  room.initialChipsMap[data.playerId] = chips;
  target.chips = chips;

  if (chips > 0) { target.isActive = true; target.isEliminated = false; }

  this.sendUpdate(room, roomId, io, target.nickname + ' 的筹码已设为 ' + chips);
};

PokerEngine.prototype.handleAddPlayerChips = function(room, roomId, io, hostSocketId, data) {
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

  if (target.chips > 0) { target.isActive = true; target.isEliminated = false; }

  this.sendUpdate(room, roomId, io, '房主给 ' + target.nickname + ' 追加了 ' + amount + ' 筹码');
};

PokerEngine.prototype.handleSettleGame = function(room, roomId, io, hostSocketId) {
  if (room.host !== hostSocketId) return;
  var self = this;

  if (!room.initialChipsMap) room.initialChipsMap = {};
  if (!room.extraChipsMap) room.extraChipsMap = {};

  var scoreboard = room.players.map(function(p) {
    var initialChips = room.initialChipsMap[p.playerId] !== undefined
      ? room.initialChipsMap[p.playerId]
      : ((room.config && room.config.initialChips) || 1000);
    var extraChips = (room.extraChipsMap && room.extraChipsMap[p.playerId]) || 0;
    var totalOriginal = initialChips + extraChips;
    var profit = p.chips - totalOriginal;
    return {
      playerId: p.playerId, nickname: p.nickname, currentChips: p.chips,
      profit: profit, totalOriginal: totalOriginal, isAI: p.isAI || false,
    };
  });

  scoreboard.sort(function(a, b) { return b.currentChips - a.currentChips; });
  room.gameState.phase = 'SETTLED';

  room.players.forEach(function(p) {
    if (p.isAI) return;
    io.to(p.id).emit(self.actionEventName, {
      type: 'settleGame', scoreboard: scoreboard, timestamp: Date.now(),
    });
  });

  this.sendUpdate(room, roomId, io, '牌局已结算');
};

PokerEngine.prototype.handleConfirmContinue = function(room, roomId, io, playerId, rooms) {
  if (room.gameState.phase !== 'CONFIRM_CONTINUE') return;
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;

  room.gameState.playersConfirmedContinue.add(playerId);

  var allPlayersConfirmed = room.players.every(function(p) { return room.gameState.playersConfirmedContinue.has(p.id); });
  if (allPlayersConfirmed) {
    this.nextHand(room, roomId, io, rooms);
  } else {
    var remainingPlayers = room.players.filter(function(p) {
      return !room.gameState.playersConfirmedContinue.has(p.id) && !p.isAI;
    }).map(function(p) { return p.nickname; });
    if (remainingPlayers.length > 0) {
      this.sendUpdate(room, roomId, io, '等待 ' + remainingPlayers.join('、') + ' 确认继续游戏');
    }
  }
};

PokerEngine.prototype.scheduleAiAction = function(room, roomId, io, aiPlayer, rooms) {
  var self = this;
  var thinkTime = getThinkTime(aiPlayer.aiDifficulty || 'medium', aiPlayer.personality);
  var timerId = setTimeout(function() {
    var idx = room._aiTimerIds ? room._aiTimerIds.indexOf(timerId) : -1;
    if (idx !== -1) room._aiTimerIds.splice(idx, 1);
    try {
      if (!room || room.gameState.currentPlayer !== aiPlayer.id) return;
      if (!aiPlayer.isActive || aiPlayer.chips === 0) {
        if (aiPlayer.isActive && aiPlayer.chips === 0) { self.moveToNextPlayer(room, roomId, io, rooms); }
        return;
      }

      var gameState = self.buildAiGameState(room, aiPlayer);
      var decision = makeDecision(aiPlayer.aiDifficulty || 'medium', gameState, aiPlayer.id);

      switch (decision.action) {
        case 'fold': self.handleFold(room, roomId, io, aiPlayer.id, rooms); break;
        case 'check': self.handleCheck(room, roomId, io, aiPlayer.id, rooms); break;
        case 'call': self.handleCall(room, roomId, io, aiPlayer.id, rooms); break;
        case 'raise': self.handleRaise(room, roomId, io, aiPlayer.id, decision.amount, rooms); break;
        case 'all-in': self.handleAllIn(room, roomId, io, aiPlayer.id, rooms); break;
        default: self.handleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    } catch (error) {
      console.error(self.logPrefix + ' AI ' + aiPlayer.nickname + ' 行动异常:', error);
      if (aiPlayer.isActive && room.gameState.currentPlayer === aiPlayer.id) {
        self.handleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    }
  }, thinkTime);
  trackAiTimer(room, timerId);

  var safetyTimerId = setTimeout(function() {
    var sIdx = room._aiTimerIds ? room._aiTimerIds.indexOf(safetyTimerId) : -1;
    if (sIdx !== -1) room._aiTimerIds.splice(sIdx, 1);
    if (room && room.gameState.currentPlayer === aiPlayer.id && aiPlayer.isActive) {
      console.warn(self.logPrefix + ' AI安全超时：强制 ' + aiPlayer.nickname + ' 弃牌');
      self.handleFold(room, roomId, io, aiPlayer.id, rooms);
    }
  }, Math.max(thinkTime + 5000, 10000));
  trackAiTimer(room, safetyTimerId);
};

PokerEngine.prototype.buildAiGameState = function(room, aiPlayer) {
  var state = {
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
        id: p.id, nickname: p.nickname, chips: p.chips, isActive: p.isActive,
        isAI: p.isAI || false, currentBet: room.gameState.roundBets[p.id] || 0,
        isAllIn: p.chips === 0 && p.isActive, seat: p.seat,
      };
    }),
    myBet: room.gameState.roundBets[aiPlayer.id] || 0,
    myChips: aiPlayer.chips,
    myCards: room.gameState.playerCards[aiPlayer.id] || [],
  };
  if (this.buildAiStateExtraFn) { Object.assign(state, this.buildAiStateExtraFn()); }
  return state;
};

PokerEngine.prototype.sendUpdate = function(room, roomId, io, additionalMessage) {
  throw new Error('PokerEngine.sendUpdate 必须由子类实现');
};

PokerEngine.prototype.broadcastAction = function(rooms, io, roomId, actionType, playerId, amount) {
  throw new Error('PokerEngine.broadcastAction 必须由子类实现');
};

module.exports = { PokerEngine, getActivePlayers, getActivePlayersSorted, isHeadsUp, isPlayerAllIn, areAllActivePlayersAllIn, communityCardsComplete, recalculateSidePots, clearAiTimers, trackAiTimer, findNextActivePlayerClockwise, getPlayerBySeatIndex, dealCommunityCards };
