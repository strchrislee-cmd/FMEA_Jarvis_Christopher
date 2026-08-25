import type {
  ApEntry,
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

// RPN 색상 구간(값·라벨 병행용, 색상만으로 정보 전달 금지): ≤100 낮음 / 101~200 중간 / ≥201 높음
export type RpnBand = 'low' | 'mid' | 'high'
export function rpnBand(rpn: number): RpnBand {
  return rpn <= 100 ? 'low' : rpn <= 200 ? 'mid' : 'high'
}

// 안전/법규 행: S가 9·10이면 RPN과 무관하게 별도 강조(곱 특성상 낮은 RPN에 묻히지 않도록).
export function isSafetyRow(s: number | undefined): boolean {
  return s === 9 || s === 10
}

// AP 조합표 룩업 키. 포맷: "s-o-d" (예: computeAP(7,3,4) → "7-3-4")
export function apKey(s: number, o: number, d: number): string {
  return `${s}-${o}-${d}`
}

// AP 조합표 룩업(등급+사유 라벨). 레거시 문자열 값도 관용적으로 읽는다(label 없이 등급만).
// 키가 없으면 undefined(미설정) — 임의 값/라벨을 추측하지 않는다.
export function lookupAp(apTable: ApTable, s: number, o: number, d: number): ApEntry | undefined {
  const v = apTable[apKey(s, o, d)] as ApEntry | ApLevel | undefined
  if (v == null) return undefined
  return typeof v === 'string' ? { ap: v } : v
}

// AP는 (S,O,D) 조합표 룩업으로만 계산한다(등급만 반환).
// 주의: AIAG-VDA AP는 S×O×D 곱의 구간(예: RPN>100=H)이 아니라 세 값 조합에 대한 테이블이다.
export function computeAP(
  s: number,
  o: number,
  d: number,
  apTable: ApTable,
): ApLevel | undefined {
  return lookupAp(apTable, s, o, d)?.ap
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
