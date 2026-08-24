import { useRef, useState } from 'react'
import type { InterfaceKind, StructureNode } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { newId } from '../lib/id'
import { BLOCK, blockPositions, type Pos } from '../lib/diagram'

type Fmea = ReturnType<typeof useFmea>

const KINDS: InterfaceKind[] = ['신호', '전원', '기계']
const KIND_COLOR: Record<InterfaceKind, string> = {
  신호: '#0e7490',
  전원: '#b45309',
  기계: '#7c3aed',
}

// 블록 테두리에서 대상 방향으로의 접점
function border(cx: number, cy: number, w: number, h: number, tx: number, ty: number): Pos {
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const sx = dx !== 0 ? w / 2 / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? h / 2 / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// Step 2 다이어그램 편집기 — 블록 드래그(layout 갱신) + 인터페이스 생성/편집. 순수 SVG.
export default function StructureDiagram({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null)
  const [connect, setConnect] = useState<{ fromId: string; x: number; y: number } | null>(null)
  const [selIface, setSelIface] = useState<string | null>(null)
  const [selBlock, setSelBlock] = useState<string | null>(null)

  const blocks = project.structure.filter((n) => n.level === 1)
  const roots = project.structure.filter((n) => n.level === 0)
  const base = blockPositions(project)
  const posOf = (id: string): Pos =>
    drag && drag.id === id ? { x: drag.x, y: drag.y } : base[id] ?? { x: 0, y: 0 }
  const center = (id: string): Pos => {
    const p = posOf(id)
    return { x: p.x + BLOCK.w / 2, y: p.y + BLOCK.h / 2 }
  }

  if (blocks.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        블록이 없습니다. “트리 편집”에서 최상위 아래에 Subsystem(2레벨) 노드를 추가하면
        다이어그램에 자동 배치됩니다.
      </p>
    )
  }

  // 캔버스 크기 = 블록 범위 + 여백
  let maxX = 0
  let maxY = 0
  for (const b of blocks) {
    const p = posOf(b.id)
    maxX = Math.max(maxX, p.x + BLOCK.w)
    maxY = Math.max(maxY, p.y + BLOCK.h)
  }
  const W = Math.max(760, maxX + BLOCK.margin)
  const H = Math.max(360, maxY + BLOCK.margin)

  // System 경계 프레임 = 블록 바운딩 박스 + 여백
  let fx1 = Infinity, fy1 = Infinity, fx2 = -Infinity, fy2 = -Infinity
  for (const b of blocks) {
    const p = posOf(b.id)
    fx1 = Math.min(fx1, p.x); fy1 = Math.min(fy1, p.y)
    fx2 = Math.max(fx2, p.x + BLOCK.w); fy2 = Math.max(fy2, p.y + BLOCK.h)
  }
  const pad = 24
  const frame = { x: fx1 - pad, y: fy1 - pad, w: fx2 - fx1 + pad * 2, h: fy2 - fy1 + pad * 2 }
  const systemLabel = roots.map((r) => r.name || '(이름 없음)').join(' · ') || 'System 경계'

  const toSvg = (e: React.PointerEvent): Pos => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  function startDrag(e: React.PointerEvent, node: StructureNode) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toSvg(e)
    const b = posOf(node.id)
    setSelBlock(node.id)
    setSelIface(null)
    setDrag({ id: node.id, dx: p.x - b.x, dy: p.y - b.y, x: b.x, y: b.y })
  }

  function startConnect(e: React.PointerEvent, node: StructureNode) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toSvg(e)
    setConnect({ fromId: node.id, x: p.x, y: p.y })
  }

  function onMove(e: React.PointerEvent) {
    if (drag) {
      const p = toSvg(e)
      setDrag((d) => (d ? { ...d, x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) } : d))
    } else if (connect) {
      const p = toSvg(e)
      setConnect((c) => (c ? { ...c, x: p.x, y: p.y } : c))
    }
  }

  function onUp(e: React.PointerEvent) {
    if (drag) {
      fmea.setNodePosition(drag.id, { x: drag.x, y: drag.y })
      setDrag(null)
    }
    if (connect) {
      // 포인터 캡처로 up이 svg에 오므로, 드롭 지점을 직접 히트테스트한다.
      const p = toSvg(e)
      const target = blocks.find((n) => {
        const bp = posOf(n.id)
        return p.x >= bp.x && p.x <= bp.x + BLOCK.w && p.y >= bp.y && p.y <= bp.y + BLOCK.h
      })
      if (target && target.id !== connect.fromId) {
        const id = newId()
        fmea.addInterface({
          id,
          fromNodeId: connect.fromId,
          toNodeId: target.id,
          label: '',
          kind: '신호',
        })
        setSelIface(id)
      }
      setConnect(null)
    }
  }

  const iface = project.interfaces.find((i) => i.id === selIface) ?? null
  const ifaceMid = iface ? midpoint(center(iface.fromNodeId), center(iface.toNodeId)) : null

  return (
    <div className="max-w-full">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-gray-400">
          블록 드래그로 이동 · 가장자리 핸들에서 끌어 연결 · 연결선 클릭으로 편집
        </p>
        <button
          type="button"
          onClick={exportPng}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          PNG 내보내기
        </button>
      </div>

      <div
        className="relative overflow-auto rounded-lg border border-gray-200 bg-white"
        style={{ maxHeight: 560 }}
      >
        <svg
          ref={svgRef}
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', touchAction: 'none' }}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerDown={() => {
            setSelBlock(null)
            setSelIface(null)
          }}
        >
          <defs>
            {KINDS.map((k) => (
              <marker
                key={k}
                id={`arr-${k}`}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill={KIND_COLOR[k]} />
              </marker>
            ))}
          </defs>

          {/* System 경계 프레임 */}
          <rect
            x={frame.x}
            y={frame.y}
            width={frame.w}
            height={frame.h}
            rx={12}
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth={1.4}
            strokeDasharray="3 4"
          />
          <text
            x={frame.x + 12}
            y={frame.y - 8}
            fontFamily="ui-monospace, monospace"
            fontSize={12}
            fontWeight={600}
            fill="#64748b"
          >
            {systemLabel} · System 경계
          </text>

          {/* 인터페이스 연결선 */}
          {project.interfaces.map((it) => {
            const cf = center(it.fromNodeId)
            const ct = center(it.toNodeId)
            if (!base[it.fromNodeId] || !base[it.toNodeId]) return null
            const p1 = border(cf.x, cf.y, BLOCK.w, BLOCK.h, ct.x, ct.y)
            const p2 = border(ct.x, ct.y, BLOCK.w, BLOCK.h, cf.x, cf.y)
            const mid = midpoint(p1, p2)
            const color = KIND_COLOR[it.kind]
            const active = it.id === selIface
            return (
              <g key={it.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => selectIface(e, it.id)}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={color}
                  strokeWidth={active ? 3 : 2}
                  markerEnd={`url(#arr-${it.kind})`}
                />
                <g>
                  <rect
                    x={mid.x - labelW(it.label) / 2}
                    y={mid.y - 10}
                    width={labelW(it.label)}
                    height={18}
                    rx={4}
                    fill="#ffffff"
                    stroke={active ? color : '#e2e8f0'}
                  />
                  <text
                    x={mid.x}
                    y={mid.y + 3}
                    textAnchor="middle"
                    fontFamily="ui-monospace, monospace"
                    fontSize={11}
                    fill="#0f172a"
                  >
                    {it.label || '(라벨 없음)'}
                  </text>
                </g>
              </g>
            )
          })}

          {/* 연결 진행중 임시선 */}
          {connect && (
            <line
              x1={center(connect.fromId).x}
              y1={center(connect.fromId).y}
              x2={connect.x}
              y2={connect.y}
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="6 5"
            />
          )}

          {/* 블록 */}
          {blocks.map((n) => {
            const p = posOf(n.id)
            const sel = n.id === selBlock
            const cx = p.x + BLOCK.w / 2
            const cy = p.y + BLOCK.h / 2
            return (
              <g key={n.id}>
                {sel && (
                  <rect
                    x={p.x - 4}
                    y={p.y - 4}
                    width={BLOCK.w + 8}
                    height={BLOCK.h + 8}
                    rx={11}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2.2}
                  />
                )}
                <rect
                  x={p.x}
                  y={p.y}
                  width={BLOCK.w}
                  height={BLOCK.h}
                  rx={9}
                  fill="#ffffff"
                  stroke="#94a3b8"
                  strokeWidth={1.4}
                  style={{ cursor: 'move' }}
                  onPointerDown={(e) => startDrag(e, n)}
                />
                <text
                  x={p.x + 14}
                  y={p.y + 27}
                  fontFamily="var(--font-ui, sans-serif)"
                  fontSize={14}
                  fontWeight={600}
                  fill="#111827"
                  style={{ pointerEvents: 'none' }}
                >
                  {truncate(n.name || '(이름 없음)')}
                </text>
                <text
                  x={p.x + 14}
                  y={p.y + 46}
                  fontFamily="ui-monospace, monospace"
                  fontSize={10}
                  fill="#94a3b8"
                  style={{ pointerEvents: 'none' }}
                >
                  SUBSYSTEM
                </text>
                {/* 연결 핸들 4개 */}
                {[
                  { x: cx, y: p.y },
                  { x: p.x + BLOCK.w, y: cy },
                  { x: cx, y: p.y + BLOCK.h },
                  { x: p.x, y: cy },
                ].map((h, i) => (
                  <circle
                    key={i}
                    cx={h.x}
                    cy={h.y}
                    r={5}
                    fill="#ffffff"
                    stroke="#2563eb"
                    strokeWidth={2}
                    style={{ cursor: 'crosshair' }}
                    onPointerDown={(e) => startConnect(e, n)}
                  />
                ))}
              </g>
            )
          })}
        </svg>

        {/* 인터페이스 편집 팝오버 (HTML 오버레이) */}
        {iface && ifaceMid && (
          <div
            className="absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-gray-300 bg-white p-3 shadow-lg"
            style={{ left: ifaceMid.x, top: ifaceMid.y + 12 }}
          >
            <div className="mb-2 text-sm font-semibold text-gray-800">인터페이스 편집</div>
            <label className="block text-xs text-gray-500">
              신호 이름 (label)
              <input
                type="text"
                value={iface.label}
                onChange={(e) => fmea.updateInterface(iface.id, { label: e.target.value })}
                placeholder="예: DC 전압"
                className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
              />
            </label>
            <div className="mt-2 flex items-end gap-2">
              <label className="text-xs text-gray-500">
                종류 (kind)
                <select
                  value={iface.kind}
                  onChange={(e) =>
                    fmea.updateInterface(iface.id, { kind: e.target.value as InterfaceKind })
                  }
                  className="mt-0.5 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  fmea.updateInterface(iface.id, {
                    fromNodeId: iface.toNodeId,
                    toNodeId: iface.fromNodeId,
                  })
                }
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                title="방향 바꾸기"
              >
                방향 ⇄
              </button>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-xs text-gray-400">
                {nodeName(fmea, iface.fromNodeId)} → {nodeName(fmea, iface.toNodeId)}
              </span>
              <button
                type="button"
                onClick={() => {
                  fmea.removeInterface(iface.id)
                  setSelIface(null)
                }}
                className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  function selectIface(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setSelIface(id)
    setSelBlock(null)
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
      canvas.width = Math.ceil(W * scale)
      canvas.height = Math.ceil(H * scale)
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
        a.download = `${(project.meta.title || 'structure').trim().replace(/\s+/g, '_')}_${project.meta.type}_diagram.png`
        a.click()
        URL.revokeObjectURL(href)
      }, 'image/png')
    }
    img.src = url
  }
}

function midpoint(a: Pos, b: Pos): Pos {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
function truncate(s: string, max = 16): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
function labelW(label: string): number {
  const text = label || '(라벨 없음)'
  return Math.max(48, text.length * 8 + 14)
}
function nodeName(fmea: Fmea, id: string): string {
  return fmea.project.structure.find((n) => n.id === id)?.name || '(이름 없음)'
}
