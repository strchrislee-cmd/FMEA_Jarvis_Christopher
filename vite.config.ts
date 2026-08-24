import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// 빌드 산출물을 index.html 하나로 인라인한다(JS/CSS 전부 삽입).
// Node 없이 file:// 로 더블클릭해 열 수 있게 하기 위함.
// Vite가 최종 HTML을 디스크에 쓴 뒤(writeBundle) 실제 태그를 보고 인라인한다.
function singleFile(): Plugin {
  return {
    name: 'inline-single-file',
    enforce: 'post',
    writeBundle(options) {
      const dir = options.dir || 'dist'
      const htmlPath = path.join(dir, 'index.html')
      if (!fs.existsSync(htmlPath)) return
      let html = fs.readFileSync(htmlPath, 'utf8')

      const resolve = (ref: string) => path.join(dir, ref.replace(/^\//, ''))

      // <script src> → 인라인 (dist/assets/*.js)
      html = html.replace(
        /<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g,
        (m, _pre, src) => {
          const file = resolve(src)
          if (!fs.existsSync(file)) return m
          const code = fs.readFileSync(file, 'utf8').replace(/<\/script>/g, '<\\/script>')
          return `<script type="module">${code}</script>`
        },
      )

      // <link href="*.css"> → 인라인
      html = html.replace(/<link[^>]*\shref="([^"]+\.css)"[^>]*>/g, (m, href) => {
        const file = resolve(href)
        if (!fs.existsSync(file)) return m
        return `<style>${fs.readFileSync(file, 'utf8')}</style>`
      })

      // 남은 외부 참조(modulepreload) 제거 → 순수 단일 파일 보장
      html = html.replace(/<link[^>]*rel="modulepreload"[^>]*>/g, '')

      fs.writeFileSync(htmlPath, html)

      // 인라인한 원본 에셋 폴더 제거 → dist에 index.html만 남긴다
      const assets = path.join(dir, 'assets')
      if (fs.existsSync(assets)) fs.rmSync(assets, { recursive: true, force: true })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // 단일 청크로 인라인 (동적 import 분할 방지)
  build: { rollupOptions: { output: { inlineDynamicImports: true } } },
  plugins: [react(), tailwindcss(), singleFile()],
})
