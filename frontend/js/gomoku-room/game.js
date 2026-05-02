var GomokuGameManager = (function() {

  function GomokuGameManager() {
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
    this.boardSize = 15;
    this.aiDifficulty = 'medium';
  }

  GomokuGameManager.prototype.init = function() {
    var params = new URLSearchParams(window.location.search);
    this.roomId = params.get('roomId');
    this.nickname = params.get('nickname') || 'Player';
    this.isHost = params.get('isHost') === 'true';
    this.isAiRoom = params.get('isAiRoom') === 'true';
    this.avatar = params.get('avatar') || 'froggy';
    this.boardSize = parseInt(params.get('boardSize')) || 15;
    this.aiDifficulty = params.get('aiDifficulty') || 'medium';

    this.ui = new GomokuRoomUI();
    this.ui.init();
    this.setupUICallbacks();
    this.connectAndJoin();
  };

  GomokuGameManager.prototype.setupUICallbacks = function() {
    var self = this;
    this.ui.onPlaceStone = function(row, col) {
      self.socketClient.sendGomokuAction('placeStone', { row: row, col: col });
    };
    this.ui.onStartGame = function() {
      self.socketClient.sendGomokuAction('startGame', {});
    };
    this.ui.onUndoRequest = function() {
      self.socketClient.sendGomokuAction('undoRequest', {});
    };
    this.ui.onUndoAccept = function() {
      self.socketClient.sendGomokuAction('undoAccept', {});
    };
    this.ui.onUndoReject = function() {
      self.socketClient.sendGomokuAction('undoReject', {});
    };
    this.ui.onResign = function() {
      if (confirm('确定认输吗？')) {
        self.socketClient.sendGomokuAction('resign', {});
      }
    };
    this.ui.onResetGame = function() {
      self.socketClient.sendGomokuAction('resetGame', {});
    };
  };

  GomokuGameManager.prototype.connectAndJoin = function() {
    var self = this;
    this.socketClient = new SocketClient();

    this.socketClient.connect().then(function() {
      self.setupSocketListeners();

      var existingPlayerId = localStorage.getItem('flexPoker_playerId');

      if (self.isHost) {
        if (self.isAiRoom) {
          return self.socketClient.createGomokuAiRoom(self.nickname, self.avatar, self.aiDifficulty, self.boardSize);
        } else {
          return self.socketClient.createGomokuRoom(self.nickname, self.avatar, self.boardSize);
        }
      } else {
        return self.socketClient.joinRoom(self.roomId, self.nickname, existingPlayerId, self.avatar);
      }
    }).then(function(response) {
      if (response) {
        self.playerId = response.playerId;
        self.roomId = response.roomId || self.roomId;
        localStorage.setItem('flexPoker_playerId', response.playerId);
        localStorage.setItem('flexPoker_roomId', self.roomId);
        var roomIdEl = document.getElementById('room-id');
        if (roomIdEl) roomIdEl.textContent = self.roomId;
      }
      self.initVoice();
    }).catch(function(err) {
      console.error('连接失败:', err);
      if (self.ui) self.ui.showNotification('连接失败: ' + (err.message || err));
    });
  };

  GomokuGameManager.prototype.setupSocketListeners = function() {
    var self = this;
    this.socketClient.socket.on('gomokuUpdate', function(state) {
      if (self.ui) self.ui.updateGameState(state);
      if (state.message) {
        self.ui.showNotification(state.message);
      }
    });
  };

  GomokuGameManager.prototype.initVoice = function() {
    var self = this;
    if (typeof agoraVoice !== 'undefined' && this.roomId) {
      this.agoraVoice = agoraVoice;
      this.agoraVoice.initialize().then(function(ok) {
        if (ok) {
          var uid = Date.now() % 100000;
          return self.agoraVoice.joinChannel(self.roomId, uid);
        }
      }).catch(function(err) {
        console.warn('语音初始化失败:', err);
      });
    }
  };

  GomokuGameManager.prototype.toggleMute = function() {
    if (!this.agoraVoice) return;
    this.isMuted = !this.isMuted;
    this.agoraVoice.toggleMicrophone();
  };

  GomokuGameManager.prototype.toggleSpeaker = function() {
    if (!this.agoraVoice) return;
    this.isSpeakerOn = !this.isSpeakerOn;
    this.agoraVoice.toggleSpeaker();
  };

  return GomokuGameManager;
})();

var gomokuGameManager = new GomokuGameManager();
document.addEventListener('DOMContentLoaded', function() { gomokuGameManager.init(); });
