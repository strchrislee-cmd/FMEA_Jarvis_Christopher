import type { ApLevel, FailureCause, FailureMode, FmeaProject, ScaleTable, ScaleTables } from '../types/fmea'
import { dfmeaScalePreset } from './scalePreset'
import { allPdItemIds } from './pdiagram'

// AP 조합표 방어: 신형 {ap,label} 또는 구버전 문자열("H") 모두 수용.
// 문자열이면 label 없이 등급만. 등급이 H/M/L이 아니면 항목 제외(임의 라벨 생성 금지).
function normalizeApTable(raw: Record<string, unknown>): FmeaProject['apTable'] {
  const valid = new Set(['H', 'M', 'L'])
  const out: FmeaProject['apTable'] = {}
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === 'string') {
      if (valid.has(v)) out[k] = { ap: v as ApLevel }
    } else if (v && typeof v === 'object') {
      const ap = (v as { ap?: unknown }).ap
      const label = (v as { label?: unknown }).label
      if (typeof ap === 'string' && valid.has(ap)) {
        out[k] = typeof label === 'string' && label ? { ap: ap as ApLevel, label } : { ap: ap as ApLevel }
      }
    }
  }
  return out
}

function emptyScaleTable(): ScaleTable {
  // 등급 1~10, 기본값은 빈칸 (사용자가 사내 기준으로 채움)
  const blanks = () => Array.from({ length: 10 }, () => '')
  return { S: blanks(), O: blanks(), D: blanks() }
}

function defaultScales(): ScaleTables {
  // DFMEA는 회사 기준표 프리셋을 기본값으로, PFMEA는 빈칸(공정관리 기준은 별도)
  return { DFMEA: dfmeaScalePreset(), PFMEA: emptyScaleTable() }
}

// 빈 FMEA 프로젝트 1건 생성 (기본값)
export function createEmptyProject(): FmeaProject {
  return {
    meta: { title: '', type: 'DFMEA', riskMethod: 'RPN' },
    planning: { scope: '', inScope: '', outOfScope: '', assumptions: '', team: [] },
    structure: [],
    functions: [],
    failureModes: [],
    failureEffects: [],
    failureCauses: [],
    optimizations: [],
    scales: defaultScales(),
    apTable: {},
    documentation: { summary: '' },
    interfaces: [],
    layout: {},
    pDiagrams: [],
  }
}

// 구버전/알 수 없는 형태의 저장 데이터 방어:
// 누락 필드를 기본값으로 채우고, 제거된 필드(예: 구버전 risks[])는 무시한다.
// 배열/객체 타입만 얕게 검증 — 거창한 마이그레이션 대신 흰 화면 방지가 목적.
export function normalizeProject(raw: unknown): FmeaProject {
  const base = createEmptyProject()
  if (!raw || typeof raw !== 'object') return base
  const p = raw as Record<string, unknown>
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const obj = (v: unknown): Record<string, unknown> =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {}

  const scales = obj(p.scales)
  const mergeScale = (v: unknown): ScaleTable => {
    const s = obj(v)
    const dim = (d: unknown): string[] => {
      const a = Array.isArray(d) ? (d as unknown[]).map((x) => String(x ?? '')) : []
      return Array.from({ length: 10 }, (_, i) => a[i] ?? '')
    }
    return { S: dim(s.S), O: dim(s.O), D: dim(s.D) }
  }

  // (B-1) dangling 출처 포인터 방어: 존재하지 않는 P-Diagram 항목을 가리키면 null 처리.
  const pDiagrams = arr<FmeaProject['pDiagrams'][number]>(p.pDiagrams)
  const pdIds = allPdItemIds(pDiagrams)
  const failureModes = arr<FailureMode>(p.failureModes).map((m) =>
    m.errorStateId && !pdIds.has(m.errorStateId) ? { ...m, errorStateId: undefined } : m,
  )
  const failureCauses = arr<FailureCause>(p.failureCauses).map((c) => {
    const noiseBad = c.noiseId != null && !pdIds.has(c.noiseId)
    const ctrlBad = c.preventionControlId != null && !pdIds.has(c.preventionControlId)
    if (!noiseBad && !ctrlBad) return c
    return {
      ...c,
      noiseId: noiseBad ? undefined : c.noiseId,
      preventionControlId: ctrlBad ? undefined : c.preventionControlId,
    }
  })

  return {
    meta: { ...base.meta, ...obj(p.meta) } as FmeaProject['meta'],
    planning: { ...base.planning, ...obj(p.planning), team: arr(obj(p.planning).team) } as FmeaProject['planning'],
    structure: arr(p.structure),
    functions: arr(p.functions),
    failureModes,
    failureEffects: arr(p.failureEffects),
    failureCauses,
    optimizations: arr(p.optimizations),
    scales: {
      DFMEA: mergeScale(scales.DFMEA),
      PFMEA: mergeScale(scales.PFMEA),
    },
    apTable: normalizeApTable(obj(p.apTable)),
    documentation: { ...base.documentation, ...obj(p.documentation) } as FmeaProject['documentation'],
    interfaces: arr(p.interfaces),
    layout: obj(p.layout) as FmeaProject['layout'],
    pDiagrams,
  }
}
