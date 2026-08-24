import { useEffect, useState } from 'react'
import type {
  FmeaProject,
  FourM,
  Planning,
  ProjectMeta,
} from '../types/fmea'
import { loadProject, saveProject, loadUi, saveUi } from '../lib/storage'
import { STEPS } from '../lib/steps'
import { newId } from '../lib/id'
import { deleteStructureNode, removeFailureModes, removeFunctions } from '../lib/structure'

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

  // ── Step 1: Planning ──────────────────────────
  function updateMeta(patch: Partial<ProjectMeta>) {
    setProject((p) => ({ ...p, meta: { ...p.meta, ...patch } }))
  }

  function updatePlanning(patch: Partial<Planning>) {
    setProject((p) => ({ ...p, planning: { ...p.planning, ...patch } }))
  }

  function addTeamMember(name: string) {
    setProject((p) => ({
      ...p,
      planning: {
        ...p.planning,
        team: [...p.planning.team, { id: newId(), name }],
      },
    }))
  }

  function removeTeamMember(id: string) {
    setProject((p) => ({
      ...p,
      planning: { ...p.planning, team: p.planning.team.filter((m) => m.id !== id) },
    }))
  }

  // ── Step 2: Structure ─────────────────────────
  // parentId=null 이면 루트(level 0). 자식은 부모 level+1 (최대 2).
  function addNode(parentId: string | null) {
    setProject((p) => {
      const parent = parentId ? p.structure.find((n) => n.id === parentId) : null
      const level = parent ? parent.level + 1 : 0
      if (level > 2) return p
      const node = { id: newId(), parentId, name: '', level }
      return { ...p, structure: [...p.structure, node] }
    })
  }

  function renameNode(id: string, name: string) {
    setProject((p) => ({
      ...p,
      structure: p.structure.map((n) => (n.id === id ? { ...n, name } : n)),
    }))
  }

  function setNodeCategory(id: string, category: FourM | undefined) {
    setProject((p) => ({
      ...p,
      structure: p.structure.map((n) => (n.id === id ? { ...n, category } : n)),
    }))
  }

  function removeNode(id: string) {
    setProject((p) => deleteStructureNode(p, id))
  }

  // ── Step 3: Function ──────────────────────────
  function addFunction(structureNodeId: string, text: string) {
    setProject((p) => ({
      ...p,
      functions: [...p.functions, { id: newId(), structureNodeId, text }],
    }))
  }

  // 기능 삭제는 구조 삭제와 같은 연쇄 정리 경로를 탄다(딸린 FM/FE/FC 함께 제거)
  function removeFunction(id: string) {
    setProject((p) => removeFunctions(p, new Set([id])))
  }

  // ── Step 4: Failure (FE ← FM ← FC) ────────────
  function addFailureMode(functionId: string, text: string) {
    setProject((p) => ({
      ...p,
      failureModes: [...p.failureModes, { id: newId(), functionId, text }],
    }))
  }

  // FM 삭제도 같은 연쇄 정리 경로(딸린 FE/FC 함께 제거)
  function removeFailureMode(id: string) {
    setProject((p) => removeFailureModes(p, new Set([id])))
  }

  function addFailureEffect(failureModeId: string, text: string) {
    setProject((p) => ({
      ...p,
      failureEffects: [...p.failureEffects, { id: newId(), failureModeId, text }],
    }))
  }

  function removeFailureEffect(id: string) {
    setProject((p) => ({
      ...p,
      failureEffects: p.failureEffects.filter((e) => e.id !== id),
    }))
  }

  function addFailureCause(failureModeId: string, text: string) {
    setProject((p) => ({
      ...p,
      failureCauses: [...p.failureCauses, { id: newId(), failureModeId, text }],
    }))
  }

  function removeFailureCause(id: string) {
    setProject((p) => ({
      ...p,
      failureCauses: p.failureCauses.filter((c) => c.id !== id),
    }))
  }

  // ── 스텝 이동 ─────────────────────────────────
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
    updatePlanning,
    addTeamMember,
    removeTeamMember,
    addNode,
    renameNode,
    setNodeCategory,
    removeNode,
    addFunction,
    removeFunction,
    addFailureMode,
    removeFailureMode,
    addFailureEffect,
    removeFailureEffect,
    addFailureCause,
    removeFailureCause,
    goPrev,
    goNext,
    goTo,
    importProject,
  }
}
