<template>
  <view class="page">
    <!-- 房间 Header -->
    <view class="room-header">
      <image
        class="room-image"
        :src="room.roomImage || '/static/images/room-default.svg'"
        mode="aspectFill"
      />
      <view class="room-overlay">
        <text class="room-number">{{ room.roomNumber }}</text>
        <view :class="['status-badge', room.status]">
          {{ room.status === 'rented' ? '已出租' : '空置' }}
        </view>
      </view>
    </view>

    <!-- 信息区 -->
    <view class="info-section">
      <!-- 待缴费卡片 -->
      <view class="pay-card" v-if="currentRecord">
        <view class="pay-top">
          <view class="pay-label-row">
            <view class="pay-dot"></view>
            <text class="pay-label">本期租金</text>
          </view>
          <view :class="['pay-status-badge', currentRecord.status]">
            {{ getStatusText(currentRecord.status) }}
          </view>
        </view>
        <view class="pay-amount-row">
          <text class="pay-symbol">¥</text>
          <text class="pay-amount">{{ currentRecord.amount }}</text>
        </view>
        <text class="pay-due-text">截止日期：{{ formatDate(currentRecord.dueDate) }}</text>
        <button
          class="pay-btn"
          :class="{ paid: currentRecord.status === 'paid' }"
          @click="markAsPaid"
          :disabled="currentRecord.status === 'paid'"
        >
          {{ currentRecord.status === 'paid' ? '已缴费' : '标记已缴费' }}
        </button>
      </view>

      <!-- 租客信息 -->
      <view class="info-card">
        <view class="card-title-row">
          <uni-icons type="contact" size="18" color="#1890FF"/>
          <text class="card-title">租客信息</text>
        </view>
        <view v-if="room.tenant?.name">
          <view class="info-row">
            <text class="row-label">姓名</text>
            <text class="row-val">{{ room.tenant.name }}</text>
          </view>
          <view class="info-row">
            <text class="row-label">电话</text>
            <text class="row-val phone-link" @click="callTenant">{{ room.tenant.phone || '未填写' }}</text>
          </view>
          <view class="info-row last">
            <text class="row-label">身份证</text>
            <text class="row-val">{{ maskIdCard(room.tenant.idCard) }}</text>
          </view>
        </view>
        <view v-else class="card-empty"><text>暂无租客</text></view>
      </view>

      <!-- 租约信息 -->
      <view class="info-card">
        <view class="card-title-row">
          <uni-icons type="list" size="18" color="#1890FF"/>
          <text class="card-title">租约信息</text>
        </view>
        <view v-if="room.leaseInfo?.startDate">
          <view class="info-row">
            <text class="row-label">月租金</text>
            <text class="row-val highlight">¥{{ room.monthlyRent }}</text>
          </view>
          <view class="info-row">
            <text class="row-label">押金</text>
            <text class="row-val">¥{{ room.leaseInfo.deposit || 0 }}</text>
          </view>
          <view class="info-row">
            <text class="row-label">租期</text>
            <text class="row-val">{{ formatDateRange(room.leaseInfo.startDate, room.leaseInfo.endDate) }}</text>
          </view>
          <view class="info-row last">
            <text class="row-label">缴费日</text>
            <text class="row-val">每月{{ room.leaseInfo.payDay }}日</text>
          </view>
        </view>
        <view v-else class="card-empty"><text>暂无租约信息</text></view>
      </view>

      <!-- 缴费历史 -->
      <view class="info-card">
        <view class="card-title-row">
          <uni-icons type="calendar" size="18" color="#1890FF"/>
          <text class="card-title">缴费历史</text>
        </view>
        <view v-if="rentRecords.length > 0">
          <view
            v-for="record in rentRecords"
            :key="record._id"
            class="history-item"
          >
            <view class="history-left">
              <text class="history-date">{{ record.year }}年{{ record.month }}月</text>
              <text class="history-amount">¥{{ record.amount }}</text>
            </view>
            <view :class="['history-status', record.status]">
              {{ getStatusText(record.status) }}
            </view>
          </view>
        </view>
        <view v-else class="card-empty"><text>暂无缴费记录</text></view>
      </view>
    </view>
  </view>
</template>

<script>
import { ref, onMounted } from 'vue'
import { callCloud } from '@/utils/cloud'
import { formatDate as formatDateUtil } from '@/utils/date'

export default {
  setup() {
    const room = ref({})
    const rentRecords = ref([])
    const currentRecord = ref(null)
    const recordId = ref('')

    // 获取页面参数
    const getPageParams = () => {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      return currentPage.options || {}
    }

    // 获取房间详情
    const fetchRoomDetail = async (roomId) => {
      try {
        const result = await callCloud('room', {
          action: 'getRoomDetail',
          roomId
        })

        if (result) {
          room.value = result.room || {}
          rentRecords.value = result.rentRecords || []

          // 找到当前待缴费记录
          if (recordId.value) {
            currentRecord.value = rentRecords.value.find(r => r._id === recordId.value)
          }
        }
      } catch (error) {
        console.error('获取房间详情失败:', error)
        uni.showToast({ title: '获取详情失败', icon: 'none' })
      }
    }

    // 标记已缴费
    const markAsPaid = async () => {
      if (!currentRecord.value || currentRecord.value.status === 'paid') return

      uni.showModal({
        title: '确认操作',
        content: '确定标记该笔租金为已缴费？',
        success: async (res) => {
          if (res.confirm) {
            try {
              await callCloud('room', {
                action: 'markPaid',
                recordId: currentRecord.value._id
              })

              currentRecord.value.status = 'paid'

              // 更新列表中的状态
              const idx = rentRecords.value.findIndex(r => r._id === currentRecord.value._id)
              if (idx !== -1) {
                rentRecords.value[idx].status = 'paid'
              }

              uni.showToast({ title: '操作成功', icon: 'success' })
            } catch (error) {
              console.error('标记失败:', error)
            }
          }
        }
      })
    }

    // 拨打电话
    const callTenant = () => {
      const phone = room.value.tenant?.phone
      if (!phone) return

      uni.makePhoneCall({
        phoneNumber: phone,
        fail: () => {}
      })
    }

    // 格式化日期范围
    const formatDateRange = (start, end) => {
      if (!start || !end) return '未设置'
      return `${formatDateUtil(start, 'YYYY.MM.DD')} - ${formatDateUtil(end, 'YYYY.MM.DD')}`
    }

    // 格式化日期
    const formatDate = (date) => {
      return formatDateUtil(date, 'YYYY-MM-DD')
    }

    // 脱敏身份证号
    const maskIdCard = (idCard) => {
      if (!idCard) return '未填写'
      if (idCard.length < 8) return idCard
      return idCard.slice(0, 4) + '****' + idCard.slice(-4)
    }

    // 获取状态文本
    const getStatusText = (status) => {
      const statusMap = {
        pending: '待缴费',
        overdue: '已逾期',
        paid: '已缴费'
      }
      return statusMap[status] || status
    }

    onMounted(() => {
      const params = getPageParams()
      if (params.roomId) {
        recordId.value = params.recordId || ''
        fetchRoomDetail(params.roomId)
      }
    })

    return {
      room,
      rentRecords,
      currentRecord,
      markAsPaid,
      callTenant,
      formatDateRange,
      formatDate,
      maskIdCard,
      getStatusText
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $bg-color;
}

.room-header {
  position: relative;
  height: 400rpx;

  .room-image {
    width: 100%;
    height: 100%;
  }

  .room-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 32rpx;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.55));
    display: flex;
    align-items: center;
    justify-content: space-between;

    .room-number {
      font-size: 52rpx;
      font-weight: 800;
      color: #fff;
    }

    .status-badge {
      font-size: 24rpx;
      padding: 10rpx 24rpx;
      border-radius: $radius-full;
      font-weight: 600;

      &.rented {
        background: rgba(82, 196, 26, 0.85);
        color: #fff;
      }

      &.empty {
        background: rgba(255, 255, 255, 0.25);
        color: #fff;
      }
    }
  }
}

.info-section {
  padding: 24rpx 32rpx;
  margin-top: -20rpx;
  position: relative;
}

.pay-card {
  background: $primary-gradient;
  border-radius: $radius-lg;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-float;

  .pay-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16rpx;

    .pay-label-row {
      display: flex;
      align-items: center;
      gap: 10rpx;

      .pay-dot {
        width: 10rpx;
        height: 10rpx;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 50%;
      }

      .pay-label {
        font-size: $font-size-sm;
        color: rgba(255, 255, 255, 0.85);
      }
    }

    .pay-status-badge {
      font-size: $font-size-xs;
      padding: 6rpx 20rpx;
      border-radius: $radius-full;

      &.pending {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }

      &.overdue {
        background: rgba(255, 77, 79, 0.2);
        color: #FFCCC7;
      }

      &.paid {
        background: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
    }
  }

  .pay-amount-row {
    display: flex;
    align-items: baseline;
    gap: 8rpx;
    margin-bottom: 10rpx;

    .pay-symbol {
      font-size: $font-size-xl;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 500;
    }

    .pay-amount {
      font-size: 80rpx;
      font-weight: 800;
      color: #fff;
      line-height: 1;
    }
  }

  .pay-due-text {
    font-size: $font-size-xs;
    color: rgba(255, 255, 255, 0.7);
    display: block;
    margin-bottom: 28rpx;
  }

  .pay-btn {
    width: 100%;
    height: 96rpx;
    background: rgba(255, 255, 255, 0.22);
    border: 1rpx solid rgba(255, 255, 255, 0.5);
    border-radius: $radius-full;
    color: #fff;
    font-size: $font-size-base;
    font-weight: 600;
    letter-spacing: 2rpx;

    &:active { background: rgba(255, 255, 255, 0.3); }

    &.paid {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

.info-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: $shadow-sm;

  .card-title-row {
    display: flex;
    align-items: center;
    gap: 12rpx;
    margin-bottom: 24rpx;

    .card-title {
      font-size: $font-size-base;
      font-weight: 700;
      color: $text-main;
    }
  }

  .card-empty {
    padding: 28rpx 0;
    text-align: center;

    text {
      font-size: $font-size-sm;
      color: $text-placeholder;
    }
  }
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $border-color;

  &.last { border-bottom: none; }

  .row-label {
    font-size: $font-size-sm;
    color: $text-secondary;
  }

  .row-val {
    font-size: $font-size-sm;
    color: $text-main;
    font-weight: 500;

    &.highlight {
      color: $warning-color;
      font-weight: 700;
      font-size: $font-size-lg;
    }

    &.phone-link { color: $primary-color; }
  }
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-bottom: 1rpx solid $border-color;

  &:last-child { border-bottom: none; }

  .history-left {
    display: flex;
    flex-direction: column;
    gap: 6rpx;

    .history-date {
      font-size: $font-size-base;
      color: $text-main;
    }

    .history-amount {
      font-size: $font-size-xs;
      color: $text-secondary;
    }
  }

  .history-status {
    font-size: $font-size-xs;
    padding: 6rpx 20rpx;
    border-radius: $radius-full;

    &.pending { background: #FFF7E6; color: $warning-color; }
    &.overdue { background: #FFF1F0; color: $error-color; }
    &.paid { background: #F6FFED; color: $success-color; }
  }
}
</style>
