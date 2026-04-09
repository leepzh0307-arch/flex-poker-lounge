const express = require('express');
const router = express.Router();
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');

// 从环境变量获取配置
const APP_ID = process.env.AGORA_APP_ID || 'ee244346e9ed4d49b277213d9a7783c6';
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || '';

// Token过期时间（秒）
const TOKEN_EXPIRATION_TIME = 3600; // 1小时

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

    if (!APP_CERTIFICATE) {
      console.warn('[Agora] 未配置App Certificate，返回空Token（仅用于测试）');
      return res.json({
        success: true,
        token: null,
        appId: APP_ID,
        message: '未配置App Certificate，使用测试模式'
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

    console.log(`[Agora] Token已生成: channel=${channelName}, uid=${uid}`);
    
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
      error: 'Token生成失败' 
    });
  }
});

// 获取App ID的路由（App ID可以公开）
router.get('/app-id', (req, res) => {
  res.json({
    success: true,
    appId: APP_ID
  });
});

module.exports = router;
