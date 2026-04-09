// 声网Agora语音SDK封装
class AgoraVoice {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.isJoined = false;
    this.microphoneEnabled = true;
    this.speakerEnabled = true;
    this.currentToken = null;
    this.currentRoomId = null;
    this.currentUserId = null;
  }
  
  // 初始化Agora
  async initialize() {
    // 等待配置加载
    let retryCount = 0;
    const maxRetries = 5;
    
    while (!config.agora.appId && retryCount < maxRetries) {
      console.log(`[Agora] 等待配置加载... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      retryCount++;
    }
    
    if (!config.agora.appId) {
      console.error('[Agora] App ID未配置，请检查后端服务是否正常运行');
      console.error('[Agora] 后端地址:', config.serverUrl);
      return false;
    }
    
    try {
      // 创建Agora客户端
      this.client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      
      // 注册事件监听
      this.client.on('user-joined', (user) => {
        console.log('[Agora] 用户加入语音通话:', user.uid);
      });
      
      this.client.on('user-left', (user) => {
        console.log('[Agora] 用户离开语音通话:', user.uid);
      });
      
      this.client.on('error', (error) => {
        console.error('[Agora] 错误:', error);
      });
      
      this.isInitialized = true;
      console.log('[Agora] 初始化成功');
      return true;
    } catch (error) {
      console.error('[Agora] 初始化失败:', error);
      return false;
    }
  }
  
  // 加入语音频道
  async joinChannel(roomId, userId) {
    if (!this.isInitialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        console.error('[Agora] 初始化失败，无法加入语音频道');
        return false;
      }
    }
    
    try {
      // 生成频道名称
      const channelName = `${config.agora.channelPrefix}${roomId}`;
      
      console.log(`[Agora] 正在加入频道: ${channelName}, uid: ${userId}`);
      console.log(`[Agora] App ID: ${config.agora.appId ? '已配置' : '未配置'}`);
      
      // 保存当前房间信息（用于重连）
      this.currentRoomId = roomId;
      this.currentUserId = userId;
      
      // 从后端获取Token
      let token = null;
      if (window.generateAgoraToken) {
        try {
          token = await window.generateAgoraToken(channelName, userId);
          if (token) {
            console.log('[Agora] Token获取成功');
            this.currentToken = token;
          } else {
            console.warn('[Agora] Token获取失败，使用测试模式（无Token）');
          }
        } catch (tokenError) {
          console.error('[Agora] Token生成异常:', tokenError);
          console.warn('[Agora] 将使用测试模式（无Token）');
        }
      } else {
        console.warn('[Agora] generateAgoraToken函数不存在');
      }
      
      // 加入频道
      await this.client.join(
        config.agora.appId,
        channelName,
        token, // 如果没有Token，传null（测试模式）
        userId.toString()
      );
      
      // 创建本地音频轨道
      const localTracks = await AgoraRTC.createMicrophoneAudioTrack();
      
      // 发布本地轨道
      await this.client.publish(localTracks);
      
      this.isJoined = true;
      console.log('[Agora] ✅ 加入语音频道成功');
      return true;
    } catch (error) {
      console.error('[Agora] ❌ 加入语音频道失败:', error.message);
      if (error.code === 'PERMISSION_DENIED') {
        console.error('[Agora] 错误：请检查浏览器麦克风权限');
      } else if (error.code === 'INVALID_APP_ID') {
        console.error('[Agora] 错误：App ID无效，请检查配置');
      } else if (error.code === 'INVALID_TOKEN') {
        console.error('[Agora] 错误：Token无效，请检查后端配置');
      }
      return false;
    }
  }
  
  // 离开语音频道
  async leaveChannel() {
    if (this.isJoined && this.client) {
      try {
        await this.client.leave();
        this.isJoined = false;
        console.log('[Agora] 离开语音频道成功');
      } catch (error) {
        console.error('[Agora] 离开语音频道失败:', error);
      }
    }
  }
  
  // 切换麦克风（或尝试连接/断开）
  async toggleMicrophone() {
    try {
      // 如果未连接，尝试连接
      if (!this.isJoined) {
        console.log('[Agora] 未连接，尝试加入语音频道...');
        
        if (!this.currentRoomId || !this.currentUserId) {
          console.warn('[Agora] 没有房间信息，无法连接');
          return false;
        }
        
        const success = await this.joinChannel(this.currentRoomId, this.currentUserId);
        return success;
      }
      
      // 已连接，切换麦克风状态
      const localTracks = this.client.getLocalTracks();
      if (localTracks.length > 0) {
        const audioTrack = localTracks[0];
        if (this.microphoneEnabled) {
          await audioTrack.setEnabled(false);
          this.microphoneEnabled = false;
          console.log('[Agora] 麦克风已关闭');
        } else {
          await audioTrack.setEnabled(true);
          this.microphoneEnabled = true;
          console.log('[Agora] 麦克风已开启');
        }
        return true;
      } else {
        console.warn('[Agora] 没有找到音频轨道');
        return false;
      }
    } catch (error) {
      console.error('[Agora] 切换麦克风失败:', error);
      return false;
    }
  }
  
  // 切换扬声器
  toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;
    console.log(`[Agora] 扬声器已${this.speakerEnabled ? '开启' : '关闭'}`);
  }
  
  // 获取麦克风状态
  isMicrophoneEnabled() {
    return this.microphoneEnabled;
  }
  
  // 获取扬声器状态
  isSpeakerEnabled() {
    return this.speakerEnabled;
  }
  
  // 获取连接状态
  isConnected() {
    return this.isJoined;
  }
}

// 创建全局Agora实例
const agoraVoice = new AgoraVoice();

try {
  module.exports = agoraVoice;
} catch (e) {
  // 浏览器环境下挂载到window
  window.agoraVoice = agoraVoice;
}
