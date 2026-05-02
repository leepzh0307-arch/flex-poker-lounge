var GomokuRoomUI = (function() {

  var INITIAL_VIEW_SIZE = 9;
  var VIEW_MARGIN = 2;
  var ANIM_DURATION = 400;

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

    this.viewMinRow = 0;
    this.viewMaxRow = 0;
    this.viewMinCol = 0;
    this.viewMaxCol = 0;

    this.animating = false;
    this.animStartMinRow = 0;
    this.animStartMaxRow = 0;
    this.animStartMinCol = 0;
    this.animStartMaxCol = 0;
    this.animTargetMinRow = 0;
    this.animTargetMaxRow = 0;
    this.animTargetMinCol = 0;
    this.animTargetMaxCol = 0;
    this.animStartTime = 0;
  }

  GomokuRoomUI.prototype.init = function() {
    this.elements.opponentBar = document.getElementById('opponent-bar');
    this.elements.myBar = document.getElementById('my-bar');
    this.elements.boardContainer = document.getElementById('board-container');
    this.elements.actionBar = document.getElementById('action-bar');
    this.elements.undoPopup = document.getElementById('undo-popup');
    this.elements.undoAcceptBtn = document.getElementById('undo-accept-btn');
    this.elements.undoRejectBtn = document.getElementById('undo-reject-btn');
    this.elements.gameEndOverlay = document.getElementById('game-end-overlay');
    this.elements.gameEndTitle = document.getElementById('game-end-title');
    this.elements.gameEndDetail = document.getElementById('game-end-detail');
    this.elements.spectatorList = document.getElementById('spectator-list');
    this.elements.notification = document.getElementById('notification');

    this._setupCanvas();
    this._setupCanvasEvents();
  };

  GomokuRoomUI.prototype._initViewport = function() {
    var bs = this.boardSize;
    var half = Math.floor(INITIAL_VIEW_SIZE / 2);
    var center = Math.floor(bs / 2);
    this.viewMinRow = Math.max(0, center - half);
    this.viewMaxRow = Math.min(bs - 1, center + half);
    this.viewMinCol = Math.max(0, center - half);
    this.viewMaxCol = Math.min(bs - 1, center + half);
  };

  GomokuRoomUI.prototype._computeTargetViewport = function() {
    var bs = this.boardSize;
    var minR = bs, maxR = 0, minC = bs, maxC = 0;
    var hasStones = false;

    if (this.board && this.board.length > 0) {
      for (var r = 0; r < bs; r++) {
        for (var c = 0; c < bs; c++) {
          if (this.board[r][c] !== 0) {
            hasStones = true;
            if (r < minR) minR = r;
            if (r > maxR) maxR = r;
            if (c < minC) minC = c;
            if (c > maxC) maxC = c;
          }
        }
      }
    }

    if (!hasStones) {
      var half = Math.floor(INITIAL_VIEW_SIZE / 2);
      var center = Math.floor(bs / 2);
      return {
        minRow: Math.max(0, center - half),
        maxRow: Math.min(bs - 1, center + half),
        minCol: Math.max(0, center - half),
        maxCol: Math.min(bs - 1, center + half)
      };
    }

    var tMinR = Math.max(0, minR - VIEW_MARGIN);
    var tMaxR = Math.min(bs - 1, maxR + VIEW_MARGIN);
    var tMinC = Math.max(0, minC - VIEW_MARGIN);
    var tMaxC = Math.min(bs - 1, maxC + VIEW_MARGIN);

    var viewH = tMaxR - tMinR + 1;
    var viewW = tMaxC - tMinC + 1;
    if (viewH < INITIAL_VIEW_SIZE) {
      var expand = INITIAL_VIEW_SIZE - viewH;
      tMinR = Math.max(0, tMinR - Math.floor(expand / 2));
      tMaxR = Math.min(bs - 1, tMinR + INITIAL_VIEW_SIZE - 1);
      tMinR = Math.max(0, tMaxR - INITIAL_VIEW_SIZE + 1);
    }
    if (viewW < INITIAL_VIEW_SIZE) {
      var expand = INITIAL_VIEW_SIZE - viewW;
      tMinC = Math.max(0, tMinC - Math.floor(expand / 2));
      tMaxC = Math.min(bs - 1, tMinC + INITIAL_VIEW_SIZE - 1);
      tMinC = Math.max(0, tMaxC - INITIAL_VIEW_SIZE + 1);
    }

    return { minRow: tMinR, maxRow: tMaxR, minCol: tMinC, maxCol: tMaxC };
  };

  GomokuRoomUI.prototype._updateViewport = function() {
    var target = this._computeTargetViewport();
    var changed = target.minRow !== this.viewMinRow || target.maxRow !== this.viewMaxRow ||
                  target.minCol !== this.viewMinCol || target.maxCol !== this.viewMaxCol;

    if (changed) {
      this.animStartMinRow = this.viewMinRow;
      this.animStartMaxRow = this.viewMaxRow;
      this.animStartMinCol = this.viewMinCol;
      this.animStartMaxCol = this.viewMaxCol;
      this.animTargetMinRow = target.minRow;
      this.animTargetMaxRow = target.maxRow;
      this.animTargetMinCol = target.minCol;
      this.animTargetMaxCol = target.maxCol;
      this.animStartTime = performance.now();
      this.animating = true;
      this._animateViewport();
    }
  };

  GomokuRoomUI.prototype._animateViewport = function() {
    if (!this.animating) return;
    var now = performance.now();
    var elapsed = now - this.animStartTime;
    var t = Math.min(1, elapsed / ANIM_DURATION);
    var ease = 1 - Math.pow(1 - t, 3);

    this.viewMinRow = Math.round(this.animStartMinRow + (this.animTargetMinRow - this.animStartMinRow) * ease);
    this.viewMaxRow = Math.round(this.animStartMaxRow + (this.animTargetMaxRow - this.animStartMaxRow) * ease);
    this.viewMinCol = Math.round(this.animStartMinCol + (this.animTargetMinCol - this.animStartMinCol) * ease);
    this.viewMaxCol = Math.round(this.animStartMaxCol + (this.animTargetMaxCol - this.animStartMaxCol) * ease);

    this._resizeCanvas();
    this._drawBoard();

    if (t < 1) {
      var self = this;
      requestAnimationFrame(function() { self._animateViewport(); });
    } else {
      this.animating = false;
    }
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
    this._initViewport();
    this._resizeCanvas();
    var self = this;
    window.addEventListener('resize', function() { self._resizeCanvas(); self._drawBoard(); });
  };

  GomokuRoomUI.prototype._resizeCanvas = function() {
    var container = this.elements.boardContainer;
    var maxW = container.clientWidth - 16;
    var maxH = container.clientHeight - 16;
    var size = Math.min(maxW, maxH);

    var viewRows = this.viewMaxRow - this.viewMinRow + 1;
    var viewCols = this.viewMaxCol - this.viewMinCol + 1;
    var viewSize = Math.max(viewRows, viewCols);

    this.cellSize = Math.floor(size / (viewSize + 1));
    this.padding = this.cellSize;

    var canvasW = this.cellSize * (viewCols - 1) + this.padding * 2;
    var canvasH = this.cellSize * (viewRows - 1) + this.padding * 2;

    var dpr = window.devicePixelRatio || 1;
    this.canvas.width = canvasW * dpr;
    this.canvas.height = canvasH * dpr;
    this.canvas.style.width = canvasW + 'px';
    this.canvas.style.height = canvasH + 'px';
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
    var col = Math.round((x - this.padding) / this.cellSize) + this.viewMinCol;
    var row = Math.round((y - this.padding) / this.cellSize) + this.viewMinRow;
    if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return null;
    return { row: row, col: col };
  };

  GomokuRoomUI.prototype._gridToCanvas = function(row, col) {
    return {
      x: this.padding + (col - this.viewMinCol) * this.cellSize,
      y: this.padding + (row - this.viewMinRow) * this.cellSize
    };
  };

  GomokuRoomUI.prototype._drawBoard = function() {
    var ctx = this.ctx;
    var cs = this.cellSize;
    var pad = this.padding;
    var bs = this.boardSize;
    var vMinR = this.viewMinRow;
    var vMaxR = this.viewMaxRow;
    var vMinC = this.viewMinCol;
    var vMaxC = this.viewMaxCol;

    var canvasW = this.canvas.width / (window.devicePixelRatio || 1);
    var canvasH = this.canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.fillStyle = '#DCB35C';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.strokeStyle = '#5C4A1E';
    ctx.lineWidth = 1;
    for (var r = vMinR; r <= vMaxR; r++) {
      var pos1 = this._gridToCanvas(r, vMinC);
      var pos2 = this._gridToCanvas(r, vMaxC);
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }
    for (var c = vMinC; c <= vMaxC; c++) {
      var pos1 = this._gridToCanvas(vMinR, c);
      var pos2 = this._gridToCanvas(vMaxR, c);
      ctx.beginPath();
      ctx.moveTo(pos1.x, pos1.y);
      ctx.lineTo(pos2.x, pos2.y);
      ctx.stroke();
    }

    var starPoints = bs === 15 ? [[3,3],[3,7],[3,11],[7,3],[7,7],[7,11],[11,3],[11,7],[11,11]] :
                     bs === 13 ? [[3,3],[3,9],[6,6],[9,3],[9,9]] : [[2,2],[2,6],[4,4],[6,2],[6,6]];
    ctx.fillStyle = '#5C4A1E';
    for (var s = 0; s < starPoints.length; s++) {
      var sr = starPoints[s][0], sc = starPoints[s][1];
      if (sr >= vMinR && sr <= vMaxR && sc >= vMinC && sc <= vMaxC) {
        var sp = this._gridToCanvas(sr, sc);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, Math.max(3, cs * 0.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.board && this.board.length > 0) {
      for (var r = vMinR; r <= vMaxR; r++) {
        for (var c = vMinC; c <= vMaxC; c++) {
          if (r >= 0 && r < bs && c >= 0 && c < bs && this.board[r][c] !== 0) {
            var p = this._gridToCanvas(r, c);
            this._drawStone(ctx, p.x, p.y, this.board[r][c], cs);
          }
        }
      }
    }

    if (this.lastMove) {
      var lp = this._gridToCanvas(this.lastMove.row, this.lastMove.col);
      ctx.strokeStyle = this.lastMove.player === 1 ? '#FF4444' : '#CC0000';
      ctx.lineWidth = 2;
      var markSize = cs * 0.2;
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, markSize, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.winLine && this.winLine.length >= 5) {
      ctx.strokeStyle = 'rgba(194, 123, 102, 0.8)';
      ctx.lineWidth = Math.max(3, cs * 0.12);
      ctx.lineCap = 'round';
      var wp0 = this._gridToCanvas(this.winLine[0].row, this.winLine[0].col);
      ctx.beginPath();
      ctx.moveTo(wp0.x, wp0.y);
      for (var w = 1; w < this.winLine.length; w++) {
        var wp = this._gridToCanvas(this.winLine[w].row, this.winLine[w].col);
        ctx.lineTo(wp.x, wp.y);
      }
      ctx.stroke();
    }

    if (this.hoverPos && !this.isSpectator && this.isMyTurn) {
      var hr = this.hoverPos.row, hc = this.hoverPos.col;
      if (hr >= vMinR && hr <= vMaxR && hc >= vMinC && hc <= vMaxC &&
          this.board && hr < bs && hc < bs && this.board[hr][hc] === 0) {
        var hp = this._gridToCanvas(hr, hc);
        ctx.globalAlpha = 0.4;
        this._drawStone(ctx, hp.x, hp.y, this.myColor, cs);
        ctx.globalAlpha = 1;
      }
    }

    if (vMinR > 0 || vMaxR < bs - 1 || vMinC > 0 || vMaxC < bs - 1) {
      ctx.fillStyle = 'rgba(45, 58, 49, 0.5)';
      ctx.font = Math.max(10, cs * 0.3) + 'px Source Sans 3';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (vMinR > 0) {
        var labelY = pad * 0.5;
        for (var c = vMinC; c <= vMaxC; c++) {
          var lx = this._gridToCanvas(vMinR, c).x;
          ctx.fillText(String(bs - c), lx, labelY);
        }
      }
      if (vMaxR < bs - 1) {
        var bottomY = canvasH - pad * 0.5;
        for (var c = vMinC; c <= vMaxC; c++) {
          var lx = this._gridToCanvas(vMaxR, c).x;
          ctx.fillText(String(bs - c), lx, bottomY);
        }
      }
      if (vMinC > 0) {
        var labelX = pad * 0.5;
        for (var r = vMinR; r <= vMaxR; r++) {
          var ly = this._gridToCanvas(r, vMinC).y;
          var colLetter = String.fromCharCode(65 + r);
          ctx.fillText(colLetter, labelX, ly);
        }
      }
      if (vMaxC < bs - 1) {
        var rightX = canvasW - pad * 0.5;
        for (var r = vMinR; r <= vMaxR; r++) {
          var ly = this._gridToCanvas(r, vMaxC).y;
          var colLetter = String.fromCharCode(65 + r);
          ctx.fillText(colLetter, rightX, ly);
        }
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
    var prevBoard = this.board;
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

    var isNewGame = (!prevBoard || prevBoard.length === 0) && this.board.length > 0;
    var isBoardCleared = prevBoard && prevBoard.length > 0 && (this.board.length === 0 || (state.phase === 'WAITING'));

    if (isNewGame || isBoardCleared || this.viewMaxRow === 0) {
      this._initViewport();
    }

    this._updateViewport();

    if (!this.animating) {
      this._resizeCanvas();
      this._drawBoard();
    }

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
