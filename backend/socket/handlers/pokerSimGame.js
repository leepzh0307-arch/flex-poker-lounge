function generateRoomId() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = '';
  for (var i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

var SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
var RANKS = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];

function createDeck(includeJoker) {
  var deck = [];
  SUITS.forEach(function (suit) {
    RANKS.forEach(function (rank) {
      deck.push({ suit: suit, rank: rank });
    });
  });
  if (includeJoker) {
    deck.push({ suit: 'joker', rank: 'red' });
    deck.push({ suit: 'joker', rank: 'black' });
  }
  return shuffleDeck(deck);
}

function shuffleDeck(deck) {
  var arr = deck.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

function sendSimUpdate(roomId, io, room) {
  if (!room || !room.gameState) return;

  var gs = room.gameState;

  room.players.forEach(function (p) {
    if (p.isAI) return;

    var playerCardsToSend = {};
    Object.keys(gs.playerCards).forEach(function (pid) {
      var isSelf = pid === p.id;
      var isRevealedAll = gs.revealed;
      var isRevealedIndividual = gs.revealedPlayers[pid] || false;
      var playerRevealedCards = (gs.revealedCards && gs.revealedCards[pid]) || [];

      if (isSelf || isRevealedAll || isRevealedIndividual) {
        playerCardsToSend[pid] = gs.playerCards[pid];
      } else if (playerRevealedCards.length > 0) {
        playerCardsToSend[pid] = gs.playerCards[pid].map(function (card, idx) {
          if (playerRevealedCards.indexOf(idx) !== -1) return card;
          return { suit: 'back', rank: 'back' };
        });
      } else {
        playerCardsToSend[pid] = gs.playerCards[pid].map(function () {
          return { suit: 'back', rank: 'back' };
        });
      }
    });

    io.to(p.id).emit('simUpdate', {
      players: room.players.map(function (op) {
        return {
          id: op.id,
          nickname: op.nickname,
          avatar: op.avatar,
          isOnline: op.isOnline !== false,
        };
      }),
      deck: gs.deck.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
      playerCards: playerCardsToSend,
      communityCards: gs.communityCards.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
      revealedPlayers: Object.assign({}, gs.revealedPlayers),
      revealedCards: Object.assign({}, gs.revealedCards || {}),
      includeJoker: gs.includeJoker,
      revealed: gs.revealed || false,
    });
  });
}

module.exports = function (socket, rooms, io) {
  socket.on('createPokerSimRoom', function (data, callback) {
    try {
      var roomId = generateRoomId();
      var playerId = socket.id;

      var room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'poker-sim',
        players: [{
          id: socket.id,
          playerId: playerId,
          socketId: socket.id,
          nickname: data.nickname || 'Player',
          avatar: data.avatar || 'bear',
          isAI: false,
          isOnline: true,
        }],
        gameState: {
          deck: [],
          playerCards: {},
          communityCards: [],
          revealedPlayers: {},
          includeJoker: true,
          started: false,
          revealed: false,
        },
      };

      room.gameState.playerCards[socket.id] = [];

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data = { roomId: roomId, playerId: playerId };

      if (callback) callback({ success: true, roomId: roomId });
      socket.emit('roomCreated', { roomId: roomId, isHost: true });
    } catch (error) {
      console.error('创建扑克牌模拟房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('joinPokerSimRoom', function (data, callback) {
    try {
      var room = rooms.get(data.roomId);
      if (!room) {
        if (callback) callback({ success: false, error: '房间不存在' });
        return;
      }

      if (room.gameType !== 'poker-sim') {
        if (callback) callback({ success: false, error: '不是扑克牌模拟房间' });
        return;
      }

      if (room.players.length >= 10) {
        if (callback) callback({ success: false, error: '房间已满' });
        return;
      }

      var existingIdx = room.players.findIndex(function (p) { return p.id === socket.id; });
      if (existingIdx !== -1) {
        if (callback) callback({ success: true, roomId: data.roomId });
        return;
      }

      var nicknameMatch = room.players.findIndex(function (p) {
        return p.nickname === (data.nickname || 'Player') && p.id !== socket.id;
      });
      if (nicknameMatch !== -1) {
        var oldId = room.players[nicknameMatch].id;
        room.players[nicknameMatch].id = socket.id;
        room.players[nicknameMatch].socketId = socket.id;
        room.players[nicknameMatch].isOnline = true;

        if (room.gameState) {
          if (room.gameState.playerCards[oldId]) {
            room.gameState.playerCards[socket.id] = room.gameState.playerCards[oldId];
            delete room.gameState.playerCards[oldId];
          }
          if (room.gameState.revealedPlayers[oldId] !== undefined) {
            room.gameState.revealedPlayers[socket.id] = room.gameState.revealedPlayers[oldId];
            delete room.gameState.revealedPlayers[oldId];
          }
        }

        if (room.host === oldId) {
          room.host = socket.id;
        }

        socket.join(data.roomId);
        socket.data = { roomId: data.roomId, playerId: socket.id };

        if (callback) callback({ success: true, roomId: data.roomId });
        socket.emit('roomJoined', { roomId: data.roomId, isHost: room.host === socket.id });

        sendSimUpdate(data.roomId, io, room);
        return;
      }

      var newPlayerId = socket.id;

      var player = {
        id: socket.id,
        playerId: newPlayerId,
        socketId: socket.id,
        nickname: data.nickname || 'Player',
        avatar: data.avatar || 'bear',
        isAI: false,
        isOnline: true,
        joinedAt: Date.now(),
      };

      room.players.push(player);
      room.gameState.playerCards[socket.id] = [];

      socket.join(data.roomId);
      socket.data = { roomId: data.roomId, playerId: newPlayerId };

      if (callback) callback({ success: true, roomId: data.roomId });

      socket.emit('roomJoined', { roomId: data.roomId, isHost: false });

      sendSimUpdate(data.roomId, io, room);
    } catch (error) {
      console.error('加入扑克牌模拟房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('pokerSimAction', function (data) {
    var socketData = socket.data;
    if (!socketData) return;

    var room = rooms.get(socketData.roomId);
    if (!room) return;

    var gs = room.gameState;
    var action = data.action;
    var actionData = data.data || {};

    if (action === 'startGame') {
      if (room.host !== socket.id) return;
      var includeJoker = actionData.includeJoker !== undefined ? actionData.includeJoker : true;
      gs.includeJoker = includeJoker;
      gs.deck = createDeck(includeJoker);
      gs.started = true;
      gs.communityCards = [];
      gs.revealedPlayers = {};
      room.players.forEach(function (p) {
        gs.playerCards[p.id] = [];
      });
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'dealCard') {
      if (!gs.started) return;
      if (gs.deck.length === 0) return;

      var targetId = actionData.playerId;
      if (!targetId) return;

      var card = gs.deck.pop();
      if (!gs.playerCards[targetId]) gs.playerCards[targetId] = [];
      gs.playerCards[targetId].push(card);

      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'dealToCommunity') {
      if (!gs.started) return;
      if (gs.deck.length === 0) return;

      var card = gs.deck.pop();
      gs.communityCards.push(card);

      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'resetGame') {
      if (room.host !== socket.id) return;
      gs.deck = createDeck(gs.includeJoker);
      gs.communityCards = [];
      gs.revealedPlayers = {};
      room.players.forEach(function (p) {
        gs.playerCards[p.id] = [];
      });
      gs.revealed = false;
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'revealCards') {
      gs.revealed = true;
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'hideCards') {
      gs.revealed = false;
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'revealMyCards') {
      if (!gs.started) return;
      var cardIndices = data.cardIndices || null;
      if (cardIndices && Array.isArray(cardIndices) && cardIndices.length > 0) {
        if (!gs.revealedCards) gs.revealedCards = {};
        if (!gs.revealedCards[socket.id]) gs.revealedCards[socket.id] = [];
        cardIndices.forEach(function (idx) {
          if (gs.revealedCards[socket.id].indexOf(idx) === -1) {
            gs.revealedCards[socket.id].push(idx);
          }
        });
      } else {
        gs.revealedPlayers[socket.id] = true;
      }
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'hideMyCards') {
      if (!gs.started) return;
      gs.revealedPlayers[socket.id] = false;
      if (gs.revealedCards && gs.revealedCards[socket.id]) {
        delete gs.revealedCards[socket.id];
      }
      sendSimUpdate(socketData.roomId, io, room);
    }
  });

  socket.on('disconnect', function () {
    var socketData = socket.data;
    if (!socketData) return;

    var room = rooms.get(socketData.roomId);
    if (!room) return;

    var playerIdx = room.players.findIndex(function (p) { return p.id === socket.id; });
    if (playerIdx !== -1) {
      room.players[playerIdx].isOnline = false;
      sendSimUpdate(socketData.roomId, io, room);
    }

    setTimeout(function () {
      var currentRoom = rooms.get(socketData.roomId);
      if (!currentRoom) return;

      var stillOffline = currentRoom.players.findIndex(function (p) {
        return p.id === socket.id && p.isOnline === false;
      });
      if (stillOffline === -1) return;

      var anyOnline = currentRoom.players.some(function (p) { return p.isOnline !== false; });
      if (!anyOnline) {
        rooms.delete(socketData.roomId);
      }
    }, 10000);
  });
};
