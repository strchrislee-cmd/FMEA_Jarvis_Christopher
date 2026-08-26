import type { FmeaProject, FmeaType, StructureNode } from '../types/fmea'

// 유형별 3레벨 라벨 (level 0/1/2)
export function levelLabels(type: FmeaType): [string, string, string] {
  return type === 'DFMEA'
    ? ['System', 'Subsystem', 'Component']
    : ['Process', 'Step', 'Work Element']
}

export function levelLabel(type: FmeaType, level: number): string {
  return levelLabels(type)[level] ?? `Level ${level + 1}`
}

// 문서(Excel 등)용 레벨 라벨: 영문은 levelLabels 재사용, 한국어 병기만 여기서 얹는다.
const LEVEL_KO: Record<FmeaType, [string, string, string]> = {
  DFMEA: ['시스템', '서브시스템', '부품'],
  PFMEA: ['공정', '공정단계', '작업요소'],
}
export function levelLabelsBilingual(type: FmeaType): [string, string, string] {
  const en = levelLabels(type)
  const ko = LEVEL_KO[type]
  return [`${en[0]}(${ko[0]})`, `${en[1]}(${ko[1]})`, `${en[2]}(${ko[2]})`]
}

// 노드의 조상 경로를 level 슬롯(0/1/2)에 채워 반환 (Excel Structure1/2/3 컬럼용)
export function structurePath(
  nodes: StructureNode[],
  nodeId: string,
): [string, string, string] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const path: [string, string, string] = ['', '', '']
  let cur = byId.get(nodeId)
  while (cur) {
    if (cur.level >= 0 && cur.level <= 2) path[cur.level] = cur.name
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
  }
  return path
}

// 특정 부모의 직속 자식 노드
export function childrenOf(
  nodes: StructureNode[],
  parentId: string | null,
): StructureNode[] {
  return nodes.filter((n) => n.parentId === parentId)
}

// 트리 pre-order(루트→자식) 평탄화 — Step 2 트리와 동일한 노드 순서.
export function flattenTree(nodes: StructureNode[]): StructureNode[] {
  const out: StructureNode[] = []
  const walk = (parentId: string | null) => {
    for (const n of childrenOf(nodes, parentId)) {
      out.push(n)
      walk(n.id)
    }
  }
  walk(null)
  return out
}

// 조상 경로 문자열: "System › Subsystem › Component" (비어있는 슬롯 제외).
export function structurePathString(nodes: StructureNode[], nodeId: string): string {
  return structurePath(nodes, nodeId).filter(Boolean).join(' › ')
}

// 화면 표기용 노드 소속 라벨: System이 1개면 노드명만, 2개 이상이면 전체 경로.
// (구분 모호성이 생길 때만 길어지게.) 이름이 비면 레벨 라벨로 폴백.
export function nodeContextLabel(
  nodes: StructureNode[],
  nodeId: string,
  type: FmeaType,
): string {
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return ''
  const multiSystem = nodes.filter((n) => n.level === 0).length >= 2
  if (multiSystem) return structurePathString(nodes, nodeId) || levelLabel(type, node.level)
  return node.name || levelLabel(type, node.level)
}

// 노드 자신 + 모든 자손의 id 집합
function collectSubtreeIds(nodes: StructureNode[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId])
  let added = true
  while (added) {
    added = false
    for (const n of nodes) {
      if (n.parentId && ids.has(n.parentId) && !ids.has(n.id)) {
        ids.add(n.id)
        added = true
      }
    }
  }
  return ids
}

// 삭제 시 영향 개수 (확인창 표시용): 함께 사라지는 노드 수(자신 제외)와 기능 수
export function deletionImpact(
  project: FmeaProject,
  nodeId: string,
): { nodes: number; functions: number } {
  const subtree = collectSubtreeIds(project.structure, nodeId)
  const functions = project.functions.filter((f) =>
    subtree.has(f.structureNodeId),
  ).length
  return { nodes: subtree.size - 1, functions }
}

// ── cascade 정리 헬퍼 (계층형, 단일 경로) ──────────
// 평면 정규화 모델의 참조 무결성을 위해 연쇄를 따라 정리한다:
//   structure → function → failureMode → failureEffect / failureCause → optimization
// 상위 헬퍼가 하위 헬퍼를 재사용하므로 정리 로직이 한 곳에만 존재한다
// (직접 삭제 경로가 여러 개여도 같은 경로를 타서 고아가 생기지 않는다).

// FC 집합 제거 → 앵커된 optimization까지 정리 (S/O/D·관리는 FC 필드라 함께 사라짐)
export function removeFailureCauses(
  project: FmeaProject,
  causeIds: Set<string>,
): FmeaProject {
  return {
    ...project,
    failureCauses: project.failureCauses.filter((c) => !causeIds.has(c.id)),
    optimizations: project.optimizations.filter((o) => !causeIds.has(o.failureCauseId)),
  }
}

// FM 집합 제거 → 딸린 FE, 그리고 FC 이하(removeFailureCauses)까지 정리
export function removeFailureModes(
  project: FmeaProject,
  modeIds: Set<string>,
): FmeaProject {
  const causeIds = new Set(
    project.failureCauses.filter((c) => modeIds.has(c.failureModeId)).map((c) => c.id),
  )
  const cleaned = removeFailureCauses(project, causeIds)
  return {
    ...cleaned,
    failureModes: cleaned.failureModes.filter((m) => !modeIds.has(m.id)),
    failureEffects: cleaned.failureEffects.filter((e) => !modeIds.has(e.failureModeId)),
  }
}

// function 집합 제거 → 딸린 FM 이하를 removeFailureModes로 정리
export function removeFunctions(
  project: FmeaProject,
  functionIds: Set<string>,
): FmeaProject {
  const modeIds = new Set(
    project.failureModes.filter((m) => functionIds.has(m.functionId)).map((m) => m.id),
  )
  const cleaned = removeFailureModes(project, modeIds)
  return {
    ...cleaned,
    functions: cleaned.functions.filter((f) => !functionIds.has(f.id)),
  }
}

// 구조 노드(자신+자손) 제거 → 딸린 function 이하를 removeFunctions로 정리
export function deleteStructureNode(
  project: FmeaProject,
  nodeId: string,
): FmeaProject {
  const removedNodes = collectSubtreeIds(project.structure, nodeId)
  const removedFunctions = new Set(
    project.functions.filter((f) => removedNodes.has(f.structureNodeId)).map((f) => f.id),
  )
  const cleaned = removeFunctions(project, removedFunctions)
  // 같은 삭제 경로에서 노드에 앵커된 인터페이스·배치 좌표·P-Diagram도 정리(고아 방지)
  const layout = { ...cleaned.layout }
  for (const id of removedNodes) delete layout[id]
  return {
    ...cleaned,
    structure: cleaned.structure.filter((n) => !removedNodes.has(n.id)),
    interfaces: cleaned.interfaces.filter(
      (i) => !removedNodes.has(i.fromNodeId) && !removedNodes.has(i.toNodeId),
    ),
    layout,
    pDiagrams: cleaned.pDiagrams.filter((pd) => !removedNodes.has(pd.structureNodeId)),
  }
}
