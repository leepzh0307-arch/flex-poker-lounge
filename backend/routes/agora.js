const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

const APP_ID = process.env.AGORA_APP_ID || '';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

if (!APP_ID) {
  console.warn('[Agora] ⚠️  AGORA_APP_ID 环境变量未配置，语音功能将不可用');
}
if (!APP_CERTIFICATE) {
  console.warn('[Agora] ⚠️  AGORA_APP_CERTIFICATE 环境变量未配置，将使用测试模式（不安全）');
}

const TOKEN_EXPIRATION_TIME = 3600;

// 生成Token的路由
router.post('/generate-token', (req, res) => {
  try {
    const { channelName, uid } = req.body;
    
    if (!channelName || !uid) {
      return res.status(400).json({ 
        success: false, 
        error: '缺少必要参数: channelName 或 uid' 
      });
    }

    if (!APP_ID) {
      return res.status(500).json({
        success: false,
        error: 'App ID未配置，请在Render环境变量中设置AGORA_APP_ID'
      });
    }

    if (!APP_CERTIFICATE) {
      console.warn('[Agora] 未配置App Certificate，返回空Token（仅用于测试）');
      return res.json({
        success: true,
        token: null,
        appId: APP_ID,
        message: '未配置App Certificate，使用测试模式'
      });
    }

    // 验证参数格式
    if (typeof channelName !== 'string' || channelName.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'channelName 必须是非空字符串'
      });
    }

    if (isNaN(parseInt(uid))) {
      return res.status(400).json({
        success: false,
        error: 'uid 必须是数字'
      });
    }

    // 计算过期时间
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRATION_TIME;

    // 生成Token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      parseInt(uid),
      RtcRole.ROLE_PUBLISHER,
      privilegeExpiredTs
    );

    console.log(`[Agora] Token已生成: channel=${channelName}, uid=${uid}, expiresAt=${privilegeExpiredTs}`);
    
    res.json({
      success: true,
      token: token,
      appId: APP_ID,
      expiresAt: privilegeExpiredTs
    });

  } catch (error) {
    console.error('[Agora] Token生成失败:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Token生成失败',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// 获取App ID的路由（App ID可以公开）
router.get('/app-id', (req, res) => {
  try {
    if (!APP_ID) {
      return res.status(500).json({
        success: false,
        error: 'App ID未配置'
      });
    }
    
    res.json({
      success: true,
      appId: APP_ID
    });
  } catch (error) {
    console.error('[Agora] 获取App ID失败:', error);
    res.status(500).json({
      success: false,
      error: '获取App ID失败'
    });
  }
});

module.exports = router;
