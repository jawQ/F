# 房东助手微信小程序

> 专为房东设计的租房管理微信小程序，支持待缴房租提醒、多楼栋切换管理等核心功能。

## 技术栈

- **前端框架**: UniApp (Vue 3)
- **状态管理**: Pinia
- **后端**: 微信云开发
- **UI**: 自定义组件 + uni-ui

## 项目结构

```
f/
├── cloudfunctions/           # 云函数
│   ├── login/               # 登录
│   ├── sendSmsCode/         # 短信验证码
│   ├── room/                # 房间管理
│   ├── building/            # 楼栋管理
│   └── rent/                # 租金管理
├── src/                     # 前端源码
│   ├── pages/              # 页面
│   ├── store/              # 状态管理
│   ├── utils/              # 工具函数
│   └── static/             # 静态资源
├── project.config.json      # 小程序配置
└── package.json
```

## 快速开始

### 1. 环境准备

- Node.js >= 16
- 微信开发者工具
- 微信小程序 AppID

### 2. 安装依赖

```bash
cd f
npm install
```

### 3. 配置 AppID

1. 编辑 `src/manifest.json`，将 `mp-weixin.appid` 改为你的 AppID
2. 编辑 `project.config.json`，将 `appid` 改为你的 AppID

### 4. 开通云开发

1. 使用微信开发者工具打开项目
2. 点击「云开发」按钮，开通云开发环境
3. 记录你的环境 ID（如 `cloud1-xxx`）
4. 编辑 `src/utils/cloud.js`，将 `ENV_ID` 改为你的环境 ID
5. 编辑 `src/App.vue`，将云开发初始化的 `env` 改为你的环境 ID

### 5. 初始化数据库

在云开发控制台创建以下集合：

| 集合名 | 说明 |
|--------|------|
| `users` | 用户表 |
| `buildings` | 楼栋表 |
| `rooms` | 房间表 |
| `rentRecords` | 租金记录表 |
| `smsCode` | 验证码记录表 |

### 6. 部署云函数

在微信开发者工具中：

1. 右键点击 `cloudfunctions` 目录下的每个云函数文件夹
2. 选择「上传并部署：云端安装依赖」

### 7. 运行项目

```bash
# 开发模式
npm run dev:mp-weixin
```

然后在微信开发者工具中导入 `dist/dev/mp-weixin` 目录。

## 功能模块

### 首页
- 展示七天内待缴房租的房间列表
- 支持下拉刷新
- 支持楼栋切换

### 房间详情
- 查看租客信息
- 查看租约信息
- 查看缴费历史
- 标记已缴费

### 我的
- 微信一键登录
- 手机号验证码登录
- 楼栋管理（添加/编辑/删除/切换）

## 短信验证码配置（可选）

如需使用手机号验证码登录功能：

1. 在腾讯云开通短信服务
2. 创建短信签名和模板
3. 编辑 `cloudfunctions/sendSmsCode/index.js`，配置：
   - `secretId`: 腾讯云 SecretId
   - `secretKey`: 腾讯云 SecretKey
   - `smsSdkAppId`: 短信应用 SDK AppID
   - `signName`: 短信签名
   - `templateId`: 短信模板 ID

## 注意事项

1. 首次使用需要添加楼栋才能查看待缴房租
2. 添加房间需要在「我的」>「房间管理」中操作（功能开发中）
3. 租金记录需要手动生成或配置定时触发器自动生成

## License

MIT
