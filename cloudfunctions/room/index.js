/**
 * room 云函数
 * 房间管理：CRUD操作、获取待缴房租列表
 */
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const roomsCollection = db.collection('rooms')
const rentRecordsCollection = db.collection('rentRecords')

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
    const { action } = event
    const wxContext = cloud.getWXContext()

    switch (action) {
        case 'getPendingRent':
            return await getPendingRent(event)
        case 'getRoomDetail':
            return await getRoomDetail(event)
        case 'getRoomList':
            return await getRoomList(event)
        case 'addRoom':
            return await addRoom(event, wxContext)
        case 'updateRoom':
            return await updateRoom(event)
        case 'deleteRoom':
            return await deleteRoom(event)
        case 'markPaid':
            return await markPaid(event)
        default:
            return { code: -1, message: '未知操作类型' }
    }
}

/**
 * 获取七天内待缴房租的房间列表
 * @param {Object} event
 * @param {String} event.buildingId 楼栋ID
 */
async function getPendingRent(event) {
    const { buildingId } = event

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        // 计算七天内的日期范围
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const sevenDaysLater = new Date(today)
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

        // 查询待缴费记录
        const rentResult = await rentRecordsCollection
            .where({
                buildingId,
                status: _.in(['pending', 'overdue']),
                dueDate: _.gte(today).and(_.lte(sevenDaysLater))
            })
            .orderBy('dueDate', 'asc')
            .get()

        if (rentResult.data.length === 0) {
            return { code: 0, data: [] }
        }

        // 获取关联的房间信息
        const roomIds = [...new Set(rentResult.data.map(r => r.roomId))]
        const roomResult = await roomsCollection
            .where({ _id: _.in(roomIds) })
            .get()

        const roomMap = {}
        roomResult.data.forEach(room => {
            roomMap[room._id] = room
        })

        // 组合数据
        const list = rentResult.data.map(record => {
            const room = roomMap[record.roomId] || {}
            return {
                recordId: record._id,
                roomId: record.roomId,
                roomNumber: room.roomNumber || '',
                roomImage: room.roomImage || '',
                tenantName: room.tenant?.name || '空置',
                amount: record.amount,
                dueDate: record.dueDate,
                status: record.status
            }
        })

        return { code: 0, data: list }

    } catch (error) {
        console.error('getPendingRent error:', error)
        return { code: -1, message: '获取待缴房租失败：' + error.message }
    }
}

/**
 * 获取房间详情
 * @param {Object} event
 * @param {String} event.roomId 房间ID
 */
async function getRoomDetail(event) {
    const { roomId } = event

    if (!roomId) {
        return { code: -1, message: '缺少房间ID' }
    }

    try {
        const roomResult = await roomsCollection.doc(roomId).get()

        if (!roomResult.data) {
            return { code: -1, message: '房间不存在' }
        }

        // 获取该房间的缴费记录
        const rentResult = await rentRecordsCollection
            .where({ roomId })
            .orderBy('dueDate', 'desc')
            .limit(12) // 最近12条记录
            .get()

        return {
            code: 0,
            data: {
                room: roomResult.data,
                rentRecords: rentResult.data
            }
        }

    } catch (error) {
        console.error('getRoomDetail error:', error)
        return { code: -1, message: '获取房间详情失败：' + error.message }
    }
}

/**
 * 获取楼栋下所有房间列表
 * @param {Object} event
 * @param {String} event.buildingId 楼栋ID
 */
async function getRoomList(event) {
    const { buildingId, page = 1, pageSize = 20 } = event

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        const skip = (page - 1) * pageSize

        // 获取总数
        const countResult = await roomsCollection
            .where({ buildingId })
            .count()

        // 获取列表
        const roomResult = await roomsCollection
            .where({ buildingId })
            .orderBy('roomNumber', 'asc')
            .skip(skip)
            .limit(pageSize)
            .get()

        return {
            code: 0,
            data: {
                list: roomResult.data,
                total: countResult.total,
                page,
                pageSize
            }
        }

    } catch (error) {
        console.error('getRoomList error:', error)
        return { code: -1, message: '获取房间列表失败：' + error.message }
    }
}

/**
 * 添加房间
 * @param {Object} event
 */
async function addRoom(event, wxContext) {
    const { buildingId, roomNumber, roomImage, area, monthlyRent, tenant, leaseInfo } = event

    if (!buildingId || !roomNumber) {
        return { code: -1, message: '楼栋ID和房间号不能为空' }
    }

    try {
        // 检查房间号是否已存在
        const existResult = await roomsCollection
            .where({ buildingId, roomNumber })
            .count()

        if (existResult.total > 0) {
            return { code: -1, message: '该房间号已存在' }
        }

        const now = db.serverDate()
        const roomData = {
            buildingId,
            roomNumber,
            roomImage: roomImage || '',
            area: area || 0,
            monthlyRent: monthlyRent || 0,
            status: tenant?.name ? 'rented' : 'empty',
            tenant: tenant || { name: '', phone: '', idCard: '' },
            leaseInfo: leaseInfo || { startDate: '', endDate: '', payDay: 1, deposit: 0 },
            createTime: now,
            updateTime: now
        }

        const addResult = await roomsCollection.add({ data: roomData })

        // 更新楼栋房间数量
        await db.collection('buildings')
            .doc(buildingId)
            .update({ data: { roomCount: _.inc(1) } })

        return {
            code: 0,
            message: '添加成功',
            data: { _id: addResult._id }
        }

    } catch (error) {
        console.error('addRoom error:', error)
        return { code: -1, message: '添加房间失败：' + error.message }
    }
}

/**
 * 更新房间信息
 * @param {Object} event
 */
async function updateRoom(event) {
    const { roomId, ...updateData } = event

    if (!roomId) {
        return { code: -1, message: '缺少房间ID' }
    }

    try {
        delete updateData.action
        delete updateData._id
        delete updateData.createTime
        updateData.updateTime = db.serverDate()

        // 根据租客信息更新状态
        if (updateData.tenant !== undefined) {
            updateData.status = updateData.tenant?.name ? 'rented' : 'empty'
        }

        await roomsCollection.doc(roomId).update({ data: updateData })

        return { code: 0, message: '更新成功' }

    } catch (error) {
        console.error('updateRoom error:', error)
        return { code: -1, message: '更新房间失败：' + error.message }
    }
}

/**
 * 删除房间
 * @param {Object} event
 */
async function deleteRoom(event) {
    const { roomId, buildingId } = event

    if (!roomId) {
        return { code: -1, message: '缺少房间ID' }
    }

    try {
        await roomsCollection.doc(roomId).remove()

        // 更新楼栋房间数量
        if (buildingId) {
            await db.collection('buildings')
                .doc(buildingId)
                .update({ data: { roomCount: _.inc(-1) } })
        }

        // 删除相关的租金记录
        await rentRecordsCollection.where({ roomId }).remove()

        return { code: 0, message: '删除成功' }

    } catch (error) {
        console.error('deleteRoom error:', error)
        return { code: -1, message: '删除房间失败：' + error.message }
    }
}

/**
 * 标记租金已缴纳
 * @param {Object} event
 * @param {String} event.recordId 租金记录ID
 */
async function markPaid(event) {
    const { recordId } = event

    if (!recordId) {
        return { code: -1, message: '缺少记录ID' }
    }

    try {
        await rentRecordsCollection.doc(recordId).update({
            data: {
                status: 'paid',
                paidDate: db.serverDate()
            }
        })

        return { code: 0, message: '已标记为已缴费' }

    } catch (error) {
        console.error('markPaid error:', error)
        return { code: -1, message: '操作失败：' + error.message }
    }
}
