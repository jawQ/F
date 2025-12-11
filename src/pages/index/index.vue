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
        <image class="empty-icon" src="/static/icons/empty.png" mode="aspectFit" />
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
          :src="room.roomImage || '/static/images/room-default.png'" 
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
    
    // 格式化截止日期
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
      getStatusText
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #3B82F6 0%, #1E40AF 100%);
}

.header {
  padding: 40rpx 32rpx 60rpx;
  color: #fff;

  .building-selector {
    display: flex;
    align-items: center;
    margin-bottom: 24rpx;

    .building-name {
      font-size: 36rpx;
      font-weight: 600;
      margin-right: 12rpx;
    }
  }

  .date-info {
    .date {
      font-size: 48rpx;
      font-weight: 700;
      display: block;
      margin-bottom: 8rpx;
    }

    .tips {
      font-size: 28rpx;
      opacity: 0.85;
    }
  }
}

.room-list {
  min-height: calc(100vh - 280rpx);
  background: #f5f5f5;
  border-radius: 40rpx 40rpx 0 0;
  padding: 32rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;

  .empty-icon {
    width: 200rpx;
    height: 200rpx;
    margin-bottom: 32rpx;
    opacity: 0.6;
  }

  .empty-text {
    font-size: 32rpx;
    color: #666;
    margin-bottom: 12rpx;
  }

  .empty-tips {
    font-size: 26rpx;
    color: #999;
  }
}

.room-card {
  display: flex;
  background: #fff;
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.2s ease;

  &:active {
    transform: scale(0.98);
  }

  .room-image {
    width: 160rpx;
    height: 160rpx;
    border-radius: 16rpx;
    flex-shrink: 0;
    background: #f0f0f0;
  }

  .room-info {
    flex: 1;
    margin-left: 24rpx;
    display: flex;
    flex-direction: column;
    justify-content: space-between;

    .room-header {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .room-number {
        font-size: 34rpx;
        font-weight: 600;
        color: #1f2937;
      }

      .status-tag {
        font-size: 22rpx;
        padding: 6rpx 16rpx;
        border-radius: 20rpx;

        &.pending {
          background: #FEF3C7;
          color: #D97706;
        }

        &.overdue {
          background: #FEE2E2;
          color: #DC2626;
        }

        &.paid {
          background: #D1FAE5;
          color: #059669;
        }
      }
    }

    .tenant-name {
      font-size: 26rpx;
      color: #6b7280;
    }

    .rent-info {
      display: flex;
      align-items: baseline;
      justify-content: space-between;

      .amount {
        font-size: 36rpx;
        font-weight: 700;
        color: #3B82F6;
      }

      .due-date {
        font-size: 24rpx;
        color: #9ca3af;
      }
    }
  }
}

.building-popup {
  background: #fff;
  border-radius: 32rpx 32rpx 0 0;
  max-height: 70vh;

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 32rpx;
    border-bottom: 1rpx solid #f0f0f0;

    .popup-title {
      font-size: 32rpx;
      font-weight: 600;
      color: #1f2937;
    }

    .popup-close {
      font-size: 48rpx;
      color: #9ca3af;
      line-height: 1;
    }
  }

  .building-list {
    max-height: 500rpx;
    padding: 16rpx 0;

    .building-item {
      display: flex;
      align-items: center;
      padding: 28rpx 32rpx;
      transition: background 0.2s;

      &:active {
        background: #f5f5f5;
      }

      &.active {
        background: #EFF6FF;

        .building-item-name {
          color: #3B82F6;
          font-weight: 600;
        }
      }

      .building-item-name {
        flex: 1;
        font-size: 30rpx;
        color: #1f2937;
      }

      .building-room-count {
        font-size: 24rpx;
        color: #9ca3af;
        margin-right: 16rpx;
      }

      .check-icon {
        color: #3B82F6;
        font-size: 32rpx;
        font-weight: bold;
      }
    }
  }
}

.loading {
  display: flex;
  justify-content: center;
  padding: 32rpx;
  color: #666;
}
</style>
