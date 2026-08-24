import { useRef } from 'react'
import type { useFmea } from '../state/useFmea'
import { buildDiagram } from '../lib/diagram'
import { levelLabel } from '../lib/structure'

type Fmea = ReturnType<typeof useFmea>

// 레벨별 상단 스트립 색 (인라인 속성 — PNG 직렬화 시에도 유지)
const LEVEL_FILL = ['#1d4ed8', '#3b82f6', '#93c5fd']

function truncate(s: string, max = 16): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

// Step 2 다이어그램 탭: structure에서 자동 생성한 읽기 전용 블록다이어그램(순수 SVG) + PNG 내보내기.
export default function StructureDiagram({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const type = project.meta.type
  const svgRef = useRef<SVGSVGElement>(null)
  const { boxes, edges, width, height } = buildDiagram(project)

  if (boxes.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        구조가 없습니다. “트리 편집”에서 노드를 추가하면 다이어그램이 자동 생성됩니다.
      </p>
    )
  }

  function exportPng() {
    const svg = svgRef.current
    if (!svg) return
    const scale = 2
    const xml = new XMLSerializer().serializeToString(svg)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(width * scale)
      canvas.height = Math.ceil(height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        const href = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = href
        a.download = `${(project.meta.title || 'structure').trim().replace(/\s+/g, '_')}_${type}_diagram.png`
        a.click()
        URL.revokeObjectURL(href)
      }, 'image/png')
    }
    img.src = url
  }

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          트리에서 자동 생성된 읽기 전용 뷰 · 계층(부모–자식) 연결만 표시
        </p>
        <button
          type="button"
          onClick={exportPng}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          PNG 내보내기
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-200 bg-white">
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ display: 'block' }}
        >
          {/* 연결선 (계층) */}
          {edges.map((e) => (
            <path
              key={e.id}
              d={`M ${e.x1} ${e.y1} C ${e.x1 + 40} ${e.y1}, ${e.x2 - 40} ${e.y2}, ${e.x2} ${e.y2}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
            />
          ))}

          {/* 노드 박스 */}
          {boxes.map((b) => (
            <g key={b.id}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={6}
                fill="#ffffff"
                stroke="#cbd5e1"
                strokeWidth={1}
              />
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={6}
                rx={3}
                fill={LEVEL_FILL[b.level] ?? '#93c5fd'}
              />
              <text
                x={b.x + 10}
                y={b.y + 22}
                fontFamily="sans-serif"
                fontSize={10}
                fill="#6b7280"
              >
                {levelLabel(type, b.level)}
                {b.category ? ` · ${b.category}` : ''}
              </text>
              <text
                x={b.x + 10}
                y={b.y + 40}
                fontFamily="sans-serif"
                fontSize={13}
                fontWeight={600}
                fill="#111827"
              >
                {truncate(b.name || '(이름 없음)')}
              </text>
              {b.funcCount > 0 && (
                <text
                  x={b.x + b.w - 10}
                  y={b.y + 22}
                  textAnchor="end"
                  fontFamily="sans-serif"
                  fontSize={10}
                  fill="#2563eb"
                >
                  fn {b.funcCount}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
