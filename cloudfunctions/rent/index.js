/**
 * rent 云函数
 * 租金记录管理：生成月度租金记录、查询租金历史
 */
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command
const rentRecordsCollection = db.collection('rentRecords')
const roomsCollection = db.collection('rooms')

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
    const { action } = event

    switch (action) {
        case 'generateMonthlyRent':
            return await generateMonthlyRent(event)
        case 'getHistory':
            return await getHistory(event)
        case 'getStats':
            return await getStats(event)
        default:
            return { code: -1, message: '未知操作类型' }
    }
}

/**
 * 生成本月租金记录
 * 通常通过定时触发器每月1日自动执行
 * @param {Object} event
 * @param {String} event.buildingId 楼栋ID（可选，不传则生成所有楼栋）
 */
async function generateMonthlyRent(event) {
    const { buildingId } = event

    try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1

        // 查询条件
        const roomQuery = { status: 'rented' }
        if (buildingId) {
            roomQuery.buildingId = buildingId
        }

        // 获取所有已出租的房间
        const roomResult = await roomsCollection
            .where(roomQuery)
            .get()

        if (roomResult.data.length === 0) {
            return { code: 0, message: '没有需要生成租金记录的房间', data: { count: 0 } }
        }

        let generatedCount = 0

        for (const room of roomResult.data) {
            // 检查是否已生成过本月记录
            const existResult = await rentRecordsCollection
                .where({
                    roomId: room._id,
                    year,
                    month
                })
                .count()

            if (existResult.total > 0) {
                continue // 已存在，跳过
            }

            // 计算缴费截止日期
            const payDay = room.leaseInfo?.payDay || 1
            const dueDate = new Date(year, month - 1, payDay)

            // 判断是否已逾期
            const status = dueDate < now ? 'overdue' : 'pending'

            // 创建租金记录
            await rentRecordsCollection.add({
                data: {
                    roomId: room._id,
                    buildingId: room.buildingId,
                    roomNumber: room.roomNumber,
                    tenantName: room.tenant?.name || '',
                    amount: room.monthlyRent || 0,
                    year,
                    month,
                    dueDate,
                    paidDate: null,
                    status,
                    createTime: db.serverDate()
                }
            })

            generatedCount++
        }

        return {
            code: 0,
            message: `成功生成 ${generatedCount} 条租金记录`,
            data: { count: generatedCount }
        }

    } catch (error) {
        console.error('generateMonthlyRent error:', error)
        return { code: -1, message: '生成租金记录失败：' + error.message }
    }
}

/**
 * 获取租金历史记录
 * @param {Object} event
 * @param {String} event.roomId 房间ID（可选）
 * @param {String} event.buildingId 楼栋ID（可选）
 * @param {String} event.status 状态筛选（可选）
 */
async function getHistory(event) {
    const { roomId, buildingId, status, page = 1, pageSize = 20 } = event

    try {
        const query = {}
        if (roomId) query.roomId = roomId
        if (buildingId) query.buildingId = buildingId
        if (status) query.status = status

        const skip = (page - 1) * pageSize

        // 获取总数
        const countResult = await rentRecordsCollection
            .where(query)
            .count()

        // 获取列表
        const listResult = await rentRecordsCollection
            .where(query)
            .orderBy('dueDate', 'desc')
            .skip(skip)
            .limit(pageSize)
            .get()

        return {
            code: 0,
            data: {
                list: listResult.data,
                total: countResult.total,
                page,
                pageSize
            }
        }

    } catch (error) {
        console.error('getHistory error:', error)
        return { code: -1, message: '获取租金历史失败：' + error.message }
    }
}

/**
 * 获取租金统计
 * @param {Object} event
 * @param {String} event.buildingId 楼栋ID
 */
async function getStats(event) {
    const { buildingId } = event

    if (!buildingId) {
        return { code: -1, message: '缺少楼栋ID' }
    }

    try {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1

        // 本月待缴
        const pendingResult = await rentRecordsCollection
            .where({
                buildingId,
                year,
                month,
                status: _.in(['pending', 'overdue'])
            })
            .get()

        // 本月已缴
        const paidResult = await rentRecordsCollection
            .where({
                buildingId,
                year,
                month,
                status: 'paid'
            })
            .get()

        // 逾期数量
        const overdueResult = await rentRecordsCollection
            .where({
                buildingId,
                status: 'overdue'
            })
            .count()

        // 计算金额
        const pendingAmount = pendingResult.data.reduce((sum, r) => sum + (r.amount || 0), 0)
        const paidAmount = paidResult.data.reduce((sum, r) => sum + (r.amount || 0), 0)

        return {
            code: 0,
            data: {
                pendingCount: pendingResult.data.length,
                pendingAmount,
                paidCount: paidResult.data.length,
                paidAmount,
                overdueCount: overdueResult.total
            }
        }

    } catch (error) {
        console.error('getStats error:', error)
        return { code: -1, message: '获取统计失败：' + error.message }
    }
}
