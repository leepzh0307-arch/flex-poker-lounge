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
        'confirm-exit': '确定要退出房间吗？'
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
        'counter-clockwise': 'Counter-Clockwise',
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
        'room-number': 'Room ID',
        'copy': 'Copy',
        'connected': '🟢 Connected',
        'disconnected': '🔴 Disconnected',
        'copy-success': 'Copied',
        'copy-message': 'Room ID copied to clipboard',
        'confirm-exit': 'Are you sure you want to exit the room?'
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

    this.bindEvents();
    
    // 初始化语言设置
    this.updateLanguage();
  }

  bindEvents() {
    document.getElementById('copy-room-id').addEventListener('click', () => {
      navigator.clipboard.writeText(this.elements.roomId.textContent)
        .then(() => {
          this.showGameStatus('复制成功', '房间号已复制到剪贴板');
          setTimeout(() => { this.hideGameStatus(); }, 500);
        })
        .catch(err => console.error('复制失败:', err));
    });

    this.elements.exitRoom.addEventListener('click', () => {
      if (confirm('确定要退出房间吗？')) {
        window.location.href = 'index.html';
      }
    });

    const switchBgBtn = document.getElementById('switch-table-bg');
    if (switchBgBtn) {
      switchBgBtn.addEventListener('click', () => {
        this.switchTableBackground();
      });
    }

    if (this.elements.languageToggle) {
      this.elements.languageToggle.addEventListener('click', () => {
        this.toggleLanguage();
      });
    }

    if (this.elements.voiceToggle) {
      this.elements.voiceToggle.addEventListener('click', async () => {
        if (window.agoraVoice) {
          await window.agoraVoice.toggleMicrophone();
          const isEnabled = window.agoraVoice.isMicrophoneEnabled();
          this.updateVoiceButton(isEnabled);
        }
      });
    }

    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const current = parseInt(this.elements.betAmount.value) || 0;
        const add = parseInt(btn.dataset.amount) || 0;
        this.elements.betAmount.value = current + add;
      });
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

  updatePlayerSeat(seatIndex, player, currentBet = 0) {
    const seat = this.elements.playerSeats[seatIndex - 1];
    if (!seat) return;
    const badge = this.elements.positionBadges[seatIndex - 1];
    const betEl = this.elements.playerBets[seatIndex - 1];
    const statusEl = this.elements.playerStatuses[seatIndex - 1];

    seat.classList.remove('seat-empty', 'seat-occupied', 'seat-self');

    if (player) {
      const isSelf = this.myPlayerId && player.id === this.myPlayerId;

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
      seat.querySelector('.player-chips').textContent = player.chips;

      const cardsContainer = seat.querySelector('.player-cards');
      cardsContainer.innerHTML = '';
      if (player.cards) {
        player.cards.forEach(card => {
          const cardElement = this.createCardElement(card);
          cardsContainer.appendChild(cardElement);
        });
      }

      seat.classList.toggle('active', !!player.isActive);
      seat.classList.toggle('turn', !!player.isTurn);

      if (badge) {
        let badgeText = '';
        let badgeClass = '';
        if (player.isButton) { badgeText = 'BTN'; badgeClass = 'pos-btn'; }
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
        if (currentBet > 0 && player.isActive) {
          betEl.textContent = currentBet;
          betEl.style.display = 'block';
        } else {
          betEl.style.display = 'none';
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

      let labelEl = seat.querySelector('.seat-label');
      if (!labelEl) {
        labelEl = document.createElement('div');
        labelEl.className = 'seat-label';
        seat.appendChild(labelEl);
      }
      labelEl.textContent = `座位 ${seatIndex}`;
      labelEl.style.display = 'block';

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
    if (this.elements.callAmount) {
      this.elements.callAmount.textContent = amount > 0 ? amount : '';
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

    if (phase === 'HAND_END' || phase === 'WAITING') {
      steps.forEach(s => s.classList.remove('current'));
    }
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
    const hostActionsInline = document.getElementById('host-actions-inline');
    if (hostActionsInline) {
      hostActionsInline.style.display = 'flex';
    }
  }

  hideHostPanel() {
    this.elements.hostPanel.style.display = 'none';
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
      dealOrder: document.getElementById('deal-order')?.value || 'clockwise',
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
      const callAmount = this.elements.callAmount?.textContent || '';
      this.elements.callBtn.textContent = `${t['call-btn']} ${callAmount}`;
      // 为英文文本添加特殊字体
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

    const dealOrderLabel = document.querySelector('label[for="deal-order"]');
    if (dealOrderLabel) {
      dealOrderLabel.textContent = t['deal-order'];
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        dealOrderLabel.classList.add('english-text');
      } else {
        dealOrderLabel.classList.remove('english-text');
      }
    }

    // 更新初始积分标签
    const initialChipsLabel = document.querySelector('label[for="initial-chips-input"]');
    if (initialChipsLabel) {
      initialChipsLabel.textContent = this.currentLanguage === 'zh' ? '初始积分' : 'Initial Chips';
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        initialChipsLabel.classList.add('english-text');
      } else {
        initialChipsLabel.classList.remove('english-text');
      }
    }

    const dealOrderSelect = document.getElementById('deal-order');
    if (dealOrderSelect) {
      dealOrderSelect.options[0].text = t['clockwise'];
      dealOrderSelect.options[1].text = t['counter-clockwise'];
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
    const roomInfoText = document.querySelector('.room-info div');
    if (roomInfoText) {
      roomInfoText.innerHTML = `${t['room-number']}: <span id="room-id" class="room-id">${this.elements.roomId?.textContent || '--'}</span>
        <button id="copy-room-id" class="btn copy-btn">${t['copy']}</button>`;
      this.elements.roomId = document.getElementById('room-id');
      // 为英文文本添加特殊字体
      if (this.currentLanguage === 'en') {
        roomInfoText.classList.add('english-text');
      } else {
        roomInfoText.classList.remove('english-text');
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
