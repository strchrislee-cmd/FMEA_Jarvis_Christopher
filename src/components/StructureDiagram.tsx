import { useEffect, useRef, useState } from 'react'
import type { InterfaceKind, StructureNode } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { newId } from '../lib/id'
import { levelLabel } from '../lib/structure'
import { BLOCK, blockPositions, systemSlots, type Pos } from '../lib/diagram'

type Fmea = ReturnType<typeof useFmea>
type View = { k: number; tx: number; ty: number }

const KINDS: InterfaceKind[] = ['신호', '전원', '기계']
const KIND_COLOR: Record<InterfaceKind, string> = {
  신호: '#0e7490',
  전원: '#b45309',
  기계: '#7c3aed',
}
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

// 캔버스 겉 크기 프리셋(가로·세로). 세션 UI, 저장 안 함. "크게"는 넓은 폭을 요청하고
// 컨테이너 max-w-full이 사용 가능한 폭까지 채운다.
type PresetKey = 'small' | 'medium' | 'large'
const CANVAS_MIN = { w: 360, h: 300 }
const PRESETS: Record<PresetKey, { w: number; h: number; label: string }> = {
  small: { w: 560, h: 420, label: '작게' },
  medium: { w: 900, h: 560, label: '보통' },
  large: { w: 100000, h: 760, label: '크게' },
}

function border(cx: number, cy: number, w: number, h: number, tx: number, ty: number): Pos {
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const sx = dx !== 0 ? w / 2 / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? h / 2 / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}

// Step 2 다이어그램 편집기 — 블록 드래그/연결 + 캔버스 높이 조절 + 줌/팬. 순수 SVG.
// 줌·팬은 content <g> transform으로 처리하고, 화면→content 좌표 변환은 그 g의
// getScreenCTM().inverse()로 일원화한다(어떤 배율에서도 드래그/드롭이 정확).
// 줌·팬·높이는 세션 UI 상태로만 두고 저장하지 않는다(layout만 저장).
export default function StructureDiagram({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; x: number; y: number } | null>(null)
  const [connect, setConnect] = useState<{ fromId: string; x: number; y: number } | null>(null)
  const [pan, setPan] = useState<{ x0: number; y0: number; tx0: number; ty0: number } | null>(null)
  const [selIface, setSelIface] = useState<string | null>(null)
  const [selBlock, setSelBlock] = useState<string | null>(null)
  const [selSystem, setSelSystem] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null) // 인라인 이름 편집 중인 노드 id
  const [view, setView] = useState<View>({ k: 1, tx: 0, ty: 0 })
  // 캔버스 겉 크기(px) — React가 소유. 프리셋 또는 모서리 드래그로 변경.
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ w: number; h: number }>({
    w: PRESETS.medium.w,
    h: PRESETS.medium.h,
  })
  const [preset, setPreset] = useState<PresetKey | null>('medium')
  const resizeRef = useRef<{ sx: number; sy: number; sw: number; sh: number; maxW: number } | null>(null)

  const blocks = project.structure.filter((n) => n.level === 1)
  const roots = project.structure.filter((n) => n.level === 0)
  const base = blockPositions(project)
  const posOf = (id: string): Pos =>
    drag && drag.id === id ? { x: drag.x, y: drag.y } : base[id] ?? { x: 0, y: 0 }
  const center = (id: string): Pos => {
    const p = posOf(id)
    return { x: p.x + BLOCK.w / 2, y: p.y + BLOCK.h / 2 }
  }

  // 화면(client) → content 좌표. 줌/팬/리사이즈/오프셋을 한 번에 반영.
  const toContent = (e: { clientX: number; clientY: number }): Pos => {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = g.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  // 마우스 휠 줌(커서 기준). React onWheel은 passive일 수 있어 native 리스너로.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      setView((v) => {
        const k2 = clamp(v.k * factor, 0.3, 3)
        const cx = (mx - v.tx) / v.k
        const cy = (my - v.ty) / v.k
        return { k: k2, tx: mx - cx * k2, ty: my - cy * k2 }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  function zoomBy(factor: number) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = rect.width / 2
    const my = rect.height / 2
    setView((v) => {
      const k2 = clamp(v.k * factor, 0.3, 3)
      const cx = (mx - v.tx) / v.k
      const cy = (my - v.ty) / v.k
      return { k: k2, tx: mx - cx * k2, ty: my - cy * k2 }
    })
  }

  function fit() {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return
    const bb = g.getBBox()
    if (bb.width === 0 || bb.height === 0) return
    const rect = svg.getBoundingClientRect()
    const pad = 32
    const k = clamp(
      Math.min((rect.width - pad) / bb.width, (rect.height - pad) / bb.height),
      0.3,
      3,
    )
    const tx = (rect.width - bb.width * k) / 2 - bb.x * k
    const ty = (rect.height - bb.height * k) / 2 - bb.y * k
    setView({ k, tx, ty })
  }

  // System(level 0)별 그룹 박스 = 소속 Subsystem을 감싸는 계산된 경계(저장 안 함).
  // 빈 System은 systemSlots 기준의 자리표시 박스로 그린다.
  const pad = 24
  const slots = systemSlots(project.structure)
  const systemBoxes = roots.map((sys) => {
    const members = blocks.filter((b) => b.parentId === sys.id)
    let rect: { x: number; y: number; w: number; h: number }
    if (members.length > 0) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
      for (const m of members) {
        const p = posOf(m.id)
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y)
        x2 = Math.max(x2, p.x + BLOCK.w); y2 = Math.max(y2, p.y + BLOCK.h)
      }
      rect = { x: x1 - pad, y: y1 - pad, w: x2 - x1 + pad * 2, h: y2 - y1 + pad * 2 }
    } else {
      const y = slots[sys.id]?.y ?? BLOCK.startY
      rect = { x: BLOCK.startX - pad, y: y - pad, w: BLOCK.w + 140, h: BLOCK.h + 60 }
    }
    return { id: sys.id, name: sys.name || '(이름 없음)', ...rect }
  })

  // 전체 콘텐츠 경계(PNG 내보내기·라벨 여유 포함)
  let cx1 = Infinity, cy1 = Infinity, cx2 = -Infinity, cy2 = -Infinity
  for (const box of systemBoxes) {
    cx1 = Math.min(cx1, box.x); cy1 = Math.min(cy1, box.y - 22)
    cx2 = Math.max(cx2, box.x + box.w); cy2 = Math.max(cy2, box.y + box.h)
  }
  for (const b of blocks) {
    const p = posOf(b.id)
    cx1 = Math.min(cx1, p.x); cy1 = Math.min(cy1, p.y)
    cx2 = Math.max(cx2, p.x + BLOCK.w); cy2 = Math.max(cy2, p.y + BLOCK.h)
  }
  if (!isFinite(cx1)) { cx1 = 0; cy1 = 0; cx2 = 400; cy2 = 200 } // 빈 구조 방어
  const contentBounds = { x: cx1, y: cy1, w: cx2 - cx1, h: cy2 - cy1 }

  const type = project.meta.type

  function addSystem() {
    const id = fmea.addNode(null)
    setSelSystem(id)
    setSelBlock(null)
    setSelIface(null)
    setEditing(id)
  }
  function addSubsystem() {
    if (!selSystem) return
    const id = fmea.addNode(selSystem)
    setEditing(id)
  }

  function startDrag(e: React.PointerEvent, node: StructureNode) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toContent(e)
    const b = posOf(node.id)
    setSelBlock(node.id)
    setSelIface(null)
    setSelSystem(null)
    setDrag({ id: node.id, dx: p.x - b.x, dy: p.y - b.y, x: b.x, y: b.y })
  }

  function startConnect(e: React.PointerEvent, node: StructureNode) {
    e.stopPropagation()
    svgRef.current?.setPointerCapture(e.pointerId)
    const p = toContent(e)
    setConnect({ fromId: node.id, x: p.x, y: p.y })
  }

  function applyPreset(key: PresetKey) {
    // "크게"는 사용 가능한 폭(부모 clientWidth)까지 실제로 채운다(넓힌 영역 활용).
    const avail = containerRef.current?.parentElement?.clientWidth ?? PRESETS[key].w
    const w = key === 'large' ? Math.max(PRESETS.medium.w, avail) : PRESETS[key].w
    setSize({ w, h: PRESETS[key].h })
    setPreset(key)
  }

  // 우하단 모서리 드래그 리사이즈(React 소유). 드래그하면 프리셋 표시 해제.
  function onResizeDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.preventDefault()
    const el = containerRef.current
    if (!el) return
    ;(e.target as Element).setPointerCapture(e.pointerId)
    const r = el.getBoundingClientRect()
    const maxW = el.parentElement?.clientWidth ?? r.width
    resizeRef.current = { sx: e.clientX, sy: e.clientY, sw: r.width, sh: r.height, maxW }
  }
  function onResizeMove(e: React.PointerEvent) {
    const d = resizeRef.current
    if (!d) return
    const w = clamp(d.sw + (e.clientX - d.sx), CANVAS_MIN.w, d.maxW)
    const h = Math.max(CANVAS_MIN.h, d.sh + (e.clientY - d.sy))
    setSize({ w, h })
    setPreset(null)
  }
  function onResizeUp() {
    resizeRef.current = null
  }

  function onBgDown(e: React.PointerEvent) {
    // 빈 캔버스 드래그 → 팬 (+ 선택 해제)
    svgRef.current?.setPointerCapture(e.pointerId)
    setSelBlock(null)
    setSelIface(null)
    setSelSystem(null)
    setPan({ x0: e.clientX, y0: e.clientY, tx0: view.tx, ty0: view.ty })
  }

  function selectSystem(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setSelSystem(id)
    setSelBlock(null)
    setSelIface(null)
  }

  function onMove(e: React.PointerEvent) {
    if (drag) {
      const p = toContent(e)
      setDrag((d) => (d ? { ...d, x: Math.round(p.x - d.dx), y: Math.round(p.y - d.dy) } : d))
    } else if (connect) {
      const p = toContent(e)
      setConnect((c) => (c ? { ...c, x: p.x, y: p.y } : c))
    } else if (pan) {
      setView((v) => ({ ...v, tx: pan.tx0 + (e.clientX - pan.x0), ty: pan.ty0 + (e.clientY - pan.y0) }))
    }
  }

  function onUp(e: React.PointerEvent) {
    if (drag) {
      fmea.setNodePosition(drag.id, { x: drag.x, y: drag.y })
      setDrag(null)
    }
    if (connect) {
      const p = toContent(e)
      const target = blocks.find((n) => {
        const bp = posOf(n.id)
        return p.x >= bp.x && p.x <= bp.x + BLOCK.w && p.y >= bp.y && p.y <= bp.y + BLOCK.h
      })
      if (target && target.id !== connect.fromId) {
        const id = newId()
        fmea.addInterface({ id, fromNodeId: connect.fromId, toNodeId: target.id, label: '', kind: '신호' })
        setSelIface(id)
      }
      setConnect(null)
    }
    if (pan) setPan(null)
  }

  const iface = project.interfaces.find((i) => i.id === selIface) ?? null
  const ifaceMid = iface ? midpoint(center(iface.fromNodeId), center(iface.toNodeId)) : null

  // 인라인 이름 편집 위치(줌/팬 반영해 화면 좌표로)
  const editNode = editing ? project.structure.find((n) => n.id === editing) ?? null : null
  let editScreen: Pos | null = null
  if (editNode) {
    let cxp = BLOCK.startX + 10
    let cyp = BLOCK.startY + 8
    if (editNode.level === 1) {
      const p = base[editNode.id]
      if (p) { cxp = p.x + 10; cyp = p.y + 8 }
    } else {
      const bx = systemBoxes.find((b) => b.id === editNode.id)
      if (bx) { cxp = bx.x + 12; cyp = bx.y + 8 }
    }
    editScreen = { x: view.tx + cxp * view.k, y: view.ty + cyp * view.k }
  }

  return (
    <div className="max-w-full">
      {/* 툴바 */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {/* 노드 생성 (기존 트리 추가 로직 재사용) */}
        <button
          type="button"
          onClick={addSystem}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          + {levelLabel(type, 0)}
        </button>
        <button
          type="button"
          onClick={addSubsystem}
          disabled={!selSystem}
          title={selSystem ? undefined : `${levelLabel(type, 0)}을(를) 선택하면 추가할 수 있습니다`}
          className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          + {levelLabel(type, 1)}
        </button>
        <span className="mx-1 h-4 w-px bg-gray-300" />

        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
          <button type="button" onClick={() => zoomBy(1 / 1.2)} className="px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100" aria-label="축소">−</button>
          <span className="border-x border-gray-300 px-2 py-1 text-xs tabular-nums text-gray-600">{Math.round(view.k * 100)}%</span>
          <button type="button" onClick={() => zoomBy(1.2)} className="px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-100" aria-label="확대">+</button>
        </div>
        <button type="button" onClick={fit} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">화면에 맞춤</button>
        <button type="button" onClick={() => setView({ k: 1, tx: 0, ty: 0 })} className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100">100%</button>

        <span className="mx-1 h-4 w-px bg-gray-300" />
        <span className="text-xs text-gray-400">캔버스</span>
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
          {(['small', 'medium', 'large'] as PresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`px-2.5 py-1 text-xs font-medium ${preset === key ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
            >
              {PRESETS[key].label}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-gray-400">휠 줌 · 빈 곳 드래그로 팬 · 우하단 모서리로 크기 조절</span>
        <button type="button" onClick={exportPng} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">PNG 내보내기</button>
      </div>

      {/* 캔버스 겉 크기: React 소유(프리셋/모서리 드래그). 세션 UI(저장 안 함).
          내부 좌표 변환은 getScreenCTM 기반이라 크기와 무관하게 정확. */}
      <div
        ref={containerRef}
        className="relative max-w-full overflow-hidden rounded-lg border border-gray-200 bg-white"
        style={{ width: size.w, height: size.h }}
      >
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{ display: 'block', touchAction: 'none', cursor: pan ? 'grabbing' : 'grab' }}
          onPointerDown={onBgDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
        >
          <defs>
            {KINDS.map((k) => (
              <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={KIND_COLOR[k]} />
              </marker>
            ))}
          </defs>

          <g ref={gRef} id="diagram-content" transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
            {/* System(level 0) 그룹 박스 — 소속 Subsystem을 감싼다. 클릭하면 선택 */}
            {systemBoxes.map((box) => {
              const sel = box.id === selSystem
              return (
                <g key={box.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => selectSystem(e, box.id)}>
                  <rect
                    x={box.x}
                    y={box.y}
                    width={box.w}
                    height={box.h}
                    rx={12}
                    fill="#f8fafc"
                    stroke={sel ? '#2563eb' : '#94a3b8'}
                    strokeWidth={sel ? 2.4 : 1.4}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={box.x + 12}
                    y={box.y - 8}
                    fontFamily="ui-monospace, monospace"
                    fontSize={12}
                    fontWeight={600}
                    fill={sel ? '#2563eb' : '#64748b'}
                  >
                    {box.name} · {levelLabel(type, 0)}
                  </text>
                </g>
              )
            })}

            {/* 인터페이스 연결선 */}
            {project.interfaces.map((it) => {
              if (!base[it.fromNodeId] || !base[it.toNodeId]) return null
              const cf = center(it.fromNodeId)
              const ct = center(it.toNodeId)
              const p1 = border(cf.x, cf.y, BLOCK.w, BLOCK.h, ct.x, ct.y)
              const p2 = border(ct.x, ct.y, BLOCK.w, BLOCK.h, cf.x, cf.y)
              const mid = midpoint(p1, p2)
              const color = KIND_COLOR[it.kind]
              const active = it.id === selIface
              return (
                <g key={it.id} style={{ cursor: 'pointer' }} onPointerDown={(e) => selectIface(e, it.id)}>
                  <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={active ? 3 : 2} markerEnd={`url(#arr-${it.kind})`} />
                  <rect x={mid.x - labelW(it.label) / 2} y={mid.y - 10} width={labelW(it.label)} height={18} rx={4} fill="#ffffff" stroke={active ? color : '#e2e8f0'} />
                  <text x={mid.x} y={mid.y + 3} textAnchor="middle" fontFamily="ui-monospace, monospace" fontSize={11} fill="#0f172a">
                    {it.label || '(라벨 없음)'}
                  </text>
                </g>
              )
            })}

            {/* 연결 진행중 임시선 */}
            {connect && (
              <line x1={center(connect.fromId).x} y1={center(connect.fromId).y} x2={connect.x} y2={connect.y} stroke="#2563eb" strokeWidth={2} strokeDasharray="6 5" />
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
                    <rect x={p.x - 4} y={p.y - 4} width={BLOCK.w + 8} height={BLOCK.h + 8} rx={11} fill="none" stroke="#2563eb" strokeWidth={2.2} />
                  )}
                  <rect x={p.x} y={p.y} width={BLOCK.w} height={BLOCK.h} rx={9} fill="#ffffff" stroke="#94a3b8" strokeWidth={1.4} style={{ cursor: 'move' }} onPointerDown={(e) => startDrag(e, n)} />
                  <text x={p.x + 14} y={p.y + 27} fontFamily="sans-serif" fontSize={14} fontWeight={600} fill="#111827" style={{ pointerEvents: 'none' }}>
                    {truncate(n.name || '(이름 없음)')}
                  </text>
                  <text x={p.x + 14} y={p.y + 46} fontFamily="ui-monospace, monospace" fontSize={10} fill="#94a3b8" style={{ pointerEvents: 'none' }}>
                    SUBSYSTEM
                  </text>
                  {[
                    { x: cx, y: p.y },
                    { x: p.x + BLOCK.w, y: cy },
                    { x: cx, y: p.y + BLOCK.h },
                    { x: p.x, y: cy },
                  ].map((h, i) => (
                    <circle key={i} cx={h.x} cy={h.y} r={5} fill="#ffffff" stroke="#2563eb" strokeWidth={2} style={{ cursor: 'crosshair' }} onPointerDown={(e) => startConnect(e, n)} />
                  ))}
                </g>
              )
            })}
          </g>
        </svg>

        {/* 인터페이스 편집 팝오버 (HTML 오버레이 — 줌/팬 반영해 배치) */}
        {iface && ifaceMid && (
          <div
            className="absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-gray-300 bg-white p-3 shadow-lg"
            style={{ left: view.tx + ifaceMid.x * view.k, top: view.ty + ifaceMid.y * view.k + 12 }}
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
                  onChange={(e) => fmea.updateInterface(iface.id, { kind: e.target.value as InterfaceKind })}
                  className="mt-0.5 block rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {KINDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => fmea.updateInterface(iface.id, { fromNodeId: iface.toNodeId, toNodeId: iface.fromNodeId })}
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
                onClick={() => { fmea.removeInterface(iface.id); setSelIface(null) }}
                className="shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {/* 생성 직후 인라인 이름 편집 */}
        {editNode && editScreen && (
          <input
            autoFocus
            value={editNode.name}
            onChange={(e) => fmea.renameNode(editNode.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') setEditing(null)
            }}
            onBlur={() => setEditing(null)}
            placeholder={`${levelLabel(type, editNode.level)} 이름`}
            className="absolute z-30 rounded-md border border-blue-500 px-2 py-1 text-sm shadow outline-none"
            style={{ left: editScreen.x, top: editScreen.y, width: 168 }}
          />
        )}

        {/* 우하단 모서리 리사이즈 핸들 */}
        <div
          onPointerDown={onResizeDown}
          onPointerMove={onResizeMove}
          onPointerUp={onResizeUp}
          title="드래그해 캔버스 크기 조절"
          className="absolute bottom-0 right-0 z-20 h-4 w-4 cursor-nwse-resize"
          style={{
            background:
              'linear-gradient(135deg, transparent 0 50%, #94a3b8 50% 60%, transparent 60% 72%, #94a3b8 72% 82%, transparent 82%)',
          }}
        />
      </div>
    </div>
  )

  function selectIface(e: React.PointerEvent, id: string) {
    e.stopPropagation()
    setSelIface(id)
    setSelBlock(null)
    setSelSystem(null)
  }

  // 줌/팬과 무관하게 전체 다이어그램을 원래 해상도로 내보낸다.
  // 경계는 프레임 기하에서 계산(렌더 배율에 따른 getBBox 서브픽셀 편차 방지 → 결정적).
  function exportPng() {
    const svg = svgRef.current
    const g = gRef.current
    if (!svg || !g) return
    const m = 16
    const bx = contentBounds.x
    const by = contentBounds.y
    const w = Math.ceil(contentBounds.w + m * 2)
    const h = Math.ceil(contentBounds.h + m * 2)
    const clone = svg.cloneNode(true) as SVGSVGElement
    const gc = clone.querySelector('#diagram-content')
    gc?.removeAttribute('transform') // 배율/팬 제거
    clone.setAttribute('width', String(w))
    clone.setAttribute('height', String(h))
    clone.setAttribute('viewBox', `${bx - m} ${by - m} ${w} ${h}`)
    const xml = new XMLSerializer().serializeToString(clone)
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
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
