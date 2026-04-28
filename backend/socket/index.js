// Socket功能初始化
const roomHandler = require('./handlers/room');
const gameHandler = require('./handlers/game');
const omahaGameHandler = require('./handlers/omahaGame');
const unoGameHandler = require('./handlers/unoGame');
const diceGameHandler = require('./handlers/diceGame');
const pokerSimGameHandler = require('./handlers/pokerSimGame');
const voiceHandler = require('./handlers/voice');
const { clearRoomPersonality } = require('../utils/aiEngine');
const StandUpGame = require('../utils/standupGame');

// 房间存储
const rooms = new Map();

// 导出Socket处理函数
module.exports = (io) => {
  // 处理新连接
  io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);
    
    // 房间相关事件
    roomHandler(socket, rooms, io);
    
    gameHandler(socket, rooms, io);
    
    omahaGameHandler(socket, rooms, io);
    
    unoGameHandler(socket, rooms, io);
    
    diceGameHandler(socket, rooms, io);
    
    pokerSimGameHandler(socket, rooms, io);
    
    voiceHandler(socket, rooms, io);
    
    // 断开连接
    socket.on('disconnect', () => {
      console.log('用户断开连接:', socket.id);
      
      // 获取socket到玩家的映射关系
      const playerMap = roomHandler.getSocketToPlayerMap ? roomHandler.getSocketToPlayerMap() : new Map();
      const playerInfo = playerMap.get(socket.id);
      
      // 处理用户离开房间
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          // 骰子和扑克牌模拟房间由各自的handler处理disconnect
          if (room.gameType === 'dice' || room.gameType === 'poker-sim') {
            break;
          }

          const player = room.players[playerIndex];
          const playerId = player.id;
          const playerNickname = player.nickname;
          
          var suLeaveResult = StandUpGame.onPlayerLeave(room, socket.id);
          if (suLeaveResult) {
            room.players.forEach(p => {
              if (p.isAI) return;
              io.to(p.id).emit('gameAction', {
                type: 'standupGame',
                result: suLeaveResult,
                timestamp: Date.now(),
              });
            });
          }
          
          // 延迟标记玩家为离线，给玩家重新连接的机会
          const disconnectTimeout = setTimeout(() => {
            const checkRoom = rooms.get(roomId);
            if (checkRoom) {
              const checkPlayer = checkRoom.players.find(p => p.id === playerId);
              if (checkPlayer) {
                // 标记玩家为离线
                checkPlayer.isOnline = false;
                checkPlayer.lastDisconnectAt = Date.now();
                
                // 根据游戏类型发送对应的事件
                var updateEvent = 'gameUpdate';
                if (checkRoom.gameType === 'uno') updateEvent = 'unoUpdate';
                else if (checkRoom.gameType === 'omaha') updateEvent = 'omahaUpdate';
                
                io.to(roomId).emit(updateEvent, {
                  roomId: roomId,
                  players: checkRoom.players,
                  message: `${playerNickname} 暂时离开了`,
                });
              }
            }
          }, 3000); // 3秒后标记为离线
          
          // 存储超时ID，以便在重新连接时清除
          socket.disconnectTimeout = disconnectTimeout;
          
          // 延迟检查并删除空房间（给玩家重新连接的机会）
          setTimeout(() => {
            const checkRoom = rooms.get(roomId);
            if (checkRoom) {
              // 检查房间是否还有在线玩家
              const onlinePlayers = checkRoom.players.filter(p => p.isOnline !== false);
              if (onlinePlayers.length === 0) {
                // 清理映射关系
                if (playerInfo) {
                  playerMap.delete(socket.id);
                }
                
                StandUpGame.onTableClose(checkRoom);
                
                rooms.delete(roomId);
                clearRoomPersonality(roomId);
                console.log(`房间 ${roomId} 已删除（所有玩家离线）`);
              }
            }
          }, 10000); // 10秒后检查
          
          break;
        }
      }
      
      // 清理映射关系
      if (playerInfo) {
        playerMap.delete(socket.id);
      }
    });
  });
};