<template>
  <view class="page">
    <!-- Header -->
    <view class="header">
      <view class="header-inner">
        <view class="building-selector" @click="showBuildingPicker = true">
          <text class="selector-hint">当前楼栋</text>
          <view class="selector-name-row">
            <text class="building-name">{{ currentBuildingName }}</text>
            <view class="selector-arrow">
              <uni-icons type="arrowdown" size="12" color="#1890FF"></uni-icons>
            </view>
          </view>
        </view>
        <view class="date-chip">
          <text class="date-chip-text">{{ today }}</text>
        </view>
      </view>
      <text class="header-subtitle">七天内待缴房租</text>
    </view>

    <!-- 列表 -->
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

      <!-- 租金卡片 -->
      <view
        v-for="room in roomList"
        :key="room.recordId"
        class="room-card"
        @click="goToDetail(room)"
      >
        <view :class="['card-status-bar', room.status]"></view>
        <view class="card-main">
          <view class="card-left">
            <view class="room-tag">
              <text class="room-number">{{ room.roomNumber }}</text>
            </view>
            <text class="tenant-name">{{ room.tenantName || '空置' }}</text>
            <text class="due-date">{{ formatDueDate(room.dueDate) }}</text>
          </view>
          <view class="card-right">
            <text class="amount">¥{{ room.amount }}</text>
            <view :class="['status-pill', room.status]">
              {{ getStatusText(room.status) }}
            </view>
          </view>
        </view>
      </view>

      <view class="list-bottom-spacer"></view>
    </scroll-view>

    <!-- 楼栋弹窗 -->
    <uni-popup ref="buildingPopup" type="bottom">
      <view class="building-popup">
        <view class="popup-handle"></view>
        <view class="popup-header">
          <text class="popup-title">选择楼栋</text>
          <uni-icons type="close" size="20" color="#C2CAD9" @click="closeBuildingPicker"></uni-icons>
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
            <uni-icons v-if="building._id === currentBuildingId" type="checkmarkempty" size="18" :color="'#1890FF'"></uni-icons>
          </view>
        </scroll-view>
      </view>
    </uni-popup>

    <!-- 悬浮按钮 -->
    <view class="floating-btn" @click="goToRoomManage" v-if="currentBuildingId">
      <uni-icons type="home" size="28" color="#fff"></uni-icons>
    </view>

    <!-- 加载 -->
    <view v-if="loading" class="loading"><text>加载中...</text></view>
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
  padding: 44rpx 40rpx 32rpx;
  background: $primary-gradient;
  border-radius: 0 0 40rpx 40rpx;

  .header-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20rpx;
  }

  .building-selector {
    .selector-hint {
      font-size: $font-size-xs;
      color: rgba(255, 255, 255, 0.7);
      display: block;
      margin-bottom: 6rpx;
    }

    .selector-name-row {
      display: flex;
      align-items: center;
      gap: 8rpx;
    }

    .building-name {
      font-size: $font-size-xxl;
      font-weight: 800;
      color: #fff;
    }

    .selector-arrow {
      background: rgba(255, 255, 255, 0.2);
      width: 40rpx;
      height: 40rpx;
      border-radius: $radius-full;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .date-chip {
    background: rgba(255, 255, 255, 0.2);
    border-radius: $radius-full;
    padding: 10rpx 24rpx;
    margin-top: 6rpx;

    .date-chip-text {
      font-size: $font-size-sm;
      color: #fff;
      font-weight: 500;
    }
  }

  .header-subtitle {
    font-size: $font-size-xs;
    color: rgba(255, 255, 255, 0.75);
    letter-spacing: 1rpx;
  }
}

.room-list {
  min-height: calc(100vh - 340rpx);
  padding: 24rpx 32rpx 0;
  margin-top: -1rpx;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;

  .empty-icon {
    width: 200rpx;
    height: 200rpx;
    margin-bottom: 28rpx;
    opacity: 0.6;
  }

  .empty-text {
    font-size: $font-size-lg;
    font-weight: 600;
    color: $text-main;
    margin-bottom: 12rpx;
  }

  .empty-tips {
    font-size: $font-size-sm;
    color: $text-secondary;
    text-align: center;
  }
}

.room-card {
  background: $bg-card;
  border-radius: $radius-md;
  margin-bottom: 24rpx;
  overflow: hidden;
  box-shadow: $shadow-sm;
  display: flex;
  flex-direction: column;

  &:active {
    transform: scale(0.988);
    box-shadow: none;
  }

  .card-status-bar {
    height: 6rpx;
    width: 100%;

    &.pending { background: linear-gradient(90deg, $warning-color, #FFBB55); }
    &.overdue { background: linear-gradient(90deg, $error-color, #FF7875); }
    &.paid { background: linear-gradient(90deg, $success-color, #95DE64); }
  }

  .card-main {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 32rpx;
  }

  .card-left {
    display: flex;
    flex-direction: column;
    gap: 8rpx;

    .room-tag {
      display: inline-flex;

      .room-number {
        font-size: $font-size-xl;
        font-weight: 800;
        color: $text-main;
      }
    }

    .tenant-name {
      font-size: $font-size-sm;
      color: $text-secondary;
    }

    .due-date {
      font-size: $font-size-xs;
      color: $text-placeholder;
    }
  }

  .card-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 12rpx;

    .amount {
      font-size: 52rpx;
      font-weight: 800;
      color: $warning-color;
      line-height: 1;
    }

    .status-pill {
      font-size: $font-size-xs;
      padding: 6rpx 20rpx;
      border-radius: $radius-full;
      font-weight: 500;

      &.pending {
        background: #FFF7E6;
        color: $warning-color;
      }

      &.overdue {
        background: #FFF1F0;
        color: $error-color;
      }

      &.paid {
        background: #F6FFED;
        color: $success-color;
      }
    }
  }
}

.list-bottom-spacer {
  height: 160rpx;
}

.building-popup {
  background: $bg-card;
  border-radius: $radius-lg $radius-lg 0 0;
  max-height: 70vh;

  .popup-handle {
    width: 64rpx;
    height: 8rpx;
    background: $border-color;
    border-radius: $radius-full;
    margin: 20rpx auto 0;
  }

  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28rpx 32rpx;
    border-bottom: 1rpx solid $border-color;

    .popup-title {
      font-size: $font-size-lg;
      font-weight: 700;
      color: $text-main;
    }
  }

  .building-list {
    max-height: 500rpx;
    padding: 12rpx 0;

    .building-item {
      display: flex;
      align-items: center;
      padding: 28rpx 32rpx;
      transition: background 0.15s;

      &:active { background: $bg-color; }

      &.active {
        background: #E6F4FF;

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
        background: $bg-color;
        padding: 4rpx 14rpx;
        border-radius: $radius-full;
        margin-right: 16rpx;
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
  align-items: center;
  justify-content: center;
  box-shadow: $shadow-float;
  z-index: 100;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

  &:active {
    transform: scale(0.9);
  }
}

.loading {
  display: flex;
  justify-content: center;
  padding: 40rpx;
  color: $text-secondary;
  font-size: $font-size-sm;
}
</style>
