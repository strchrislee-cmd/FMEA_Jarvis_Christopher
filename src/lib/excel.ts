import * as XLSX from 'xlsx-js-style'
import type { FmeaProject } from '../types/fmea'
import { buildRiskRows } from './risk'
import { mergeOptimizations, optimizationsForCause } from './optimization'
import { levelLabels, structurePath } from './structure'

// 파일명: {프로젝트명}_{DFMEA|PFMEA}_{YYYYMMDD}.xlsx
function fileName(project: FmeaProject): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const title = (project.meta.title || 'fmea').trim().replace(/\s+/g, '_')
  return `${title}_${project.meta.type}_${ymd}.xlsx`
}

// 헤더 굵게 (xlsx-js-style). 스타일은 굵게 + 열 너비까지만.
const BOLD = { font: { bold: true } }

function styleHeader(ws: XLSX.WorkSheet, colCount: number, headerRow = 0) {
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: headerRow, c })
    if (ws[addr]) ws[addr].s = BOLD
  }
}

// 본표: 1행 = (FE×FM×FC) 파생 행. 값 없으면 빈칸, AP 미설정은 "미설정".
function buildMainSheet(project: FmeaProject): XLSX.WorkSheet {
  const header = [
    'Structure1', 'Structure2', 'Structure3', 'Function',
    'FE', 'S', 'FM', 'FC', '예방관리', 'O', '검출관리', 'D', 'RPN', 'AP',
    '조치(예방)', '조치(검출)', '담당', '목표일', '상태',
    '조치후 S', '조치후 O', '조치후 D', '조치후 RPN', '조치후 AP',
  ]
  const rows = buildRiskRows(project)
  const data: (string | number)[][] = [header]

  for (const r of rows) {
    const fn = project.functions.find((f) => f.id === r.fm.functionId)
    const [s1, s2, s3] = fn
      ? structurePath(project.structure, fn.structureNodeId)
      : ['', '', '']
    const m = mergeOptimizations(optimizationsForCause(project, r.fc.id), project.apTable)
    const apCell = r.rpn == null ? '' : (r.ap ?? '미설정')

    data.push([
      s1, s2, s3, fn?.text ?? '',
      r.fe.text, r.s ?? '', r.fm.text, r.fc.text,
      r.fc.prevention ?? '', r.o ?? '', r.fc.detectionControl ?? '', r.d ?? '',
      r.rpn ?? '', apCell,
      m.preventiveAction, m.detectiveAction, m.responsibility, m.targetDate, m.status,
      m.postS, m.postO, m.postD, m.postRPN, m.postAP,
    ])
  }

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = header.map((h) => ({ wch: Math.max(8, h.length + 2) }))
  styleHeader(ws, header.length)
  return ws
}

// 척도표: 현재 유형의 S/O/D 표
function buildScaleSheet(project: FmeaProject): XLSX.WorkSheet {
  const t = project.scales[project.meta.type]
  const header = ['등급', 'S 심각도', 'O 발생도', 'D 검출도']
  const data: (string | number)[][] = [header]
  for (let i = 0; i < 10; i++) {
    data.push([i + 1, t.S[i] ?? '', t.O[i] ?? '', t.D[i] ?? ''])
  }
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 6 }, { wch: 40 }, { wch: 40 }, { wch: 40 }]
  styleHeader(ws, header.length)
  return ws
}

// 표지/메타: 프로젝트명, 유형, 작성일, Step1 planning
function buildCoverSheet(project: FmeaProject): XLSX.WorkSheet {
  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { meta, planning } = project
  const data: (string | number)[][] = [
    ['항목', '내용'],
    ['프로젝트명', meta.title],
    ['유형', meta.type],
    ['리스크 방식', meta.riskMethod],
    ['작성일', today],
    ['구조 레벨', levelLabels(meta.type).join(' / ')],
    ['범위(Scope)', planning.scope],
    ['In-scope', planning.inScope],
    ['Out-of-scope', planning.outOfScope],
    ['가정(Assumptions)', planning.assumptions],
    ['팀', planning.team.map((m) => m.name).join(', ')],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [{ wch: 18 }, { wch: 60 }]
  styleHeader(ws, 2)
  return ws
}

export function exportExcel(project: FmeaProject): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildCoverSheet(project), '표지')
  XLSX.utils.book_append_sheet(wb, buildMainSheet(project), 'FMEA')
  XLSX.utils.book_append_sheet(wb, buildScaleSheet(project), '척도표')
  XLSX.writeFile(wb, fileName(project))
}
