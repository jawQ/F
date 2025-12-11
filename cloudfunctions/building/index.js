/**
 * building 云函数
 * 楼栋管理：添加、查询、切换楼栋
 */
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const buildingsCollection = db.collection('buildings')
const usersCollection = db.collection('users')

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
    const { action } = event
    const wxContext = cloud.getWXContext()

    switch (action) {
        case 'getList':
            return await getList(wxContext)
        case 'add':
            return await addBuilding(event, wxContext)
        case 'update':
            return await updateBuilding(event)
        case 'delete':
            return await deleteBuilding(event, wxContext)
        case 'switchBuilding':
            return await switchBuilding(event, wxContext)
        default:
            return { code: -1, message: '未知操作类型' }
    }
}

/**
 * 获取用户的楼栋列表
 * @param {Object} wxContext 微信上下文
 */
async function getList(wxContext) {
    const { OPENID } = wxContext

    try {
        // 先获取用户信息，拿到绑定的楼栋ID列表
        const userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        if (userResult.data.length === 0) {
            return { code: -1, message: '用户不存在' }
        }

        const user = userResult.data[0]
        const buildingIds = user.buildings || []

        if (buildingIds.length === 0) {
            return { code: 0, data: { list: [], currentBuilding: null } }
        }

        // 获取楼栋详细信息
        const buildingResult = await buildingsCollection
            .where({ _id: _.in(buildingIds) })
            .orderBy('createTime', 'asc')
            .get()

        // 获取当前选中的楼栋
        let currentBuilding = null
        if (user.currentBuilding) {
            currentBuilding = buildingResult.data.find(b => b._id === user.currentBuilding)
        }
        if (!currentBuilding && buildingResult.data.length > 0) {
            currentBuilding = buildingResult.data[0]
        }

        return {
            code: 0,
            data: {
                list: buildingResult.data,
                currentBuilding
            }
        }

    } catch (error) {
        console.error('getList error:', error)
        return { code: -1, message: '获取楼栋列表失败：' + error.message }
    }
}

/**
 * 添加楼栋
 * @param {Object} event
 * @param {Object} wxContext
 */
async function addBuilding(event, wxContext) {
    const { name, address } = event
    const { OPENID } = wxContext

    if (!name) {
        return { code: -1, message: '楼栋名称不能为空' }
    }

    try {
        // 获取用户信息
        const userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        if (userResult.data.length === 0) {
            return { code: -1, message: '用户不存在，请先登录' }
        }

        const user = userResult.data[0]

        // 创建楼栋
        const now = db.serverDate()
        const buildingData = {
            name,
            address: address || '',
            ownerId: user._id,
            roomCount: 0,
            createTime: now,
            updateTime: now
        }

        const addResult = await buildingsCollection.add({ data: buildingData })
        const buildingId = addResult._id

        // 更新用户的楼栋列表
        const newBuildings = [...(user.buildings || []), buildingId]
        const updateData = {
            buildings: newBuildings,
            updateTime: now
        }

        // 如果是第一个楼栋，设为当前楼栋
        if (newBuildings.length === 1) {
            updateData.currentBuilding = buildingId
        }

        await usersCollection.doc(user._id).update({ data: updateData })

        return {
            code: 0,
            message: '添加成功',
            data: {
                _id: buildingId,
                name,
                address: address || '',
                roomCount: 0
            }
        }

    } catch (error) {
        console.error('addBuilding error:', error)
        return { code: -1, message: '添加楼栋失败：' + error.message }
    }
}

/**
 * 更新楼栋信息
 * @param {Object} event
 */
async function updateBuilding(event) {
    const { buildingId, name, address } = event

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        const updateData = {
            updateTime: db.serverDate()
        }

        if (name !== undefined) updateData.name = name
        if (address !== undefined) updateData.address = address

        await buildingsCollection.doc(buildingId).update({ data: updateData })

        return { code: 0, message: '更新成功' }

    } catch (error) {
        console.error('updateBuilding error:', error)
        return { code: -1, message: '更新楼栋失败：' + error.message }
    }
}

/**
 * 删除楼栋
 * @param {Object} event
 * @param {Object} wxContext
 */
async function deleteBuilding(event, wxContext) {
    const { buildingId } = event
    const { OPENID } = wxContext

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        // 检查楼栋下是否有房间
        const roomCount = await db.collection('rooms')
            .where({ buildingId })
            .count()

        if (roomCount.total > 0) {
            return { code: -1, message: '该楼栋下还有房间，无法删除' }
        }

        // 删除楼栋
        await buildingsCollection.doc(buildingId).remove()

        // 更新用户的楼栋列表
        const userResult = await usersCollection
            .where({ openid: OPENID })
            .get()

        if (userResult.data.length > 0) {
            const user = userResult.data[0]
            const newBuildings = (user.buildings || []).filter(id => id !== buildingId)

            const updateData = {
                buildings: newBuildings,
                updateTime: db.serverDate()
            }

            // 如果删除的是当前楼栋，切换到第一个楼栋
            if (user.currentBuilding === buildingId) {
                updateData.currentBuilding = newBuildings[0] || ''
            }

            await usersCollection.doc(user._id).update({ data: updateData })
        }

        return { code: 0, message: '删除成功' }

    } catch (error) {
        console.error('deleteBuilding error:', error)
        return { code: -1, message: '删除楼栋失败：' + error.message }
    }
}

/**
 * 切换当前楼栋
 * @param {Object} event
 * @param {Object} wxContext
 */
async function switchBuilding(event, wxContext) {
    const { buildingId } = event
    const { OPENID } = wxContext

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        // 更新用户的当前楼栋
        await usersCollection
            .where({ openid: OPENID })
            .update({
                data: {
                    currentBuilding: buildingId,
                    updateTime: db.serverDate()
                }
            })

        // 获取楼栋信息返回
        const buildingResult = await buildingsCollection.doc(buildingId).get()

        return {
            code: 0,
            message: '切换成功',
            data: buildingResult.data
        }

    } catch (error) {
        console.error('switchBuilding error:', error)
        return { code: -1, message: '切换楼栋失败：' + error.message }
    }
}
