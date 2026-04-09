// 语音处理模块
module.exports = (socket, rooms, io) => {
  // 语音房间加入
  socket.on('joinVoice', ({ roomId }, callback) => {
    try {
      // 查找房间
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: '房间不存在' });
      }
      
      // 加入语音房间
      socket.join(`voice-${roomId}`);
      
      // 通知其他玩家
      socket.to(`voice-${roomId}`).emit('userJoinedVoice', {
        userId: socket.id,
        message: '用户加入语音通话',
      });
      
      callback({ success: true });
      
    } catch (error) {
      callback({ success: false, error: error.message });
    }
  });
  
  // 语音房间离开
  socket.on('leaveVoice', ({ roomId }) => {
    // 离开语音房间
    socket.leave(`voice-${roomId}`);
    
    // 通知其他玩家
    socket.to(`voice-${roomId}`).emit('userLeftVoice', {
      userId: socket.id,
      message: '用户离开语音通话',
    });
  });
  
  // 语音状态更新
  socket.on('voiceStatus', ({ roomId, status }) => {
    // 通知其他玩家
    socket.to(`voice-${roomId}`).emit('voiceStatusUpdate', {
      userId: socket.id,
      status: status,
    });
  });
};