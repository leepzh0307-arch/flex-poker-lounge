class UnoRoomUI {
  constructor() {
    this.elements = {};
    this.currentGameState = null;
    this.myPlayerId = null;
    this.isHost = false;
    this.hostPanelVisible = false;
    this.notificationTimeout = null;
    this._prevTopCardId = null;
  }

  init() {
    this.elements = {
      roomId: document.getElementById('room-id'),
      copyRoom: document.getElementById('copy-room'),
      opponentsArea: document.getElementById('opponents-area'),
      deckPile: document.getElementById('deck-pile'),
      deckCount: document.getElementById('deck-count'),
      discardPile: document.getElementById('discard-pile'),
      emptyDiscard: document.getElementById('empty-discard'),
      directionIndicator: document.getElementById('direction-indicator'),
      currentColorIndicator: document.getElementById('current-color-indicator'),
      colorChooser: document.getElementById('color-chooser'),
      myHand: document.getElementById('my-hand'),
      myAvatar: document.getElementById('my-avatar'),
      myNickname: document.getElementById('my-nickname'),
      unoBtn: document.getElementById('uno-btn'),
      passBtn: document.getElementById('pass-btn'),
      hostPanel: document.getElementById('host-panel'),
      hostBtn: document.getElementById('host-btn'),
      startGame: document.getElementById('start-game'),
      resetGame: document.getElementById('reset-game'),
      gameNotification: document.getElementById('game-notification'),
      notificationText: document.getElementById('notification-text'),
      gameEndOverlay: document.getElementById('game-end-overlay'),
      gameEndTitle: document.getElementById('game-end-title'),
      playAgainBtn: document.getElementById('play-again-btn'),
      exitRoom: document.getElementById('exit-room'),
      voiceToggle: document.getElementById('voice-toggle'),
      connectionStatus: document.getElementById('connection-status'),
    };

    this.bindEvents();
  }

  bindEvents() {
    this.elements.copyRoom.addEventListener('click', () => {
      const roomId = this.elements.roomId.textContent;
      navigator.clipboard.writeText(roomId).then(() => {
        this.showNotification('房间号已复制');
      });
    });

    this.elements.hostBtn.addEventListener('click', () => {
      this.hostPanelVisible = !this.hostPanelVisible;
      this.elements.hostPanel.style.display = this.hostPanelVisible ? 'flex' : 'none';
    });

    this.elements.exitRoom.addEventListener('click', () => {
      window.location.href = '/';
    });

    this.elements.colorChooser.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const color = opt.dataset.color;
        if (this.onChooseColor) this.onChooseColor(color);
        this.elements.colorChooser.classList.remove('visible');
      });
    });

    this.elements.playAgainBtn.addEventListener('click', () => {
      this.elements.gameEndOverlay.style.display = 'none';
      if (this.onResetGame) this.onResetGame();
    });
  }

  updateRoomId(roomId) {
    this.elements.roomId.textContent = roomId;
  }

  updateGameState(state) {
    this.currentGameState = state;
    this.updateOpponents(state);
    this.updatePlayArea(state);
    this.updateMyHand(state);
    this.updateMyInfo(state);
    this.updateHostPanel(state);
    this.updateGameEnd(state);
  }

  updateOpponents(state) {
    const area = this.elements.opponentsArea;
    area.innerHTML = '';

    if (!state.playerOrder || state.playerOrder.length === 0) {
      state.players.forEach(p => {
        if (p.id === this.myPlayerId) return;
        area.appendChild(this.createOpponentSeat(p, null, state));
      });
      return;
    }

    state.playerOrder.forEach(pid => {
      if (pid === this.myPlayerId) return;
      const player = state.players.find(p => p.id === pid);
      if (!player) return;
      const otherInfo = state.otherPlayers[pid];
      area.appendChild(this.createOpponentSeat(player, otherInfo, state));
    });
  }

  createOpponentSeat(player, otherInfo, state) {
    const seat = document.createElement('div');
    seat.className = 'opponent-seat';
    if (state.currentPlayerId === player.id) {
      seat.classList.add('active-turn');
    }

    const avatar = document.createElement('img');
    avatar.className = 'avatar-img';
    avatar.src = `images/avatars/${player.avatar || 'froggy'}.gif`;
    avatar.alt = player.nickname;

    const nickname = document.createElement('span');
    nickname.className = 'nickname';
    nickname.textContent = player.nickname;

    const cardInfo = document.createElement('div');
    cardInfo.className = 'card-count';

    if (otherInfo) {
      const count = document.createElement('span');
      count.className = 'card-count-num';
      count.textContent = otherInfo.cardCount;
      cardInfo.appendChild(count);

      if (otherInfo.calledUno) {
        const badge = document.createElement('span');
        badge.className = 'uno-badge';
        badge.textContent = 'UNO!';
        seat.appendChild(badge);
      }
    }

    seat.appendChild(avatar);
    seat.appendChild(nickname);
    seat.appendChild(cardInfo);

    if (player.isAI) {
      const aiTag = document.createElement('span');
      aiTag.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4)';
      aiTag.textContent = 'AI';
      seat.appendChild(aiTag);
    }

    return seat;
  }

  updatePlayArea(state) {
    this.elements.deckCount.textContent = state.deckCount || 0;

    if (state.topCard) {
      this.elements.emptyDiscard.style.display = 'none';
      var prevTopCardId = this._prevTopCardId;
      var topCardChanged = state.topCard.id !== prevTopCardId;
      this._prevTopCardId = state.topCard.id;

      const existingCards = this.elements.discardPile.querySelectorAll('.uno-card');
      existingCards.forEach(c => c.remove());

      const cardEl = this.createCardElement(state.topCard, false);
      cardEl.style.cursor = 'default';
      cardEl.classList.remove('playable', 'not-playable');

      if (topCardChanged && prevTopCardId !== null) {
        cardEl.classList.add('card-fly-in');
        this._animateCardFromPlayer(cardEl, state);
      }

      this.elements.discardPile.appendChild(cardEl);
    } else {
      this.elements.emptyDiscard.style.display = 'block';
    }

    if (state.direction !== undefined) {
      this.elements.directionIndicator.textContent = state.direction === 1 ? '↻' : '↺';
      this.elements.directionIndicator.className = 'direction-indicator' + (state.direction === -1 ? ' ccw' : '');
    }

    if (state.currentColor) {
      const colorMap = { red: '#E74C3C', blue: '#3498DB', green: '#27AE60', yellow: '#F1C40F', wild: '#1a1a1a' };
      this.elements.currentColorIndicator.style.backgroundColor = colorMap[state.currentColor] || 'transparent';
    }

    if (state.pendingColorChoice) {
      this.elements.colorChooser.classList.add('visible');
    } else {
      this.elements.colorChooser.classList.remove('visible');
    }
  }

  _animateCardFromPlayer(cardEl, state) {
    var lastAction = null;
    if (state.actionLog && state.actionLog.length > 0) {
      lastAction = state.actionLog[state.actionLog.length - 1];
    }

    if (!lastAction || lastAction.action !== 'play') return;

    var playedBy = lastAction.player;
    var isMyPlay = false;
    if (this.myPlayerId) {
      var me = state.players.find(function(p) { return p.id === this.myPlayerId; }.bind(this));
      if (me && me.nickname === playedBy) {
        isMyPlay = true;
      }
    }

    if (isMyPlay) {
      cardEl.style.setProperty('--fly-from-x', '0px');
      cardEl.style.setProperty('--fly-from-y', '120px');
      cardEl.style.setProperty('--fly-from-scale', '0.6');
    } else {
      var opponentSeats = this.elements.opponentsArea.querySelectorAll('.opponent-seat');
      var sourceSeat = null;
      opponentSeats.forEach(function(seat) {
        var nameEl = seat.querySelector('.nickname');
        if (nameEl && nameEl.textContent === playedBy) {
          sourceSeat = seat;
        }
      });

      if (sourceSeat) {
        var discardRect = this.elements.discardPile.getBoundingClientRect();
        var seatRect = sourceSeat.getBoundingClientRect();
        var dx = seatRect.left + seatRect.width / 2 - (discardRect.left + discardRect.width / 2);
        var dy = seatRect.top + seatRect.height / 2 - (discardRect.top + discardRect.height / 2);
        cardEl.style.setProperty('--fly-from-x', dx + 'px');
        cardEl.style.setProperty('--fly-from-y', dy + 'px');
        cardEl.style.setProperty('--fly-from-scale', '0.5');
      } else {
        cardEl.style.setProperty('--fly-from-x', '0px');
        cardEl.style.setProperty('--fly-from-y', '-80px');
        cardEl.style.setProperty('--fly-from-scale', '0.5');
      }
    }
  }

  updateMyHand(state) {
    const hand = this.elements.myHand;
    hand.innerHTML = '';

    if (!state.myHand || state.myHand.length === 0) return;

    state.myHand.forEach(card => {
      const isPlayable = state.isMyTurn && !state.pendingColorChoice &&
        this.canPlayCard(card, state.topCard, state.currentColor);
      const cardEl = this.createCardElement(card, true);
      cardEl.classList.add(isPlayable ? 'playable' : 'not-playable');

      if (isPlayable) {
        cardEl.addEventListener('click', () => {
          if (this.onPlayCard) this.onPlayCard(card);
        });
      }

      hand.appendChild(cardEl);
    });

    const showUno = state.isMyTurn && state.myHand.length <= 2;
    this.elements.unoBtn.style.display = showUno ? 'block' : 'none';

    const showPass = state.isMyTurn && state.hasDrawnThisTurn;
    this.elements.passBtn.style.display = showPass ? 'block' : 'none';
  }

  canPlayCard(card, topCard, currentColor) {
    if (!topCard) return true;
    if (card.type === 'wild') return true;
    if (card.color === currentColor) return true;
    if (card.value === topCard.value && card.type !== 'wild') return true;
    return false;
  }

  createCardElement(card, interactive) {
    const cardEl = document.createElement('div');
    cardEl.className = 'uno-card';

    const colorClass = card.type === 'wild' ? 'color-wild' : `color-${card.color}`;
    cardEl.classList.add(colorClass);

    const img = document.createElement('img');
    img.src = this.getCardImagePath(card);
    img.alt = this.getCardLabel(card);
    img.draggable = false;
    cardEl.appendChild(img);

    return cardEl;
  }

  getCardImagePath(card) {
    if (card.type === 'wild') {
      if (card.value === 'wild_draw4') return 'images/UNO/_wild_draw.png';
      return 'images/UNO/_wild.png';
    }
    const valueMap = {
      'skip': 'interdit',
      'reverse': 'revers',
      'draw2': 'draw2',
    };
    const valueStr = valueMap[card.value] || card.value;
    return `images/UNO/_${valueStr}.png`;
  }

  getCardLabel(card) {
    const colorNames = { red: '红', blue: '蓝', green: '绿', yellow: '黄', wild: '万能' };
    const valueNames = {
      'skip': '禁止', 'reverse': '反转', 'draw2': '+2',
      'wild': '变色', 'wild_draw4': '+4',
    };
    const colorName = colorNames[card.color] || card.color;
    const valueName = valueNames[card.value] || card.value;
    return `${colorName} ${valueName}`;
  }

  updateMyInfo(state) {
    const me = state.players.find(p => p.id === this.myPlayerId);
    if (me) {
      this.elements.myAvatar.src = `images/avatars/${me.avatar || 'froggy'}.gif`;
      this.elements.myNickname.textContent = me.nickname;
    }
  }

  updateHostPanel(state) {
    if (this.isHost) {
      this.elements.hostBtn.style.display = state.phase !== 'WAITING' ? 'block' : 'none';
      this.elements.hostPanel.style.display = state.phase === 'WAITING' ? 'flex' : 'none';
      this.hostPanelVisible = state.phase === 'WAITING';
      this.elements.startGame.style.display = state.phase === 'WAITING' ? 'block' : 'none';
    }
  }

  updateGameEnd(state) {
    if (state.phase === 'GAME_END' && state.winner) {
      const winner = state.players.find(p => p.id === state.winner);
      const isMe = state.winner === this.myPlayerId;
      this.elements.gameEndTitle.textContent = isMe ? '🎉 你赢了！' : `${winner ? winner.nickname : ''} 获胜`;
      this.elements.gameEndOverlay.style.display = 'flex';
      if (isMe) this.launchConfetti();
    } else {
      this.elements.gameEndOverlay.style.display = 'none';
    }
  }

  showNotification(text, duration) {
    const d = duration || 2000;
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.elements.notificationText.textContent = text;
    this.elements.gameNotification.style.display = 'block';
    this.elements.gameNotification.style.animation = 'none';
    void this.elements.gameNotification.offsetHeight;
    this.elements.gameNotification.style.animation = `fadeInOut ${d}ms ease-in-out`;
    this.notificationTimeout = setTimeout(() => {
      this.elements.gameNotification.style.display = 'none';
    }, d);
  }

  launchConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);

    const colors = ['#E74C3C', '#3498DB', '#27AE60', '#F1C40F', '#9B59B6', '#E67E22'];
    for (let i = 0; i < 50; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = Math.random() * 2 + 's';
      piece.style.animationDuration = (2 + Math.random() * 2) + 's';
      piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      piece.style.width = (5 + Math.random() * 10) + 'px';
      piece.style.height = (5 + Math.random() * 10) + 'px';
      container.appendChild(piece);
    }

    setTimeout(() => container.remove(), 5000);
  }
}
