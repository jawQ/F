<template>
  <view class="page">
    <!-- 房间基本信息 -->
    <view class="room-header">
      <image 
        class="room-image" 
        :src="room.roomImage || '/static/images/room-default.png'" 
        mode="aspectFill"
      />
      <view class="room-overlay">
        <text class="room-number">{{ room.roomNumber }}</text>
        <view :class="['status-badge', room.status]">
          {{ room.status === 'rented' ? '已出租' : '空置' }}
        </view>
      </view>
    </view>

    <!-- 信息卡片 -->
    <view class="info-section">
      <!-- 租客信息 -->
      <view class="info-card">
        <view class="card-title">
          <text class="title-icon">👤</text>
          <text>租客信息</text>
        </view>
        <view class="card-content" v-if="room.tenant?.name">
          <view class="info-row">
            <text class="label">姓名</text>
            <text class="value">{{ room.tenant.name }}</text>
          </view>
          <view class="info-row">
            <text class="label">电话</text>
            <text class="value phone" @click="callTenant">{{ room.tenant.phone || '未填写' }}</text>
          </view>
          <view class="info-row">
            <text class="label">身份证</text>
            <text class="value">{{ maskIdCard(room.tenant.idCard) }}</text>
          </view>
        </view>
        <view class="card-content empty" v-else>
          <text class="empty-text">暂无租客</text>
        </view>
      </view>

      <!-- 租约信息 -->
      <view class="info-card">
        <view class="card-title">
          <text class="title-icon">📄</text>
          <text>租约信息</text>
        </view>
        <view class="card-content" v-if="room.leaseInfo?.startDate">
          <view class="info-row">
            <text class="label">月租金</text>
            <text class="value highlight">¥{{ room.monthlyRent }}</text>
          </view>
          <view class="info-row">
            <text class="label">押金</text>
            <text class="value">¥{{ room.leaseInfo.deposit || 0 }}</text>
          </view>
          <view class="info-row">
            <text class="label">租期</text>
            <text class="value">{{ formatDateRange(room.leaseInfo.startDate, room.leaseInfo.endDate) }}</text>
          </view>
          <view class="info-row">
            <text class="label">缴费日</text>
            <text class="value">每月{{ room.leaseInfo.payDay }}日</text>
          </view>
        </view>
        <view class="card-content empty" v-else>
          <text class="empty-text">暂无租约信息</text>
        </view>
      </view>

      <!-- 待缴费信息 -->
      <view class="info-card highlight-card" v-if="currentRecord">
        <view class="card-title">
          <text class="title-icon">💰</text>
          <text>待缴费</text>
        </view>
        <view class="card-content">
          <view class="amount-display">
            <text class="currency">¥</text>
            <text class="amount">{{ currentRecord.amount }}</text>
          </view>
          <view class="due-info">
            <text :class="['due-status', currentRecord.status]">
              {{ getStatusText(currentRecord.status) }}
            </text>
            <text class="due-date">截止日期：{{ formatDate(currentRecord.dueDate) }}</text>
          </view>
        </view>
        <button 
          class="pay-btn" 
          :class="{ disabled: currentRecord.status === 'paid' }"
          @click="markAsPaid"
          :disabled="currentRecord.status === 'paid'"
        >
          {{ currentRecord.status === 'paid' ? '已缴费' : '标记已缴费' }}
        </button>
      </view>

      <!-- 缴费历史 -->
      <view class="info-card">
        <view class="card-title">
          <text class="title-icon">📋</text>
          <text>缴费历史</text>
        </view>
        <view class="card-content" v-if="rentRecords.length > 0">
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
        <view class="card-content empty" v-else>
          <text class="empty-text">暂无缴费记录</text>
        </view>
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
  background: #f5f5f5;
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
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    justify-content: space-between;

    .room-number {
      font-size: 48rpx;
      font-weight: 700;
      color: #fff;
    }

    .status-badge {
      font-size: 24rpx;
      padding: 8rpx 20rpx;
      border-radius: 20rpx;

      &.rented {
        background: rgba(16, 185, 129, 0.9);
        color: #fff;
      }

      &.empty {
        background: rgba(156, 163, 175, 0.9);
        color: #fff;
      }
    }
  }
}

.info-section {
  padding: 24rpx;
  margin-top: -40rpx;
  position: relative;
}

.info-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);

  &.highlight-card {
    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);

    .card-title {
      color: #fff;
    }

    .card-content {
      color: #fff;
    }
  }

  .card-title {
    display: flex;
    align-items: center;
    font-size: 30rpx;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 24rpx;

    .title-icon {
      margin-right: 12rpx;
    }
  }

  .card-content {
    &.empty {
      padding: 32rpx 0;
      text-align: center;

      .empty-text {
        color: #9ca3af;
        font-size: 28rpx;
      }
    }
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16rpx 0;
    border-bottom: 1rpx solid #f3f4f6;

    &:last-child {
      border-bottom: none;
    }

    .label {
      font-size: 28rpx;
      color: #6b7280;
    }

    .value {
      font-size: 28rpx;
      color: #1f2937;

      &.highlight {
        color: #3B82F6;
        font-weight: 600;
        font-size: 32rpx;
      }

      &.phone {
        color: #3B82F6;
      }
    }
  }
}

.amount-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  padding: 24rpx 0;

  .currency {
    font-size: 36rpx;
    font-weight: 500;
  }

  .amount {
    font-size: 72rpx;
    font-weight: 700;
    margin-left: 8rpx;
  }
}

.due-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;

  .due-status {
    font-size: 26rpx;
    padding: 8rpx 24rpx;
    border-radius: 20rpx;

    &.pending {
      background: rgba(255, 255, 255, 0.2);
    }

    &.overdue {
      background: #FEE2E2;
      color: #DC2626;
    }

    &.paid {
      background: rgba(255, 255, 255, 0.2);
    }
  }

  .due-date {
    font-size: 24rpx;
    opacity: 0.85;
  }
}

.pay-btn {
  width: 100%;
  height: 88rpx;
  background: rgba(255, 255, 255, 0.2);
  border: 2rpx solid rgba(255, 255, 255, 0.5);
  border-radius: 44rpx;
  color: #fff;
  font-size: 30rpx;
  font-weight: 600;
  margin-top: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  &:active {
    background: rgba(255, 255, 255, 0.3);
  }

  &.disabled {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.5);
  }
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }

  .history-left {
    display: flex;
    flex-direction: column;
    gap: 8rpx;

    .history-date {
      font-size: 28rpx;
      color: #1f2937;
    }

    .history-amount {
      font-size: 26rpx;
      color: #6b7280;
    }
  }

  .history-status {
    font-size: 24rpx;
    padding: 8rpx 20rpx;
    border-radius: 16rpx;

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
</style>
