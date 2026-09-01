import ExcelJS from 'exceljs'
import type { FmeaProject } from '../types/fmea'
import { buildRiskRows, isSafetyRow, rpnBand } from './risk'
import { mergeOptimizations, NO_ACTION_STATUS_LABEL, optimizationsForCause } from './optimization'
import { levelLabels, levelLabelsBilingual, structurePath } from './structure'
import { SOD_LABELS } from './help'
import { APP_NAME, DEVELOPER } from './app'
import { diagramSvg } from './diagramSvg'

// ── 서식 헬퍼 (ExcelJS) ───────────────────────────────────
// 데이터·컬럼 구성·값·색은 그대로 두고 스타일만 ExcelJS API로 표현한다.
// 색은 ARGB 8-hex(기존 xlsx-js-style에서 쓰던 값 그대로 재사용).
const LINE = { thin: 'FFBFBFBF', med: 'FF808080' }
type BorderStyle = 'thin' | 'medium'
const edge = (argb: string, style: BorderStyle) => ({ style, color: { argb } })
// 셀 테두리: 기본 얇게. leftMed=그룹 경계 세로선(약간 굵게), all=사면 굵게(안전 강조).
function borderOf(leftMed = false, all = false): Partial<ExcelJS.Borders> {
  const thin = edge(LINE.thin, 'thin')
  const med = edge(LINE.med, 'medium')
  return {
    top: all ? med : thin,
    bottom: all ? med : thin,
    left: all || leftMed ? med : thin,
    right: all ? med : thin,
  }
}

// 셀 스타일 일괄 적용. fill(ARGB)·테두리·정렬(세로 가운데+wrapText 기본)·폰트.
interface Paint {
  fill?: string
  leftMed?: boolean
  all?: boolean
  h?: 'left' | 'center'
  bold?: boolean
  size?: number
}
function paint(cell: ExcelJS.Cell, o: Paint): void {
  if (o.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }
  cell.border = borderOf(o.leftMed, o.all)
  cell.alignment = { vertical: 'middle', horizontal: o.h ?? 'left', wrapText: true }
  if (o.bold || o.size) cell.font = { ...(o.bold ? { bold: true } : {}), ...(o.size ? { size: o.size } : {}) }
}

// 시트에 2차원 배열을 채우고 열너비·행높이를 설정한다(공통).
function fill2d(ws: ExcelJS.Worksheet, data: (string | number)[][], widths: number[], headerPt = 24): void {
  ws.columns = widths.map((w) => ({ width: w }))
  const heights = rowHeights(data, widths, headerPt)
  data.forEach((rowArr, r) => {
    const row = ws.addRow(rowArr)
    row.height = heights[r].hpt
  })
}

// 표시 폭: 한글·CJK·전각은 약 2칸, 그 외 1칸(엑셀 열 너비는 반각 기준이라 한글을 1로 세면 줄 수 과소추정→잘림).
function displayWidth(txt: string): number {
  let w = 0
  for (const ch of txt) {
    const code = ch.codePointAt(0) ?? 0
    w += code >= 0x1100 ? 2 : 1 // Hangul Jamo(0x1100)~ / CJK / 전각 근사
  }
  return w
}

// 행 높이 추정(줄바꿈이 가지런하게 보이도록). 열 너비(반각 글자수) 대비 표시 폭으로 줄 수 추정.
// 명시적 개행(\n)도 줄로 세고, 한글 폭 반영. 상한을 넉넉히 둬 긴 범위/가정 텍스트가 잘리지 않게.
function rowHeights(rows: (string | number)[][], widths: number[], headerPt = 24): { hpt: number }[] {
  return rows.map((row, i) => {
    if (i === 0) return { hpt: headerPt }
    let lines = 1
    for (let c = 0; c < row.length; c++) {
      const txt = String(row[c] ?? '')
      if (!txt) continue
      const w = Math.max(4, (widths[c] ?? 10) - 1)
      let cellLines = 0
      for (const seg of txt.split('\n')) cellLines += Math.max(1, Math.ceil(displayWidth(seg) / w))
      lines = Math.max(lines, cellLines)
    }
    return { hpt: Math.min(40, lines) * 15 + 4 }
  })
}

// RPN 구간 → 연한 채움(인쇄 시 글자가 묻히지 않게). 화면과 동일 근거.
function rpnFill(v: number): string {
  const band = rpnBand(v)
  return band === 'low' ? 'FFE2EFDA' : band === 'mid' ? 'FFFCE4D6' : 'FFF4CCCC'
}
// AP 등급 → 연한 채움. H 연적 / M 연주황 / L 연녹.
function apFill(v: string): string | null {
  return v === 'H' ? 'FFF4CCCC' : v === 'M' ? 'FFFCE4D6' : v === 'L' ? 'FFE2EFDA' : null
}

// ── FMEA 본표 ─────────────────────────────────────────────
// 컬럼 그룹: 구조/기능(0-3) · 실패(4-7) · 리스크(8-13) · 조치(14-23)
const GROUP_START = new Set([4, 8, 14]) // 그룹 경계(약간 굵은 세로선 + 헤더 톤 전환)
const NUMERIC = new Set([5, 9, 11, 12, 13, 19, 20, 21, 22, 23]) // S/O/D/RPN/AP 및 조치후
const HEADER_FILL = ['FFD9E1F2', 'FFFCE4E4', 'FFE2EFDA', 'FFFDF2D9'] // 구조·실패·리스크·조치
function headerFill(c: number): string {
  return c <= 3 ? HEADER_FILL[0] : c <= 7 ? HEADER_FILL[1] : c <= 13 ? HEADER_FILL[2] : HEADER_FILL[3]
}
const MAIN_WIDTHS = [16, 16, 16, 26, 30, 7, 30, 30, 26, 7, 26, 7, 12, 12, 26, 26, 10, 12, 9, 10, 10, 10, 13, 13]

interface RowMeta {
  s?: number
  rpn: number | ''
  ap: string
  postRPN: string | number
  postAP: string | number
}

function buildMainSheet(wb: ExcelJS.Workbook, project: FmeaProject): void {
  const ws = wb.addWorksheet('FMEA')
  // 헤더 라벨은 한국어 병기(값·컬럼 구성·순서는 불변). 구조 라벨은 유형별 레벨 맵 재사용,
  // S/O/D는 화면의 SOD_LABELS 재사용(중복 정의 없음).
  const lv = levelLabelsBilingual(project.meta.type)
  const header = [
    lv[0], lv[1], lv[2], 'Function',
    '고장영향(FE)', SOD_LABELS.S, '고장모드(FM)', '고장원인(FC)',
    '예방관리', SOD_LABELS.O, '검출관리', SOD_LABELS.D, 'RPN(위험우선순위)', 'AP(조치우선순위)',
    '조치(예방)', '조치(검출)', '담당', '목표일', '상태',
    `조치후 ${SOD_LABELS.S}`, `조치후 ${SOD_LABELS.O}`, `조치후 ${SOD_LABELS.D}`, '조치후 RPN(위험우선순위)', '조치후 AP(조치우선순위)',
  ]
  const rows = buildRiskRows(project)
  const data: (string | number)[][] = [header]
  const meta: RowMeta[] = []

  for (const r of rows) {
    const fn = project.functions.find((f) => f.id === r.fm.functionId)
    const [s1, s2, s3] = fn
      ? structurePath(project.structure, fn.structureNodeId)
      : ['', '', '']
    const opts = optimizationsForCause(project, r.fc.id)
    const m = mergeOptimizations(opts, project.apTable)
    const apCell = r.rpn == null ? '' : (r.ap ?? '미설정')

    // "조치 불필요" 판단(조치 레코드 없음 + 사유 기록): 컬럼 신설 없이 기존 조치(예방)/상태 칸에 표기.
    // 미검토(빈칸)와 구분 — 미검토 행은 조치 칸을 그대로 비워 둔다.
    const reason = r.fc.noActionReason?.trim()
    const preventiveCell =
      opts.length === 0 && reason ? `${NO_ACTION_STATUS_LABEL}: ${reason}` : m.preventiveAction
    const statusCell = opts.length === 0 && reason ? NO_ACTION_STATUS_LABEL : m.status

    data.push([
      s1, s2, s3, fn?.text ?? '',
      r.fe.text, r.s ?? '', r.fm.text, r.fc.text,
      r.fc.prevention ?? '', r.o ?? '', r.fc.detectionControl ?? '', r.d ?? '',
      r.rpn ?? '', apCell,
      preventiveCell, m.detectiveAction, m.responsibility, m.targetDate, statusCell,
      m.postS, m.postO, m.postD, m.postRPN, m.postAP,
    ])
    meta.push({ s: r.s, rpn: r.rpn ?? '', ap: apCell, postRPN: m.postRPN, postAP: m.postAP })
  }

  fill2d(ws, data, MAIN_WIDTHS, 32) // 병기 헤더 2줄 여유
  // 헤더행 고정(freeze) + 필터. (기존 라이브러리는 freeze 미지원이었으나 ExcelJS는 가능)
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } }

  for (let c = 0; c < header.length; c++) {
    const leftMed = GROUP_START.has(c)
    // 헤더
    paint(ws.getCell(1, c + 1), { fill: headerFill(c), h: 'center', bold: true, leftMed })
    // 데이터
    for (let di = 0; di < meta.length; di++) {
      const r = di + 1
      const mrow = meta[di]
      const cell = ws.getCell(r + 1, c + 1)
      const h: 'left' | 'center' = NUMERIC.has(c) ? 'center' : 'left'

      // S 컬럼 안전 강조(S=9·10): 굵은 사면 테두리 + 진한 채움 + 굵게. RPN과 무관.
      if (c === 5 && isSafetyRow(mrow.s)) {
        paint(cell, { fill: 'FFF2A6A6', h, bold: true, all: true })
        continue
      }
      let fillArgb: string | null = null
      if (c === 12 && typeof mrow.rpn === 'number') fillArgb = rpnFill(mrow.rpn)
      else if (c === 22 && typeof mrow.postRPN === 'number') fillArgb = rpnFill(mrow.postRPN)
      else if (c === 13) fillArgb = apFill(mrow.ap)
      else if (c === 23 && typeof mrow.postAP === 'string') fillArgb = apFill(mrow.postAP)
      paint(cell, { fill: fillArgb ?? undefined, h, leftMed })
    }
  }
}

// ── 척도표 시트 ───────────────────────────────────────────
function buildScaleSheet(wb: ExcelJS.Workbook, project: FmeaProject): void {
  const ws = wb.addWorksheet('척도표')
  const t = project.scales[project.meta.type]
  const header = ['등급', SOD_LABELS.S, SOD_LABELS.O, SOD_LABELS.D]
  // 기준 문구가 하나도 없는 등급 행은 출력하지 않는다(빈 행이 절반이면 판독 저해).
  // S/O/D 중 하나라도 문구가 있으면 출력. 임의 문구 생성 없음 — 비면 비운 채.
  const gradeRows: (string | number)[][] = []
  let omitted = 0
  for (let i = 0; i < 10; i++) {
    const has = (t.S[i] ?? '').trim() || (t.O[i] ?? '').trim() || (t.D[i] ?? '').trim()
    if (has) gradeRows.push([i + 1, t.S[i] ?? '', t.O[i] ?? '', t.D[i] ?? ''])
    else omitted++
  }
  const data: (string | number)[][] = [header, ...gradeRows]
  const gradeEnd = data.length // 등급 행 끝(각주 제외, 1-indexed 행 = gradeEnd)
  if (omitted > 0) data.push(['그 외 등급은 기준 미정의', '', '', ''])

  const widths = [6, 46, 46, 46]
  fill2d(ws, data, widths)

  for (let c = 0; c < header.length; c++) {
    paint(ws.getCell(1, c + 1), { fill: 'FFD9E1F2', h: 'center', bold: true })
    for (let r = 1; r < gradeEnd; r++) {
      paint(ws.getCell(r + 1, c + 1), { h: c === 0 ? 'center' : 'left' })
    }
  }
  // 각주 한 줄(A:D 병합, 회색 이탤릭) — 비어있는 등급을 대체.
  if (omitted > 0) {
    const fr = gradeEnd + 1 // 1-indexed 각주 행
    ws.mergeCells(fr, 1, fr, 4)
    const cell = ws.getCell(fr, 1)
    cell.font = { italic: true, color: { argb: 'FF808080' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  }
}

// ── 표지 시트 ─────────────────────────────────────────────
function buildCoverSheet(wb: ExcelJS.Workbook, project: FmeaProject): void {
  const ws = wb.addWorksheet('표지')
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
    // FMEA 작성자(팀)와 구분되는 '도구' 항목 — 문서 작성자와 혼동되지 않게 라벨을 분리.
    ['작성 도구', `${APP_NAME} (개발: ${DEVELOPER})`],
  ]
  const widths = [18, 72] // 항목/내용 — 내용 컬럼을 넓혀 긴 범위·가정 텍스트의 줄 수를 줄인다
  fill2d(ws, data, widths)

  for (let c = 0; c < 2; c++) paint(ws.getCell(1, c + 1), { fill: 'FFD9E1F2', h: 'center', bold: true })
  for (let r = 1; r < data.length; r++) {
    paint(ws.getCell(r + 1, 1), { fill: 'FFF2F2F2', bold: true, h: 'left' })
    // 내용(우열) — 프로젝트명 값만 크게(16pt)
    paint(ws.getCell(r + 1, 2), { h: 'left', ...(r === 1 ? { bold: true, size: 16 } : {}) })
  }
}

// ── 다이어그램 이미지 시트(4번째) ────────────────────────
// 정적 SVG(diagramSvg)를 canvas로 2x 래스터→PNG로 임베드(기존 PNG 내보내기의 SVG→canvas 경로 재사용).
function svgToPngBase64(svg: string, w: number, h: number, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = Math.round(w * scale)
      cv.height = Math.round(h * scale)
      const cx = cv.getContext('2d')
      if (!cx) {
        URL.revokeObjectURL(url)
        reject(new Error('no 2d context'))
        return
      }
      cx.scale(scale, scale)
      cx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)
      resolve(cv.toDataURL('image/png').split(',')[1]) // data: 접두사 제거(ExcelJS base64)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('svg load failed'))
    }
    img.src = url
  })
}

async function buildDiagramSheet(wb: ExcelJS.Workbook, project: FmeaProject): Promise<void> {
  const dg = diagramSvg(project)
  if (!dg) return // 구조가 없으면 시트 생략
  const ws = wb.addWorksheet('다이어그램')
  ws.getCell('A1').value = `Step 2 블록다이어그램 · ${project.meta.type}`
  ws.getCell('A1').font = { bold: true }
  const b64 = await svgToPngBase64(dg.svg, dg.width, dg.height, 2)
  const id = wb.addImage({ base64: b64, extension: 'png' })
  // A2 아래에 자연 크기(1x)로 배치 — 2x 래스터라 인쇄·확대 시 선명.
  ws.addImage(id, { tl: { col: 0, row: 1 }, ext: { width: dg.width, height: dg.height } })
}

// 파일명: {프로젝트명}_{DFMEA|PFMEA}_{YYYYMMDD}.xlsx
function fileName(project: FmeaProject): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const title = (project.meta.title || 'fmea').trim().replace(/\s+/g, '_')
  return `${title}_${project.meta.type}_${ymd}.xlsx`
}

export async function exportExcel(project: FmeaProject): Promise<void> {
  const wb = new ExcelJS.Workbook()
  buildCoverSheet(wb, project)
  buildMainSheet(wb, project)
  buildScaleSheet(wb, project)
  await buildDiagramSheet(wb, project) // 4번째: Step 2 블록다이어그램 이미지(구조 있을 때만)
  // ExcelJS는 writeFile(Node)만 자동 저장 → 브라우저는 Blob으로 다운로드(file:// 단일 HTML 호환).
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(project)
  a.click()
  URL.revokeObjectURL(url)
}
