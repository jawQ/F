<template>
  <view class="page">
    <!-- 用户信息区域 -->
    <view class="user-section">
      <view class="user-info" v-if="isLoggedIn">
        <image 
          class="avatar" 
          :src="userInfo?.avatar || '/static/images/avatar-default.svg'" 
          mode="aspectFill"
        />
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '房东' }}</text>
          <text class="phone">{{ userInfo.phone || '点击绑定手机号' }}</text>
        </view>
      </view>
      <view class="login-prompt" v-else @click="goToLogin">
        <image class="avatar" src="/static/images/avatar-default.svg" mode="aspectFill" />
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
      </view>
      <view class="menu-item" @click="generateRent" v-if="isLoggedIn">
        <text class="menu-icon">📝</text>
        <text class="menu-text">生成本月租金</text>
      </view>
      <view class="menu-item" @click="showAbout">
        <text class="menu-icon">ℹ️</text>
        <text class="menu-text">关于我们</text>
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
      console.log('Navigating to room manage, buildingId:', currentBuildingId.value)
      if (!currentBuildingId.value) {
        uni.showToast({ title: '请先添加或选择楼栋', icon: 'none' })
        return
      }
      
      const name = currentBuilding.value?.name || '房间管理'
      uni.navigateTo({ 
        url: `/pages/room-manage/index?buildingId=${currentBuildingId.value}&buildingName=${name}` 
      })
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
  background: $bg-color;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.user-section {
  background: $primary-gradient;
  padding: 60rpx 40rpx 100rpx;
  border-radius: 0 0 $radius-lg $radius-lg;
  margin-bottom: 40rpx;

  .user-info, .login-prompt {
    display: flex;
    align-items: center;
  }

  .avatar {
    width: 140rpx;
    height: 140rpx;
    border-radius: $radius-full;
    border: 6rpx solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.1);
  }

  .user-detail {
    margin-left: 32rpx;
    color: #fff;

    .nickname {
      font-size: 40rpx;
      font-weight: 700;
      display: block;
      margin-bottom: 12rpx;
      text-shadow: 0 2rpx 4rpx rgba(0,0,0,0.1);
    }

    .phone {
      font-size: $font-size-sm;
      opacity: 0.9;
      background: rgba(255, 255, 255, 0.2);
      padding: 4rpx 16rpx;
      border-radius: $radius-full;
    }
  }
}

.section {
  background: $bg-white;
  margin: -80rpx 32rpx 32rpx;
  border-radius: $radius-lg;
  padding: 32rpx;
  box-shadow: $shadow-md;
  position: relative;
  z-index: 1;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32rpx;

    .section-title {
      font-size: $font-size-lg;
      font-weight: 700;
      color: $text-main;
      position: relative;
      padding-left: 20rpx;
      
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 8rpx;
        height: 32rpx;
        background: $primary-color;
        border-radius: $radius-full;
      }
    }

    .section-action {
      font-size: $font-size-sm;
      color: $primary-color;
      font-weight: 500;
      background: rgba($primary-color, 0.1);
      padding: 6rpx 20rpx;
      border-radius: $radius-full;
    }
  }
}

.current-building {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  background: $bg-color;
  border-radius: $radius-md;
  border: 1rpx solid $border-color;

  .building-info {
    display: flex;
    align-items: center;

    .building-icon {
      font-size: 48rpx;
      margin-right: 20rpx;
      background: #fff;
      width: 80rpx;
      height: 80rpx;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: $radius-sm;
    }

    .building-detail {
      display: flex;
      flex-direction: column;

      .building-name {
        font-size: $font-size-base;
        font-weight: 700;
        color: $text-main;
        margin-bottom: 4rpx;
      }

      .building-address {
        font-size: $font-size-xs;
        color: $text-secondary;
      }
    }
  }

  .room-count {
    font-size: $font-size-xs;
    color: $primary-color;
    font-weight: 600;
    background: #fff;
    padding: 6rpx 16rpx;
    border-radius: $radius-full;
    box-shadow: $shadow-sm;
  }
}

.building-switch-list {
  margin-top: 32rpx;
  border-top: 1rpx solid $border-color;
  padding-top: 24rpx;

  .switch-title {
    font-size: $font-size-xs;
    color: $text-placeholder;
    margin-bottom: 20rpx;
    display: block;
    font-weight: 500;
  }

  .switch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20rpx 0;
    
    .switch-name {
      font-size: $font-size-base;
      color: $text-main;
      font-weight: 500;
    }
  }
}

.empty-building {
  text-align: center;
  padding: 40rpx 0;

  .empty-text {
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: 24rpx;
    display: block;
  }

  .add-btn {
    display: inline-block;
    padding: 16rpx 48rpx;
    background: $primary-color;
    color: #fff;
    font-size: $font-size-sm;
    border-radius: $radius-full;
    border: none;
    box-shadow: $shadow-float;
  }
}

.menu-section {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
  padding: 0 32rpx;
  margin-bottom: 40rpx;

  .menu-item {
    background: $bg-white;
    border-radius: $radius-md;
    padding: 32rpx 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: $shadow-sm;
    transition: all 0.2s;
    
    &:active {
      transform: scale(0.96);
      box-shadow: none;
    }

    .menu-icon {
      font-size: 56rpx;
      margin-bottom: 16rpx;
    }

    .menu-text {
      font-size: $font-size-sm;
      color: $text-main;
      font-weight: 500;
    }
  }
}

.logout-section {
  padding: 0 48rpx;

  .logout-btn {
    width: 100%;
    height: 96rpx;
    background: rgba($error-color, 0.05);
    color: $error-color;
    font-size: $font-size-base;
    font-weight: 600;
    border-radius: $radius-full;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    
    &:active {
      background: rgba($error-color, 0.1);
    }
  }
}
</style>
