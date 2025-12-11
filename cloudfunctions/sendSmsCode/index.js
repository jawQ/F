/**
 * sendSmsCode 云函数
 * 发送短信验证码（使用腾讯云短信服务）
 * 
 * 注意：使用此功能需要：
 * 1. 在腾讯云开通短信服务
 * 2. 创建短信签名和模板
 * 3. 配置 SecretId 和 SecretKey
 */
const cloud = require('wx-server-sdk')
const tencentcloud = require('tencentcloud-sdk-nodejs')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const smsCodeCollection = db.collection('smsCode')

// 腾讯云短信配置（需要替换为实际值）
const SMS_CONFIG = {
    secretId: 'your-secret-id',       // 腾讯云 SecretId
    secretKey: 'your-secret-key',     // 腾讯云 SecretKey
    smsSdkAppId: '1400000000',        // 短信应用 SDK AppID
    signName: '房东助手',              // 短信签名
    templateId: '1000000'             // 短信模板 ID
}

/**
 * 主入口函数
 */
exports.main = async (event, context) => {
    const { phone } = event

    if (!phone) {
        return { code: -1, message: '手机号不能为空' }
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        return { code: -1, message: '手机号格式不正确' }
    }

    try {
        // 检查发送频率（1分钟内只能发送一次）
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000)
        const recentResult = await smsCodeCollection
            .where({
                phone,
                createTime: db.command.gte(oneMinuteAgo)
            })
            .count()

        if (recentResult.total > 0) {
            return { code: -1, message: '发送太频繁，请1分钟后再试' }
        }

        // 生成6位随机验证码
        const code = String(Math.floor(100000 + Math.random() * 900000))

        // 发送短信
        const sendResult = await sendSms(phone, code)

        if (!sendResult.success) {
            return { code: -1, message: sendResult.message }
        }

        // 存储验证码
        await smsCodeCollection.add({
            data: {
                phone,
                code,
                used: false,
                createTime: db.serverDate()
            }
        })

        return {
            code: 0,
            message: '验证码已发送'
        }

    } catch (error) {
        console.error('sendSmsCode error:', error)
        return { code: -1, message: '发送验证码失败：' + error.message }
    }
}

/**
 * 调用腾讯云短信服务发送短信
 * @param {String} phone 手机号
 * @param {String} code 验证码
 */
async function sendSms(phone, code) {
    // 如果未配置短信服务，使用模拟模式
    if (SMS_CONFIG.secretId === 'your-secret-id') {
        console.log(`[模拟发送] 手机号: ${phone}, 验证码: ${code}`)
        return { success: true, message: '验证码已发送（模拟模式）' }
    }

    try {
        const SmsClient = tencentcloud.sms.v20210111.Client

        const client = new SmsClient({
            credential: {
                secretId: SMS_CONFIG.secretId,
                secretKey: SMS_CONFIG.secretKey
            },
            region: 'ap-guangzhou',
            profile: {
                httpProfile: {
                    endpoint: 'sms.tencentcloudapi.com'
                }
            }
        })

        const params = {
            PhoneNumberSet: [`+86${phone}`],
            SmsSdkAppId: SMS_CONFIG.smsSdkAppId,
            SignName: SMS_CONFIG.signName,
            TemplateId: SMS_CONFIG.templateId,
            TemplateParamSet: [code, '5'] // 验证码和有效期分钟数
        }

        const result = await client.SendSms(params)

        if (result.SendStatusSet && result.SendStatusSet[0].Code === 'Ok') {
            return { success: true, message: '发送成功' }
        } else {
            const errorMsg = result.SendStatusSet?.[0]?.Message || '发送失败'
            return { success: false, message: errorMsg }
        }

    } catch (error) {
        console.error('sendSms error:', error)
        return { success: false, message: error.message }
    }
}
