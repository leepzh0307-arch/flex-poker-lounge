class OmahaGameManager {
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

    this.previousChips = 1000;
    this.handStartChips = undefined;

    this.init();
  }

  async init() {
    const params = new URLSearchParams(window.location.search);

    try {
      const stored = sessionStorage.getItem('flexPokerNavParams');
      if (stored) {
        const storedParams = JSON.parse(stored);
        Object.keys(storedParams).forEach(function(key) {
          if (!params.has(key)) {
            params.set(key, storedParams[key]);
          }
        });
        sessionStorage.removeItem('flexPokerNavParams');
      }
    } catch (e) {}

    this.gameState.roomId = params.get('roomId');
    const nickname = params.get('nickname');
    this.gameState.isHost = params.get('isHost') === 'true';

    const savedPlayerId = localStorage.getItem('omahaPlayerId');
    if (savedPlayerId) {
      this.gameState.playerId = savedPlayerId;
    }

    omahaRoomUI.updateRoomId(this.gameState.roomId);

    if (this.gameState.isHost) {
      omahaRoomUI.showHostPanel();
    } else {
      omahaRoomUI.hideHostPanel();
    }

    omahaRoomUI.showGameStatus('正在连接', '正在连接到服务器...');
    this.bindEvents();

    try {
      await socketClient.connect();
      omahaRoomUI.updateConnectionStatus(true);
      omahaRoomUI.showGameStatus('正在加入', '正在加入房间...');
      await this.initSocket();
      this.initVoice().catch(error => {
        console.error('语音初始化失败（不影响游戏）:', error);
      });
      omahaRoomUI.hideGameStatus();
    } catch (error) {
      console.error('连接失败:', error);
      omahaRoomUI.updateConnectionStatus(false);
      omahaRoomUI.showGameStatus('连接失败', error.message || '无法连接到服务器，请刷新页面重试');
    }
  }

  async initSocket() {
    this.gameState.myPlayerId = socketClient.getSocketId();
    omahaRoomUI.setMyPlayerId(this.gameState.myPlayerId);

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
        result = await socketClient.createOmahaAiRoom(nickname, aiCount, aiDifficulty, initialChips);
      } else {
        result = await socketClient.createOmahaRoom(nickname);
      }
      this.gameState.roomId = result.roomId;
      this.gameState.playerId = result.playerId;

      localStorage.setItem('omahaPlayerId', result.playerId);
      omahaRoomUI.updateRoomId(result.roomId);

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
      const response = await socketClient.joinOmahaRoom(this.gameState.roomId, nickname, playerId);

      if (response.playerId) {
        this.gameState.playerId = response.playerId;
        localStorage.setItem('omahaPlayerId', response.playerId);
      }

      this.updateGameState(response.gameState);
    }

    socketClient.on('omahaUpdate', (gameState) => {
      this.updateGameState(gameState);
    });

    socketClient.on('omahaAction', (action) => {
      this.handleGameAction(action);
    });
  }

  async initVoice() {
    try {
      await agoraVoice.initialize();
      await agoraVoice.joinChannel(this.gameState.roomId, Math.floor(Math.random() * 1000000));
      omahaRoomUI.updateVoiceButton(true);
    } catch (error) {
      console.error('初始化语音失败:', error);
    }
  }

  bindEvents() {
  }

  updateGameState(gameState) {
    if (!gameState) return;

    const prevPhase = this.gameState.gamePhase;

    const updates = this.detectChanges(this.gameState, gameState);

    this.gameState = { ...this.gameState, ...gameState };

    const phase = gameState.gamePhase || 'WAITING';
    const sb = gameState.smallBlindAmount || 10;
    const bb = gameState.bigBlindAmount || 20;

    console.log(`[奥马哈前端状态] phase=${phase}, currentPlayer=${gameState.currentPlayer}, myId=${this.gameState.myPlayerId}, isMyTurn=${gameState.currentPlayer === this.gameState.myPlayerId}`);

    if (updates.communityCards) {
      omahaRoomUI.updateCommunityCards(gameState.communityCards || []);
    }

    omahaRoomUI.updatePhaseIndicator(phase);
    omahaRoomUI.updateBlindInfo(sb, bb);

    if (updates.players) {
      for (let i = 1; i <= 10; i++) {
        const player = gameState.players.find(p => p.seat === i);
        const roundBet = (player && gameState.roundBets && gameState.roundBets[player.id]) || 0;
        const handBet = (player && gameState.handBets && gameState.handBets[player.id]) || 0;
        omahaRoomUI.updatePlayerSeat(i, player, roundBet, handBet);
      }
    }

    const myPlayer = gameState.players.find(p => p.id === this.gameState.myPlayerId);
    if (myPlayer && (updates.players || updates.chips)) {
      omahaRoomUI.updateMyChips(myPlayer.chips);
    }

    if ((prevPhase === 'WAITING' || prevPhase === 'CONFIRM_CONTINUE') &&
        (phase === 'PRE_FLOP_BLINDS' || phase === 'PRE_FLOP_DEAL' || phase === 'PRE_FLOP_BETTING') &&
        myPlayer) {
      this.handStartChips = myPlayer.chips;
    }

    if (((prevPhase !== 'HAND_END' && phase === 'HAND_END') || (prevPhase === 'HAND_END' && phase === 'CONFIRM_CONTINUE')) && myPlayer && this.handStartChips !== undefined) {
      const chipsChange = myPlayer.chips - this.handStartChips;
      const isWin = chipsChange > 0;
      omahaRoomUI.addChipsHistoryEntry(Math.abs(chipsChange), isWin);
      this.handStartChips = undefined;
    }

    const totalPot = gameState.pots ? gameState.pots.reduce((sum, pot) => sum + pot.amount, 0) : 0;
    omahaRoomUI.updatePot(totalPot);

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

    omahaRoomUI.enableActionButtons(canPlay, actionContext);

    if (this.gameState.isHost) {
      if (phase === 'WAITING') {
        omahaRoomUI.showStartGameButton(true);
      } else if (phase === 'HAND_END') {
        omahaRoomUI.showNextHandButton(true);
      } else {
        omahaRoomUI.hideHostButtons();
      }
      if (updates.players) {
        omahaRoomUI.updatePlayerSelect(gameState.players || []);
      }
    }

    if (phase === 'CONFIRM_CONTINUE') {
      omahaRoomUI.showContinueGameButton(true);
    } else {
      omahaRoomUI.showContinueGameButton(false);
    }

    if (gameState.message && updates.message) {
      omahaRoomUI.showGameStatus('游戏通知', gameState.message);
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

  handleGameAction(action) {
    console.log('奥马哈游戏操作:', action);
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
        omahaRoomUI.clearWinnerBadges();
        if (window.pokerSoundManager) pokerSoundManager.gameStart();
        break;
      case 'nextHand':
        this.addGameLog(`<span class="log-action">新一局开始</span>`, 'system');
        omahaRoomUI.clearWinnerBadges();
        if (window.pokerSoundManager) pokerSoundManager.nextHand();
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
          omahaRoomUI.showWinnerBadge(action.playerId);
        }
        break;
      case 'settleGame':
        this.addGameLog(`<span class="log-action">牌局已结算</span>`, 'system');
        if (action.scoreboard) {
          omahaRoomUI.showSettleModal(action.scoreboard);
        }
        break;
      default:
        this.addGameLog(`<span class="log-player">${name}</span> <span class="log-action">${action.type || '行动'}</span>`, 'system');
    }
  }

  addGameLog(message, type = 'system') {
    omahaRoomUI.addGameLog(message, type);
  }

  sendGameAction(action, data = {}) {
    console.log(`[奥马哈游戏操作] 发送: ${action}`, data);
    socketClient.sendOmahaAction(action, data);
  }

  getGameState() {
    return this.gameState;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.omahaGameManager = new OmahaGameManager();
});
