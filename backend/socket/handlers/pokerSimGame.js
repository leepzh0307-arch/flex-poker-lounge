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
      playerCards: gs.playerCards,
      includeJoker: gs.includeJoker,
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
          includeJoker: true,
          started: false,
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
      room.players.forEach(function (p) {
        gs.playerCards[p.id] = [];
      });
      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'dealCard') {
      if (room.host !== socket.id) return;
      if (!gs.started) return;
      if (gs.deck.length === 0) return;

      var targetId = actionData.playerId;
      if (!targetId) return;

      var card = gs.deck.pop();
      if (!gs.playerCards[targetId]) gs.playerCards[targetId] = [];
      gs.playerCards[targetId].push(card);

      sendSimUpdate(socketData.roomId, io, room);
    }

    if (action === 'resetGame') {
      if (room.host !== socket.id) return;
      gs.deck = createDeck(gs.includeJoker);
      room.players.forEach(function (p) {
        gs.playerCards[p.id] = [];
      });
      sendSimUpdate(socketData.roomId, io, room);
    }
  });
};
