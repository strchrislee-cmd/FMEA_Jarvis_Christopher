import type { FmeaProject, StructureNode } from '../types/fmea'

// 블록다이어그램 기하 상수. 블록 = Subsystem(level 1) 노드.
export const BLOCK = {
  w: 176,
  h: 64,
  colGap: 70,
  rowGap: 66,
  startX: 48,
  startY: 82, // 첫 System 라벨 여유
  cols: 3,
  margin: 40,
  sysGap: 78, // System 그룹 박스 사이 간격(다음 라벨 포함)
}

export type Pos = { x: number; y: number }

// 좌표 없는 블록의 자동배치. System(level 0)별로 소속 Subsystem을 묶어 세로로 쌓는다.
// System 그룹 박스는 렌더 시 소속 블록에서 계산하므로 여기선 블록 좌표만 반환한다.
export function autoBlockPositions(nodes: StructureNode[]): Record<string, Pos> {
  const pos: Record<string, Pos> = {}
  const place = (n: StructureNode, i: number, baseY: number) => {
    const c = i % BLOCK.cols
    const r = Math.floor(i / BLOCK.cols)
    pos[n.id] = {
      x: BLOCK.startX + c * (BLOCK.w + BLOCK.colGap),
      y: baseY + r * (BLOCK.h + BLOCK.rowGap),
    }
  }

  let cursorY = BLOCK.startY
  const systems = nodes.filter((n) => n.level === 0)
  for (const sys of systems) {
    const kids = nodes.filter((n) => n.level === 1 && n.parentId === sys.id)
    kids.forEach((n, i) => place(n, i, cursorY))
    const rows = Math.max(1, Math.ceil(kids.length / BLOCK.cols))
    cursorY += rows * (BLOCK.h + BLOCK.rowGap) + BLOCK.sysGap
  }

  // 소속 System이 없는 Subsystem(방어적): 그룹 없이 아래에 배치
  const orphans = nodes.filter((n) => n.level === 1 && !(n.id in pos))
  orphans.forEach((n, i) => place(n, i, cursorY))
  return pos
}

// 실제 사용 좌표 = layout(저장된 override) ?? 자동배치(폴백).
export function blockPositions(project: FmeaProject): Record<string, Pos> {
  const auto = autoBlockPositions(project.structure)
  const pos: Record<string, Pos> = {}
  for (const id of Object.keys(auto)) pos[id] = project.layout[id] ?? auto[id]
  return pos
}
