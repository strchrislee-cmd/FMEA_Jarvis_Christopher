import { useEffect, useState } from 'react'
import type {
  ApLevel,
  FmeaProject,
  FmeaType,
  FourM,
  Interface,
  NoiseCategory,
  OptimizationItem,
  PDiagram,
  Planning,
  ProjectMeta,
  ScaleTable,
} from '../types/fmea'
import { loadProject, saveProject, loadUi, saveUi } from '../lib/storage'
import { STEPS } from '../lib/steps'
import { newId } from '../lib/id'
import { apKey } from '../lib/risk'
import { emptyPDiagram, hasPDiagramContent, type PdListField } from '../lib/pdiagram'
import { createEmptyProject, normalizeProject } from '../lib/factory'
import {
  deleteStructureNode,
  removeFailureCauses,
  removeFailureModes,
  removeFunctions,
} from '../lib/structure'

type ScaleDim = 'S' | 'O' | 'D'

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
  // 생성한 노드의 id를 반환한다(다이어그램에서 생성 직후 인라인 편집에 사용).
  function addNode(parentId: string | null): string {
    const id = newId()
    setProject((p) => {
      const parent = parentId ? p.structure.find((n) => n.id === parentId) : null
      const level = parent ? parent.level + 1 : 0
      if (level > 2) return p
      return { ...p, structure: [...p.structure, { id, parentId, name: '', level }] }
    })
    return id
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
  // errorStateId는 P-Diagram Error State에서 가져온 경우의 출처(선택). 텍스트는 비미러.
  function addFailureMode(functionId: string, text: string, errorStateId?: string) {
    setProject((p) => ({
      ...p,
      failureModes: [...p.failureModes, { id: newId(), functionId, text, errorStateId }],
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

  // noiseId는 P-Diagram Noise Factor에서 가져온 경우의 출처(선택). 텍스트는 비미러.
  function addFailureCause(failureModeId: string, text: string, noiseId?: string) {
    setProject((p) => ({
      ...p,
      failureCauses: [...p.failureCauses, { id: newId(), failureModeId, text, noiseId }],
    }))
  }

  // FC 삭제는 같은 연쇄 정리 경로(앵커된 optimization 함께 제거;
  // O/D·관리는 FC 필드라 FC와 함께 사라짐)
  function removeFailureCause(id: string) {
    setProject((p) => removeFailureCauses(p, new Set([id])))
  }

  // ── Step 5: Risk (S→FE, O/D·관리→FC / 척도표 / AP표) ──
  function setEffectSeverity(feId: string, s: number | undefined) {
    setProject((p) => ({
      ...p,
      failureEffects: p.failureEffects.map((e) =>
        e.id === feId ? { ...e, severity: s } : e,
      ),
    }))
  }

  function patchCause(fcId: string, patch: Partial<{ occurrence: number; detection: number; prevention: string; detectionControl: string; preventionControlId: string | undefined }>) {
    setProject((p) => ({
      ...p,
      failureCauses: p.failureCauses.map((c) => (c.id === fcId ? { ...c, ...patch } : c)),
    }))
  }

  // 척도표: 현재 유형의 S/O/D 등급 설명 편집 (index 0 = 등급 1)
  function setScale(type: FmeaType, dim: ScaleDim, index: number, text: string) {
    setProject((p) => {
      const table = p.scales[type]
      const next = [...table[dim]]
      next[index] = text
      return { ...p, scales: { ...p.scales, [type]: { ...table, [dim]: next } } }
    })
  }

  // 척도표 전체 교체 (회사 기본값 프리셋 불러오기 등)
  function setScaleTable(type: FmeaType, table: ScaleTable) {
    setProject((p) => ({ ...p, scales: { ...p.scales, [type]: table } }))
  }

  // ── 블록다이어그램: 배치 좌표(위성) + 인터페이스 ──
  function setNodePosition(nodeId: string, pos: { x: number; y: number }) {
    setProject((p) => ({ ...p, layout: { ...p.layout, [nodeId]: pos } }))
  }

  function addInterface(iface: Interface) {
    setProject((p) => ({ ...p, interfaces: [...p.interfaces, iface] }))
  }

  function updateInterface(id: string, patch: Partial<Interface>) {
    setProject((p) => ({
      ...p,
      interfaces: p.interfaces.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }))
  }

  function removeInterface(id: string) {
    setProject((p) => ({ ...p, interfaces: p.interfaces.filter((i) => i.id !== id) }))
  }

  // ── P-Diagram (블록=구조 노드 단위, 항목은 {id,text}) ──
  // 노드에 P-Diagram이 없으면 만들어 붙이고 mut을 적용한다(지연 생성).
  function upsertPDiagram(nodeId: string, mut: (pd: PDiagram) => PDiagram) {
    setProject((p) => {
      const exists = p.pDiagrams.some((pd) => pd.structureNodeId === nodeId)
      const list = exists ? p.pDiagrams : [...p.pDiagrams, emptyPDiagram(nodeId)]
      return { ...p, pDiagrams: list.map((pd) => (pd.structureNodeId === nodeId ? mut(pd) : pd)) }
    })
  }

  function addPdItem(nodeId: string, field: PdListField) {
    upsertPDiagram(nodeId, (pd) => ({ ...pd, [field]: [...pd[field], { id: newId(), text: '' }] }))
  }

  function addNoiseItem(nodeId: string, category: NoiseCategory) {
    upsertPDiagram(nodeId, (pd) => ({ ...pd, noises: [...pd.noises, { id: newId(), text: '', category }] }))
  }

  function updatePdItem(nodeId: string, field: PdListField | 'noises', itemId: string, text: string) {
    upsertPDiagram(nodeId, (pd) => ({
      ...pd,
      [field]: (pd[field] as { id: string }[]).map((it) => (it.id === itemId ? { ...it, text } : it)),
    }))
  }

  // 항목 삭제 후 P-Diagram이 완전히 비면 껍데기를 제거한다(export/보유 칩 일관성).
  // (B-1) 그 항목을 출처로 가리키던 FMEA 인바운드 포인터도 null 처리한다
  // — FM/FC 데이터 자체는 생존, 출처 링크만 끊긴다(상류 삭제 시 하류 생존 원칙).
  function removePdItem(nodeId: string, field: PdListField | 'noises', itemId: string) {
    setProject((p) => {
      const pDiagrams = p.pDiagrams
        .map((pd) =>
          pd.structureNodeId === nodeId
            ? { ...pd, [field]: (pd[field] as { id: string }[]).filter((it) => it.id !== itemId) }
            : pd,
        )
        .filter((pd) => pd.structureNodeId !== nodeId || hasPDiagramContent(pd))
      return {
        ...p,
        pDiagrams,
        failureModes: p.failureModes.map((m) =>
          m.errorStateId === itemId ? { ...m, errorStateId: undefined } : m,
        ),
        failureCauses: p.failureCauses.map((c) => {
          if (c.noiseId !== itemId && c.preventionControlId !== itemId) return c
          return {
            ...c,
            noiseId: c.noiseId === itemId ? undefined : c.noiseId,
            preventionControlId: c.preventionControlId === itemId ? undefined : c.preventionControlId,
          }
        }),
      }
    })
  }

  // AP 조합표: (S,O,D)→{등급, 사유 라벨(선택)} 항목 추가/수정. 라벨 없으면 등급만.
  function setApEntry(s: number, o: number, d: number, level: ApLevel, label?: string) {
    const entry = label && label.trim() ? { ap: level, label: label.trim() } : { ap: level }
    setProject((p) => ({ ...p, apTable: { ...p.apTable, [apKey(s, o, d)]: entry } }))
  }

  function removeApEntry(key: string) {
    setProject((p) => {
      const next = { ...p.apTable }
      delete next[key]
      return { ...p, apTable: next }
    })
  }

  // AP 조합표 전체 교체(사내 기본값 프리셋 불러오기 등). 이후에도 항목별 편집 가능.
  function setApTable(table: FmeaProject['apTable']) {
    setProject((p) => ({ ...p, apTable: table }))
  }

  // Step 7 품질 점검: RPN 조치 기준선(양수만 반영).
  function setRpnBaseline(n: number) {
    if (!Number.isFinite(n) || n <= 0) return
    setProject((p) => ({ ...p, checks: { ...p.checks, rpnActionBaseline: n } }))
  }

  // ── Step 6: Optimization (failureCauseId 앵커) ──
  function addOptimization(failureCauseId: string) {
    setProject((p) => ({
      ...p,
      optimizations: [
        ...p.optimizations,
        {
          id: newId(),
          failureCauseId,
          preventiveAction: '',
          detectiveAction: '',
          responsibility: '',
          targetDate: '',
          status: 'open',
        },
      ],
    }))
  }

  function updateOptimization(id: string, patch: Partial<OptimizationItem>) {
    setProject((p) => ({
      ...p,
      optimizations: p.optimizations.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }))
  }

  function removeOptimization(id: string) {
    setProject((p) => ({
      ...p,
      optimizations: p.optimizations.filter((o) => o.id !== id),
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

  // 불러온 JSON도 정규화(누락 필드 보정, 구버전 형태 방어)
  function importProject(next: unknown) {
    setProject(normalizeProject(next))
  }

  // 새로 시작: 모든 입력을 비운 빈 프로젝트로 초기화하고 Step 1로.
  // (저장 effect가 빈 프로젝트를 localStorage에 덮어써 예시 잔여도 제거된다.)
  function newProject() {
    setProject(createEmptyProject())
    setCurrentStep(0)
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
    setEffectSeverity,
    patchCause,
    setScale,
    setScaleTable,
    setApEntry,
    removeApEntry,
    setApTable,
    setRpnBaseline,
    setNodePosition,
    addInterface,
    updateInterface,
    removeInterface,
    addPdItem,
    addNoiseItem,
    updatePdItem,
    removePdItem,
    addOptimization,
    updateOptimization,
    removeOptimization,
    goPrev,
    goNext,
    goTo,
    importProject,
    newProject,
  }
}
