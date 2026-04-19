// 房间页UI更新模块
class RoomUI {
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
      nextHandBtn: document.getElementById('next-hand-btn'),
      startGameBtn: document.getElementById('start-game'),
      connectionStatus: document.getElementById('connection-status'),
    };

    this.currentLanguage = 'zh'; // 默认中文
    this.translations = {
      zh: {
        'language-button': '🌐 中文',
        'phase-waiting': '等待',
        'phase-pre-flop': '盲注',
        'phase-flop': '翻牌',
        'phase-turn': '转牌',
        'phase-river': '河牌',
        'phase-showdown': '摊牌',
        'pot-label': '底池',
        'bet-label': '下注金额',
        'my-chips': '我的积分',
        'fold-btn': '弃牌',
        'check-btn': '过牌',
        'call-btn': '跟注',
        'raise-btn': '加注',
        'all-in-btn': '全押',
        'host-panel-title': '房主控制面板',
        'small-blind': '小盲注 (SB)',
        'big-blind': '大盲注 (BB)',
        'deal-order': '发牌顺序',
        'clockwise': '顺时针',
        'counter-clockwise': '逆时针',
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
        'poker-power-btn': '查看牌力规则',
        'clear-btn': '清空',
        'game-log-title': '游戏进程'
      },
      en: {
        'language-button': '🌐 English',
        'phase-waiting': 'Waiting',
        'phase-pre-flop': 'Blinds',
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
        'deal-order': 'Deal Order',
        'clockwise': 'Clockwise',
        'counter-clockwise': 'Counter-clockwise',
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
        'poker-power-btn': 'Poker Rules',
        'clear-btn': 'Clear',
        'game-log-title': 'Game Log'
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

    this.bindEvents();
    
    // 初始化语言设置
    this.updateLanguage();
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
      if (confirm('确定要退出房间吗？')) {
        window.location.href = 'index.html';
      }
    });

    const switchBgBtn = document.getElementById('switch-table-bg');
    bindEvent(switchBgBtn, () => {
      this.switchTableBackground();
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

    // 继续游戏按钮点击事件
    const continueGameBtn = document.getElementById('continue-game-btn');
    bindEvent(continueGameBtn, () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('confirmContinue');
      }
    });

    // 下注操作按钮事件绑定
    bindEvent(this.elements.foldBtn, () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('fold');
      }
    });

    bindEvent(this.elements.checkBtn, () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('check');
      }
    });

    bindEvent(this.elements.callBtn, () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('call');
      }
    });

    bindEvent(this.elements.raiseBtn, () => {
      if (window.gameManager) {
        const betAmount = this.getBetAmount();
        window.gameManager.sendGameAction('raise', { amount: betAmount });
      }
    });

    bindEvent(this.elements.allInBtn, () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('all-in');
      }
    });

    // 房主按钮事件绑定
    bindEvent(document.getElementById('start-game'), () => {
      if (window.gameManager) {
        const config = this.getHostConfig();
        window.gameManager.sendGameAction('startGame', config);
      }
    });

    bindEvent(document.getElementById('next-hand-btn'), () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('nextHand');
      }
    });

    bindEvent(document.getElementById('reset-game'), () => {
      if (window.gameManager) {
        window.gameManager.sendGameAction('resetGame');
      }
    });
  }

  updateRoomId(roomId) {
    this.elements.roomId.textContent = roomId;
  }

  updateCommunityCards(cards) {
    this.elements.communityCards.innerHTML = '';
    cards.forEach(card => {
      const cardElement = this.createCardElement(card);
      this.elements.communityCards.appendChild(cardElement);
    });
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
          betEl.textContent = currentBet;
          betEl.style.display = 'block';
          
          if (betChanged) {
            const seatRect = seat.getBoundingClientRect();
            const tableEl = seat.closest('main') || seat.parentElement;
            const tableRect = tableEl.getBoundingClientRect();
            const centerX = tableRect.left + tableRect.width / 2;
            const centerY = tableRect.top + tableRect.height / 2;
            const seatCenterX = seatRect.left + seatRect.width / 2;
            const seatCenterY = seatRect.top + seatRect.height / 2;
            const dx = centerX - seatCenterX;
            const dy = centerY - seatCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const moveDistance = Math.min(dist * 0.35, 120);
            const nx = dist > 0 ? dx / dist : 0;
            const ny = dist > 0 ? dy / dist : 0;
            const tx = Math.round(nx * moveDistance);
            const ty = Math.round(ny * moveDistance);
            betEl.style.setProperty('--bet-tx', tx + 'px');
            betEl.style.setProperty('--bet-ty', ty + 'px');
            
            betEl.classList.remove('fade-out');
            setTimeout(() => {
              betEl.classList.add('animate');
              
              setTimeout(() => {
                betEl.classList.remove('animate');
              }, 1500);
            }, 100);
          }
        } else {
          if (player.id) {
            this.previousBets[player.id] = 0;
          }
          if (betEl.style.display === 'block') {
            betEl.classList.add('fade-out');
            
            // 动画结束后隐藏元素
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
          statusEl.textContent = '已弃牌';
          statusEl.className = 'player-status folded';
          statusEl.style.display = 'block';
        } else if (player.chips === 0) {
          statusEl.textContent = 'ALL IN';
          statusEl.className = 'player-status allin';
          statusEl.style.display = 'block';
        } else {
          statusEl.style.display = 'none';
        }
      }
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
      if (this.currentBgTheme === 2) {
        cardElement.classList.add('theme-2');
      }
      return cardElement;
    }

    const suitSymbol = this.getSuitSymbol(card.suit);
    const suitColor = (card.suit === 'hearts' || card.suit === 'diamonds') ? '#d32f2f' : '#212121';

    cardElement.innerHTML = `
      <div class="card-value top" style="color: ${suitColor};">${card.value}<br>${suitSymbol}</div>
      <div class="card-suit center" style="color: ${suitColor};">${suitSymbol}</div>
      <div class="card-value bottom" style="color: ${suitColor};">${suitSymbol}<br>${card.value}</div>
    `;
    return cardElement;
  }

  getSuitSymbol(suit) {
    const map = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
    return map[suit] || '';
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
    if (this.elements.potAmount) {
      // 添加振动动效
      this.elements.potAmount.classList.add('pot-amount-vibrate');
      // 移除动效类
      setTimeout(() => {
        this.elements.potAmount.classList.remove('pot-amount-vibrate');
      }, 500);
      // 更新金额
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
    if (!this.elements.phaseIndicator) return;

    const phaseOrder = [
      'WAITING', 'PRE_FLOP_BLINDS', 'PRE_FLOP_BETTING',
      'FLOP_DEAL', 'FLOP_BETTING',
      'TURN_DEAL', 'TURN_BETTING',
      'RIVER_DEAL', 'RIVER_BETTING',
      'SHOWDOWN'
    ];

    const steps = this.elements.phaseIndicator.querySelectorAll('.phase-step');
    steps.forEach(step => {
      const stepPhase = step.dataset.phase;
      step.classList.remove('active', 'completed', 'current');

      const phaseIdx = phaseOrder.indexOf(phase);
      const stepIdx = phaseOrder.indexOf(stepPhase);

      if (stepIdx < 0) return;

      if (stepPhase === phase || 
          (phase.startsWith('PRE_FLOP') && stepPhase === 'PRE_FLOP_BLINDS') ||
          (phase === 'FLOP_DEAL' && stepPhase === 'FLOP_BETTING') ||
          (phase === 'TURN_DEAL' && stepPhase === 'TURN_BETTING') ||
          (phase === 'RIVER_DEAL' && stepPhase === 'RIVER_BETTING')) {
        step.classList.add('current');
      } else if (stepIdx < phaseIdx) {
        step.classList.add('completed');
      } else if (stepIdx > phaseIdx && phaseIdx >= 0) {
        // future - no special class
      }
    });

    // 当下注阶段结束时，触发筹码汇聚动画
    if (phase === 'FLOP_DEAL' || phase === 'TURN_DEAL' || phase === 'RIVER_DEAL' || phase === 'SHOWDOWN' || phase === 'HAND_END') {
      this.triggerBetGatherAnimation();
    }

    if (phase === 'HAND_END' || phase === 'WAITING') {
      steps.forEach(s => s.classList.remove('current'));
    }
  }

  // 触发筹码汇聚动画
  triggerBetGatherAnimation() {
    this.elements.playerBets.forEach(betEl => {
      if (betEl && betEl.style.display === 'block') {
        // 移除之前的动画类
        betEl.classList.remove('animate', 'fade-out');
        
        // 添加汇聚动画类
        betEl.classList.add('gather');
        
        // 动画结束后隐藏元素
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
  }

  showStartGameButton(show) {
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.style.display = show ? 'inline-block' : 'none';
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.style.display = 'none';
    }
  }

  hideHostButtons() {
    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.style.display = 'none';
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.style.display = 'none';
    }
  }

  showContinueGameButton(show) {
    const container = document.getElementById('continue-game-container');
    if (container) {
      container.style.display = show ? 'block' : 'none';
    }
  }

  showGameStatus(title, message) {
    this.elements.statusTitle.textContent = title;
    this.elements.statusMessage.textContent = message;
    this.elements.gameStatus.style.display = 'block';
    setTimeout(() => { this.hideGameStatus(); }, 2000);
  }

  hideGameStatus() {
    this.elements.gameStatus.style.display = 'none';
  }

  showHostPanel() {
    this.elements.hostPanel.style.display = 'block';
    document.getElementById('start-game').style.display = 'block';
    document.getElementById('reset-game').style.display = 'block';
  }

  hideHostPanel() {
    this.elements.hostPanel.style.display = 'none';
    document.getElementById('start-game').style.display = 'none';
    document.getElementById('next-hand-btn').style.display = 'none';
    document.getElementById('reset-game').style.display = 'none';
  }

  updateVoiceButton(enabled) {
    this.elements.voiceToggle.textContent = enabled ? '🔊 语音: 开启' : '🔇 语音: 关闭';
    this.elements.voiceToggle.classList.toggle('active', enabled);
  }

  updateConnectionStatus(connected) {
    if (!this.elements.connectionStatus) return;
    if (connected) {
      this.elements.connectionStatus.textContent = '🟢 已连接';
      this.elements.connectionStatus.className = 'connection-status connected';
    } else {
      this.elements.connectionStatus.textContent = '🔴 未连接';
      this.elements.connectionStatus.className = 'connection-status disconnected';
    }
  }

  enableActionButtons(enabled, actionContext = {}) {
    const isBettingPhase = enabled;
    const canCheck = actionContext.canCheck === true;
    const canCall = actionContext.canCall === true;

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
      playerCards: 2,
      communityCards: 5,
    };
  }

  setMyPlayerId(playerId) {
    this.myPlayerId = playerId;
  }

  switchTableBackground() {
    const tableArea = document.querySelector('.players-area');
    const bgVideo = document.querySelector('.bg-video');
    if (!tableArea || !bgVideo) return;

    this.currentBgTheme = this.currentBgTheme === 1 ? 2 : 1;

    // 切换牌桌背景
    if (this.currentBgTheme === 2) {
      tableArea.classList.add('bg-theme-2');
      bgVideo.src = 'css/images/game-bg2.mp4';
    } else {
      tableArea.classList.remove('bg-theme-2');
      bgVideo.src = 'css/images/game-bg1.mp4';
    }
    bgVideo.load();

    // 切换扑克牌背
    const allBackCards = document.querySelectorAll('.poker-card.back');
    allBackCards.forEach(card => {
      if (this.currentBgTheme === 2) {
        card.classList.add('theme-2');
      } else {
        card.classList.remove('theme-2');
      }
    });
  }

  toggleLanguage() {
    this.currentLanguage = this.currentLanguage === 'zh' ? 'en' : 'zh';
    this.updateLanguage();
  }

  updateLanguage() {
    const t = this.translations[this.currentLanguage];
    
    // 更新语言按钮
    if (this.elements.languageToggle) {
      this.elements.languageToggle.textContent = t['language-button'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.languageToggle.classList.add('english-text');
      } else {
        this.elements.languageToggle.classList.remove('english-text');
      }
    }

    // 更新阶段指示器
    const phaseSteps = document.querySelectorAll('.phase-step');
    phaseSteps.forEach(step => {
      const phase = step.dataset.phase;
      let key = '';
      switch (phase) {
        case 'WAITING': key = 'phase-waiting'; break;
        case 'PRE_FLOP_BLINDS': key = 'phase-pre-flop'; break;
        case 'PRE_FLOP_BETTING': key = 'phase-pre-flop'; break;
        case 'FLOP_BETTING': key = 'phase-flop'; break;
        case 'TURN_BETTING': key = 'phase-turn'; break;
        case 'RIVER_BETTING': key = 'phase-river'; break;
        case 'SHOWDOWN': key = 'phase-showdown'; break;
      }
      if (key) {
        const label = step.querySelector('.phase-label');
        if (label) {
          label.textContent = t[key];
          // 为英文文本添加特殊字体
          if (this.currentLanguage === 'en') {
            label.classList.add('english-text');
          } else {
            label.classList.remove('english-text');
          }
        }
      }
    });

    // 更新底池标签
    const potMain = document.querySelector('.pot-main');
    if (potMain) {
      potMain.innerHTML = `${t['pot-label']}: <span id="pot-amount">${this.elements.potAmount?.textContent || 0}</span>`;
      this.elements.potAmount = document.getElementById('pot-amount');
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        potMain.classList.add('english-text');
      } else {
        potMain.classList.remove('english-text');
      }
    }

    // 更新下注操作面板
    const betControlLabel = document.querySelector('.bet-control label');
    if (betControlLabel) {
      betControlLabel.textContent = t['bet-label'];
      // 为英文文本添加特殊字体
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
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        myInfo.classList.add('english-text');
      } else {
        myInfo.classList.remove('english-text');
      }
    }

    // 更新按钮文本
    if (this.elements.foldBtn) {
      this.elements.foldBtn.textContent = t['fold-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.foldBtn.classList.add('english-text');
      } else {
        this.elements.foldBtn.classList.remove('english-text');
      }
    }
    if (this.elements.checkBtn) {
      this.elements.checkBtn.textContent = t['check-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.checkBtn.classList.add('english-text');
      } else {
        this.elements.checkBtn.classList.remove('english-text');
      }
    }
    if (this.elements.callBtn) {
      const callAmount = this.elements.callAmount?.textContent || document.getElementById('call-amount')?.textContent || '';
      const t_label = t['call-btn'] || '跟注';
      this.elements.callBtn.innerHTML = `${t_label} <span id="call-amount">${callAmount}</span>`;
      this.elements.callAmount = document.getElementById('call-amount');
      if (this.currentLanguage === 'en') {
        this.elements.callBtn.classList.add('english-text');
      } else {
        this.elements.callBtn.classList.remove('english-text');
      }
    }
    if (this.elements.raiseBtn) {
      this.elements.raiseBtn.textContent = t['raise-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.raiseBtn.classList.add('english-text');
      } else {
        this.elements.raiseBtn.classList.remove('english-text');
      }
    }
    if (this.elements.allInBtn) {
      this.elements.allInBtn.textContent = t['all-in-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.allInBtn.classList.add('english-text');
      } else {
        this.elements.allInBtn.classList.remove('english-text');
      }
    }

    // 更新房主面板
    const hostPanelTitle = document.querySelector('.host-panel h3');
    if (hostPanelTitle) {
      hostPanelTitle.textContent = t['host-panel-title'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        hostPanelTitle.classList.add('english-text');
      } else {
        hostPanelTitle.classList.remove('english-text');
      }
    }

    const smallBlindLabel = document.querySelector('label[for="small-blind-input"]');
    if (smallBlindLabel) {
      smallBlindLabel.textContent = t['small-blind'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        smallBlindLabel.classList.add('english-text');
      } else {
        smallBlindLabel.classList.remove('english-text');
      }
    }

    const bigBlindLabel = document.querySelector('label[for="big-blind-input"]');
    if (bigBlindLabel) {
      bigBlindLabel.textContent = t['big-blind'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        bigBlindLabel.classList.add('english-text');
      } else {
        bigBlindLabel.classList.remove('english-text');
      }
    }

    const initialChipsLabel = document.querySelector('label[for="initial-chips-input"]');
    if (initialChipsLabel) {
      initialChipsLabel.textContent = this.currentLanguage === 'zh' ? '初始积分' : 'Initial Chips';
      if (this.currentLanguage === 'en') {
        initialChipsLabel.classList.add('english-text');
      } else {
        initialChipsLabel.classList.remove('english-text');
      }
    }

    if (this.elements.startGameBtn) {
      this.elements.startGameBtn.textContent = t['start-game'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.startGameBtn.classList.add('english-text');
      } else {
        this.elements.startGameBtn.classList.remove('english-text');
      }
    }
    if (this.elements.nextHandBtn) {
      this.elements.nextHandBtn.textContent = t['next-hand'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        this.elements.nextHandBtn.classList.add('english-text');
      } else {
        this.elements.nextHandBtn.classList.remove('english-text');
      }
    }

    const resetGameBtn = document.getElementById('reset-game');
    if (resetGameBtn) {
      resetGameBtn.textContent = t['reset-game'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        resetGameBtn.classList.add('english-text');
      } else {
        resetGameBtn.classList.remove('english-text');
      }
    }

    // 更新座位标签
    document.querySelectorAll('.seat-label').forEach(label => {
      const text = label.textContent;
      if (text.includes('座位') || text.includes('Seat')) {
        label.textContent = `${t['seat-label']} ${text.match(/\d+/)[0]}`;
        // 为英文文本添加特殊字体
        if (this.currentLanguage === 'en') {
          label.classList.add('english-text');
        } else {
          label.classList.remove('english-text');
        }
      }
    });

    // 更新状态标签
    document.querySelectorAll('.player-status.folded').forEach(status => {
      status.textContent = t['folded'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        status.classList.add('english-text');
      } else {
        status.classList.remove('english-text');
      }
    });

    // 更新其他按钮
    const exitRoomBtn = document.getElementById('exit-room');
    if (exitRoomBtn) {
      exitRoomBtn.textContent = t['exit-room'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        exitRoomBtn.classList.add('english-text');
      } else {
        exitRoomBtn.classList.remove('english-text');
      }
    }

    const switchBgBtn = document.getElementById('switch-table-bg');
    if (switchBgBtn) {
      switchBgBtn.textContent = t['switch-bg'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        switchBgBtn.classList.add('english-text');
      } else {
        switchBgBtn.classList.remove('english-text');
      }
    }

    const copyBtn = document.getElementById('copy-room-id');
    if (copyBtn) {
      copyBtn.textContent = t['copy'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        copyBtn.classList.add('english-text');
      } else {
        copyBtn.classList.remove('english-text');
      }
    }

    // 更新房间号标签
    const roomInfo = document.querySelector('.room-info');
    if (roomInfo) {
      roomInfo.innerHTML = `${t['room-number']}: <span id="room-id" class="room-id">${this.elements.roomId?.textContent || '--'}</span>
        <button id="copy-room-id" class="btn copy-btn header-btn">${t['copy']}</button>`;
      this.elements.roomId = document.getElementById('room-id');
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        roomInfo.classList.add('english-text');
        const newCopyBtn = document.getElementById('copy-room-id');
        if (newCopyBtn) {
          newCopyBtn.classList.add('english-text');
        }
      } else {
        roomInfo.classList.remove('english-text');
        const newCopyBtn = document.getElementById('copy-room-id');
        if (newCopyBtn) {
          newCopyBtn.classList.remove('english-text');
        }
      }
    }

    // 更新下注操作标题
    const actionPanelTitle = document.querySelector('.action-panel h3');
    if (actionPanelTitle) {
      actionPanelTitle.textContent = this.currentLanguage === 'zh' ? '下注操作' : 'Betting Actions';
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        actionPanelTitle.classList.add('english-text');
      } else {
        actionPanelTitle.classList.remove('english-text');
      }
    }

    // 更新积分历史标题
    const chipsHistoryTitle = document.querySelector('.chips-history h4');
    if (chipsHistoryTitle) {
      chipsHistoryTitle.textContent = this.currentLanguage === 'zh' ? '积分历史' : 'Chips History';
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        chipsHistoryTitle.classList.add('english-text');
      } else {
        chipsHistoryTitle.classList.remove('english-text');
      }
    }

    // 更新查看牌力规则按钮
    const pokerPowerBtn = document.getElementById('poker-power-btn');
    if (pokerPowerBtn) {
      pokerPowerBtn.textContent = t['poker-power-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        pokerPowerBtn.classList.add('english-text');
      } else {
        pokerPowerBtn.classList.remove('english-text');
      }
    }

    // 更新清空按钮
    const clearBetBtn = document.getElementById('clear-bet-btn');
    if (clearBetBtn) {
      clearBetBtn.textContent = t['clear-btn'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        clearBetBtn.classList.add('english-text');
      } else {
        clearBetBtn.classList.remove('english-text');
      }
    }

    // 更新继续游戏按钮
    const continueGameBtn = document.getElementById('continue-game-btn');
    if (continueGameBtn) {
      continueGameBtn.textContent = this.currentLanguage === 'zh' ? '继续游戏' : 'Continue Game';
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        continueGameBtn.classList.add('english-text');
      } else {
        continueGameBtn.classList.remove('english-text');
      }
    }

    // 更新游戏进程标题
    const gameLogTitle = document.querySelector('.game-log-panel h3');
    if (gameLogTitle) {
      gameLogTitle.textContent = t['game-log-title'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        gameLogTitle.classList.add('english-text');
      } else {
        gameLogTitle.classList.remove('english-text');
      }
    }

    // 更新玩家姓名
    document.querySelectorAll('.player-name').forEach(name => {
      if (this.currentLanguage === 'en') {
        name.classList.add('english-text');
      } else {
        name.classList.remove('english-text');
      }
    });

    // 更新玩家积分
    document.querySelectorAll('.player-chips').forEach(chips => {
      if (this.currentLanguage === 'en') {
        chips.classList.add('english-text');
      } else {
        chips.classList.remove('english-text');
      }
    });

    // 更新底池信息
    const potBlindInfo = document.querySelector('.pot-blind-info');
    if (potBlindInfo) {
      if (this.currentLanguage === 'en') {
        potBlindInfo.classList.add('english-text');
      } else {
        potBlindInfo.classList.remove('english-text');
      }
    }

    // 更新游戏日志条目
    document.querySelectorAll('.log-entry').forEach(entry => {
      if (this.currentLanguage === 'en') {
        entry.classList.add('english-text');
      } else {
        entry.classList.remove('english-text');
      }
    });

    // 重新绑定复制按钮事件
    setTimeout(() => {
      const newCopyBtn = document.getElementById('copy-room-id');
      if (newCopyBtn) {
        newCopyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(this.elements.roomId.textContent)
            .then(() => {
              this.showGameStatus(t['copy-success'], t['copy-message']);
              setTimeout(() => { this.hideGameStatus(); }, 500);
            })
            .catch(err => console.error('复制失败:', err));
        });
      }

      // 重新绑定退出按钮事件
      const newExitBtn = document.getElementById('exit-room');
      if (newExitBtn) {
        newExitBtn.addEventListener('click', () => {
          if (confirm(t['confirm-exit'])) {
            window.location.href = 'index.html';
          }
        });
      }
    }, 100);
  }
}

const roomUI = new RoomUI();

try {
  module.exports = roomUI;
} catch (e) {
  window.roomUI = roomUI;
}
