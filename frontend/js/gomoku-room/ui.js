var GomokuRoomUI = (function() {

  function GomokuRoomUI() {
    this.elements = {};
    this.canvas = null;
    this.ctx = null;
    this.cellSize = 0;
    this.padding = 0;
    this.boardSize = 15;
    this.board = [];
    this.lastMove = null;
    this.winLine = null;
    this.myColor = 0;
    this.isMyTurn = false;
    this.isSpectator = false;
    this.hoverPos = null;
    this._boundEvents = [];
  }

  GomokuRoomUI.prototype.init = function() {
    this.elements.opponentBar = document.getElementById('opponent-bar');
    this.elements.myBar = document.getElementById('my-bar');
    this.elements.boardContainer = document.getElementById('board-container');
    this.elements.actionBar = document.getElementById('action-bar');
    this.elements.startBtn = document.getElementById('start-btn');
    this.elements.undoBtn = document.getElementById('undo-btn');
    this.elements.resignBtn = document.getElementById('resign-btn');
    this.elements.undoPopup = document.getElementById('undo-popup');
    this.elements.undoAcceptBtn = document.getElementById('undo-accept-btn');
    this.elements.undoRejectBtn = document.getElementById('undo-reject-btn');
    this.elements.gameEndOverlay = document.getElementById('game-end-overlay');
    this.elements.gameEndTitle = document.getElementById('game-end-title');
    this.elements.gameEndDetail = document.getElementById('game-end-detail');
    this.elements.resetBtn = document.getElementById('reset-btn');
    this.elements.spectatorList = document.getElementById('spectator-list');
    this.elements.notification = document.getElementById('notification');

    this._setupCanvas();
    this._setupCanvasEvents();
  };

  GomokuRoomUI.prototype._setupCanvas = function() {
    var wrapper = document.createElement('div');
    wrapper.className = 'go-board-wrapper';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'go-board-canvas';
    wrapper.appendChild(this.canvas);

    this.elements.boardContainer.innerHTML = '';
    this.elements.boardContainer.appendChild(wrapper);

    this.ctx = this.canvas.getContext('2d');
    this._resizeCanvas();
    var self = this;
    window.addEventListener('resize', function() { self._resizeCanvas(); self._drawBoard(); });
  };

  GomokuRoomUI.prototype._resizeCanvas = function() {
    var container = this.elements.boardContainer;
    var maxW = container.clientWidth - 16;
    var maxH = container.clientHeight - 16;
    var size = Math.min(maxW, maxH);

    this.cellSize = Math.floor(size / (this.boardSize + 1));
    this.padding = this.cellSize;
    var canvasSize = this.cellSize * (this.boardSize - 1) + this.padding * 2;

    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = canvasSize * dpr;
    this.canvas.height = canvasSize * dpr;
    this.canvas.style.width = canvasSize + 'px';
    this.canvas.style.height = canvasSize + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  GomokuRoomUI.prototype._setupCanvasEvents = function() {
    var self = this;
    this.canvas.addEventListener('click', function(e) {
      if (self.isSpectator || !self.isMyTurn) return;
      var pos = self._getGridPos(e);
      if (pos && self.onPlaceStone) self.onPlaceStone(pos.row, pos.col);
    });

    this.canvas.addEventListener('mousemove', function(e) {
      if (self.isSpectator || !self.isMyTurn) { self.hoverPos = null; self._drawBoard(); return; }
      self.hoverPos = self._getGridPos(e);
      self._drawBoard();
    });

    this.canvas.addEventListener('mouseleave', function() {
      self.hoverPos = null;
      self._drawBoard();
    });

    this.canvas.addEventListener('touchstart', function(e) {
      e.preventDefault();
      if (self.isSpectator || !self.isMyTurn) return;
      var touch = e.touches[0];
      var pos = self._getGridPosFromXY(touch.clientX, touch.clientY);
      if (pos && self.onPlaceStone) self.onPlaceStone(pos.row, pos.col);
    }, { passive: false });
  };

  GomokuRoomUI.prototype._getGridPos = function(e) {
    return this._getGridPosFromXY(e.clientX, e.clientY);
  };

  GomokuRoomUI.prototype._getGridPosFromXY = function(clientX, clientY) {
    var rect = this.canvas.getBoundingClientRect();
    var x = clientX - rect.left;
    var y = clientY - rect.top;
    var col = Math.round((x - this.padding) / this.cellSize);
    var row = Math.round((y - this.padding) / this.cellSize);
    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return null;
    return { row: row, col: col };
  };

  GomokuRoomUI.prototype._drawBoard = function() {
    var ctx = this.ctx;
    var cs = this.cellSize;
    var pad = this.padding;
    var size = this.boardSize;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#DCB35C';
    ctx.fillRect(0, 0, this.canvas.width / (window.devicePixelRatio || 1), this.canvas.height / (window.devicePixelRatio || 1));

    ctx.strokeStyle = '#5C4A1E';
    ctx.lineWidth = 1;
    for (var i = 0; i < size; i++) {
      ctx.beginPath();
      ctx.moveTo(pad, pad + i * cs);
      ctx.lineTo(pad + (size - 1) * cs, pad + i * cs);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pad + i * cs, pad);
      ctx.lineTo(pad + i * cs, pad + (size - 1) * cs);
      ctx.stroke();
    }

    var starPoints = size === 15 ? [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]] :
                     size === 13 ? [[3,3],[3,9],[6,6],[9,3],[9,9]] : [[2,2],[2,6],[4,4],[6,2],[6,6]];
    ctx.fillStyle = '#5C4A1E';
    for (var s = 0; s < starPoints.length; s++) {
      ctx.beginPath();
      ctx.arc(pad + starPoints[s][1] * cs, pad + starPoints[s][0] * cs, Math.max(3, cs * 0.1), 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.board && this.board.length > 0) {
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (this.board[r][c] !== 0) {
            this._drawStone(ctx, pad + c * cs, pad + r * cs, this.board[r][c], cs);
          }
        }
      }
    }

    if (this.lastMove) {
      var lx = pad + this.lastMove.col * cs;
      var ly = pad + this.lastMove.row * cs;
      ctx.strokeStyle = this.lastMove.player === 1 ? '#FF4444' : '#CC0000';
      ctx.lineWidth = 2;
      var markSize = cs * 0.2;
      ctx.beginPath();
      ctx.arc(lx, ly, markSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.winLine && this.winLine.length >= 5) {
      ctx.strokeStyle = 'rgba(194, 123, 102, 0.8)';
      ctx.lineWidth = Math.max(3, cs * 0.12);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pad + this.winLine[0].col * cs, pad + this.winLine[0].row * cs);
      for (var w = 1; w < this.winLine.length; w++) {
        ctx.lineTo(pad + this.winLine[w].col * cs, pad + this.winLine[w].row * cs);
      }
      ctx.stroke();
    }

    if (this.hoverPos && !this.isSpectator && this.isMyTurn) {
      var hx = pad + this.hoverPos.col * cs;
      var hy = pad + this.hoverPos.row * cs;
      if (this.board[this.hoverPos.row][this.hoverPos.col] === 0) {
        ctx.globalAlpha = 0.4;
        this._drawStone(ctx, hx, hy, this.myColor, cs);
        ctx.globalAlpha = 1;
      }
    }
  };

  GomokuRoomUI.prototype._drawStone = function(ctx, x, y, player, cellSize) {
    var radius = cellSize * 0.42;
    ctx.save();
    if (player === 1) {
      var grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
      grad.addColorStop(0, '#555555');
      grad.addColorStop(1, '#1A1A1A');
      ctx.fillStyle = grad;
    } else {
      var grad = ctx.createRadialGradient(x - radius * 0.3, y - radius * 0.3, radius * 0.1, x, y, radius);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(1, '#E8E0D0');
      ctx.fillStyle = grad;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = player === 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  GomokuRoomUI.prototype.updateGameState = function(state) {
    this.boardSize = state.boardSize || 15;
    this.board = state.board || [];
    this.lastMove = state.lastMove || null;
    this.winLine = state.winLine || null;
    this.myColor = state.myColor || 0;
    this.isMyTurn = state.isMyTurn || false;
    this.isSpectator = state.isSpectator || false;

    if (this.canvas) {
      this.canvas.classList.toggle('spectator', this.isSpectator);
    }

    this._resizeCanvas();
    this._drawBoard();
    this._updatePlayerBars(state);
    this._updateActionBar(state);
    this._updateUndoPopup(state);
    this._updateGameEnd(state);
    this._updateSpectatorList(state);
  };

  GomokuRoomUI.prototype._updatePlayerBars = function(state) {
    var players = state.players || [];
    var blackPlayer = null;
    var whitePlayer = null;
    var myId = null;

    for (var i = 0; i < players.length; i++) {
      if (players[i].color === 'black') blackPlayer = players[i];
      if (players[i].color === 'white') whitePlayer = players[i];
    }

    var isBlack = state.myColor === 1;
    var isWhite = state.myColor === 2;

    if (isBlack) {
      this._renderMyBar(state, 'black');
      this._renderOpponentBar(whitePlayer, state.currentPlayer === 2);
    } else if (isWhite) {
      this._renderMyBar(state, 'white');
      this._renderOpponentBar(blackPlayer, state.currentPlayer === 1);
    } else {
      this._renderOpponentBar(blackPlayer, state.currentPlayer === 1);
      this._renderMyBar(state, 'spectator');
    }
  };

  GomokuRoomUI.prototype._renderOpponentBar = function(player, isTurn) {
    if (!player) {
      this.elements.opponentBar.innerHTML = '<span style="color:var(--go-sage);font-size:13px;">等待对手加入...</span>';
      return;
    }
    var avatarSrc = 'images/avatars/' + (player.avatar || 'froggy') + '.gif';
    this.elements.opponentBar.innerHTML =
      '<img class="avatar-img" src="' + avatarSrc + '" alt="avatar">' +
      '<span class="nickname">' + (player.nickname || '对手') + '</span>' +
      '<span class="stone-indicator ' + (player.color === 'black' ? 'black' : 'white') + '"></span>' +
      (isTurn ? '<span class="turn-badge">思考中</span>' : '');
  };

  GomokuRoomUI.prototype._renderMyBar = function(state, color) {
    var isTurn = state.isMyTurn;
    var colorClass = color === 'black' ? 'black' : (color === 'white' ? 'white' : '');
    var nickname = '';
    var avatar = 'froggy';
    var players = state.players || [];
    for (var i = 0; i < players.length; i++) {
      if (players[i].color === color || (color === 'spectator' && players[i].id === state.myColor)) {
        nickname = players[i].nickname;
        avatar = players[i].avatar;
      }
    }
    if (!nickname && state.isSpectator) {
      nickname = '观众';
      colorClass = '';
    }
    var avatarSrc = 'images/avatars/' + (avatar || 'froggy') + '.gif';
    this.elements.myBar.innerHTML =
      '<img class="avatar-img" src="' + avatarSrc + '" alt="avatar">' +
      '<span class="nickname">' + (nickname || '我') + '</span>' +
      (colorClass ? '<span class="stone-indicator ' + colorClass + '"></span>' : '') +
      (isTurn ? '<span class="turn-badge">轮到你了</span>' : '') +
      (state.isSpectator ? '<span class="spectator-badge">观战中</span>' : '');
  };

  GomokuRoomUI.prototype._updateActionBar = function(state) {
    if (state.phase === 'WAITING') {
      this.elements.actionBar.innerHTML =
        '<button class="btn-action primary" id="start-btn">开始游戏</button>';
      var self = this;
      document.getElementById('start-btn').addEventListener('click', function() {
        if (self.onStartGame) self.onStartGame();
      });
    } else if (state.phase === 'PLAYING') {
      this.elements.actionBar.innerHTML =
        '<button class="btn-action" id="undo-btn"' + (state.isSpectator ? ' disabled' : '') + '>悔棋</button>' +
        '<button class="btn-action danger" id="resign-btn"' + (state.isSpectator ? ' disabled' : '') + '>认输</button>';
      var self = this;
      document.getElementById('undo-btn').addEventListener('click', function() {
        if (self.onUndoRequest) self.onUndoRequest();
      });
      document.getElementById('resign-btn').addEventListener('click', function() {
        if (self.onResign) self.onResign();
      });
    } else if (state.phase === 'FINISHED') {
      this.elements.actionBar.innerHTML =
        '<button class="btn-action accent" id="reset-btn">再来一局</button>';
      var self = this;
      document.getElementById('reset-btn').addEventListener('click', function() {
        if (self.onResetGame) self.onResetGame();
      });
    }
  };

  GomokuRoomUI.prototype._updateUndoPopup = function(state) {
    if (!state.undoRequest) {
      this.elements.undoPopup.style.display = 'none';
      return;
    }
    if (state.undoRequest.player === state.myColor) return;
    this.elements.undoPopup.style.display = 'block';
    var self = this;
    this.elements.undoAcceptBtn.onclick = function() {
      self.elements.undoPopup.style.display = 'none';
      if (self.onUndoAccept) self.onUndoAccept();
    };
    this.elements.undoRejectBtn.onclick = function() {
      self.elements.undoPopup.style.display = 'none';
      if (self.onUndoReject) self.onUndoReject();
    };
  };

  GomokuRoomUI.prototype._updateGameEnd = function(state) {
    if (state.phase !== 'FINISHED' || !state.winner) {
      this.elements.gameEndOverlay.style.display = 'none';
      return;
    }
    this.elements.gameEndOverlay.style.display = 'flex';

    var title = '';
    var detail = '';
    if (state.winner === 'draw') {
      title = '平局';
      detail = '棋盘已满';
    } else if (state.winner === state.myColor) {
      title = '你赢了';
      detail = state.winReason === 'five' ? '五子连珠' : (state.winReason === 'resign' ? '对手认输' : state.winReason);
    } else if (state.isSpectator) {
      title = (state.winner === 1 ? '黑方' : '白方') + '获胜';
      detail = state.winReason === 'five' ? '五子连珠' : state.winReason;
    } else {
      title = '你输了';
      detail = state.winReason === 'five' ? '对手五子连珠' : (state.winReason === 'resign' ? '你认输了' : state.winReason);
    }
    this.elements.gameEndTitle.textContent = title;
    this.elements.gameEndDetail.textContent = detail;
  };

  GomokuRoomUI.prototype._updateSpectatorList = function(state) {
    var spectators = (state.players || []).filter(function(p) { return p.color === 'spectator'; });
    if (spectators.length === 0) {
      this.elements.spectatorList.style.display = 'none';
      return;
    }
    this.elements.spectatorList.style.display = 'block';
    this.elements.spectatorList.innerHTML =
      '<div class="spec-title">观众 ' + spectators.length + '</div>' +
      spectators.map(function(s) { return '<div>' + s.nickname + '</div>'; }).join('');
  };

  GomokuRoomUI.prototype.showNotification = function(msg) {
    var el = this.elements.notification;
    el.textContent = msg;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = 'fadeInOut 2s ease-in-out';
    setTimeout(function() { el.style.display = 'none'; }, 2000);
  };

  GomokuRoomUI.prototype.onPlaceStone = null;
  GomokuRoomUI.prototype.onStartGame = null;
  GomokuRoomUI.prototype.onUndoRequest = null;
  GomokuRoomUI.prototype.onUndoAccept = null;
  GomokuRoomUI.prototype.onUndoReject = null;
  GomokuRoomUI.prototype.onResign = null;
  GomokuRoomUI.prototype.onResetGame = null;

  return GomokuRoomUI;
})();

try { module.exports = GomokuRoomUI; } catch (e) { window.GomokuRoomUI = GomokuRoomUI; }
