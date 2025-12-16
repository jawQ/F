<template>
  <view class="page">
    <!-- 顶部楼栋切换 -->
    <view class="header">
      <view class="building-selector" @click="showBuildingPicker = true">
        <text class="building-name">{{ currentBuildingName }}</text>
        <text class="iconfont icon-arrow-down"></text>
      </view>
      <view class="date-info">
        <text class="date">{{ today }}</text>
        <text class="tips">七天内待缴房租</text>
      </view>
    </view>

    <!-- 待缴房租列表 -->
    <scroll-view 
      class="room-list"
      scroll-y
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 空状态 -->
      <view v-if="!loading && roomList.length === 0" class="empty-state">
        <image class="empty-icon" src="/static/icons/empty.svg" mode="aspectFit" />
        <text class="empty-text">暂无待缴房租</text>
        <text class="empty-tips">七天内没有需要缴纳房租的房间</text>
      </view>

      <!-- 房间卡片列表 -->
      <view 
        v-for="room in roomList" 
        :key="room.recordId"
        class="room-card"
        @click="goToDetail(room)"
      >
        <image 
          class="room-image" 
          :src="room.roomImage || '/static/images/room-default.svg'" 
          mode="aspectFill"
        />
        <view class="room-info">
          <view class="room-header">
            <text class="room-number">{{ room.roomNumber }}</text>
            <view :class="['status-tag', room.status]">
              {{ getStatusText(room.status) }}
            </view>
          </view>
          <text class="tenant-name">租客：{{ room.tenantName || '空置' }}</text>
          <view class="rent-info">
            <text class="amount">¥{{ room.amount }}</text>
            <text class="due-date">{{ formatDueDate(room.dueDate) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 楼栋选择弹窗 -->
    <uni-popup ref="buildingPopup" type="bottom">
      <view class="building-popup">
        <view class="popup-header">
          <text class="popup-title">选择楼栋</text>
          <text class="popup-close" @click="closeBuildingPicker">×</text>
        </view>
        <scroll-view class="building-list" scroll-y>
          <view 
            v-for="building in buildings" 
            :key="building._id"
            :class="['building-item', { active: building._id === currentBuildingId }]"
            @click="selectBuilding(building)"
          >
            <text class="building-item-name">{{ building.name }}</text>
            <text v-if="building.roomCount" class="building-room-count">{{ building.roomCount }}间房</text>
            <view v-if="building._id === currentBuildingId" class="check-icon">✓</view>
          </view>
        </scroll-view>
      </view>
    </uni-popup>

    <!-- 悬浮入口 -->
    <view class="floating-btn" @click="goToRoomManage" v-if="currentBuildingId">
      <text class="floating-icon">🏠</text>
      <text class="floating-text">管理</text>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading">
      <text>加载中...</text>
    </view>
  </view>
</template>

<script>
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/store/user'
import { callCloud } from '@/utils/cloud'
import { formatDate, getRelativeTime } from '@/utils/date'

export default {
  setup() {
    const userStore = useUserStore()
    
    // 响应式数据
    const loading = ref(false)
    const isRefreshing = ref(false)
    const roomList = ref([])
    const buildings = ref([])
    const showBuildingPicker = ref(false)
    const buildingPopup = ref(null)
    
    // 计算属性
    const currentBuildingId = computed(() => userStore.currentBuildingId)
    const currentBuildingName = computed(() => userStore.currentBuildingName)
    const today = computed(() => formatDate(new Date(), 'MM月DD日'))
    
    // 获取待缴房租列表
    const fetchPendingRent = async () => {
      if (!currentBuildingId.value) {
        roomList.value = []
        return
      }
      
      loading.value = true
      try {
        const result = await callCloud('room', {
          action: 'getPendingRent',
          buildingId: currentBuildingId.value
        }, { showLoading: false })
        
        roomList.value = result || []
      } catch (error) {
        console.error('获取待缴房租失败:', error)
        roomList.value = []
      } finally {
        loading.value = false
      }
    }
    
    // 获取楼栋列表
    const fetchBuildings = async () => {
      try {
        const result = await callCloud('building', {
          action: 'getList'
        }, { showLoading: false })
        
        if (result) {
          buildings.value = result.list || []
          if (result.currentBuilding) {
            userStore.switchBuilding(result.currentBuilding)
          }
          if (result.list) {
            userStore.setBuildings(result.list)
          }
        }
      } catch (error) {
        console.error('获取楼栋列表失败:', error)
      }
    }
    
    // 下拉刷新
    const onRefresh = async () => {
      isRefreshing.value = true
      await fetchPendingRent()
      isRefreshing.value = false
    }
    
    // 跳转到详情页
    const goToDetail = (room) => {
      uni.navigateTo({
        url: `/pages/room-detail/index?roomId=${room.roomId}&recordId=${room.recordId}`
      })
    }
    
    // 选择楼栋
    const selectBuilding = async (building) => {
      if (building._id === currentBuildingId.value) {
        closeBuildingPicker()
        return
      }
      
      try {
        await callCloud('building', {
          action: 'switchBuilding',
          buildingId: building._id
        })
        
        userStore.switchBuilding(building)
        closeBuildingPicker()
        
        // 重新加载数据
        await fetchPendingRent()
      } catch (error) {
        console.error('切换楼栋失败:', error)
      }
    }
    
    const closeBuildingPicker = () => {
      showBuildingPicker.value = false
      if (buildingPopup.value) {
        buildingPopup.value.close()
      }
    }
    
    const formatDueDate = (date) => {
      return getRelativeTime(date)
    }
    
    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待缴',
        overdue: '已逾期',
        paid: '已缴'
      }
      return statusMap[status] || status
    }
    
    // 跳转到房间管理
    const goToRoomManage = () => {
      if (!currentBuildingId.value) {
        uni.showToast({ title: '请先选择楼栋', icon: 'none' })
        return
      }
      
      uni.navigateTo({
        url: `/pages/room-manage/index?buildingId=${currentBuildingId.value}&buildingName=${currentBuildingName.value}`
      })
    }
    
    // 页面加载
    onMounted(async () => {
      // 先恢复用户状态
      userStore.restoreFromStorage()
      
      // 获取楼栋列表
      await fetchBuildings()
      
      // 获取待缴房租
      await fetchPendingRent()
    })
    
    return {
      loading,
      isRefreshing,
      roomList,
      buildings,
      showBuildingPicker,
      buildingPopup,
      currentBuildingId,
      currentBuildingName,
      today,
      onRefresh,
      goToDetail,
      selectBuilding,
      closeBuildingPicker,
      formatDueDate,
      getStatusText,
      goToRoomManage
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $bg-color;
  padding-bottom: env(safe-area-inset-bottom);
}

.header {
  padding: 40rpx 32rpx 80rpx;
  background: $primary-gradient;
  border-radius: 0 0 $radius-lg $radius-lg;
  color: #fff;
  position: relative;
  z-index: 1;

  .building-selector {
    display: inline-flex;
    align-items: center;
    padding: 12rpx 24rpx;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(10px);
    border-radius: $radius-full;
    margin-bottom: 32rpx;
    border: 1rpx solid rgba(255, 255, 255, 0.2);

    .building-name {
      font-size: $font-size-base;
      font-weight: 600;
      margin-right: 12rpx;
    }
    
    .iconfont {
      font-size: $font-size-sm;
      opacity: 0.8;
    }
    
    &:active {
      background: rgba(255, 255, 255, 0.25);
    }
  }

  .date-info {
    .date {
      font-size: 56rpx;
      font-weight: 700;
      display: block;
      margin-bottom: 12rpx;
      letter-spacing: 1rpx;
    }

    .tips {
      font-size: $font-size-base;
      opacity: 0.9;
    }
  }
}

.room-list {
  min-height: calc(100vh - 360rpx);
  margin-top: -40rpx;
  padding: 0 32rpx 32rpx;
  position: relative;
  z-index: 2;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 160rpx 0;

  .empty-icon {
    width: 240rpx;
    height: 240rpx;
    margin-bottom: 32rpx;
    opacity: 0.8;
  }

  .empty-text {
    font-size: $font-size-lg;
    color: $text-secondary;
    margin-bottom: 16rpx;
    font-weight: 600;
  }

  .empty-tips {
    font-size: $font-size-sm;
    color: $text-placeholder;
  }
}

.room-card {
  display: flex;
  background: $bg-white;
  border-radius: $radius-md;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;
  transition: all 0.2s ease;
  
  &:active {
    transform: scale(0.98);
    box-shadow: none;
  }

  .room-image {
    width: 180rpx;
    height: 180rpx;
    border-radius: $radius-sm;
    flex-shrink: 0;
    background: $bg-color;
  }

  .room-info {
    flex: 1;
    margin-left: 24rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4rpx 0;

    .room-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;

      .room-number {
        font-size: $font-size-lg;
        font-weight: 700;
        color: $text-main;
      }

      .status-tag {
        font-size: $font-size-xs;
        padding: 6rpx 16rpx;
        border-radius: $radius-full;
        font-weight: 500;

        &.pending {
          background: rgba($warning-color, 0.1);
          color: $warning-color;
        }

        &.overdue {
          background: rgba($error-color, 0.1);
          color: $error-color;
        }

        &.paid {
          background: rgba($success-color, 0.1);
          color: $success-color;
        }
      }
    }

    .tenant-name {
      font-size: $font-size-sm;
      color: $text-secondary;
      margin-top: 8rpx;
    }

    .rent-info {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;

      .amount {
        font-size: 40rpx;
        font-weight: 700;
        color: $primary-color;
        
        &::before {
          content: '¥';
          font-size: $font-size-sm;
          margin-right: 4rpx;
          font-weight: 500;
        }
      }

      .due-date {
        font-size: $font-size-xs;
        color: $text-placeholder;
        margin-bottom: 8rpx;
      }
    }
  }
}

.building-popup {
  background: $bg-white;
  border-radius: $radius-lg $radius-lg 0 0;
  max-height: 70vh;

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx 40rpx;
    border-bottom: 1rpx solid $border-color;

    .popup-title {
      font-size: $font-size-lg;
      font-weight: 700;
      color: $text-main;
    }

    .popup-close {
      font-size: 44rpx;
      color: $text-placeholder;
      padding: 10rpx;
    }
  }

  .building-list {
    max-height: 500rpx;
    padding: 16rpx 0;

    .building-item {
      display: flex;
      align-items: center;
      padding: 32rpx 40rpx;
      transition: background 0.2s;

      &:active {
        background: $bg-color;
      }

      &.active {
        background: rgba($primary-color, 0.05);

        .building-item-name {
          color: $primary-color;
          font-weight: 600;
        }
      }

      .building-item-name {
        flex: 1;
        font-size: $font-size-base;
        color: $text-main;
      }

      .building-room-count {
        font-size: $font-size-sm;
        color: $text-secondary;
        margin-right: 16rpx;
        background: $bg-color;
        padding: 4rpx 12rpx;
        border-radius: $radius-sm;
      }

      .check-icon {
        color: $primary-color;
        font-weight: bold;
      }
    }
  }
}

.floating-btn {
  position: fixed;
  right: 40rpx;
  bottom: calc(140rpx + env(safe-area-inset-bottom));
  width: 110rpx;
  height: 110rpx;
  background: $primary-gradient;
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-float;
  z-index: 100;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  
  &:active {
    transform: scale(0.9) translateY(4rpx);
  }
  
  .floating-icon {
    font-size: 36rpx;
    margin-bottom: 4rpx;
  }
  
  .floating-text {
    font-size: 20rpx;
    color: #fff;
    font-weight: 600;
  }
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40rpx;
  color: $text-placeholder;
  font-size: $font-size-sm;
}
</style>
