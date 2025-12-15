<template>
  <view class="page">
    <view class="login-container">
      <!-- Logo -->
      <view class="logo-section">
        <text class="logo-icon">🏠</text>
        <text class="logo-title">房东助手</text>
        <text class="logo-subtitle">让租房管理更简单</text>
      </view>

      <!-- 登录方式选择 -->
      <view class="login-methods">
        <!-- 微信一键登录 -->
        <button
          class="login-btn wechat-btn"
          open-type="getUserInfo"
          @click="handleWxLogin"
        >
          <text class="btn-icon">💬</text>
          <text>微信一键登录</text>
        </button>

        <!-- 获取手机号登录 -->
        <button
          class="login-btn phone-btn"
          open-type="getPhoneNumber"
          @getphonenumber="handleGetPhoneNumber"
        >
          <text class="btn-icon">📱</text>
          <text>手机号快捷登录</text>
        </button>

        <!-- 分割线 -->
        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">或</text>
          <view class="divider-line"></view>
        </view>

        <!-- 手机号验证码登录 -->
        <view class="phone-login-form">
          <view class="input-group">
            <text class="input-prefix">+86</text>
            <input
              class="input"
              type="number"
              v-model="phone"
              placeholder="请输入手机号"
              maxlength="11"
            />
          </view>

          <view class="input-group">
            <input
              class="input code-input"
              type="number"
              v-model="smsCode"
              placeholder="请输入验证码"
              maxlength="6"
            />
            <button
              class="send-code-btn"
              :class="{ disabled: countdown > 0 }"
              :disabled="countdown > 0"
              @click="sendCode"
            >
              {{ countdown > 0 ? `${countdown}s` : "获取验证码" }}
            </button>
          </view>

          <button
            class="login-btn submit-btn"
            :class="{ disabled: !canSubmit }"
            :disabled="!canSubmit"
            @click="handlePhoneLogin"
          >
            登录
          </button>
        </view>
      </view>

      <!-- 协议 -->
      <view class="agreement">
        <text class="agreement-text">
          登录即表示同意
          <text class="link">《用户协议》</text>
          和
          <text class="link">《隐私政策》</text>
        </text>
      </view>
    </view>
  </view>
</template>

<script>
import { ref, computed } from "vue";
import { useUserStore } from "@/store/user";
import { callCloud } from "@/utils/cloud";

export default {
  setup() {
    const userStore = useUserStore();

    const phone = ref("");
    const smsCode = ref("");
    const countdown = ref(0);
    let countdownTimer = null;

    // 是否可提交
    const canSubmit = computed(() => {
      return phone.value.length === 11 && smsCode.value.length === 6;
    });

    // 微信登录
    const handleWxLogin = async () => {
      uni.showLoading({ title: "登录中...", mask: true });

      try {
        const result = await callCloud(
          "login",
          {
            action: "wxLogin",
          },
          { showLoading: false }
        ).catch((err) => {
          console.error("微信登录失败:", err);
        });
        console.log("查看result： ", result);

        uni.hideLoading();

        if (result) {
          userStore.setToken(result.token);
          userStore.setUserInfo(result.userInfo);

          uni.showToast({
            title: "登录成功",
            icon: "success",
          });

          setTimeout(() => {
            uni.switchTab({ url: "/pages/index/index" });
          }, 1000);
        }
      } catch (error) {
        uni.hideLoading();
        console.error("微信登录失败:", error);
      }
    };

    // 获取手机号
    const handleGetPhoneNumber = async (e) => {
      if (e.detail.errMsg !== "getPhoneNumber:ok") {
        uni.showToast({ title: "取消了授权", icon: "none" });
        return;
      }

      const { cloudID } = e.detail;
      if (!cloudID) {
        uni.showToast({ title: "获取失败", icon: "none" });
        return;
      }

      uni.showLoading({ title: "登录中...", mask: true });

      try {
        // 先进行微信登录
        const loginResult = await callCloud(
          "login",
          {
            action: "wxLogin",
          },
          { showLoading: false }
        );

        if (loginResult) {
          userStore.setToken(loginResult.token);
          userStore.setUserInfo(loginResult.userInfo);
        }

        // 获取手机号
        const phoneResult = await callCloud(
          "login",
          {
            action: "getPhoneNumber",
            cloudID,
          },
          { showLoading: false }
        );

        uni.hideLoading();

        if (phoneResult && phoneResult.phone) {
          // 更新用户信息
          const userInfo = userStore.userInfo || {};
          userInfo.phone = phoneResult.phone;
          userStore.setUserInfo(userInfo);

          uni.showToast({
            title: "登录成功",
            icon: "success",
          });

          setTimeout(() => {
            uni.switchTab({ url: "/pages/index/index" });
          }, 1000);
        }
      } catch (error) {
        uni.hideLoading();
        console.error("获取手机号失败:", error);
      }
    };

    // 发送验证码
    const sendCode = async () => {
      if (phone.value.length !== 11) {
        uni.showToast({ title: "请输入正确的手机号", icon: "none" });
        return;
      }

      if (countdown.value > 0) return;

      try {
        await callCloud("sendSmsCode", {
          phone: phone.value,
        });

        // 开始倒计时
        countdown.value = 60;
        countdownTimer = setInterval(() => {
          countdown.value--;
          if (countdown.value <= 0) {
            clearInterval(countdownTimer);
          }
        }, 1000);
      } catch (error) {
        console.error("发送验证码失败:", error);
      }
    };

    // 手机号验证码登录
    const handlePhoneLogin = async () => {
      if (!canSubmit.value) return;

      uni.showLoading({ title: "登录中...", mask: true });

      try {
        const result = await callCloud(
          "login",
          {
            action: "phoneLogin",
            phone: phone.value,
            code: smsCode.value,
          },
          { showLoading: false }
        );

        uni.hideLoading();

        if (result) {
          userStore.setToken(result.token);
          userStore.setUserInfo(result.userInfo);

          uni.showToast({
            title: "登录成功",
            icon: "success",
          });

          setTimeout(() => {
            uni.switchTab({ url: "/pages/index/index" });
          }, 1000);
        }
      } catch (error) {
        uni.hideLoading();
        console.error("登录失败:", error);
      }
    };

    return {
      phone,
      smsCode,
      countdown,
      canSubmit,
      handleWxLogin,
      handleGetPhoneNumber,
      sendCode,
      handlePhoneLogin,
    };
  },
};
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background: linear-gradient(180deg, #eff6ff 0%, #fff 50%);
}

.login-container {
  padding: 80rpx 48rpx;
}

.logo-section {
  text-align: center;
  padding: 60rpx 0 80rpx;

  .logo-icon {
    font-size: 100rpx;
    display: block;
    margin-bottom: 24rpx;
  }

  .logo-title {
    font-size: 48rpx;
    font-weight: 700;
    color: #1f2937;
    display: block;
    margin-bottom: 12rpx;
  }

  .logo-subtitle {
    font-size: 28rpx;
    color: #6b7280;
  }
}

.login-methods {
  .login-btn {
    width: 100%;
    height: 96rpx;
    border-radius: 48rpx;
    font-size: 32rpx;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    border: none;

    .btn-icon {
      margin-right: 12rpx;
      font-size: 36rpx;
    }

    &.wechat-btn {
      background: #07c160;
      color: #fff;
    }

    &.phone-btn {
      background: #fff;
      color: #1f2937;
      border: 2rpx solid #e5e7eb;
    }

    &.submit-btn {
      background: #3b82f6;
      color: #fff;
      margin-top: 32rpx;

      &.disabled {
        background: #93c5fd;
      }
    }
  }
}

.divider {
  display: flex;
  align-items: center;
  margin: 48rpx 0;

  .divider-line {
    flex: 1;
    height: 1rpx;
    background: #e5e7eb;
  }

  .divider-text {
    padding: 0 24rpx;
    font-size: 26rpx;
    color: #9ca3af;
  }
}

.phone-login-form {
  .input-group {
    display: flex;
    align-items: center;
    background: #f9fafb;
    border-radius: 16rpx;
    padding: 0 24rpx;
    margin-bottom: 24rpx;
    border: 2rpx solid #e5e7eb;

    .input-prefix {
      font-size: 30rpx;
      color: #1f2937;
      padding-right: 16rpx;
      border-right: 1rpx solid #e5e7eb;
      margin-right: 16rpx;
    }

    .input {
      flex: 1;
      height: 96rpx;
      font-size: 30rpx;
      color: #1f2937;
    }

    .code-input {
      flex: 1;
    }

    .send-code-btn {
      padding: 16rpx 24rpx;
      font-size: 26rpx;
      color: #3b82f6;
      background: transparent;
      border: none;
      white-space: nowrap;

      &.disabled {
        color: #9ca3af;
      }
    }
  }
}

.agreement {
  text-align: center;
  margin-top: 60rpx;

  .agreement-text {
    font-size: 24rpx;
    color: #9ca3af;

    .link {
      color: #3b82f6;
    }
  }
}
</style>
