var BasePokerGameManager = {};

BasePokerGameManager.createGameState = function() {
  return {
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
};

BasePokerGameManager.init = function(config) {
  this.gameState = this.createGameState();
  this.previousChips = 1000;
  this.handStartChips = undefined;
  this.roomUI = config.roomUI;
  this.playerIdKey = config.playerIdKey || 'playerId';
  this.updateEvent = config.updateEvent || 'gameUpdate';
  this.actionEvent = config.actionEvent || 'gameAction';
  this.socketActionFn = config.socketActionFn || 'sendGameAction';

  var params = new URLSearchParams(window.location.search);

  try {
    var stored = sessionStorage.getItem('flexPokerNavParams');
    if (stored) {
      var storedParams = JSON.parse(stored);
      Object.keys(storedParams).forEach(function(key) {
        if (!params.has(key)) { params.set(key, storedParams[key]); }
      });
      sessionStorage.removeItem('flexPokerNavParams');
    }
  } catch (e) {}

  this.gameState.roomId = params.get('roomId');
  var nickname = params.get('nickname');
  this.gameState.isHost = params.get('isHost') === 'true';

  var savedPlayerId = localStorage.getItem(this.playerIdKey);
  if (savedPlayerId) { this.gameState.playerId = savedPlayerId; }

  this.roomUI.updateRoomId(this.gameState.roomId);

  if (this.gameState.isHost) { this.roomUI.showHostPanel(); }
  else { this.roomUI.hideHostPanel(); }

  this.roomUI.showGameStatus('正在连接', '正在连接到服务器...');
  this.bindEvents();

  var self = this;
  socketClient.connect().then(function() {
    self.roomUI.updateConnectionStatus(true);
    self.roomUI.showGameStatus('正在加入', '正在加入房间...');
    self.initSocket().then(function() {
      self.initVoice().catch(function(error) {
        console.error('语音初始化失败（不影响游戏）:', error);
      });
      self.roomUI.hideGameStatus();
    });
  }).catch(function(error) {
    console.error('连接失败:', error);
    self.roomUI.updateConnectionStatus(false);
    self.roomUI.showGameStatus('连接失败', error.message || '无法连接到服务器，请刷新页面重试');
  });
};

BasePokerGameManager.initVoice = function() {
  var self = this;
  var params = new URLSearchParams(window.location.search);
  var voiceEnabled = params.get('voice') === 'true';
  if (voiceEnabled && typeof agoraVoice !== 'undefined') {
    var roomId = this.gameState.roomId;
    var userId = this.gameState.myPlayerId || socketClient.getSocketId();
    return agoraVoice.joinChannel(roomId, userId).then(function() {
      self.roomUI.updateVoiceButton(true);
    });
  }
  return Promise.resolve();
};

BasePokerGameManager.bindEvents = function() {};

BasePokerGameManager.detectChanges = function(newState) {
  var changes = {};
  if (!this._prevState) { this._prevState = {}; }

  var keys = Object.keys(newState);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (JSON.stringify(newState[key]) !== JSON.stringify(this._prevState[key])) {
      changes[key] = true;
    }
  }

  this._prevState = Object.assign({}, newState);
  return changes;
};

BasePokerGameManager.getGameState = function() { return this.gameState; };

BasePokerGameManager.updateGameState = function(data) {
  var self = this;
  var myPlayerId = this.gameState.myPlayerId;
  var myPlayer = data.players ? data.players.find(function(p) { return p.id === myPlayerId; }) : null;

  this.gameState.players = data.players || [];
  this.gameState.communityCards = data.communityCards || [];
  this.gameState.pots = data.pots || [];
  this.gameState.currentBet = data.currentBet || 0;
  this.gameState.gamePhase = data.gamePhase || 'WAITING';
  this.gameState.currentPlayer = data.currentPlayer || null;
  this.gameState.dealerButton = data.dealerButton;
  this.gameState.smallBlindAmount = data.smallBlindAmount || 10;
  this.gameState.bigBlindAmount = data.bigBlindAmount || 20;
  this.gameState.roundBets = data.roundBets || {};
  this.gameState.handBets = data.handBets || {};

  this.roomUI.updateGameState(data);

  var isBettingPhase = ['PRE_FLOP_BETTING', 'FLOP_BETTING', 'TURN_BETTING', 'RIVER_BETTING'].indexOf(data.gamePhase) !== -1;
  var canPlay = isBettingPhase && data.currentPlayer === myPlayerId;

  var actionContext = {};
  if (canPlay && myPlayer) {
    var callAmt = Math.max(0, (data.currentBet || 0) - (data.roundBets && data.roundBets[myPlayer.id] || 0));
    actionContext = {
      canCheck: (data.currentBet || 0) <= (data.roundBets && data.roundBets[myPlayer.id] || 0),
      canCall: callAmt > 0 && myPlayer.chips > 0,
      callAmount: callAmt > 0 ? callAmt : 0,
    };
  }

  this.roomUI.enableActionButtons(canPlay, actionContext);
};

BasePokerGameManager.handleGameAction = function(data) {
  var self = this;
  switch (data.type) {
    case 'startGame':
      this.roomUI.showGameStatus('游戏开始', '正在发牌...');
      setTimeout(function() { self.roomUI.hideGameStatus(); }, 1500);
      break;
    case 'nextHand':
      break;
    case 'winner':
      if (data.amount) {
        this.roomUI.addChipsHistoryEntry(data.amount, data.playerId === this.gameState.myPlayerId);
      }
      break;
    case 'settleGame':
      this.roomUI.showSettleModal(data.scoreboard);
      break;
  }
};

BasePokerGameManager.sendGameAction = function(action, data) {
  socketClient[this.socketActionFn](action, data);
};

BasePokerGameManager.addGameLog = function(message) {
  this.roomUI.addGameLog(message);
};

try { module.exports = BasePokerGameManager; } catch(e) { window.BasePokerGameManager = BasePokerGameManager; }
