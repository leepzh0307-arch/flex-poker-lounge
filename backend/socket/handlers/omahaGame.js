const { PokerEngine } = require('../../utils/pokerEngine');
const { omahaPokerShowdown } = require('../../utils/omahaEvaluator');
const { makeDecision, getThinkTime, pickAiName, clearRoomPersonality } = require('../../utils/aiEngine');

function calculatePotLimitRaise(potTotal, currentBet, playerRoundBet) {
  var callAmount = currentBet - playerRoundBet;
  var maxRaise = currentBet + callAmount + potTotal;
  return { maxRaise: maxRaise, callAmount: callAmount, potTotal: potTotal };
}

var engine = new PokerEngine({
  numCards: 4,
  logPrefix: '[奥马哈]',
  eventName: 'omahaUpdate',
  actionEventName: 'omahaAction',
  showdownFn: omahaPokerShowdown,
  validateRaiseFn: function(room, player, raiseTotal, raiseIncrement) {
    var currentRoundBet = room.gameState.roundBets[player.id] || 0;
    var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
    var potLimitInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, currentRoundBet);

    if (room.gameState.currentBet === 0) {
      var minBet = room.bigBlindAmount;
      if (raiseTotal < minBet && player.chips > raiseTotal) {
        return { action: 'check' };
      }
    }

    if (raiseTotal <= room.gameState.currentBet) {
      return { action: 'call' };
    }

    if (raiseTotal > potLimitInfo.maxRaise && player.chips > raiseIncrement) {
      raiseTotal = potLimitInfo.maxRaise;
      console.log('[奥马哈] 底池限注：加注上限调整为 ' + raiseTotal);
      return { adjustedTotal: raiseTotal };
    }

    if (raiseIncrement <= 0) {
      return { action: 'call' };
    }

    if (raiseIncrement < room.gameState.minRaise && player.chips > raiseIncrement) {
      return { action: 'call' };
    }

    return {};
  },
  buildAiStateExtraFn: function() {
    return { isOmaha: true };
  },
});

engine.sendUpdate = function(room, roomId, io, additionalMessage) {
  var activePlayers = room.players.filter(function(p) { return p.isActive; });
  var isShowdownOrAfter = ['SHOWDOWN', 'HAND_END', 'CONFIRM_CONTINUE'].indexOf(room.gameState.phase) !== -1;
  var showdownPlayerIds = room.gameState.showdownPlayerIds || [];

  room.players.forEach(function(player) {
    if (player.isAI) return;
    var playersWithCards = room.players.map(function(p) {
      var playerCopy = Object.assign({}, p);
      delete playerCopy.cards;
      var isActive = p.isActive;
      var isSelf = p.id === player.id;
      if (isSelf) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (isShowdownOrAfter && showdownPlayerIds.indexOf(p.id) !== -1) {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else if (isActive && room.gameState.phase === 'SHOWDOWN') {
        playerCopy.cards = room.gameState.playerCards[p.id] || [];
      } else {
        playerCopy.cards = [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      }
      return playerCopy;
    });

    var potLimitInfo = null;
    if (['PRE_FLOP_BETTING', 'FLOP_BETTING', 'TURN_BETTING', 'RIVER_BETTING'].indexOf(room.gameState.phase) !== -1) {
      var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
      var myRoundBet = room.gameState.roundBets[player.id] || 0;
      potLimitInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, myRoundBet);
    }

    io.to(player.id).emit('omahaUpdate', {
      roomId: roomId,
      players: playersWithCards,
      communityCards: room.gameState.communityCards,
      pots: room.gameState.pots,
      currentBet: room.gameState.currentBet,
      gamePhase: room.gameState.phase,
      currentPlayer: room.gameState.currentPlayer,
      dealerButton: room.dealerButton,
      smallBlindAmount: room.smallBlindAmount || 10,
      bigBlindAmount: room.bigBlindAmount || 20,
      initialChips: (room.config && room.config.initialChips) || 1000,
      roundBets: Object.assign({}, room.gameState.roundBets),
      handBets: Object.assign({}, room.gameState.handBets),
      potLimitRaise: potLimitInfo,
      message: additionalMessage,
    });
  });
};

engine.broadcastAction = function(rooms, io, roomId, actionType, playerId, amount) {
  var room = rooms.get(roomId);
  if (!room) return;
  var player = room.players.find(function(p) { return p.id === playerId; });
  if (!player) return;
  room.players.forEach(function(p) {
    if (p.isAI) return;
    io.to(p.id).emit('omahaAction', {
      type: actionType, playerId: playerId, nickname: player.nickname,
      amount: amount || null, timestamp: Date.now(),
    });
  });
};

engine.scheduleAiAction = (function() {
  var originalScheduleAiAction = PokerEngine.prototype.scheduleAiAction;
  return function(room, roomId, io, aiPlayer, rooms) {
    var thinkTime = getThinkTime(aiPlayer.aiDifficulty || 'medium', aiPlayer.personality);
    var self = this;
    var timerId = setTimeout(function() {
      var idx = room._aiTimerIds ? room._aiTimerIds.indexOf(timerId) : -1;
      if (idx !== -1) room._aiTimerIds.splice(idx, 1);
      try {
        if (!room || room.gameState.currentPlayer !== aiPlayer.id) return;
        if (!aiPlayer.isActive || aiPlayer.chips === 0) {
          if (aiPlayer.isActive && aiPlayer.chips === 0) { self.moveToNextPlayer(room, roomId, io, rooms); }
          return;
        }

        var gameState = self.buildAiGameState(room, aiPlayer);
        var decision = makeDecision(aiPlayer.aiDifficulty || 'medium', gameState, aiPlayer.id);

        switch (decision.action) {
          case 'fold': self.handleFold(room, roomId, io, aiPlayer.id, rooms); break;
          case 'check': self.handleCheck(room, roomId, io, aiPlayer.id, rooms); break;
          case 'call': self.handleCall(room, roomId, io, aiPlayer.id, rooms); break;
          case 'raise':
            var potTotal = room.gameState.pots.reduce(function(s, pot) { return s + pot.amount; }, 0);
            var potInfo = calculatePotLimitRaise(potTotal, room.gameState.currentBet, room.gameState.roundBets[aiPlayer.id] || 0);
            var raiseAmount = decision.amount || potInfo.maxRaise;
            raiseAmount = Math.min(raiseAmount, potInfo.maxRaise);
            raiseAmount = Math.max(raiseAmount, room.gameState.currentBet + room.gameState.minRaise);
            self.handleRaise(room, roomId, io, aiPlayer.id, raiseAmount, rooms);
            break;
          case 'all-in': self.handleAllIn(room, roomId, io, aiPlayer.id, rooms); break;
          default: self.handleFold(room, roomId, io, aiPlayer.id, rooms);
        }
      } catch (error) {
        console.error('[奥马哈AI] ' + aiPlayer.nickname + ' 行动异常:', error);
        if (aiPlayer.isActive && room.gameState.currentPlayer === aiPlayer.id) {
          self.handleFold(room, roomId, io, aiPlayer.id, rooms);
        }
      }
    }, thinkTime);
    require('../../utils/pokerEngine').trackAiTimer(room, timerId);

    var safetyTimerId = setTimeout(function() {
      var sIdx = room._aiTimerIds ? room._aiTimerIds.indexOf(safetyTimerId) : -1;
      if (sIdx !== -1) room._aiTimerIds.splice(sIdx, 1);
      if (room && room.gameState.currentPlayer === aiPlayer.id && aiPlayer.isActive) {
        console.warn('[奥马哈AI] 安全超时：强制 ' + aiPlayer.nickname + ' 弃牌');
        self.handleFold(room, roomId, io, aiPlayer.id, rooms);
      }
    }, Math.max(thinkTime + 5000, 10000));
    require('../../utils/pokerEngine').trackAiTimer(room, safetyTimerId);
  };
})();

module.exports = function(socket, rooms, io) {
  socket.on('omahaAction', function(data) {
    try {
      var action = data.action;
      var actionData = data.data;
      if (!action) return;

      var room = null;
      var roomId = null;

      for (var entry of rooms.entries()) {
        var id = entry[0];
        var r = entry[1];
        if (r.gameType === 'omaha' && r.players.some(function(p) { return p.id === socket.id; })) {
          room = r;
          roomId = id;
          break;
        }
      }

      if (!room) return;

      var player = room.players.find(function(p) { return p.id === socket.id; });
      if (!player) return;

      if (!player.isActive && action !== 'resetGame') return;

      switch (action) {
        case 'startGame': engine.startGame(room, roomId, io, actionData, rooms); break;
        case 'nextHand': engine.nextHand(room, roomId, io, rooms); break;
        case 'resetGame': engine.resetGame(room, roomId, io); break;
        case 'setPlayerChips': engine.handleSetPlayerChips(room, roomId, io, socket.id, actionData); break;
        case 'addPlayerChips': engine.handleAddPlayerChips(room, roomId, io, socket.id, actionData); break;
        case 'settleGame': engine.handleSettleGame(room, roomId, io, socket.id); break;
        case 'fold': engine.handleFold(room, roomId, io, socket.id, rooms); break;
        case 'check': engine.handleCheck(room, roomId, io, socket.id, rooms); break;
        case 'call': engine.handleCall(room, roomId, io, socket.id, rooms); break;
        case 'raise': engine.handleRaise(room, roomId, io, socket.id, actionData && actionData.amount, rooms); break;
        case 'all-in': engine.handleAllIn(room, roomId, io, socket.id, rooms); break;
        case 'confirmContinue': engine.handleConfirmContinue(room, roomId, io, socket.id, rooms); break;
      }
    } catch (error) {
      console.error('[奥马哈] 游戏操作错误:', error);
    }
  });
};

module.exports.engine = engine;
module.exports.calculatePotLimitRaise = calculatePotLimitRaise;
