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

// 특정 부모의 직속 자식 노드
export function childrenOf(
  nodes: StructureNode[],
  parentId: string | null,
): StructureNode[] {
  return nodes.filter((n) => n.parentId === parentId)
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

// 구조 노드 cascade 삭제 헬퍼.
// 평면 정규화 모델의 참조 무결성을 위해 연쇄를 따라 정리한다:
//   structure(자신+자손) → function → failureMode → failureEffect/Cause → risk → optimization
// (Phase 1엔 function 이후 데이터가 없어 실제로는 방어적 정리로 동작한다.)
export function deleteStructureNode(
  project: FmeaProject,
  nodeId: string,
): FmeaProject {
  const removedNodes = collectSubtreeIds(project.structure, nodeId)

  const removedFunctions = new Set(
    project.functions.filter((f) => removedNodes.has(f.structureNodeId)).map((f) => f.id),
  )
  const removedModes = new Set(
    project.failureModes.filter((m) => removedFunctions.has(m.functionId)).map((m) => m.id),
  )
  const removedRisks = new Set(
    project.risks.filter((r) => removedModes.has(r.failureModeId)).map((r) => r.id),
  )

  return {
    ...project,
    structure: project.structure.filter((n) => !removedNodes.has(n.id)),
    functions: project.functions.filter((f) => !removedFunctions.has(f.id)),
    failureModes: project.failureModes.filter((m) => !removedModes.has(m.id)),
    failureEffects: project.failureEffects.filter((e) => !removedModes.has(e.failureModeId)),
    failureCauses: project.failureCauses.filter((c) => !removedModes.has(c.failureModeId)),
    risks: project.risks.filter((r) => !removedRisks.has(r.id)),
    optimizations: project.optimizations.filter((o) => !removedRisks.has(o.riskId)),
  }
}
