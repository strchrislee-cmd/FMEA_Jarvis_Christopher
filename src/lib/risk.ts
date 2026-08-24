import type {
  ApLevel,
  ApTable,
  FailureCause,
  FailureEffect,
  FailureMode,
  FmeaProject,
} from '../types/fmea'

// 회사 척도 등급 (S&PS 넘버링): 애매한 값(3·5·7·9)을 제외한 1·2·4·6·8·10 6단계.
// S/O/D 입력·척도표 행·AP 조합표 입력이 모두 이 단일 기준을 쓴다.
export const RATINGS = [1, 2, 4, 6, 8, 10] as const

// RPN = S × O × D (파생 계산)
export function computeRPN(s: number, o: number, d: number): number {
  return s * o * d
}

// AP 조합표 룩업 키. 포맷: "s-o-d" (예: computeAP(7,3,4) → "7-3-4")
export function apKey(s: number, o: number, d: number): string {
  return `${s}-${o}-${d}`
}

// AP는 (S,O,D) 조합표 룩업으로만 계산한다.
// 주의: AIAG-VDA AP는 S×O×D 곱의 구간(예: RPN>100=H)이 아니라 세 값 조합에 대한 테이블이다.
// 키가 없으면 undefined(미설정) — 임의 값을 추측하지 않는다.
export function computeAP(
  s: number,
  o: number,
  d: number,
  apTable: ApTable,
): ApLevel | undefined {
  return apTable[apKey(s, o, d)]
}

// 파생 리스크 행: 워크시트 한 행 = (FE × FM × FC) 조합.
// S/O/D는 참조 FE/FC에서 읽어오고, RPN/AP는 계산한다(저장하지 않음).
export interface RiskRow {
  fe: FailureEffect
  fm: FailureMode
  fc: FailureCause
  s?: number
  o?: number
  d?: number
  rpn?: number
  ap?: ApLevel
}

export function buildRiskRows(project: FmeaProject): RiskRow[] {
  const rows: RiskRow[] = []
  for (const fm of project.failureModes) {
    const fes = project.failureEffects.filter((e) => e.failureModeId === fm.id)
    const fcs = project.failureCauses.filter((c) => c.failureModeId === fm.id)
    for (const fe of fes) {
      for (const fc of fcs) {
        const s = fe.severity
        const o = fc.occurrence
        const d = fc.detection
        const complete = s != null && o != null && d != null
        rows.push({
          fe,
          fm,
          fc,
          s,
          o,
          d,
          rpn: complete ? computeRPN(s, o, d) : undefined,
          ap: complete ? computeAP(s, o, d, project.apTable) : undefined,
        })
      }
    }
  }
  return rows
}
