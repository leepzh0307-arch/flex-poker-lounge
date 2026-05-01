const { PokerEngine } = require('../../utils/pokerEngine');
const { showdown: pokerShowdown } = require('../../utils/handEvaluator');
const { makeDecision, getThinkTime, pickAiName, clearRoomPersonality } = require('../../utils/aiEngine');
const StandUpGame = require('../../utils/standupGame');

var engine = new PokerEngine({
  numCards: 2,
  logPrefix: '[德州]',
  eventName: 'gameUpdate',
  actionEventName: 'gameAction',
  showdownFn: pokerShowdown,
  validateRaiseFn: null,
  onHandEndFn: function(room, winnerIds) {
    var suResult = StandUpGame.onHandEnd(room, winnerIds);
    if (suResult) {
      room.players.forEach(function(p) {
        if (!p.isAI) room._io.to(p.id).emit('gameAction', {
          type: 'standupGame', result: suResult, timestamp: Date.now(),
        });
      });
    }
  },
  onEliminationFn: function(room, playerId) {
    var elimResult = StandUpGame.onAllInElimination(room, playerId);
    if (elimResult) {
      room.players.forEach(function(p) {
        if (!p.isAI) room._io.to(p.id).emit('gameAction', {
          type: 'standupGame', result: elimResult, timestamp: Date.now(),
        });
      });
    }
  },
  onResetFn: function(room) {
    StandUpGame._destroy(room);
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
        playerCopy.cards = [{ hidden: true }, { hidden: true }];
      }
      return playerCopy;
    });
    io.to(player.id).emit('gameUpdate', {
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
      standupGame: StandUpGame.getStatusForFrontend(room),
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
    io.to(p.id).emit('gameAction', {
      type: actionType, playerId: playerId, nickname: player.nickname,
      amount: amount || null, timestamp: Date.now(),
    });
  });
};

module.exports = function(socket, rooms, io) {
  socket.on('gameAction', function(data) {
    try {
      var action = data.action;
      var actionData = data.data;
      console.log('[后端] 收到游戏操作: ' + action, actionData, '玩家: ' + socket.id);
      if (!action) {
        console.error('[游戏] 缺少action参数');
        return;
      }

      var room = null;
      var roomId = null;

      for (var entry of rooms.entries()) {
        var id = entry[0];
        var r = entry[1];
        if (r.players.some(function(p) { return p.id === socket.id; })) {
          room = r;
          roomId = id;
          break;
        }
      }

      if (!room) {
        console.error('[游戏] 玩家不在任何房间中:', socket.id);
        return;
      }

      var player = room.players.find(function(p) { return p.id === socket.id; });
      if (!player) {
        console.error('[游戏] 玩家不存在于房间中:', socket.id, roomId);
        return;
      }

      if (!player.isActive && action !== 'resetGame') {
        console.warn('[游戏] 玩家 ' + player.nickname + ' 已弃牌，无法执行操作');
        return;
      }

      room._io = io;

      switch (action) {
        case 'startGame':
          if (actionData && actionData.enable_standup_game) {
            if (!room.standupGame || room.standupGame.is_round_finished) {
              room.standupGame = StandUpGame.create(room, actionData);
            }
          }
          engine.startGame(room, roomId, io, actionData, rooms);
          break;
        case 'nextHand':
          engine.nextHand(room, roomId, io, rooms);
          break;
        case 'resetGame':
          engine.resetGame(room, roomId, io);
          break;
        case 'setPlayerChips':
          engine.handleSetPlayerChips(room, roomId, io, socket.id, actionData);
          break;
        case 'addPlayerChips':
          engine.handleAddPlayerChips(room, roomId, io, socket.id, actionData);
          break;
        case 'settleGame':
          engine.handleSettleGame(room, roomId, io, socket.id);
          break;
        case 'fold':
          engine.handleFold(room, roomId, io, socket.id, rooms);
          break;
        case 'check':
          engine.handleCheck(room, roomId, io, socket.id, rooms);
          break;
        case 'call':
          engine.handleCall(room, roomId, io, socket.id, rooms);
          break;
        case 'raise':
          engine.handleRaise(room, roomId, io, socket.id, actionData && actionData.amount, rooms);
          break;
        case 'all-in':
          engine.handleAllIn(room, roomId, io, socket.id, rooms);
          break;
        case 'confirmContinue':
          engine.handleConfirmContinue(room, roomId, io, socket.id, rooms);
          break;
        default:
          console.warn('[游戏] 未知操作: ' + action);
      }
    } catch (error) {
      console.error('[游戏] 游戏操作错误:', error);
      io.to(socket.id).emit('error', {
        message: '操作执行失败',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  });
};
