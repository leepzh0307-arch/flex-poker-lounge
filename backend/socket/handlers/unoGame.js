const { generateUnoDeck, shuffleDeck, canPlayCard, getCardPoints, COLORS } = require('../../utils/unoDeck');

const STARTING_HAND = 7;
const AI_THINK_DELAY = 1000;

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

function getPlayerId(socketOrObj) {
  if (socketOrObj && socketOrObj.id) return socketOrObj.id;
  return null;
}

function unoGameHandler(socket, rooms, io) {
  socket.on('unoAction', function(data) {
    var action = data.action;
    var actionData = data.data;
    var roomId = findPlayerRoom(socket.id, rooms);
    if (!roomId) return;
    var room = rooms.get(roomId);
    if (!room || room.gameType !== 'uno') return;

    switch (action) {
      case 'startGame': handleStartGame(room, roomId, io); break;
      case 'playCard': handlePlayCard(room, roomId, io, socket, actionData); break;
      case 'drawCard': handleDrawCard(room, roomId, io, socket); break;
      case 'chooseColor': handleChooseColor(room, roomId, io, socket, actionData); break;
      case 'callUno': handleCallUno(room, roomId, io, socket); break;
      case 'catchUno': handleCatchUno(room, roomId, io, socket, actionData); break;
      case 'passTurn': handlePassTurn(room, roomId, io, socket); break;
      case 'resetGame': handleResetGame(room, roomId, io); break;
      case 'continueGame': handleContinueGame(room, roomId, io); break;
      case 'setPlayerChips': handleSetPlayerChips(room, roomId, io, socket, actionData); break;
      case 'addPlayerChips': handleAddPlayerChips(room, roomId, io, socket, actionData); break;
      default: break;
    }
  });
}

function findPlayerRoom(socketId, rooms) {
  for (var entry of rooms.entries()) {
    if (entry[1].players && entry[1].players.some(function(p) { return p.id === socketId; })) {
      return entry[0];
    }
  }
  return null;
}

function handleStartGame(room, roomId, io) {
  if (room.gameState.phase !== 'WAITING') return;
  clearAiTimers(room);

  var activePlayers = room.players.filter(function(p) { return p.isOnline !== false; });
  if (activePlayers.length < 2) return;

  var deck = shuffleDeck(generateUnoDeck());
  var playerCards = {};
  var playerOrder = [];

  activePlayers.forEach(function(player) {
    playerCards[player.id] = deck.splice(0, STARTING_HAND);
    playerOrder.push(player.id);
    player.isActive = true;
    player.calledUno = false;
  });

  var firstCard;
  do {
    firstCard = deck.shift();
    if (firstCard.type === 'wild') {
      deck.push(firstCard);
      var shuffled = shuffleDeck(deck);
      deck.length = 0;
      deck.push.apply(deck, shuffled);
    }
  } while (firstCard.type === 'wild');

  var startingColor = firstCard.color;
  var direction = 1;
  var skipNext = false;
  var drawCount = 0;

  if (firstCard.value === 'skip') {
    skipNext = true;
  } else if (firstCard.value === 'reverse') {
    direction = -1;
    if (activePlayers.length === 2) {
      skipNext = true;
    }
  } else if (firstCard.value === 'draw2') {
    drawCount = 2;
  }

  room.gameState = {
    phase: 'PLAYING',
    deck: deck,
    discardPile: [firstCard],
    playerCards: playerCards,
    playerOrder: playerOrder,
    currentPlayerIndex: 0,
    direction: direction,
    currentColor: startingColor,
    topCard: firstCard,
    drawCount: drawCount,
    hasDrawnThisTurn: false,
    pendingColorChoice: false,
    pendingWildDraw4: false,
    skipNext: skipNext,
    winner: null,
    actionLog: [],
  };

  if (skipNext) {
    advanceTurn(room);
    advanceTurn(room);
  }

  if (drawCount > 0) {
    var nextPlayerId = getNextPlayerId(room);
    drawCardsForPlayer(room, nextPlayerId, drawCount);
    advanceTurn(room);
    advanceTurn(room);
  }

  sendUnoUpdate(room, roomId, io);
  broadcastAction(roomId, io, 'gameStart', { message: '游戏开始！' });
  scheduleAiAction(room, roomId, io);
}

function handlePlayCard(room, roomId, io, socket, data) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  var playerId = getPlayerId(socket);
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;
  if (gs.pendingColorChoice) return;

  var cardId = data.cardId;
  var chosenColor = data.chosenColor;
  var hand = gs.playerCards[playerId];
  var cardIndex = hand.findIndex(function(c) { return c.id === cardId; });
  if (cardIndex === -1) return;

  var card = hand[cardIndex];
  if (!canPlayCard(card, gs.topCard, gs.currentColor)) return;

  hand.splice(cardIndex, 1);
  gs.discardPile.push(card);
  gs.topCard = card;
  gs.hasDrawnThisTurn = false;

  var player = room.players.find(function(p) { return p.id === playerId; });
  var nickname = player ? player.nickname : 'Unknown';

  if (card.type === 'wild') {
    if (chosenColor && COLORS.includes(chosenColor)) {
      gs.currentColor = chosenColor;
    } else {
      gs.pendingColorChoice = true;
      gs.pendingColorCard = card;
      sendUnoUpdate(room, roomId, io);
      return;
    }
  } else {
    gs.currentColor = card.color;
  }

  applyCardEffect(room, roomId, io, card, playerId, nickname);
}

function handleChooseColor(room, roomId, io, socket, data) {
  var gs = room.gameState;
  if (!gs.pendingColorChoice) return;
  var playerId = getPlayerId(socket);
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;

  var color = data.color;
  if (!COLORS.includes(color)) return;

  gs.currentColor = color;
  gs.pendingColorChoice = false;

  var card = gs.pendingColorCard;
  gs.pendingColorCard = null;

  var player = room.players.find(function(p) { return p.id === playerId; });
  var nickname = player ? player.nickname : 'Unknown';

  applyCardEffect(room, roomId, io, card, playerId, nickname);
}

function applyCardEffect(room, roomId, io, card, playerId, nickname) {
  var gs = room.gameState;

  var logEntry = { player: nickname, card: card, action: 'play' };
  gs.actionLog.push(logEntry);

  if (card.value === 'skip') {
    broadcastAction(roomId, io, 'cardEffect', { effect: 'skip', player: nickname });
    advanceTurn(room);
    advanceTurn(room);
  } else if (card.value === 'reverse') {
    gs.direction *= -1;
    broadcastAction(roomId, io, 'cardEffect', { effect: 'reverse', player: nickname });
    if (gs.playerOrder.length === 2) {
      advanceTurn(room);
      advanceTurn(room);
    } else {
      advanceTurn(room);
    }
  } else if (card.value === 'draw2') {
    var nextId = getNextPlayerId(room);
    drawCardsForPlayer(room, nextId, 2);
    var nextPlayer = room.players.find(function(p) { return p.id === nextId; });
    broadcastAction(roomId, io, 'cardEffect', { effect: 'draw2', player: nickname, target: nextPlayer ? nextPlayer.nickname : '' });
    advanceTurn(room);
    advanceTurn(room);
  } else if (card.value === 'wild_draw4') {
    var nextId2 = getNextPlayerId(room);
    drawCardsForPlayer(room, nextId2, 4);
    var nextPlayer2 = room.players.find(function(p) { return p.id === nextId2; });
    broadcastAction(roomId, io, 'cardEffect', { effect: 'wild_draw4', player: nickname, target: nextPlayer2 ? nextPlayer2.nickname : '' });
    advanceTurn(room);
    advanceTurn(room);
  } else {
    advanceTurn(room);
  }

  var hand = gs.playerCards[playerId];
  if (hand && hand.length === 0) {
    gs.phase = 'GAME_END';
    gs.winner = playerId;
    var winner = room.players.find(function(p) { return p.id === playerId; });
    broadcastAction(roomId, io, 'gameEnd', { winner: winner ? winner.nickname : 'Unknown' });
    sendUnoUpdate(room, roomId, io);
    return;
  }

  sendUnoUpdate(room, roomId, io);
  scheduleAiAction(room, roomId, io);
}

function handleDrawCard(room, roomId, io, socket) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (gs.pendingColorChoice) return;

  var playerId = getPlayerId(socket);
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;
  if (gs.hasDrawnThisTurn) return;

  ensureDeckHasCards(room);

  if (gs.deck.length === 0) return;

  var card = gs.deck.shift();
  gs.playerCards[playerId].push(card);
  gs.hasDrawnThisTurn = true;

  var player = room.players.find(function(p) { return p.id === playerId; });
  broadcastAction(roomId, io, 'drawCard', { player: player ? player.nickname : 'Unknown' });

  if (canPlayCard(card, gs.topCard, gs.currentColor)) {
    sendUnoUpdate(room, roomId, io);
    return;
  }

  advanceTurn(room);
  sendUnoUpdate(room, roomId, io);
  scheduleAiAction(room, roomId, io);
}

function handleCallUno(room, roomId, io, socket) {
  var gs = room.gameState;
  var playerId = getPlayerId(socket);
  var hand = gs.playerCards[playerId];
  if (!hand || hand.length > 2) return;

  var player = room.players.find(function(p) { return p.id === playerId; });
  if (player) {
    player.calledUno = true;
  }

  broadcastAction(roomId, io, 'callUno', { player: player ? player.nickname : 'Unknown' });
  sendUnoUpdate(room, roomId, io);
}

function handleCatchUno(room, roomId, io, socket, data) {
  var gs = room.gameState;
  var targetPlayerId = data.targetPlayerId;
  var targetPlayer = room.players.find(function(p) { return p.id === targetPlayerId; });
  if (!targetPlayer) return;

  var hand = gs.playerCards[targetPlayerId];
  if (!hand || hand.length !== 1 || targetPlayer.calledUno) return;

  drawCardsForPlayer(room, targetPlayerId, 2);
  targetPlayer.calledUno = false;

  var caller = room.players.find(function(p) { return p.id === getPlayerId(socket); });
  broadcastAction(roomId, io, 'catchUno', {
    caller: caller ? caller.nickname : 'Unknown',
    target: targetPlayer.nickname,
  });
  sendUnoUpdate(room, roomId, io);
}

function handlePassTurn(room, roomId, io, socket) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (!gs.hasDrawnThisTurn) return;

  var playerId = getPlayerId(socket);
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;

  advanceTurn(room);
  sendUnoUpdate(room, roomId, io);
  scheduleAiAction(room, roomId, io);
}

function handleResetGame(room, roomId, io) {
  clearAiTimers(room);
  room.gameState = {
    phase: 'WAITING',
    deck: [],
    discardPile: [],
    playerCards: {},
    playerOrder: [],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: null,
    topCard: null,
    drawCount: 0,
    hasDrawnThisTurn: false,
    pendingColorChoice: false,
    pendingWildDraw4: false,
    skipNext: false,
    winner: null,
    actionLog: [],
  };

  room.players.forEach(function(p) {
    p.isActive = true;
    p.calledUno = false;
  });

  sendUnoUpdate(room, roomId, io);
}

function handleContinueGame(room, roomId, io) {
  var gs = room.gameState;
  if (gs.phase !== 'GAME_END' || !gs.winner) return;

  var winnerId = gs.winner;
  var winner = room.players.find(function(p) { return p.id === winnerId; });

  var remainingPlayers = room.players.filter(function(p) { return p.id !== winnerId; });

  if (remainingPlayers.length < 2) {
    io.to(winnerId).emit('unoAction', { type: 'continueFailed', message: '剩余玩家不足，无法继续' });
    return;
  }

  if (room.host === winnerId && remainingPlayers.length > 0) {
    room.host = remainingPlayers[0].id;
    io.to(room.host).emit('unoAction', { type: 'becomeHost' });
  }

  io.to(winnerId).emit('unoAction', { type: 'removedFromGame', message: '你已胜出！剩余玩家继续对决' });

  room.players = remainingPlayers;

  room.players.forEach(function(p) {
    p.isActive = true;
    p.calledUno = false;
  });

  handleStartGame(room, roomId, io);

  broadcastAction(roomId, io, 'continueInfo', {
    message: (winner ? winner.nickname : '胜者') + ' 已胜出！剩余玩家继续对决',
  });
}

function handleSetPlayerChips(room, roomId, io, socket, data) {
  var playerId = data.playerId;
  var amount = data.amount;
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;
  player.chips = amount;
  sendUnoUpdate(room, roomId, io);
}

function handleAddPlayerChips(room, roomId, io, socket, data) {
  var playerId = data.playerId;
  var amount = data.amount;
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;
  player.chips += amount;
  sendUnoUpdate(room, roomId, io);
}

function getNextPlayerId(room) {
  var gs = room.gameState;
  var nextIndex = gs.currentPlayerIndex + gs.direction;
  if (nextIndex >= gs.playerOrder.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gs.playerOrder.length - 1;
  return gs.playerOrder[nextIndex];
}

function advanceTurn(room) {
  var gs = room.gameState;
  gs.hasDrawnThisTurn = false;

  var nextIndex = gs.currentPlayerIndex + gs.direction;
  if (nextIndex >= gs.playerOrder.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gs.playerOrder.length - 1;

  gs.currentPlayerIndex = nextIndex;

  var nextPlayerId = gs.playerOrder[gs.currentPlayerIndex];
  var nextPlayer = room.players.find(function(p) { return p.id === nextPlayerId; });
  if (nextPlayer) {
    nextPlayer.calledUno = false;
  }

  if (nextPlayer && nextPlayer.isOnline === false && !nextPlayer.isAI && gs.playerOrder.length > 1) {
    var maxSkips = gs.playerOrder.length;
    var skips = 0;
    while (nextPlayer.isOnline === false && !nextPlayer.isAI && skips < maxSkips) {
      var ni = gs.currentPlayerIndex + gs.direction;
      if (ni >= gs.playerOrder.length) ni = 0;
      if (ni < 0) ni = gs.playerOrder.length - 1;
      gs.currentPlayerIndex = ni;
      nextPlayerId = gs.playerOrder[gs.currentPlayerIndex];
      nextPlayer = room.players.find(function(p) { return p.id === nextPlayerId; });
      if (!nextPlayer) break;
      skips++;
    }
  }
}

function drawCardsForPlayer(room, playerId, count) {
  var gs = room.gameState;
  for (var i = 0; i < count; i++) {
    ensureDeckHasCards(room);
    if (gs.deck.length > 0) {
      gs.playerCards[playerId].push(gs.deck.shift());
    }
  }
}

function ensureDeckHasCards(room) {
  var gs = room.gameState;
  if (gs.deck.length === 0 && gs.discardPile.length > 1) {
    var topCard = gs.discardPile.pop();
    gs.deck = shuffleDeck(gs.discardPile);
    gs.discardPile = [topCard];
  }
}

function scheduleAiAction(room, roomId, io) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  var currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
  var player = room.players.find(function(p) { return p.id === currentPlayerId; });
  if (!player || !player.isAI) return;

  var delay = room.aiThinkDelay || AI_THINK_DELAY;

  var timerId = setTimeout(function() {
    var idx = room._aiTimerIds ? room._aiTimerIds.indexOf(timerId) : -1;
    if (idx !== -1) room._aiTimerIds.splice(idx, 1);
    if (gs.phase !== 'PLAYING') return;
    if (gs.playerOrder[gs.currentPlayerIndex] !== currentPlayerId) return;

    makeAiDecision(room, roomId, io, player);
  }, delay);
  trackAiTimer(room, timerId);
}

function makeAiDecision(room, roomId, io, aiPlayer) {
  var gs = room.gameState;
  var hand = gs.playerCards[aiPlayer.id];
  if (!hand || hand.length === 0) return;

  var playableCards = hand.filter(function(c) { return canPlayCard(c, gs.topCard, gs.currentColor); });

  if (playableCards.length > 0) {
    var priority = playableCards.sort(function(a, b) {
      if (a.type === 'wild' && b.type !== 'wild') return 1;
      if (b.type === 'wild' && a.type !== 'wild') return -1;
      if (a.type === 'action' && b.type === 'number') return -1;
      if (b.type === 'action' && a.type === 'number') return 1;
      return 0;
    });

    var chosenCard = priority[0];
    var chosenColor = null;

    if (chosenCard.type === 'wild') {
      var colorCounts = {};
      COLORS.forEach(function(c) { colorCounts[c] = 0; });
      hand.forEach(function(c) {
        if (c.color !== 'wild') colorCounts[c.color]++;
      });
      chosenColor = COLORS.reduce(function(a, b) { return colorCounts[a] >= colorCounts[b] ? a : b; });
    }

    if (hand.length === 2) {
      aiPlayer.calledUno = true;
      broadcastAction(roomId, io, 'callUno', { player: aiPlayer.nickname });
    }

    handlePlayCard(room, roomId, io, { id: aiPlayer.id }, { cardId: chosenCard.id, chosenColor: chosenColor });
  } else {
    handleDrawCard(room, roomId, io, { id: aiPlayer.id });

    var innerTimerId = setTimeout(function() {
      var idx = room._aiTimerIds ? room._aiTimerIds.indexOf(innerTimerId) : -1;
      if (idx !== -1) room._aiTimerIds.splice(idx, 1);
      if (gs.phase !== 'PLAYING') return;
      if (gs.playerOrder[gs.currentPlayerIndex] !== aiPlayer.id) return;

      var updatedHand = gs.playerCards[aiPlayer.id];
      var drawnCard = updatedHand[updatedHand.length - 1];
      if (drawnCard && canPlayCard(drawnCard, gs.topCard, gs.currentColor)) {
        var chosenColor2 = null;
        if (drawnCard.type === 'wild') {
          var colorCounts2 = {};
          COLORS.forEach(function(c) { colorCounts2[c] = 0; });
          updatedHand.forEach(function(c) {
            if (c.color !== 'wild') colorCounts2[c.color]++;
          });
          chosenColor2 = COLORS.reduce(function(a, b) { return colorCounts2[a] >= colorCounts2[b] ? a : b; });
        }
        handlePlayCard(room, roomId, io, { id: aiPlayer.id }, { cardId: drawnCard.id, chosenColor: chosenColor2 });
      } else {
        advanceTurn(room);
        sendUnoUpdate(room, roomId, io);
        scheduleAiAction(room, roomId, io);
      }
    }, AI_THINK_DELAY);
    trackAiTimer(room, innerTimerId);
  }
}

function sendUnoUpdate(room, roomId, io) {
  var gs = room.gameState;

  room.players.forEach(function(player) {
    var isCurrentPlayer = gs.playerOrder[gs.currentPlayerIndex] === player.id;
    var playerHand = gs.playerCards[player.id] || [];

    var otherPlayers = {};
    gs.playerOrder.forEach(function(pid) {
      if (pid !== player.id) {
        var otherHand = gs.playerCards[pid] || [];
        otherPlayers[pid] = {
          cardCount: otherHand.length,
          cards: otherHand.map(function(c) { return { hidden: true }; }),
          calledUno: room.players.find(function(p) { return p.id === pid; }) ? (room.players.find(function(p) { return p.id === pid; }).calledUno || false) : false,
        };
      }
    });

    var update = {
      phase: gs.phase,
      currentPlayerId: gs.playerOrder[gs.currentPlayerIndex],
      direction: gs.direction,
      currentColor: gs.currentColor,
      topCard: gs.topCard,
      discardPileCount: gs.discardPile.length,
      deckCount: gs.deck.length,
      myHand: playerHand,
      otherPlayers: otherPlayers,
      playerOrder: gs.playerOrder,
      hasDrawnThisTurn: gs.hasDrawnThisTurn && isCurrentPlayer,
      pendingColorChoice: gs.pendingColorChoice && isCurrentPlayer,
      winner: gs.winner,
      actionLog: gs.actionLog.slice(-20),
      players: room.players.map(function(p) {
        return {
          id: p.id,
          nickname: p.nickname,
          avatar: p.avatar,
          chips: p.chips,
          isAI: p.isAI,
          isOnline: p.isOnline !== false,
          calledUno: p.calledUno || false,
        };
      }),
      isMyTurn: isCurrentPlayer,
    };

    io.to(player.id).emit('unoUpdate', update);
  });
}

function broadcastAction(roomId, io, type, data) {
  var payload = Object.assign({ type: type, timestamp: Date.now() }, data || {});
  io.to(roomId).emit('unoAction', payload);
}

module.exports = unoGameHandler;
