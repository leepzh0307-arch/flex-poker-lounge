var BasePokerUI = {};

BasePokerUI.createCardElement = function(card) {
  var cardElement = document.createElement('div');
  cardElement.className = 'poker-card';

  if (card.hidden) {
    cardElement.classList.add('back');
    var backImg = document.createElement('img');
    backImg.src = typeof ThemeManager !== 'undefined' ? ThemeManager.getCardBackSrc() : 'images/Cards/card_back2.svg';
    backImg.alt = 'card back';
    backImg.className = 'card-face-img';
    cardElement.appendChild(backImg);
    return cardElement;
  }

  var rank = card.value.length === 1 && !isNaN(card.value) ? '0' + card.value : card.value;
  var imgSrc = 'images/Cards/card_' + card.suit + '_' + rank + '.png';

  var img = document.createElement('img');
  img.src = imgSrc;
  img.alt = card.value + ' of ' + card.suit;
  img.className = 'card-face-img';
  cardElement.appendChild(img);

  return cardElement;
};

BasePokerUI.getSuitSymbol = function(suit) {
  var map = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  return map[suit] || '';
};

BasePokerUI._animateChipToSeat = function(seatEl, betEl, amount, initialChips) {
  var tableArea = document.querySelector('.players-area');
  if (!tableArea) return;

  var tableRect = tableArea.getBoundingClientRect();
  var seatRect = seatEl.getBoundingClientRect();
  var betRect = betEl.getBoundingClientRect();

  var fromX = seatRect.left + seatRect.width / 2 - tableRect.left;
  var fromY = seatRect.top + seatRect.height / 2 - tableRect.top;
  var toX = betRect.left + betRect.width / 2 - tableRect.left;
  var toY = betRect.top + betRect.height / 2 - tableRect.top;

  var flyEl = document.createElement('div');
  flyEl.className = 'chip-fly-to-bet';
  flyEl.style.setProperty('--chip-from-x', fromX + 'px');
  flyEl.style.setProperty('--chip-from-y', fromY + 'px');
  flyEl.style.setProperty('--chip-to-x', toX + 'px');
  flyEl.style.setProperty('--chip-to-y', toY + 'px');

  var chipEl = ChipDisplay.createChipElement(amount, initialChips);
  chipEl.classList.add('chip-display--small');
  flyEl.appendChild(chipEl);

  tableArea.appendChild(flyEl);

  setTimeout(function() { flyEl.remove(); }, 600);
};

BasePokerUI._setDealFromPile = function(cardElement) {
  var pileEl = this.elements.cardPile;
  if (!pileEl) return;
  var tableArea = document.querySelector('.players-area');
  if (!tableArea) return;
  var tableRect = tableArea.getBoundingClientRect();
  var pileRect = pileEl.getBoundingClientRect();
  var pileCenterX = pileRect.left + pileRect.width / 2 - tableRect.left;
  var pileCenterY = pileRect.top + pileRect.height / 2 - tableRect.top;
  requestAnimationFrame(function() {
    var cardRect = cardElement.getBoundingClientRect();
    var cardCenterX = cardRect.left + cardRect.width / 2 - tableRect.left;
    var cardCenterY = cardRect.top + cardRect.height / 2 - tableRect.top;
    var dx = pileCenterX - cardCenterX;
    var dy = pileCenterY - cardCenterY;
    cardElement.style.setProperty('--deal-from-x', dx + 'px');
    cardElement.style.setProperty('--deal-from-y', dy + 'px');
  });
};

BasePokerUI._getInitialChips = function() {
  if (this.currentGameState) {
    var myPlayer = this.currentGameState.players && this.currentGameState.players.find(function(p) { return p.id === this.myPlayerId; }.bind(this));
    if (myPlayer && this.currentGameState.initialChips) {
      return this.currentGameState.initialChips;
    }
    if (this.currentGameState.initialChips) {
      return this.currentGameState.initialChips;
    }
  }
  return 1000;
};

BasePokerUI.addChipsHistoryEntry = function(amount, isWin) {
  var historyList = document.getElementById('chips-history-list');
  if (!historyList) return;

  this.handCount++;
  this.totalProfit += isWin ? amount : -amount;

  var entry = document.createElement('div');
  var isEven = amount === 0;
  entry.className = 'history-entry ' + (isEven ? 'even' : (isWin ? 'win' : 'lose'));

  var isEnglish = this.currentLanguage === 'en';
  var sign = isEven ? '' : (isWin ? '+' : '-');
  var amountText = isEven ? '0' : sign + amount;
  var profitSign = this.totalProfit >= 0 ? '+' : '';
  entry.textContent = isEnglish ?
    '#' + this.handCount + ' ' + amountText + '  (Total: ' + profitSign + this.totalProfit + ')' :
    '#' + this.handCount + ' ' + amountText + '  (累计: ' + profitSign + this.totalProfit + ')';

  if (isEnglish) { entry.classList.add('english-text'); }

  historyList.appendChild(entry);
  historyList.scrollTop = historyList.scrollHeight;

  while (historyList.children.length > 20) {
    historyList.removeChild(historyList.firstChild);
  }
};

BasePokerUI.updatePot = function(amount) {
  this.currentPot = amount || 0;
  if (this.elements.potAmount) {
    this.elements.potAmount.classList.add('pot-amount-vibrate');
    setTimeout(function() { this.elements.potAmount.classList.remove('pot-amount-vibrate'); }.bind(this), 500);
    this.elements.potAmount.textContent = amount;
  }
};

BasePokerUI.updateCallAmount = function(amount) {
  var span = document.getElementById('call-amount');
  if (span) {
    span.textContent = amount > 0 ? amount : '';
  } else {
    var btn = document.getElementById('call-btn');
    if (btn) {
      var t = (this.translations && this.translations[this.currentLanguage]) || (this.translations && this.translations['zh']) || {};
      var label = t['call-btn'] || '跟注';
      btn.innerHTML = label + ' <span id="call-amount">' + (amount > 0 ? amount : '') + '</span>';
      this.elements.callAmount = document.getElementById('call-amount');
    }
  }
};

BasePokerUI.updatePhaseIndicator = function(phase) {
  var phaseLabelEl = document.getElementById('phase-current-label');
  if (!phaseLabelEl) return;

  var phaseNames = {
    'WAITING': '等待中',
    'PRE_FLOP_BLINDS': '盲注阶段',
    'PRE_FLOP_BETTING': '翻前下注',
    'FLOP_DEAL': '翻牌',
    'FLOP_BETTING': '翻牌下注',
    'TURN_DEAL': '转牌',
    'TURN_BETTING': '转牌下注',
    'RIVER_DEAL': '河牌',
    'RIVER_BETTING': '河牌下注',
    'SHOWDOWN': '摊牌',
    'HAND_END': '本局结束',
  };

  var label = phaseNames[phase] || phase;
  phaseLabelEl.textContent = label;

  if (phase === 'FLOP_DEAL' || phase === 'TURN_DEAL' || phase === 'RIVER_DEAL' || phase === 'SHOWDOWN' || phase === 'HAND_END') {
    this.triggerBetGatherAnimation();
  }

  if (window.pokerSoundManager) {
    if (phase === 'PRE_FLOP_BLINDS' && this._prevPhase === 'WAITING') { pokerSoundManager.blindsSet(); }
    else if (phase === 'FLOP_BETTING' && this._prevPhase !== 'FLOP_BETTING') { pokerSoundManager.flopCards(); }
    else if (phase === 'TURN_BETTING' && this._prevPhase !== 'TURN_BETTING') { pokerSoundManager.turnRiver(); }
    else if (phase === 'RIVER_BETTING' && this._prevPhase !== 'RIVER_BETTING') { pokerSoundManager.turnRiver(); }
    else if (phase === 'SHOWDOWN' && this._prevPhase !== 'SHOWDOWN') { pokerSoundManager.showDown(); }
  }

  this._prevPhase = phase;
};

BasePokerUI.triggerBetGatherAnimation = function() {
  this.elements.playerBets.forEach(function(betEl) {
    if (betEl && betEl.style.display === 'flex') {
      betEl.classList.remove('animate', 'fade-out');
      betEl.classList.add('gather');
      setTimeout(function() { betEl.style.display = 'none'; betEl.classList.remove('gather'); }, 1000);
    }
  });
};

BasePokerUI.updateBlindInfo = function(sb, bb) {
  if (this.elements.blindInfo) {
    this.elements.blindInfo.textContent = 'SB: ' + sb + ' / BB: ' + bb;
  }
};

BasePokerUI.showNextHandButton = function(show) {
  if (this.elements.nextHandBtn) { this.elements.nextHandBtn.style.display = show ? 'inline-block' : 'none'; }
  if (this.elements.startGameBtn) { this.elements.startGameBtn.style.display = 'none'; }
  var settleBtn = document.getElementById('settle-game-btn');
  if (settleBtn) settleBtn.style.display = show ? 'inline-block' : 'none';
  var hostBtnWrapper = document.getElementById('host-btn-wrapper');
  if (hostBtnWrapper) hostBtnWrapper.style.display = show ? 'block' : 'none';
};

BasePokerUI.showStartGameButton = function(show) {
  if (this.elements.startGameBtn) { this.elements.startGameBtn.style.display = show ? 'inline-block' : 'none'; }
  if (this.elements.nextHandBtn) { this.elements.nextHandBtn.style.display = 'none'; }
  var settleBtn = document.getElementById('settle-game-btn');
  if (settleBtn) settleBtn.style.display = show ? 'inline-block' : 'none';
};

BasePokerUI.hideHostButtons = function() {
  if (this.elements.startGameBtn) { this.elements.startGameBtn.style.display = 'none'; }
  if (this.elements.nextHandBtn) { this.elements.nextHandBtn.style.display = 'none'; }
};

BasePokerUI.showSettleModal = function(scoreboard) {
  var modal = document.getElementById('settle-modal');
  var tbody = document.getElementById('settle-table-body');
  if (!modal || !tbody) return;
  tbody.innerHTML = '';
  scoreboard.forEach(function(row) {
    var tr = document.createElement('tr');
    var profitClass = row.profit > 0 ? 'profit-positive' : row.profit < 0 ? 'profit-negative' : 'profit-zero';
    var profitText = row.profit > 0 ? '+' + row.profit : row.profit === 0 ? '0' : '' + row.profit;
    tr.innerHTML = '<td>' + row.nickname + (row.isAI ? ' 🤖' : '') + '</td>' +
      '<td>' + row.currentChips + '</td>' +
      '<td class="' + profitClass + '">' + profitText + '</td>' +
      '<td>' + row.totalOriginal + '</td>';
    tbody.appendChild(tr);
  });
  modal.style.display = 'flex';
};

BasePokerUI.showContinueGameButton = function(show) {
  var container = document.getElementById('continue-game-container');
  if (container) { container.style.display = show ? 'block' : 'none'; }
};

BasePokerUI.enableActionButtons = function(enabled, actionContext) {
  actionContext = actionContext || {};
  var isBettingPhase = enabled;
  var canCheck = actionContext.canCheck === true;
  var canCall = actionContext.canCall === true;

  if (isBettingPhase && window.pokerSoundManager) { pokerSoundManager.yourTurn(); }

  if (this.elements.foldBtn) { this.elements.foldBtn.disabled = !isBettingPhase; }
  if (this.elements.checkBtn) { this.elements.checkBtn.disabled = !isBettingPhase || !canCheck; }
  if (this.elements.callBtn) { this.elements.callBtn.disabled = !isBettingPhase || !canCall; }
  if (this.elements.raiseBtn) { this.elements.raiseBtn.disabled = !isBettingPhase; }
  if (this.elements.allInBtn) { this.elements.allInBtn.disabled = !isBettingPhase; }

  if (actionContext.callAmount !== undefined) { this.updateCallAmount(actionContext.callAmount); }
};

BasePokerUI.getBetAmount = function() { return parseInt(this.elements.betAmount.value) || 0; };
BasePokerUI.setBetAmount = function(amount) { this.elements.betAmount.value = amount; };
BasePokerUI.setMyPlayerId = function(playerId) { this.myPlayerId = playerId; };

BasePokerUI.repositionSeats = function() {
  var area = document.querySelector('.players-area');
  if (!area) return;

  var activeSeats = [];
  var selfSeatIdx = -1;

  for (var i = 0; i < 10; i++) {
    var seat = this.elements.playerSeats[i];
    if (seat && seat._playerData) {
      activeSeats.push(i);
      if (this.myPlayerId && seat._playerData.id === this.myPlayerId) { selfSeatIdx = i; }
    }
  }

  if (selfSeatIdx === -1 && activeSeats.length > 0) { selfSeatIdx = activeSeats[0]; }

  if (activeSeats.length === 0) {
    for (var j = 0; j < 10; j++) {
      var s = this.elements.playerSeats[j];
      if (s) { s.style.left = ''; s.style.top = ''; s.style.transform = ''; s.classList.remove('pos-bottom', 'pos-top', 'pos-left', 'pos-right'); }
    }
    return;
  }

  var sortedSeats = activeSeats.slice().sort(function(a, b) { return a - b; });
  var selfPosInList = sortedSeats.indexOf(selfSeatIdx);
  var numPlayers = sortedSeats.length;

  var startAngle = 180;
  var angleStep = 360 / numPlayers;

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var isMobile = vw < 768;
  var isSmallMobile = vw < 480;

  var rx, ry, betDist;
  if (isSmallMobile) { rx = 28; ry = 32; betDist = 16; }
  else if (isMobile) { rx = 33; ry = 37; betDist = 18; }
  else { rx = 38; ry = 42; betDist = 20; }
  var cx = 50;
  var cy = 50;

  sortedSeats.forEach(function(seatIdx, listIdx) {
    var relativePos = (listIdx - selfPosInList + numPlayers) % numPlayers;
    var angle = startAngle + relativePos * angleStep;
    var rad = angle * Math.PI / 180;

    var x = cx + rx * Math.sin(rad);
    var y = cy - ry * Math.cos(rad);

    var normalizedAngle = ((angle % 360) + 360) % 360;

    var seatEl = this.elements.playerSeats[seatIdx];
    if (seatEl) {
      seatEl.style.left = x + '%';
      seatEl.style.top = y + '%';

      seatEl.classList.remove('pos-bottom', 'pos-top', 'pos-left', 'pos-right');
      if (normalizedAngle >= 135 && normalizedAngle <= 225) { seatEl.classList.add('pos-bottom'); }
      else if (normalizedAngle > 225 && normalizedAngle < 315) { seatEl.classList.add('pos-left'); }
      else if (normalizedAngle >= 315 || normalizedAngle <= 45) { seatEl.classList.add('pos-top'); }
      else { seatEl.classList.add('pos-right'); }

      seatEl.style.transform = 'translate(-50%, -50%)';
      seatEl.style.opacity = '';
    }

    var betEl = this.elements.playerBets[seatIdx];
    if (betEl) {
      var bx = cx + (rx - betDist) * Math.sin(rad);
      var by = cy - (ry - betDist) * Math.cos(rad);
      betEl.style.left = bx + '%';
      betEl.style.top = by + '%';
    }
  }.bind(this));
};

BasePokerUI.showThemePopup = function() {
  var self = this;
  ThemePopup.show(function(type, id) {
    if (type === 'table') { self.applyTableTheme(id); }
    else if (type === 'cardBack') { self.applyCardBackTheme(); }
    else if (type === 'chip') { self.refreshChipDisplays(); }
  });
};

BasePokerUI.refreshChipDisplays = function() {
  var self = this;
  this.elements.playerBets.forEach(function(betEl) {
    if (betEl && betEl.style.display === 'flex') {
      var chipDisplay = betEl.querySelector('.chip-display');
      if (chipDisplay) {
        var label = chipDisplay.querySelector('.chip-amount');
        var amount = label ? parseInt(label.textContent) || 0 : 0;
        if (amount > 0) {
          var initialChips = self._getInitialChips();
          betEl.innerHTML = '';
          var chipEl = ChipDisplay.createChipElement(amount, initialChips);
          chipEl.classList.add('chip-display--small');
          betEl.appendChild(chipEl);
        }
      }
    }
  });
};

BasePokerUI.toggleLanguage = function() {
  this.currentLanguage = this.currentLanguage === 'zh' ? 'en' : 'zh';
  this.updateLanguage();
};

try { module.exports = BasePokerUI; } catch(e) { window.BasePokerUI = BasePokerUI; }
