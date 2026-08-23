import { useEffect, useState } from 'react'
import type { FmeaProject, ProjectMeta } from '../types/fmea'
import { loadProject, saveProject, loadUi, saveUi } from '../lib/storage'
import { STEPS } from '../lib/steps'

// FMEA 프로젝트 1건 + UI 커서(currentStep)를 관리하고 localStorage에 자동 저장한다.
export function useFmea() {
  const [project, setProject] = useState<FmeaProject>(loadProject)
  const [currentStep, setCurrentStep] = useState<number>(() => loadUi().currentStep)

  // 도메인 데이터 자동 저장
  useEffect(() => {
    saveProject(project)
  }, [project])

  // UI 상태 자동 저장 (도메인 데이터와 분리)
  useEffect(() => {
    saveUi({ currentStep })
  }, [currentStep])

  function updateMeta(patch: Partial<ProjectMeta>) {
    setProject((p) => ({ ...p, meta: { ...p.meta, ...patch } }))
  }

  function goPrev() {
    setCurrentStep((s) => Math.max(0, s - 1))
  }

  function goNext() {
    setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  function goTo(step: number) {
    setCurrentStep(Math.min(STEPS.length - 1, Math.max(0, step)))
  }

  function importProject(next: FmeaProject) {
    setProject(next)
  }

  return {
    project,
    currentStep,
    updateMeta,
    goPrev,
    goNext,
    goTo,
    importProject,
  }
}
