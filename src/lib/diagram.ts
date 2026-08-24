import type { FmeaProject, FourM } from '../types/fmea'

// 블록다이어그램 자동 레이아웃 — structure(parentId 3레벨)에서 좌표를 산출한다.
// 좌표를 저장하지 않는다(single source of truth). 트리가 바뀌면 매번 다시 계산된다.

export const DIAG = {
  col: 210, // 레벨 간 가로 간격
  boxW: 170,
  boxH: 52,
  row: 70, // 리프 간 세로 간격
  padX: 16,
  padY: 16,
}

export interface DiagramBox {
  id: string
  level: number
  name: string
  funcCount: number
  category?: FourM
  x: number
  y: number
  w: number
  h: number
}
export interface DiagramEdge {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}
export interface Diagram {
  boxes: DiagramBox[]
  edges: DiagramEdge[]
  width: number
  height: number
}

export function buildDiagram(project: FmeaProject): Diagram {
  const nodes = project.structure
  const kids = (parentId: string | null) => nodes.filter((n) => n.parentId === parentId)

  // 각 노드의 행(row) 배정: 리프는 순차, 부모는 자식들의 중앙
  const rowOf = new Map<string, number>()
  let cursor = 0
  const assign = (id: string) => {
    const cs = kids(id)
    if (cs.length === 0) {
      rowOf.set(id, cursor)
      cursor += 1
      return
    }
    cs.forEach((c) => assign(c.id))
    const first = rowOf.get(cs[0].id) ?? 0
    const last = rowOf.get(cs[cs.length - 1].id) ?? first
    rowOf.set(id, (first + last) / 2)
  }
  kids(null).forEach((r) => assign(r.id))

  const boxes: DiagramBox[] = nodes.map((n) => ({
    id: n.id,
    level: n.level,
    name: n.name,
    funcCount: project.functions.filter((f) => f.structureNodeId === n.id).length,
    category: n.category,
    x: DIAG.padX + n.level * DIAG.col,
    y: DIAG.padY + (rowOf.get(n.id) ?? 0) * DIAG.row,
    w: DIAG.boxW,
    h: DIAG.boxH,
  }))
  const byId = new Map(boxes.map((b) => [b.id, b]))

  const edges: DiagramEdge[] = []
  for (const n of nodes) {
    if (!n.parentId) continue
    const p = byId.get(n.parentId)
    const c = byId.get(n.id)
    if (!p || !c) continue
    edges.push({
      id: n.id,
      x1: p.x + p.w,
      y1: p.y + p.h / 2,
      x2: c.x,
      y2: c.y + c.h / 2,
    })
  }

  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0)
  const maxRow = boxes.reduce((m, b) => Math.max(m, (b.y - DIAG.padY) / DIAG.row), 0)
  const width = DIAG.padX * 2 + maxLevel * DIAG.col + DIAG.boxW
  const height = DIAG.padY * 2 + maxRow * DIAG.row + DIAG.boxH

  return { boxes, edges, width, height }
}
