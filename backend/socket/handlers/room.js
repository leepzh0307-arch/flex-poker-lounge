// 房间处理模块
const { generateRoomId } = require('../../utils/deck');
const { pickAiName, AI_CONFIGS } = require('../../utils/aiEngine');

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

module.exports = (socket, rooms, io) => {
  
  // 创建房间
  socket.on('createRoom', ({ nickname }, callback) => {
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
  socket.on('createAiRoom', ({ nickname, aiCount, aiDifficulty, initialChips }, callback) => {
    try {
      const roomId = generateRoomId();
      const playerId = generatePlayerId();
      const chips = initialChips || 1000;
      const difficulty = aiDifficulty || 'medium';
      const count = Math.min(Math.max(aiCount || 3, 1), 9);

      const existingNames = [nickname];
      const aiPlayers = [];
      for (let i = 0; i < count; i++) {
        // 修改1：调用新 pickAiName，传递 roomId，获取不重复人格
        const { name: aiName, personality } = pickAiName(existingNames, roomId);
        existingNames.push(aiName);
        const aiId = generateAiPlayerId();
        aiPlayers.push({
          id: aiId,
          playerId: aiId,
          nickname: aiName,
          personality: personality, // 修改2：添加 personality 字段
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
  
  // 加入房间
  socket.on('joinRoom', ({ roomId, nickname, playerId: existingPlayerId }, callback) => {
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
          chips: 1000,
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
        gameState: buildGameUpdateForPlayer(room, socket.id),
      });
      
      setTimeout(() => {
        broadcastGameUpdate(room, io, isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`);
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