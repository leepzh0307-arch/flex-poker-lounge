var DiceRoomUI = (function () {
  function UI() {
    this.elements = {};
    this.myPlayerId = null;
    this.isHost = false;
    this.currentGameState = null;
    this.notificationTimeout = null;
    this._cacheElements();
    this.bindEvents();
  }

  UI.prototype._cacheElements = function () {
    this.elements = {
      roomId: document.getElementById('room-id'),
      copyRoom: document.getElementById('copy-room'),
      connectionStatus: document.getElementById('connection-status'),
      voiceToggle: document.getElementById('voice-toggle'),
      exitRoom: document.getElementById('exit-room'),
      diceCanvas: document.getElementById('dice-canvas'),
      diceCanvasWrapper: document.getElementById('dice-canvas-wrapper'),
      playersCircle: document.getElementById('players-circle'),
      gamePhaseText: document.getElementById('game-phase-text'),
      roundInfo: document.getElementById('round-info'),
      publicDiceArea: document.getElementById('public-dice-area'),
      publicDiceGrid: document.getElementById('public-dice-grid'),
      myAvatar: document.getElementById('my-avatar'),
      myName: document.getElementById('my-name'),
      myCupStatus: document.getElementById('my-cup-status'),
      myDicePreview: document.getElementById('my-dice-preview'),
      rollBtn: document.getElementById('roll-btn'),
      revealBtn: document.getElementById('reveal-btn'),
      addDiceBtn: document.getElementById('add-dice-btn'),
      removeDiceBtn: document.getElementById('remove-dice-btn'),
      confirmBtn: document.getElementById('confirm-btn'),
      hostPanel: document.getElementById('host-panel'),
      diceCountSelect: document.getElementById('dice-count-select'),
      startGameBtn: document.getElementById('start-game'),
      notification: document.getElementById('notification'),
      notificationText: document.getElementById('notification-text'),
      gameOverOverlay: document.getElementById('game-over-overlay'),
      gameOverTitle: document.getElementById('game-over-title'),
      gameOverResults: document.getElementById('game-over-results'),
      playAgainBtn: document.getElementById('play-again-btn'),
      backToLobbyBtn: document.getElementById('back-to-lobby-btn'),
    };
  };

  UI.prototype.bindEvents = function () {
    var self = this;
    var bindEvent = function (el, handler) {
      if (el) el.addEventListener('click', handler);
    };

    bindEvent(this.elements.copyRoom, function () {
      var text = self.elements.roomId.textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
    });

    bindEvent(this.elements.exitRoom, function () {
      if (window.agoraVoice) agoraVoice.leaveChannel();
      window.location.href = 'index.html';
    });

    bindEvent(this.elements.rollBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('rollDice');
    });

    bindEvent(this.elements.revealBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('revealAll');
    });

    bindEvent(this.elements.addDiceBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('addDice');
    });

    bindEvent(this.elements.removeDiceBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('removeDice');
    });

    bindEvent(this.elements.confirmBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('confirmDice');
    });

    bindEvent(this.elements.startGameBtn, function () {
      var count = self.elements.diceCountSelect ? parseInt(self.elements.diceCountSelect.value) : 5;
      if (window.diceGameManager) diceGameManager.sendGameAction('startGame', { diceCount: count });
    });

    bindEvent(this.elements.playAgainBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('resetGame');
      self.elements.gameOverOverlay.style.display = 'none';
    });

    bindEvent(self.elements.backToLobbyBtn, function () {
      window.location.href = 'index.html';
    });

    window.addEventListener('resize', function () {
      if (Dice3D) Dice3D.updateSceneSize();
    });
  };

  UI.prototype.setMyPlayerId = function (id) {
    this.myPlayerId = id;
  };

  UI.prototype.setHost = function (isHost) {
    this.isHost = isHost;
    if (this.elements.hostPanel) {
      var phase = this.currentGameState ? this.currentGameState.phase : 'WAITING';
      this.elements.hostPanel.style.display = (isHost && phase === 'WAITING') ? 'block' : 'none';
    }
  };

  UI.prototype.updateRoomId = function (id) {
    if (this.elements.roomId) this.elements.roomId.textContent = id;
  };

  UI.prototype.updateConnectionStatus = function (status) {
    if (this.elements.connectionStatus) {
      if (status === '已连接') {
        this.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink-3.svg" alt="已连接" class="icon-sm">';
      } else {
        this.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink-broken.svg" alt="已断开" class="icon-sm">';
      }
    }
  };

  UI.prototype.showNotification = function (text, duration) {
    var self = this;
    if (this.elements.notification) {
      this.elements.notification.style.display = 'block';
      this.elements.notificationText.textContent = text;
    }
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(function () {
      if (self.elements.notification) self.elements.notification.style.display = 'none';
    }, duration || 3000);
  };

  UI.prototype.updateGameState = function (state) {
    this.currentGameState = state;
    var phase = state.phase || 'WAITING';

    this.updatePhaseUI(phase, state);
    this.updatePlayersCircle(state);
    this.updateMyArea(state);
    this.updatePublicDice(state);
  };

  UI.prototype.updatePhaseUI = function (phase, state) {
    var phaseText = {
      WAITING: '等待开始',
      ROLLING: '摇骰中...',
      REVEAL: '公开阶段',
      GAME_END: '游戏结束',
    };

    if (this.elements.gamePhaseText) {
      this.elements.gamePhaseText.textContent = phaseText[phase] || phase;
    }

    if (this.elements.hostPanel) {
      this.elements.hostPanel.style.display = (phase === 'WAITING' && this.isHost) ? 'block' : 'none';
    }

    if (this.elements.roundInfo) {
      if (state.diceCount) {
        this.elements.roundInfo.textContent = '骰子数: ' + state.diceCount;
      } else {
        this.elements.roundInfo.textContent = '';
      }
    }

    var isMyTurn = state.isMyTurn || false;
    var isRevealer = state.isRevealer || false;
    var hasRolled = false;
    var me = (state.players || []).find(function (p) { return p.id === this.myPlayerId; }.bind(this));
    if (me && me.diceValues && me.diceValues.length > 0) hasRolled = true;

    if (this.elements.rollBtn) {
      this.elements.rollBtn.style.display = (phase === 'ROLLING' && isMyTurn && !hasRolled) ? 'inline-block' : 'none';
    }
    if (this.elements.revealBtn) {
      var allRolled = (state.players || []).every(function (p) { return p.diceCount > 0 || (p.diceValues && p.diceValues.length > 0); });
      this.elements.revealBtn.style.display = (phase === 'ROLLING' && allRolled) ? 'inline-block' : 'none';
    }
    if (this.elements.addDiceBtn) {
      this.elements.addDiceBtn.style.display = (phase === 'REVEAL') ? 'inline-block' : 'none';
    }
    if (this.elements.removeDiceBtn) {
      this.elements.removeDiceBtn.style.display = (phase === 'REVEAL') ? 'inline-block' : 'none';
    }
    if (this.elements.confirmBtn) {
      this.elements.confirmBtn.style.display = (phase === 'REVEAL') ? 'inline-block' : 'none';
    }
  };

  UI.prototype.updatePlayersCircle = function (state) {
    var container = this.elements.playersCircle;
    if (!container) return;
    container.innerHTML = '';

    var players = state.players || [];
    var myId = this.myPlayerId;
    var others = players.filter(function (p) { return p.id !== myId; });

    others.forEach(function (player, idx) {
      var seat = document.createElement('div');
      seat.className = 'circle-seat';

      var avatar = document.createElement('img');
      avatar.className = 'circle-avatar';
      avatar.src = 'images/avatars/' + (player.avatar || 'bear') + '.gif';
      avatar.alt = player.nickname;
      seat.appendChild(avatar);

      var name = document.createElement('div');
      name.className = 'circle-name';
      name.textContent = player.nickname || '--';
      seat.appendChild(name);

      var diceInfo = document.createElement('div');
      diceInfo.className = 'circle-dice-info';

      if (player.diceRevealed && player.diceValues && player.diceValues.length > 0) {
        player.diceValues.forEach(function (val) {
          var die = document.createElement('div');
          die.className = 'circle-die ' + (val === 1 || val === 4 ? 'dot-red' : 'dot-blue');
          die.textContent = val;
          diceInfo.appendChild(die);
        });
      } else if (player.diceCount > 0) {
        for (var i = 0; i < player.diceCount; i++) {
          var hd = document.createElement('div');
          hd.className = 'circle-die circle-die-hidden';
          hd.textContent = '?';
          diceInfo.appendChild(hd);
        }
      } else {
        var empty = document.createElement('div');
        empty.className = 'circle-die-empty';
        empty.textContent = '未摇';
        diceInfo.appendChild(empty);
      }

      seat.appendChild(diceInfo);
      container.appendChild(seat);
    });
  };

  UI.prototype.updateMyArea = function (state) {
    var me = (state.players || []).find(function (p) { return p.id === this.myPlayerId; }.bind(this));
    if (!me) return;

    if (this.elements.myAvatar) this.elements.myAvatar.src = 'images/avatars/' + (me.avatar || 'bear') + '.gif';
    if (this.elements.myName) this.elements.myName.textContent = me.nickname || '--';
    if (this.elements.myCupStatus) this.elements.myCupStatus.textContent = '骰盅: ' + (me.diceCount || 0) + '颗';

    var preview = this.elements.myDicePreview;
    if (preview) {
      preview.innerHTML = '';
      if (me.diceValues && me.diceValues.length > 0) {
        me.diceValues.forEach(function (val) {
          var die = document.createElement('div');
          die.className = 'my-die ' + (val === 1 || val === 4 ? 'red' : 'blue');
          die.textContent = val;
          preview.appendChild(die);
        });
      } else if (me.diceCount > 0) {
        for (var i = 0; i < me.diceCount; i++) {
          var die = document.createElement('div');
          die.className = 'my-die hidden-die';
          die.textContent = '?';
          preview.appendChild(die);
        }
      }
    }
  };

  UI.prototype.updatePublicDice = function (state) {
    var area = this.elements.publicDiceArea;
    var grid = this.elements.publicDiceGrid;
    if (!area || !grid) return;

    if (state.phase !== 'REVEAL' && state.phase !== 'GAME_END') {
      area.style.display = 'none';
      return;
    }

    var anyRevealed = (state.players || []).some(function (p) { return p.diceRevealed; });
    if (!anyRevealed) {
      area.style.display = 'none';
      return;
    }

    area.style.display = 'block';
    grid.innerHTML = '';

    (state.players || []).forEach(function (player) {
      var row = document.createElement('div');
      row.className = 'public-player-row';

      var nameEl = document.createElement('div');
      nameEl.className = 'public-player-name';
      nameEl.textContent = player.nickname || '--';
      row.appendChild(nameEl);

      var diceEl = document.createElement('div');
      diceEl.className = 'public-player-dice';

      if (player.diceRevealed && player.diceValues) {
        player.diceValues.forEach(function (val) {
          var die = document.createElement('div');
          die.className = 'public-die ' + (val === 1 || val === 4 ? 'red' : 'blue');
          die.textContent = val;
          diceEl.appendChild(die);
        });
      } else {
        var count = player.diceCount || 0;
        for (var i = 0; i < count; i++) {
          var die = document.createElement('div');
          die.className = 'public-die';
          die.textContent = '?';
          die.style.color = '#888';
          diceEl.appendChild(die);
        }
      }

      row.appendChild(diceEl);
      grid.appendChild(row);
    });
  };

  UI.prototype.showGameOver = function (results) {
    if (this.elements.gameOverOverlay) {
      this.elements.gameOverOverlay.style.display = 'flex';
    }
    if (this.elements.gameOverResults) {
      this.elements.gameOverResults.innerHTML = '';
      (results || []).forEach(function (r) {
        var div = document.createElement('div');
        div.className = 'game-over-result-row';
        var diceStr = (r.diceValues || []).map(function (v) {
          return '<span class="result-die ' + (v === 1 || v === 4 ? 'red' : 'blue') + '">' + v + '</span>';
        }).join('');
        div.innerHTML = '<strong>' + (r.nickname || '?') + '</strong>: ' + diceStr + ' <span class="result-total">(' + (r.total || 0) + ')</span>';
        this.elements.gameOverResults.appendChild(div);
      }.bind(this));
    }
  };

  UI.prototype.hideGameOver = function () {
    if (this.elements.gameOverOverlay) {
      this.elements.gameOverOverlay.style.display = 'none';
    }
  };

  return UI;
})();
