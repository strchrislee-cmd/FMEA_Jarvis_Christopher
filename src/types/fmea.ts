// FMEA 데이터 모델 (AIAG-VDA 7단계)
// 정규화(평면 배열) 구조: 트리도 parentId로 표현하고, 하위 항목은 상위 id를 참조한다.

// ── 공통 열거형 ───────────────────────────────
export type FmeaType = 'DFMEA' | 'PFMEA'
export type RiskMethod = 'RPN' | 'AP'
export type ApLevel = 'H' | 'M' | 'L'

// ── 2. Structure Analysis: 트리 ───────────────
// DFMEA: System→Subsystem→Component / PFMEA: Process→Step→WorkElement
export interface StructureNode {
  id: string
  parentId: string | null // null = 루트
  name: string
  level: number // 0,1,2 (트리 깊이)
}

// ── 3. Function Analysis (→ StructureNode에 연결) ─
export interface FunctionItem {
  id: string
  structureNodeId: string
  text: string
}

// ── 4. Failure Analysis: 실패체인 FE←FM←FC ────────
// 실패는 기능의 부정(negation of function)이므로 FM은 반드시 functionId로 기능에 연결한다.
export interface FailureMode {
  id: string
  functionId: string // 추적성: 어떤 기능의 고장모드인가
  text: string
}
export interface FailureEffect {
  id: string
  failureModeId: string
  text: string
}
export interface FailureCause {
  id: string
  failureModeId: string
  text: string
}

// ── 5. Risk Analysis (→ FailureMode 단위 평가) ────
// S/O/D(1~10)만 저장한다. RPN/AP는 저장하지 않고 파생 계산한다(single source of truth).
export interface RiskItem {
  id: string
  failureModeId: string
  prevention: string // 현재 예방관리
  detection: string // 현재 검출관리
  severity: number // S 1~10
  occurrence: number // O 1~10
  detectability: number // D 1~10
}

// ── 6. Optimization (→ RiskItem에 연결) ───────────
export interface OptimizationItem {
  id: string
  riskId: string
  recommendedAction: string
  responsibility: string
  targetDate: string
  // 조치 후 재평가 S/O/D
  severity: number
  occurrence: number
  detectability: number
}

// ── 7. Documentation ──────────────────────────
export interface Documentation {
  summary: string
}

// ── 1. Planning & Preparation: 프로젝트 메타 ──────
export interface ProjectMeta {
  title: string
  type: FmeaType
  riskMethod: RiskMethod
}

// ── 전역 상태 (FMEA 프로젝트 1건, 순수 도메인 데이터) ─
// UI 커서(currentStep 등)는 포함하지 않는다 → 내보내는 JSON은 도메인 데이터만.
export interface FmeaProject {
  meta: ProjectMeta
  structure: StructureNode[]
  functions: FunctionItem[]
  failureModes: FailureMode[]
  failureEffects: FailureEffect[]
  failureCauses: FailureCause[]
  risks: RiskItem[]
  optimizations: OptimizationItem[]
  documentation: Documentation
}
