class UnoGameManager {
  constructor() {
    this.socketClient = null;
    this.ui = null;
    this.roomId = null;
    this.nickname = null;
    this.isHost = false;
    this.isAiRoom = false;
    this.avatar = 'froggy';
    this.playerId = null;
    this.agoraVoice = null;
    this.isMuted = false;
    this.isSpeakerOn = true;
  }

  async init() {
    const params = new URLSearchParams(window.location.search);
    this.roomId = params.get('roomId');
    this.nickname = params.get('nickname') || 'Player';
    this.isHost = params.get('isHost') === 'true';
    this.isAiRoom = params.get('isAiRoom') === 'true';
    this.avatar = params.get('avatar') || 'froggy';

    this.ui = new UnoRoomUI();
    this.ui.init();
    this.ui.myPlayerId = null;
    this.ui.isHost = this.isHost;

    this.setupUICallbacks();
    await this.connectAndJoin();
  }

  setupUICallbacks() {
    this.ui.onPlayCard = (card) => this.playCard(card);
    this.ui.onChooseColor = (color) => this.chooseColor(color);
    this.ui.onResetGame = () => this.resetGame();
    this.ui.onContinueGame = () => this.continueGame();

    this.ui.elements.deckPile.addEventListener('click', () => this.drawCard());
    this.ui.elements.startGame.addEventListener('click', () => this.startGame());
    this.ui.elements.resetGame.addEventListener('click', () => this.resetGame());
    this.ui.elements.unoBtn.addEventListener('click', () => this.callUno());
    this.ui.elements.passBtn.addEventListener('click', () => this.passTurn());
    this.ui.elements.voiceToggle.addEventListener('click', () => this.toggleVoice());
  }

  async connectAndJoin() {
    this.socketClient = new SocketClient();

    try {
      await this.socketClient.connect();
      this.setupSocketListeners();

      if (this.isHost) {
        if (this.isAiRoom) {
          const aiCount = parseInt(new URLSearchParams(window.location.search).get('aiCount') || '3');
          const aiDifficulty = new URLSearchParams(window.location.search).get('aiDifficulty') || 'medium';
          const response = await this.socketClient.createUnoAiRoom(this.nickname, aiCount, aiDifficulty, this.avatar);
          this.roomId = response.roomId;
          this.playerId = response.playerId;
        } else {
          const response = await this.socketClient.createUnoRoom(this.nickname, this.avatar);
          this.roomId = response.roomId;
          this.playerId = response.playerId;
        }
      } else {
        const existingPlayerId = localStorage.getItem('unoPlayerId');
        const response = await this.socketClient.joinRoom(this.roomId, this.nickname, existingPlayerId, this.avatar);
        this.playerId = response.playerId;
        localStorage.setItem('unoPlayerId', this.playerId);
      }

      this.ui.myPlayerId = this.socketClient.socket.id;
      this.ui.updateRoomId(this.roomId);
      this.initVoice();
    } catch (error) {
      console.error('连接失败:', error);
      this.ui.showNotification('连接失败: ' + error.message, 3000);
    }
  }

  setupSocketListeners() {
    this.socketClient.socket.on('unoUpdate', (state) => {
      this.ui.myPlayerId = this.socketClient.socket.id;
      this.ui.updateGameState(state);
    });

    this.socketClient.socket.on('unoAction', (data) => {
      this.handleUnoAction(data);
    });

    this.socketClient.socket.on('error', (data) => {
      this.ui.showNotification(data.message || '发生错误', 3000);
    });

    this.socketClient.socket.on('disconnect', () => {
      this.ui.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink-broken.svg" alt="已断开" class="icon-sm">';
    });

    this.socketClient.socket.on('connect', () => {
      this.ui.elements.connectionStatus.innerHTML = '<img src="images/icons/hyperlink-3.svg" alt="已连接" class="icon-sm">';
      this.ui.myPlayerId = this.socketClient.socket.id;
    });
  }

  handleUnoAction(data) {
    switch (data.type) {
      case 'gameStart':
        this.ui.showNotification('游戏开始！', 1500);
        break;
      case 'cardEffect':
        const effectNames = {
          'skip': '跳过！',
          'reverse': '反转！',
          'draw2': '+2！',
          'wild_draw4': '+4！',
        };
        this.ui.showNotification(effectNames[data.effect] || '', 1500);
        break;
      case 'drawCard':
        this.ui.showNotification(`${data.player} 抽了一张牌`, 1000);
        break;
      case 'callUno':
        this.ui.showNotification(`${data.player} 喊了 UNO！`, 1500);
        break;
      case 'catchUno':
        this.ui.showNotification(`${data.target} 忘记喊UNO，罚抽2张！`, 2000);
        break;
      case 'gameEnd':
        break;
      case 'continueInfo':
        this.ui.showNotification(data.message || '继续对决', 2500);
        break;
      case 'continueFailed':
        this.ui.showNotification(data.message || '无法继续', 2500);
        break;
      case 'removedFromGame':
        this.ui.showNotification(data.message || '你已胜出', 3000);
        setTimeout(() => { window.location.href = 'index.html'; }, 3000);
        break;
      case 'becomeHost':
        this.isHost = true;
        this.ui.isHost = true;
        this.ui.showNotification('你已成为新房主', 2000);
        break;
    }
  }

  startGame() {
    this.socketClient.sendUnoAction('startGame', {});
  }

  playCard(card) {
    if (card.type === 'wild') {
      this.ui.elements.colorChooser.classList.add('visible');
      this.pendingWildCard = card;
      return;
    }
    this.socketClient.sendUnoAction('playCard', { cardId: card.id });
  }

  chooseColor(color) {
    if (this.pendingWildCard) {
      this.socketClient.sendUnoAction('playCard', {
        cardId: this.pendingWildCard.id,
        chosenColor: color,
      });
      this.pendingWildCard = null;
    } else {
      this.socketClient.sendUnoAction('chooseColor', { color });
    }
  }

  drawCard() {
    this.socketClient.sendUnoAction('drawCard', {});
  }

  callUno() {
    this.socketClient.sendUnoAction('callUno', {});
  }

  passTurn() {
    this.socketClient.sendUnoAction('passTurn', {});
  }

  resetGame() {
    this.socketClient.sendUnoAction('resetGame', {});
  }

  continueGame() {
    this.socketClient.sendUnoAction('continueGame', {});
  }

  async initVoice() {
    try {
      if (typeof AgoraVoice !== 'undefined') {
        this.agoraVoice = new AgoraVoice();
        await this.agoraVoice.initialize();
        await this.agoraVoice.joinChannel(this.roomId, this.playerId);
      }
    } catch (error) {
      console.warn('语音初始化失败:', error);
    }
  }

  async toggleVoice() {
    if (!this.agoraVoice) return;
    this.isMuted = !this.isMuted;
    await this.agoraVoice.toggleMicrophone();
    const icon = this.isMuted ? 'microphone-off.svg' : 'microphone.svg';
    const label = this.isMuted ? '语音关闭' : '语音开启';
    this.ui.elements.voiceToggle.innerHTML = `<img src="images/icons/${icon}" alt="${label}" class="icon-sm">`;
  }
}

const gameManager = new UnoGameManager();
document.addEventListener('DOMContentLoaded', () => gameManager.init());
