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
        diceTotal: gs.playerDiceCount[op.id] || gs.diceCount,
        diceValues: gs.playerRevealed[op.id] ? (gs.playerDice[op.id] || []) : [],
        diceRevealed: gs.playerRevealed[op.id] || false,
        diceAdjust: gs.playerDiceAdjust[op.id] || 0,
        confirmed: gs.confirmedPlayers.indexOf(op.id) !== -1,
      };
    });

    io.to(p.id).emit('diceUpdate', {
      phase: gs.phase,
      diceCount: gs.diceCount,
      roundNumber: gs.roundNumber,
      players: playerData,
      isMyTurn: gs.currentPlayerId === p.id,
      isRevealer: gs.revealerId === p.id,
      isHost: room.host === p.id,
      myDiceTotal: gs.playerDiceCount[p.id] || gs.diceCount,
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
  var baseDice = diceCount || room.diceCount || 5;

  room.gameState = {
    phase: 'ROLLING',
    diceCount: baseDice,
    baseDiceCount: baseDice,
    roundNumber: 1,
    currentPlayerId: room.players[0].id,
    playerDice: {},
    playerDiceCount: {},
    playerRevealed: {},
    playerDiceAdjust: {},
    revealerId: null,
    confirmedPlayers: [],
    results: null,
  };

  room.players.forEach(function (p) {
    room.gameState.playerDice[p.id] = [];
    room.gameState.playerDiceCount[p.id] = baseDice;
    room.gameState.playerRevealed[p.id] = false;
    room.gameState.playerDiceAdjust[p.id] = 0;
  });

  sendDiceUpdate(roomId, io, room);
}

function handleRollDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'ROLLING') return;
  if (gs.currentPlayerId !== playerId) return;

  var diceCount = gs.playerDiceCount[playerId] || gs.diceCount;
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

function handleRevealSelf(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'ROLLING') return;

  if (!gs.playerDice[playerId] || gs.playerDice[playerId].length === 0) return;

  gs.playerRevealed[playerId] = true;

  var allRevealed = room.players.every(function (p) {
    return gs.playerRevealed[p.id];
  });

  if (allRevealed) {
    gs.phase = 'REVEAL';
    gs.revealerId = playerId;
    gs.currentPlayerId = null;
  }

  sendDiceUpdate(roomId, io, room);
}

function handleRequestRevealAll(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'ROLLING') return;

  var allRolled = room.players.every(function (p) {
    return gs.playerDice[p.id] && gs.playerDice[p.id].length > 0;
  });
  if (!allRolled) return;

  gs.revealAllVotes = {};
  gs.revealAllVotes[playerId] = true;
  gs.revealAllRequester = playerId;

  var requester = room.players.find(function (p) { return p.id === playerId; });
  var requesterName = requester ? requester.nickname : '有人';

  var totalVoters = room.players.filter(function (p) { return !p.isAI; }).length;
  var agreedCount = Object.keys(gs.revealAllVotes).length;

  var aiPlayers = room.players.filter(function (p) { return p.isAI; });
  aiPlayers.forEach(function (ai) {
    gs.revealAllVotes[ai.id] = true;
    agreedCount++;
  });

  if (agreedCount >= totalVoters + aiPlayers.length) {
    gs.phase = 'REVEAL';
    gs.revealerId = playerId;
    gs.currentPlayerId = null;
    room.players.forEach(function (p) {
      gs.playerRevealed[p.id] = true;
    });
    gs.revealAllVotes = null;
    gs.revealAllRequester = null;
    sendDiceUpdate(roomId, io, room);
    return;
  }

  room.players.forEach(function (p) {
    if (p.isAI || p.id === playerId) return;
    io.to(p.id).emit('diceAction', {
      type: 'revealAllVote',
      requesterName: requesterName,
      voteStatus: { agreed: agreedCount, total: totalVoters + aiPlayers.length },
    });
  });

  sendDiceUpdate(roomId, io, room);
}

function handleVoteRevealAll(room, roomId, io, playerId, vote) {
  var gs = room.gameState;
  if (!gs.revealAllVotes) return;

  gs.revealAllVotes[playerId] = vote;

  if (!vote) {
    room.players.forEach(function (p) {
      if (!p.isAI) {
        io.to(p.id).emit('diceAction', { type: 'revealAllRejected' });
      }
    });
    gs.revealAllVotes = null;
    gs.revealAllRequester = null;
    sendDiceUpdate(roomId, io, room);
    return;
  }

  var totalPlayers = room.players.length;
  var agreedCount = Object.keys(gs.revealAllVotes).filter(function (pid) {
    return gs.revealAllVotes[pid] === true;
  }).length;

  if (agreedCount >= totalPlayers) {
    gs.phase = 'REVEAL';
    gs.revealerId = gs.revealAllRequester;
    gs.currentPlayerId = null;
    room.players.forEach(function (p) {
      gs.playerRevealed[p.id] = true;
    });
    gs.revealAllVotes = null;
    gs.revealAllRequester = null;
  }

  sendDiceUpdate(roomId, io, room);
}

function handleAddDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;

  var adjust = gs.playerDiceAdjust[playerId] || 0;
  var currentDice = gs.diceCount + adjust;
  if (currentDice >= 15) return;

  gs.playerDiceAdjust[playerId] = adjust + 1;

  sendDiceUpdate(roomId, io, room);
}

function handleRemoveDice(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;

  var adjust = gs.playerDiceAdjust[playerId] || 0;
  var currentDice = gs.diceCount + adjust;
  if (currentDice <= 1) return;

  gs.playerDiceAdjust[playerId] = adjust - 1;

  sendDiceUpdate(roomId, io, room);
}

function handleConfirmRound(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'REVEAL') return;

  if (gs.confirmedPlayers.indexOf(playerId) !== -1) return;

  gs.confirmedPlayers.push(playerId);

  var allConfirmed = room.players.every(function (p) {
    return gs.confirmedPlayers.indexOf(p.id) !== -1;
  });

  if (allConfirmed) {
    startNextRound(room, roomId, io);
  } else {
    sendDiceUpdate(roomId, io, room);
  }
}

function startNextRound(room, roomId, io) {
  var gs = room.gameState;

  var baseDice = gs.diceCount;

  var nextRound = (gs.roundNumber || 0) + 1;

  gs.phase = 'ROLLING';
  gs.roundNumber = nextRound;
  gs.currentPlayerId = room.players[0].id;
  gs.revealerId = null;
  gs.results = null;
  gs.confirmedPlayers = [];

  room.players.forEach(function (p) {
    var adjust = gs.playerDiceAdjust[p.id] || 0;
    var playerDice = baseDice + adjust;
    if (playerDice < 1) playerDice = 1;
    if (playerDice > 15) playerDice = 15;
    gs.playerDiceCount[p.id] = playerDice;
    gs.playerDice[p.id] = [];
    gs.playerRevealed[p.id] = false;
    gs.playerDiceAdjust[p.id] = 0;
  });

  sendDiceUpdate(roomId, io, room);
}

function handleEndGame(room, roomId, io, playerId) {
  if (room.host !== playerId) return;

  var gs = room.gameState;
  if (gs.phase === 'WAITING') return;

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

  sendDiceUpdate(roomId, io, room);
}

function handleResetGame(room, roomId, io) {
  room.gameState = {
    phase: 'WAITING',
    diceCount: room.diceCount || 5,
    baseDiceCount: room.diceCount || 5,
    roundNumber: 0,
    currentPlayerId: null,
    playerDice: {},
    playerDiceCount: {},
    playerRevealed: {},
    playerDiceAdjust: {},
    revealerId: null,
    confirmedPlayers: [],
    results: null,
  };

  room.players.forEach(function (p) {
    room.gameState.playerDice[p.id] = [];
    room.gameState.playerDiceCount[p.id] = room.diceCount || 5;
    room.gameState.playerRevealed[p.id] = false;
    room.gameState.playerDiceAdjust[p.id] = 0;
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
            baseDiceCount: 5,
            roundNumber: 0,
            currentPlayerId: null,
            playerDice: {},
            playerDiceCount: {},
            playerRevealed: {},
            playerDiceAdjust: {},
            revealerId: null,
            confirmedPlayers: [],
            results: null,
          },
        };

        room.gameState.playerDice[socket.id] = [];
        room.gameState.playerDiceCount[socket.id] = 5;
        room.gameState.playerRevealed[socket.id] = false;
        room.gameState.playerDiceAdjust[socket.id] = 0;

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
            if (room.gameState.playerDice[oldId]) {
              room.gameState.playerDice[socket.id] = room.gameState.playerDice[oldId];
              delete room.gameState.playerDice[oldId];
            }
            if (room.gameState.playerRevealed[oldId] !== undefined) {
              room.gameState.playerRevealed[socket.id] = room.gameState.playerRevealed[oldId];
              delete room.gameState.playerRevealed[oldId];
            }
            if (room.gameState.playerDiceAdjust[oldId] !== undefined) {
              room.gameState.playerDiceAdjust[socket.id] = room.gameState.playerDiceAdjust[oldId];
              delete room.gameState.playerDiceAdjust[oldId];
            }
            if (room.gameState.playerDiceCount && room.gameState.playerDiceCount[oldId] !== undefined) {
              room.gameState.playerDiceCount[socket.id] = room.gameState.playerDiceCount[oldId];
              delete room.gameState.playerDiceCount[oldId];
            }
            if (room.gameState.currentPlayerId === oldId) {
              room.gameState.currentPlayerId = socket.id;
            }
            if (room.gameState.revealerId === oldId) {
              room.gameState.revealerId = socket.id;
            }
            if (room.gameState.confirmedPlayers) {
              room.gameState.confirmedPlayers = room.gameState.confirmedPlayers.map(function (pid) {
                return pid === oldId ? socket.id : pid;
              });
            }
          }

          if (room.host === oldId) {
            room.host = socket.id;
          }

          socket.join(data.roomId);
          socket.data = { roomId: data.roomId, playerId: socket.id };

          if (callback) callback({ success: true, roomId: data.roomId });
          socket.emit('roomJoined', { roomId: data.roomId, isHost: room.host === socket.id });

          sendDiceUpdate(data.roomId, io, room);
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
        room.gameState.playerDiceCount[socket.id] = room.gameState.diceCount || 5;
        room.gameState.playerRevealed[socket.id] = false;
        room.gameState.playerDiceAdjust[socket.id] = 0;

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
        case 'revealSelf':
          handleRevealSelf(room, socketData.roomId, io, playerId);
          break;
        case 'requestRevealAll':
          handleRequestRevealAll(room, socketData.roomId, io, playerId);
          break;
        case 'voteRevealAll':
          handleVoteRevealAll(room, socketData.roomId, io, playerId, data.vote || false);
          break;
        case 'addDice':
          handleAddDice(room, socketData.roomId, io, playerId);
          break;
        case 'removeDice':
          handleRemoveDice(room, socketData.roomId, io, playerId);
          break;
        case 'confirmRound':
          handleConfirmRound(room, socketData.roomId, io, playerId);
          break;
        case 'endGame':
          handleEndGame(room, socketData.roomId, io, playerId);
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
        room.players[playerIdx].isOnline = false;
        sendDiceUpdate(socketData.roomId, io, room);
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
