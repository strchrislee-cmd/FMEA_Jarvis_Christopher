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
  groupPad: 24, // System 그룹 박스가 소속 블록을 감싸는 여백
}

// 스냅 격자(px, content 좌표 기준). 드래그·자동정렬이 이 배수에 맞춘다. 조정용 단일 상수.
export const GRID = 20
export const snapToGrid = (v: number): number => Math.round(v / GRID) * GRID

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

// ── 자동 정렬 ─────────────────────────────────────────────
// 한 그룹의 블록을 인터페이스(from→to) 흐름에 따라 타이디 트리로 정렬한다.
// - 열(x) = 소스로부터의 최장 경로 깊이 → from이 왼쪽, to가 오른쪽(좌우 흐름).
// - 행(y) = 리프는 순서대로 슬롯, 부모는 자식들의 y 평균 → 분기 상위가 자식들 중앙에 옴.
// 좌표는 전부 격자 배수(균등·정렬 유지). 연결 없는 블록은 0열의 리프로 쌓인다.
function layeredGroup(
  members: StructureNode[],
  edges: [string, string][],
  originX: number,
  originY: number,
): { pos: Record<string, Pos>; bottom: number } {
  const ids = new Set(members.map((m) => m.id))
  const order = members.map((m) => m.id)
  const inEdges = edges.filter(([f, t]) => ids.has(f) && ids.has(t))

  // 열(레이어): 최장 경로 깊이(위상). 순환 방어로 반복 횟수를 노드 수로 제한.
  const layer: Record<string, number> = {}
  order.forEach((id) => (layer[id] = 0))
  for (let iter = 0; iter < members.length; iter++) {
    let changed = false
    for (const [f, t] of inEdges) {
      if (layer[t] < layer[f] + 1) {
        layer[t] = layer[f] + 1
        changed = true
      }
    }
    if (!changed) break
  }

  // 후속(succ)·진입차수(멤버 순서 유지 → 안정적 배치).
  const succ: Record<string, string[]> = {}
  const indeg: Record<string, number> = {}
  order.forEach((id) => {
    succ[id] = []
    indeg[id] = 0
  })
  for (const [f, t] of inEdges) {
    succ[f].push(t)
    indeg[t]++
  }
  for (const id of order) succ[id].sort((a, b) => order.indexOf(a) - order.indexOf(b))

  // 행: 리프는 순차 슬롯, 부모는 자식 y 평균(타이디 트리). 각 노드는 한 번만 배치.
  const row: Record<string, number> = {}
  const seen = new Set<string>()
  let nextRow = 0
  const dfs = (id: string) => {
    if (seen.has(id)) return
    seen.add(id)
    if (succ[id].length === 0) {
      row[id] = nextRow++
      return
    }
    for (const k of succ[id]) dfs(k)
    const rs = succ[id].map((k) => row[k])
    row[id] = rs.reduce((a, b) => a + b, 0) / rs.length
  }
  order.filter((id) => indeg[id] === 0).forEach(dfs)
  order.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id)
      row[id] = nextRow++
    }
  }) // 순환 잔여 방어

  const colStep = snapToGrid(BLOCK.w + BLOCK.colGap)
  const rowStep = snapToGrid(BLOCK.h + BLOCK.rowGap)
  const pos: Record<string, Pos> = {}
  let maxRow = 0
  for (const id of order) {
    pos[id] = { x: originX + layer[id] * colStep, y: snapToGrid(originY + row[id] * rowStep) }
    maxRow = Math.max(maxRow, row[id])
  }
  const bottom = originY + maxRow * rowStep + BLOCK.h
  return { pos, bottom }
}

// 정렬 버튼: 현재 컨텍스트 블록의 재배치 좌표(격자 정렬). 도메인 불변 — 호출측이 layout에만 저장.
// 최상위: System 그룹별로 위→아래로 쌓고 각 그룹 내부는 레이어 정렬. 드릴: Component 그룹 1개.
export function alignedPositions(
  nodes: StructureNode[],
  interfaces: { fromNodeId: string; toNodeId: string }[],
  drillInto: string | null = null,
): Record<string, Pos> {
  const edges: [string, string][] = interfaces.map((i) => [i.fromNodeId, i.toNodeId])
  const originX = snapToGrid(BLOCK.startX)
  const out: Record<string, Pos> = {}

  if (drillInto) {
    const members = nodes.filter((n) => n.parentId === drillInto)
    if (members.length) Object.assign(out, layeredGroup(members, edges, originX, snapToGrid(BLOCK.startY)).pos)
    return out
  }

  let cursorY = snapToGrid(BLOCK.startY)
  for (const sys of nodes.filter((n) => n.level === 0)) {
    const members = nodes.filter((n) => n.level === 1 && n.parentId === sys.id)
    if (members.length === 0) {
      // 빈 System: 자리표시 박스 위치만 갱신하고 다음으로.
      out[sys.id] = { x: originX - BLOCK.groupPad, y: cursorY - BLOCK.groupPad }
      cursorY = snapToGrid(cursorY + BLOCK.h + 60 + BLOCK.sysGap)
      continue
    }
    const { pos, bottom } = layeredGroup(members, edges, originX, cursorY)
    Object.assign(out, pos)
    cursorY = snapToGrid(bottom + BLOCK.groupPad + BLOCK.sysGap)
  }
  return out
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
