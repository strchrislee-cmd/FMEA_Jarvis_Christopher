import * as XLSX from 'xlsx-js-style'
import type { FmeaProject } from '../types/fmea'
import { buildRiskRows, isSafetyRow, rpnBand } from './risk'
import { mergeOptimizations, NO_ACTION_STATUS_LABEL, optimizationsForCause } from './optimization'
import { levelLabels, levelLabelsBilingual, structurePath } from './structure'
import { SOD_LABELS } from './help'
import { APP_NAME, DEVELOPER } from './app'

// ── 서식 헬퍼 (xlsx-js-style) ─────────────────────────────
// 데이터·컬럼 구성·값은 그대로 두고 셀 스타일만 입힌다.
const LINE = { thin: 'FFBFBFBF', med: 'FF808080' }
const edge = (rgb: string, style: 'thin' | 'medium') => ({ style, color: { rgb } })
// 셀 테두리: 기본 얇게. leftMed=그룹 경계 세로선(약간 굵게), all=사면 굵게(안전 강조).
function borderOf(leftMed = false, all = false) {
  const thin = edge(LINE.thin, 'thin')
  const med = edge(LINE.med, 'medium')
  return {
    top: all ? med : thin,
    bottom: all ? med : thin,
    left: all || leftMed ? med : thin,
    right: all ? med : thin,
  }
}
const solid = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } })

function put(ws: XLSX.WorkSheet, r: number, c: number, s: object) {
  const addr = XLSX.utils.encode_cell({ r, c })
  if (!ws[addr]) ws[addr] = { t: 's', v: '' } // 빈 셀도 만들어 테두리를 잇는다
  ws[addr].s = s
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

function buildMainSheet(project: FmeaProject): XLSX.WorkSheet {
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

  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = MAIN_WIDTHS.map((wch) => ({ wch }))
  ws['!rows'] = rowHeights(data, MAIN_WIDTHS, 32) // 병기 헤더 2줄 여유
  // 헤더 필터(정렬/필터 가능) — freeze pane은 이 라이브러리 라이터가 미지원.
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: header.length - 1 } }) }

  for (let c = 0; c < header.length; c++) {
    const leftMed = GROUP_START.has(c)
    // 헤더
    put(ws, 0, c, {
      font: { bold: true },
      fill: solid(headerFill(c)),
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: borderOf(leftMed),
    })
    // 데이터
    for (let di = 0; di < meta.length; di++) {
      const r = di + 1
      const mrow = meta[di]
      const align = { vertical: 'center', horizontal: NUMERIC.has(c) ? 'center' : 'left', wrapText: true }
      let fill: string | null = null
      if (c === 12 && typeof mrow.rpn === 'number') fill = rpnFill(mrow.rpn)
      else if (c === 22 && typeof mrow.postRPN === 'number') fill = rpnFill(mrow.postRPN)
      else if (c === 13) fill = apFill(mrow.ap)
      else if (c === 23 && typeof mrow.postAP === 'string') fill = apFill(mrow.postAP)

      // S 컬럼 안전 강조(S=9·10): 굵은 사면 테두리 + 진한 채움 + 굵게. RPN과 무관.
      if (c === 5 && isSafetyRow(mrow.s)) {
        put(ws, r, c, {
          font: { bold: true },
          fill: solid('FFF2A6A6'),
          alignment: align,
          border: borderOf(false, true),
        })
        continue
      }
      put(ws, r, c, {
        alignment: align,
        border: borderOf(leftMed),
        ...(fill ? { fill: solid(fill) } : {}),
      })
    }
  }
  return ws
}

// ── 척도표 시트 ───────────────────────────────────────────
function buildScaleSheet(project: FmeaProject): XLSX.WorkSheet {
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
  const gradeEnd = data.length // 등급 행 끝(각주 제외)
  if (omitted > 0) data.push(['그 외 등급은 기준 미정의', '', '', ''])

  const widths = [6, 46, 46, 46]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = widths.map((wch) => ({ wch }))
  ws['!rows'] = rowHeights(data, widths)

  for (let c = 0; c < header.length; c++) {
    put(ws, 0, c, {
      font: { bold: true },
      fill: solid('FFD9E1F2'),
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: borderOf(),
    })
    for (let r = 1; r < gradeEnd; r++) {
      put(ws, r, c, {
        alignment: { vertical: 'center', horizontal: c === 0 ? 'center' : 'left', wrapText: true },
        border: borderOf(),
      })
    }
  }
  // 각주 한 줄(A:D 병합, 회색 이탤릭) — 비어있는 등급을 대체.
  if (omitted > 0) {
    const fr = gradeEnd
    ws['!merges'] = [{ s: { r: fr, c: 0 }, e: { r: fr, c: 3 } }]
    put(ws, fr, 0, {
      font: { italic: true, color: { rgb: 'FF808080' } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
    })
  }
  return ws
}

// ── 표지 시트 ─────────────────────────────────────────────
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
    // FMEA 작성자(팀)와 구분되는 '도구' 항목 — 문서 작성자와 혼동되지 않게 라벨을 분리.
    ['작성 도구', `${APP_NAME} (개발: ${DEVELOPER})`],
  ]
  const widths = [18, 72] // 항목/내용 — 내용 컬럼을 넓혀 긴 범위·가정 텍스트의 줄 수를 줄인다
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = widths.map((wch) => ({ wch }))
  ws['!rows'] = rowHeights(data, widths)

  // 헤더행
  for (let c = 0; c < 2; c++) {
    put(ws, 0, c, {
      font: { bold: true },
      fill: solid('FFD9E1F2'),
      alignment: { vertical: 'center', horizontal: 'center' },
      border: borderOf(),
    })
  }
  for (let r = 1; r < data.length; r++) {
    // 항목 라벨(좌열) 굵게
    put(ws, r, 0, {
      font: { bold: true },
      fill: solid('FFF2F2F2'),
      alignment: { vertical: 'center', horizontal: 'left' },
      border: borderOf(),
    })
    // 내용(우열) — 프로젝트명 값만 크게
    put(ws, r, 1, {
      font: r === 1 ? { bold: true, sz: 16 } : {},
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: borderOf(),
    })
  }
  return ws
}

// 파일명: {프로젝트명}_{DFMEA|PFMEA}_{YYYYMMDD}.xlsx
function fileName(project: FmeaProject): string {
  const d = new Date()
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const title = (project.meta.title || 'fmea').trim().replace(/\s+/g, '_')
  return `${title}_${project.meta.type}_${ymd}.xlsx`
}

export function exportExcel(project: FmeaProject): void {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, buildCoverSheet(project), '표지')
  XLSX.utils.book_append_sheet(wb, buildMainSheet(project), 'FMEA')
  XLSX.utils.book_append_sheet(wb, buildScaleSheet(project), '척도표')
  XLSX.writeFile(wb, fileName(project))
}
