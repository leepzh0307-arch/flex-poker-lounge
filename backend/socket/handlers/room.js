// 房间处理模块
const { generateRoomId } = require('../../utils/deck');
const { pickAiName, AI_CONFIGS, AI_PERSONALITIES } = require('../../utils/aiEngine');

// 生成唯一玩家ID
function generatePlayerId() {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function generateAiPlayerId() {
  return 'ai_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 存储socket ID到玩家ID的映射（模块级别，所有连接共享）
const socketToPlayerMap = new Map();

function buildGameUpdateForPlayer(room, playerId) {
  const gs = room.gameState;
  const isShowdownOrAfter = ['SHOWDOWN', 'HAND_END', 'CONFIRM_CONTINUE'].includes(gs.phase);
  const showdownPlayerIds = gs.showdownPlayerIds || [];

  return {
    roomId: room.id,
    players: room.players.map(p => {
      const { cards, ...playerCopy } = { ...p };
      const isSelf = p.id === playerId;
      if (isSelf) {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }];
      } else if (isShowdownOrAfter && showdownPlayerIds.includes(p.id)) {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }];
      } else if (p.isActive && gs.phase === 'SHOWDOWN') {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }];
      } else {
        playerCopy.cards = [{ hidden: true }, { hidden: true }];
      }
      return playerCopy;
    }),
    communityCards: gs.communityCards || [],
    pots: gs.pots || [{ amount: 0, eligiblePlayers: [] }],
    currentBet: gs.currentBet || 0,
    minBet: gs.minBet || 0,
    maxBet: gs.maxBet || 0,
    gamePhase: gs.phase || 'WAITING',
    currentPlayer: gs.currentPlayer,
    dealerButton: room.dealerButton,
    smallBlindAmount: room.smallBlindAmount || 10,
    bigBlindAmount: room.bigBlindAmount || 20,
    roundBets: gs.roundBets ? { ...gs.roundBets } : {},
    handBets: gs.handBets ? { ...gs.handBets } : {},
  };
}

function broadcastGameUpdate(room, io, message) {
  room.players.forEach(playerInRoom => {
    if (playerInRoom.isAI) return;
    const update = buildGameUpdateForPlayer(room, playerInRoom.id);
    if (message) update.message = message;
    io.to(playerInRoom.id).emit('gameUpdate', update);
  });
}

function buildOmahaGameUpdateForPlayer(room, playerId) {
  var gs = room.gameState;
  var isShowdownOrAfter = ['SHOWDOWN', 'HAND_END', 'CONFIRM_CONTINUE'].includes(gs.phase);
  var showdownPlayerIds = gs.showdownPlayerIds || [];

  return {
    roomId: room.id,
    players: room.players.map(function(p) {
      var playerCopy = Object.assign({}, p);
      delete playerCopy.cards;
      playerCopy.cards = undefined;
      var isSelf = p.id === playerId;
      if (isSelf) {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      } else if (isShowdownOrAfter && showdownPlayerIds.includes(p.id)) {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      } else if (p.isActive && gs.phase === 'SHOWDOWN') {
        playerCopy.cards = gs.playerCards && gs.playerCards[p.id] ? gs.playerCards[p.id] : [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      } else {
        playerCopy.cards = [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
      }
      return playerCopy;
    }),
    communityCards: gs.communityCards || [],
    pots: gs.pots || [{ amount: 0, eligiblePlayers: [] }],
    currentBet: gs.currentBet || 0,
    gamePhase: gs.phase || 'WAITING',
    currentPlayer: gs.currentPlayer,
    dealerButton: room.dealerButton,
    smallBlindAmount: room.smallBlindAmount || 10,
    bigBlindAmount: room.bigBlindAmount || 20,
    roundBets: gs.roundBets ? Object.assign({}, gs.roundBets) : {},
    handBets: gs.handBets ? Object.assign({}, gs.handBets) : {},
  };
}

function broadcastOmahaGameUpdate(room, io, message) {
  room.players.forEach(function(p) {
    if (p.isOnline) {
      var update = buildOmahaGameUpdateForPlayer(room, p.id);
      if (message) update.message = message;
      io.to(p.id).emit('omahaUpdate', update);
    }
  });
}

module.exports = (socket, rooms, io) => {
  
  // 创建房间
  socket.on('createRoom', ({ nickname, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      
      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: 1000,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          }
        ],
        gameState: {
          phase: 'WAITING',
          communityCards: [],
          pots: [{ amount: 0, eligiblePlayers: [] }],
          currentBet: 0,
          minBet: 0,
          maxBet: 0,
          currentPlayer: null,
        },
        config: {
          dealOrder: 'clockwise',
          playerCards: 2,
          communityCards: 5,
        },
        createdAt: Date.now()
      };
      
      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);
      
      callback({ success: true, roomId: roomId, playerId: playerId });
      
      setTimeout(() => {
        console.log(`房间 ${roomId} 创建成功，房主: ${nickname} (PlayerID: ${playerId})`);
        const update = buildGameUpdateForPlayer(room, socket.id);
        update.message = `房间 ${roomId} 创建成功，您是房主`;
        io.to(socket.id).emit('gameUpdate', update);
      }, 0);
      
    } catch (error) {
      console.error('创建房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  // 创建人机对战房间
  socket.on('createAiRoom', ({ nickname, aiCount, aiDifficulty, initialChips, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      const chips = initialChips || 1000;
      const difficulty = aiDifficulty || 'medium';
      const count = Math.min(Math.max(aiCount || 3, 1), 9);

      const existingNames = [nickname];
      const aiPlayers = [];
      const allPersonalities = Object.keys(AI_PERSONALITIES);
      const aiAvatars = ['kitty', 'bones', 'bear', 'knight', 'zombie', 'piggy', 'ghost', 'burger', 'bread'];
      for (let i = 0; i < count; i++) {
        const aiName = `BOT${i + 1}`;
        existingNames.push(aiName);
        const aiId = generateAiPlayerId();
        const personality = allPersonalities[i % allPersonalities.length];
        aiPlayers.push({
          id: aiId,
          playerId: aiId,
          nickname: aiName,
          avatar: aiAvatars[i % aiAvatars.length],
          personality: personality,
          chips: chips,
          seat: i + 2,
          isActive: true,
          isTurn: false,
          isOnline: true,
          isAI: true,
          aiDifficulty: difficulty,
          joinedAt: Date.now()
        });
      }

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        isAiRoom: true,
        aiDifficulty: difficulty,
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: chips,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          },
          ...aiPlayers
        ],
        gameState: {
          phase: 'WAITING',
          communityCards: [],
          pots: [{ amount: 0, eligiblePlayers: [] }],
          currentBet: 0,
          minBet: 0,
          maxBet: 0,
          currentPlayer: null,
        },
        config: {
          dealOrder: 'clockwise',
          playerCards: 2,
          communityCards: 5,
        },
        createdAt: Date.now()
      };

      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      callback({ success: true, roomId: roomId, playerId: playerId });

      setTimeout(() => {
        console.log(`[AI房间] ${roomId} 创建成功，房主: ${nickname}, AI数量: ${count}, 难度: ${difficulty}`);
        const update = buildGameUpdateForPlayer(room, socket.id);
        update.message = `人机对战房间已创建，${count}个AI对手（${AI_CONFIGS[difficulty].label}难度）`;
        io.to(socket.id).emit('gameUpdate', update);
      }, 0);

    } catch (error) {
      console.error('创建AI房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('createOmahaRoom', ({ nickname, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'omaha',
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: 1000,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          }
        ],
        gameState: {
          phase: 'WAITING',
          communityCards: [],
          pots: [{ amount: 0, eligiblePlayers: [] }],
          currentBet: 0,
          minBet: 0,
          maxBet: 0,
          currentPlayer: null,
        },
        config: {
          dealOrder: 'clockwise',
          playerCards: 4,
          communityCards: 5,
        },
        createdAt: Date.now()
      };

      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      callback({ success: true, roomId: roomId, playerId: playerId });

      setTimeout(() => {
        console.log(`[奥马哈房间] ${roomId} 创建成功，房主: ${nickname} (PlayerID: ${playerId})`);
        var update = buildOmahaGameUpdateForPlayer(room, socket.id);
        update.message = `奥马哈房间 ${roomId} 创建成功，您是房主`;
        io.to(socket.id).emit('omahaUpdate', update);
      }, 0);

    } catch (error) {
      console.error('创建奥马哈房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('createOmahaAiRoom', ({ nickname, aiCount, aiDifficulty, initialChips, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      const chips = initialChips || 1000;
      const difficulty = aiDifficulty || 'medium';
      const count = Math.min(Math.max(aiCount || 3, 1), 9);

      const aiPlayers = [];
      const allPersonalities = Object.keys(AI_PERSONALITIES);
      const aiAvatars = ['kitty', 'bones', 'bear', 'knight', 'zombie', 'piggy', 'ghost', 'burger', 'bread'];
      for (let i = 0; i < count; i++) {
        const aiName = `BOT${i + 1}`;
        const aiId = generateAiPlayerId();
        const personality = allPersonalities[i % allPersonalities.length];
        aiPlayers.push({
          id: aiId,
          playerId: aiId,
          nickname: aiName,
          avatar: aiAvatars[i % aiAvatars.length],
          personality: personality,
          chips: chips,
          seat: i + 2,
          isActive: true,
          isTurn: false,
          isOnline: true,
          isAI: true,
          aiDifficulty: difficulty,
          joinedAt: Date.now()
        });
      }

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        isAiRoom: true,
        gameType: 'omaha',
        aiDifficulty: difficulty,
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: chips,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          },
          ...aiPlayers
        ],
        gameState: {
          phase: 'WAITING',
          communityCards: [],
          pots: [{ amount: 0, eligiblePlayers: [] }],
          currentBet: 0,
          minBet: 0,
          maxBet: 0,
          currentPlayer: null,
        },
        config: {
          dealOrder: 'clockwise',
          playerCards: 4,
          communityCards: 5,
        },
        createdAt: Date.now()
      };

      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      callback({ success: true, roomId: roomId, playerId: playerId });

      setTimeout(() => {
        console.log(`[奥马哈AI房间] ${roomId} 创建成功，房主: ${nickname}, AI数量: ${count}`);
        var update = buildOmahaGameUpdateForPlayer(room, socket.id);
        update.message = `奥马哈人机对战房间已创建，${count}个AI对手（${AI_CONFIGS[difficulty].label}难度）`;
        io.to(socket.id).emit('omahaUpdate', update);
      }, 0);

    } catch (error) {
      console.error('创建奥马哈AI房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('createUnoRoom', ({ nickname, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'uno',
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: 0,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          }
        ],
        gameState: {
          phase: 'WAITING',
          deck: [],
          discardPile: [],
          playerCards: {},
          playerOrder: [],
          currentPlayerIndex: 0,
          direction: 1,
          currentColor: null,
          topCard: null,
          drawCount: 0,
          hasDrawnThisTurn: false,
          pendingColorChoice: false,
          winner: null,
          actionLog: [],
        },
        createdAt: Date.now()
      };

      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      callback({ success: true, roomId: roomId, playerId: playerId });

      setTimeout(() => {
        console.log(`[UNO房间] ${roomId} 创建成功，房主: ${nickname}`);
        io.to(socket.id).emit('unoUpdate', {
          phase: 'WAITING',
          players: room.players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            avatar: p.avatar,
            chips: p.chips,
            isAI: p.isAI,
            isOnline: true,
          })),
          isMyTurn: false,
          myHand: [],
          otherPlayers: {},
          playerOrder: [],
          message: `UNO房间 ${roomId} 创建成功，您是房主`,
        });
      }, 0);

    } catch (error) {
      console.error('创建UNO房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('createUnoAiRoom', ({ nickname, aiCount, aiDifficulty, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      const difficulty = aiDifficulty || 'medium';
      const count = Math.min(Math.max(aiCount || 3, 1), 9);

      const aiPlayers = [];
      const aiAvatars = ['kitty', 'bones', 'bear', 'knight', 'zombie', 'piggy', 'ghost', 'burger', 'bread'];
      for (let i = 0; i < count; i++) {
        const aiName = `BOT${i + 1}`;
        const aiId = generateAiPlayerId();
        aiPlayers.push({
          id: aiId,
          playerId: aiId,
          nickname: aiName,
          avatar: aiAvatars[i % aiAvatars.length],
          chips: 0,
          seat: i + 2,
          isActive: true,
          isTurn: false,
          isOnline: true,
          isAI: true,
          aiDifficulty: difficulty,
          joinedAt: Date.now()
        });
      }

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        isAiRoom: true,
        gameType: 'uno',
        aiDifficulty: difficulty,
        aiThinkDelay: difficulty === 'easy' ? 2500 : difficulty === 'hard' ? 800 : 1500,
        players: [
          {
            id: socket.id,
            playerId: playerId,
            nickname: nickname,
            avatar: avatar || 'froggy',
            chips: 0,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
            joinedAt: Date.now()
          },
          ...aiPlayers
        ],
        gameState: {
          phase: 'WAITING',
          deck: [],
          discardPile: [],
          playerCards: {},
          playerOrder: [],
          currentPlayerIndex: 0,
          direction: 1,
          currentColor: null,
          topCard: null,
          drawCount: 0,
          hasDrawnThisTurn: false,
          pendingColorChoice: false,
          winner: null,
          actionLog: [],
        },
        createdAt: Date.now()
      };

      rooms.set(roomId, room);
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      socket.join(roomId);

      callback({ success: true, roomId: roomId, playerId: playerId });

      setTimeout(() => {
        console.log(`[UNO AI房间] ${roomId} 创建成功，房主: ${nickname}, AI数量: ${count}`);
        io.to(socket.id).emit('unoUpdate', {
          phase: 'WAITING',
          players: room.players.map(p => ({
            id: p.id,
            nickname: p.nickname,
            avatar: p.avatar,
            chips: p.chips,
            isAI: p.isAI,
            isOnline: true,
          })),
          isMyTurn: false,
          myHand: [],
          otherPlayers: {},
          playerOrder: [],
          message: `UNO人机对战房间已创建，${count}个AI对手`,
        });
      }, 0);

    } catch (error) {
      console.error('创建UNO AI房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });

  socket.on('createDiceRoom', ({ nickname, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'dice',
        players: [{
          id: socket.id,
          playerId: playerId,
          socketId: socket.id,
          nickname: nickname || 'Player',
          avatar: avatar || 'bear',
          isAI: false,
          isOnline: true,
        }],
        gameState: {
          phase: 'WAITING',
          diceCount: 5,
          playerDice: {},
          playerDiceCount: {},
          playerRevealed: {},
          playerConfirmed: {},
          currentPlayerId: null,
          revealerId: null,
        },
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data = { roomId, playerId };

      if (callback) callback({ success: true, roomId });

      socket.emit('roomCreated', { roomId });
      socket.emit('diceUpdate', {
        phase: 'WAITING',
        diceCount: 5,
        players: room.players.map(p => ({
          id: p.id, nickname: p.nickname, avatar: p.avatar,
          isAI: p.isAI, isOnline: true,
          diceCount: 0, diceValues: [], diceRevealed: false,
        })),
        isMyTurn: false,
        isRevealer: true,
      });
    } catch (error) {
      console.error('创建骰子房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('createDiceAiRoom', ({ nickname, avatar, aiCount, aiDifficulty }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      const difficulty = aiDifficulty || 'medium';
      const count = Math.min(Math.max(aiCount || 3, 1), 5);

      const aiNames = ['骰子AI-小红', '骰子AI-小蓝', '骰子AI-小绿', '骰子AI-小黄', '骰子AI-小紫'];
      const aiAvatars = ['kitty', 'froggy', 'piggy', 'ghost', 'zombie'];

      const aiPlayers = [];
      for (let i = 0; i < count; i++) {
        aiPlayers.push({
          id: 'ai-dice-' + Date.now() + '-' + i,
          socketId: null,
          nickname: aiNames[i] || ('AI-' + (i + 1)),
          avatar: aiAvatars[i] || 'kitty',
          isAI: true,
          isOnline: true,
          aiDifficulty: difficulty,
        });
      }

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'dice',
        isAiRoom: true,
        aiDifficulty: difficulty,
        players: [{
          id: socket.id,
          playerId: playerId,
          socketId: socket.id,
          nickname: nickname || 'Player',
          avatar: avatar || 'bear',
          isAI: false,
          isOnline: true,
        }, ...aiPlayers],
        gameState: {
          phase: 'WAITING',
          diceCount: 5,
          playerDice: {},
          playerDiceCount: {},
          playerRevealed: {},
          playerConfirmed: {},
          currentPlayerId: null,
          revealerId: null,
        },
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data = { roomId, playerId };

      if (callback) callback({ success: true, roomId });

      socket.emit('roomCreated', { roomId });
      socket.emit('diceUpdate', {
        phase: 'WAITING',
        diceCount: 5,
        players: room.players.map(p => ({
          id: p.id, nickname: p.nickname, avatar: p.avatar,
          isAI: p.isAI, isOnline: true,
          diceCount: 0, diceValues: [], diceRevealed: false,
        })),
        isMyTurn: false,
        isRevealer: true,
      });
    } catch (error) {
      console.error('创建骰子AI房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('joinDiceRoom', ({ roomId, nickname, avatar }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ success: false, error: '房间不存在' });
        return;
      }

      if (room.gameType !== 'dice') {
        if (callback) callback({ success: false, error: '不是骰子房间' });
        return;
      }

      if (room.players.length >= 10) {
        if (callback) callback({ success: false, error: '房间已满' });
        return;
      }

      const newPlayerId = generatePlayerId();

      const player = {
        id: socket.id,
        playerId: newPlayerId,
        nickname: nickname || 'Player',
        avatar: avatar || 'bear',
        isAI: false,
        isOnline: true,
        joinedAt: Date.now(),
      };

      room.players.push(player);
      socket.join(roomId);
      socket.data = { roomId, playerId: newPlayerId };

      if (callback) callback({ success: true, roomId });

      socket.emit('roomJoined', { roomId, isHost: false });

      room.players.forEach(function (p) {
        if (!p.isAI) {
          io.to(p.id).emit('diceUpdate', {
            phase: room.gameState.phase,
            diceCount: room.gameState.diceCount,
            players: room.players.map(function (op) {
              return {
                id: op.id,
                nickname: op.nickname,
                avatar: op.avatar,
                isAI: op.isAI,
                isOnline: true,
                diceCount: room.gameState.playerDiceCount[op.id] || 0,
                diceValues: room.gameState.playerRevealed[op.id] ? (room.gameState.playerDice[op.id] || []) : [],
                diceRevealed: room.gameState.playerRevealed[op.id] || false,
              };
            }),
            isMyTurn: room.gameState.currentPlayerId === p.id,
            isRevealer: room.gameState.revealerId === p.id,
          });
        }
      });
    } catch (error) {
      console.error('加入骰子房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('createPokerSimRoom', ({ nickname, avatar }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();

      const room = {
        id: roomId,
        host: socket.id,
        hostPlayerId: playerId,
        gameType: 'poker-sim',
        players: [{
          id: socket.id,
          playerId: playerId,
          socketId: socket.id,
          nickname: nickname || 'Player',
          avatar: avatar || 'bear',
          isAI: false,
          isOnline: true,
        }],
        gameState: {
          deck: [],
          playerCards: {},
          communityCards: [],
          revealedPlayers: {},
          includeJoker: true,
          started: false,
          revealed: false,
        },
      };

      rooms.set(roomId, room);
      socket.join(roomId);
      socket.data = { roomId, playerId };

      if (callback) callback({ success: true, roomId });

      socket.emit('roomCreated', { roomId });
      socket.emit('simUpdate', {
        players: room.players.map(p => ({
          id: p.id, nickname: p.nickname, avatar: p.avatar, isOnline: true,
        })),
        deck: [],
        playerCards: {},
        communityCards: [],
        revealedPlayers: {},
        includeJoker: true,
        revealed: false,
      });
    } catch (error) {
      console.error('创建扑克牌模拟房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  socket.on('joinPokerSimRoom', ({ roomId, nickname, avatar }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        if (callback) callback({ success: false, error: '房间不存在' });
        return;
      }

      if (room.gameType !== 'poker-sim') {
        if (callback) callback({ success: false, error: '不是扑克牌模拟房间' });
        return;
      }

      if (room.players.length >= 10) {
        if (callback) callback({ success: false, error: '房间已满' });
        return;
      }

      const newPlayerId = generatePlayerId();

      const player = {
        id: socket.id,
        playerId: newPlayerId,
        nickname: nickname || 'Player',
        avatar: avatar || 'bear',
        isAI: false,
        isOnline: true,
        joinedAt: Date.now(),
      };

      room.players.push(player);
      socket.join(roomId);
      socket.data = { roomId, playerId: newPlayerId };

      if (callback) callback({ success: true, roomId });

      socket.emit('roomJoined', { roomId, isHost: false });

      room.players.forEach(function (p) {
        if (!p.isAI) {
          io.to(p.id).emit('simUpdate', {
            players: room.players.map(function (op) {
              return {
                id: op.id,
                nickname: op.nickname,
                avatar: op.avatar,
                isOnline: op.isOnline !== false,
              };
            }),
            deck: room.gameState.deck.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
            playerCards: room.gameState.playerCards,
            communityCards: room.gameState.communityCards.map(function (c) { return { suit: c.suit, rank: c.rank }; }),
            revealedPlayers: Object.assign({}, room.gameState.revealedPlayers),
            includeJoker: room.gameState.includeJoker,
            revealed: room.gameState.revealed || false,
          });
        }
      });
    } catch (error) {
      console.error('加入扑克牌模拟房间失败:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  });

  // 加入房间
  socket.on('joinRoom', ({ roomId, nickname, playerId: existingPlayerId, avatar }, callback) => {
    try {
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: '房间不存在' });
      }
      
      if (room.players.length >= 10) {
        return callback({ success: false, error: '房间已满' });
      }
      
      let player;
      let isReconnect = false;
      
      if (existingPlayerId) {
        const existingPlayer = room.players.find(p => p.playerId === existingPlayerId);
        
        if (existingPlayer) {
          const oldSocketId = existingPlayer.id;
          existingPlayer.id = socket.id;
          existingPlayer.isOnline = true;
          existingPlayer.lastReconnectAt = Date.now();
          
          if (socket.disconnectTimeout) {
            clearTimeout(socket.disconnectTimeout);
            socket.disconnectTimeout = null;
          }
          
          socketToPlayerMap.delete(oldSocketId);
          socketToPlayerMap.set(socket.id, { roomId, playerId: existingPlayerId });
          
          player = existingPlayer;
          isReconnect = true;
          console.log(`[重连] 玩家 ${player.nickname} (PlayerID: ${existingPlayerId}) 重新连接到房间 ${roomId}`);
        }
      }
      
      if (!player) {
        const nicknameExists = room.players.some(p => p.nickname === nickname && p.isOnline);
        if (nicknameExists) {
          return callback({ success: false, error: '该昵称已被使用' });
        }
        
        let seat = 1;
        while (room.players.some(p => p.seat === seat)) {
          seat++;
        }
        
        const newPlayerId = generatePlayerId();
        
        player = {
          id: socket.id,
          playerId: newPlayerId,
          nickname: nickname,
          avatar: avatar || 'froggy',
          chips: room.gameType === 'uno' || room.gameType === 'dice' ? 0 : 1000,
          seat: seat,
          isActive: true,
          isTurn: false,
          isOnline: true,
          joinedAt: Date.now()
        };
        
        room.players.push(player);
        socketToPlayerMap.set(socket.id, { roomId, playerId: newPlayerId });
      }
      
      socket.join(roomId);
      
      callback({ 
        success: true, 
        playerId: player.playerId,
        isReconnect: isReconnect,
        gameType: room.gameType || 'poker',
        gameState: room.gameType === 'omaha' ? buildOmahaGameUpdateForPlayer(room, socket.id) : room.gameType === 'uno' ? {} : room.gameType === 'dice' ? {} : buildGameUpdateForPlayer(room, socket.id),
      });
      
      setTimeout(() => {
        if (room.gameType === 'omaha') {
          broadcastOmahaGameUpdate(room, io, isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`);
        } else if (room.gameType === 'dice') {
          room.players.forEach(p => {
            if (!p.isAI) {
              io.to(p.id).emit('diceUpdate', {
                phase: room.gameState.phase,
                diceCount: room.gameState.diceCount,
                players: room.players.map(op => ({
                  id: op.id, nickname: op.nickname, avatar: op.avatar,
                  isAI: op.isAI, isOnline: true,
                  diceCount: room.gameState.playerDiceCount[op.id] || 0,
                  diceValues: room.gameState.playerRevealed[op.id] ? (room.gameState.playerDice[op.id] || []) : [],
                  diceRevealed: room.gameState.playerRevealed[op.id] || false,
                })),
                isMyTurn: room.gameState.currentPlayerId === p.id,
                isRevealer: room.gameState.revealerId === p.id,
                message: isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`,
              });
            }
          });
        } else if (room.gameType === 'uno') {
          const gs = room.gameState;
          room.players.forEach(p => {
            const isCurrentPlayer = gs.playerOrder[gs.currentPlayerIndex] === p.id;
            const playerHand = gs.playerCards[p.id] || [];
            const otherPlayers = {};
            gs.playerOrder.forEach(pid => {
              if (pid !== p.id) {
                const otherHand = gs.playerCards[pid] || [];
                otherPlayers[pid] = {
                  cardCount: otherHand.length,
                  cards: otherHand.map(c => ({ hidden: true })),
                  calledUno: room.players.find(op => op.id === pid)?.calledUno || false,
                };
              }
            });
            io.to(p.id).emit('unoUpdate', {
              phase: gs.phase,
              currentPlayerId: gs.playerOrder[gs.currentPlayerIndex],
              direction: gs.direction,
              currentColor: gs.currentColor,
              topCard: gs.topCard,
              discardPileCount: gs.discardPile.length,
              deckCount: gs.deck.length,
              myHand: playerHand,
              otherPlayers: otherPlayers,
              playerOrder: gs.playerOrder,
              hasDrawnThisTurn: gs.hasDrawnThisTurn && isCurrentPlayer,
              pendingColorChoice: gs.pendingColorChoice && isCurrentPlayer,
              winner: gs.winner,
              actionLog: gs.actionLog.slice(-20),
              players: room.players.map(op => ({
                id: op.id,
                nickname: op.nickname,
                avatar: op.avatar,
                chips: op.chips,
                isAI: op.isAI,
                isOnline: op.isOnline !== false,
                calledUno: op.calledUno || false,
              })),
              isMyTurn: isCurrentPlayer,
              message: isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`,
            });
          });
        } else {
          broadcastGameUpdate(room, io, isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`);
        }
        console.log(`玩家 ${nickname} ${isReconnect ? '重新连接' : '加入'}房间 ${roomId}`);
      }, 0);
      
    } catch (error) {
      console.error('加入房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // 离开房间
  socket.on('leaveRoom', () => {
    // 处理逻辑在disconnect事件中
  });
  
};

// 导出映射关系供其他模块使用
module.exports.getSocketToPlayerMap = () => socketToPlayerMap;
module.exports.getPlayerBySocketId = (socketId) => socketToPlayerMap.get(socketId);
module.exports.buildGameUpdateForPlayer = buildGameUpdateForPlayer;
module.exports.broadcastGameUpdate = broadcastGameUpdate;
module.exports.buildOmahaGameUpdateForPlayer = buildOmahaGameUpdateForPlayer;