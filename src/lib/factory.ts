import type { FmeaProject } from '../types/fmea'

// 빈 FMEA 프로젝트 1건 생성 (기본값)
export function createEmptyProject(): FmeaProject {
  return {
    meta: { title: '', type: 'DFMEA', riskMethod: 'RPN' },
    structure: [],
    functions: [],
    failureModes: [],
    failureEffects: [],
    failureCauses: [],
    risks: [],
    optimizations: [],
    documentation: { summary: '' },
  }
}
