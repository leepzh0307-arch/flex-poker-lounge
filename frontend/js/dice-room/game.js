var DiceGameManager = (function () {
  function GameManager() {
    this.socket = null;
    this.roomId = null;
    this.playerId = null;
    this.ui = null;
    this.isHost = false;
    this.agoraVoice = null;
    this.isMuted = false;
  }

  GameManager.prototype.init = function () {
    this.ui = new DiceRoomUI();
    this.socket = io(typeof config !== 'undefined' ? config.serverUrl : undefined, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
    });

    var self = this;
    var hasJoined = false;

    this.socket.on('connect', function () {
      self.playerId = self.socket.id;
      self.ui.setMyPlayerId(self.playerId);
      self.ui.updateConnectionStatus('已连接');

      var params = new URLSearchParams(window.location.search);
      var nickname = params.get('nickname') || 'Player';
      var avatar = params.get('avatar') || 'bear';
      var isHost = params.get('isHost') === 'true';
      var roomId = params.get('roomId');

      if (!hasJoined) {
        if (isHost) {
          self.isHost = true;
          self.createRoom(nickname, avatar);
          hasJoined = true;
        } else if (roomId) {
          self.joinRoom(roomId, nickname, avatar);
          hasJoined = true;
        }
      } else if (roomId) {
        self.joinRoom(roomId, nickname, avatar);
      }
    });

    this.socket.on('disconnect', function () {
      self.ui.updateConnectionStatus('已断开');
    });

    this.socket.on('diceUpdate', function (data) {
      self.ui.updateGameState(data);
    });

    this.socket.on('diceAction', function (data) {
      if (data.type === 'rollAnimation') {
        var canvas = document.getElementById('dice-canvas');
        if (Dice3D && canvas) {
          Dice3D.init(canvas);
          Dice3D.throwDice(data.diceCount || 5, function (results) {
            self.sendGameAction('rollResult', { values: results });
          });
        }
      } else if (data.type === 'gameEnd') {
        self.ui.showGameOver(data.results);
      } else if (data.type === 'message') {
        self.ui.showNotification(data.message);
      } else if (data.type === 'revealAllVote') {
        self.ui.showVotePopup(data.requesterName, data.voteStatus);
      } else if (data.type === 'revealAllRejected') {
        self.ui.hideVotePopup();
        self.ui.showNotification('全员公开被拒绝');
      }
    });

    this.socket.on('roomCreated', function (data) {
      self.roomId = data.roomId;
      self.isHost = true;
      self.ui.setHost(true);
      self.ui.updateRoomId(data.roomId);
      self.ui.showNotification('房间创建成功: ' + data.roomId);
      self.initVoice();
    });

    this.socket.on('roomJoined', function (data) {
      self.roomId = data.roomId;
      self.isHost = data.isHost || false;
      self.ui.setHost(self.isHost);
      self.ui.updateRoomId(data.roomId);
      self.ui.showNotification('已加入房间: ' + data.roomId);
      self.initVoice();
    });

    this.socket.on('error', function (data) {
      self.ui.showNotification(data.message || '出错了', 5000);
    });

    this.bindVoiceToggle();
    window.diceGameManager = this;
  };

  GameManager.prototype.createRoom = function (nickname, avatar) {
    this.socket.emit('createDiceRoom', { nickname: nickname, avatar: avatar });
  };

  GameManager.prototype.joinRoom = function (roomId, nickname, avatar) {
    this.socket.emit('joinDiceRoom', { roomId: roomId, nickname: nickname, avatar: avatar });
  };

  GameManager.prototype.sendGameAction = function (action, data) {
    this.socket.emit('diceAction', { action: action, data: data || {} });
  };

  GameManager.prototype.initVoice = function () {
    try {
      if (typeof AgoraVoice !== 'undefined') {
        this.agoraVoice = new AgoraVoice();
        this.agoraVoice.initialize();
        this.agoraVoice.joinChannel(this.roomId, this.playerId);
      }
    } catch (error) {
      console.warn('语音初始化失败:', error);
    }
  };

  GameManager.prototype.bindVoiceToggle = function () {
    var self = this;
    var voiceBtn = document.getElementById('voice-toggle');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        if (!self.agoraVoice) return;
        self.isMuted = !self.isMuted;
        self.agoraVoice.toggleMicrophone();
        var icon = self.isMuted ? 'microphone-off.svg' : 'microphone.svg';
        var label = self.isMuted ? '语音关闭' : '语音开启';
        voiceBtn.innerHTML = '<img src="images/icons/' + icon + '" alt="' + label + '" class="icon-sm">';
      });
    }

    var langBtn = document.getElementById('language-toggle');
    if (langBtn) {
      langBtn.addEventListener('click', function () {
        var current = langBtn.textContent.trim();
        langBtn.textContent = current === '中文' ? 'EN' : '中文';
      });
    }
  };

  return GameManager;
})();

document.addEventListener('DOMContentLoaded', function () {
  var gameManager = new DiceGameManager();
  gameManager.init();
});
