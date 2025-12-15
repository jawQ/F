<template>
  <view class="app">
    <!-- 全局状态由 Pinia 管理 -->
  </view>
</template>

<script>
export default {
  onLaunch() {
    console.log('App Launch')
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: import.meta.env.VITE_WX_ENV_ID,
        traceUser: true
      })
    }
    
    // 检查登录态
    this.checkLogin()
  },
  
  onShow() {
    console.log('App Show')
  },
  
  onHide() {
    console.log('App Hide')
  },
  
  methods: {
    // 检查登录态
    checkLogin() {
      const token = uni.getStorageSync('token')
      const userInfo = uni.getStorageSync('userInfo')
      
      if (token && userInfo) {
        // 已登录，更新 store
        const store = getApp().globalData?.store
        if (store) {
          store.setUserInfo(userInfo)
          store.setToken(token)
        }
      }
    }
  },
  
  globalData: {
    store: null
  }
}
</script>

<style lang="scss">
/* 全局样式 */

page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  font-size: 28rpx;
  color: #333;
  box-sizing: border-box;
}

view, text, button, input, image {
  box-sizing: border-box;
}

/* 清除按钮默认样式 */
button {
  margin: 0;
  padding: 0;
  background: none;
  border: none;
  outline: none;
}

button::after {
  border: none;
}

/* 安全区域 */
.safe-area-bottom {
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
