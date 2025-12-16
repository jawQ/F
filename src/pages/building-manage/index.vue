<template>
  <view class="page">
    <!-- 楼栋列表 -->
    <view class="building-list">
      <view 
        v-for="building in buildings" 
        :key="building._id"
        class="building-card"
      >
        <view class="building-info">
          <text class="building-icon">🏢</text>
          <view class="building-detail">
            <text class="building-name">{{ building.name }}</text>
            <text class="building-address">{{ building.address || '未设置地址' }}</text>
          </view>
        </view>
        <view class="building-meta">
          <text class="room-count">{{ building.roomCount || 0 }}间房</text>
            <view class="building-actions">
            <text class="action-btn manage" @click="manageRooms(building)">管理房间</text>
            <text class="action-btn edit" @click="editBuilding(building)">编辑</text>
            <text class="action-btn delete" @click="deleteBuilding(building)">删除</text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="buildings.length === 0" class="empty-state">
        <text class="empty-icon">🏗️</text>
        <text class="empty-text">还没有添加楼栋</text>
        <text class="empty-tips">点击下方按钮添加您的第一个楼栋</text>
      </view>
    </view>

    <!-- 添加楼栋按钮 -->
    <view class="add-btn-wrapper">
      <button class="add-btn" @click="showAddModal">
        <text class="add-icon">+</text>
        <text>添加楼栋</text>
      </button>
    </view>

    <!-- 添加/编辑弹窗 -->
    <uni-popup ref="formPopup" type="center">
      <view class="form-popup">
        <text class="popup-title">{{ isEdit ? '编辑楼栋' : '添加楼栋' }}</text>
        
        <view class="form-group">
          <text class="form-label">楼栋名称 *</text>
          <input 
            class="form-input" 
            v-model="formData.name"
            placeholder="如：A栋、1号楼"
          />
        </view>

        <view class="form-group">
          <text class="form-label">楼栋地址</text>
          <input 
            class="form-input" 
            v-model="formData.address"
            placeholder="选填，方便识别"
          />
        </view>

        <view class="popup-actions">
          <button class="popup-btn cancel" @click="closePopup">取消</button>
          <button class="popup-btn confirm" @click="submitForm">确定</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
import { ref, onMounted } from 'vue'
import { callCloud } from '@/utils/cloud'
import { useUserStore } from '@/store/user'

export default {
  setup() {
    const userStore = useUserStore()
    
    const buildings = ref([])
    const formPopup = ref(null)
    const isEdit = ref(false)
    const editingId = ref('')
    const formData = ref({
      name: '',
      address: ''
    })
    
    // 获取楼栋列表
    const fetchBuildings = async () => {
      try {
        const result = await callCloud('building', {
          action: 'getList'
        })
        
        if (result) {
          buildings.value = result.list || []
          userStore.setBuildings(result.list || [])
        }
      } catch (error) {
        console.error('获取楼栋列表失败:', error)
      }
    }
    
    // 显示添加弹窗
    const showAddModal = () => {
      isEdit.value = false
      editingId.value = ''
      formData.value = { name: '', address: '' }
      formPopup.value.open()
    }
    
    // 编辑楼栋
    const editBuilding = (building) => {
      isEdit.value = true
      editingId.value = building._id
      formData.value = {
        name: building.name,
        address: building.address || ''
      }
      formPopup.value.open()
    }
    
    // 删除楼栋
    const deleteBuilding = (building) => {
      uni.showModal({
        title: '确认删除',
        content: `确定要删除"${building.name}"吗？删除后无法恢复。`,
        confirmColor: '#EF4444',
        success: async (res) => {
          if (res.confirm) {
            try {
              await callCloud('building', {
                action: 'delete',
                buildingId: building._id
              })
              
              // 从列表中移除
              buildings.value = buildings.value.filter(b => b._id !== building._id)
              
              // 通知其他页面更新
              uni.$emit('buildingUpdated')
              
              uni.showToast({ title: '删除成功', icon: 'success' })
            } catch (error) {
              console.error('删除失败:', error)
            }
          }
        }
      })
    }
    
    // 提交表单
    const submitForm = async () => {
      if (!formData.value.name.trim()) {
        uni.showToast({ title: '请输入楼栋名称', icon: 'none' })
        return
      }
      
      try {
        if (isEdit.value) {
          // 编辑模式
          await callCloud('building', {
            action: 'update',
            buildingId: editingId.value,
            name: formData.value.name,
            address: formData.value.address
          })
          
          // 更新列表
          const idx = buildings.value.findIndex(b => b._id === editingId.value)
          if (idx !== -1) {
            buildings.value[idx].name = formData.value.name
            buildings.value[idx].address = formData.value.address
          }
          
          uni.showToast({ title: '更新成功', icon: 'success' })
        } else {
          // 添加模式
          const result = await callCloud('building', {
            action: 'add',
            name: formData.value.name,
            address: formData.value.address
          })
          
          if (result) {
            buildings.value.push(result)
            userStore.addBuilding(result)
          }
          
          uni.showToast({ title: '添加成功', icon: 'success' })
        }
        
        // 通知其他页面更新
        uni.$emit('buildingUpdated')
        
        closePopup()
      } catch (error) {
        console.error('操作失败:', error)
      }
    }
    
    // 关闭弹窗
    const closePopup = () => {
      formPopup.value.close()
    }
    
    onMounted(() => {
      fetchBuildings()
    })
    
    return {
      buildings,
      formPopup,
      isEdit,
      formData,
      showAddModal,
      editBuilding,
      deleteBuilding,
      submitForm,
      closePopup,
      manageRooms: (building) => {
        uni.navigateTo({
          url: `/pages/room-manage/index?buildingId=${building._id}&buildingName=${building.name}`
        })
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: $bg-color;
  padding: 32rpx;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.building-list {
  .building-card {
    background: $bg-white;
    border-radius: $radius-md;
    padding: 32rpx;
    margin-bottom: 32rpx;
    box-shadow: $shadow-sm;
    transition: all 0.2s ease;
    
    &:active {
      transform: scale(0.98);
      box-shadow: none;
    }

    .building-info {
      display: flex;
      align-items: flex-start;
      margin-bottom: 24rpx;

      .building-icon {
        font-size: 80rpx;
        margin-right: 24rpx;
        background: $bg-color;
        border-radius: $radius-md;
        width: 120rpx;
        height: 120rpx;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .building-detail {
        flex: 1;
        padding-top: 8rpx;

        .building-name {
          font-size: $font-size-lg;
          font-weight: 700;
          color: $text-main;
          display: block;
          margin-bottom: 8rpx;
        }

        .building-address {
          font-size: $font-size-sm;
          color: $text-secondary;
          line-height: 1.4;
        }
      }
    }

    .building-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 24rpx;
      border-top: 1rpx solid $border-color;

      .room-count {
        font-size: $font-size-xs;
        color: $primary-color;
        background: rgba($primary-color, 0.1);
        padding: 6rpx 20rpx;
        border-radius: $radius-full;
        font-weight: 600;
      }

      .building-actions {
        display: flex;
        gap: 20rpx;

        .action-btn {
          font-size: $font-size-sm;
          padding: 10rpx 24rpx;
          border-radius: $radius-sm;
          font-weight: 500;
          transition: background 0.2s;

          &.manage {
            color: #fff;
            background: $success-color;
            box-shadow: 0 4rpx 12rpx rgba($success-color, 0.3);
          }

          &.edit {
            color: $text-secondary;
            background: $bg-color;
          }

          &.delete {
            color: $error-color;
            background: rgba($error-color, 0.1);
          }
        }
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;

  .empty-icon {
    font-size: 120rpx;
    margin-bottom: 32rpx;
    opacity: 0.8;
  }

  .empty-text {
    font-size: $font-size-lg;
    color: $text-main;
    font-weight: 600;
    margin-bottom: 12rpx;
  }

  .empty-tips {
    font-size: $font-size-sm;
    color: $text-placeholder;
  }
}

.add-btn-wrapper {
  position: fixed;
  bottom: calc(40rpx + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none; // 让 wrapper 不阻挡点击，只有按钮阻挡

  .add-btn {
    pointer-events: auto;
    width: 320rpx;
    height: 96rpx;
    background: $primary-gradient;
    color: #fff;
    font-size: $font-size-base;
    font-weight: 600;
    border-radius: $radius-full;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    box-shadow: $shadow-float;
    transition: transform 0.2s;
    
    &:active {
      transform: scale(0.95);
    }

    .add-icon {
      font-size: 40rpx;
      margin-right: 12rpx;
      margin-bottom: 4rpx;
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
    gap: 32rpx;
    margin-top: 56rpx;

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
      }

      &.confirm {
        background: $primary-color;
        color: #fff;
        box-shadow: 0 4rpx 16rpx rgba($primary-color, 0.3);
      }
    }
  }
}
</style>
