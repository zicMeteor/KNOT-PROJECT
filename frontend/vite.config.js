import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 개발 중에도 화면과 API를 같은 주소(5173)로 연다. 로그인 쿠키가 그대로 전달된다
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
