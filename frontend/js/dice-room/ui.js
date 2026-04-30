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
      myDiceAdjust: document.getElementById('my-dice-adjust'),
      myDicePreview: document.getElementById('my-dice-preview'),
      rollBtn: document.getElementById('roll-btn'),
      revealSelfBtn: document.getElementById('reveal-self-btn'),
      revealAllBtn: document.getElementById('reveal-all-btn'),
      addDiceBtn: document.getElementById('add-dice-btn'),
      removeDiceBtn: document.getElementById('remove-dice-btn'),
      confirmRoundBtn: document.getElementById('confirm-round-btn'),
      endGameBtn: document.getElementById('end-game-btn'),
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
      voteOverlay: document.getElementById('vote-overlay'),
      voteDesc: document.getElementById('vote-desc'),
      voteStatus: document.getElementById('vote-status'),
      voteActions: document.getElementById('vote-actions'),
      voteYesBtn: document.getElementById('vote-yes-btn'),
      voteNoBtn: document.getElementById('vote-no-btn'),
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

    bindEvent(this.elements.revealSelfBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('revealSelf');
    });

    bindEvent(this.elements.revealAllBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('requestRevealAll');
    });

    bindEvent(this.elements.addDiceBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('addDice');
    });

    bindEvent(this.elements.removeDiceBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('removeDice');
    });

    bindEvent(this.elements.confirmRoundBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('confirmRound');
    });

    bindEvent(this.elements.endGameBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('endGame');
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

    bindEvent(this.elements.voteYesBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('voteRevealAll', { vote: true });
      if (self.elements.voteOverlay) self.elements.voteOverlay.style.display = 'none';
    });

    bindEvent(this.elements.voteNoBtn, function () {
      if (window.diceGameManager) diceGameManager.sendGameAction('voteRevealAll', { vote: false });
      if (self.elements.voteOverlay) self.elements.voteOverlay.style.display = 'none';
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
    var roundNum = state.roundNumber || 0;
    var phaseText = {
      WAITING: '等待开始',
      ROLLING: '第' + roundNum + '局 - 摇骰中',
      REVEAL: '第' + roundNum + '局 - 公开阶段',
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
        var info = '基础骰: ' + state.diceCount;
        if (state.myDiceTotal && state.myDiceTotal !== state.diceCount && phase === 'REVEAL') {
          info += ' | 我下局: ' + state.myDiceTotal;
        }
        this.elements.roundInfo.textContent = info;
      } else {
        this.elements.roundInfo.textContent = '';
      }
    }

    var isMyTurn = state.isMyTurn || false;
    var hasRolled = false;
    var me = (state.players || []).find(function (p) { return p.id === this.myPlayerId; }.bind(this));
    if (me && me.diceValues && me.diceValues.length > 0) hasRolled = true;

    var allRolled = (state.players || []).every(function (p) { return p.diceCount > 0 || (p.diceValues && p.diceValues.length > 0); });
    var iConfirmed = me && me.confirmed;

    if (this.elements.rollBtn) {
      this.elements.rollBtn.style.display = (phase === 'ROLLING' && isMyTurn && !hasRolled) ? 'inline-block' : 'none';
    }
    if (this.elements.revealSelfBtn) {
      this.elements.revealSelfBtn.style.display = (phase === 'ROLLING' && hasRolled && !me.diceRevealed) ? 'inline-block' : 'none';
    }
    if (this.elements.revealAllBtn) {
      this.elements.revealAllBtn.style.display = (phase === 'ROLLING' && allRolled) ? 'inline-block' : 'none';
    }
    if (this.elements.addDiceBtn) {
      this.elements.addDiceBtn.style.display = (phase === 'REVEAL') ? 'inline-block' : 'none';
    }
    if (this.elements.removeDiceBtn) {
      this.elements.removeDiceBtn.style.display = (phase === 'REVEAL') ? 'inline-block' : 'none';
    }
    if (this.elements.confirmRoundBtn) {
      if (phase === 'REVEAL' && !iConfirmed) {
        this.elements.confirmRoundBtn.style.display = 'inline-block';
        this.elements.confirmRoundBtn.textContent = '确认结束本局';
      } else if (phase === 'REVEAL' && iConfirmed) {
        this.elements.confirmRoundBtn.style.display = 'inline-block';
        this.elements.confirmRoundBtn.textContent = '已确认 ✓';
        this.elements.confirmRoundBtn.disabled = true;
        this.elements.confirmRoundBtn.style.opacity = '0.6';
      } else {
        this.elements.confirmRoundBtn.style.display = 'none';
        this.elements.confirmRoundBtn.disabled = false;
        this.elements.confirmRoundBtn.style.opacity = '1';
      }
    }
    if (this.elements.endGameBtn) {
      this.elements.endGameBtn.style.display = (state.isHost && (phase === 'ROLLING' || phase === 'REVEAL')) ? 'inline-block' : 'none';
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

      if (player.confirmed && state.phase === 'REVEAL') {
        var checkMark = document.createElement('div');
        checkMark.style.cssText = 'color:#27AE60;font-size:10px;margin-top:2px;';
        checkMark.textContent = '✓ 已确认';
        seat.appendChild(diceInfo);
        seat.appendChild(checkMark);
      } else {
        seat.appendChild(diceInfo);
      }

      if (player.diceAdjust && player.diceAdjust !== 0 && state.phase === 'REVEAL') {
        var adjustBadge = document.createElement('div');
        adjustBadge.style.cssText = 'font-size:9px;font-weight:700;margin-top:1px;';
        adjustBadge.style.color = player.diceAdjust > 0 ? '#6fa3ff' : '#ff6b6b';
        adjustBadge.textContent = (player.diceAdjust > 0 ? '+' : '') + player.diceAdjust + '骰(→' + (player.diceTotal || '?') + ')';
        seat.appendChild(adjustBadge);
      }

      container.appendChild(seat);
    });
  };

  UI.prototype.updateMyArea = function (state) {
    var me = (state.players || []).find(function (p) { return p.id === this.myPlayerId; }.bind(this));
    if (!me) return;

    if (this.elements.myAvatar) this.elements.myAvatar.src = 'images/avatars/' + (me.avatar || 'bear') + '.gif';
    if (this.elements.myName) this.elements.myName.textContent = me.nickname || '--';
    if (this.elements.myCupStatus) this.elements.myCupStatus.textContent = '骰盅: ' + (me.diceCount || 0) + '颗';

    if (this.elements.myDiceAdjust) {
      var adjust = me.diceAdjust || 0;
      if (adjust !== 0 && state.phase === 'REVEAL') {
        this.elements.myDiceAdjust.style.display = 'inline-block';
        this.elements.myDiceAdjust.textContent = (adjust > 0 ? '+' : '') + adjust + '骰(下局' + (me.diceTotal || state.diceCount) + '颗)';
        this.elements.myDiceAdjust.className = 'dice-adjust-badge ' + (adjust > 0 ? 'positive' : 'negative');
      } else {
        this.elements.myDiceAdjust.style.display = 'none';
      }
    }

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

      if (player.confirmed && state.phase === 'REVEAL') {
        var confirmBadge = document.createElement('span');
        confirmBadge.style.cssText = 'color:#27AE60;font-size:11px;margin-left:8px;';
        confirmBadge.textContent = '✓';
        row.appendChild(confirmBadge);
      }

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

  UI.prototype.showVotePopup = function (requesterName, voteStatus) {
    if (!this.elements.voteOverlay) return;
    if (this.elements.voteDesc) {
      this.elements.voteDesc.textContent = (requesterName || '有人') + ' 申请全员公开骰子';
    }
    if (this.elements.voteStatus && voteStatus) {
      var agreed = voteStatus.agreed || 0;
      var total = voteStatus.total || 0;
      this.elements.voteStatus.textContent = '投票进度: ' + agreed + '/' + total + ' 人同意';
    }
    if (this.elements.voteActions) {
      this.elements.voteActions.style.display = 'flex';
    }
    this.elements.voteOverlay.style.display = 'flex';
  };

  UI.prototype.hideVotePopup = function () {
    if (this.elements.voteOverlay) {
      this.elements.voteOverlay.style.display = 'none';
    }
  };

  return UI;
})();
