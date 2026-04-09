// 房间处理模块
const { generateRoomId } = require('../../utils/deck');

module.exports = (socket, rooms, io) => {
  // 创建房间
  socket.on('createRoom', ({ nickname }, callback) => {
    try {
      // 生成房间号
      const roomId = generateRoomId();
      
      // 创建房间
      const room = {
        id: roomId,
        host: socket.id,
        players: [
          {
            id: socket.id,
            nickname: nickname,
            chips: 1000,
            seat: 1,
            isActive: true,
            isTurn: false,
            isOnline: true,
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
      };
      
      // 存储房间
      rooms.set(roomId, room);
      
      // 加入房间
      socket.join(roomId);
      
      // 快速回调，减少等待时间
      callback({ success: true, roomId: roomId });
      
      // 异步记录日志，不阻塞回调
      setTimeout(() => {
        console.log(`房间 ${roomId} 创建成功，房主: ${nickname}`);
      }, 0);
      
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // 加入房间
  socket.on('joinRoom', ({ roomId, nickname }, callback) => {
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
      
      // 检查是否是重新连接（通过昵称查找已有的玩家）
      const existingPlayer = room.players.find(p => p.nickname === nickname);
      
      let player;
      if (existingPlayer) {
        // 重新连接，更新玩家的 socket ID
        existingPlayer.id = socket.id;
        existingPlayer.isOnline = true;
        
        // 清除之前的断开连接超时
        if (socket.disconnectTimeout) {
          clearTimeout(socket.disconnectTimeout);
          socket.disconnectTimeout = null;
        }
        
        player = existingPlayer;
      } else {
        // 分配座位
        let seat = 1;
        while (room.players.some(p => p.seat === seat)) {
          seat++;
        }
        
        // 添加新玩家
        player = {
          id: socket.id,
          nickname: nickname,
          chips: 1000,
          seat: seat,
          isActive: true,
          isTurn: false,
          isOnline: true,
        };
        
        room.players.push(player);
      }
      
      // 加入房间
      socket.join(roomId);
      
      // 快速回调给新玩家，减少等待时间
      callback({ 
        success: true, 
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
            message: `${nickname} 加入了房间`,
          });
        });
        
        console.log(`玩家 ${nickname} 加入房间 ${roomId}`);
      }, 0);
      
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // 离开房间
  socket.on('leaveRoom', () => {
    // 处理逻辑在disconnect事件中
  });
};