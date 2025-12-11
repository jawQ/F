<template>
  <view class="page">
    <!-- 用户信息区域 -->
    <view class="user-section">
      <view class="user-info" v-if="isLoggedIn">
        <image 
          class="avatar" 
          :src="userInfo.avatar || '/static/images/avatar-default.png'" 
          mode="aspectFill"
        />
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '房东' }}</text>
          <text class="phone">{{ userInfo.phone || '点击绑定手机号' }}</text>
        </view>
      </view>
      <view class="login-prompt" v-else @click="goToLogin">
        <image class="avatar" src="/static/images/avatar-default.png" mode="aspectFill" />
        <view class="user-detail">
          <text class="nickname">点击登录</text>
          <text class="phone">登录后享受完整功能</text>
        </view>
      </view>
    </view>

    <!-- 楼栋管理区域 -->
    <view class="section" v-if="isLoggedIn">
      <view class="section-header">
        <text class="section-title">楼栋管理</text>
        <text class="section-action" @click="goToBuildingManage">管理</text>
      </view>
      
      <!-- 当前楼栋 -->
      <view class="current-building" v-if="currentBuilding">
        <view class="building-info">
          <text class="building-icon">🏢</text>
          <view class="building-detail">
            <text class="building-name">{{ currentBuilding.name }}</text>
            <text class="building-address">{{ currentBuilding.address || '未设置地址' }}</text>
          </view>
        </view>
        <text class="room-count">{{ currentBuilding.roomCount || 0 }}间房</text>
      </view>

      <!-- 楼栋切换列表 -->
      <view class="building-switch-list" v-if="buildings.length > 1">
        <text class="switch-title">切换楼栋</text>
        <view 
          v-for="building in buildings" 
          :key="building._id"
          class="switch-item"
        >
          <view class="switch-left">
            <text class="switch-name">{{ building.name }}</text>
          </view>
          <switch 
            :checked="building._id === currentBuildingId"
            color="#3B82F6"
            @change="onSwitchChange(building)"
          />
        </view>
      </view>

      <!-- 无楼栋提示 -->
      <view class="empty-building" v-if="buildings.length === 0">
        <text class="empty-text">您还没有添加楼栋</text>
        <button class="add-btn" @click="goToBuildingManage">添加楼栋</button>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-item" @click="goToRoomManage" v-if="isLoggedIn">
        <text class="menu-icon">🏠</text>
        <text class="menu-text">房间管理</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="generateRent" v-if="isLoggedIn">
        <text class="menu-icon">📝</text>
        <text class="menu-text">生成本月租金</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-text">关于我们</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="logout-section" v-if="isLoggedIn">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { callCloud } from '@/utils/cloud'

export default {
  setup() {
    const userStore = useUserStore()
    
    const buildings = ref([])
    
    // 计算属性
    const isLoggedIn = computed(() => userStore.isLoggedIn)
    const userInfo = computed(() => userStore.userInfo)
    const currentBuilding = computed(() => userStore.currentBuilding)
    const currentBuildingId = computed(() => userStore.currentBuildingId)
    
    // 获取楼栋列表
    const fetchBuildings = async () => {
      if (!isLoggedIn.value) return
      
      try {
        const result = await callCloud('building', {
          action: 'getList'
        }, { showLoading: false })
        
        if (result) {
          buildings.value = result.list || []
          if (result.currentBuilding) {
            userStore.switchBuilding(result.currentBuilding)
          }
          userStore.setBuildings(result.list || [])
        }
      } catch (error) {
        console.error('获取楼栋列表失败:', error)
      }
    }
    
    // 切换楼栋
    const onSwitchChange = async (building) => {
      if (building._id === currentBuildingId.value) return
      
      try {
        await callCloud('building', {
          action: 'switchBuilding',
          buildingId: building._id
        })
        
        userStore.switchBuilding(building)
        
        uni.showToast({
          title: `已切换到${building.name}`,
          icon: 'success'
        })
      } catch (error) {
        console.error('切换楼栋失败:', error)
      }
    }
    
    // 生成本月租金
    const generateRent = async () => {
      if (!currentBuildingId.value) {
        uni.showToast({ title: '请先添加楼栋', icon: 'none' })
        return
      }
      
      uni.showModal({
        title: '确认操作',
        content: '确定要为当前楼栋的所有房间生成本月租金记录吗？',
        success: async (res) => {
          if (res.confirm) {
            try {
              const result = await callCloud('rent', {
                action: 'generateMonthlyRent',
                buildingId: currentBuildingId.value
              })
              
              uni.showToast({
                title: result.message || '生成成功',
                icon: 'success'
              })
            } catch (error) {
              console.error('生成租金失败:', error)
            }
          }
        }
      })
    }
    
    // 页面跳转
    const goToLogin = () => {
      uni.navigateTo({ url: '/pages/login/index' })
    }
    
    const goToBuildingManage = () => {
      uni.navigateTo({ url: '/pages/building-manage/index' })
    }
    
    const goToRoomManage = () => {
      uni.showToast({ title: '功能开发中', icon: 'none' })
    }
    
    const showAbout = () => {
      uni.showModal({
        title: '房东助手',
        content: 'v1.0.0\n专为房东设计的租房管理工具',
        showCancel: false
      })
    }
    
    // 退出登录
    const handleLogout = () => {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            userStore.logout()
            buildings.value = []
            
            uni.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          }
        }
      })
    }
    
    onMounted(() => {
      userStore.restoreFromStorage()
      fetchBuildings()
    })
    
    // 页面显示时刷新
    uni.$on('buildingUpdated', () => {
      fetchBuildings()
    })
    
    return {
      buildings,
      isLoggedIn,
      userInfo,
      currentBuilding,
      currentBuildingId,
      onSwitchChange,
      generateRent,
      goToLogin,
      goToBuildingManage,
      goToRoomManage,
      showAbout,
      handleLogout
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: env(safe-area-inset-bottom);
}

.user-section {
  background: linear-gradient(135deg, #3B82F6 0%, #1E40AF 100%);
  padding: 60rpx 32rpx 80rpx;

  .user-info, .login-prompt {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 120rpx;
    height: 120rpx;
    border-radius: 60rpx;
    border: 4rpx solid rgba(255, 255, 255, 0.3);
  }

  .user-detail {
    margin-left: 28rpx;
    color: #fff;

    .nickname {
      font-size: 36rpx;
      font-weight: 600;
      display: block;
      margin-bottom: 8rpx;
    }

    .phone {
      font-size: 26rpx;
      opacity: 0.85;
    }
  }
}

.section {
  background: #fff;
  margin: -40rpx 24rpx 24rpx;
  border-radius: 24rpx;
  padding: 28rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.08);

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24rpx;

    .section-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #1f2937;
    }

    .section-action {
      font-size: 26rpx;
      color: #3B82F6;
    }
  }
}

.current-building {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx;
  background: #EFF6FF;
  border-radius: 16rpx;

  .building-info {
    display: flex;
    align-items: center;

    .building-icon {
      font-size: 40rpx;
      margin-right: 16rpx;
    }

    .building-detail {
      display: flex;
      flex-direction: column;

      .building-name {
        font-size: 30rpx;
        font-weight: 600;
        color: #1f2937;
      }

      .building-address {
        font-size: 24rpx;
        color: #6b7280;
        margin-top: 4rpx;
      }
    }
  }

  .room-count {
    font-size: 26rpx;
    color: #3B82F6;
    font-weight: 500;
  }
}

.building-switch-list {
  margin-top: 24rpx;

  .switch-title {
    font-size: 26rpx;
    color: #6b7280;
    margin-bottom: 16rpx;
    display: block;
  }

  .switch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    border-bottom: 1rpx solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    .switch-name {
      font-size: 28rpx;
      color: #1f2937;
    }
  }
}

.empty-building {
  text-align: center;
  padding: 40rpx 0;

  .empty-text {
    font-size: 28rpx;
    color: #9ca3af;
    margin-bottom: 24rpx;
    display: block;
  }

  .add-btn {
    display: inline-block;
    padding: 16rpx 48rpx;
    background: #3B82F6;
    color: #fff;
    font-size: 28rpx;
    border-radius: 40rpx;
    border: none;
  }
}

.menu-section {
  background: #fff;
  margin: 24rpx;
  border-radius: 24rpx;
  overflow: hidden;

  .menu-item {
    display: flex;
    align-items: center;
    padding: 32rpx 28rpx;
    border-bottom: 1rpx solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    &:active {
      background: #f9fafb;
    }

    .menu-icon {
      font-size: 36rpx;
      margin-right: 20rpx;
    }

    .menu-text {
      flex: 1;
      font-size: 30rpx;
      color: #1f2937;
    }

    .menu-arrow {
      font-size: 36rpx;
      color: #d1d5db;
    }
  }
}

.logout-section {
  padding: 48rpx 24rpx;

  .logout-btn {
    width: 100%;
    height: 88rpx;
    background: #fff;
    color: #EF4444;
    font-size: 30rpx;
    border: 1rpx solid #EF4444;
    border-radius: 44rpx;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
