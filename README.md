# Flex Poker - 灵活扑克网页游戏

## 项目介绍
Flex Poker是一个基于Web的德州扑克游戏，支持多人联机对战，房主可自定义游戏规则。

## 技术栈
- 前端：纯HTML5+CSS3+原生JavaScript（ES6+）
- 后端：Node.js + Express + Socket.io
- 语音：声网Agora Web SDK

## 目录结构
```
flex-poker/
├── frontend/ # 前端页面
│ ├── index.html # 首页（昵称 + 房间号输入）
│ ├── room.html # 游戏房间页
│ ├── css/
│ │ ├── themes/ # 视觉主题
│ │ │ └── default.css # 默认主题
│ │ ├── common.css # 通用布局
│ │ ├── index.css # 首页专属布局
│ │ └── room.css # 房间页专属布局
│ ├── js/
│ │ ├── config.js # 全局配置
│ │ ├── socket.js # 联机功能封装
│ │ ├── agora.js # 语音功能封装
│ │ ├── index.js # 首页逻辑
│ │ └── room/ # 房间页分模块逻辑
│ │ ├── ui.js # 页面更新
│ │ ├── game.js # 游戏状态管理
│ │ └── rules/ # 游戏规则模块
│ │ ├── texas.js # 德州扑克默认规则
│ │ └── custom.js # 房主自定义规则
│ └── assets/ # 图片 / 音效资源
├── backend/ # 后端
│ ├── server.js # 程序入口
│ ├── socket/ # Socket处理
│ │ ├── handlers/ # 功能分模块
│ │ │ ├── room.js # 房间创建 / 加入
│ │ │ ├── game.js # 游戏流程控制
│ │ │ └── voice.js # 语音房间管理
│ │ └── index.js # 联机功能初始化
│ └── utils/ # 工具函数
│ ├── deck.js # 扑克牌生成 / 洗牌逻辑
│ └── rules.js # 规则合法性校验
└── README.md # 部署说明
```

## 快速开始

### 1. 安装依赖
```bash
# 进入后端目录
cd backend

# 安装依赖
npm install
```

### 2. 配置声网（可选）

本项目使用声网实现实时语音通话功能。详细配置请参考 [AGORA_CONFIG.md](./AGORA_CONFIG.md)。

**快速配置**：
1. 在Render后端服务中添加环境变量：
   - `AGORA_APP_ID`: 你的声网App ID
   - `AGORA_APP_CERTIFICATE`: 你的声网App Certificate（可选，用于生产环境）

2. 如果不配置，语音功能仍可使用测试模式

### 3. 启动服务器
```bash
# 启动后端服务器
npm start
```

### 4. 访问游戏
打开浏览器，访问 `http://localhost:8080/frontend/index.html`

## 功能特性
- 房间创建/加入/退出
- 实时联机，所有玩家的游戏状态实时同步
- 德州扑克完整玩法（发牌、下注、弃牌、结算）
- 房主专属面板：可自定义发牌顺序、发牌数量、公共牌/玩家牌分配
- 在线实时语音通话，可开关麦克风/扬声器
- 响应式设计，支持电脑和手机

## 游戏规则
- 支持2-9人游戏
- 标准德州扑克规则
- 房主可自定义规则

## 部署说明
- 前端：可部署到Vercel、Netlify等静态托管服务
- 后端：可部署到Render、Heroku等云服务

## 注意事项
- 语音功能默认使用测试模式，生产环境建议配置App Certificate
- 声网App ID和App Certificate应通过环境变量配置，不要硬编码在代码中
- 详细配置说明请参考 [AGORA_CONFIG.md](./AGORA_CONFIG.md)

## 许可证
MIT