// 声网Agora语音SDK封装
class AgoraVoice {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.isJoined = false;
    this.microphoneEnabled = true;
    this.speakerEnabled = true;
    this.localAudioTrack = null;
  }
  
  // 初始化Agora
  async initialize() {
    try {
      // 创建Agora客户端
      this.client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });
      
      // 注册事件监听
      this.client.on('user-joined', (user) => {
        console.log('用户加入语音通话:', user.uid);
      });
      
      this.client.on('user-left', (user) => {
        console.log('用户离开语音通话:', user.uid);
      });
      
      this.client.on('user-published', async (user, mediaType) => {
        if (mediaType === 'audio') {
          await this.client.subscribe(user, mediaType);
          const audioTrack = user.audioTrack;
          audioTrack.play();
        }
      });
      
      this.client.on('user-unpublished', (user) => {
        console.log('用户取消发布:', user.uid);
      });
      
      this.client.on('error', (error) => {
        console.error('Agora错误:', error);
      });
      
      this.isInitialized = true;
      console.log('Agora初始化成功');
      return true;
    } catch (error) {
      console.error('Agora初始化失败:', error);
      return false;
    }
  }
  
  // 加入语音频道
  async joinChannel(roomId, userId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      // 生成频道名称
      const channelName = `${config.agora.channelPrefix}${roomId}`;
      
      // 从后端获取App ID和Token
      let appId = config.agora.appId;
      let token = null;
      
      const baseUrl = config.serverUrl;
      
      try {
        const response = await fetch(`${baseUrl}/api/agora/app-id`);
        const appIdData = await response.json();
        if (appIdData.success) {
          appId = appIdData.appId;
          console.log('从后端获取App ID成功');
        }
      } catch (error) {
        console.warn('获取App ID失败，使用配置中的值:', error);
      }
      
      try {
        const tokenResponse = await fetch(`${baseUrl}/api/agora/generate-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            channelName: channelName,
            uid: parseInt(userId)
          })
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.success) {
          console.error('[Agora] Token生成失败:', tokenResponse.status, tokenData.error);
        }
        if (tokenData.success) {
          token = tokenData.token;
          console.log('Token生成成功');
          if (tokenData.message) {
            console.log('Token信息:', tokenData.message);
          }
        }
      } catch (error) {
        console.warn('Token请求失败，使用测试模式:', error);
        token = null;
      }
      
      // 加入频道
      await this.client.join(
        appId,
        channelName,
        token,
        parseInt(userId)
      );
      
      // 创建本地音频轨道
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      
      // 发布本地轨道
      await this.client.publish(this.localAudioTrack);
      
      this.isJoined = true;
      console.log('加入语音频道成功');
      return true;
    } catch (error) {
      console.error('加入语音频道失败:', error);
      return false;
    }
  }
  
  // 离开语音频道
  async leaveChannel() {
    if (this.isJoined && this.client) {
      try {
        await this.client.leave();
        this.isJoined = false;
        console.log('离开语音频道成功');
      } catch (error) {
        console.error('离开语音频道失败:', error);
      }
    }
  }
  
  // 切换麦克风
  async toggleMicrophone() {
    // 即使未连接，也更新本地状态，确保按钮能正常切换
    this.microphoneEnabled = !this.microphoneEnabled;
    console.log(`麦克风已${this.microphoneEnabled ? '开启' : '关闭'}`);
    
    if (!this.isJoined || !this.client || !this.localAudioTrack) {
      console.warn('[Agora] 语音未连接或无音频轨道，仅更新本地状态');
      return true;
    }
    
    try {
      await this.localAudioTrack.setEnabled(this.microphoneEnabled);
      console.log('麦克风状态已更新');
      return true;
    } catch (error) {
      console.error('切换麦克风失败:', error);
      // 即使出错，也保持本地状态的更新
      return true;
    }
  }
  
  // 切换扬声器
  toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;
    console.log(`扬声器已${this.speakerEnabled ? '开启' : '关闭'}`);
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