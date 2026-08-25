import type { FmeaProject, NoiseCategory, PDiagram } from '../types/fmea'
import { newId } from './id'

// P-Diagram의 단순 목록 필드(잡음은 category가 있어 별도로 다룬다).
export type PdListField = 'inputs' | 'controls' | 'outputs' | 'errorStates'

// 사이드 패널 표시용 필드 메타(정식 P-Diagram 5방향).
export const PD_FIELDS: { key: PdListField; label: string; hint: string }[] = [
  { key: 'inputs', label: '입력 신호', hint: 'Input Signal — 블록에 들어오는 요구/에너지' },
  { key: 'controls', label: '제어 인자', hint: 'Control Factor — 설계로 조절 가능한 인자' },
  { key: 'outputs', label: '이상 출력', hint: 'Ideal Output — 의도한 정상 기능/응답' },
  { key: 'errorStates', label: '오류 상태', hint: 'Error State — 의도치 않은 출력(고장모드 후보)' },
]

// 잡음 인자 5분류(정식 P-Diagram Noise Factor).
export const NOISE_CATEGORIES: { key: NoiseCategory; label: string }[] = [
  { key: 'piece', label: '부품 편차' },
  { key: 'wear', label: '시간 경과·열화' },
  { key: 'usage', label: '사용 조건' },
  { key: 'environment', label: '사용 환경' },
  { key: 'interaction', label: '시스템 상호작용' },
]

export function emptyPDiagram(structureNodeId: string): PDiagram {
  return { id: newId(), structureNodeId, inputs: [], controls: [], noises: [], outputs: [], errorStates: [] }
}

export function getPDiagram(project: FmeaProject, nodeId: string): PDiagram | undefined {
  return project.pDiagrams.find((pd) => pd.structureNodeId === nodeId)
}

// "P" 보유 칩 표시용: 항목이 하나라도 있으면 true(빈 껍데기는 미보유로 본다).
export function hasPDiagramContent(pd: PDiagram | undefined): boolean {
  if (!pd) return false
  return (
    pd.inputs.length + pd.controls.length + pd.noises.length + pd.outputs.length + pd.errorStates.length > 0
  )
}

// 모든 P-Diagram 항목 id 집합(dangling 출처 포인터 방어용).
export function allPdItemIds(pDiagrams: PDiagram[]): Set<string> {
  const ids = new Set<string>()
  for (const pd of pDiagrams) {
    for (const it of [...pd.inputs, ...pd.controls, ...pd.noises, ...pd.outputs, ...pd.errorStates]) {
      ids.add(it.id)
    }
  }
  return ids
}
