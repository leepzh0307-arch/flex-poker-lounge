// 房间处理模块
const { generateRoomId } = require('../../utils/deck');

// 生成唯一玩家ID
function generatePlayerId() {
  return 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// 存储socket ID到玩家ID的映射（模块级别，所有连接共享）
const socketToPlayerMap = new Map();

module.exports = (socket, rooms, io) => {
  
  // 创建房间
  socket.on('createRoom', ({ nickname }, callback) => {
    try {
      // 生成房间号
      const roomId = generateRoomId();
      
      // 生成唯一玩家ID
      const playerId = generatePlayerId();
      
      // 创建房间
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
      
      // 存储房间
      rooms.set(roomId, room);
      
      // 存储映射关系
      socketToPlayerMap.set(socket.id, { roomId, playerId });
      
      // 加入房间
      socket.join(roomId);
      
      // 快速回调，减少等待时间
      callback({ success: true, roomId: roomId, playerId: playerId });
      
      // 异步记录日志，不阻塞回调
      setTimeout(() => {
        console.log(`房间 ${roomId} 创建成功，房主: ${nickname} (PlayerID: ${playerId})`);
      }, 0);
      
    } catch (error) {
      console.error('创建房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // 加入房间
  socket.on('joinRoom', ({ roomId, nickname, playerId: existingPlayerId }, callback) => {
    try {
      // 查找房间
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: '房间不存在' });
      }
      
      // 检查房间是否已满
      if (room.players.length >= 10) {
        return callback({ success: false, error: '房间已满' });
      }
      
      let player;
      let isReconnect = false;
      
      // 检查是否是重新连接（通过playerId查找已有的玩家）
      if (existingPlayerId) {
        const existingPlayer = room.players.find(p => p.playerId === existingPlayerId);
        
        if (existingPlayer) {
          // 重新连接，更新玩家的 socket ID
          const oldSocketId = existingPlayer.id;
          existingPlayer.id = socket.id;
          existingPlayer.isOnline = true;
          existingPlayer.lastReconnectAt = Date.now();
          
          // 清除之前的断开连接超时
          if (socket.disconnectTimeout) {
            clearTimeout(socket.disconnectTimeout);
            socket.disconnectTimeout = null;
          }
          
          // 更新映射关系
          socketToPlayerMap.delete(oldSocketId);
          socketToPlayerMap.set(socket.id, { roomId, playerId: existingPlayerId });
          
          player = existingPlayer;
          isReconnect = true;
          console.log(`[重连] 玩家 ${player.nickname} (PlayerID: ${existingPlayerId}) 重新连接到房间 ${roomId}`);
        }
      }
      
      if (!player) {
        // 检查昵称是否已存在
        const nicknameExists = room.players.some(p => p.nickname === nickname && p.isOnline);
        if (nicknameExists) {
          return callback({ success: false, error: '该昵称已被使用' });
        }
        
        // 分配座位
        let seat = 1;
        while (room.players.some(p => p.seat === seat)) {
          seat++;
        }
        
        // 生成唯一玩家ID
        const newPlayerId = generatePlayerId();
        
        // 添加新玩家
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
        
        // 存储映射关系
        socketToPlayerMap.set(socket.id, { roomId, playerId: newPlayerId });
      }
      
      // 加入房间
      socket.join(roomId);
      
      // 快速回调给新玩家，减少等待时间
      callback({ 
        success: true, 
        playerId: player.playerId,
        isReconnect: isReconnect,
        gameState: {
          roomId: roomId,
          players: room.players.map(p => ({
            ...p,
            cards: p.id === socket.id && room.gameState.playerCards && room.gameState.playerCards[p.id]
              ? room.gameState.playerCards[p.id]
              : [{ hidden: true }, { hidden: true }]
          })),
          communityCards: room.gameState.communityCards || [],
          pots: room.gameState.pots || [{ amount: 0, eligiblePlayers: [] }],
          currentBet: room.gameState.currentBet || 0,
          minBet: room.gameState.minBet || 0,
          maxBet: room.gameState.maxBet || 0,
          gamePhase: room.gameState.phase || 'WAITING',
          currentPlayer: room.gameState.currentPlayer,
          roundBets: room.gameState.roundBets ? { ...room.gameState.roundBets } : {},
        }
      });
      
      // 异步通知所有玩家，不阻塞回调
      setTimeout(() => {
        room.players.forEach(playerInRoom => {
          io.to(playerInRoom.id).emit('gameUpdate', {
            roomId: roomId,
            players: room.players.map(p => ({
              ...p,
              cards: p.id === playerInRoom.id && room.gameState.playerCards && room.gameState.playerCards[p.id]
                ? room.gameState.playerCards[p.id]
                : [{ hidden: true }, { hidden: true }]
            })),
            communityCards: room.gameState.communityCards || [],
            pots: room.gameState.pots || [{ amount: 0, eligiblePlayers: [] }],
            currentBet: room.gameState.currentBet || 0,
            minBet: room.gameState.minBet || 0,
            maxBet: room.gameState.maxBet || 0,
            gamePhase: room.gameState.phase || 'WAITING',
            currentPlayer: room.gameState.currentPlayer,
            roundBets: room.gameState.roundBets ? { ...room.gameState.roundBets } : {},
            message: isReconnect ? `${nickname} 重新连接` : `${nickname} 加入了房间`,
          });
        });
        
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