// 语音处理模块
module.exports = (socket, rooms, io) => {
  // 存储用户的语音状态
  const voiceStates = new Map();
  
  // 语音房间加入
  socket.on('joinVoice', ({ roomId }, callback) => {
    try {
      // 查找房间
      const room = rooms.get(roomId);
      if (!room) {
        return callback({ success: false, error: '房间不存在' });
      }
      
      // 检查玩家是否在房间中
      const player = room.players.find(p => p.id === socket.id);
      if (!player) {
        return callback({ success: false, error: '玩家不在房间中' });
      }
      
      // 加入语音房间
      socket.join(`voice-${roomId}`);
      
      // 记录语音状态
      voiceStates.set(socket.id, {
        roomId: roomId,
        userId: socket.id,
        nickname: player.nickname,
        joinedAt: Date.now(),
        microphoneEnabled: true,
        speakerEnabled: true
      });
      
      // 通知其他玩家
      socket.to(`voice-${roomId}`).emit('userJoinedVoice', {
        userId: socket.id,
        nickname: player.nickname,
        message: '用户加入语音通话',
      });
      
      // 发送当前语音房间中的用户列表
      const voiceUsers = [];
      voiceStates.forEach((state, userId) => {
        if (state.roomId === roomId && userId !== socket.id) {
          voiceUsers.push({
            userId: userId,
            nickname: state.nickname,
            microphoneEnabled: state.microphoneEnabled,
            speakerEnabled: state.speakerEnabled
          });
        }
      });
      
      callback({ 
        success: true, 
        voiceUsers: voiceUsers,
        message: '成功加入语音通话'
      });
      
      console.log(`[语音] 用户 ${player.nickname} 加入房间 ${roomId} 的语音通话`);
      
    } catch (error) {
      console.error('[语音] 加入语音房间失败:', error);
      callback({ success: false, error: error.message });
    }
  });
  
  // 语音房间离开
  socket.on('leaveVoice', ({ roomId }, callback) => {
    try {
      // 离开语音房间
      socket.leave(`voice-${roomId}`);
      
      // 清除语音状态
      const voiceState = voiceStates.get(socket.id);
      if (voiceState) {
        voiceStates.delete(socket.id);
        
        // 通知其他玩家
        socket.to(`voice-${roomId}`).emit('userLeftVoice', {
          userId: socket.id,
          nickname: voiceState.nickname,
          message: '用户离开语音通话',
        });
        
        console.log(`[语音] 用户 ${voiceState.nickname} 离开房间 ${roomId} 的语音通话`);
      }
      
      if (callback) {
        callback({ success: true });
      }
    } catch (error) {
      console.error('[语音] 离开语音房间失败:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });
  
  // 语音状态更新
  socket.on('voiceStatus', ({ roomId, status }, callback) => {
    try {
      const voiceState = voiceStates.get(socket.id);
      if (!voiceState) {
        return callback({ success: false, error: '用户未加入语音通话' });
      }
      
      // 更新语音状态
      if (status.microphoneEnabled !== undefined) {
        voiceState.microphoneEnabled = status.microphoneEnabled;
      }
      if (status.speakerEnabled !== undefined) {
        voiceState.speakerEnabled = status.speakerEnabled;
      }
      
      // 通知其他玩家
      socket.to(`voice-${roomId}`).emit('voiceStatusUpdate', {
        userId: socket.id,
        nickname: voiceState.nickname,
        status: {
          microphoneEnabled: voiceState.microphoneEnabled,
          speakerEnabled: voiceState.speakerEnabled
        },
      });
      
      if (callback) {
        callback({ success: true });
      }
      
    } catch (error) {
      console.error('[语音] 更新语音状态失败:', error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });
  
  // 获取语音房间用户列表
  socket.on('getVoiceUsers', ({ roomId }, callback) => {
    try {
      const voiceUsers = [];
      voiceStates.forEach((state, userId) => {
        if (state.roomId === roomId) {
          voiceUsers.push({
            userId: userId,
            nickname: state.nickname,
            microphoneEnabled: state.microphoneEnabled,
            speakerEnabled: state.speakerEnabled,
            joinedAt: state.joinedAt
          });
        }
      });
      
      callback({ success: true, voiceUsers: voiceUsers });
    } catch (error) {
      console.error('[语音] 获取语音用户列表失败:', error);
      callback({ success: false, error: error.message });
    }
  });
};