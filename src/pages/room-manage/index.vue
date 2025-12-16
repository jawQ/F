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
      
      // 智能填充：获取最后一个房间的信息
      let defaultData = { roomNumber: '', monthlyRent: '', area: '' }
      
      if (rooms.value.length > 0) {
        // 尝试按房间号排序找到最后一个（假设是数字）
        const sortedRooms = [...rooms.value].sort((a, b) => {
          const numA = parseInt(a.roomNumber) || 0
          const numB = parseInt(b.roomNumber) || 0
          return numA - numB
        })
        
        const lastRoom = sortedRooms[sortedRooms.length - 1]
        
        // 复用租金和面积
        defaultData.monthlyRent = lastRoom.monthlyRent
        defaultData.area = lastRoom.area
        
        // 尝试预测下一个房间号
        const lastNum = parseInt(lastRoom.roomNumber)
        if (!isNaN(lastNum)) {
          defaultData.roomNumber = String(lastNum + 1)
        }
      }
      
      formData.value = defaultData
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
  background: $bg-color;
  padding: 32rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
}

.room-card {
  background: $bg-white;
  border-radius: $radius-md;
  padding: 24rpx;
  min-height: 200rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: $shadow-sm;
  transition: all 0.2s;
  border: 2rpx solid transparent;
  
  &:active {
    transform: scale(0.96);
  }
  
  &.add-card {
    align-items: center;
    justify-content: center;
    border: 2rpx dashed $border-color;
    background: transparent;
    box-shadow: none;
    
    .add-icon {
      font-size: 56rpx;
      color: $text-placeholder;
      margin-bottom: 12rpx;
      font-weight: 300;
      transition: color 0.2s;
    }
    
    .add-text {
      font-size: $font-size-sm;
      color: $text-secondary;
    }
    
    &:active {
      background: rgba($primary-color, 0.02);
      border-color: rgba($primary-color, 0.3);
      
      .add-icon {
        color: $primary-color;
      }
    }
  }
  
  .room-number {
    font-weight: 700;
    font-size: $font-size-lg;
    color: $text-main;
  }
  
  .room-status {
    align-self: flex-start;
    font-size: $font-size-xs;
    padding: 4rpx 16rpx;
    border-radius: $radius-full;
    margin: 16rpx 0;
    font-weight: 500;
    
    &.rented {
      background: rgba($success-color, 0.1);
      color: $success-color;
    }
    
    &.empty {
      background: $bg-color;
      color: $text-placeholder;
    }
  }
  
  .room-info {
    font-size: $font-size-xs;
    color: $text-secondary;
    display: flex;
    flex-direction: column;
    
    > text:first-child {
      color: $primary-color;
      font-weight: 600;
    }
    
    .tenant-name {
      margin-top: 6rpx;
      color: $text-main;
      font-weight: 500;
    }
  }
}

.form-popup {
  width: 600rpx;
  background: $bg-white;
  border-radius: $radius-lg;
  padding: 48rpx;
  
  .popup-title {
    font-size: $font-size-xl;
    font-weight: 700;
    color: $text-main;
    text-align: center;
    margin-bottom: 48rpx;
    display: block;
  }
  
  .form-group {
    margin-bottom: 32rpx;
    
    .form-label {
      font-size: $font-size-sm;
      color: $text-main;
      margin-bottom: 16rpx;
      display: block;
      font-weight: 500;
    }
    
    .form-input {
      width: 100%;
      height: 96rpx;
      background: $bg-color;
      border: 2rpx solid transparent;
      border-radius: $radius-md;
      padding: 0 32rpx;
      font-size: $font-size-base;
      color: $text-main;
      transition: all 0.2s;
      
      &:focus {
        background: #fff;
        border-color: $primary-color;
      }
    }
  }
  
  .popup-actions {
    display: flex;
    margin-top: 56rpx;
    
    .spacer {
      width: 24rpx;
    }
    
    .popup-btn {
      flex: 1;
      height: 96rpx;
      border-radius: $radius-full;
      font-size: $font-size-base;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      
      &.cancel {
        background: $bg-color;
        color: $text-secondary;
        margin-right: 24rpx;
      }
      
      &.confirm {
        background: $primary-color;
        color: #fff;
        box-shadow: 0 4rpx 16rpx rgba($primary-color, 0.3);
      }
      
      &.delete {
        background: rgba($error-color, 0.1);
        color: $error-color;
        flex: 0 0 160rpx;
        margin-right: 24rpx;
      }
    }
  }
}
</style>
