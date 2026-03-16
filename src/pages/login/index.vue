<template>
  <view class="page">
    <!-- 顶部装饰波浪 -->
    <view class="top-wave">
      <view class="wave-circle c1"></view>
      <view class="wave-circle c2"></view>
      <view class="wave-circle c3"></view>
    </view>

    <view class="login-container">
      <!-- Logo -->
      <view class="logo-section">
        <view class="logo-icon-wrap">
          <uni-icons type="home" size="44" color="#1890FF" />
        </view>
        <text class="logo-title">房东助手</text>
        <text class="logo-subtitle">让租房管理更简单</text>
      </view>

      <!-- 登录方式 -->
      <view class="login-card">
        <button class="login-btn wechat-btn" open-type="getUserInfo" @click="handleWxLogin">
          <uni-icons class="btn-icon" type="chat" size="20" color="#fff" />
          <text>微信一键登录</text>
        </button>

        <button class="login-btn phone-quick-btn" open-type="getPhoneNumber" @getphonenumber="handleGetPhoneNumber">
          <uni-icons class="btn-icon" type="phone" size="20" color="#1890FF" />
          <text>手机号快捷登录</text>
        </button>

        <view class="divider">
          <view class="divider-line"></view>
          <text class="divider-text">验证码登录</text>
          <view class="divider-line"></view>
        </view>

        <view class="phone-login-form">
          <view class="input-group">
            <text class="input-prefix">+86</text>
            <input class="input" type="number" v-model="phone" placeholder="请输入手机号" maxlength="11" />
          </view>
          <view class="input-group">
            <input class="input code-input" type="number" v-model="smsCode" placeholder="请输入验证码" maxlength="6" />
            <button class="send-code-btn" :class="{ disabled: countdown > 0 }" :disabled="countdown > 0" @click="sendCode">
              {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
            </button>
          </view>
          <button class="login-btn submit-btn" :class="{ disabled: !canSubmit }" :disabled="!canSubmit" @click="handlePhoneLogin">
            登 录
          </button>
        </view>
      </view>

      <view class="agreement">
        <text class="agreement-text">登录即表示同意<text class="link">《用户协议》</text>和<text class="link">《隐私政策》</text></text>
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
  background: $bg-color;
  overflow: hidden;
}

.top-wave {
  position: absolute;
  top: -200rpx;
  left: -100rpx;
  right: -100rpx;
  height: 700rpx;
  pointer-events: none;

  .wave-circle {
    position: absolute;
    border-radius: 50%;
  }

  .c1 {
    width: 700rpx;
    height: 700rpx;
    background: linear-gradient(135deg, #BAE0FF 0%, #91CAFF 100%);
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.5;
  }

  .c2 {
    width: 500rpx;
    height: 500rpx;
    background: linear-gradient(135deg, #E6F4FF 0%, #BAE0FF 100%);
    top: -80rpx;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.7;
  }

  .c3 {
    width: 300rpx;
    height: 300rpx;
    background: #FFFFFF;
    top: -40rpx;
    left: 50%;
    transform: translateX(-50%);
    opacity: 0.4;
  }
}

.login-container {
  position: relative;
  z-index: 1;
  padding: 0 32rpx 60rpx;
}

.logo-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 240rpx 0 60rpx;

  .logo-icon-wrap {
    width: 128rpx;
    height: 128rpx;
    background: #FFFFFF;
    border-radius: 36rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24rpx;
    box-shadow: $shadow-lg;
  }

  .logo-title {
    font-size: 52rpx;
    font-weight: 800;
    color: $text-main;
    margin-bottom: 10rpx;
    letter-spacing: 2rpx;
  }

  .logo-subtitle {
    font-size: $font-size-sm;
    color: $text-secondary;
  }
}

.login-card {
  background: $bg-card;
  border-radius: $radius-lg;
  padding: 40rpx;
  box-shadow: $shadow-md;
}

.login-btn {
  width: 100%;
  height: 96rpx;
  border-radius: $radius-md;
  font-size: $font-size-base;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $spacing-md;
  border: none;
  letter-spacing: 2rpx;

  .btn-icon {
    margin-right: 14rpx;
  }

  &.wechat-btn {
    background: #07C160;
    color: #fff;
  }

  &.phone-quick-btn {
    background: #E6F4FF;
    color: $primary-color;
    border: 1rpx solid #BAE0FF;
  }

  &.submit-btn {
    background: $primary-gradient;
    color: #fff;
    margin-top: $spacing-lg;
    box-shadow: $shadow-float;

    &.disabled {
      background: #BAE0FF;
      box-shadow: none;
    }
  }
}

.divider {
  display: flex;
  align-items: center;
  margin: $spacing-xl 0 $spacing-lg;

  .divider-line {
    flex: 1;
    height: 1rpx;
    background: $border-color;
  }

  .divider-text {
    padding: 0 $spacing-md;
    font-size: $font-size-xs;
    color: $text-placeholder;
  }
}

.phone-login-form {
  .input-group {
    display: flex;
    align-items: center;
    background: $bg-color;
    border-radius: $radius-md;
    padding: 0 $spacing-md;
    margin-bottom: $spacing-md;
    border: 1rpx solid $border-color;

    .input-prefix {
      font-size: $font-size-sm;
      color: $text-secondary;
      padding-right: $spacing-sm;
      border-right: 1rpx solid $border-color;
      margin-right: $spacing-sm;
    }

    .input {
      flex: 1;
      height: 96rpx;
      font-size: $font-size-base;
      color: $text-main;
    }

    .send-code-btn {
      padding: $spacing-xs $spacing-md;
      font-size: $font-size-sm;
      color: $primary-color;
      background: transparent;
      border: none;
      font-weight: 600;
      white-space: nowrap;

      &.disabled {
        color: $text-placeholder;
      }
    }
  }
}

.agreement {
  text-align: center;
  margin-top: 48rpx;

  .agreement-text {
    font-size: $font-size-xs;
    color: $text-placeholder;

    .link {
      color: $primary-color;
    }
  }
}
</style>
