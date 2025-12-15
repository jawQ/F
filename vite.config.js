import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [uni()],
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler', // Use modern Sass API
                // 自动导入全局变量
                additionalData: '@import "@/uni.scss";',
                silenceDeprecations: ['legacy-js-api', 'import']
            }
        }
    }
})
