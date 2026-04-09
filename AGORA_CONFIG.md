# Flex Poker - 声网配置指南

## 概述

本项目使用声网（Agora）实现实时语音通话功能。为了确保安全性，我们采用了Token机制：

- **App ID**: 可以公开，用于标识应用
- **App Certificate**: 必须保密，用于生成Token
- **Token**: 动态生成，包含权限和过期时间

## 配置步骤

### 1. 获取声网凭证

1. 登录 [声网控制台](https://console.agora.io/)
2. 创建或选择项目
3. 在项目详情页获取：
   - **App ID**: 直接显示
   - **App Certificate**: 点击"查看"按钮获取

### 2. 配置Render环境变量

1. 登录 [Render控制台](https://dashboard.render.com/)
2. 选择你的后端服务（flex-poker-backend）
3. 点击 "Environment" 标签
4. 添加以下环境变量：

```
AGORA_APP_ID=你的App ID
AGORA_APP_CERTIFICATE=你的App Certificate
```

5. 点击 "Save Changes" 保存

### 3. 重新部署

Render会自动重新部署服务，应用新的环境变量。

## 安全说明

### 为什么这样设计？

1. **App ID可以公开**：
   - 声网官方文档明确说明App ID可以公开
   - App ID只是应用的标识符，不涉及安全问题

2. **App Certificate必须保密**：
   - App Certificate用于生成Token
   - 如果泄露，他人可以生成有效Token使用你的服务

3. **Token动态生成**：
   - 每次加入频道时生成新的Token
   - Token有过期时间（默认1小时）
   - 即使Token泄露，也会在短时间内失效

### 本项目的安全措施

- ✅ App Certificate存储在Render环境变量中，不会泄露到GitHub
- ✅ Token由后端动态生成，前端无法直接访问App Certificate
- ✅ Token有过期时间，定期刷新
- ✅ 所有敏感信息都不在代码库中

## 测试语音功能

1. 访问游戏页面
2. 创建或加入房间
3. 点击语音按钮开启语音
4. 浏览器会请求麦克风权限，请允许
5. 与其他玩家进行语音通话

## 故障排除

### 问题1：无法加入语音频道

**检查项**：
- 确认App ID和App Certificate配置正确
- 检查浏览器控制台是否有错误
- 确认浏览器允许麦克风权限

### 问题2：Token生成失败

**检查项**：
- 确认Render环境变量配置正确
- 检查后端日志是否有错误
- 确认App Certificate没有过期

### 问题3：语音质量差

**解决方案**：
- 检查网络连接
- 尝试切换网络环境
- 检查声网项目配额是否充足

## 开发模式

在本地开发时，如果不配置App Certificate，系统会使用测试模式（Token为null），仍然可以正常使用语音功能，但安全性较低。

**注意**：生产环境强烈建议配置App Certificate！

## 相关文档

- [声网官方文档](https://docs.agora.io/cn/)
- [Token生成指南](https://docs.agora.io/cn/Agora%20Platform/token)
- [Render环境变量配置](https://render.com/docs/environment-variables)
