import type { FmeaProject } from '../types/fmea'
import { createEmptyProject, normalizeProject } from './factory'

// 도메인 데이터와 UI 상태를 분리 저장한다.
// 내보내는 프로젝트 JSON은 도메인 데이터(FmeaProject)만 포함한다.
const PROJECT_KEY = 'fmea:project:v1'
const UI_KEY = 'fmea:ui:v1'

export interface UiState {
  currentStep: number // 0~6
}

export function loadProject(): FmeaProject {
  try {
    const raw = localStorage.getItem(PROJECT_KEY)
    // 구버전/누락 필드 방어: normalizeProject로 기본값 보정 후 반환
    if (raw) return normalizeProject(JSON.parse(raw))
  } catch {
    // 파싱 실패 시 빈 프로젝트로 폴백
  }
  return createEmptyProject()
}

export function saveProject(project: FmeaProject): void {
  localStorage.setItem(PROJECT_KEY, JSON.stringify(project))
}

export function loadUi(): UiState {
  try {
    const raw = localStorage.getItem(UI_KEY)
    if (raw) return JSON.parse(raw) as UiState
  } catch {
    // ignore
  }
  return { currentStep: 0 }
}

export function saveUi(ui: UiState): void {
  localStorage.setItem(UI_KEY, JSON.stringify(ui))
}
