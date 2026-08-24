// FMEA 데이터 모델 (AIAG-VDA 7단계)
// 정규화(평면 배열) 구조: 트리도 parentId로 표현하고, 하위 항목은 상위 id를 참조한다.

// ── 공통 열거형 ───────────────────────────────
export type FmeaType = 'DFMEA' | 'PFMEA'
export type RiskMethod = 'RPN' | 'AP'
export type ApLevel = 'H' | 'M' | 'L'
export type FourM = 'Man' | 'Machine' | 'Material' | 'Method'

// ── 2. Structure Analysis: 트리 ───────────────
// DFMEA: System→Subsystem→Component / PFMEA: Process→Step→WorkElement
export interface StructureNode {
  id: string
  parentId: string | null // null = 루트
  name: string
  level: number // 0,1,2 (3레벨 고정)
  category?: FourM // PFMEA Work Element(level 2)에서만 사용하는 4M 분류
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
// Severity(S)는 효과(FE)에 귀속한다.
export interface FailureEffect {
  id: string
  failureModeId: string
  text: string
  severity?: number // S 1~10
}
// Occurrence(O)/Detection(D)와 현재 관리(예방→O, 검출→D)는 원인(FC)에 귀속한다.
export interface FailureCause {
  id: string
  failureModeId: string
  text: string
  prevention?: string // 현재 예방관리 (→ O)
  occurrence?: number // O 1~10
  detectionControl?: string // 현재 검출관리 (→ D)
  detection?: number // D 1~10
}

// ── 5. Risk Analysis ──────────────────────────
// S/O/D는 FE/FC에 저장하고, 행(FE×FM×FC)·RPN·AP는 파생 계산한다(single source of truth).
// 척도표(scales)와 AP 조합표(apTable)는 편집 가능한 config로 프로젝트에 저장한다.
export type ApTable = Record<string, ApLevel> // key = "s-o-d" (예: "7-3-4")
export interface ScaleTable {
  S: string[] // index i = 등급 (i+1) 의 설명, 길이 10
  O: string[]
  D: string[]
}
export interface ScaleTables {
  DFMEA: ScaleTable
  PFMEA: ScaleTable
}

// ── 6. Optimization ───────────────────────────
// O/D 저감 조치는 원인(FC) 단위 → failureCauseId 앵커.
export type OptStatus = 'open' | 'in_progress' | 'done' // 미착수 / 진행 / 완료
export interface OptimizationItem {
  id: string
  failureCauseId: string
  preventiveAction: string // 예방조치
  detectiveAction: string // 검출조치
  responsibility: string // 담당자
  targetDate: string // 목표일
  status: OptStatus
  // 조치 후 예측값. 원본 FE/FC를 덮어쓰지 않고 여기 별도 보관한다(전/후 나란히 표시).
  severity?: number // 조치 후 S
  occurrence?: number // 조치 후 O
  detection?: number // 조치 후 D
}

// ── 7. Documentation ──────────────────────────
export interface Documentation {
  summary: string
}

// ── 블록다이어그램 (Structure Analysis 편집기) ──
// 인터페이스: 구조 노드(블록) 간 상호작용. 연결선엔 신호 이름(label)과 kind만.
// (N/C/X 분류는 이후 P-Diagram에서 블록 단위로 다룬다 — 연결선엔 없음.)
export type InterfaceKind = '신호' | '전원' | '기계'
export interface Interface {
  id: string
  fromNodeId: string
  toNodeId: string
  label: string
  kind: InterfaceKind
}
// 배치 좌표 위성 데이터. 도메인 배열엔 좌표를 넣지 않는다.
// 노드 id로 키하며, 좌표 없는 노드는 자동배치로 폴백한다.
export type Layout = Record<string, { x: number; y: number }>

// ── 1. Planning & Preparation ─────────────────
// 헤더 성격의 메타(제목/유형/방식)와 계획 내용(범위/경계/가정/팀)을 나눈다.
export interface ProjectMeta {
  title: string
  type: FmeaType
  riskMethod: RiskMethod
}

export interface TeamMember {
  id: string
  name: string
}

export interface Planning {
  scope: string // 분석 범위 설명
  inScope: string // 경계: in-scope
  outOfScope: string // 경계: out-of-scope
  assumptions: string // 가정
  team: TeamMember[] // 팀원 목록
}

// ── 전역 상태 (FMEA 프로젝트 1건, 순수 도메인 데이터) ─
// UI 커서(currentStep 등)는 포함하지 않는다 → 내보내는 JSON은 도메인 데이터만.
export interface FmeaProject {
  meta: ProjectMeta
  planning: Planning
  structure: StructureNode[]
  functions: FunctionItem[]
  failureModes: FailureMode[]
  failureEffects: FailureEffect[]
  failureCauses: FailureCause[]
  optimizations: OptimizationItem[]
  scales: ScaleTables // S/O/D 척도표 (유형별, 편집 가능)
  apTable: ApTable // AP 조합표 (편집/불러오기 가능, 미설정 시 빈 객체)
  documentation: Documentation
  interfaces: Interface[] // 블록 간 인터페이스(평면+id)
  layout: Layout // 블록 배치 좌표(위성, 별도 섹션) — 도메인 배열과 독립
}
