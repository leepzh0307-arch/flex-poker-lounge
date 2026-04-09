// Socket功能初始化
const roomHandler = require('./handlers/room');
const gameHandler = require('./handlers/game');
const voiceHandler = require('./handlers/voice');

// 房间存储
const rooms = new Map();

// 导出Socket处理函数
module.exports = (io) => {
  // 处理新连接
  io.on('connection', (socket) => {
    console.log('新用户连接:', socket.id);
    
    // 房间相关事件
    roomHandler(socket, rooms, io);
    
    // 游戏相关事件
    gameHandler(socket, rooms, io);
    
    // 语音相关事件
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
          const player = room.players[playerIndex];
          const playerId = player.id;
          const playerNickname = player.nickname;
          
          // 延迟标记玩家为离线，给玩家重新连接的机会
          const disconnectTimeout = setTimeout(() => {
            const checkRoom = rooms.get(roomId);
            if (checkRoom) {
              const checkPlayer = checkRoom.players.find(p => p.id === playerId);
              if (checkPlayer) {
                // 标记玩家为离线
                checkPlayer.isOnline = false;
                checkPlayer.lastDisconnectAt = Date.now();
                
                // 更新房间状态
                io.to(roomId).emit('gameUpdate', {
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
                
                rooms.delete(roomId);
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