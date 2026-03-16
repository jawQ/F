<template>
  <view class="page">
    <view class="room-grid">
      <view
        v-for="room in rooms"
        :key="room._id"
        :class="['room-card', room.status]"
        @click="editRoom(room)"
      >
        <view class="card-header">
          <text class="room-number">{{ room.roomNumber }}</text>
          <view :class="['status-dot', room.status]"></view>
        </view>
        <text class="rent-amount">¥{{ room.monthlyRent }}</text>
        <view class="card-footer">
          <text class="tenant-label">{{ room.tenant?.name || '空置' }}</text>
          <view :class="['status-badge', room.status]">
            {{ room.status === 'rented' ? '已租' : '空' }}
          </view>
        </view>
      </view>

      <!-- 添加卡片 -->
      <view class="room-card add-card" @click="showAddModal">
        <text class="add-plus">+</text>
        <text class="add-text">添加房间</text>
      </view>
    </view>

    <!-- 弹窗 -->
    <uni-popup ref="formPopup" type="center">
      <view class="form-popup">
        <text class="popup-title">{{ isEdit ? '编辑房间' : '添加房间' }}</text>

        <view class="form-group">
          <text class="form-label">房间号 *</text>
          <input class="form-input" v-model="formData.roomNumber" placeholder="如：101" />
        </view>

        <view class="form-group">
          <text class="form-label">月租金（元）</text>
          <input class="form-input" type="number" v-model="formData.monthlyRent" placeholder="0" />
        </view>

        <view class="form-group">
          <text class="form-label">面积（平米）</text>
          <input class="form-input" type="number" v-model="formData.area" placeholder="选填" />
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
        confirmColor: '#FF4D4F',
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
  gap: 20rpx;
}

.room-card {
  background: $bg-card;
  border-radius: $radius-md;
  padding: 20rpx;
  min-height: 200rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  box-shadow: $shadow-sm;
  border: 1rpx solid $border-color;
  transition: all 0.15s;

  &:active {
    transform: scale(0.96);
    box-shadow: none;
  }

  &.rented {
    border-top: 4rpx solid $success-color;
    border-top-left-radius: $radius-md;
    border-top-right-radius: $radius-md;
  }

  &.empty {
    border-top: 4rpx solid $border-color;
  }

  &.add-card {
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 2rpx dashed #BAE0FF;
    box-shadow: none;
    gap: 8rpx;

    &:active {
      background: #E6F4FF;
    }

    .add-plus {
      font-size: 52rpx;
      color: $primary-color;
      font-weight: 300;
      opacity: 0.5;
      line-height: 1;
    }

    .add-text {
      font-size: $font-size-sm;
      color: $primary-color;
      opacity: 0.7;
    }
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .room-number {
      font-size: $font-size-lg;
      font-weight: 800;
      color: $text-main;
    }

    .status-dot {
      width: 14rpx;
      height: 14rpx;
      border-radius: 50%;

      &.rented { background: $success-color; box-shadow: 0 0 6rpx rgba(82, 196, 26, 0.5); }
      &.empty { background: $border-color; }
    }
  }

  .rent-amount {
    font-size: $font-size-base;
    font-weight: 700;
    color: $warning-color;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .tenant-label {
      font-size: $font-size-xs;
      color: $text-secondary;
      max-width: 110rpx;
      overflow: hidden;
    }

    .status-badge {
      font-size: 20rpx;
      padding: 6rpx 16rpx;
      border-radius: $radius-full;
      font-weight: 500;

      &.rented {
        background: #F6FFED;
        color: $success-color;
      }

      &.empty {
        background: $bg-color;
        color: $text-placeholder;
      }
    }
  }
}

.form-popup {
  width: 600rpx;
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 48rpx;
  box-shadow: $shadow-lg;

  .popup-title {
    font-size: $font-size-xl;
    font-weight: 700;
    color: $text-main;
    text-align: center;
    display: block;
    padding-bottom: 32rpx;
    margin-bottom: 40rpx;
    border-bottom: 1rpx solid $border-color;
  }

  .form-group {
    margin-bottom: 28rpx;

    .form-label {
      font-size: $font-size-sm;
      color: $text-secondary;
      display: block;
      margin-bottom: 12rpx;
      font-weight: 500;
    }

    .form-input {
      width: 100%;
      height: 96rpx;
      background: $bg-color;
      border: 2rpx solid $border-color;
      border-radius: $radius-md;
      padding: 0 28rpx;
      font-size: $font-size-base;
      color: $text-main;
      transition: border-color 0.2s;

      &:focus {
        border-color: $primary-color;
        background: #fff;
      }
    }
  }

  .popup-actions {
    display: flex;
    margin-top: 48rpx;
    gap: 16rpx;

    .spacer { flex: 0 0 0; }

    .popup-btn {
      flex: 1;
      height: 96rpx;
      border-radius: $radius-full;
      font-size: $font-size-base;
      font-weight: 600;
      border: none;
      letter-spacing: 1rpx;

      &.cancel {
        background: $bg-color;
        color: $text-secondary;
        border: 1rpx solid $border-color;
      }

      &.confirm {
        background: $primary-gradient;
        color: #fff;
        box-shadow: $shadow-float;
      }

      &.delete {
        background: #FFF1F0;
        color: $error-color;
        flex: 0 0 152rpx;
        border: 1rpx solid #FFCCC7;
      }
    }
  }
}
</style>
