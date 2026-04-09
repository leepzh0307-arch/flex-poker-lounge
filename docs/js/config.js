// 配置文件
// 声网配置从后端动态获取，确保安全性

const config = {
  serverUrl: (function() {
    const host = window.location.host;
    if (host.includes('flex-poker-lounge')) {
      return 'https://api.' + host;
    }
    return 'https://flex-poker-backend.onrender.com';
  })(),

  agora: {
    appId: '', // 将从后端动态获取
    channelPrefix: 'flex-poker-',
  },

  game: {
    startingChips: 1000,
    smallBlind: 10,
    bigBlind: 20,
  },

  ui: {
    animationDuration: 300,
  },
};

// 从后端加载声网App ID
async function loadAgoraConfig() {
  try {
    const response = await fetch(`${config.serverUrl}/api/agora/app-id`);
    const data = await response.json();
    
    if (data.success && data.appId) {
      config.agora.appId = data.appId;
      console.log('[Config] 已从后端加载声网App ID');
    } else {
      console.warn('[Config] 无法加载声网App ID');
    }
  } catch (error) {
    console.error('[Config] 加载配置失败:', error);
  }
}

// 生成Token
async function generateAgoraToken(channelName, uid) {
  try {
    const response = await fetch(`${config.serverUrl}/api/agora/generate-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelName, uid }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('[Config] Token生成成功');
      return data.token;
    } else {
      console.error('[Config] Token生成失败:', data.error);
      return null;
    }
  } catch (error) {
    console.error('[Config] Token生成请求失败:', error);
    return null;
  }
}

// 页面加载时自动加载配置
loadAgoraConfig();

// 导出配置和函数
try { 
  module.exports = { config, loadAgoraConfig, generateAgoraToken }; 
} catch (e) { 
  window.config = config;
  window.loadAgoraConfig = loadAgoraConfig;
  window.generateAgoraToken = generateAgoraToken;
}
