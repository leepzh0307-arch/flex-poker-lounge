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

    this.previousChips = 1000; // 初始积分
    this.handStartChips = undefined;

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
        const isAiRoom = params.get('isAiRoom') === 'true';
        let result;
        if (isAiRoom) {
          const aiCount = parseInt(params.get('aiCount') || '3', 10);
          const aiDifficulty = params.get('aiDifficulty') || 'medium';
          const initialChips = parseInt(params.get('initialChips') || '1000', 10);
          result = await socketClient.createAiRoom(nickname, aiCount, aiDifficulty, initialChips);
        } else {
          result = await socketClient.createRoom(nickname);
        }
        this.gameState.roomId = result.roomId;
        this.gameState.playerId = result.playerId;
        this.gameState.isHost = true;
        roomUI.showHostPanel();
        
        localStorage.setItem('playerId', result.playerId);
        roomUI.updateRoomId(result.roomId);

        const url = new URL(window.location);
        url.searchParams.set('roomId', result.roomId);
        url.searchParams.set('isCreating', 'false');
        url.searchParams.set('isHost', 'true');
        url.searchParams.delete('isAiRoom');
        url.searchParams.delete('aiCount');
        url.searchParams.delete('aiDifficulty');
        window.history.replaceState({}, '', url);
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
    // 语音按钮事件已在ui.js中绑定，这里不再重复绑定

    document.getElementById('exit-room').addEventListener('click', () => {
      if (confirm('确定要退出房间吗？')) {
        socketClient.leaveRoom();
        agoraVoice.leaveChannel();
        window.location.href = 'index.html';
      }
    });
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
        const roundBet = (player && gameState.roundBets && gameState.roundBets[player.id]) || 0;
        const handBet = (player && gameState.handBets && gameState.handBets[player.id]) || 0;
        roomUI.updatePlayerSeat(i, player, roundBet, handBet);
      }
    }

    const myPlayer = gameState.players.find(p => p.id === this.gameState.myPlayerId);
    if (myPlayer && (updates.players || updates.chips)) {
      roomUI.updateMyChips(myPlayer.chips);
    }
    
    // 游戏开始时记录初始积分
    if ((prevPhase === 'WAITING' || prevPhase === 'CONFIRM_CONTINUE') && 
        (phase === 'PRE_FLOP_BLINDS' || phase === 'PRE_FLOP_DEAL' || phase === 'PRE_FLOP_BETTING') && 
        myPlayer) {
      this.handStartChips = myPlayer.chips;
    }
    
    // 游戏结束时记录积分变化
    if (((prevPhase !== 'HAND_END' && phase === 'HAND_END') || (prevPhase === 'HAND_END' && phase === 'CONFIRM_CONTINUE')) && myPlayer && this.handStartChips !== undefined) {
      const chipsChange = myPlayer.chips - this.handStartChips;
      const isWin = chipsChange > 0;
      roomUI.addChipsHistoryEntry(Math.abs(chipsChange), isWin);
      this.handStartChips = undefined;
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

    // 检查是否需要显示继续游戏按钮
    if (phase === 'CONFIRM_CONTINUE') {
      roomUI.showContinueGameButton(true);
    } else {
      roomUI.showContinueGameButton(false);
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
        roomUI.clearWinnerBadges();
        break;
      case 'nextHand':
        this.addGameLog(`<span class="log-action">新一局开始</span>`, 'system');
        roomUI.clearWinnerBadges();
        break;
      case 'winner':
        let winnerMessage = `<span class="log-player">${name}</span> <span class="log-action">胜出</span>，赢得 <span class="log-amount">${action.amount || 0}</span> 积分`;
        if (action.hand) {
          winnerMessage += `（${action.hand}）`;
        }
        if (action.isTie) {
          winnerMessage += ' [平局]';
        }
        this.addGameLog(winnerMessage, 'winner');
        if (action.playerId) {
          roomUI.showWinnerBadge(action.playerId);
        }
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
