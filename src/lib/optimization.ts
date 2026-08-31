import type { ApTable, FmeaProject, OptimizationItem, OptStatus } from '../types/fmea'
import { computeAP, computeRPN } from './risk'

export const OPT_STATUS_LABELS: Record<OptStatus, string> = {
  open: '미착수',
  in_progress: '진행',
  done: '완료',
}

// "조치 불필요" 사유 기본 프리셋(seed). 프로젝트에 복사되어 사용자가 수정·추가·삭제한다
// (하드코딩 상수를 직접 쓰지 않고 project.noActionPresets를 읽는다).
export const DEFAULT_NO_ACTION_PRESETS: string[] = [
  'RPN·AP가 낮아 현 상태 수용',
  '현재 예방·검출 관리로 충분히 통제됨',
  '설계 변경 불가 (사양·고객 요구 제약)',
  '상위 시스템에서 대응 (본 FMEA 범위 외)',
  '차기 개발 반영 예정',
  '유사 제품 실적상 문제 이력 없음',
]

// Excel 상태 칸에 표기할 라벨(빈칸=미검토와 구분).
export const NO_ACTION_STATUS_LABEL = '조치 불필요'

// 조치 후 S/O/D가 모두 있으면 파생 RPN/AP (저장하지 않음 — 결정 #3 동일 적용)
export function postComplete(o: OptimizationItem): boolean {
  return o.severity != null && o.occurrence != null && o.detection != null
}
export function postRPN(o: OptimizationItem): number | undefined {
  return postComplete(o) ? computeRPN(o.severity!, o.occurrence!, o.detection!) : undefined
}
export function postAP(o: OptimizationItem, apTable: ApTable) {
  return postComplete(o) ? computeAP(o.severity!, o.occurrence!, o.detection!, apTable) : undefined
}

export function optimizationsForCause(
  project: FmeaProject,
  fcId: string,
): OptimizationItem[] {
  return project.optimizations.filter((o) => o.failureCauseId === fcId)
}

// 본표(1행=FE×FM×FC)용 병합 셀.
// 조치 1건이면 조치후 S/O/D/RPN은 숫자 그대로(정렬/필터 가능),
// 다건이면 "; "로 병합한 문자열. 없으면 ''. AP 미설정은 "미설정"(임의값 없음).
export interface MergedOpt {
  preventiveAction: string
  detectiveAction: string
  responsibility: string
  targetDate: string
  status: string
  postS: string | number
  postO: string | number
  postD: string | number
  postRPN: string | number
  postAP: string
}

const EMPTY_MERGED: MergedOpt = {
  preventiveAction: '',
  detectiveAction: '',
  responsibility: '',
  targetDate: '',
  status: '',
  postS: '',
  postO: '',
  postD: '',
  postRPN: '',
  postAP: '',
}

export function mergeOptimizations(
  opts: OptimizationItem[],
  apTable: ApTable,
): MergedOpt {
  if (opts.length === 0) return { ...EMPTY_MERGED }

  if (opts.length === 1) {
    const o = opts[0]
    const complete = postComplete(o)
    return {
      preventiveAction: o.preventiveAction,
      detectiveAction: o.detectiveAction,
      responsibility: o.responsibility,
      targetDate: o.targetDate,
      status: OPT_STATUS_LABELS[o.status],
      postS: o.severity ?? '',
      postO: o.occurrence ?? '',
      postD: o.detection ?? '',
      postRPN: complete ? postRPN(o)! : '',
      postAP: complete ? (postAP(o, apTable) ?? '미설정') : '',
    }
  }

  // 다건: 문자열 병합 (일반 케이스=단일의 숫자 사용성을 지키고, 예외만 텍스트)
  const join = (fn: (o: OptimizationItem) => string | number) =>
    opts.map((o) => String(fn(o) ?? '')).join('; ')
  return {
    preventiveAction: join((o) => o.preventiveAction),
    detectiveAction: join((o) => o.detectiveAction),
    responsibility: join((o) => o.responsibility),
    targetDate: join((o) => o.targetDate),
    status: join((o) => OPT_STATUS_LABELS[o.status]),
    postS: join((o) => o.severity ?? ''),
    postO: join((o) => o.occurrence ?? ''),
    postD: join((o) => o.detection ?? ''),
    postRPN: join((o) => postRPN(o) ?? ''),
    postAP: join((o) => (postComplete(o) ? (postAP(o, apTable) ?? '미설정') : '')),
  }
}
