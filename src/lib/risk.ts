import type { ApLevel } from '../types/fmea'

// RPN = S × O × D (파생 계산)
export function computeRPN(s: number, o: number, d: number): number {
  return s * o * d
}

// AP 조합표 타입. Phase 3에서 (S,O,D) 조합 → AP 레벨 매핑을 정의한다.
export type ApTable = unknown

// AP는 (S,O,D) 조합표 룩업으로 계산한다.
// 주의: AIAG-VDA AP는 S×O×D 곱의 구간(예: RPN>100=H)이 아니라 세 값 조합에 대한 테이블이다.
// RPN 구간 기반으로 AP를 산정하면 안 된다. Phase 3에서 apTable 룩업을 구현한다.
export function computeAP(
  _s: number,
  _o: number,
  _d: number,
  _apTable: ApTable,
): ApLevel {
  throw new Error('computeAP: not implemented until Phase 3 (조합표 룩업)')
}
