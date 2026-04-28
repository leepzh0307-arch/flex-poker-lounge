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

function unoGameHandler(socket, rooms, io) {
  socket.on('unoAction', ({ action, data }) => {
    const roomId = findPlayerRoom(socket.id, rooms);
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || room.gameType !== 'uno') return;

    switch (action) {
      case 'startGame': handleStartGame(room, roomId, io); break;
      case 'playCard': handlePlayCard(room, roomId, io, socket, data); break;
      case 'drawCard': handleDrawCard(room, roomId, io, socket); break;
      case 'chooseColor': handleChooseColor(room, roomId, io, socket, data); break;
      case 'callUno': handleCallUno(room, roomId, io, socket); break;
      case 'catchUno': handleCatchUno(room, roomId, io, socket, data); break;
      case 'passTurn': handlePassTurn(room, roomId, io, socket); break;
      case 'resetGame': handleResetGame(room, roomId, io); break;
      case 'continueGame': handleContinueGame(room, roomId, io); break;
      case 'setPlayerChips': handleSetPlayerChips(room, roomId, io, socket, data); break;
      case 'addPlayerChips': handleAddPlayerChips(room, roomId, io, socket, data); break;
      default: break;
    }
  });
}

function findPlayerRoom(socketId, rooms) {
  for (const [roomId, room] of rooms) {
    if (room.players && room.players.some(p => p.id === socketId)) {
      return roomId;
    }
  }
  return null;
}

function handleStartGame(room, roomId, io) {
  if (room.gameState.phase !== 'WAITING') return;
  clearAiTimers(room);

  const activePlayers = room.players.filter(p => p.isOnline !== false);
  if (activePlayers.length < 2) return;

  const deck = shuffleDeck(generateUnoDeck());
  const playerCards = {};
  const playerOrder = [];

  activePlayers.forEach(player => {
    playerCards[player.id] = deck.splice(0, STARTING_HAND);
    playerOrder.push(player.id);
    player.isActive = true;
    player.calledUno = false;
  });

  let firstCard;
  do {
    firstCard = deck.shift();
    if (firstCard.type === 'wild') {
      deck.push(firstCard);
      const shuffled = shuffleDeck(deck);
      deck.length = 0;
      deck.push(...shuffled);
    }
  } while (firstCard.type === 'wild');

  let startingColor = firstCard.color;
  let direction = 1;
  let skipNext = false;
  let drawCount = 0;

  if (firstCard.value === 'skip') {
    skipNext = true;
  } else if (firstCard.value === 'reverse') {
    direction = -1;
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
  }

  if (drawCount > 0) {
    const nextPlayerId = room.gameState.playerOrder[room.gameState.currentPlayerIndex];
    drawCardsForPlayer(room, nextPlayerId, drawCount);
    advanceTurn(room);
  }

  sendUnoUpdate(room, roomId, io);
  broadcastAction(roomId, io, 'gameStart', { message: '游戏开始！' });
  scheduleAiAction(room, roomId, io);
}

function handlePlayCard(room, roomId, io, socket, data) {
  const gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  const playerId = socket.id;
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;
  if (gs.pendingColorChoice) return;

  const { cardId, chosenColor } = data;
  const hand = gs.playerCards[playerId];
  const cardIndex = hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return;

  const card = hand[cardIndex];
  if (!canPlayCard(card, gs.topCard, gs.currentColor)) return;

  hand.splice(cardIndex, 1);
  gs.discardPile.push(card);
  gs.topCard = card;
  gs.hasDrawnThisTurn = false;

  const player = room.players.find(p => p.id === playerId);
  const nickname = player ? player.nickname : 'Unknown';

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
  const gs = room.gameState;
  if (!gs.pendingColorChoice) return;
  if (gs.playerOrder[gs.currentPlayerIndex] !== socket.id) return;

  const { color } = data;
  if (!COLORS.includes(color)) return;

  gs.currentColor = color;
  gs.pendingColorChoice = false;

  const card = gs.pendingColorCard;
  gs.pendingColorCard = null;

  const player = room.players.find(p => p.id === socket.id);
  const nickname = player ? player.nickname : 'Unknown';

  applyCardEffect(room, roomId, io, card, socket.id, nickname);
}

function applyCardEffect(room, roomId, io, card, playerId, nickname) {
  const gs = room.gameState;

  const logEntry = { player: nickname, card: card, action: 'play' };
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
    const nextId = getNextPlayerId(room);
    drawCardsForPlayer(room, nextId, 2);
    const nextPlayer = room.players.find(p => p.id === nextId);
    broadcastAction(roomId, io, 'cardEffect', { effect: 'draw2', player: nickname, target: nextPlayer ? nextPlayer.nickname : '' });
    advanceTurn(room);
    advanceTurn(room);
  } else if (card.value === 'wild_draw4') {
    const nextId = getNextPlayerId(room);
    drawCardsForPlayer(room, nextId, 4);
    const nextPlayer = room.players.find(p => p.id === nextId);
    broadcastAction(roomId, io, 'cardEffect', { effect: 'wild_draw4', player: nickname, target: nextPlayer ? nextPlayer.nickname : '' });
    advanceTurn(room);
    advanceTurn(room);
  } else {
    advanceTurn(room);
  }

  const hand = gs.playerCards[playerId];
  if (hand && hand.length === 0) {
    gs.phase = 'GAME_END';
    gs.winner = playerId;
    const winner = room.players.find(p => p.id === playerId);
    broadcastAction(roomId, io, 'gameEnd', { winner: winner ? winner.nickname : 'Unknown' });
    sendUnoUpdate(room, roomId, io);
    return;
  }

  if (hand && hand.length === 1 && !room.players.find(p => p.id === playerId).calledUno) {
    // Player has 1 card and hasn't called UNO - they can be caught
  }

  sendUnoUpdate(room, roomId, io);
  scheduleAiAction(room, roomId, io);
}

function handleDrawCard(room, roomId, io, socket) {
  const gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (gs.pendingColorChoice) return;

  const playerId = socket.id;
  if (gs.playerOrder[gs.currentPlayerIndex] !== playerId) return;
  if (gs.hasDrawnThisTurn) return;

  ensureDeckHasCards(room);

  if (gs.deck.length === 0) return;

  const card = gs.deck.shift();
  gs.playerCards[playerId].push(card);
  gs.hasDrawnThisTurn = true;

  const player = room.players.find(p => p.id === playerId);
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
  const gs = room.gameState;
  const playerId = socket.id;
  const hand = gs.playerCards[playerId];
  if (!hand || hand.length > 2) return;

  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.calledUno = true;
  }

  broadcastAction(roomId, io, 'callUno', { player: player ? player.nickname : 'Unknown' });
  sendUnoUpdate(room, roomId, io);
}

function handleCatchUno(room, roomId, io, socket, data) {
  const gs = room.gameState;
  const { targetPlayerId } = data;
  const targetPlayer = room.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return;

  const hand = gs.playerCards[targetPlayerId];
  if (!hand || hand.length !== 1 || targetPlayer.calledUno) return;

  drawCardsForPlayer(room, targetPlayerId, 2);
  targetPlayer.calledUno = false;

  const caller = room.players.find(p => p.id === socket.id);
  broadcastAction(roomId, io, 'catchUno', {
    caller: caller ? caller.nickname : 'Unknown',
    target: targetPlayer.nickname,
  });
  sendUnoUpdate(room, roomId, io);
}

function handlePassTurn(room, roomId, io, socket) {
  const gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (!gs.hasDrawnThisTurn) return;

  const playerId = socket.id;
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

  room.players.forEach(p => {
    p.isActive = true;
    p.calledUno = false;
  });

  sendUnoUpdate(room, roomId, io);
}

function handleContinueGame(room, roomId, io) {
  const gs = room.gameState;
  if (gs.phase !== 'GAME_END' || !gs.winner) return;

  const winnerId = gs.winner;
  const winner = room.players.find(p => p.id === winnerId);

  const remainingPlayers = room.players.filter(p => p.id !== winnerId);

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

  room.players.forEach(p => {
    p.isActive = true;
    p.calledUno = false;
  });

  handleStartGame(room, roomId, io);

  broadcastAction(roomId, io, 'continueInfo', {
    message: (winner ? winner.nickname : '胜者') + ' 已胜出！剩余玩家继续对决',
  });
}

function handleSetPlayerChips(room, roomId, io, socket, data) {
  const { playerId, amount } = data;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  player.chips = amount;
  sendUnoUpdate(room, roomId, io);
}

function handleAddPlayerChips(room, roomId, io, socket, data) {
  const { playerId, amount } = data;
  const player = room.players.find(p => p.id === playerId);
  if (!player) return;
  player.chips += amount;
  sendUnoUpdate(room, roomId, io);
}

function getNextPlayerId(room) {
  const gs = room.gameState;
  let nextIndex = gs.currentPlayerIndex + gs.direction;
  if (nextIndex >= gs.playerOrder.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gs.playerOrder.length - 1;
  return gs.playerOrder[nextIndex];
}

function advanceTurn(room) {
  const gs = room.gameState;
  gs.hasDrawnThisTurn = false;

  let nextIndex = gs.currentPlayerIndex + gs.direction;
  if (nextIndex >= gs.playerOrder.length) nextIndex = 0;
  if (nextIndex < 0) nextIndex = gs.playerOrder.length - 1;

  gs.currentPlayerIndex = nextIndex;

  const nextPlayerId = gs.playerOrder[gs.currentPlayerIndex];
  const nextPlayer = room.players.find(p => p.id === nextPlayerId);
  if (nextPlayer) {
    nextPlayer.calledUno = false;
  }
}

function drawCardsForPlayer(room, playerId, count) {
  const gs = room.gameState;
  for (let i = 0; i < count; i++) {
    ensureDeckHasCards(room);
    if (gs.deck.length > 0) {
      gs.playerCards[playerId].push(gs.deck.shift());
    }
  }
}

function ensureDeckHasCards(room) {
  const gs = room.gameState;
  if (gs.deck.length === 0 && gs.discardPile.length > 1) {
    const topCard = gs.discardPile.pop();
    gs.deck = shuffleDeck(gs.discardPile);
    gs.discardPile = [topCard];
  }
}

function scheduleAiAction(room, roomId, io) {
  const gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  const currentPlayerId = gs.playerOrder[gs.currentPlayerIndex];
  const player = room.players.find(p => p.id === currentPlayerId);
  if (!player || !player.isAI) return;

  const delay = room.aiThinkDelay || AI_THINK_DELAY;

  const timerId = setTimeout(() => {
    const idx = room._aiTimerIds ? room._aiTimerIds.indexOf(timerId) : -1;
    if (idx !== -1) room._aiTimerIds.splice(idx, 1);
    if (gs.phase !== 'PLAYING') return;
    if (gs.playerOrder[gs.currentPlayerIndex] !== currentPlayerId) return;

    makeAiDecision(room, roomId, io, player);
  }, delay);
  trackAiTimer(room, timerId);
}

function makeAiDecision(room, roomId, io, aiPlayer) {
  const gs = room.gameState;
  const hand = gs.playerCards[aiPlayer.id];
  if (!hand || hand.length === 0) return;

  const playableCards = hand.filter(c => canPlayCard(c, gs.topCard, gs.currentColor));

  if (playableCards.length > 0) {
    const priority = playableCards.sort((a, b) => {
      if (a.type === 'wild' && b.type !== 'wild') return 1;
      if (b.type === 'wild' && a.type !== 'wild') return -1;
      if (a.type === 'action' && b.type === 'number') return -1;
      if (b.type === 'action' && a.type === 'number') return 1;
      return 0;
    });

    const chosenCard = priority[0];
    let chosenColor = null;

    if (chosenCard.type === 'wild') {
      const colorCounts = {};
      COLORS.forEach(c => colorCounts[c] = 0);
      hand.forEach(c => {
        if (c.color !== 'wild') colorCounts[c.color]++;
      });
      chosenColor = COLORS.reduce((a, b) => colorCounts[a] >= colorCounts[b] ? a : b);
    }

    if (hand.length === 2) {
      aiPlayer.calledUno = true;
      broadcastAction(roomId, io, 'callUno', { player: aiPlayer.nickname });
    }

    handlePlayCard(room, roomId, io, { id: aiPlayer.id }, { cardId: chosenCard.id, chosenColor });
  } else {
    handleDrawCard(room, roomId, io, { id: aiPlayer.id });

    const innerTimerId = setTimeout(() => {
      const idx = room._aiTimerIds ? room._aiTimerIds.indexOf(innerTimerId) : -1;
      if (idx !== -1) room._aiTimerIds.splice(idx, 1);
      if (gs.phase !== 'PLAYING') return;
      if (gs.playerOrder[gs.currentPlayerIndex] !== aiPlayer.id) return;

      const updatedHand = gs.playerCards[aiPlayer.id];
      const drawnCard = updatedHand[updatedHand.length - 1];
      if (drawnCard && canPlayCard(drawnCard, gs.topCard, gs.currentColor)) {
        let chosenColor = null;
        if (drawnCard.type === 'wild') {
          const colorCounts = {};
          COLORS.forEach(c => colorCounts[c] = 0);
          updatedHand.forEach(c => {
            if (c.color !== 'wild') colorCounts[c.color]++;
          });
          chosenColor = COLORS.reduce((a, b) => colorCounts[a] >= colorCounts[b] ? a : b);
        }
        handlePlayCard(room, roomId, io, { id: aiPlayer.id }, { cardId: drawnCard.id, chosenColor });
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
  const gs = room.gameState;

  room.players.forEach(player => {
    const isCurrentPlayer = gs.playerOrder[gs.currentPlayerIndex] === player.id;
    const playerHand = gs.playerCards[player.id] || [];

    const otherPlayers = {};
    gs.playerOrder.forEach(pid => {
      if (pid !== player.id) {
        const otherHand = gs.playerCards[pid] || [];
        otherPlayers[pid] = {
          cardCount: otherHand.length,
          cards: otherHand.map(c => ({ hidden: true })),
          calledUno: room.players.find(p => p.id === pid)?.calledUno || false,
        };
      }
    });

    const update = {
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
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        chips: p.chips,
        isAI: p.isAI,
        isOnline: p.isOnline !== false,
        calledUno: p.calledUno || false,
      })),
      isMyTurn: isCurrentPlayer,
    };

    io.to(player.id).emit('unoUpdate', update);
  });
}

function broadcastAction(roomId, io, type, data) {
  io.to(roomId).emit('unoAction', { type, ...data, timestamp: Date.now() });
}

module.exports = unoGameHandler;
