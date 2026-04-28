class OmahaRoomUI {
  constructor() {
    this.elements = {
      roomId: document.getElementById('room-id'),
      communityCards: document.getElementById('community-cards'),
      playerSeats: [],
      positionBadges: [],
      playerBets: [],
      playerStatuses: [],
      betAmount: document.getElementById('bet-amount'),
      myChips: document.getElementById('my-chips'),
      gameStatus: document.getElementById('game-status'),
      statusTitle: document.getElementById('status-title'),
      statusMessage: document.getElementById('status-message'),
      hostPanel: document.getElementById('host-panel'),
      voiceToggle: document.getElementById('voice-toggle'),
      languageToggle: document.getElementById('language-toggle'),
      exitRoom: document.getElementById('exit-room'),
      foldBtn: document.getElementById('fold-btn'),
      checkBtn: document.getElementById('check-btn'),
      callBtn: document.getElementById('call-btn'),
      callAmount: document.getElementById('call-amount'),
      raiseBtn: document.getElementById('raise-btn'),
      allInBtn: document.getElementById('all-in-btn'),
      phaseIndicator: document.getElementById('phase-indicator'),
      potAmount: document.getElementById('pot-amount'),
      blindInfo: document.getElementById('blind-info'),
      cardPile: document.getElementById('card-pile'),
      cardPileImg: document.querySelector('.card-pile-img'),
      cardPileCount: document.getElementById('card-pile-count'),
      nextHandBtn: document.getElementById('next-hand-btn'),
      startGameBtn: document.getElementById('start-game'),
      connectionStatus: document.getElementById('connection-status'),
    };

    this.currentLanguage = 'zh';
    this.translations = {
      zh: {
        'language-button': '🌐 中文',
        'phase-waiting': '等待',
        'phase-pre-flop': '盲注',
        'phase-preflop-betting': '翻前',
        'phase-flop': '翻牌',
        'phase-turn': '转牌',
        'phase-river': '河牌',
        'phase-showdown': '摊牌',
        'pot-label': '底池',
        'bet-label': '下注积分',
        'my-chips': '我的积分',
        'fold-btn': '弃牌',
        'check-btn': '过牌',
        'call-btn': '跟注',
        'raise-btn': '加注',
        'all-in-btn': '全押',
        'host-panel-title': '房主控制面板',
        'small-blind': '小盲注 (SB)',
        'big-blind': '大盲注 (BB)',
        'start-game': '开始游戏',
        'next-hand': '下一局',
        'reset-game': '重置游戏',
        'seat-label': '座位',
        'folded': '已弃牌',
        'all-in': 'ALL IN',
        'voice-enabled': '🔊 语音: 开启',
        'voice-disabled': '🔇 语音: 关闭',
        'exit-room': '退出房间',
        'switch-bg': '切换主题',
        'room-number': '房间号',
        'copy': '复制',
        'connected': '🟢 已连接',
        'disconnected': '🔴 未连接',
        'copy-success': '复制成功',
        'copy-message': '房间号已复制到剪贴板',
        'confirm-exit': '确定要退出房间吗？',
        'clear-btn': '清空',
        'game-log-title': '游戏进程',
        'pot-limit': 'POT LIMIT',
        'pot-1-3': '⅓底池',
        'pot-1-2': '½底池',
        'pot-1': '1底池',
        'game-speed': '游戏速度',
        'speed-slow': '慢',
        'speed-fast': '快',
        'sound-on': '🔊 音效: 开',
        'sound-off': '🔇 音效: 关',
      },
      en: {
        'language-button': '🌐 English',
        'phase-waiting': 'Waiting',
        'phase-pre-flop': 'Blinds',
        'phase-preflop-betting': 'Pre-Flop',
        'phase-flop': 'Flop',
        'phase-turn': 'Turn',
        'phase-river': 'River',
        'phase-showdown': 'Showdown',
        'pot-label': 'Pot',
        'bet-label': 'Bet Amount',
        'my-chips': 'My Chips',
        'fold-btn': 'Fold',
        'check-btn': 'Check',
        'call-btn': 'Call',
        'raise-btn': 'Raise',
        'all-in-btn': 'All In',
        'host-panel-title': 'Host Control Panel',
        'small-blind': 'Small Blind (SB)',
        'big-blind': 'Big Blind (BB)',
        'start-game': 'Start Game',
        'next-hand': 'Next Hand',
        'reset-game': 'Reset Game',
        'seat-label': 'Seat',
        'folded': 'Folded',
        'all-in': 'ALL IN',
        'voice-enabled': '🔊 Voice: On',
        'voice-disabled': '🔇 Voice: Off',
        'exit-room': 'Exit Room',
        'switch-bg': 'Switch Theme',
        'room-number': 'Room Number',
        'copy': 'Copy',
        'connected': '🟢 Connected',
        'disconnected': '🔴 Disconnected',
        'copy-success': 'Copied',
        'copy-message': 'Room number copied to clipboard',
        'confirm-exit': 'Are you sure you want to exit the room?',
        'clear-btn': 'Clear',
        'game-log-title': 'Game Log',
        'pot-limit': 'POT LIMIT',
        'pot-1-3': '⅓ Pot',
        'pot-1-2': '½ Pot',
        'pot-1': '1 Pot',
        'game-speed': 'Speed',
        'speed-slow': 'Slow',
        'speed-fast': 'Fast',
        'sound-on': '🔊 Sound: On',
        'sound-off': '🔇 Sound: Off',
      }
    };

    for (let i = 1; i <= 10; i++) {
      this.elements.playerSeats.push(document.getElementById(`player-${i}`));
      this.elements.positionBadges.push(document.getElementById(`pos-${i}`));
      this.elements.playerBets.push(document.getElementById(`bet-${i}`));
      this.elements.playerStatuses.push(document.getElementById(`status-${i}`));
    }

    this.currentBgTheme = 1;
    this.myPlayerId = null;
    this.previousBets = {};
    this.winnerPlayerIds = new Set();
    this.handCount = 0;
    this.totalProfit = 0;
    this.currentPot = 0;
    this.gameSpeed = 3;
    this._prevPhase = 'WAITING';
    this._prevCommunityCardCount = 0;
    this.currentGameState = null;

    this.bindEvents();
    this.updateLanguage();
    this._applyInitialTheme();
  }

  _applyInitialTheme() {
    if (typeof ThemeManager !== 'undefined') {
      ThemeManager.applyAll();
      this.applyTableTheme(ThemeManager.getTableTheme());
      if (this.elements.cardPileImg) {
        this.elements.cardPileImg.src = ThemeManager.getCardPileSrc();
      }
    }
  }

  bindEvents() {
    const bindEvent = (element, handler) => {
      if (element) {
        let handled = false;
        element.addEventListener('click', (e) => {
          if (handled) { handled = false; return; }
          handler(e);
        });
        element.addEventListener('touchstart', (e) => {
          handled = true;
          e.preventDefault();
          handler(e);
        }, { passive: false });
        element.addEventListener('touchend', (e) => {
          e.preventDefault();
        }, { passive: false });
      }
    };

    bindEvent(document.getElementById('copy-room-id'), () => {
      navigator.clipboard.writeText(this.elements.roomId.textContent)
        .then(() => {
          this.showGameStatus('复制成功', '房间号已复制到剪贴板');
          setTimeout(() => { this.hideGameStatus(); }, 500);
        })
        .catch(err => console.error('复制失败:', err));
    });

    bindEvent(this.elements.exitRoom, () => {
      const msg = this.currentLanguage === 'en' ? 'Are you sure you want to leave?' : '确定要退出房间吗？';
      if (confirm(msg)) {
        if (window.socketClient) socketClient.leaveRoom();
        if (window.agoraVoice) agoraVoice.leaveChannel();
        window.location.href = 'index.html';
      }
    });

    const switchBgBtn = document.getElementById('switch-table-bg');
    bindEvent(switchBgBtn, () => {
      this.showThemePopup();
    });

    bindEvent(this.elements.languageToggle, () => {
      this.toggleLanguage();
    });

    bindEvent(this.elements.voiceToggle, async () => {
      if (window.agoraVoice) {
        await window.agoraVoice.toggleMicrophone();
        const isEnabled = window.agoraVoice.isMicrophoneEnabled();
        this.updateVoiceButton(isEnabled);
      }
    });

    document.querySelectorAll('.chip-btn').forEach(btn => {
      bindEvent(btn, () => {
        const current = parseInt(this.elements.betAmount.value) || 0;
        const add = parseInt(btn.dataset.amount) || 0;
        this.elements.betAmount.value = current + add;
      });
    });

    const clearBetBtn = document.getElementById('clear-bet-btn');
    bindEvent(clearBetBtn, () => {
      this.elements.betAmount.value = '';
    });

    document.querySelectorAll('.pot-quick-btn').forEach(btn => {
      bindEvent(btn, () => {
        const fraction = parseFloat(btn.dataset.fraction) || 0;
        const amount = Math.floor(this.currentPot * fraction);
        if (amount > 0) {
          this.elements.betAmount.value = amount;
        }
      });
    });

    const speedSlider = document.getElementById('game-speed-slider');
    if (speedSlider) {
      speedSlider.addEventListener('input', () => {
        this.gameSpeed = parseInt(speedSlider.value) || 3;
      });
    }

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle) {
      bindEvent(soundToggle, () => {
        if (window.pokerSoundManager) {
          pokerSoundManager.init();
          const isEnabled = pokerSoundManager.enabled;
          pokerSoundManager.setEnabled(!isEnabled);
          soundToggle.textContent = !isEnabled ? '🔊 音效: 开' : '🔇 音效: 关';
          soundToggle.classList.toggle('muted', isEnabled);
        }
      });
    }

    const continueGameBtn = document.getElementById('continue-game-btn');
    bindEvent(continueGameBtn, () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('confirmContinue');
      }
    });

    bindEvent(this.elements.foldBtn, () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('fold');
      }
    });

    bindEvent(this.elements.checkBtn, () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('check');
      }
    });

    bindEvent(this.elements.callBtn, () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('call');
      }
    });

    bindEvent(this.elements.raiseBtn, () => {
      if (window.omahaGameManager) {
        const betAmount = this.getBetAmount();
        window.omahaGameManager.sendGameAction('raise', { amount: betAmount });
      }
    });

    bindEvent(this.elements.allInBtn, () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('all-in');
      }
    });

    bindEvent(document.getElementById('start-game'), () => {
      if (window.omahaGameManager) {
        const config = this.getHostConfig();
        window.omahaGameManager.sendGameAction('startGame', config);
      }
    });

    bindEvent(document.getElementById('next-hand-btn'), () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('nextHand');
      }
    });

    bindEvent(document.getElementById('reset-game'), () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('resetGame');
      }
    });

    bindEvent(document.getElementById('settle-game-btn'), () => {
      if (window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('settleGame');
      }
    });

    bindEvent(document.getElementById('set-chips-btn'), () => {
      const select = document.getElementById('player-select');
      const input = document.getElementById('chips-amount-input');
      const playerId = select?.value;
      const chips = parseInt(input?.value) || 0;
      if (playerId && chips >= 0 && window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('setPlayerChips', { playerId, chips });
      }
    });

    bindEvent(document.getElementById('add-chips-btn'), () => {
      const select = document.getElementById('player-select');
      const input = document.getElementById('chips-amount-input');
      const playerId = select?.value;
      const amount = parseInt(input?.value) || 0;
      if (playerId && amount > 0 && window.omahaGameManager) {
        window.omahaGameManager.sendGameAction('addPlayerChips', { playerId, amount });
      }
    });

    bindEvent(document.getElementById('settle-close-btn'), () => {
      document.getElementById('settle-modal').style.display = 'none';
    });
  }

  updateRoomId(roomId) {
    this.elements.roomId.textContent = roomId;
  }

  updateCommunityCards(cards) {
    const speedMultiplier = [2, 1.5, 1, 0.7, 0.5][this.gameSpeed - 1] || 1;
    const prevCount = this._prevCommunityCardCount || 0;
    const newCards = cards ? cards.filter(c => c && !c.hidden) : [];
    const newCount = newCards.length;

    this.elements.communityCards.innerHTML = '';

    if (newCount > prevCount && newCount > 0) {
      const dealDelay = Math.round(200 * speedMultiplier);

      for (let i = 0; i < 5; i++) {
        if (cards && cards[i]) {
          const cardElement = this.createCardElement(cards[i]);
          if (i >= prevCount && i < newCount) {
            cardElement.classList.add('dealing');
            cardElement.style.animationDelay = `${(i - prevCount) * dealDelay}ms`;
            cardElement.style.opacity = '0';
            this._setDealFromPile(cardElement);
            setTimeout(() => {
              cardElement.style.opacity = '';
              if (window.pokerSoundManager) pokerSoundManager.dealCard();
            }, (i - prevCount) * dealDelay + 400);
          }
          this.elements.communityCards.appendChild(cardElement);
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'poker-card back';
          placeholder.style.opacity = '0.3';
          this.elements.communityCards.appendChild(placeholder);
        }
      }

      if (newCount === 3 && prevCount < 3 && window.pokerSoundManager) {
        pokerSoundManager.flopCards();
      } else if (newCount === 4 && prevCount < 4 && window.pokerSoundManager) {
        pokerSoundManager.turnRiver();
      } else if (newCount === 5 && prevCount < 5 && window.pokerSoundManager) {
        pokerSoundManager.turnRiver();
      }
    } else {
      for (let i = 0; i < 5; i++) {
        if (cards && cards[i]) {
          this.elements.communityCards.appendChild(this.createCardElement(cards[i]));
        } else {
          const placeholder = document.createElement('div');
          placeholder.className = 'poker-card back';
          placeholder.style.opacity = '0.3';
          this.elements.communityCards.appendChild(placeholder);
        }
      }
    }

    this._prevCommunityCardCount = newCount;
  }

  updatePlayerSeat(seatIndex, player, currentBet = 0, handBet = 0) {
    const seat = this.elements.playerSeats[seatIndex - 1];
    if (!seat) return;
    const badge = this.elements.positionBadges[seatIndex - 1];
    const betEl = this.elements.playerBets[seatIndex - 1];
    const statusEl = this.elements.playerStatuses[seatIndex - 1];

    seat.classList.remove('seat-empty', 'seat-occupied', 'seat-self');

    if (player) {
      const isSelf = this.myPlayerId && player.id === this.myPlayerId;
      seat._playerData = player;

      if (isSelf) {
        seat.classList.add('seat-self');
      } else {
        seat.classList.add('seat-occupied');
      }

      seat.style.display = 'flex';

      let labelEl = seat.querySelector('.seat-label');
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.className = 'seat-label';
        seat.appendChild(labelEl);
      }
      labelEl.style.display = 'none';

      seat.querySelector('.player-name').textContent = player.nickname;
      if (player.isAI) {
        seat.querySelector('.player-name').classList.add('ai-player-name');
      } else {
        seat.querySelector('.player-name').classList.remove('ai-player-name');
      }

      const playerInfo = seat.querySelector('.player-info');
      let avatarEl = playerInfo.querySelector('.player-avatar');
      if (!avatarEl) {
        avatarEl = document.createElement('img');
        avatarEl.className = 'player-avatar';
        const infoText = playerInfo.querySelector('.player-info-text');
        if (infoText) {
          playerInfo.insertBefore(avatarEl, infoText);
        } else {
          playerInfo.insertBefore(avatarEl, playerInfo.firstChild);
        }
      }
      const avatarName = player.avatar || 'froggy';
      avatarEl.src = 'images/avatars/' + avatarName + '.gif';
      avatarEl.alt = avatarName;

      seat.querySelector('.player-chips').textContent = player.chips || 0;
      seat.querySelector('.player-bet-total').textContent = `本局下注: ${handBet || 0}`;

      const cardsContainer = seat.querySelector('.player-cards');
      cardsContainer.innerHTML = '';
      if (player.cards) {
        player.cards.forEach(card => {
          const cardElement = this.createCardElement(card);
          cardsContainer.appendChild(cardElement);
        });
      }

      if (this.winnerPlayerIds.has(player.id)) {
        this._applyWinnerBadge(player.id);
      }

      seat.classList.toggle('active', !!player.isActive);
      seat.classList.toggle('turn', !!player.isTurn);

      if (badge) {
        let badgeText = '';
        let badgeClass = '';
        if (player.isButton) { badgeText = 'D'; badgeClass = 'pos-btn'; }
        else if (player.isSmallBlind) { badgeText = 'SB'; badgeClass = 'pos-sb'; }
        else if (player.isBigBlind) { badgeText = 'BB'; badgeClass = 'pos-bb'; }
        else if (player.isUTG) { badgeText = 'UTG'; badgeClass = 'pos-utg'; }

        if (badgeText) {
          badge.textContent = badgeText;
          badge.className = `position-badge ${badgeClass}`;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (betEl) {
        const prevBet = this.previousBets[player.id] || 0;
        const betChanged = currentBet !== prevBet && currentBet > prevBet;
        this.previousBets[player.id] = currentBet;

        if (currentBet > 0 && player.isActive) {
          const initialChips = this._getInitialChips();
          const existingChip = betEl.querySelector('.chip-display');

          if (existingChip) {
            ChipDisplay.updateChipElement(existingChip, currentBet, initialChips);
          } else {
            betEl.innerHTML = '';
            const chipEl = ChipDisplay.createChipElement(currentBet, initialChips);
            chipEl.classList.add('chip-display--small');
            betEl.appendChild(chipEl);
          }
          betEl.style.display = 'flex';

          if (betChanged) {
            this._animateChipToTable(seatEl, betEl, currentBet, initialChips);
          }

          const betOffsets = {
            1:  { dx: 0,  dy: -1 },
            2:  { dx: 1,  dy: 0 },
            3:  { dx: 1,  dy: 0 },
            4:  { dx: 0,  dy: 1 },
            5:  { dx: 0,  dy: 1 },
            6:  { dx: 0,  dy: 1 },
            7:  { dx: -1, dy: 0 },
            8:  { dx: -1, dy: 0 },
            9:  { dx: 0,  dy: -1 },
            10: { dx: 0,  dy: -1 }
          };
          const offset = betOffsets[seatIndex] || { dx: 0, dy: -1 };
          const moveDistance = 50;
          const tx = Math.round(offset.dx * moveDistance);
          const ty = Math.round(offset.dy * moveDistance);
          betEl.style.setProperty('--bet-tx', tx + 'px');
          betEl.style.setProperty('--bet-ty', ty + 'px');

          if (betChanged) {
            betEl.classList.remove('fade-out', 'animate', 'gather');
            betEl.offsetHeight;
            requestAnimationFrame(() => {
              betEl.classList.add('animate');
              setTimeout(() => {
                betEl.classList.remove('animate');
              }, 1200);
            });
          }
        } else {
          if (player.id) {
            this.previousBets[player.id] = 0;
          }
          if (betEl.style.display === 'flex') {
            betEl.classList.remove('animate', 'gather');
            betEl.classList.add('fade-out');
            setTimeout(() => {
              betEl.style.display = 'none';
              betEl.classList.remove('fade-out');
            }, 800);
          } else {
            betEl.style.display = 'none';
          }
        }
      }

      if (statusEl) {
        if (!player.isActive) {
          if (player.isEliminated) {
            statusEl.textContent = '出局';
            statusEl.className = 'player-status eliminated';
          } else {
            statusEl.textContent = '已弃牌';
            statusEl.className = 'player-status folded';
          }
          statusEl.style.display = 'block';
        } else if (player.chips === 0) {
          statusEl.textContent = 'ALL IN';
          statusEl.className = 'player-status allin';
          statusEl.style.display = 'block';
        } else {
          statusEl.style.display = 'none';
        }
      }

      this.repositionSeats();
    } else {
      seat.classList.add('seat-empty');
      seat._playerData = null;

      let labelEl = seat.querySelector('.seat-label');
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.className = 'seat-label';
        seat.appendChild(labelEl);
      }
      labelEl.textContent = `座位 ${seatIndex}`;
      labelEl.style.display = 'block';

      seat.querySelector('.player-bet-total').textContent = '下注: 0';
      seat.querySelector('.player-name').textContent = '--';
      seat.querySelector('.player-chips').textContent = '0';

      const cardsContainer = seat.querySelector('.player-cards');
      cardsContainer.innerHTML = '';

      seat.classList.remove('active', 'turn');
      if (badge) badge.style.display = 'none';
      if (betEl) betEl.style.display = 'none';
      if (statusEl) statusEl.style.display = 'none';

      this.repositionSeats();
    }
  }

  showWinnerBadge(playerId) {
    this.winnerPlayerIds.add(playerId);
    this._applyWinnerBadge(playerId);
  }

  _applyWinnerBadge(playerId) {
    this.elements.playerSeats.forEach(seat => {
      const player = seat._playerData;
      if (player && player.id === playerId) {
        const cardsContainer = seat.querySelector('.player-cards');
        if (cardsContainer && !cardsContainer.querySelector('.winner-badge')) {
          const badge = document.createElement('div');
          badge.className = 'winner-badge';
          badge.innerHTML = '👑';
          cardsContainer.appendChild(badge);
        }
        seat.classList.add('winner-seat');
      }
    });
  }

  clearWinnerBadges() {
    this.winnerPlayerIds.clear();
    this.elements.playerSeats.forEach(seat => {
      const badge = seat.querySelector('.winner-badge');
      if (badge) badge.remove();
      seat.classList.remove('winner-seat');
    });
  }

  createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = 'poker-card';

    if (card.hidden) {
      cardElement.classList.add('back');
      const backImg = document.createElement('img');
      backImg.src = typeof ThemeManager !== 'undefined' ? ThemeManager.getCardBackSrc() : 'images/Cards/card_back2.svg';
      backImg.alt = 'card back';
      backImg.className = 'card-face-img';
      cardElement.appendChild(backImg);
      return cardElement;
    }

    const rank = card.value.length === 1 && !isNaN(card.value)
      ? '0' + card.value
      : card.value;
    const imgSrc = `images/Cards/card_${card.suit}_${rank}.png`;

    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = `${card.value} of ${card.suit}`;
    img.className = 'card-face-img';
    cardElement.appendChild(img);

    return cardElement;
  }

  getSuitSymbol(suit) {
    const map = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return map[suit] || '';
  }

  _animateChipToTable(seatEl, betEl, amount, initialChips) {
    var chipArea = document.getElementById('table-chip-area');
    if (!chipArea) return;

    var tableRect = document.querySelector('.players-area').getBoundingClientRect();
    var betRect = betEl.getBoundingClientRect();
    var areaRect = chipArea.getBoundingClientRect();

    var fromX = betRect.left + betRect.width / 2 - tableRect.left;
    var fromY = betRect.top + betRect.height / 2 - tableRect.top;
    var toX = areaRect.left + areaRect.width / 2 - tableRect.left;
    var toY = areaRect.top + areaRect.height / 2 - tableRect.top;

    var flyEl = document.createElement('div');
    flyEl.className = 'chip-fly-to-table';
    flyEl.style.setProperty('--chip-from-x', fromX + 'px');
    flyEl.style.setProperty('--chip-from-y', fromY + 'px');
    flyEl.style.setProperty('--chip-to-x', toX + 'px');
    flyEl.style.setProperty('--chip-to-y', toY + 'px');

    var chipEl = ChipDisplay.createChipElement(amount, initialChips);
    chipEl.classList.add('chip-display--small');
    flyEl.appendChild(chipEl);

    var tableArea = document.querySelector('.players-area');
    tableArea.appendChild(flyEl);

    setTimeout(function() {
      flyEl.remove();
    }, 600);
  }

  _setDealFromPile(cardElement) {
    var pileEl = this.elements.cardPile;
    if (!pileEl) return;
    var tableArea = document.querySelector('.players-area');
    if (!tableArea) return;
    var tableRect = tableArea.getBoundingClientRect();
    var pileRect = pileEl.getBoundingClientRect();
    var pileCenterX = pileRect.left + pileRect.width / 2 - tableRect.left;
    var pileCenterY = pileRect.top + pileRect.height / 2 - tableRect.top;
    requestAnimationFrame(function() {
      var cardRect = cardElement.getBoundingClientRect();
      var cardCenterX = cardRect.left + cardRect.width / 2 - tableRect.left;
      var cardCenterY = cardRect.top + cardRect.height / 2 - tableRect.top;
      var dx = pileCenterX - cardCenterX;
      var dy = pileCenterY - cardCenterY;
      cardElement.style.setProperty('--deal-from-x', dx + 'px');
      cardElement.style.setProperty('--deal-from-y', dy + 'px');
    });
  }

  _getInitialChips() {
    if (this.currentGameState) {
      if (this.currentGameState.initialChips) {
        return this.currentGameState.initialChips;
      }
    }
    return 1000;
  }

  updateMyChips(chips) {
    this.elements.myChips.textContent = chips;
  }

  addChipsHistoryEntry(amount, isWin) {
    const historyList = document.getElementById('chips-history-list');
    if (!historyList) return;

    this.handCount++;
    this.totalProfit += isWin ? amount : -amount;

    const entry = document.createElement('div');
    const isEven = amount === 0;
    entry.className = `history-entry ${isEven ? 'even' : (isWin ? 'win' : 'lose')}`;

    const isEnglish = this.currentLanguage === 'en';
    const sign = isEven ? '' : (isWin ? '+' : '-');
    const amountText = isEven ? '0' : `${sign}${amount}`;
    const profitSign = this.totalProfit >= 0 ? '+' : '';
    entry.textContent = isEnglish ?
      `#${this.handCount} ${amountText}  (Total: ${profitSign}${this.totalProfit})` :
      `#${this.handCount} ${amountText}  (累计: ${profitSign}${this.totalProfit})`;

    if (isEnglish) {
      entry.classList.add('english-text');
    }

    historyList.appendChild(entry);
    historyList.scrollTop = historyList.scrollHeight;

    while (historyList.children.length > 20) {
      historyList.removeChild(historyList.firstChild);
    }
  }

  updatePot(amount) {
    this.currentPot = amount || 0;
    if (this.elements.potAmount) {
      this.elements.potAmount.classList.add('pot-amount-vibrate');
      setTimeout(() => {
        this.elements.potAmount.classList.remove('pot-amount-vibrate');
      }, 500);
      this.elements.potAmount.textContent = amount;
    }
  }

  updateCallAmount(amount) {
    const span = document.getElementById('call-amount');
    if (span) {
      span.textContent = amount > 0 ? amount : '';
    } else {
      const btn = document.getElementById('call-btn');
      if (btn) {
        const t = this.translations?.[this.currentLanguage] || this.translations?.['zh'] || {};
        const label = t['call-btn'] || '跟注';
        btn.innerHTML = `${label} <span id="call-amount">${amount > 0 ? amount : ''}</span>`;
        this.elements.callAmount = document.getElementById('call-amount');
      }
    }
  }

  updatePhaseIndicator(phase) {
    const phaseLabelEl = document.getElementById('phase-current-label');
    if (!phaseLabelEl) return;

    const phaseNames = {
      'WAITING': '等待中',
      'PRE_FLOP_BLINDS': '盲注阶段',
      'PRE_FLOP_BETTING': '翻前下注',
      'FLOP_DEAL': '翻牌',
      'FLOP_BETTING': '翻牌下注',
      'TURN_DEAL': '转牌',
      'TURN_BETTING': '转牌下注',
      'RIVER_DEAL': '河牌',
      'RIVER_BETTING': '河牌下注',
      'SHOWDOWN': '摊牌',
      'HAND_END': '本局结束'
    };

    const label = phaseNames[phase] || phase;
    phaseLabelEl.textContent = label;

    if (phase === 'FLOP_DEAL' || phase === 'TURN_DEAL' || phase === 'RIVER_DEAL' || phase === 'SHOWDOWN' || phase === 'HAND_END') {
      this.triggerBetGatherAnimation();
    }

    if (window.pokerSoundManager) {
      if (phase === 'PRE_FLOP_BLINDS' && this._prevPhase === 'WAITING') {
        pokerSoundManager.blindsSet();
      } else if (phase === 'FLOP_BETTING' && this._prevPhase !== 'FLOP_BETTING') {
        pokerSoundManager.flopCards();
      } else if (phase === 'TURN_BETTING' && this._prevPhase !== 'TURN_BETTING') {
        pokerSoundManager.turnRiver();
      } else if (phase === 'RIVER_BETTING' && this._prevPhase !== 'RIVER_BETTING') {
        pokerSoundManager.turnRiver();
      } else if (phase === 'SHOWDOWN' && this._prevPhase !== 'SHOWDOWN') {
        pokerSoundManager.showDown();
      }
    }

    this._prevPhase = phase;
  }

  triggerBetGatherAnimation() {
    this.elements.playerBets.forEach(betEl => {
      if (betEl && betEl.style.display === 'flex') {
        betEl.classList.remove('animate', 'fade-out');
        betEl.classList.add('gather');
        setTimeout(() => {
          betEl.style.display = 'none';
          betEl.classList.remove('gather');
        }, 1000);
      }
    });
  }

  updateBlindInfo(sb, bb) {
    if (this.elements.blindInfo) {
      this.elements.blindInfo.textContent = `SB: ${sb} / BB: ${bb}`;
    }
  }

  showNextHandButton(show) {
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.style.display = show ? 'inline-block' : 'none';
    }
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.style.display = 'none';
    }
    const settleBtn = document.getElementById('settle-game-btn');
    if (settleBtn) settleBtn.style.display = show ? 'inline-block' : 'none';
  }

  showStartGameButton(show) {
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.style.display = show ? 'inline-block' : 'none';
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.style.display = 'none';
    }
    const settleBtn = document.getElementById('settle-game-btn');
    if (settleBtn) settleBtn.style.display = show ? 'inline-block' : 'none';
  }

  hideHostButtons() {
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.style.display = 'none';
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.style.display = 'none';
    }
  }

  updatePlayerSelect(players) {
    const select = document.getElementById('player-select');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';
    players.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.playerId || p.id;
      opt.textContent = `${p.nickname} (${p.chips})`;
      select.appendChild(opt);
    });
    if (currentVal && players.some(p => (p.playerId || p.id) === currentVal)) {
      select.value = currentVal;
    }
  }

  showSettleModal(scoreboard) {
    const modal = document.getElementById('settle-modal');
    const tbody = document.getElementById('settle-table-body');
    if (!modal || !tbody) return;
    tbody.innerHTML = '';
    scoreboard.forEach(row => {
      const tr = document.createElement('tr');
      const profitClass = row.profit > 0 ? 'profit-positive' : row.profit < 0 ? 'profit-negative' : 'profit-zero';
      const profitText = row.profit > 0 ? `+${row.profit}` : row.profit === 0 ? '0' : `${row.profit}`;
      tr.innerHTML = `
        <td>${row.nickname}${row.isAI ? ' 🤖' : ''}</td>
        <td>${row.currentChips}</td>
        <td class="${profitClass}">${profitText}</td>
        <td>${row.totalOriginal}</td>
      `;
      tbody.appendChild(tr);
    });
    modal.style.display = 'flex';
  }

  showContinueGameButton(show) {
    const container = document.getElementById('continue-game-container');
    if (container) {
      container.style.display = show ? 'block' : 'none';
    }
  }

  showGameStatus(title, message) {
    if (!this.elements.gameStatus) return;
    if (this.elements.statusTitle) this.elements.statusTitle.textContent = title;
    if (this.elements.statusMessage) this.elements.statusMessage.textContent = message;
    this.elements.gameStatus.style.display = 'block';
    setTimeout(() => { this.hideGameStatus(); }, 2000);
  }

  hideGameStatus() {
    if (this.elements.gameStatus) this.elements.gameStatus.style.display = 'none';
  }

  showHostPanel() {
    if (this.elements.hostPanel) this.elements.hostPanel.style.display = 'block';
    var startBtn = document.getElementById('start-game');
    var resetBtn = document.getElementById('reset-game');
    if (startBtn) startBtn.style.display = 'block';
    if (resetBtn) resetBtn.style.display = 'block';
  }

  hideHostPanel() {
    if (this.elements.hostPanel) this.elements.hostPanel.style.display = 'none';
    var startBtn = document.getElementById('start-game');
    var nextBtn = document.getElementById('next-hand-btn');
    var resetBtn = document.getElementById('reset-game');
    if (startBtn) startBtn.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
  }

  updateVoiceButton(enabled) {
    this.elements.voiceToggle.textContent = enabled ? '🔊 语音: 开启' : '🔇 语音: 关闭';
    this.elements.voiceToggle.classList.toggle('active', enabled);
  }

  updateConnectionStatus(connected) {
    if (!this.elements.connectionStatus) return;
    if (connected) {
      this.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink.svg" alt="已连接" class="status-icon">';
      this.elements.connectionStatus.className = 'connection-status connected';
      this.elements.connectionStatus.title = '已连接';
    } else {
      this.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink-broken.svg" alt="未连接" class="status-icon">';
      this.elements.connectionStatus.className = 'connection-status disconnected';
      this.elements.connectionStatus.title = '未连接';
    }
  }

  enableActionButtons(enabled, actionContext = {}) {
    const isBettingPhase = enabled;
    const canCheck = actionContext.canCheck === true;
    const canCall = actionContext.canCall === true;

    if (isBettingPhase && window.pokerSoundManager) {
      pokerSoundManager.yourTurn();
    }

    if (this.elements.foldBtn) {
      this.elements.foldBtn.disabled = !isBettingPhase;
    }
    if (this.elements.checkBtn) {
      this.elements.checkBtn.disabled = !isBettingPhase || !canCheck;
    }
    if (this.elements.callBtn) {
      this.elements.callBtn.disabled = !isBettingPhase || !canCall;
    }
    if (this.elements.raiseBtn) {
      this.elements.raiseBtn.disabled = !isBettingPhase;
    }
    if (this.elements.allInBtn) {
      this.elements.allInBtn.disabled = !isBettingPhase;
    }

    if (actionContext.callAmount !== undefined) {
      this.updateCallAmount(actionContext.callAmount);
    }
  }

  getBetAmount() {
    return parseInt(this.elements.betAmount.value) || 0;
  }

  setBetAmount(amount) {
    this.elements.betAmount.value = amount;
  }

  getHostConfig() {
    return {
      smallBlind: parseInt(document.getElementById('small-blind-input')?.value) || 10,
      bigBlind: parseInt(document.getElementById('big-blind-input')?.value) || 20,
      initialChips: parseInt(document.getElementById('initial-chips-input')?.value) || 1000,
      playerCards: 4,
      communityCards: 5,
    };
  }

  setMyPlayerId(playerId) {
    this.myPlayerId = playerId;
  }

  showThemePopup() {
    var self = this;
    ThemePopup.show(function(type, id) {
      if (type === 'table') {
        self.applyTableTheme(id);
      } else if (type === 'cardBack') {
        self.applyCardBackTheme();
      } else if (type === 'chip') {
        self.refreshChipDisplays();
      }
    });
  }

  applyTableTheme(themeId) {
    var tableArea = document.querySelector('.players-area');
    var bgVideo = document.querySelector('.bg-video');
    if (!tableArea) return;

    this.currentBgTheme = themeId;
    if (themeId === 2) {
      tableArea.classList.add('bg-theme-2');
      if (bgVideo) { bgVideo.src = 'css/images/game-bg2.mp4'; bgVideo.load(); }
    } else {
      tableArea.classList.remove('bg-theme-2');
      if (bgVideo) { bgVideo.src = 'css/images/game-bg1.mp4'; bgVideo.load(); }
    }
  }

  applyCardBackTheme() {
    var src = ThemeManager.getCardBackSrc();
    var allBackCards = document.querySelectorAll('.poker-card.back');
    allBackCards.forEach(function(card) {
      var img = card.querySelector('.card-face-img');
      if (img && img.alt === 'card back') {
        img.src = src;
      }
    });
    if (this.elements.cardPileImg) {
      this.elements.cardPileImg.src = ThemeManager.getCardPileSrc();
    }
  }

  refreshChipDisplays() {
    var self = this;
    this.elements.playerBets.forEach(function(betEl) {
      if (betEl && betEl.style.display === 'flex') {
        var chipDisplay = betEl.querySelector('.chip-display');
        if (chipDisplay) {
          var label = chipDisplay.querySelector('.chip-amount');
          var amount = label ? parseInt(label.textContent) || 0 : 0;
          if (amount > 0) {
            var initialChips = self._getInitialChips();
            betEl.innerHTML = '';
            var chipEl = ChipDisplay.createChipElement(amount, initialChips);
            chipEl.classList.add('chip-display--small');
            betEl.appendChild(chipEl);
          }
        }
      }
    });
  }

  switchTableBackground() {
    var tableArea = document.querySelector('.players-area');
    var bgVideo = document.querySelector('.bg-video');
    if (!tableArea) return;

    this.currentBgTheme = this.currentBgTheme === 1 ? 2 : 1;

    if (this.currentBgTheme === 2) {
      tableArea.classList.add('bg-theme-2');
      if (bgVideo) { bgVideo.src = 'css/images/game-bg2.mp4'; bgVideo.load(); }
    } else {
      tableArea.classList.remove('bg-theme-2');
      if (bgVideo) { bgVideo.src = 'css/images/game-bg1.mp4'; bgVideo.load(); }
    }
  }

  toggleLanguage() {
    this.currentLanguage = this.currentLanguage === 'zh' ? 'en' : 'zh';
    this.updateLanguage();
  }

  updateLanguage() {
    const t = this.translations[this.currentLanguage];

    if (this.elements.languageToggle) {
      this.elements.languageToggle.textContent = t['language-button'];
      if (this.currentLanguage === 'en') {
        this.elements.languageToggle.classList.add('english-text');
      } else {
        this.elements.languageToggle.classList.remove('english-text');
      }
    }

    const phaseSteps = document.querySelectorAll('.phase-step');
    phaseSteps.forEach(step => {
      const phase = step.dataset.phase;
      let key = '';
      switch (phase) {
        case 'WAITING': key = 'phase-waiting'; break;
        case 'PRE_FLOP_BLINDS': key = 'phase-pre-flop'; break;
        case 'PRE_FLOP_BETTING': key = 'phase-preflop-betting'; break;
        case 'FLOP_BETTING': key = 'phase-flop'; break;
        case 'TURN_BETTING': key = 'phase-turn'; break;
        case 'RIVER_BETTING': key = 'phase-river'; break;
        case 'SHOWDOWN': key = 'phase-showdown'; break;
      }
      if (key) {
        const label = step.querySelector('.phase-label');
        if (label) {
          label.textContent = t[key];
          if (this.currentLanguage === 'en') {
            label.classList.add('english-text');
          } else {
            label.classList.remove('english-text');
          }
        }
      }
    });

    const potMain = document.querySelector('.pot-main');
    if (potMain) {
      potMain.innerHTML = `${t['pot-label']}: <span id="pot-amount">${this.elements.potAmount?.textContent || 0}</span>`;
      this.elements.potAmount = document.getElementById('pot-amount');
      if (this.currentLanguage === 'en') {
        potMain.classList.add('english-text');
      } else {
        potMain.classList.remove('english-text');
      }
    }

    const betControlLabel = document.querySelector('.bet-control label');
    if (betControlLabel) {
      betControlLabel.textContent = t['bet-label'];
      if (this.currentLanguage === 'en') {
        betControlLabel.classList.add('english-text');
      } else {
        betControlLabel.classList.remove('english-text');
      }
    }

    const myInfo = document.querySelector('.my-info');
    if (myInfo) {
      myInfo.innerHTML = `<span>${t['my-chips']}: <strong id="my-chips">${this.elements.myChips?.textContent || 0}</strong></span>`;
      this.elements.myChips = document.getElementById('my-chips');
      if (this.currentLanguage === 'en') {
        myInfo.classList.add('english-text');
      } else {
        myInfo.classList.remove('english-text');
      }
    }

    if (this.elements.foldBtn) {
      this.elements.foldBtn.textContent = t['fold-btn'];
      if (this.currentLanguage === 'en') this.elements.foldBtn.classList.add('english-text');
      else this.elements.foldBtn.classList.remove('english-text');
    }
    if (this.elements.checkBtn) {
      this.elements.checkBtn.textContent = t['check-btn'];
      if (this.currentLanguage === 'en') this.elements.checkBtn.classList.add('english-text');
      else this.elements.checkBtn.classList.remove('english-text');
    }
    if (this.elements.callBtn) {
      const callAmount = this.elements.callAmount?.textContent || document.getElementById('call-amount')?.textContent || '';
      const t_label = t['call-btn'] || '跟注';
      this.elements.callBtn.innerHTML = `${t_label} <span id="call-amount">${callAmount}</span>`;
      this.elements.callAmount = document.getElementById('call-amount');
      if (this.currentLanguage === 'en') this.elements.callBtn.classList.add('english-text');
      else this.elements.callBtn.classList.remove('english-text');
    }
    if (this.elements.raiseBtn) {
      this.elements.raiseBtn.textContent = t['raise-btn'];
      if (this.currentLanguage === 'en') this.elements.raiseBtn.classList.add('english-text');
      else this.elements.raiseBtn.classList.remove('english-text');
    }
    if (this.elements.allInBtn) {
      this.elements.allInBtn.textContent = t['all-in-btn'];
      if (this.currentLanguage === 'en') this.elements.allInBtn.classList.add('english-text');
      else this.elements.allInBtn.classList.remove('english-text');
    }

    const hostPanelTitle = document.querySelector('.host-panel h3');
    if (hostPanelTitle) {
      hostPanelTitle.textContent = t['host-panel-title'];
      if (this.currentLanguage === 'en') hostPanelTitle.classList.add('english-text');
      else hostPanelTitle.classList.remove('english-text');
    }

    const smallBlindLabel = document.querySelector('label[for="small-blind-input"]');
    if (smallBlindLabel) {
      smallBlindLabel.textContent = t['small-blind'];
      if (this.currentLanguage === 'en') smallBlindLabel.classList.add('english-text');
      else smallBlindLabel.classList.remove('english-text');
    }

    const bigBlindLabel = document.querySelector('label[for="big-blind-input"]');
    if (bigBlindLabel) {
      bigBlindLabel.textContent = t['big-blind'];
      if (this.currentLanguage === 'en') bigBlindLabel.classList.add('english-text');
      else bigBlindLabel.classList.remove('english-text');
    }

    const initialChipsLabel = document.querySelector('label[for="initial-chips-input"]');
    if (initialChipsLabel) {
      initialChipsLabel.textContent = this.currentLanguage === 'zh' ? '初始积分' : 'Initial Chips';
      if (this.currentLanguage === 'en') initialChipsLabel.classList.add('english-text');
      else initialChipsLabel.classList.remove('english-text');
    }

    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.textContent = t['start-game'];
      if (this.currentLanguage === 'en') this.elements.startGameBtn.classList.add('english-text');
      else this.elements.startGameBtn.classList.remove('english-text');
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.textContent = t['next-hand'];
      if (this.currentLanguage === 'en') this.elements.nextHandBtn.classList.add('english-text');
      else this.elements.nextHandBtn.classList.remove('english-text');
    }

    const resetGameBtn = document.getElementById('reset-game');
    if (resetGameBtn) {
      resetGameBtn.textContent = t['reset-game'];
      if (this.currentLanguage === 'en') resetGameBtn.classList.add('english-text');
      else resetGameBtn.classList.remove('english-text');
    }

    document.querySelectorAll('.seat-label').forEach(label => {
      const text = label.textContent;
      if (text.includes('座位') || text.includes('Seat')) {
        label.textContent = `${t['seat-label']} ${text.match(/\d+/)[0]}`;
        if (this.currentLanguage === 'en') label.classList.add('english-text');
        else label.classList.remove('english-text');
      }
    });

    document.querySelectorAll('.player-status.folded').forEach(status => {
      status.textContent = t['folded'];
      if (this.currentLanguage === 'en') status.classList.add('english-text');
      else status.classList.remove('english-text');
    });

    const exitRoomBtn = document.getElementById('exit-room');
    if (exitRoomBtn) {
      exitRoomBtn.textContent = t['exit-room'];
      if (this.currentLanguage === 'en') exitRoomBtn.classList.add('english-text');
      else exitRoomBtn.classList.remove('english-text');
    }

    const switchBgBtn = document.getElementById('switch-table-bg');
    if (switchBgBtn) {
      switchBgBtn.textContent = t['switch-bg'];
      if (this.currentLanguage === 'en') switchBgBtn.classList.add('english-text');
      else switchBgBtn.classList.remove('english-text');
    }

    const copyBtn = document.getElementById('copy-room-id');
    if (copyBtn) {
      copyBtn.textContent = t['copy'];
      if (this.currentLanguage === 'en') copyBtn.classList.add('english-text');
      else copyBtn.classList.remove('english-text');
    }

    const roomInfo = document.querySelector('.room-info');
    if (roomInfo) {
      roomInfo.innerHTML = `${t['room-number']}: <span id="room-id" class="room-id">${this.elements.roomId?.textContent || '--'}</span>
        <button id="copy-room-id" class="btn copy-btn header-btn">${t['copy']}</button>`;
      this.elements.roomId = document.getElementById('room-id');
      if (this.currentLanguage === 'en') {
        roomInfo.classList.add('english-text');
        const newCopyBtn = document.getElementById('copy-room-id');
        if (newCopyBtn) newCopyBtn.classList.add('english-text');
      } else {
        roomInfo.classList.remove('english-text');
        const newCopyBtn = document.getElementById('copy-room-id');
        if (newCopyBtn) newCopyBtn.classList.remove('english-text');
      }
    }

    const actionPanelTitle = document.querySelector('.action-panel h3');
    if (actionPanelTitle) {
      actionPanelTitle.textContent = this.currentLanguage === 'zh' ? '下注操作' : 'Betting Actions';
      if (this.currentLanguage === 'en') actionPanelTitle.classList.add('english-text');
      else actionPanelTitle.classList.remove('english-text');
    }

    const chipsHistoryTitle = document.querySelector('.chips-history h4');
    if (chipsHistoryTitle) {
      chipsHistoryTitle.textContent = this.currentLanguage === 'zh' ? '积分历史' : 'Chips History';
      if (this.currentLanguage === 'en') chipsHistoryTitle.classList.add('english-text');
      else chipsHistoryTitle.classList.remove('english-text');
    }

    const clearBetBtn = document.getElementById('clear-bet-btn');
    if (clearBetBtn) {
      clearBetBtn.textContent = t['clear-btn'];
      if (this.currentLanguage === 'en') clearBetBtn.classList.add('english-text');
      else clearBetBtn.classList.remove('english-text');
    }

    const continueGameBtn = document.getElementById('continue-game-btn');
    if (continueGameBtn) {
      continueGameBtn.textContent = this.currentLanguage === 'zh' ? '继续游戏' : 'Continue Game';
      if (this.currentLanguage === 'en') continueGameBtn.classList.add('english-text');
      else continueGameBtn.classList.remove('english-text');
    }

    const gameLogTitle = document.querySelector('.game-log-panel h3');
    if (gameLogTitle) {
      gameLogTitle.textContent = t['game-log-title'];
      if (this.currentLanguage === 'en') gameLogTitle.classList.add('english-text');
      else gameLogTitle.classList.remove('english-text');
    }

    const potLimitBadge = document.querySelector('.pot-limit-badge');
    if (potLimitBadge) {
      potLimitBadge.textContent = t['pot-limit'];
    }

    document.querySelectorAll('.player-name').forEach(name => {
      if (this.currentLanguage === 'en') name.classList.add('english-text');
      else name.classList.remove('english-text');
    });

    document.querySelectorAll('.player-chips').forEach(chips => {
      if (this.currentLanguage === 'en') chips.classList.add('english-text');
      else chips.classList.remove('english-text');
    });

    const potBlindInfo = document.querySelector('.pot-blind-info');
    if (potBlindInfo) {
      if (this.currentLanguage === 'en') potBlindInfo.classList.add('english-text');
      else potBlindInfo.classList.remove('english-text');
    }

    document.querySelectorAll('.log-entry').forEach(entry => {
      if (this.currentLanguage === 'en') entry.classList.add('english-text');
      else entry.classList.remove('english-text');
    });

    document.querySelectorAll('.pot-quick-btn').forEach(btn => {
      const fraction = btn.dataset.fraction;
      if (fraction === '0.33') btn.textContent = t['pot-1-3'];
      else if (fraction === '0.5') btn.textContent = t['pot-1-2'];
      else if (fraction === '1') btn.textContent = t['pot-1'];
      if (this.currentLanguage === 'en') btn.classList.add('english-text');
      else btn.classList.remove('english-text');
    });

    const speedLabel = document.querySelector('.game-speed-control label');
    if (speedLabel) {
      speedLabel.textContent = t['game-speed'];
      if (this.currentLanguage === 'en') speedLabel.classList.add('english-text');
      else speedLabel.classList.remove('english-text');
    }

    const slowLabel = document.querySelector('.speed-label-slow');
    const fastLabel = document.querySelector('.speed-label-fast');
    if (slowLabel) slowLabel.textContent = t['speed-slow'];
    if (fastLabel) fastLabel.textContent = t['speed-fast'];

    const soundToggle = document.getElementById('sound-toggle');
    if (soundToggle && window.pokerSoundManager) {
      soundToggle.textContent = pokerSoundManager.enabled ? t['sound-on'] : t['sound-off'];
      soundToggle.classList.toggle('muted', !pokerSoundManager.enabled);
    }
  }

  addGameLog(message, type = 'system') {
    const logList = document.getElementById('game-log-list');
    if (!logList) return;
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.innerHTML = message;
    logList.appendChild(entry);
    logList.scrollTop = logList.scrollHeight;
    while (logList.children.length > 50) {
      logList.removeChild(logList.firstChild);
    }

    if (window.pokerSoundManager) {
      switch (type) {
        case 'fold': pokerSoundManager.fold(); break;
        case 'check': pokerSoundManager.check(); break;
        case 'call': pokerSoundManager.call(); break;
        case 'raise': pokerSoundManager.raise(); break;
        case 'allin': pokerSoundManager.allIn(); break;
        case 'winner': pokerSoundManager.winner(); break;
      }
    }
  }

  repositionSeats() {
    const area = document.querySelector('.players-area');
    if (!area) return;

    const activeSeats = [];
    let selfSeatIdx = -1;

    for (let i = 0; i < 10; i++) {
      const seat = this.elements.playerSeats[i];
      if (seat && seat._playerData) {
        activeSeats.push(i);
        if (this.myPlayerId && seat._playerData.id === this.myPlayerId) {
          selfSeatIdx = i;
        }
      }
    }

    if (selfSeatIdx === -1 && activeSeats.length > 0) {
      selfSeatIdx = activeSeats[0];
    }

    if (activeSeats.length === 0) {
      for (let i = 0; i < 10; i++) {
        const seat = this.elements.playerSeats[i];
        if (seat) {
          seat.style.left = '';
          seat.style.top = '';
          seat.style.transform = '';
          seat.classList.remove('pos-bottom', 'pos-top', 'pos-left', 'pos-right');
        }
      }
      return;
    }

    const sortedSeats = [...activeSeats].sort((a, b) => a - b);
    const selfPosInList = sortedSeats.indexOf(selfSeatIdx);
    const numPlayers = sortedSeats.length;

    const startAngle = 180;
    const angleStep = 360 / numPlayers;

    const rx = 38;
    const ry = 42;
    const cx = 50;
    const cy = 50;

    sortedSeats.forEach((seatIdx, listIdx) => {
      const relativePos = (listIdx - selfPosInList + numPlayers) % numPlayers;
      const angle = startAngle + relativePos * angleStep;
      const rad = angle * Math.PI / 180;

      const x = cx + rx * Math.sin(rad);
      const y = cy - ry * Math.cos(rad);

      const normalizedAngle = ((angle % 360) + 360) % 360;
      const distFromBottom = Math.abs(normalizedAngle - 180);
      const maxDist = 180;
      const perspectiveScale = 0.55 + 0.45 * (1 - distFromBottom / maxDist);

      const seat = this.elements.playerSeats[seatIdx];
      if (seat) {
        seat.style.left = x + '%';
        seat.style.top = y + '%';

        seat.classList.remove('pos-bottom', 'pos-top', 'pos-left', 'pos-right');
        if (normalizedAngle >= 135 && normalizedAngle <= 225) {
          seat.classList.add('pos-bottom');
        } else if (normalizedAngle > 225 && normalizedAngle < 315) {
          seat.classList.add('pos-left');
        } else if (normalizedAngle >= 315 || normalizedAngle <= 45) {
          seat.classList.add('pos-top');
        } else {
          seat.classList.add('pos-right');
        }

        seat.style.transform = 'translate(-50%, -50%)';
        seat.style.opacity = '';
      }

      const betEl = this.elements.playerBets[seatIdx];
      if (betEl) {
        const betRad = rad;
        const betDist = 12;
        const bx = cx + (rx + betDist) * Math.sin(betRad);
        const by = cy - (ry + betDist) * Math.cos(betRad);
        betEl.style.left = bx + '%';
        betEl.style.top = by + '%';
      }
    });
  }
}

const omahaRoomUI = new OmahaRoomUI();

try {
  module.exports = omahaRoomUI;
} catch (e) {
  window.omahaRoomUI = omahaRoomUI;
}
