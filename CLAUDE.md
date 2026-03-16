# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

房东租房管理微信小程序，支持多楼栋切换、待缴房租提醒、房间 CRUD 等功能。

**技术栈**: Vue 3 + UniApp + Pinia + 微信云开发（云函数 + 云数据库）
**包管理**: pnpm
**构建工具**: Vite + @dcloudio/vite-plugin-uni

## 常用命令

```bash
# 开发（自动同步 AppID 配置后编译到 dist/dev/mp-weixin/）
pnpm dev:mp-weixin

# 生产构建
pnpm build:mp-weixin

# 单独同步 .env 到 project.config.json 和 manifest.json
node scripts/update-config.js
```

构建产物在 `dist/dev/mp-weixin/`，需在微信开发者工具中打开该目录预览/调试。

无测试框架，无 lint 配置。

## 架构要点

### 前端与云函数分离

- `src/` — 前端页面代码，编译为小程序
- `cloudfunctions/` — 后端云函数（Node.js），每个目录一个云函数，独立部署到微信云开发

### 云函数调用模式

所有云函数通过 `src/utils/cloud.js` 中的 `callCloud(name, data, options)` 统一调用：

- 自动注入 token（登录接口除外）
- 自动 loading 显示/隐藏
- 统一错误处理，自动 toast 提示
- token 过期自动跳登录页

云函数返回格式统一为 `{ code: 0, data: {...}, message: '...' }`，`code !== 0` 视为错误。

### 状态管理（Pinia）

`src/store/user.js` 是唯一的 Store，管理登录态、用户信息、楼栋列表、当前楼栋。
应用启动时（`App.vue` → `checkLogin()`）从 `uni.getStorageSync` 恢复状态。

状态持久化约定：
```javascript
uni.setStorageSync('token', token)
uni.setStorageSync('userInfo', userInfo)
uni.setStorageSync('currentBuilding', building)
```

### 页面路由

TabBar 页面（用 `uni.switchTab` 导航）：
- `pages/index/index` — 首页：待缴房租列表、楼栋切换
- `pages/mine/index` — 我的：用户信息、楼栋管理入口

普通页面（用 `uni.navigateTo` 导航）：
- `pages/login/index` — 登录
- `pages/building-manage/index` — 楼栋管理
- `pages/room-manage/index` — 房间管理（按楼栋）
- `pages/room-detail/index` — 房间详情

### 数据库集合

| 集合 | 说明 |
|------|------|
| `users` | 用户，含 buildings[]、currentBuilding |
| `buildings` | 楼栋，含 userId |
| `rooms` | 房间，含 buildingId、tenant{}、monthlyRent |
| `rentRecords` | 租金记录，status: `pending` / `paid` / `overdue` |
| `smsCode` | 短信验证码，含 expiresAt |

### 环境变量

`.env` 中的 `VITE_WX_APPID` 和 `VITE_WX_ENV_ID` 由 `scripts/update-config.js` 同步写入 `manifest.json` 和 `project.config.json`，每次构建自动执行，勿手动修改这两个文件的 AppID/EnvID 字段。

### 全局样式变量

所有页面自动导入 `src/uni.scss`，直接使用以下变量：

```scss
$primary-color: #4f46e5;   // 主色
$success-color: #10B981;   // 已缴/成功
$warning-color: #F59E0B;   // 待缴/警告
$error-color: #EF4444;     // 逾期/错误
$text-main / $text-secondary / $bg-color
$spacing-xs/sm/md/lg       // 8/16/24/32 rpx
$radius-sm/md/lg           // 12/24/32 rpx
```
