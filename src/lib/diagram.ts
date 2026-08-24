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

// System(level 0)별 세로 슬롯(소속 Subsystem 배치가 시작되는 y). System 배치의 단일 출처 —
// 자동배치와 (빈 System의) 그룹 박스 위치가 같은 기준을 쓴다.
export interface SystemSlot {
  y: number
  empty: boolean
  endY: number
}
export function systemSlots(nodes: StructureNode[]): Record<string, SystemSlot> {
  const slots: Record<string, SystemSlot> = {}
  let cursorY = BLOCK.startY
  for (const sys of nodes.filter((n) => n.level === 0)) {
    const kids = nodes.filter((n) => n.level === 1 && n.parentId === sys.id)
    const rows = Math.max(1, Math.ceil(kids.length / BLOCK.cols))
    const endY = cursorY + rows * (BLOCK.h + BLOCK.rowGap) + BLOCK.sysGap
    slots[sys.id] = { y: cursorY, empty: kids.length === 0, endY }
    cursorY = endY
  }
  return slots
}

// 좌표 없는 블록의 자동배치. System별 슬롯 y를 기준으로 소속 Subsystem을 그리드 배치.
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

  const slots = systemSlots(nodes)
  let maxEnd = BLOCK.startY
  for (const sys of nodes.filter((n) => n.level === 0)) {
    const kids = nodes.filter((n) => n.level === 1 && n.parentId === sys.id)
    kids.forEach((n, i) => place(n, i, slots[sys.id].y))
    maxEnd = Math.max(maxEnd, slots[sys.id].endY)
  }

  // 소속 System이 없는 Subsystem(방어적): 그룹 아래에 배치
  const orphans = nodes.filter((n) => n.level === 1 && !(n.id in pos))
  orphans.forEach((n, i) => place(n, i, maxEnd))
  return pos
}

// 드릴인 캔버스용: 특정 부모의 직속 자식을 그리드로 자동배치(레벨 무관, 부모 컨텍스트).
export function childBlockPositions(
  nodes: StructureNode[],
  parentId: string,
): Record<string, Pos> {
  const pos: Record<string, Pos> = {}
  nodes
    .filter((n) => n.parentId === parentId)
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
// drillInto가 있으면 그 부모의 자식(Component)만, 없으면 최상위(Subsystem)를 배치한다.
export function blockPositions(
  project: FmeaProject,
  drillInto: string | null = null,
): Record<string, Pos> {
  const auto = drillInto
    ? childBlockPositions(project.structure, drillInto)
    : autoBlockPositions(project.structure)
  const pos: Record<string, Pos> = {}
  for (const id of Object.keys(auto)) pos[id] = project.layout[id] ?? auto[id]
  return pos
}
