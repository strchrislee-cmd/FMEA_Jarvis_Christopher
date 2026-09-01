import type { ApEntry, ApLevel } from '../types/fmea'
import { rpnBand, type RpnBand } from '../lib/risk'
import { RPN_HINT, SOD_FULL } from '../lib/help'

// Step 5·6 공용 리스크 표시 원자(단일 출처). 두 화면의 색·배지가 어긋나지 않도록 여기 한 곳에만 정의.
export type ScaleDim = 'S' | 'O' | 'D'

// S/O/D 색: S 적 / O 주황 / D 보라. 관리-점수 대응을 같은 색으로 묶는다. 항상 라벨·수치 병행(색약 대응).
export const DIM_STYLE: Record<ScaleDim, { badge: string; border: string; text: string }> = {
  S: { badge: 'bg-red-100 text-red-800', border: 'border-red-300', text: 'text-red-700' },
  O: { badge: 'bg-orange-100 text-orange-800', border: 'border-orange-300', text: 'text-orange-700' },
  D: { badge: 'bg-violet-100 text-violet-800', border: 'border-violet-300', text: 'text-violet-700' },
}
// RPN 구간 → 색상·라벨·아이콘(색상만으로 정보 전달 금지). 아이콘=방향 은유(낮음▼/중간◆/높음▲),
// 세로 중앙에 오는 글자라 배지 안 여백처럼 보이지 않는다(색약에도 형태로 구분).
const BAND_STYLE: Record<RpnBand, { cls: string; label: string; icon: string }> = {
  low: { cls: 'bg-green-100 text-green-800', label: '낮음', icon: '▼' },
  mid: { cls: 'bg-orange-100 text-orange-800', label: '중간', icon: '◆' },
  high: { cls: 'bg-red-100 text-red-800', label: '높음', icon: '▲' },
}
// 배지 공통 크기(세로 중앙 정렬·높이 통일). S/O/D·RPN·AP 모두 같은 metric.
const PILL = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-none'
// AP 등급 → 한국어·조치수준(사내 규칙). 배지 색(H 적 / M 주황 / L 녹 — RPN 밴드색과 정합).
const AP_KO: Record<ApLevel, string> = { H: '높음', M: '중간', L: '낮음' }
const AP_ACTION: Record<ApLevel, string> = { H: '조치 필수', M: '조치 권고', L: '조치 선택' }
const AP_STYLE: Record<ApLevel, string> = {
  H: 'bg-red-100 text-red-800',
  M: 'bg-orange-100 text-orange-800',
  L: 'bg-green-100 text-green-800',
}

// 안전/법규 배지(S=9·10).
export function SafetyBadge({ s }: { s?: number }) {
  return (
    <span
      title={`안전/법규 관련(S=${s}) — RPN과 무관하게 우선 검토`}
      className="mr-1 inline-flex items-center rounded bg-rose-600 px-1 py-0.5 align-middle text-[10px] font-bold text-white"
    >
      ⚠ 안전
    </span>
  )
}

// S/O/D 색 배지(값+라벨 병행). value 없으면 "미기입"(앰버). title로 척도 문구 hover(호출측이 전달).
export function ScoreChip({ dim, value, title }: { dim: ScaleDim; value?: number; title?: string }) {
  if (value == null)
    return <span className={`${PILL} bg-amber-100 text-amber-700`}>{dim} 미기입</span>
  return (
    <span title={title} className={`${PILL} ${DIM_STYLE[dim].badge}`}>
      {dim}={value} · {SOD_FULL[dim]}
    </span>
  )
}

// RPN 라운드 배지(구간 색+라벨+아이콘 병행). 다른 배지와 같은 크기·높이.
export function RpnPill({ rpn }: { rpn?: number }) {
  if (rpn == null) return <span className="text-gray-300">—</span>
  const b = BAND_STYLE[rpnBand(rpn)]
  return (
    <span title={RPN_HINT} className={`${PILL} gap-1 ${b.cls}`}>
      <span aria-hidden className="text-[10px]">{b.icon}</span>
      {rpn} · {b.label}
    </span>
  )
}

// AP 라운드 배지: 등급 + 조치수준. 사유 라벨은 기본은 배지 아래 작은 글씨,
// hideLabel=true면 배지만(호출측이 라벨을 별도 줄에 배치해 한 줄 정렬을 지킬 때).
export function ApPill({ entry, rpn, hideLabel }: { entry?: ApEntry; rpn?: number; hideLabel?: boolean }) {
  if (rpn == null) return <span className="text-gray-300">—</span>
  if (!entry) return <span className="text-amber-600">미설정</span>
  const pill = (
    <span title={`${entry.ap} (${AP_KO[entry.ap]}) · ${AP_ACTION[entry.ap]}`} className={`${PILL} ${AP_STYLE[entry.ap]}`}>
      {entry.ap} ({AP_KO[entry.ap]}) · {AP_ACTION[entry.ap]}
    </span>
  )
  if (hideLabel) return pill
  return (
    <div className="leading-tight">
      {pill}
      {entry.label && <div className="mt-0.5 break-words text-[11px] text-gray-500">{entry.label}</div>}
    </div>
  )
}
