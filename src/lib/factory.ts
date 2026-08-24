import type { FmeaProject, ScaleTable, ScaleTables } from '../types/fmea'
import { dfmeaScalePreset } from './scalePreset'

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

  return {
    meta: { ...base.meta, ...obj(p.meta) } as FmeaProject['meta'],
    planning: { ...base.planning, ...obj(p.planning), team: arr(obj(p.planning).team) } as FmeaProject['planning'],
    structure: arr(p.structure),
    functions: arr(p.functions),
    failureModes: arr(p.failureModes),
    failureEffects: arr(p.failureEffects),
    failureCauses: arr(p.failureCauses),
    optimizations: arr(p.optimizations),
    scales: {
      DFMEA: mergeScale(scales.DFMEA),
      PFMEA: mergeScale(scales.PFMEA),
    },
    apTable: obj(p.apTable) as FmeaProject['apTable'],
    documentation: { ...base.documentation, ...obj(p.documentation) } as FmeaProject['documentation'],
  }
}
