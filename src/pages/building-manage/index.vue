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
  background: #f5f5f5;
  padding: 24rpx;
  padding-bottom: 180rpx;
}

.building-list {
  .building-card {
    background: #fff;
    border-radius: 24rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);

    .building-info {
      display: flex;
      align-items: center;
      margin-bottom: 20rpx;

      .building-icon {
        font-size: 48rpx;
        margin-right: 20rpx;
      }

      .building-detail {
        flex: 1;

        .building-name {
          font-size: 32rpx;
          font-weight: 600;
          color: #1f2937;
          display: block;
        }

        .building-address {
          font-size: 26rpx;
          color: #6b7280;
          margin-top: 6rpx;
        }
      }
    }

    .building-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 20rpx;
      border-top: 1rpx solid #f3f4f6;

      .room-count {
        font-size: 26rpx;
        color: #3B82F6;
        background: #EFF6FF;
        padding: 8rpx 20rpx;
        border-radius: 20rpx;
      }

      .building-actions {
        display: flex;
        gap: 24rpx;

        .action-btn {
          font-size: 26rpx;
          padding: 8rpx 20rpx;
          border-radius: 8rpx;

          &.manage {
            color: #10B981;
            background: #ECFDF5;
          }

          &.edit {
            color: #3B82F6;
          }

          &.delete {
            color: #EF4444;
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
  padding: 100rpx 0;

  .empty-icon {
    font-size: 100rpx;
    margin-bottom: 24rpx;
  }

  .empty-text {
    font-size: 32rpx;
    color: #1f2937;
    margin-bottom: 12rpx;
  }

  .empty-tips {
    font-size: 26rpx;
    color: #9ca3af;
  }
}

.add-btn-wrapper {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 48rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);

  .add-btn {
    width: 100%;
    height: 96rpx;
    background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%);
    color: #fff;
    font-size: 32rpx;
    font-weight: 500;
    border-radius: 48rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;

    .add-icon {
      font-size: 40rpx;
      margin-right: 12rpx;
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
    gap: 24rpx;
    margin-top: 40rpx;

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
      }

      &.confirm {
        background: #3B82F6;
        color: #fff;
      }
    }
  }
}
</style>
