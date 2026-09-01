import type { FmeaProject, InterfaceKind } from '../types/fmea'
import { BLOCK, blockPositions, systemSlots, type Pos } from './diagram'
import { levelLabel } from './structure'
import { getPDiagram, hasPDiagramContent } from './pdiagram'

// Step 2 블록다이어그램(최상위: System 그룹 + Subsystem 블록 + 인터페이스)을 데이터에서 정적 SVG로 렌더.
// StructureDiagram의 화면 렌더와 같은 기하·색을 쓰되 편집 요소(핸들/선택/드릴)는 없다.
// Excel 이미지 시트용 — DOM/이벤트 없이 문자열만 생성한다(순수).

const KIND_COLOR: Record<InterfaceKind, string> = { 신호: '#0e7490', 전원: '#b45309', 기계: '#7c3aed' }
const PAD = 24
const EMPTY_SYS = { w: BLOCK.w + 140, h: BLOCK.h + 60 }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// 블록 경계선에서 상대 방향으로 나가는 점(화면 렌더와 동일 로직).
function border(cx: number, cy: number, w: number, h: number, tx: number, ty: number): Pos {
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return { x: cx, y: cy }
  const sx = dx !== 0 ? w / 2 / Math.abs(dx) : Infinity
  const sy = dy !== 0 ? h / 2 / Math.abs(dy) : Infinity
  const s = Math.min(sx, sy)
  return { x: cx + dx * s, y: cy + dy * s }
}
const labelW = (label: string): number => Math.max(48, (label || '(라벨 없음)').length * 8 + 14)
const truncate = (s: string, max = 16): string => (s.length > max ? s.slice(0, max - 1) + '…' : s)

// from→to 끝점에 화살촉 삼각형(마커 미사용 — canvas 래스터라이저 호환).
function arrow(p1: Pos, p2: Pos, color: string): string {
  const a = Math.atan2(p2.y - p1.y, p2.x - p1.x)
  const sz = 9
  const b1 = { x: p2.x - sz * Math.cos(a - Math.PI / 7), y: p2.y - sz * Math.sin(a - Math.PI / 7) }
  const b2 = { x: p2.x - sz * Math.cos(a + Math.PI / 7), y: p2.y - sz * Math.sin(a + Math.PI / 7) }
  return `<polygon points="${p2.x},${p2.y} ${b1.x},${b1.y} ${b2.x},${b2.y}" fill="${color}"/>`
}

export interface DiagramImage {
  svg: string
  width: number
  height: number
}

// 최상위 다이어그램 SVG 문자열 + 크기. 블록이 하나도 없으면 null(이미지 시트 생략).
export function diagramSvg(project: FmeaProject): DiagramImage | null {
  const type = project.meta.type
  const roots = project.structure.filter((n) => n.level === 0)
  const blocks = project.structure.filter((n) => n.level === 1)
  if (blocks.length === 0 && roots.length === 0) return null

  const base = blockPositions(project, null)
  const slots = systemSlots(project.structure)
  const blockIds = new Set(blocks.map((n) => n.id))
  const posOf = (id: string): Pos => base[id] ?? { x: 0, y: 0 }
  const center = (id: string): Pos => {
    const p = posOf(id)
    return { x: p.x + BLOCK.w / 2, y: p.y + BLOCK.h / 2 }
  }
  const emptySysPos = (sysId: string): Pos =>
    project.layout[sysId] ?? { x: BLOCK.startX - PAD, y: (slots[sysId]?.y ?? BLOCK.startY) - PAD }

  // System 그룹 박스(소속 Subsystem을 감싸는 경계, 빈 System은 자리표시).
  const boxes = roots.map((sys) => {
    const members = blocks.filter((b) => b.parentId === sys.id)
    if (members.length > 0) {
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
      for (const m of members) {
        const p = posOf(m.id)
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y)
        x2 = Math.max(x2, p.x + BLOCK.w); y2 = Math.max(y2, p.y + BLOCK.h)
      }
      return { id: sys.id, name: sys.name || '(이름 없음)', x: x1 - PAD, y: y1 - PAD, w: x2 - x1 + PAD * 2, h: y2 - y1 + PAD * 2 }
    }
    const p = emptySysPos(sys.id)
    return { id: sys.id, name: sys.name || '(이름 없음)', x: p.x, y: p.y, w: EMPTY_SYS.w, h: EMPTY_SYS.h }
  })

  // 콘텐츠 경계(라벨 여유 포함) → viewBox.
  let cx1 = Infinity, cy1 = Infinity, cx2 = -Infinity, cy2 = -Infinity
  for (const b of boxes) {
    cx1 = Math.min(cx1, b.x); cy1 = Math.min(cy1, b.y - 22)
    cx2 = Math.max(cx2, b.x + b.w); cy2 = Math.max(cy2, b.y + b.h)
  }
  for (const b of blocks) {
    const p = posOf(b.id)
    cx1 = Math.min(cx1, p.x); cy1 = Math.min(cy1, p.y)
    cx2 = Math.max(cx2, p.x + BLOCK.w); cy2 = Math.max(cy2, p.y + BLOCK.h)
  }
  if (!isFinite(cx1)) { cx1 = 0; cy1 = 0; cx2 = 400; cy2 = 200 }
  const M = 16
  const vbX = cx1 - M, vbY = cy1 - M, W = cx2 - cx1 + M * 2, H = cy2 - cy1 + M * 2

  const parts: string[] = []

  // System 그룹 박스 + 라벨(좌: 레벨, 우: 이름)
  for (const b of boxes) {
    parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="12" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.4" stroke-dasharray="3 4"/>`)
    parts.push(`<text x="${b.x + 12}" y="${b.y - 8}" font-family="sans-serif" font-size="12" font-weight="600" fill="#64748b">${esc(levelLabel(type, 0))}</text>`)
    parts.push(`<text x="${b.x + b.w - 12}" y="${b.y - 8}" text-anchor="end" font-family="sans-serif" font-size="12" font-weight="600" fill="#334155">${esc(b.name)}</text>`)
  }

  // 인터페이스 연결선(양끝이 현재 블록) + 화살촉 + 라벨
  for (const it of project.interfaces) {
    if (!blockIds.has(it.fromNodeId) || !blockIds.has(it.toNodeId)) continue
    const cf = center(it.fromNodeId), ct = center(it.toNodeId)
    const p1 = border(cf.x, cf.y, BLOCK.w, BLOCK.h, ct.x, ct.y)
    const p2 = border(ct.x, ct.y, BLOCK.w, BLOCK.h, cf.x, cf.y)
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
    const color = KIND_COLOR[it.kind]
    const lw = labelW(it.label)
    parts.push(`<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${color}" stroke-width="2"/>`)
    parts.push(arrow(p1, p2, color))
    parts.push(`<rect x="${mid.x - lw / 2}" y="${mid.y - 10}" width="${lw}" height="18" rx="4" fill="#ffffff" stroke="#e2e8f0"/>`)
    parts.push(`<text x="${mid.x}" y="${mid.y + 3}" text-anchor="middle" font-family="monospace" font-size="11" fill="#0f172a">${esc(it.label || '(라벨 없음)')}</text>`)
  }

  // 블록(Subsystem): 사각형 + 이름 + 레벨 라벨 + Component 수 배지 + P 칩
  for (const n of blocks) {
    const p = posOf(n.id)
    const childCount = project.structure.filter((c) => c.parentId === n.id).length
    const pdHas = hasPDiagramContent(getPDiagram(project, n.id))
    parts.push(`<rect x="${p.x}" y="${p.y}" width="${BLOCK.w}" height="${BLOCK.h}" rx="9" fill="#ffffff" stroke="#94a3b8" stroke-width="1.4"/>`)
    parts.push(`<text x="${p.x + 14}" y="${p.y + 27}" font-family="sans-serif" font-size="14" font-weight="600" fill="#111827">${esc(truncate(n.name || '(이름 없음)'))}</text>`)
    parts.push(`<text x="${p.x + 14}" y="${p.y + 46}" font-family="monospace" font-size="10" fill="#94a3b8">${esc(levelLabel(type, 1).toUpperCase())}</text>`)
    if (childCount > 0) {
      parts.push(`<rect x="${p.x + BLOCK.w - 42}" y="${p.y + 8}" width="34" height="16" rx="8" fill="#eff6ff" stroke="#bfdbfe"/>`)
      parts.push(`<text x="${p.x + BLOCK.w - 25}" y="${p.y + 20}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="600" fill="#2563eb">×${childCount}</text>`)
    }
    if (pdHas) {
      parts.push(`<rect x="${p.x + BLOCK.w - 26}" y="${p.y + BLOCK.h - 22}" width="18" height="16" rx="8" fill="#fef3c7" stroke="#fcd34d"/>`)
      parts.push(`<text x="${p.x + BLOCK.w - 17}" y="${p.y + BLOCK.h - 10}" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#b45309">P</text>`)
    }
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${vbX} ${vbY} ${W} ${H}">` +
    `<rect x="${vbX}" y="${vbY}" width="${W}" height="${H}" fill="#ffffff"/>` +
    parts.join('') +
    `</svg>`
  return { svg, width: W, height: H }
}
