import { defineStore } from 'pinia'

/**
 * 用户状态管理
 * 管理用户登录态、用户信息、当前楼栋等核心状态
 */
export const useUserStore = defineStore('user', {
    state: () => ({
        // 用户是否已登录
        isLoggedIn: false,
        // 用户信息
        userInfo: null,
        // 登录 token
        token: '',
        // 用户绑定的楼栋列表
        buildings: [],
        // 当前选中的楼栋
        currentBuilding: null
    }),

    getters: {
        // 获取当前楼栋ID
        currentBuildingId: (state) => state.currentBuilding?._id || '',
        // 获取当前楼栋名称
        currentBuildingName: (state) => state.currentBuilding?.name || '未选择楼栋',
        // 是否有绑定楼栋
        hasBuildings: (state) => state.buildings.length > 0
    },

    actions: {
        /**
         * 设置用户信息
         * @param {Object} info 用户信息对象
         */
        setUserInfo(info) {
            this.userInfo = info
            this.isLoggedIn = !!info
            if (info) {
                uni.setStorageSync('userInfo', info)
            } else {
                uni.removeStorageSync('userInfo')
            }
        },

        /**
         * 设置 token
         * @param {String} token 登录 token
         */
        setToken(token) {
            this.token = token
            if (token) {
                uni.setStorageSync('token', token)
            } else {
                uni.removeStorageSync('token')
            }
        },

        /**
         * 设置楼栋列表
         * @param {Array} list 楼栋列表
         */
        setBuildings(list) {
            this.buildings = list || []

            // 如果没有当前楼栋，默认选中第一个
            if (!this.currentBuilding && this.buildings.length > 0) {
                this.switchBuilding(this.buildings[0])
            }
        },

        /**
         * 切换当前楼栋
         * @param {Object} building 楼栋对象
         */
        switchBuilding(building) {
            this.currentBuilding = building
            if (building) {
                uni.setStorageSync('currentBuilding', building)
            } else {
                uni.removeStorageSync('currentBuilding')
            }
        },

        /**
         * 添加楼栋到列表
         * @param {Object} building 新楼栋对象
         */
        addBuilding(building) {
            this.buildings.push(building)
            // 如果是第一个楼栋，自动选中
            if (this.buildings.length === 1) {
                this.switchBuilding(building)
            }
        },

        /**
         * 登出
         */
        logout() {
            this.isLoggedIn = false
            this.userInfo = null
            this.token = ''
            this.buildings = []
            this.currentBuilding = null

            uni.removeStorageSync('userInfo')
            uni.removeStorageSync('token')
            uni.removeStorageSync('currentBuilding')
        },

        /**
         * 从本地存储恢复状态
         */
        restoreFromStorage() {
            const userInfo = uni.getStorageSync('userInfo')
            const token = uni.getStorageSync('token')
            const currentBuilding = uni.getStorageSync('currentBuilding')

            if (userInfo && token) {
                this.userInfo = userInfo
                this.token = token
                this.isLoggedIn = true
            }

            if (currentBuilding) {
                this.currentBuilding = currentBuilding
            }
        }
    }
})
