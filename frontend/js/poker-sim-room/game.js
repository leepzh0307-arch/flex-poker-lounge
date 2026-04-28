var PokerSimGameManager = (function () {
  var SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  var RANKS = ['02', '03', '04', '05', '06', '07', '08', '09', '10', 'J', 'Q', 'K', 'A'];

  function GameManager() {
    this.socket = null;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
    this.players = [];
    this.deck = [];
    this.playerCards = {};
    this.includeJoker = true;
    this.isDragging = false;
    this.dragCard = null;
    this.dragGhost = null;
    this.agoraVoice = null;
    this.isMuted = false;
    this.notificationTimeout = null;
  }

  GameManager.prototype.init = function () {
    if (typeof io === 'undefined') {
      this.updateConnectionStatus('连接失败');
      this.showNotification('无法加载Socket.IO，请检查网络连接后刷新页面', 'error');
      return;
    }
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
      self.updateConnectionStatus('已连接');

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
      self.updateConnectionStatus('已断开');
    });

    this.socket.on('roomCreated', function (data) {
      self.roomId = data.roomId;
      self.isHost = true;
      self.showHostPanel(true);
      self.updateRoomId(data.roomId);
      self.showNotification('房间创建成功: ' + data.roomId);
      self.initVoice();
    });

    this.socket.on('roomJoined', function (data) {
      self.roomId = data.roomId;
      self.isHost = data.isHost || false;
      self.showHostPanel(self.isHost);
      self.updateRoomId(data.roomId);
      self.showNotification('已加入房间: ' + data.roomId);
      self.initVoice();
    });

    this.socket.on('simUpdate', function (data) {
      self.handleSimUpdate(data);
    });

    this.socket.on('simAction', function (data) {
      if (data.type === 'message') {
        self.showNotification(data.message);
      }
    });

    this.socket.on('error', function (data) {
      self.showNotification(data.message || '出错了', 5000);
    });

    this.bindUI();
    this.bindDragDrop();
    window.pokerSimGameManager = this;
  };

  GameManager.prototype.createRoom = function (nickname, avatar) {
    this.socket.emit('createPokerSimRoom', { nickname: nickname, avatar: avatar });
  };

  GameManager.prototype.joinRoom = function (roomId, nickname, avatar) {
    this.socket.emit('joinPokerSimRoom', { roomId: roomId, nickname: nickname, avatar: avatar });
  };

  GameManager.prototype.bindUI = function () {
    var self = this;

    var copyBtn = document.getElementById('copy-room');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var text = document.getElementById('room-id').textContent;
        if (navigator.clipboard) navigator.clipboard.writeText(text);
      });
    }

    var exitBtn = document.getElementById('exit-room');
    if (exitBtn) {
      exitBtn.addEventListener('click', function () {
        if (self.agoraVoice) self.agoraVoice.leaveChannel();
        window.location.href = 'index.html';
      });
    }

    var startBtn = document.getElementById('start-game');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        var jokerCb = document.getElementById('host-joker-toggle');
        self.includeJoker = jokerCb ? jokerCb.checked : true;
        self.socket.emit('pokerSimAction', {
          action: 'startGame',
          data: { includeJoker: self.includeJoker },
        });
        self.showHostPanel(false);
        self.showHostControls(true);
      });
    }

    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        self.socket.emit('pokerSimAction', { action: 'resetGame', data: {} });
      });
    }

    var revealBtn = document.getElementById('reveal-btn');
    if (revealBtn) {
      revealBtn.addEventListener('click', function () {
        var action = self.revealed ? 'hideCards' : 'revealCards';
        self.socket.emit('pokerSimAction', { action: action, data: {} });
      });
    }

    var jokerToggle = document.getElementById('joker-toggle-checkbox');
    if (jokerToggle) {
      jokerToggle.addEventListener('change', function () {
        self.includeJoker = this.checked;
      });
    }

    var voiceBtn = document.getElementById('voice-toggle');
    if (voiceBtn) {
      voiceBtn.addEventListener('click', function () {
        if (!self.agoraVoice) return;
        self.isMuted = !self.isMuted;
        self.agoraVoice.toggleMicrophone();
        var icon = self.isMuted ? 'microphone-off.svg' : 'microphone.svg';
        voiceBtn.innerHTML = '<img src="images/icons/' + icon + '" alt="" class="icon-sm">';
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

  GameManager.prototype.bindDragDrop = function () {
    var self = this;
    var pile = document.getElementById('card-pile');
    var ghost = document.getElementById('drag-ghost');
    var ghostImg = document.getElementById('drag-ghost-img');

    if (!pile || !ghost) return;

    pile.addEventListener('mousedown', function (e) {
      if (self.deck.length === 0) return;
      e.preventDefault();
      self.startDrag(e.clientX, e.clientY, ghost, ghostImg);
    });

    pile.addEventListener('touchstart', function (e) {
      if (self.deck.length === 0) return;
      e.preventDefault();
      var t = e.touches[0];
      self.startDrag(t.clientX, t.clientY, ghost, ghostImg);
    }, { passive: false });

    document.addEventListener('mousemove', function (e) {
      if (!self.isDragging) return;
      self.moveDrag(e.clientX, e.clientY, ghost);
    });

    document.addEventListener('touchmove', function (e) {
      if (!self.isDragging) return;
      var t = e.touches[0];
      self.moveDrag(t.clientX, t.clientY, ghost);
    }, { passive: false });

    document.addEventListener('mouseup', function (e) {
      if (!self.isDragging) return;
      self.endDrag(e.clientX, e.clientY, ghost);
    });

    document.addEventListener('touchend', function (e) {
      if (!self.isDragging) return;
      var t = e.changedTouches[0];
      self.endDrag(t.clientX, t.clientY, ghost);
    });
  };

  GameManager.prototype.startDrag = function (x, y, ghost, ghostImg) {
    this.isDragging = true;
    this.dragCard = this.deck[this.deck.length - 1];
    var cardSrc = this.getCardImageSrc(this.dragCard);
    ghostImg.src = cardSrc;
    ghost.style.display = 'block';
    ghost.style.left = (x - 30) + 'px';
    ghost.style.top = (y - 42) + 'px';

    var playersArea = document.getElementById('players-area');
    if (playersArea) {
      var zones = playersArea.querySelectorAll('.player-zone');
      zones.forEach(function (z) { z.classList.add('drag-target'); });
    }
  };

  GameManager.prototype.moveDrag = function (x, y, ghost) {
    ghost.style.left = (x - 30) + 'px';
    ghost.style.top = (y - 42) + 'px';

    var playersArea = document.getElementById('players-area');
    if (playersArea) {
      var zones = playersArea.querySelectorAll('.player-zone');
      zones.forEach(function (z) {
        var rect = z.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          z.classList.add('drag-over');
        } else {
          z.classList.remove('drag-over');
        }
      });
    }
  };

  GameManager.prototype.endDrag = function (x, y, ghost) {
    this.isDragging = false;
    ghost.style.display = 'none';

    var targetPlayerId = null;
    var playersArea = document.getElementById('players-area');
    if (playersArea) {
      var zones = playersArea.querySelectorAll('.player-zone');
      zones.forEach(function (z) {
        z.classList.remove('drag-over');
        z.classList.remove('drag-target');
        var rect = z.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
          targetPlayerId = z.getAttribute('data-player-id');
        }
      });
    }

    if (targetPlayerId && this.dragCard) {
      this.socket.emit('pokerSimAction', {
        action: 'dealCard',
        data: { playerId: targetPlayerId },
      });
    }

    this.dragCard = null;
  };

  GameManager.prototype.getCardImageSrc = function (card) {
    if (card.suit === 'back') {
      var backSrc = typeof ThemeManager !== 'undefined' ? ThemeManager.getCardBackSrc() : 'images/Cards/card_back2.svg';
      return backSrc;
    }
    if (card.suit === 'joker') {
      return 'images/Cards/card_joker_' + (card.rank === 'red' ? 'red' : 'black') + '.png';
    }
    return 'images/Cards/card_' + card.suit + '_' + card.rank + '.png';
  };

  GameManager.prototype.handleSimUpdate = function (data) {
    this.players = data.players || [];
    this.deck = data.deck || [];
    this.playerCards = data.playerCards || {};
    this.includeJoker = data.includeJoker !== undefined ? data.includeJoker : this.includeJoker;
    this.revealed = data.revealed || false;

    this.renderPlayers();
    this.updatePileCount();
    this.updateHostControls();
    this.updateRevealButton();

    var gameStarted = data.deck && data.deck.length > 0;
    var hasPlayerCards = Object.keys(data.playerCards || {}).some(function (pid) {
      return (data.playerCards[pid] || []).length > 0;
    });
    if (gameStarted || hasPlayerCards) {
      this.showHostControls(true);
    }
  };

  GameManager.prototype.renderPlayers = function () {
    var container = document.getElementById('players-area');
    if (!container) return;
    container.innerHTML = '';

    var self = this;
    this.players.forEach(function (player) {
      var zone = document.createElement('div');
      zone.className = 'player-zone';
      zone.setAttribute('data-player-id', player.id);

      var header = document.createElement('div');
      header.className = 'player-zone-header';

      var avatar = document.createElement('img');
      avatar.className = 'player-zone-avatar';
      avatar.src = 'images/avatars/' + (player.avatar || 'bear') + '.gif';
      avatar.alt = player.nickname;
      header.appendChild(avatar);

      var name = document.createElement('div');
      name.className = 'player-zone-name';
      name.textContent = player.nickname || '--';
      header.appendChild(name);

      zone.appendChild(header);

      var cardsDiv = document.createElement('div');
      cardsDiv.className = 'player-zone-cards';

      var cards = self.playerCards[player.id] || [];
      cards.forEach(function (card) {
        var img = document.createElement('img');
        img.className = 'sim-card';
        img.src = self.getCardImageSrc(card);
        img.alt = card.suit + ' ' + card.rank;
        img.draggable = false;
        cardsDiv.appendChild(img);
      });

      zone.appendChild(cardsDiv);
      container.appendChild(zone);
    });
  };

  GameManager.prototype.updatePileCount = function () {
    var countEl = document.getElementById('pile-count');
    if (countEl) countEl.textContent = this.deck.length;

    var pileImg = document.getElementById('pile-img');
    if (pileImg) {
      pileImg.style.opacity = this.deck.length > 0 ? '1' : '0.3';
    }
  };

  GameManager.prototype.updateHostControls = function () {
    var jokerCb = document.getElementById('joker-toggle-checkbox');
    if (jokerCb) jokerCb.checked = this.includeJoker;
  };

  GameManager.prototype.updateRevealButton = function () {
    var revealBtn = document.getElementById('reveal-btn');
    if (!revealBtn) return;
    if (this.deck.length === 0) {
      revealBtn.style.display = 'none';
      return;
    }
    revealBtn.style.display = 'inline-block';
    revealBtn.textContent = this.revealed ? '隐藏' : '公开';
  };

  GameManager.prototype.showHostPanel = function (show) {
    var panel = document.getElementById('host-panel');
    if (panel) panel.style.display = show ? 'flex' : 'none';
  };

  GameManager.prototype.showHostControls = function (show) {
    var controls = document.getElementById('host-controls');
    if (controls) controls.style.display = show ? 'flex' : 'none';
    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.style.display = (show && this.isHost) ? 'inline-block' : 'none';
  };

  GameManager.prototype.updateRoomId = function (id) {
    var el = document.getElementById('room-id');
    if (el) el.textContent = id;
  };

  GameManager.prototype.updateConnectionStatus = function (status) {
    var el = document.getElementById('connection-status');
    if (el) {
      if (status === '已连接') {
        el.innerHTML = '<img src="images/icons/hyperlink-3.svg" alt="已连接" class="icon-sm">';
      } else {
        el.innerHTML = '<img src="images/icons/hyperlink-broken.svg" alt="已断开" class="icon-sm">';
      }
    }
  };

  GameManager.prototype.showNotification = function (text, duration) {
    var self = this;
    var el = document.getElementById('notification');
    var textEl = document.getElementById('notification-text');
    if (el && textEl) {
      el.style.display = 'block';
      textEl.textContent = text;
    }
    if (this.notificationTimeout) clearTimeout(this.notificationTimeout);
    this.notificationTimeout = setTimeout(function () {
      if (el) el.style.display = 'none';
    }, duration || 3000);
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

  return GameManager;
})();

document.addEventListener('DOMContentLoaded', function () {
  var gameManager = new PokerSimGameManager();
  gameManager.init();
});
