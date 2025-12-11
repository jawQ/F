/**
 * login 云函数
 * 用户登录逻辑：支持微信登录获取 openid 和手机号验证码登录
 */
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const usersCollection = db.collection('users')

/**
 * 主入口函数
 * @param {Object} event 请求参数
 * @param {String} event.action 操作类型：wxLogin | phoneLogin | getUserInfo | updateUserInfo
 * @param {Object} context 云函数上下文
 */
exports.main = async (event, context) => {
    const { action } = event
    const wxContext = cloud.getWXContext()

    switch (action) {
        case 'wxLogin':
            return await wxLogin(wxContext)
        case 'phoneLogin':
            return await phoneLogin(event, wxContext)
        case 'getUserInfo':
            return await getUserInfo(wxContext)
        case 'updateUserInfo':
            return await updateUserInfo(event, wxContext)
        case 'getPhoneNumber':
            return await getPhoneNumber(event, wxContext)
        default:
            return {
                code: -1,
                message: '未知操作类型'
            }
    }
}

/**
 * 微信登录
 * 获取用户 openid，如果用户不存在则创建
 * @param {Object} wxContext 微信上下文
 */
async function wxLogin(wxContext) {
    const { OPENID, UNIONID } = wxContext

    if (!OPENID) {
        return {
            code: -1,
            message: '获取用户信息失败'
        }
    }

    try {
        // 查询用户是否存在
        const userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        let user = userResult.data[0]

        if (!user) {
            // 创建新用户
            const now = db.serverDate()
            const newUser = {
                openid: OPENID,
                unionid: UNIONID || '',
                phone: '',
                nickname: '',
                avatar: '',
                buildings: [],
                currentBuilding: '',
                createTime: now,
                updateTime: now
            }

            const addResult = await usersCollection.add({
                data: newUser
            })

            user = {
                _id: addResult._id,
                ...newUser
            }
        }

        return {
            code: 0,
            message: '登录成功',
            data: {
                token: OPENID, // 简单使用 openid 作为 token
                userInfo: formatUserInfo(user)
            }
        }

    } catch (error) {
        console.error('wxLogin error:', error)
        return {
            code: -1,
            message: '登录失败：' + error.message
        }
    }
}

/**
 * 获取手机号（通过 button 组件获取的加密手机号）
 * @param {Object} event 请求参数
 * @param {Object} wxContext 微信上下文
 */
async function getPhoneNumber(event, wxContext) {
    const { cloudID } = event
    const { OPENID } = wxContext

    if (!cloudID) {
        return {
            code: -1,
            message: '缺少 cloudID 参数'
        }
    }

    try {
        // 通过 cloudID 获取手机号
        const phoneResult = await cloud.getOpenData({
            list: [cloudID]
        })

        if (phoneResult.list && phoneResult.list[0] && phoneResult.list[0].data) {
            const phoneData = phoneResult.list[0].data
            const phone = phoneData.phoneNumber

            // 更新用户手机号
            await usersCollection
                .where({ openid: OPENID })
                .update({
                    data: {
                        phone,
                        updateTime: db.serverDate()
                    }
                })

            return {
                code: 0,
                message: '获取手机号成功',
                data: { phone }
            }
        }

        return {
            code: -1,
            message: '获取手机号失败'
        }

    } catch (error) {
        console.error('getPhoneNumber error:', error)
        return {
            code: -1,
            message: '获取手机号失败：' + error.message
        }
    }
}

/**
 * 手机号验证码登录
 * @param {Object} event 请求参数
 * @param {Object} wxContext 微信上下文
 */
async function phoneLogin(event, wxContext) {
    const { phone, code } = event
    const { OPENID } = wxContext

    if (!phone || !code) {
        return {
            code: -1,
            message: '手机号或验证码不能为空'
        }
    }

    try {
        // 验证验证码（这里简化处理，实际需要与发送的验证码对比）
        // 验证码验证逻辑在 sendSmsCode 云函数中存储，这里进行校验
        const verifyResult = await db.collection('smsCode')
            .where({
                phone,
                code,
                used: false
            })
            .orderBy('createTime', 'desc')
            .limit(1)
            .get()

        if (verifyResult.data.length === 0) {
            return {
                code: -1,
                message: '验证码错误或已过期'
            }
        }

        const smsRecord = verifyResult.data[0]

        // 检查验证码是否过期（5分钟有效期）
        const now = new Date()
        const codeTime = new Date(smsRecord.createTime)
        if (now - codeTime > 5 * 60 * 1000) {
            return {
                code: -1,
                message: '验证码已过期'
            }
        }

        // 标记验证码已使用
        await db.collection('smsCode').doc(smsRecord._id).update({
            data: { used: true }
        })

        // 查找或创建用户
        let userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        let user = userResult.data[0]

        if (user) {
            // 更新手机号
            await usersCollection.doc(user._id).update({
                data: {
                    phone,
                    updateTime: db.serverDate()
                }
            })
            user.phone = phone
        } else {
            // 创建新用户
            const now = db.serverDate()
            const newUser = {
                openid: OPENID,
                phone,
                nickname: '',
                avatar: '',
                buildings: [],
                currentBuilding: '',
                createTime: now,
                updateTime: now
            }

            const addResult = await usersCollection.add({
                data: newUser
            })

            user = {
                _id: addResult._id,
                ...newUser
            }
        }

        return {
            code: 0,
            message: '登录成功',
            data: {
                token: OPENID,
                userInfo: formatUserInfo(user)
            }
        }

    } catch (error) {
        console.error('phoneLogin error:', error)
        return {
            code: -1,
            message: '登录失败：' + error.message
        }
    }
}

/**
 * 获取用户信息
 * @param {Object} wxContext 微信上下文
 */
async function getUserInfo(wxContext) {
    const { OPENID } = wxContext

    try {
        const userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        if (userResult.data.length === 0) {
            return {
                code: -1,
                message: '用户不存在'
            }
        }

        return {
            code: 0,
            message: '获取成功',
            data: formatUserInfo(userResult.data[0])
        }

    } catch (error) {
        console.error('getUserInfo error:', error)
        return {
            code: -1,
            message: '获取用户信息失败：' + error.message
        }
    }
}

/**
 * 更新用户信息
 * @param {Object} event 请求参数
 * @param {Object} wxContext 微信上下文
 */
async function updateUserInfo(event, wxContext) {
    const { nickname, avatar } = event
    const { OPENID } = wxContext

    try {
        const updateData = {
            updateTime: db.serverDate()
        }

        if (nickname !== undefined) updateData.nickname = nickname
        if (avatar !== undefined) updateData.avatar = avatar

        await usersCollection
            .where({ openid: OPENID })
            .update({ data: updateData })

        return {
            code: 0,
            message: '更新成功'
        }

    } catch (error) {
        console.error('updateUserInfo error:', error)
        return {
            code: -1,
            message: '更新失败：' + error.message
        }
    }
}

/**
 * 格式化用户信息（过滤敏感字段）
 * @param {Object} user 用户数据
 */
function formatUserInfo(user) {
    return {
        _id: user._id,
        phone: user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '',
        nickname: user.nickname || '房东',
        avatar: user.avatar || '',
        buildings: user.buildings || [],
        currentBuilding: user.currentBuilding || ''
    }
}
