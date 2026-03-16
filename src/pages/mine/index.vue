<template>
  <view class="page">
    <!-- 用户信息 Header -->
    <view class="user-header">
      <view class="user-info" v-if="isLoggedIn">
        <image class="avatar" :src="userInfo?.avatar || '/static/images/avatar-default.svg'" mode="aspectFill" />
        <view class="user-detail">
          <text class="nickname">{{ userInfo.nickname || '房东' }}</text>
          <view class="phone-wrap">
            <text class="phone">{{ userInfo.phone || '点击绑定手机号' }}</text>
          </view>
        </view>
      </view>
      <view class="login-prompt" v-else @click="goToLogin">
        <image class="avatar" src="/static/images/avatar-default.svg" mode="aspectFill" />
        <view class="user-detail">
          <text class="nickname">点击登录</text>
          <text class="phone">登录后享受完整功能</text>
        </view>
        <uni-icons type="arrowright" size="18" color="rgba(255,255,255,0.7)"></uni-icons>
      </view>
    </view>

    <!-- 楼栋管理 -->
    <view class="section" v-if="isLoggedIn">
      <view class="section-header">
        <text class="section-title">楼栋管理</text>
        <text class="section-action" @click="goToBuildingManage">管理</text>
      </view>

      <view class="current-building" v-if="currentBuilding">
        <view class="building-icon-box">
          <uni-icons type="list" size="32" :color="'#1890FF'"></uni-icons>
        </view>
        <view class="building-info">
          <text class="building-name">{{ currentBuilding.name }}</text>
          <text class="building-address">{{ currentBuilding.address || '未设置地址' }}</text>
        </view>
        <view class="room-count-bubble">
          <text class="room-num">{{ currentBuilding.roomCount || 0 }}</text>
          <text class="room-unit">间</text>
        </view>
      </view>

      <view class="building-switch-list" v-if="buildings.length > 1">
        <text class="switch-section-title">切换楼栋</text>
        <view
          v-for="building in buildings"
          :key="building._id"
          :class="['switch-item', { active: building._id === currentBuildingId }]"
          @click="onSwitchChange(building)"
        >
          <text class="switch-name">{{ building.name }}</text>
          <uni-icons v-if="building._id === currentBuildingId" type="checkmarkempty" size="18" :color="'#1890FF'"></uni-icons>
        </view>
      </view>

      <view class="empty-building" v-if="buildings.length === 0">
        <text class="empty-text">您还没有添加楼栋</text>
        <button class="add-btn" @click="goToBuildingManage">添加楼栋</button>
      </view>
    </view>

    <!-- 功能菜单 -->
    <view class="menu-section">
      <view class="menu-item" @click="goToRoomManage" v-if="isLoggedIn">
        <view class="menu-icon-wrap primary">
          <uni-icons type="home" size="30" :color="'#1890FF'"></uni-icons>
        </view>
        <text class="menu-text">房间管理</text>
        <uni-icons type="arrowright" size="16" color="#C2CAD9"></uni-icons>
      </view>
      <view class="menu-divider" v-if="isLoggedIn"></view>
      <view class="menu-item" @click="generateRent" v-if="isLoggedIn">
        <view class="menu-icon-wrap warning">
          <uni-icons type="calendar" size="30" :color="'#FA8C16'"></uni-icons>
        </view>
        <text class="menu-text">生成本月租金</text>
        <uni-icons type="arrowright" size="16" color="#C2CAD9"></uni-icons>
      </view>
      <view class="menu-divider"></view>
      <view class="menu-item" @click="showAbout">
        <view class="menu-icon-wrap secondary">
          <uni-icons type="info" size="30" :color="'#6B7A99'"></uni-icons>
        </view>
        <text class="menu-text">关于我们</text>
        <uni-icons type="arrowright" size="16" color="#C2CAD9"></uni-icons>
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

.user-header {
  background: $primary-gradient;
  padding: 60rpx 32rpx 80rpx;
  border-radius: 0 0 40rpx 40rpx;
  margin-bottom: 40rpx;

  .user-info, .login-prompt {
    display: flex;
    align-items: center;
    gap: 24rpx;
  }

  .login-prompt {
    cursor: pointer;
    &:active { opacity: 0.8; }
  }

  .avatar {
    width: 140rpx;
    height: 140rpx;
    border-radius: 50%;
    border: 5rpx solid rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  .user-detail {
    flex: 1;

    .nickname {
      font-size: $font-size-xxl;
      font-weight: 700;
      color: #fff;
      display: block;
      margin-bottom: 10rpx;
    }

    .phone {
      font-size: $font-size-sm;
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.18);
      padding: 6rpx 20rpx;
      border-radius: $radius-full;
      display: inline-block;
    }
  }
}

.section {
  background: $bg-card;
  margin: -60rpx 32rpx 24rpx;
  border-radius: $radius-lg;
  padding: 32rpx;
  box-shadow: $shadow-md;
  position: relative;
  z-index: 1;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 28rpx;

    .section-title {
      font-size: $font-size-base;
      font-weight: 700;
      color: $text-main;
      padding-left: 18rpx;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        width: 6rpx;
        height: 30rpx;
        background: $primary-color;
        border-radius: $radius-full;
      }
    }

    .section-action {
      font-size: $font-size-sm;
      color: $primary-color;
      background: #E6F4FF;
      padding: 6rpx 20rpx;
      border-radius: $radius-full;
    }
  }
}

.current-building {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx;
  background: $bg-color;
  border-radius: $radius-md;
  border: 1rpx solid $border-color;

  .building-icon-box {
    width: 80rpx;
    height: 80rpx;
    background: #E6F4FF;
    border-radius: $radius-md;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .building-info {
    flex: 1;

    .building-name {
      font-size: $font-size-base;
      font-weight: 700;
      color: $text-main;
      display: block;
      margin-bottom: 4rpx;
    }

    .building-address {
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }

  .room-count-bubble {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #fff;
    border-radius: $radius-md;
    padding: 10rpx 20rpx;
    box-shadow: $shadow-sm;

    .room-num {
      font-size: $font-size-xxl;
      font-weight: 800;
      color: $primary-color;
      line-height: 1;
    }

    .room-unit {
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }
}

.building-switch-list {
  margin-top: 24rpx;
  border-top: 1rpx solid $border-color;
  padding-top: 20rpx;

  .switch-section-title {
    font-size: $font-size-xs;
    color: $text-placeholder;
    display: block;
    margin-bottom: 12rpx;
  }

  .switch-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18rpx 12rpx;
    border-radius: $radius-sm;
    transition: background 0.15s;

    &:active { background: $bg-color; }

    &.active {
      background: #E6F4FF;
      .switch-name { color: $primary-color; font-weight: 600; }
    }

    .switch-name {
      font-size: $font-size-base;
      color: $text-main;
    }
  }
}

.empty-building {
  text-align: center;
  padding: 32rpx 0 8rpx;

  .empty-text {
    font-size: $font-size-sm;
    color: $text-secondary;
    display: block;
    margin-bottom: 20rpx;
  }

  .add-btn {
    background: $primary-color;
    color: #fff;
    font-size: $font-size-sm;
    padding: 14rpx 48rpx;
    border-radius: $radius-full;
    border: none;
    box-shadow: $shadow-float;
    display: inline-block;
  }
}

.menu-section {
  background: $bg-card;
  margin: 0 32rpx 24rpx;
  border-radius: $radius-lg;
  box-shadow: $shadow-sm;
  overflow: hidden;

  .menu-item {
    display: flex;
    align-items: center;
    padding: 28rpx 32rpx;
    gap: 20rpx;
    transition: background 0.15s;

    &:active { background: $bg-color; }

    .menu-icon-wrap {
      width: 80rpx;
      height: 80rpx;
      border-radius: $radius-md;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      &.primary { background: #E6F4FF; }
      &.warning { background: #FFF7E6; }
      &.secondary { background: $bg-color; }
    }

    .menu-text {
      flex: 1;
      font-size: $font-size-base;
      color: $text-main;
      font-weight: 500;
    }
  }

  .menu-divider {
    height: 1rpx;
    background: $border-color;
    margin: 0 32rpx;
  }
}

.logout-section {
  padding: 0 32rpx;

  .logout-btn {
    width: 100%;
    height: 96rpx;
    background: #FFF1F0;
    color: $error-color;
    font-size: $font-size-base;
    font-weight: 600;
    border-radius: $radius-full;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;

    &:active { background: #FFE4E2; }
  }
}
</style>
