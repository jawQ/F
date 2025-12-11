/**
 * 日期处理工具函数
 */

/**
 * 格式化日期
 * @param {Date|String|Number} date 日期对象、时间戳或日期字符串
 * @param {String} format 格式化模板，默认 'YYYY-MM-DD'
 * @returns {String} 格式化后的日期字符串
 */
export function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return ''

    const d = new Date(date)
    if (isNaN(d.getTime())) return ''

    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    const second = String(d.getSeconds()).padStart(2, '0')

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hour)
        .replace('mm', minute)
        .replace('ss', second)
}

/**
 * 获取未来N天的日期范围
 * @param {Number} days 天数
 * @returns {Object} { start: Date, end: Date }
 */
export function getDateRange(days) {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const end = new Date(start)
    end.setDate(end.getDate() + days)

    return { start, end }
}

/**
 * 计算两个日期之间的天数差
 * @param {Date|String} date1 起始日期
 * @param {Date|String} date2 结束日期
 * @returns {Number} 天数差（可为负数）
 */
export function daysBetween(date1, date2) {
    const d1 = new Date(date1)
    const d2 = new Date(date2)
    const diffTime = d2.getTime() - d1.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * 判断日期是否在今天之前（已过期）
 * @param {Date|String} date 待判断的日期
 * @returns {Boolean}
 */
export function isOverdue(date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const targetDate = new Date(date)
    targetDate.setHours(0, 0, 0, 0)
    return targetDate < today
}

/**
 * 判断日期是否为今天
 * @param {Date|String} date 待判断的日期
 * @returns {Boolean}
 */
export function isToday(date) {
    const today = new Date()
    const targetDate = new Date(date)
    return (
        today.getFullYear() === targetDate.getFullYear() &&
        today.getMonth() === targetDate.getMonth() &&
        today.getDate() === targetDate.getDate()
    )
}

/**
 * 获取相对时间描述
 * @param {Date|String} date 日期
 * @returns {String} 相对时间描述，如"今天"、"明天"、"3天后"
 */
export function getRelativeTime(date) {
    const days = daysBetween(new Date(), date)

    if (days < 0) {
        return `已逾期${Math.abs(days)}天`
    } else if (days === 0) {
        return '今天'
    } else if (days === 1) {
        return '明天'
    } else if (days === 2) {
        return '后天'
    } else if (days <= 7) {
        return `${days}天后`
    } else {
        return formatDate(date, 'MM-DD')
    }
}

/**
 * 获取当月的天数
 * @param {Number} year 年份
 * @param {Number} month 月份（1-12）
 * @returns {Number} 天数
 */
export function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate()
}

/**
 * 获取本月的缴费日期
 * @param {Number} payDay 每月缴费日（1-28）
 * @returns {Date} 本月的缴费日期
 */
export function getPaymentDate(payDay) {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()

    // 确保 payDay 在有效范围内
    const validPayDay = Math.min(Math.max(1, payDay), 28)

    return new Date(year, month, validPayDay)
}
