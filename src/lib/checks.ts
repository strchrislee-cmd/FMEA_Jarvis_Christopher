import type { FmeaProject } from '../types/fmea'
import { buildRiskRows, isSafetyRow, type RiskRow } from './risk'

// FMEA 품질 점검 엔진 — 순수 계산(AI/API 無). 규칙은 buildRiskRows·project만 읽고
// RPN/AP를 재계산하지 않으며(단일 진실원), 결과를 저장하지 않는다(파생). 문장 생성 없음:
// title은 규칙당 고정 라벨, note는 데이터 값만.
export type CheckSeverity = 'high' | 'medium' | 'low'
// 규칙이 늘 때 UI 그룹핑용(2차 확장 대비). 1차는 'action'만 사용.
export type CheckCategory = 'action' | 'completeness' | 'calibration' | 'controls' | 'pdiagram' | 'traceability'

// 위반 항목. target으로 해당 단계+엔티티를 가리켜 점프에 사용(2차엔 다른 step도).
export interface CheckItem {
  target: { step: number; id: string }
  label: string // 표시용(엔티티 텍스트), 생성 아님
  note: string // 위반 근거(값만)
}
export interface CheckResult {
  ruleId: string
  category: CheckCategory
  severity: CheckSeverity
  title: string
  items: CheckItem[] // 비면 통과
}

export interface CheckConfig {
  rpnActionBaseline: number // 조치 필요 판정 RPN 기준선(사용자 설정, 프로젝트 저장). 밴드색 임계와 별개.
}
export const DEFAULT_CHECK_CONFIG: CheckConfig = { rpnActionBaseline: 100 }

const STEP5 = 4 // Step 5(리스크 분석) 인덱스 — 위반 행 점프 대상

// "조치 있음" = 그 FC에 optimization 레코드가 존재(내용 공백 여부는 1차 미판정).
function hasAction(project: FmeaProject, fcId: string): boolean {
  return project.optimizations.some((o) => o.failureCauseId === fcId)
}
// "조치 불필요" 판단(검토 후 사유 기록) 여부 — 미검토(빈칸)와 구분.
const hasNoActionReason = (r: RiskRow): boolean => !!r.fc.noActionReason?.trim()
const rowKey = (r: RiskRow): string => `${r.fe.id}-${r.fm.id}-${r.fc.id}`
const rowLabel = (r: RiskRow): string => `${r.fm.text} · ${r.fe.text} · ${r.fc.text}`
const toItem = (r: RiskRow, note: string): CheckItem => ({
  target: { step: STEP5, id: rowKey(r) },
  label: rowLabel(r),
  note,
})

type CheckRule = (project: FmeaProject, config: CheckConfig) => CheckResult

// R1: RPN이 기준선 이상인데 조치가 없는 행. "조치 불필요" 판단이 기록된 행은 검토 완료로 보아 제외.
const rpnNoAction: CheckRule = (project, config) => {
  const items = buildRiskRows(project)
    .filter(
      (r) =>
        r.rpn != null &&
        r.rpn >= config.rpnActionBaseline &&
        !hasAction(project, r.fc.id) &&
        !hasNoActionReason(r),
    )
    .map((r) => toItem(r, `RPN ${r.rpn} ≥ 기준 ${config.rpnActionBaseline}, 조치 없음`))
  return {
    ruleId: 'rpn-no-action',
    category: 'action',
    severity: 'high',
    title: `RPN ${config.rpnActionBaseline} 이상인데 조치가 없는 행`,
    items,
  }
}

// R2: S가 9·10(안전/법규)인데 조치가 없는 행 — RPN과 무관.
// ★ 안전 행은 "조치 불필요" 판단이 기록돼도 제외하지 않는다(안전은 판단으로 waive 불가) — note에 표기해 별도로 보이게.
const safetyNoAction: CheckRule = (project) => {
  const items = buildRiskRows(project)
    .filter((r) => isSafetyRow(r.s) && !hasAction(project, r.fc.id))
    .map((r) =>
      toItem(r, `S=${r.s} 안전/법규, 조치 없음${hasNoActionReason(r) ? ' (조치 불필요 판단 있음 — 안전 항목은 재확인 권고)' : ''}`),
    )
  return {
    ruleId: 'safety-no-action',
    category: 'action',
    severity: 'high',
    title: 'S가 9·10인데 조치가 없는 행 (RPN 무관)',
    items,
  }
}

// R3: 조치 전/후 S·O·D가 동일해 저감 효과가 0인 조치.
const zeroReduction: CheckRule = (project) => {
  const items: CheckItem[] = []
  for (const r of buildRiskRows(project)) {
    const opt = project.optimizations.find((o) => o.failureCauseId === r.fc.id)
    if (!opt) continue
    const complete = opt.severity != null && opt.occurrence != null && opt.detection != null
    if (complete && opt.severity === r.s && opt.occurrence === r.o && opt.detection === r.d) {
      items.push(toItem(r, '조치 전후 S·O·D 동일 (저감 0)'))
    }
  }
  return {
    ruleId: 'zero-reduction',
    category: 'action',
    severity: 'medium',
    title: '조치 전/후 S·O·D가 동일해 저감 효과가 0인 조치',
    items,
  }
}

// 규칙 추가는 여기 한 곳에 함수를 만들어 배열에 넣으면 된다.
export const CHECK_RULES: CheckRule[] = [rpnNoAction, safetyNoAction, zeroReduction]

export function runChecks(project: FmeaProject, config: CheckConfig): CheckResult[] {
  return CHECK_RULES.map((rule) => rule(project, config))
}
