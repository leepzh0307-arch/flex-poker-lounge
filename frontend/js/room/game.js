// 房间页游戏状态管理
class GameManager {
  constructor() {
    this.gameState = {
      roomId: '',
      players: [],
      currentPlayer: null,
      communityCards: [],
      pots: [{ amount: 0, eligiblePlayers: [] }],
      currentBet: 0,
      minBet: 0,
      maxBet: 0,
      gamePhase: 'WAITING',
      isHost: false,
      myPlayerId: null,
      dealerButton: null,
      smallBlindAmount: 10,
      bigBlindAmount: 20,
    };

    this.init();
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.gameState.roomId = params.get('roomId');
    const nickname = params.get('nickname');
    this.gameState.isHost = params.get('isHost') === 'true';
    
    const savedPlayerId = localStorage.getItem('playerId');
    if (savedPlayerId) {
      this.gameState.playerId = savedPlayerId;
    }

    roomUI.updateRoomId(this.gameState.roomId);

    if (this.gameState.isHost) {
      roomUI.showHostPanel();
    } else {
      roomUI.hideHostPanel();
    }

    roomUI.showGameStatus('正在连接', '正在连接到服务器...');
    this.bindEvents();

    try {
      await socketClient.connect();
      roomUI.updateConnectionStatus(true);
      roomUI.showGameStatus('正在加入', '正在加入房间...');
      await this.initSocket();
      this.initVoice().catch(error => {
        console.error('语音初始化失败（不影响游戏）:', error);
      });
      roomUI.hideGameStatus();
    } catch (error) {
      console.error('连接失败:', error);
      roomUI.updateConnectionStatus(false);
      roomUI.showGameStatus('连接失败', error.message || '无法连接到服务器，请刷新页面重试');
    }
  }

  async initSocket() {
    this.gameState.myPlayerId = socketClient.getSocketId();
    roomUI.setMyPlayerId(this.gameState.myPlayerId);

    const params = new URLSearchParams(window.location.search);
    const nickname = params.get('nickname');
    const isCreating = params.get('isCreating') === 'true';

    if (isCreating) {
      const result = await socketClient.createRoom(nickname);
      this.gameState.roomId = result.roomId;
      this.gameState.playerId = result.playerId;
      
      localStorage.setItem('playerId', result.playerId);
      roomUI.updateRoomId(result.roomId);

      const url = new URL(window.location);
      url.searchParams.set('roomId', result.roomId);
      url.searchParams.set('isCreating', 'false');
      url.searchParams.set('isHost', 'true');
      window.history.replaceState({}, '', url);

      const response = await socketClient.joinRoom(result.roomId, nickname, result.playerId);
      this.updateGameState(response.gameState);
    } else {
      const playerId = this.gameState.playerId || null;
      const response = await socketClient.joinRoom(this.gameState.roomId, nickname, playerId);
      
      if (response.playerId) {
        this.gameState.playerId = response.playerId;
        localStorage.setItem('playerId', response.playerId);
      }
      
      this.updateGameState(response.gameState);
    }

    socketClient.on('gameUpdate', (gameState) => {
      this.updateGameState(gameState);
    });

    socketClient.on('playerJoined', (player) => {
      this.handlePlayerJoined(player);
    });

    socketClient.on('playerLeft', (playerId) => {
      this.handlePlayerLeft(playerId);
    });

    socketClient.on('gameAction', (action) => {
      this.handleGameAction(action);
    });
  }

  async initVoice() {
    try {
      await agoraVoice.initialize();
      await agoraVoice.joinChannel(this.gameState.roomId, Math.floor(Math.random() * 1000000));
      roomUI.updateVoiceButton(true);
    } catch (error) {
      console.error('初始化语音失败:', error);
    }
  }

  bindEvents() {
    document.getElementById('voice-toggle').addEventListener('click', async () => {
      const success = await agoraVoice.toggleMicrophone();
      if (success) {
        roomUI.updateVoiceButton(agoraVoice.isMicrophoneEnabled());
      }
    });

    document.getElementById('exit-room').addEventListener('click', () => {
      if (confirm('确定要退出房间吗？')) {
        socketClient.leaveRoom();
        agoraVoice.leaveChannel();
        window.location.href = 'index.html';
      }
    });

    document.getElementById('fold-btn').addEventListener('click', () => {
      this.sendGameAction('fold');
    });

    document.getElementById('check-btn').addEventListener('click', () => {
      this.sendGameAction('check');
    });

    document.getElementById('call-btn').addEventListener('click', () => {
      this.sendGameAction('call');
    });

    document.getElementById('raise-btn').addEventListener('click', () => {
      const amount = roomUI.getBetAmount();
      this.sendGameAction('raise', { amount });
    });

    document.getElementById('all-in-btn').addEventListener('click', () => {
      this.sendGameAction('all-in');
    });

    if (this.gameState.isHost) {
      document.getElementById('start-game').addEventListener('click', () => {
        const config = roomUI.getHostConfig();
        this.sendGameAction('startGame', config);
      });

      document.getElementById('next-hand-btn').addEventListener('click', () => {
        this.sendGameAction('nextHand');
      });

      document.getElementById('reset-game').addEventListener('click', () => {
        if (confirm('确定要重置游戏吗？所有积分将恢复为1000')) {
          this.sendGameAction('resetGame');
        }
      });
    }
  }

  updateGameState(gameState) {
    const prevPhase = this.gameState.gamePhase;
    
    // 智能更新：只更新变化的部分
    const updates = this.detectChanges(this.gameState, gameState);
    
    // 应用更新
    this.applyUpdates(updates);
    
    // 更新当前状态
    this.gameState = { ...this.gameState, ...gameState };

    const phase = gameState.gamePhase || 'WAITING';
    const sb = gameState.smallBlindAmount || 10;
    const bb = gameState.bigBlindAmount || 20;

    console.log(`[前端状态] phase=${phase}, currentPlayer=${gameState.currentPlayer}, myId=${this.gameState.myPlayerId}, isMyTurn=${gameState.currentPlayer === this.gameState.myPlayerId}, roundBets=`, gameState.roundBets);

    // 只在公共牌变化时更新
    if (updates.communityCards) {
      roomUI.updateCommunityCards(gameState.communityCards || []);
    }
    
    roomUI.updatePhaseIndicator(phase);
    roomUI.updateBlindInfo(sb, bb);

    // 优化玩家座位更新：只更新变化的玩家
    if (updates.players) {
      for (let i = 1; i <= 9; i++) {
        const player = gameState.players.find(p => p.seat === i);
        const playerBet = (player && gameState.roundBets && gameState.roundBets[player.id]) || 0;
        roomUI.updatePlayerSeat(i, player, playerBet);
      }
    }

    const myPlayer = gameState.players.find(p => p.id === this.gameState.myPlayerId);
    if (myPlayer && (updates.players || updates.chips)) {
      roomUI.updateMyChips(myPlayer.chips);
    }

    const totalPot = gameState.pots ? gameState.pots.reduce((sum, pot) => sum + pot.amount, 0) : 0;
    roomUI.updatePot(totalPot);

    const isMyTurn = gameState.currentPlayer === this.gameState.myPlayerId;
    const bettingPhases = ['PRE_FLOP_BETTING', 'FLOP_BETTING', 'TURN_BETTING', 'RIVER_BETTING'];
    const canPlay = isMyTurn && bettingPhases.includes(phase);

    let actionContext = {};
    if (canPlay && myPlayer) {
      const callAmt = Math.max(0, (gameState.currentBet || 0) - (gameState.roundBets?.[myPlayer.id] || 0));
      actionContext = {
        canCheck: (gameState.currentBet || 0) <= (gameState.roundBets?.[myPlayer.id] || 0),
        canCall: callAmt > 0 && myPlayer.chips > 0,
        callAmount: callAmt > 0 ? callAmt : 0,
      };
    }

    roomUI.enableActionButtons(canPlay, actionContext);

    if (this.gameState.isHost) {
      if (phase === 'WAITING') {
        roomUI.showStartGameButton(true);
      } else if (phase === 'HAND_END') {
        roomUI.showNextHandButton(true);
      } else {
        roomUI.hideHostButtons();
      }
    }

    if (gameState.message && updates.message) {
      roomUI.showGameStatus('游戏通知', gameState.message);
    }
  }
  
  detectChanges(oldState, newState) {
    const changes = {};
    
    if (oldState.gamePhase !== newState.gamePhase) {
      changes.gamePhase = true;
    }
    
    if (JSON.stringify(oldState.communityCards) !== JSON.stringify(newState.communityCards)) {
      changes.communityCards = true;
    }
    
    if (JSON.stringify(oldState.players) !== JSON.stringify(newState.players)) {
      changes.players = true;
    }
    
    if (oldState.currentPlayer !== newState.currentPlayer) {
      changes.currentPlayer = true;
    }
    
    if (newState.message && oldState.message !== newState.message) {
      changes.message = true;
    }
    
    return changes;
  }
  
  applyUpdates(updates) {
    // 可以在这里添加特定的更新逻辑
    // 目前主要用于标识哪些部分需要更新
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
  }

  handlePlayerJoined(player) {
    roomUI.showGameStatus('玩家加入', `${player.nickname} 加入了房间`);
    this.addGameLog(`<span class="log-player">${player.nickname}</span> <span class="log-action">加入了房间</span>`, 'system');
  }

  handlePlayerLeft(playerId) {
    const player = this.gameState.players.find(p => p.id === playerId);
    if (player) {
      roomUI.showGameStatus('玩家离开', `${player.nickname} 离开了房间`);
      this.addGameLog(`<span class="log-player">${player.nickname}</span> <span class="log-action">离开了房间</span>`, 'system');
    }
  }

  handleGameAction(action) {
    console.log('游戏操作:', action);
    const name = action.nickname || '';
    switch (action.type) {
      case 'fold':
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">弃牌</span>`, 'fold');
        break;
      case 'check':
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">过牌</span>`, 'check');
        break;
      case 'call':
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">跟注</span> <span class="log-amount">${action.amount || ''}</span>`, 'call');
        break;
      case 'raise':
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">加注</span> <span class="log-amount">${action.amount || ''}</span>`, 'raise');
        break;
      case 'all-in':
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">全押</span> <span class="log-amount">${action.amount || ''}</span>`, 'allin');
        break;
      case 'startGame':
        this.addGameLog(`<span class="log-action">游戏开始！</span>`, 'system');
        break;
      case 'nextHand':
        this.addGameLog(`<span class="log-action">新一局开始</span>`, 'system');
        break;
      default:
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">${action.type || '行动'}</span>`, 'system');
    }
  }

  sendGameAction(action, data = {}) {
    console.log(`[游戏操作] 发送: ${action}`, data);
    socketClient.sendGameAction(action, data);
  }

  getGameState() {
    return this.gameState;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.gameManager = new GameManager();
});
