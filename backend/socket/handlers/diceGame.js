function generateRoomId() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var id = '';
  for (var i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substr(2, 9);
}

function sendDiceUpdate(roomId, io, room) {
  if (!room || !room.gameState) return;

  var gs = room.gameState;

  room.players.forEach(function (p) {
    if (p.isAI) return;

    var playerData = room.players.map(function (op) {
      return {
        id: op.id,
        nickname: op.nickname,
        avatar: op.avatar,
        isAI: op.isAI || false,
        isOnline: op.isOnline !== false,
        diceCount: gs.playerDice[op.id] ? gs.playerDice[op.id].length : 0,
        diceValues: gs.playerRevealed[op.id] ? (gs.playerDice[op.id] || []) : [],
        diceRevealed: gs.playerRevealed[op.id] || false,
      };
    });

    io.to(p.id).emit('diceUpdate', {
      phase: gs.phase,
      diceCount: gs.diceCount,
      players: playerData,
      isMyTurn: gs.currentPlayerId === p.id,
      isRevealer: gs.revealerId === p.id,
    });
  });
}

function getNextPlayerId(room, currentId) {
  var idx = room.players.findIndex(function (p) { return p.id === currentId; });
  if (idx === -1) return room.players[0].id;
  var nextIdx = (idx + 1) % room.players.length;
  return room.players[nextIdx].id;
}

function handleStartGame(room, roomId, io, diceCount) {
  room.gameState = {
    phase: 'ROLLING',
    diceCount: diceCount || room.diceCount || 5,
    currentPlayerId: room.players[0].id,
    playerDice: {},
    playerRevealed: {},
    revealerId: null,
    confirmedPlayers: [],
    results: null,
  };

  room.players.forEach(function (p) {
    room.gameState.playerDice[p.id] = [];
    room.gameState.playerRevealed[p.id] = false;
  });

  sendDiceUpdate(roomId, io, room);
}

function handleRollDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'ROLLING') return;
  if (gs.currentPlayerId !== playerId) return;

  var diceCount = gs.diceCount;
  var diceValues = [];

  for (var i = 0; i < diceCount; i++) {
    diceValues.push(Math.floor(Math.random() * 6) + 1);
  }

  gs.playerDice[playerId] = diceValues;

  io.to(playerId).emit('diceAction', {
    type: 'rollAnimation',
    diceCount: diceCount,
  });

  var allRolled = room.players.every(function (p) {
    return gs.playerDice[p.id] && gs.playerDice[p.id].length > 0;
  });

  if (allRolled) {
    gs.revealerId = room.players[0].id;
  } else {
    gs.currentPlayerId = getNextPlayerId(room, playerId);
  }

  sendDiceUpdate(roomId, io, room);
}

function handleRollResult(room, roomId, io, playerId, values) {
  var gs = room.gameState;
  if (!values || !Array.isArray(values)) return;
  if (gs.phase !== 'ROLLING') return;

  gs.playerDice[playerId] = values;

  var allRolled = room.players.every(function (p) {
    return gs.playerDice[p.id] && gs.playerDice[p.id].length > 0;
  });

  if (allRolled) {
    gs.revealerId = room.players[0].id;
  }

  sendDiceUpdate(roomId, io, room);
}

function handleRevealAll(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'ROLLING') return;

  var allRolled = room.players.every(function (p) {
    return gs.playerDice[p.id] && gs.playerDice[p.id].length > 0;
  });

  if (!allRolled) return;

  gs.phase = 'REVEAL';
  gs.revealerId = playerId;
  gs.currentPlayerId = null;

  sendDiceUpdate(roomId, io, room);
}

function handleAddDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;
  if (gs.playerRevealed[playerId]) return;
  if (gs.playerDice[playerId].length >= 15) return;

  gs.playerDice[playerId].push(Math.floor(Math.random() * 6) + 1);
  sendDiceUpdate(roomId, io, room);
}

function handleRemoveDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;
  if (gs.playerRevealed[playerId]) return;
  if (gs.playerDice[playerId].length <= 1) return;

  gs.playerDice[playerId].pop();
  sendDiceUpdate(roomId, io, room);
}

function handleConfirmDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;
  if (gs.playerRevealed[playerId]) return;

  gs.playerRevealed[playerId] = true;
  gs.confirmedPlayers.push(playerId);

  var allConfirmed = room.players.every(function (p) {
    return gs.playerRevealed[p.id];
  });

  if (allConfirmed) {
    var results = room.players.map(function (p) {
      var dice = gs.playerDice[p.id] || [];
      var total = dice.reduce(function (sum, v) { return sum + v; }, 0);
      return {
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        diceValues: dice,
        total: total,
      };
    });

    results.sort(function (a, b) { return b.total - a.total; });

    gs.phase = 'GAME_END';
    gs.results = results;

    room.players.forEach(function (p) {
      if (!p.isAI) {
        io.to(p.id).emit('diceAction', {
          type: 'gameEnd',
          results: results,
        });
      }
    });
  }

  sendDiceUpdate(roomId, io, room);
}

function handleResetGame(room, roomId, io) {
  room.gameState = {
    phase: 'WAITING',
    diceCount: room.diceCount || 5,
    currentPlayerId: null,
    playerDice: {},
    playerRevealed: {},
    revealerId: null,
    confirmedPlayers: [],
    results: null,
  };

  room.players.forEach(function (p) {
    room.gameState.playerDice[p.id] = [];
    room.gameState.playerRevealed[p.id] = false;
  });

  sendDiceUpdate(roomId, io, room);
}

module.exports = function (socket, rooms, io) {
  socket.on('createDiceRoom', function (data, callback) {
      try {
        var roomId = generateRoomId();
        var playerId = socket.id;

        var room = {
          id: roomId,
          host: socket.id,
          hostPlayerId: playerId,
          gameType: 'dice',
          players: [{
            id: socket.id,
            playerId: playerId,
            socketId: socket.id,
            nickname: data.nickname || 'Player',
            avatar: data.avatar || 'bear',
            isAI: false,
            isOnline: true,
          }],
          diceCount: 5,
          gameState: {
            phase: 'WAITING',
            diceCount: 5,
            currentPlayerId: null,
            playerDice: {},
            playerRevealed: {},
            revealerId: null,
            confirmedPlayers: [],
            results: null,
          },
        };

        room.gameState.playerDice[socket.id] = [];
        room.gameState.playerRevealed[socket.id] = false;

        rooms.set(roomId, room);
        socket.join(roomId);
        socket.data = { roomId: roomId, playerId: playerId };

        if (callback) callback({ success: true, roomId: roomId });
        socket.emit('roomCreated', { roomId: roomId, isHost: true });
      } catch (error) {
        console.error('创建骰子房间失败:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('joinDiceRoom', function (data, callback) {
      try {
        var room = rooms.get(data.roomId);
        if (!room) {
          if (callback) callback({ success: false, error: '房间不存在' });
          return;
        }

        if (room.gameType !== 'dice') {
          if (callback) callback({ success: false, error: '不是骰子房间' });
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
        room.gameState.playerDice[socket.id] = [];
        room.gameState.playerRevealed[socket.id] = false;

        socket.join(data.roomId);
        socket.data = { roomId: data.roomId, playerId: newPlayerId };

        if (callback) callback({ success: true, roomId: data.roomId });

        socket.emit('roomJoined', { roomId: data.roomId, isHost: false });

        sendDiceUpdate(data.roomId, io, room);
      } catch (error) {
        console.error('加入骰子房间失败:', error);
        if (callback) callback({ success: false, error: error.message });
      }
    });

    socket.on('diceAction', function (data) {
      var socketData = socket.data;
      if (!socketData) return;

      var room = rooms.get(socketData.roomId);
      if (!room) return;

      var playerId = socket.id;
      var action = data.action;
      var actionData = data.data || {};

      switch (action) {
        case 'startGame':
          if (room.host === playerId) {
            handleStartGame(room, socketData.roomId, io, actionData.diceCount);
          }
          break;
        case 'rollDice':
          handleRollDice(room, socketData.roomId, io, playerId);
          break;
        case 'rollResult':
          handleRollResult(room, socketData.roomId, io, playerId, actionData.values);
          break;
        case 'revealAll':
          handleRevealAll(room, socketData.roomId, io, playerId);
          break;
        case 'addDice':
          handleAddDice(room, socketData.roomId, io, playerId);
          break;
        case 'removeDice':
          handleRemoveDice(room, socketData.roomId, io, playerId);
          break;
        case 'confirmDice':
          handleConfirmDice(room, socketData.roomId, io, playerId);
          break;
        case 'resetGame':
          if (room.host === playerId) {
            handleResetGame(room, socketData.roomId, io);
          }
          break;
      }
    });

    socket.on('disconnect', function () {
      var socketData = socket.data;
      if (!socketData) return;

      var room = rooms.get(socketData.roomId);
      if (!room) return;

      var playerIdx = room.players.findIndex(function (p) { return p.id === socket.id; });
      if (playerIdx !== -1) {
        var player = room.players[playerIdx];
        room.players.splice(playerIdx, 1);

        if (room.gameState) {
          delete room.gameState.playerDice[socket.id];
          delete room.gameState.playerRevealed[socket.id];
        }

        if (room.players.length === 0) {
          rooms.delete(socketData.roomId);
        } else {
          if (room.host === socket.id) {
            room.host = room.players[0].id;
          }
          sendDiceUpdate(socketData.roomId, io, room);
        }
      }
    });
  };
