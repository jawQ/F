/**
 * 云函数调用封装
 * 统一处理云函数调用、错误处理、loading 等
 */

// 云开发环境ID（需要在微信开发者工具中配置）
// 云开发环境ID（需要在微信开发者工具中配置）
const ENV_ID = import.meta.env.VITE_WX_ENV_ID


/**
 * 初始化云开发
 */
export function initCloud() {
    if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
        return false
    }

    wx.cloud.init({
        env: ENV_ID,
        traceUser: true
    })
    console.log('Cloud initialized with env:', ENV_ID)

    return true
}

/**
 * 调用云函数
 * @param {String} name 云函数名称
 * @param {Object} data 请求数据
 * @param {Object} options 配置选项
 * @param {Boolean} options.showLoading 是否显示 loading
 * @param {String} options.loadingText loading 文本
 * @param {Boolean} options.showError 是否显示错误提示
 * @returns {Promise}
 */
export async function callCloud(name, data = {}, options = {}) {
    const {
        showLoading = true,
        loadingText = '加载中...',
        showError = true
    } = options

    if (showLoading) {
        uni.showLoading({ title: loadingText, mask: true })
    }

    // 自动注入 token
    // 登录相关接口不需要 token，避免 token 过期导致死循环
    const whiteList = ['login', 'sendSmsCode']
    const token = uni.getStorageSync('token')
    const finalData = { ...data }

    if (token && !whiteList.includes(name)) {
        finalData.token = token
    }

    try {
        const res = await wx.cloud.callFunction({
            name,
            data: finalData
        })

        if (showLoading) {
            uni.hideLoading()
        }

        // 检查云函数返回结果
        if (res.result && res.result.code !== undefined) {
            // 统一的返回格式：{ code: 0, data: ..., message: '...' }
            if (res.result.code === 0) {
                return res.result.data
            } else {
                throw new Error(res.result.message || '操作失败')
            }
        }

        // 直接返回 result
        return res.result

    } catch (error) {
        if (showLoading) {
            uni.hideLoading()
        }

        console.error(`Cloud function [${name}] error:`, error)

        // 处理登录态失效
        if (error.errCode === -1 || error.message?.includes('登录')) {
            handleLoginExpired()
            throw error
        }

        if (showError) {
            uni.showToast({
                title: error.message || '网络请求失败',
                icon: 'none',
                duration: 2000
            })
        }

        throw error
    }
}

/**
 * 处理登录态失效
 */
function handleLoginExpired() {
    // 清除本地存储
    uni.removeStorageSync('token')
    uni.removeStorageSync('userInfo')

    uni.showModal({
        title: '登录已过期',
        content: '请重新登录',
        showCancel: false,
        success: () => {
            uni.navigateTo({
                url: '/pages/login/index'
            })
        }
    })
}

/**
 * 上传文件到云存储
 * @param {String} filePath 本地文件路径
 * @param {String} cloudPath 云存储路径
 * @returns {Promise<String>} 文件ID
 */
export async function uploadFile(filePath, cloudPath) {
    uni.showLoading({ title: '上传中...', mask: true })

    try {
        const res = await wx.cloud.uploadFile({
            cloudPath,
            filePath
        })

        uni.hideLoading()
        return res.fileID

    } catch (error) {
        uni.hideLoading()
        console.error('Upload file error:', error)

        uni.showToast({
            title: '上传失败',
            icon: 'none'
        })

        throw error
    }
}

/**
 * 获取临时文件链接
 * @param {Array<String>} fileList 文件ID列表
 * @returns {Promise<Array>} 临时链接列表
 */
export async function getTempFileURL(fileList) {
    try {
        const res = await wx.cloud.getTempFileURL({
            fileList
        })
        return res.fileList
    } catch (error) {
        console.error('Get temp file URL error:', error)
        throw error
    }
}
