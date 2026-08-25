import { useRef, useState } from 'react'
import type { ApLevel, FmeaType } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { buildRiskRows, isSafetyRow, RATINGS, rpnBand, type RpnBand } from '../lib/risk'
import { getPDiagram } from '../lib/pdiagram'
import { companyApPreset } from '../lib/apPreset'
import { helpFor, RPN_HINT, SOD_LABELS, type FieldKey } from '../lib/help'
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
const DIMS = ['S', 'O', 'D'] as const
const AP_LEVELS: ApLevel[] = ['H', 'M', 'L']
// 리스크 표 컬럼 도움말 범례 (라벨 → 필드키). S/O/D는 중앙 라벨 맵 재사용.
const RISK_HELP: [string, FieldKey][] = [
  [SOD_LABELS.S, 'severity'],
  [SOD_LABELS.O, 'occurrence'],
  [SOD_LABELS.D, 'detection'],
  ['예방관리', 'prevention'],
  ['검출관리', 'detectionControl'],
]
// RPN 구간 → 색상 클래스·라벨(색상만으로 정보 전달 금지: 값+라벨 병행).
const BAND_STYLE: Record<RpnBand, { cls: string; label: string }> = {
  low: { cls: 'bg-green-100 text-green-800', label: '낮음' },
  mid: { cls: 'bg-orange-100 text-orange-800', label: '중간' },
  high: { cls: 'bg-red-100 text-red-800', label: '높음' },
}

// Step 5: Risk Analysis — 파생 리스크 행(S/O/D 되쓰기) + 척도표 + AP 조합표
export default function RiskEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)
  const apEmpty = Object.keys(project.apTable).length === 0

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
        <h3 className="mb-1 text-sm font-medium text-gray-700">
          리스크 행 (FE × FM × FC) — S/O/D 셀은 참조 FE·FC에 저장됩니다
        </h3>
        <p className="mb-2 text-xs text-gray-400">{RPN_HINT}</p>
        {/* AP 모드인데 조합표가 비어 있으면 안내 */}
        {project.meta.riskMethod === 'AP' && apEmpty && (
          <p className="mb-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
            AP 조합표가 설정되지 않았습니다 — 척도표 화면에서 불러오거나 RPN 모드를 사용하세요.
          </p>
        )}
        {/* S/O/D · 예방/검출관리 도움말 범례 */}
        <div className="mb-3 space-y-1.5 rounded-md bg-gray-50 p-3">
          {RISK_HELP.map(([label, k]) => (
            <div key={k} className="flex items-start gap-2">
              <span className="w-20 shrink-0 text-xs font-semibold text-gray-600">{label}</span>
              <FieldHelp k={k} />
            </div>
          ))}
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">
            Step 4에서 각 FM에 FE와 FC를 모두 추가하면 행이 자동 생성됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500">
                <tr>
                  <Th>고장모드 FM</Th>
                  <Th>영향 FE</Th>
                  <Th>{SOD_LABELS.S}</Th>
                  <Th>원인 FC</Th>
                  <Th>예방관리</Th>
                  <Th>{SOD_LABELS.O}</Th>
                  <Th>검출관리</Th>
                  <Th>{SOD_LABELS.D}</Th>
                  <Th>
                    <span title={RPN_HINT}>RPN ⓘ</span>
                  </Th>
                  <Th>AP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const safety = isSafetyRow(r.s)
                  return (
                  <tr
                    key={`${r.fe.id}-${r.fm.id}-${r.fc.id}`}
                    className={`border-t border-gray-100 ${safety ? 'bg-rose-50' : ''}`}
                  >
                    <Td>
                      {safety && (
                        <span
                          title={`안전/법규 관련(S=${r.s}) — RPN과 무관하게 우선 검토`}
                          className="mr-1 inline-flex items-center rounded bg-rose-600 px-1 py-0.5 text-[10px] font-bold text-white"
                        >
                          ⚠ 안전
                        </span>
                      )}
                      {r.fm.text}
                    </Td>
                    <Td>{r.fe.text}</Td>
                    <Td>
                      <RatingSelect
                        value={r.s}
                        onChange={(v) => {
                          fmea.setEffectSeverity(r.fe.id, v)
                          if (v) showScaleToast('S', v)
                        }}
                      />
                    </Td>
                    <Td>{r.fc.text}</Td>
                    <Td>
                      {/* P-Diagram Control Factor에서 가져오기(pull) — 같은 노드 한정 */}
                      <PdImportSelect
                        label="◇ Control Factor에서 가져오기"
                        items={controlsForFm(project, r.fm.functionId)}
                        onPick={(it) =>
                          fmea.patchCause(r.fc.id, { prevention: it.text, preventionControlId: it.id })
                        }
                      />
                      <div className="mt-1 flex items-center gap-1">
                        {r.fc.preventionControlId && (
                          <span title="P-Diagram Control Factor에서 가져옴" className="shrink-0 text-xs text-amber-600">
                            ◇
                          </span>
                        )}
                        <CellInput
                          value={r.fc.prevention ?? ''}
                          onChange={(v) => fmea.patchCause(r.fc.id, { prevention: v })}
                          placeholder={helpFor('prevention').placeholder}
                        />
                      </div>
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
                      <CellInput
                        value={r.fc.detectionControl ?? ''}
                        onChange={(v) => fmea.patchCause(r.fc.id, { detectionControl: v })}
                        placeholder={helpFor('detectionControl').placeholder}
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
                      {r.rpn == null ? (
                        <span className="text-gray-300">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${BAND_STYLE[rpnBand(r.rpn)].cls}`}
                        >
                          {r.rpn} · {BAND_STYLE[rpnBand(r.rpn)].label}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {r.rpn == null ? (
                        <span className="text-gray-300">—</span>
                      ) : r.ap ? (
                        <span className="font-medium">{r.ap}</span>
                      ) : (
                        <span className="text-amber-600">미설정</span>
                      )}
                    </Td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {project.meta.riskMethod === 'AP' && !apEmpty && (
          <p className="mt-1 text-xs text-gray-400">
            AP가 “미설정”이면 아래 AP 조합표에 해당 (S,O,D) 항목이 없는 것입니다.
          </p>
        )}
      </section>

      {/* 척도표 편집 (현재 유형) */}
      <ScaleTableEditor fmea={fmea} type={project.meta.type} />

      {/* AP 조합표 편집 */}
      <ApTableEditor fmea={fmea} />

      {/* 등급 선택 설명 토스트(약 2초, 자동 사라짐) */}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg bg-gray-900/95 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
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

  function loadApPreset() {
    if (entries.length > 0 && !window.confirm('현재 AP 조합표를 사내 기본값으로 덮어씁니다. 계속할까요?'))
      return
    fmea.setApTable(companyApPreset())
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
        <button
          type="button"
          onClick={() => fmea.setApEntry(s, o, d, level)}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          항목 추가/수정
        </button>
      </div>

      {entries.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {entries
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([key, lv]) => (
              <li
                key={key}
                className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm"
              >
                <code>{key}</code> → {lv}
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
}: {
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      className="w-14 rounded-md border border-gray-300 px-1 py-1 text-sm"
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
      className="w-full min-w-28 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
    />
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1.5 text-left font-medium">{children}</th>
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 align-top">{children}</td>
}
