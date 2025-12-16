<template>
  <view class="page">
    <!-- 房间列表 -->
    <view class="room-grid">
      <view 
        v-for="room in rooms" 
        :key="room._id"
        class="room-card"
        @click="editRoom(room)"
      >
        <view class="room-number">{{ room.roomNumber }}</view>
        <view class="room-status" :class="room.status">
          {{ room.status === 'rented' ? '已租' : '空置' }}
        </view>
        <view class="room-info">
          <text>租金: ¥{{ room.monthlyRent }}</text>
          <text v-if="room.tenant?.name" class="tenant-name">{{ room.tenant.name }}</text>
        </view>
      </view>
      
      <!-- 添加按钮（作为网格中的一项） -->
      <view class="room-card add-card" @click="showAddModal">
        <text class="add-icon">+</text>
        <text class="add-text">添加房间</text>
      </view>
    </view>

    <!-- 添加/编辑弹窗 -->
    <uni-popup ref="formPopup" type="center">
      <view class="form-popup">
        <text class="popup-title">{{ isEdit ? '编辑房间' : '添加房间' }}</text>
        
        <view class="form-group">
          <text class="form-label">房间号 *</text>
          <input 
            class="form-input" 
            v-model="formData.roomNumber"
            placeholder="如：101"
          />
        </view>

        <view class="form-group">
          <text class="form-label">月租金 (元)</text>
          <input 
            class="form-input" 
            type="number"
            v-model="formData.monthlyRent"
            placeholder="0"
          />
        </view>

        <view class="form-group">
          <text class="form-label">面积 (平米)</text>
          <input 
            class="form-input" 
            type="number"
            v-model="formData.area"
            placeholder="选填"
          />
        </view>

        <view class="popup-actions">
          <button class="popup-btn delete" v-if="isEdit" @click="handleDelete">删除</button>
          <view class="spacer" v-if="isEdit"></view>
          <button class="popup-btn cancel" @click="closePopup">取消</button>
          <button class="popup-btn confirm" @click="submitForm">确定</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { callCloud } from '@/utils/cloud'

export default {
  setup() {
    const buildingId = ref('')
    const strBuildingName = ref('') // Avoid conflict with buildingName if reused
    const rooms = ref([])
    const formPopup = ref(null)
    const isEdit = ref(false)
    const editingId = ref('')
    
    const formData = ref({
      roomNumber: '',
      monthlyRent: '',
      area: ''
    })
    
    onLoad((options) => {
      if (options.buildingId) {
        buildingId.value = options.buildingId
        strBuildingName.value = options.buildingName || '房间管理'
        
        uni.setNavigationBarTitle({
          title: `${strBuildingName.value} - 房间管理`
        })
        
        fetchRooms()
      }
    })
    
    // 获取房间列表
    const fetchRooms = async () => {
      try {
        const result = await callCloud('room', {
          action: 'getRoomList',
          buildingId: buildingId.value,
          page: 1,
          pageSize: 100 // 获取所有房间
        })
        
        if (result && result.list) {
          rooms.value = result.list
        }
      } catch (error) {
        console.error('获取房间列表失败:', error)
      }
    }
    
    // 显示添加弹窗
    const showAddModal = () => {
      isEdit.value = false
      editingId.value = ''
      formData.value = { roomNumber: '', monthlyRent: '', area: '' }
      formPopup.value.open()
    }
    
    // 编辑房间
    const editRoom = (room) => {
      isEdit.value = true
      editingId.value = room._id
      formData.value = {
        roomNumber: room.roomNumber,
        monthlyRent: room.monthlyRent,
        area: room.area
      }
      formPopup.value.open()
    }
    
    // 提交表单
    const submitForm = async () => {
      if (!formData.value.roomNumber.trim()) {
        uni.showToast({ title: '请输入房间号', icon: 'none' })
        return
      }
      
      const payload = {
        buildingId: buildingId.value,
        roomNumber: formData.value.roomNumber,
        monthlyRent: Number(formData.value.monthlyRent) || 0,
        area: Number(formData.value.area) || 0
      }
      
      uni.showLoading({ title: '提交中...' })
      
      try {
        if (isEdit.value) {
          // 编辑
          await callCloud('room', {
            action: 'updateRoom',
            roomId: editingId.value,
            ...payload
          })
        } else {
          // 添加
          await callCloud('room', {
            action: 'addRoom',
            ...payload
          })
        }
        
        uni.hideLoading()
        uni.showToast({ title: isEdit.value ? '更新成功' : '添加成功', icon: 'success' })
        closePopup()
        fetchRooms()
        
      } catch (error) {
        uni.hideLoading()
        console.error('操作失败:', error)
      }
    }
    
    // 删除房间
    const handleDelete = () => {
      uni.showModal({
        title: '确认删除',
        content: '确定要删除该房间吗？删除后无法恢复。',
        confirmColor: '#EF4444',
        success: async (res) => {
          if (res.confirm) {
            try {
              await callCloud('room', {
                action: 'deleteRoom',
                roomId: editingId.value,
                buildingId: buildingId.value
              })
              
              uni.showToast({ title: '删除成功', icon: 'success' })
              closePopup()
              fetchRooms()
            } catch (error) {
              console.error('删除失败:', error)
            }
          }
        }
      })
    }
    
    const closePopup = () => {
      formPopup.value.close()
    }
    
    return {
      rooms,
      formPopup,
      isEdit,
      formData,
      showAddModal,
      editRoom,
      submitForm,
      handleDelete,
      closePopup
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: #f5f5f5;
  padding: 24rpx;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.room-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  min-height: 180rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
  
  &.add-card {
    align-items: center;
    justify-content: center;
    border: 2rpx dashed #d1d5db;
    background: transparent;
    
    .add-icon {
      font-size: 48rpx;
      color: #9ca3af;
      margin-bottom: 8rpx;
    }
    
    .add-text {
      font-size: 26rpx;
      color: #6b7280;
    }
    
    &:active {
      background: rgba(0,0,0,0.02);
    }
  }
  
  .room-number {
    font-weight: bold;
    font-size: 32rpx;
    color: #1f2937;
  }
  
  .room-status {
    align-self: flex-start;
    font-size: 20rpx;
    padding: 4rpx 12rpx;
    border-radius: 8rpx;
    margin: 12rpx 0;
    
    &.rented {
      background: #ECFDF5;
      color: #10B981;
    }
    
    &.empty {
      background: #F3F4F6;
      color: #6B7280;
    }
  }
  
  .room-info {
    font-size: 22rpx;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    
    .tenant-name {
      margin-top: 4rpx;
      color: #3B82F6;
    }
  }
}

.form-popup {
  width: 600rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  
  .popup-title {
    font-size: 36rpx;
    font-weight: 600;
    color: #1f2937;
    text-align: center;
    margin-bottom: 40rpx;
    display: block;
  }
  
  .form-group {
    margin-bottom: 28rpx;
    
    .form-label {
      font-size: 28rpx;
      color: #374151;
      margin-bottom: 12rpx;
      display: block;
    }
    
    .form-input {
      width: 100%;
      height: 88rpx;
      background: #f9fafb;
      border: 2rpx solid #e5e7eb;
      border-radius: 16rpx;
      padding: 0 24rpx;
      font-size: 30rpx;
      color: #1f2937;
    }
  }
  
  .popup-actions {
    display: flex;
    margin-top: 40rpx;
    
    .spacer {
      width: 24rpx;
    }
    
    .popup-btn {
      flex: 1;
      height: 88rpx;
      border-radius: 44rpx;
      font-size: 30rpx;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      
      &.cancel {
        background: #f3f4f6;
        color: #6b7280;
        margin-right: 24rpx;
      }
      
      &.confirm {
        background: #3B82F6;
        color: #fff;
      }
      
      &.delete {
        background: #FEE2E2;
        color: #EF4444;
        flex: 0 0 160rpx;
        margin-right: 24rpx;
      }
    }
  }
}
</style>
