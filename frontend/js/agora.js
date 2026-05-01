class AgoraVoice {
  constructor() {
    this.client = null;
    this.isInitialized = false;
    this.isJoined = false;
    this.microphoneEnabled = true;
    this.speakerEnabled = true;
    this.localAudioTrack = null;
    this._sdkLoadPromise = null;
  }

  _loadSDK() {
    if (typeof AgoraRTC !== 'undefined') {
      return Promise.resolve();
    }
    if (this._sdkLoadPromise) {
      return this._sdkLoadPromise;
    }
    this._sdkLoadPromise = new Promise(function(resolve) {
      var s = document.createElement('script');
      s.src = 'https://download.agora.io/sdk/release/AgoraRTC_N.js';
      s.onload = function() { resolve(); };
      s.onerror = function() {
        console.warn('Agora SDK 加载失败');
        resolve();
      };
      document.head.appendChild(s);
    });
    return this._sdkLoadPromise;
  }

  async initialize() {
    try {
      await this._loadSDK();
      if (typeof AgoraRTC === 'undefined') {
        console.warn('Agora SDK 不可用，语音功能将不可用');
        return false;
      }

      this.client = AgoraRTC.createClient({
        mode: 'rtc',
        codec: 'vp8'
      });

      this.client.on('user-joined', function(user) {
        console.log('用户加入语音通话:', user.uid);
      });

      this.client.on('user-left', function(user) {
        console.log('用户离开语音通话:', user.uid);
      });

      var self = this;
      this.client.on('user-published', async function(user, mediaType) {
        if (mediaType === 'audio') {
          await self.client.subscribe(user, mediaType);
          var audioTrack = user.audioTrack;
          audioTrack.play();
        }
      });

      this.client.on('user-unpublished', function(user) {
        console.log('用户取消发布:', user.uid);
      });

      this.client.on('error', function(error) {
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

  async joinChannel(roomId, userId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    if (!this.isInitialized) return false;

    try {
      var channelName = config.agora.channelPrefix + roomId;

      var appId = config.agora.appId;
      var token = null;

      var baseUrl = config.serverUrl;

      try {
        var response = await fetch(baseUrl + '/api/agora/app-id');
        var appIdData = await response.json();
        if (appIdData.success) {
          appId = appIdData.appId;
          console.log('从后端获取App ID成功');
        }
      } catch (error) {
        console.warn('获取App ID失败，使用配置中的值:', error);
      }

      try {
        var tokenResponse = await fetch(baseUrl + '/api/agora/generate-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelName: channelName, uid: parseInt(userId) })
        });
        var tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || !tokenData.success) {
          console.error('[Agora] Token生成失败:', tokenResponse.status, tokenData.error);
        }
        if (tokenData.success) {
          token = tokenData.token;
          console.log('Token生成成功');
        }
      } catch (error) {
        console.warn('Token请求失败，使用测试模式:', error);
        token = null;
      }

      await this.client.join(appId, channelName, token, parseInt(userId));

      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();

      await this.client.publish(this.localAudioTrack);

      this.isJoined = true;
      console.log('加入语音频道成功');
      return true;
    } catch (error) {
      console.error('加入语音频道失败:', error);
      return false;
    }
  }

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

  async toggleMicrophone() {
    this.microphoneEnabled = !this.microphoneEnabled;
    console.log('麦克风已' + (this.microphoneEnabled ? '开启' : '关闭'));

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
      return true;
    }
  }

  toggleSpeaker() {
    this.speakerEnabled = !this.speakerEnabled;
    console.log('扬声器已' + (this.speakerEnabled ? '开启' : '关闭'));
  }

  isMicrophoneEnabled() {
    return this.microphoneEnabled;
  }

  isSpeakerEnabled() {
    return this.speakerEnabled;
  }

  isConnected() {
    return this.isJoined;
  }
}

var agoraVoice = new AgoraVoice();

try {
  module.exports = agoraVoice;
} catch (e) {
  window.agoraVoice = agoraVoice;
}
