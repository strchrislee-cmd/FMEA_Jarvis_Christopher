import { Fragment, useRef, useState } from 'react'
import type { ApEntry, ApLevel, FmeaType } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { buildRiskRows, isSafetyRow, lookupAp, RATINGS, rpnBand, type RiskRow, type RpnBand } from '../lib/risk'
import { getPDiagram } from '../lib/pdiagram'
import { nodeContextLabel } from '../lib/structure'
import { companyApPreset } from '../lib/apPreset'
import { helpFor, RPN_HINT, SOD_FULL, SOD_LABELS, type FieldKey } from '../lib/help'
import { dfmeaScalePreset, DFMEA_SCALE_NOTE } from '../lib/scalePreset'
import FieldHelp from './FieldHelp'
import PdImportSelect from './PdImportSelect'

type Fmea = ReturnType<typeof useFmea>
type ScaleDim = 'S' | 'O' | 'D'

// FM이 속한 구조 노드의 Control Factor 목록(prevention 가져오기용).
function controlsForFm(project: Fmea['project'], functionId: string) {
  const nodeId = project.functions.find((f) => f.id === functionId)?.structureNodeId
  return getPDiagram(project, nodeId ?? '')?.controls ?? []
}

// FM이 속한 구조 노드 소속 라벨(리스크 행 "구조" 컬럼용, 표시 전용).
function nodeLabelForFm(project: Fmea['project'], functionId: string) {
  const nodeId = project.functions.find((f) => f.id === functionId)?.structureNodeId
  return nodeId ? nodeContextLabel(project.structure, nodeId, project.meta.type) : ''
}
const DIMS = ['S', 'O', 'D'] as const
const AP_LEVELS: ApLevel[] = ['H', 'M', 'L']
// 리스크 표 컬럼 도움말 범례 (라벨 → 필드키). S/O/D는 중앙 라벨 맵 재사용.
const RISK_HELP: [string, FieldKey][] = [
  [SOD_LABELS.S, 'severity'],
  [SOD_LABELS.O, 'occurrence'],
  [SOD_LABELS.D, 'detection'],
  ['예방관리', 'prevention'],
  ['검출관리', 'detectionControl'],
  ['RPN', 'rpn'],
]
// RPN 구간 → 색상·라벨·아이콘(색상만으로 정보 전달 금지: 값+라벨+아이콘 병행).
// 아이콘은 막대 높이 은유(위험 클수록 높음) — 색약에도 낮음/중간/높음 구분.
const BAND_STYLE: Record<RpnBand, { cls: string; label: string; icon: string }> = {
  low: { cls: 'bg-green-100 text-green-800', label: '낮음', icon: '▁' },
  mid: { cls: 'bg-orange-100 text-orange-800', label: '중간', icon: '▄' },
  high: { cls: 'bg-red-100 text-red-800', label: '높음', icon: '█' },
}
// AP 등급 → 한국어·조치수준(사내 규칙: H=조치 필수 / M=조치 권고 / L=조치 선택).
const AP_KO: Record<ApLevel, string> = { H: '높음', M: '중간', L: '낮음' }
const AP_ACTION: Record<ApLevel, string> = { H: '조치 필수', M: '조치 권고', L: '조치 선택' }
// AP 배지 색(H 적 / M 주황 / L 녹 — RPN 밴드색과 정합). RPN·AP를 같은 급 pill로.
const AP_STYLE: Record<ApLevel, string> = {
  H: 'bg-red-100 text-red-800',
  M: 'bg-orange-100 text-orange-800',
  L: 'bg-green-100 text-green-800',
}
// S/O/D 색: S 적 / O 주황 / D 보라. 관리-점수 대응을 같은 색으로 묶는다
// (예방관리↔O 주황, 검출관리↔D 보라). 항상 라벨·수치 병행(색약 대응).
const DIM_STYLE: Record<ScaleDim, { badge: string; border: string; text: string }> = {
  S: { badge: 'bg-red-100 text-red-800', border: 'border-red-300', text: 'text-red-700' },
  O: { badge: 'bg-orange-100 text-orange-800', border: 'border-orange-300', text: 'text-orange-700' },
  D: { badge: 'bg-violet-100 text-violet-800', border: 'border-violet-300', text: 'text-violet-700' },
}

// Step 5: Risk Analysis — 파생 리스크 행(S/O/D 되쓰기) + 척도표 + AP 조합표
export default function RiskEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)
  const apEmpty = Object.keys(project.apTable).length === 0
  // 표/카드 보기 전환(세션 UI, 저장 안 함). 기본=카드(표는 비교용으로 유지).
  const [view, setView] = useState<'table' | 'card'>('card')
  // 척도 문구 조회(scales에서만; 값 없으면 빈 문자열, 문구 없으면 "기준 미정의").
  const scaleText = (dim: ScaleDim, value?: number) =>
    value == null ? '' : project.scales[project.meta.type][dim][value - 1]?.trim() || '기준 미정의'

  // 등급 선택 시 척도표 문구를 약 2초 토스트로 표시(연속 선택 시 교체). 문구는 scales에서만 읽는다.
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  function showScaleToast(dim: ScaleDim, value: number) {
    const text = project.scales[project.meta.type][dim][value - 1]?.trim()
    setToast(`${SOD_LABELS[dim]} ${value} — ${text || '기준 미정의'}`)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2000)
  }

  return (
    <div className="max-w-6xl space-y-8">
      {/* 리스크 행 테이블 */}
      <section>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="text-sm font-medium text-gray-700">
            리스크 행 (FE × FM × FC) — S/O/D 셀은 참조 FE·FC에 저장됩니다
          </h3>
          {rows.length > 0 && <ViewToggle view={view} onChange={setView} />}
        </div>
        <p className="mb-2 text-xs text-gray-400">
          {RPN_HINT} · RPN·AP 두 지표를 항상 함께 표시합니다.
        </p>
        {/* AP 조합표가 비어 있으면 안내(리스크 방식 무관, 항상). 임의 AP 생성 없음 → "미설정" 유지. */}
        {apEmpty && (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            AP 조합표가 비어 있어 AP가 “미설정”으로 표시됩니다 — 아래 AP 조합표에서 “사내 기본값 불러오기”를 눌러 채우세요.
          </p>
        )}
        {/* 축약된 도움말 범례: 한 줄 요약 + ?(상세는 팝오버). 표 영역 확보 위해 compact flex-wrap. */}
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-gray-50 px-3 py-2">
          {RISK_HELP.map(([label, k]) => (
            <span key={k} className="inline-flex items-baseline gap-1">
              <span className="text-xs font-semibold text-gray-600">{label}</span>
              <FieldHelp k={k} />
            </span>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">
            Step 4에서 각 FM에 FE와 FC를 모두 추가하면 행이 자동 생성됩니다.
          </p>
        ) : view === 'card' ? (
          // 카드 보기: 레코드 1건을 세로로 전개(전문 표시). 세션 UI 전환, 계산·모델 불변.
          <div className="space-y-3">
            {rows.map((r) => (
              <RiskCard
                key={`${r.fe.id}-${r.fm.id}-${r.fc.id}`}
                fmea={fmea}
                r={r}
                safety={isSafetyRow(r.s)}
                nodeLabel={nodeLabelForFm(project, r.fm.functionId)}
                controls={controlsForFm(project, r.fm.functionId)}
                apEntry={r.rpn == null ? undefined : lookupAp(project.apTable, r.s!, r.o!, r.d!)}
                scaleText={scaleText}
                onScaleToast={showScaleToast}
              />
            ))}
          </div>
        ) : (
          // 가로 스크롤 없이 화면 안에서 해결: table-fixed + colgroup 폭 배분.
          // overflow 컨테이너를 두지 않아 헤더 sticky가 본문 스크롤(main)에 붙는다.
          <div className="rounded-lg border border-gray-200">
            <table className="w-full table-fixed text-sm">
              {/* 관리 입력(예방/검출)은 각 레코드의 2번째 줄로 내려 폭을 확보(옵션 a).
                  메인 행은 9컬럼 → AP까지 가로 스크롤 없이 들어옴. FC를 가장 넓게(행 구분 기여). */}
              <colgroup>
                <col style={{ width: '84px' }} />{/* 구조 */}
                <col style={{ width: '14%' }} />{/* FM */}
                <col style={{ width: '14%' }} />{/* FE */}
                <col style={{ width: '76px' }} />{/* S — 두 자리(10) 온전히(셀 패딩 제외 실폭 확보) */}
                <col />{/* FC — 남는 폭(항상 가장 넓게: 행 구분 기여) */}
                <col style={{ width: '76px' }} />{/* O */}
                <col style={{ width: '76px' }} />{/* D */}
                <col style={{ width: '74px' }} />{/* RPN */}
                <col style={{ width: '86px' }} />{/* AP */}
              </colgroup>
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <Th>구조</Th>
                  <Th>고장모드 FM</Th>
                  <Th>영향 FE</Th>
                  <Th>{SOD_LABELS.S}</Th>
                  <Th>원인 FC</Th>
                  <Th>{SOD_LABELS.O}</Th>
                  <Th>{SOD_LABELS.D}</Th>
                  <Th>
                    <span title={RPN_HINT}>RPN ⓘ</span>
                  </Th>
                  <Th>AP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => {
                  const safety = isSafetyRow(r.s)
                  // 레코드 배경: 안전=rose, 그 외 교차 톤(레코드 단위로 두 줄 함께).
                  const rowTint = safety ? 'bg-rose-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'
                  return (
                    <Fragment key={`${r.fe.id}-${r.fm.id}-${r.fc.id}`}>
                      {/* 메인 행: 비교용 지표. border-t-2 = 레코드 경계(굵은 구분선) */}
                      <tr className={`border-t-2 border-gray-300 ${rowTint}`}>
                        <Td>
                          <div className="line-clamp-2 break-words text-xs text-gray-500" title={nodeLabelForFm(project, r.fm.functionId)}>
                            {nodeLabelForFm(project, r.fm.functionId)}
                          </div>
                        </Td>
                        <Td>
                          <div className="line-clamp-2 break-words" title={r.fm.text}>
                            {safety && <SafetyBadge s={r.s} />}
                            {r.fm.text}
                          </div>
                        </Td>
                        <Td>
                          <div className="line-clamp-2 break-words" title={r.fe.text}>{r.fe.text}</div>
                        </Td>
                        <Td>
                          <RatingSelect
                            value={r.s}
                            onChange={(v) => {
                              fmea.setEffectSeverity(r.fe.id, v)
                              if (v) showScaleToast('S', v)
                            }}
                          />
                        </Td>
                        <Td>
                          <div className="line-clamp-2 break-words font-medium text-gray-800" title={r.fc.text}>{r.fc.text}</div>
                        </Td>
                        <Td>
                          <RatingSelect
                            value={r.o}
                            onChange={(v) => {
                              fmea.patchCause(r.fc.id, { occurrence: v })
                              if (v) showScaleToast('O', v)
                            }}
                          />
                        </Td>
                        <Td>
                          <RatingSelect
                            value={r.d}
                            onChange={(v) => {
                              fmea.patchCause(r.fc.id, { detection: v })
                              if (v) showScaleToast('D', v)
                            }}
                          />
                        </Td>
                        <Td>
                          <RpnPill rpn={r.rpn} />
                        </Td>
                        <Td>
                          <ApPill entry={r.rpn == null ? undefined : lookupAp(project.apTable, r.s!, r.o!, r.d!)} rpn={r.rpn} />
                        </Td>
                      </tr>
                      {/* 관리 sub-row: 같은 레코드(경계선 없음, 동일 톤). 예방관리→O / 검출관리→D 를
                          라벨과 현재 점수 칩으로 짝지어 표시(52px O/D 칼럼 밑 정렬은 입력폭상 불가 → 대안). */}
                      <tr className={rowTint}>
                        <td colSpan={9} className="@container px-2 pb-2 pt-0">
                          <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 pl-1 @[720px]:grid-cols-2">
                            <div className="min-w-0 rounded-md border-l-2 border-orange-200 pl-2">
                              <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                                <span className="font-medium text-orange-700">예방관리</span>
                                <span className="rounded bg-orange-50 px-1 font-semibold text-orange-700">→ 발생도 O {r.o ?? '—'}</span>
                                <PdImportSelect
                                  label="◇ Control Factor에서 가져오기"
                                  items={controlsForFm(project, r.fm.functionId)}
                                  onPick={(it) =>
                                    fmea.patchCause(r.fc.id, { prevention: it.text, preventionControlId: it.id })
                                  }
                                />
                              </div>
                              <div className="flex items-center gap-1">
                                {r.fc.preventionControlId && (
                                  <span title="P-Diagram Control Factor에서 가져옴" className="shrink-0 text-xs text-amber-600">◇</span>
                                )}
                                <CellInput
                                  value={r.fc.prevention ?? ''}
                                  onChange={(v) => fmea.patchCause(r.fc.id, { prevention: v })}
                                  placeholder={helpFor('prevention').placeholder}
                                />
                              </div>
                            </div>
                            <div className="min-w-0 rounded-md border-l-2 border-violet-200 pl-2">
                              <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
                                <span className="font-medium text-violet-700">검출관리</span>
                                <span className="rounded bg-violet-50 px-1 font-semibold text-violet-700">→ 검출도 D {r.d ?? '—'}</span>
                              </div>
                              <CellInput
                                value={r.fc.detectionControl ?? ''}
                                onChange={(v) => fmea.patchCause(r.fc.id, { detectionControl: v })}
                                placeholder={helpFor('detectionControl').placeholder}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!apEmpty && (
          <p className="mt-1 text-xs text-gray-400">
            AP가 “미설정”이면 아래 AP 조합표에 해당 (S,O,D) 항목이 없는 것입니다.
          </p>
        )}
      </section>

      {/* 척도표 편집 (현재 유형) */}
      <ScaleTableEditor fmea={fmea} type={project.meta.type} />

      {/* AP 조합표 편집 */}
      <ApTableEditor fmea={fmea} />

      {/* 등급 선택 설명 토스트(약 2초, 자동 사라짐). 뷰포트 정중앙 고정 — 넓은 폭에서
          긴 문구가 2~3줄로 줄바꿈. pointer-events-none으로 아래 드롭다운 클릭을 막지 않는다. */}
      {toast && (
        <div className="pointer-events-none fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-xl -translate-x-1/2 -translate-y-1/2 whitespace-pre-line break-words rounded-lg bg-gray-900/95 px-4 py-2.5 text-center text-sm leading-relaxed text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

// 표/카드 공용 보기 전환 토글(세션 UI).
function ViewToggle({ view, onChange }: { view: 'table' | 'card'; onChange: (v: 'table' | 'card') => void }) {
  const btn = (v: 'table' | 'card', label: string) => (
    <button
      type="button"
      onClick={() => onChange(v)}
      className={`rounded-md px-3 py-1 text-xs font-medium ${
        view === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5">
      {btn('table', '표 보기')}
      {btn('card', '카드 보기')}
    </div>
  )
}

// 안전/법규 배지(S=9·10). 표·카드 공용.
function SafetyBadge({ s }: { s?: number }) {
  return (
    <span
      title={`안전/법규 관련(S=${s}) — RPN과 무관하게 우선 검토`}
      className="mr-1 inline-flex items-center rounded bg-rose-600 px-1 py-0.5 align-middle text-[10px] font-bold text-white"
    >
      ⚠ 안전
    </span>
  )
}

// RPN 라운드 배지(구간 색+라벨+아이콘 병행). RPN·AP를 같은 급 pill로 통일.
function RpnPill({ rpn }: { rpn?: number }) {
  if (rpn == null) return <span className="text-gray-300">—</span>
  const b = BAND_STYLE[rpnBand(rpn)]
  return (
    <span
      title={RPN_HINT}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${b.cls}`}
    >
      <span aria-hidden>{b.icon}</span>
      {rpn} · {b.label}
    </span>
  )
}

// AP 라운드 배지: 등급 + 조치수준(사유 라벨은 그 아래 작은 글씨). 라벨은 표에서 읽은 값만.
function ApPill({ entry, rpn }: { entry?: ApEntry; rpn?: number }) {
  if (rpn == null) return <span className="text-gray-300">—</span>
  if (!entry) return <span className="text-amber-600">미설정</span>
  return (
    <div className="leading-tight">
      <span
        title={`${entry.ap} (${AP_KO[entry.ap]}) · ${AP_ACTION[entry.ap]}`}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${AP_STYLE[entry.ap]}`}
      >
        {entry.ap} · {AP_ACTION[entry.ap]}
      </span>
      {entry.label && <div className="mt-0.5 break-words text-[11px] text-gray-500">{entry.label}</div>}
    </div>
  )
}

// 카드 헤더 완성도: S/O/D 기입 수(미기입 있으면 주황으로 눈에 띄게).
function Completeness({ s, o, d }: { s?: number; o?: number; d?: number }) {
  const filled = [s, o, d].filter((v) => v != null).length
  const done = filled === 3
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        done ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
      }`}
    >
      {done ? '✓ S/O/D 완성' : `S/O/D ${filled}/3 기입`}
    </span>
  )
}

// 카드: 관리/FE → 점수(같은 색)의 인과를 화살표로. 값 없으면 "미기입" 주황.
function ScoreLine({
  dim,
  value,
  scaleText,
  children,
}: {
  dim: ScaleDim
  value?: number
  scaleText: string
  children: React.ReactNode
}) {
  const st = DIM_STYLE[dim]
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {children}
      <span aria-hidden className="text-gray-400">
        →
      </span>
      {value == null ? (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          {dim} 미기입
        </span>
      ) : (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${st.badge}`}>
          {dim}={value} · {SOD_FULL[dim]}
        </span>
      )}
      {value != null && <span className={`text-xs ${st.text}`}>{scaleText}</span>}
    </div>
  )
}

// 카드 1건: 레코드를 세로로 전개(전문·말줄임 없음). 계산·모델 불변, 표시 전용.
function RiskCard({
  fmea,
  r,
  safety,
  nodeLabel,
  controls,
  apEntry,
  scaleText,
  onScaleToast,
}: {
  fmea: Fmea
  r: RiskRow
  safety: boolean
  nodeLabel: string
  controls: ReturnType<typeof controlsForFm>
  apEntry?: ApEntry
  scaleText: (dim: ScaleDim, value?: number) => string
  onScaleToast: (dim: ScaleDim, value: number) => void
}) {
  const tint = safety ? 'border-rose-300 bg-rose-50/40' : 'border-gray-200 bg-white'
  return (
    <div className={`rounded-lg border p-4 ${tint}`}>
      {/* 헤더: 구조 경로 · FM(안전 배지) · 완성도 */}
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-2">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">{nodeLabel || '(소속 없음)'}</div>
          <div className="break-words font-medium text-gray-900">
            {safety && <SafetyBadge s={r.s} />}
            {r.fm.text}
          </div>
        </div>
        <Completeness s={r.s} o={r.o} d={r.d} />
      </div>

      <div className="mt-3 space-y-3">
        {/* 영향 FE → S(심각도, 적) */}
        <div className={`rounded-md border-l-4 pl-3 ${DIM_STYLE.S.border}`}>
          <div className="text-xs font-medium text-gray-500">영향 FE</div>
          <div className="break-words text-sm text-gray-800">{r.fe.text || '—'}</div>
          <ScoreLine dim="S" value={r.s} scaleText={scaleText('S', r.s)}>
            <RatingSelect
              className="w-20"
              value={r.s}
              onChange={(v) => {
                fmea.setEffectSeverity(r.fe.id, v)
                if (v) onScaleToast('S', v)
              }}
            />
          </ScoreLine>
        </div>

        {/* 원인 FC (점수 없음) */}
        <div className="rounded-md border-l-4 border-gray-200 pl-3">
          <div className="text-xs font-medium text-gray-500">원인 FC</div>
          <div className="break-words text-sm font-medium text-gray-800">{r.fc.text || '—'}</div>
        </div>

        {/* 예방관리 입력 → O(발생도, 주황) — 라벨·점수 같은 색으로 대응 */}
        <div className={`rounded-md border-l-4 pl-3 ${DIM_STYLE.O.border}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold ${DIM_STYLE.O.text}`}>예방관리</span>
            <FieldHelp k="prevention" />
            <PdImportSelect
              label="◇ Control Factor에서 가져오기"
              items={controls}
              onPick={(it) => fmea.patchCause(r.fc.id, { prevention: it.text, preventionControlId: it.id })}
            />
            {r.fc.preventionControlId && (
              <span title="P-Diagram Control Factor에서 가져옴" className="text-xs text-amber-600">
                ◇
              </span>
            )}
          </div>
          <div className="mt-1">
            <CellInput
              value={r.fc.prevention ?? ''}
              onChange={(v) => fmea.patchCause(r.fc.id, { prevention: v })}
              placeholder={helpFor('prevention').placeholder}
            />
          </div>
          <ScoreLine dim="O" value={r.o} scaleText={scaleText('O', r.o)}>
            <RatingSelect
              className="w-20"
              value={r.o}
              onChange={(v) => {
                fmea.patchCause(r.fc.id, { occurrence: v })
                if (v) onScaleToast('O', v)
              }}
            />
          </ScoreLine>
        </div>

        {/* 검출관리 입력 → D(검출도, 보라) — 라벨·점수 같은 색으로 대응 */}
        <div className={`rounded-md border-l-4 pl-3 ${DIM_STYLE.D.border}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-semibold ${DIM_STYLE.D.text}`}>검출관리</span>
            <FieldHelp k="detectionControl" />
          </div>
          <div className="mt-1">
            <CellInput
              value={r.fc.detectionControl ?? ''}
              onChange={(v) => fmea.patchCause(r.fc.id, { detectionControl: v })}
              placeholder={helpFor('detectionControl').placeholder}
            />
          </div>
          <ScoreLine dim="D" value={r.d} scaleText={scaleText('D', r.d)}>
            <RatingSelect
              className="w-20"
              value={r.d}
              onChange={(v) => {
                fmea.patchCause(r.fc.id, { detection: v })
                if (v) onScaleToast('D', v)
              }}
            />
          </ScoreLine>
        </div>
      </div>

      {/* 하단: RPN · AP (라운드 배지, 대등하게 나란히) */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-200 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">RPN</span>
          <RpnPill rpn={r.rpn} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">AP</span>
          <ApPill entry={apEntry} rpn={r.rpn} />
        </div>
      </div>
    </div>
  )
}

function ScaleTableEditor({ fmea, type }: { fmea: Fmea; type: FmeaType }) {
  const table = fmea.project.scales[type]

  // DFMEA에만 회사 기준표 프리셋 제공(D는 Design Control 기준). 편집 후에도 되돌릴 수 있게.
  function loadPreset() {
    const has = (['S', 'O', 'D'] as const).some((d) => table[d].some((c) => c.trim()))
    if (has && !window.confirm('현재 DFMEA 척도표를 회사 기본값으로 덮어씁니다. 계속할까요?'))
      return
    fmea.setScaleTable('DFMEA', dfmeaScalePreset())
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">S/O/D 척도표 · {type}</h3>
        {type === 'DFMEA' && (
          <button
            type="button"
            onClick={loadPreset}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            회사 기본값 불러오기
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-gray-400">
        등급 1~10의 의미를 사내 기준으로 직접 입력하세요. (핸드북 원문 대신 자체 정의)
      </p>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <Th>등급</Th>
              <Th>{SOD_LABELS.S}</Th>
              <Th>{SOD_LABELS.O}</Th>
              <Th>{SOD_LABELS.D}</Th>
            </tr>
          </thead>
          <tbody>
            {RATINGS.map((rating) => (
              <tr key={rating} className="border-t border-gray-100">
                <Td>
                  <span className="font-medium text-gray-600">{rating}</span>
                </Td>
                {DIMS.map((dim) => (
                  <Td key={dim}>
                    <CellInput
                      value={table[dim][rating - 1] ?? ''}
                      onChange={(v) => fmea.setScale(type, dim, rating - 1, v)}
                    />
                  </Td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {type === 'DFMEA' && (
        <p className="mt-2 text-xs text-gray-400">※ {DFMEA_SCALE_NOTE}</p>
      )}
    </section>
  )
}

function ApTableEditor({ fmea }: { fmea: Fmea }) {
  const entries = Object.entries(fmea.project.apTable)
  const [s, setS] = useState(1)
  const [o, setO] = useState(1)
  const [d, setD] = useState(1)
  const [level, setLevel] = useState<ApLevel>('H')
  const [label, setLabel] = useState('') // 사유 라벨(선택 입력)

  function loadApPreset() {
    if (entries.length > 0 && !window.confirm('현재 AP 조합표를 사내 기본값으로 덮어씁니다. 계속할까요?'))
      return
    fmea.setApTable(companyApPreset())
  }

  // 기존 항목을 폼으로 불러와 등급·라벨 편집(라벨은 선택 입력).
  function editEntry(key: string, entry: ApEntry) {
    const [ks, ko, kd] = key.split('-').map(Number)
    setS(ks)
    setO(ko)
    setD(kd)
    setLevel(entry.ap)
    setLabel(entry.label ?? '')
  }

  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">
          AP 조합표{' '}
          <span className="ml-1 text-xs font-normal text-gray-400">
            (등록된 조합 {entries.length}개)
          </span>
        </h3>
        <button
          type="button"
          onClick={loadApPreset}
          className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          사내 기본값 불러오기
        </button>
      </div>
      <p className="mb-2 text-xs text-gray-400">
        AP는 (S,O,D) 조합 룩업입니다(RPN 구간 아님). 룩업 키 포맷:{' '}
        <code className="rounded bg-gray-100 px-1">"s-o-d"</code> (예: S7·O3·D4 → "7-3-4").
        “사내 기본값 불러오기” 후에도 개별 조합을 계속 편집할 수 있습니다.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Picker label="S" value={s} onChange={setS} />
        <Picker label="O" value={o} onChange={setO} />
        <Picker label="D" value={d} onChange={setD} />
        <label className="text-xs text-gray-500">
          AP
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as ApLevel)}
            className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {AP_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-500">
          사유 라벨(선택)
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예: 안전·법규 / 검출 취약"
            className="ml-1 w-56 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() => fmea.setApEntry(s, o, d, level, label)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          항목 추가/수정
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">칩을 클릭하면 폼으로 불러와 등급·라벨을 수정할 수 있습니다.</p>

      {entries.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {entries
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, entry]) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm"
              >
                <button
                  type="button"
                  onClick={() => editEntry(key, entry)}
                  className="flex items-center gap-1 rounded-full hover:text-blue-600"
                  title="클릭해 편집"
                >
                  <code>{key}</code> → <span className="font-medium">{entry.ap}</span>
                  {entry.label && <span className="text-xs text-gray-500">· {entry.label}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => fmea.removeApEntry(key)}
                  aria-label={`${key} 삭제`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-300 hover:text-gray-700"
                >
                  ×
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  )
}

function RatingSelect({
  value,
  onChange,
  className,
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
  className?: string
}) {
  // px-2 + 넉넉한 폭으로 두 자리("10")가 잘리지 않게. 표=w-full(넓힌 컬럼), 카드=w-20.
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      className={`min-w-0 rounded-md border border-gray-300 px-2 py-1 text-sm ${className ?? 'w-full'}`}
    >
      <option value="">—</option>
      {RATINGS.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  )
}

function Picker({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <label className="text-xs text-gray-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ml-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
      >
        {RATINGS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  )
}

function CellInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
    />
  )
}

function Th({ children }: { children: React.ReactNode }) {
  // 세로 스크롤 시 헤더 유지(sticky). 스크롤 컨테이너는 본문 main.
  return (
    <th className="sticky top-0 z-10 bg-gray-50 px-2 py-1.5 text-left font-medium">{children}</th>
  )
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-2 align-top">{children}</td>
}
