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
  errorStateId?: string // (B-1) 출처: 이 FM을 만든 P-Diagram Error State 항목 id (텍스트 비미러)
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
  noiseId?: string // (B-1) 출처: 이 FC를 만든 P-Diagram Noise Factor 항목 id (텍스트 비미러)
  preventionControlId?: string // (B-1) 출처: prevention을 채운 P-Diagram Control Factor 항목 id (텍스트 비미러)
  noActionReason?: string // "조치 불필요" 판단 사유(선택). 있으면 검토 후 판단 = 미검토(빈칸)와 구분. 조치 레코드와 별개.
}

// ── 5. Risk Analysis ──────────────────────────
// S/O/D는 FE/FC에 저장하고, 행(FE×FM×FC)·RPN·AP는 파생 계산한다(single source of truth).
// 척도표(scales)와 AP 조합표(apTable)는 편집 가능한 config로 프로젝트에 저장한다.
// AP 조합표 항목: 등급 + 선택적 사유 라벨. label은 표에서 읽은 값만 표시(앱이 지어내지 않음).
export interface ApEntry {
  ap: ApLevel
  label?: string
}
export type ApTable = Record<string, ApEntry> // key = "s-o-d" (예: "7-3-4")
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

// ── P-Diagram (Parameter Diagram, 블록 단위) ──
// 5방향(입력신호/제어인자/잡음인자/이상출력/오류상태)을 구조 노드(Subsystem·Component)에 1:1로 붙인다.
// 항목은 {id,text} 객체 — Phase B에서 errorState→FM, control→예방관리, noise→FC 를
// 연결할 때 안정적 id가 필요(텍스트 매칭은 오타·문구수정에 취약).
export type NoiseCategory =
  | 'piece' // 부품 편차 (piece-to-piece)
  | 'wear' // 시간 경과·열화 (change over time)
  | 'usage' // 사용 조건 (customer usage)
  | 'environment' // 사용 환경 (external environment)
  | 'interaction' // 시스템 상호작용 (system interaction)
export interface PdItem {
  id: string
  text: string
}
export interface NoiseItem extends PdItem {
  category: NoiseCategory
}
export interface PDiagram {
  id: string
  structureNodeId: string // 1:1로 붙는 구조 노드
  inputs: PdItem[] // 입력 신호 (Input Signal)
  controls: PdItem[] // 제어 인자 (Control Factor)
  noises: NoiseItem[] // 잡음 인자 (Noise Factor, 5분류)
  outputs: PdItem[] // 이상 출력 (Ideal Output)
  errorStates: PdItem[] // 오류 상태 (Error State)
}

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

// Step 7 품질 점검 설정(사용자 편집·프로젝트 저장). RPN 밴드색 임계와 별개.
export interface ChecksConfig {
  rpnActionBaseline: number // 조치 필요 판정 RPN 기준선(기본 100)
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
  pDiagrams: PDiagram[] // 블록 단위 P-Diagram(평면+id, structureNodeId로 노드 참조)
  checks: ChecksConfig // Step 7 품질 점검 설정
  noActionPresets: string[] // "조치 불필요" 사유 프리셋(편집 가능, 하드코딩 아님)
}
