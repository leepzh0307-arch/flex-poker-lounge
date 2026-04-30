var PokerSimGameManager = (function () {
  function GameManager() {
    this.socket = null;
    this.roomId = null;
    this.playerId = null;
    this.isHost = false;
    this.players = [];
    this.deck = [];
    this.playerCards = {};
    this.communityCards = [];
    this.revealedPlayers = {};
    this.revealedCards = {};
    this.includeJoker = true;
    this.revealed = false;
    this.isDragging = false;
    this.dragCard = null;
    this.selectedCardIndices = [];
    this.agoraVoice = null;
    this.isMuted = false;
    this.notificationTimeout = null;
  }

  GameManager.prototype.init = function () {
    var self = this;
    var params = new URLSearchParams(window.location.search);
    var nickname = params.get('nickname') || 'Player';
    var avatar = params.get('avatar') || 'bear';
    var isCreating = params.get('isCreating') === 'true';
    var roomId = params.get('roomId');

    if (!window.socketClient) {
      this.updateConnectionStatus('连接失败');
      this.showNotification('Socket客户端未加载，请刷新页面', 'error');
      return;
    }

    this.socket = window.socketClient;

    this.socket.on('roomCreated', function (data) {
      self.roomId = data.roomId;
      self.isHost = true;
      self.playerId = self.socket.getSocketId();
      self.showHostPanel(true);
      self.updateRoomId(data.roomId);
      self.showNotification('房间创建成功: ' + data.roomId);
      self.initVoice();

      var url = new URL(window.location);
      url.searchParams.set('roomId', data.roomId);
      url.searchParams.delete('isCreating');
      url.searchParams.set('isHost', 'true');
      window.history.replaceState({}, '', url);
    });

    this.socket.on('roomJoined', function (data) {
      self.roomId = data.roomId;
      self.isHost = data.isHost || false;
      self.playerId = self.socket.getSocketId();
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

    this.socket.connect().then(function () {
      self.playerId = self.socket.getSocketId();
      self.updateConnectionStatus('已连接');

      if (isCreating) {
        self.isHost = true;
        self.createRoom(nickname, avatar);
      } else if (roomId) {
        self.joinRoom(roomId, nickname, avatar);
      }
    }).catch(function (err) {
      self.updateConnectionStatus('已断开');
      self.showNotification('连接服务器失败: ' + (err.message || err));
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
        self.showSimControls(true);
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

    var selfRevealBtn = document.getElementById('self-reveal-btn');
    if (selfRevealBtn) {
      selfRevealBtn.addEventListener('click', function () {
        if (self.selectedCardIndices.length === 0) {
          self.showNotification('请先点击手牌选中要公开的牌');
          return;
        }
        self.socket.emit('pokerSimAction', {
          action: 'revealMyCards',
          data: { cardIndices: self.selectedCardIndices.slice() },
        });
        self.selectedCardIndices = [];
        self.renderSelfArea();
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
      if (self.deck.length === 0 || !self.isHost) return;
      e.preventDefault();
      self.startDrag(e.clientX, e.clientY, ghost, ghostImg);
    });

    pile.addEventListener('touchstart', function (e) {
      if (self.deck.length === 0 || !self.isHost) return;
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
    this.dragCard = { suit: 'back', rank: 'back' };
    var cardSrc = this.getCardImageSrc(this.dragCard);
    ghostImg.src = cardSrc;
    ghost.style.display = 'block';
    ghost.style.left = (x - 26) + 'px';
    ghost.style.top = (y - 36) + 'px';

    var others = document.querySelectorAll('.sim-other-player');
    others.forEach(function (s) { s.classList.add('drag-target'); });
    var comm = document.getElementById('community-cards-section');
    if (comm) comm.classList.add('drag-target');
  };

  GameManager.prototype.moveDrag = function (x, y, ghost) {
    ghost.style.left = (x - 26) + 'px';
    ghost.style.top = (y - 36) + 'px';

    var others = document.querySelectorAll('.sim-other-player');
    others.forEach(function (s) {
      var rect = s.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        s.classList.add('drag-over');
      } else {
        s.classList.remove('drag-over');
      }
    });

    var comm = document.getElementById('community-cards-section');
    if (comm) {
      var rect = comm.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        comm.classList.add('drag-over');
      } else {
        comm.classList.remove('drag-over');
      }
    }
  };

  GameManager.prototype.endDrag = function (x, y, ghost) {
    this.isDragging = false;
    ghost.style.display = 'none';

    var targetPlayerId = null;
    var targetCommunity = false;

    var others = document.querySelectorAll('.sim-other-player');
    others.forEach(function (s) {
      s.classList.remove('drag-over');
      s.classList.remove('drag-target');
      var rect = s.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        targetPlayerId = s.getAttribute('data-player-id');
      }
    });

    var comm = document.getElementById('community-cards-section');
    if (comm) {
      comm.classList.remove('drag-over');
      comm.classList.remove('drag-target');
      if (targetPlayerId) return;
      var rect = comm.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        targetCommunity = true;
      }
    }

    if (targetPlayerId && this.dragCard) {
      this.socket.emit('pokerSimAction', {
        action: 'dealCard',
        data: { playerId: targetPlayerId },
      });
    } else if (targetCommunity && this.dragCard) {
      this.socket.emit('pokerSimAction', {
        action: 'dealToCommunity',
        data: {},
      });
    }

    this.dragCard = null;
  };

  GameManager.prototype.getCardImageSrc = function (card) {
    if (!card) return '';
    if (card.suit === 'back') {
      return typeof ThemeManager !== 'undefined' ? ThemeManager.getCardBackSrc() : 'images/Cards/card_back2.svg';
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
    this.communityCards = data.communityCards || [];
    this.revealedPlayers = data.revealedPlayers || {};
    this.revealedCards = data.revealedCards || {};
    this.includeJoker = data.includeJoker !== undefined ? data.includeJoker : this.includeJoker;
    this.revealed = data.revealed || false;

    this.renderOtherPlayers();
    this.renderSelfArea();
    this.renderCommunityCards();
    this.updatePileCount();
    this.updateSimControls();
    this.updateRevealButton();
    this.updateTableInfo();
    this.updateZoneHints();

    var gameStarted = data.deck && data.deck.length > 0;
    var hasCards = Object.keys(data.playerCards || {}).some(function (pid) {
      return (data.playerCards[pid] || []).length > 0;
    });
    if (gameStarted || hasCards || (data.communityCards || []).length > 0) {
      this.showSimControls(true);
    }
  };

  GameManager.prototype.renderOtherPlayers = function () {
    var self = this;
    var container = document.getElementById('other-players');
    if (!container) return;

    var hint = document.getElementById('top-zone-hint');
    container.innerHTML = '';
    if (hint) container.appendChild(hint);

    this.players.forEach(function (player) {
      if (player.id === self.playerId) return;

      var div = document.createElement('div');
      div.className = 'sim-other-player';
      div.setAttribute('data-player-id', player.id);

      var avatar = document.createElement('img');
      avatar.className = 'sim-other-avatar';
      avatar.src = 'images/avatars/' + (player.avatar || 'bear') + '.gif';
      avatar.alt = player.nickname;
      div.appendChild(avatar);

      var name = document.createElement('div');
      name.className = 'sim-other-name';
      name.textContent = player.nickname || '--';
      div.appendChild(name);

      var cardsDiv = document.createElement('div');
      cardsDiv.className = 'sim-other-cards';

      var cards = self.playerCards[player.id] || [];
      var isRevealed = self.revealedPlayers[player.id] || false;
      var playerRevealedCards = self.revealedCards[player.id] || [];
      cards.forEach(function (card, idx) {
        var img = document.createElement('img');
        img.className = 'sim-card';
        if (isRevealed || playerRevealedCards.indexOf(idx) !== -1) {
          img.src = self.getCardImageSrc(card);
          img.classList.add('card-revealed');
        } else {
          img.src = self.getCardImageSrc({ suit: 'back', rank: 'back' });
        }
        img.alt = '';
        img.draggable = false;
        cardsDiv.appendChild(img);
      });

      div.appendChild(cardsDiv);
      container.appendChild(div);
    });
  };

  GameManager.prototype.renderSelfArea = function () {
    var self = this;

    var myInfo = this.players.find(function (p) { return p.id === self.playerId; });
    if (!myInfo) return;

    var avatarEl = document.getElementById('self-avatar');
    var nameEl = document.getElementById('self-name');
    var revealBtn = document.getElementById('self-reveal-btn');
    var cardsContainer = document.getElementById('self-cards');

    if (avatarEl) avatarEl.src = 'images/avatars/' + (myInfo.avatar || 'bear') + '.gif';
    if (nameEl) nameEl.textContent = myInfo.nickname || '--';

    var myCards = this.playerCards[this.playerId] || [];
    var myRevealedCards = this.revealedCards[this.playerId] || [];
    var isAllRevealed = this.revealedPlayers[this.playerId] || false;

    if (revealBtn) {
      revealBtn.style.display = myCards.length > 0 ? 'inline-block' : 'none';
      if (this.selectedCardIndices.length > 0) {
        revealBtn.textContent = '公开选中(' + this.selectedCardIndices.length + ')';
        revealBtn.classList.remove('revealed');
      } else {
        revealBtn.textContent = '公开选中';
        revealBtn.classList.remove('revealed');
      }
    }

    if (cardsContainer) {
      cardsContainer.innerHTML = '';

      myCards.forEach(function (card, idx) {
        var img = document.createElement('img');
        img.className = 'sim-card';

        var isThisCardRevealed = isAllRevealed || myRevealedCards.indexOf(idx) !== -1;
        if (isThisCardRevealed) {
          img.src = self.getCardImageSrc(card);
          img.classList.add('card-revealed');
        } else {
          img.src = self.getCardImageSrc({ suit: 'back', rank: 'back' });
          img.classList.add('card-back');
        }

        img.alt = '';
        img.draggable = false;
        img.dataset.cardIdx = idx;

        if (self.selectedCardIndices.indexOf(idx) !== -1) {
          img.classList.add('card-selected');
        }

        img.addEventListener('click', function () {
          var cardIdx = parseInt(this.dataset.cardIdx, 10);
          var pos = self.selectedCardIndices.indexOf(cardIdx);
          if (pos === -1) {
            self.selectedCardIndices.push(cardIdx);
          } else {
            self.selectedCardIndices.splice(pos, 1);
          }
          self.renderSelfArea();
        });

        cardsContainer.appendChild(img);
      });
    }
  };

  GameManager.prototype.renderCommunityCards = function () {
    var self = this;
    var row = document.getElementById('community-cards');
    if (!row) return;
    row.innerHTML = '';

    this.communityCards.forEach(function (card) {
      var img = document.createElement('img');
      img.className = 'community-card';
      img.src = self.getCardImageSrc(card);
      img.alt = card.suit + ' ' + card.rank;
      img.draggable = false;
      row.appendChild(img);
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

  GameManager.prototype.updateSimControls = function () {
    var jokerCb = document.getElementById('joker-toggle-checkbox');
    if (jokerCb) jokerCb.checked = this.includeJoker;

    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) resetBtn.style.display = this.isHost ? 'inline-block' : 'none';
  };

  GameManager.prototype.updateRevealButton = function () {
    var revealBtn = document.getElementById('reveal-btn');
    if (!revealBtn) return;
    if (!this.isHost) {
      revealBtn.style.display = 'none';
      return;
    }
    var hasAnyCards = Object.keys(this.playerCards).some(function (pid) {
      return (this.playerCards[pid] || []).length > 0;
    }.bind(this)) || this.communityCards.length > 0;

    if (!hasAnyCards) {
      revealBtn.style.display = 'none';
      return;
    }
    revealBtn.style.display = 'inline-block';
    revealBtn.textContent = this.revealed ? '隐藏全部' : '公开全部';
  };

  GameManager.prototype.updateTableInfo = function () {
    var label = document.getElementById('table-info-label');
    if (!label) return;
    var totalDealt = 0;
    var self = this;
    Object.keys(this.playerCards).forEach(function (pid) {
      totalDealt += (self.playerCards[pid] || []).length;
    });
    totalDealt += this.communityCards.length;
    if (totalDealt > 0) {
      label.textContent = '已发 ' + totalDealt + ' 张 / 剩余 ' + this.deck.length + ' 张';
    } else if (this.deck.length > 0) {
      label.textContent = '牌堆: ' + this.deck.length + ' 张';
    } else {
      label.textContent = '';
    }
  };

  GameManager.prototype.updateZoneHints = function () {
    var topHint = document.getElementById('top-zone-hint');
    if (topHint) {
      var hasOtherPlayers = this.players.some(function (p) { return p.id !== this.playerId; }.bind(this));
      topHint.classList.toggle('hidden', hasOtherPlayers);
    }

    var communityHint = document.getElementById('community-hint');
    if (communityHint) {
      communityHint.classList.toggle('hidden', this.communityCards.length > 0);
    }

    var selfHint = document.getElementById('self-hint');
    var selfWrapper = document.querySelector('.sim-self-cards-wrapper');
    var myCards = this.playerCards[this.playerId] || [];
    if (selfHint) {
      selfHint.classList.toggle('hidden', myCards.length > 0);
    }
    if (selfWrapper) {
      selfWrapper.classList.toggle('has-cards', myCards.length > 0);
    }
  };

  GameManager.prototype.showHostPanel = function (show) {
    var panel = document.getElementById('host-panel');
    if (panel) panel.style.display = show ? 'flex' : 'none';
  };

  GameManager.prototype.showSimControls = function (show) {
    var controls = document.getElementById('sim-controls');
    if (controls) controls.style.display = show ? 'flex' : 'none';
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
