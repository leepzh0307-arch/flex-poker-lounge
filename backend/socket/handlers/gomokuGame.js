var BOARD_SIZE = 15;
var EMPTY = 0;
var BLACK = 1;
var WHITE = 2;

function createBoard(size) {
  var board = [];
  for (var r = 0; r < size; r++) {
    board.push(new Array(size).fill(EMPTY));
  }
  return board;
}

function checkWin(board, row, col, size) {
  var player = board[row][col];
  if (player === EMPTY) return null;

  var directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (var d = 0; d < directions.length; d++) {
    var dr = directions[d][0];
    var dc = directions[d][1];
    var line = [{ row: row, col: col }];

    for (var i = 1; i < 5; i++) {
      var nr = row + dr * i;
      var nc = col + dc * i;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (board[nr][nc] !== player) break;
      line.push({ row: nr, col: nc });
    }

    for (var i = 1; i < 5; i++) {
      var nr = row - dr * i;
      var nc = col - dc * i;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (board[nr][nc] !== player) break;
      line.push({ row: nr, col: nc });
    }

    if (line.length >= 5) return line;
  }

  return null;
}

function isBoardFull(board, size) {
  for (var r = 0; r < size; r++) {
    for (var c = 0; c < size; c++) {
      if (board[r][c] === EMPTY) return false;
    }
  }
  return true;
}

function findPlayerRoom(socketId, rooms) {
  var entries = rooms.entries();
  var entry = entries.next();
  while (!entry.done) {
    var roomId = entry.value[0];
    var room = entry.value[1];
    if (room.gameType === 'gomoku') {
      var found = room.players.some(function(p) { return p.id === socketId; });
      if (found) return roomId;
    }
    entry = entries.next();
  }
  return null;
}

function buildGomokuUpdateForPlayer(room, playerId) {
  var gs = room.gameState;
  var isBlack = gs.blackPlayerId === playerId;
  var isWhite = gs.whitePlayerId === playerId;
  var isPlayer = isBlack || isWhite;
  var myColor = isBlack ? BLACK : (isWhite ? WHITE : 0);

  return {
    phase: gs.phase,
    boardSize: gs.boardSize,
    board: gs.board,
    currentPlayer: gs.currentPlayer,
    blackPlayerId: gs.blackPlayerId,
    whitePlayerId: gs.whitePlayerId,
    myColor: myColor,
    isPlayer: isPlayer,
    isSpectator: !isPlayer,
    moveHistory: gs.moveHistory,
    lastMove: gs.moveHistory.length > 0 ? gs.moveHistory[gs.moveHistory.length - 1] : null,
    winner: gs.winner,
    winLine: gs.winLine,
    winReason: gs.winReason,
    undoRequest: gs.undoRequest,
    players: room.players.map(function(p) {
      return {
        id: p.id,
        nickname: p.nickname,
        avatar: p.avatar,
        isAI: p.isAI || false,
        isOnline: p.isOnline !== false,
        color: p.id === gs.blackPlayerId ? 'black' : (p.id === gs.whitePlayerId ? 'white' : 'spectator'),
      };
    }),
    isMyTurn: isPlayer && gs.currentPlayer === myColor,
  };
}

function broadcastGomokuUpdate(room, roomId, io) {
  room.players.forEach(function(p) {
    if (!p.isAI) {
      io.to(p.id).emit('gomokuUpdate', buildGomokuUpdateForPlayer(room, p.id));
    }
  });
}

function handleStartGame(room, roomId, io) {
  var gs = room.gameState;
  if (gs.phase !== 'WAITING') return;

  var humanPlayers = room.players.filter(function(p) { return !p.isAI; });
  if (humanPlayers.length < 2 && !room.players.some(function(p) { return p.isAI; })) return;

  gs.phase = 'PLAYING';
  gs.board = createBoard(gs.boardSize);
  gs.moveHistory = [];
  gs.currentPlayer = BLACK;
  gs.winner = null;
  gs.winLine = null;
  gs.winReason = null;
  gs.undoRequest = null;

  var playerList = room.players.filter(function(p) { return !p.isSpectator; });
  if (playerList.length >= 2) {
    gs.blackPlayerId = playerList[0].id;
    gs.whitePlayerId = playerList[1].id;
  }

  broadcastGomokuUpdate(room, roomId, io);
}

function handlePlaceStone(room, roomId, io, playerId, data) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  var isBlack = gs.blackPlayerId === playerId;
  var isWhite = gs.whitePlayerId === playerId;
  if (!isBlack && !isWhite) return;

  var myColor = isBlack ? BLACK : WHITE;
  if (gs.currentPlayer !== myColor) return;

  var row = data.row;
  var col = data.col;
  if (row < 0 || row >= gs.boardSize || col < 0 || col >= gs.boardSize) return;
  if (gs.board[row][col] !== EMPTY) return;

  gs.board[row][col] = myColor;
  gs.moveHistory.push({ row: row, col: col, player: myColor, timestamp: Date.now() });

  var winLine = checkWin(gs.board, row, col, gs.boardSize);
  if (winLine) {
    gs.winner = myColor;
    gs.winLine = winLine;
    gs.winReason = 'five';
    gs.phase = 'FINISHED';
  } else if (isBoardFull(gs.board, gs.boardSize)) {
    gs.winner = 'draw';
    gs.winReason = 'full';
    gs.phase = 'FINISHED';
  } else {
    gs.currentPlayer = myColor === BLACK ? WHITE : BLACK;
  }

  gs.undoRequest = null;
  broadcastGomokuUpdate(room, roomId, io);
}

function handleUndoRequest(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (gs.moveHistory.length === 0) return;

  var isBlack = gs.blackPlayerId === playerId;
  var isWhite = gs.whitePlayerId === playerId;
  if (!isBlack && !isWhite) return;

  gs.undoRequest = { player: isBlack ? BLACK : WHITE, timestamp: Date.now() };
  broadcastGomokuUpdate(room, roomId, io);
}

function handleUndoAccept(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;
  if (!gs.undoRequest) return;

  var isBlack = gs.blackPlayerId === playerId;
  var isWhite = gs.whitePlayerId === playerId;
  var myColor = isBlack ? BLACK : WHITE;

  if (gs.undoRequest.player === myColor) return;

  if (gs.moveHistory.length >= 2) {
    var lastMove = gs.moveHistory.pop();
    gs.board[lastMove.row][lastMove.col] = EMPTY;
    var prevMove = gs.moveHistory.pop();
    gs.board[prevMove.row][prevMove.col] = EMPTY;
    gs.currentPlayer = myColor;
  } else if (gs.moveHistory.length === 1) {
    var lastMove = gs.moveHistory.pop();
    gs.board[lastMove.row][lastMove.col] = EMPTY;
    gs.currentPlayer = BLACK;
  }

  gs.undoRequest = null;
  broadcastGomokuUpdate(room, roomId, io);
}

function handleUndoReject(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (!gs.undoRequest) return;
  gs.undoRequest = null;
  broadcastGomokuUpdate(room, roomId, io);
}

function handleResign(room, roomId, io, playerId) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  var isBlack = gs.blackPlayerId === playerId;
  var isWhite = gs.whitePlayerId === playerId;
  if (!isBlack && !isWhite) return;

  var myColor = isBlack ? BLACK : WHITE;
  gs.winner = myColor === BLACK ? WHITE : BLACK;
  gs.winReason = 'resign';
  gs.phase = 'FINISHED';
  broadcastGomokuUpdate(room, roomId, io);
}

function handleResetGame(room, roomId, io) {
  var gs = room.gameState;
  var oldBlack = gs.blackPlayerId;
  var oldWhite = gs.whitePlayerId;

  gs.phase = 'WAITING';
  gs.board = createBoard(gs.boardSize);
  gs.moveHistory = [];
  gs.currentPlayer = BLACK;
  gs.blackPlayerId = oldWhite;
  gs.whitePlayerId = oldBlack;
  gs.winner = null;
  gs.winLine = null;
  gs.winReason = null;
  gs.undoRequest = null;

  broadcastGomokuUpdate(room, roomId, io);
}

function handleAiMove(room, roomId, io) {
  var gs = room.gameState;
  if (gs.phase !== 'PLAYING') return;

  var aiPlayer = room.players.find(function(p) {
    return p.isAI && ((gs.currentPlayer === BLACK && p.id === gs.blackPlayerId) || (gs.currentPlayer === WHITE && p.id === gs.whitePlayerId));
  });
  if (!aiPlayer) return;

  var bestScore = -Infinity;
  var bestMoves = [];

  for (var r = 0; r < gs.boardSize; r++) {
    for (var c = 0; c < gs.boardSize; c++) {
      if (gs.board[r][c] !== EMPTY) continue;

      var hasNeighbor = false;
      for (var dr = -2; dr <= 2; dr++) {
        for (var dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          var nr = r + dr;
          var nc = c + dc;
          if (nr >= 0 && nr < gs.boardSize && nc >= 0 && nc < gs.boardSize && gs.board[nr][nc] !== EMPTY) {
            hasNeighbor = true;
          }
        }
      }

      if (gs.moveHistory.length === 0) {
        hasNeighbor = true;
      }

      if (!hasNeighbor) continue;

      var score = evaluatePosition(gs.board, r, c, gs.currentPlayer, gs.boardSize);

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [{ row: r, col: c }];
      } else if (score === bestScore) {
        bestMoves.push({ row: r, col: c });
      }
    }
  }

  if (bestMoves.length === 0) return;

  var chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  handlePlaceStone(room, roomId, io, aiPlayer.id, { row: chosen.row, col: chosen.col });
}

function evaluatePosition(board, row, col, player, size) {
  var opponent = player === BLACK ? WHITE : BLACK;
  var score = 0;

  board[row][col] = player;
  var myResult = analyzePoint(board, row, col, player, size);
  board[row][col] = EMPTY;

  if (myResult.five) score += 100000;
  else if (myResult.openFour) score += 50000;
  else if (myResult.four) score += 5000;
  else if (myResult.openThree) score += 3000;
  else if (myResult.three) score += 500;
  else if (myResult.openTwo) score += 200;
  else if (myResult.two) score += 50;

  board[row][col] = opponent;
  var oppResult = analyzePoint(board, row, col, opponent, size);
  board[row][col] = EMPTY;

  if (oppResult.five) score += 90000;
  else if (oppResult.openFour) score += 45000;
  else if (oppResult.four) score += 4500;
  else if (oppResult.openThree) score += 2500;

  if (row === Math.floor(size / 2) && col === Math.floor(size / 2) && board[row][col] === EMPTY) {
    score += 10;
  }

  return score;
}

function analyzePoint(board, row, col, player, size) {
  var result = { five: false, openFour: false, four: false, openThree: false, three: false, openTwo: false, two: false };
  var directions = [[0, 1], [1, 0], [1, 1], [1, -1]];

  for (var d = 0; d < directions.length; d++) {
    var dr = directions[d][0];
    var dc = directions[d][1];
    var count = 1;
    var openEnds = 0;

    for (var i = 1; i <= 4; i++) {
      var nr = row + dr * i;
      var nc = col + dc * i;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (board[nr][nc] === player) count++;
      else { if (board[nr][nc] === EMPTY) openEnds++; break; }
    }

    for (var i = 1; i <= 4; i++) {
      var nr = row - dr * i;
      var nc = col - dc * i;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) break;
      if (board[nr][nc] === player) count++;
      else { if (board[nr][nc] === EMPTY) openEnds++; break; }
    }

    if (count >= 5) result.five = true;
    else if (count === 4) { if (openEnds >= 2) result.openFour = true; else if (openEnds >= 1) result.four = true; }
    else if (count === 3) { if (openEnds >= 2) result.openThree = true; else if (openEnds >= 1) result.three = true; }
    else if (count === 2) { if (openEnds >= 2) result.openTwo = true; else if (openEnds >= 1) result.two = true; }
  }

  return result;
}

module.exports = function(socket, rooms, io) {
  socket.on('gomokuAction', function(data) {
    var action = data.action;
    var actionData = data.data || {};
    var roomId = findPlayerRoom(socket.id, rooms);
    if (!roomId) return;
    var room = rooms.get(roomId);
    if (!room || room.gameType !== 'gomoku') return;

    switch (action) {
      case 'startGame':
        handleStartGame(room, roomId, io);
        break;
      case 'placeStone':
        handlePlaceStone(room, roomId, io, socket.id, actionData);
        if (room.gameState.phase === 'PLAYING') {
          var aiDelay = room.aiThinkDelay || 800;
          setTimeout(function() { handleAiMove(room, roomId, io); }, aiDelay);
        }
        break;
      case 'undoRequest':
        handleUndoRequest(room, roomId, io, socket.id);
        break;
      case 'undoAccept':
        handleUndoAccept(room, roomId, io, socket.id);
        break;
      case 'undoReject':
        handleUndoReject(room, roomId, io, socket.id);
        break;
      case 'resign':
        handleResign(room, roomId, io, socket.id);
        break;
      case 'resetGame':
        handleResetGame(room, roomId, io);
        break;
    }
  });
};
