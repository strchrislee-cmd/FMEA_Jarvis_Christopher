import type { FmeaProject, StructureNode } from '../types/fmea'

// 블록다이어그램 기하 상수. 블록 = Subsystem(level 1) 노드.
export const BLOCK = {
  w: 176,
  h: 64,
  colGap: 70,
  rowGap: 66,
  startX: 48,
  startY: 60,
  cols: 3,
  margin: 40,
}

export type Pos = { x: number; y: number }

// 좌표 없는 블록의 자동배치(그리드). 트리에서 파생 — 저장하지 않는다.
export function autoBlockPositions(nodes: StructureNode[]): Record<string, Pos> {
  const pos: Record<string, Pos> = {}
  nodes
    .filter((n) => n.level === 1)
    .forEach((n, i) => {
      const c = i % BLOCK.cols
      const r = Math.floor(i / BLOCK.cols)
      pos[n.id] = {
        x: BLOCK.startX + c * (BLOCK.w + BLOCK.colGap),
        y: BLOCK.startY + r * (BLOCK.h + BLOCK.rowGap),
      }
    })
  return pos
}

// 실제 사용 좌표 = layout(저장된 override) ?? 자동배치(폴백).
export function blockPositions(project: FmeaProject): Record<string, Pos> {
  const auto = autoBlockPositions(project.structure)
  const pos: Record<string, Pos> = {}
  for (const id of Object.keys(auto)) pos[id] = project.layout[id] ?? auto[id]
  return pos
}
