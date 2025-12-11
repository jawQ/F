import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [uni()],
    css: {
        preprocessorOptions: {
            scss: {
                // 自动导入全局变量
                additionalData: '@import "@/uni.scss";'
            }
        }
    }
})
