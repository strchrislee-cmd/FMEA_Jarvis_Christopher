import { useState } from 'react'
import type { ApLevel, FmeaType } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { buildRiskRows } from '../lib/risk'
import { helpFor, type FieldKey } from '../lib/help'
import { dfmeaScalePreset, DFMEA_SCALE_NOTE } from '../lib/scalePreset'
import FieldHelp from './FieldHelp'

type Fmea = ReturnType<typeof useFmea>
const DIMS = ['S', 'O', 'D'] as const
const RATINGS = Array.from({ length: 10 }, (_, i) => i + 1)
const AP_LEVELS: ApLevel[] = ['H', 'M', 'L']
// 리스크 표 컬럼 도움말 범례 (라벨 → 필드키)
const RISK_HELP: [string, FieldKey][] = [
  ['S 심각도', 'severity'],
  ['O 발생도', 'occurrence'],
  ['D 검출도', 'detection'],
  ['예방관리', 'prevention'],
  ['검출관리', 'detectionControl'],
]

// Step 5: Risk Analysis — 파생 리스크 행(S/O/D 되쓰기) + 척도표 + AP 조합표
export default function RiskEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)

  return (
    <div className="max-w-6xl space-y-8">
      {/* 리스크 행 테이블 */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          리스크 행 (FE × FM × FC) — S/O/D 셀은 참조 FE·FC에 저장됩니다
        </h3>
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
                  <Th>S</Th>
                  <Th>원인 FC</Th>
                  <Th>예방관리</Th>
                  <Th>O</Th>
                  <Th>검출관리</Th>
                  <Th>D</Th>
                  <Th>RPN</Th>
                  <Th>AP</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.fe.id}-${r.fm.id}-${r.fc.id}`} className="border-t border-gray-100">
                    <Td>{r.fm.text}</Td>
                    <Td>{r.fe.text}</Td>
                    <Td>
                      <RatingSelect
                        value={r.s}
                        onChange={(v) => fmea.setEffectSeverity(r.fe.id, v)}
                      />
                    </Td>
                    <Td>{r.fc.text}</Td>
                    <Td>
                      <CellInput
                        value={r.fc.prevention ?? ''}
                        onChange={(v) => fmea.patchCause(r.fc.id, { prevention: v })}
                        placeholder={helpFor('prevention').placeholder}
                      />
                    </Td>
                    <Td>
                      <RatingSelect
                        value={r.o}
                        onChange={(v) => fmea.patchCause(r.fc.id, { occurrence: v })}
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
                        onChange={(v) => fmea.patchCause(r.fc.id, { detection: v })}
                      />
                    </Td>
                    <Td>
                      <span className="font-medium">{r.rpn ?? '—'}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
        {project.meta.riskMethod === 'AP' && (
          <p className="mt-1 text-xs text-gray-400">
            AP가 “미설정”이면 아래 AP 조합표에 해당 (S,O,D) 항목이 없는 것입니다.
          </p>
        )}
      </section>

      {/* 척도표 편집 (현재 유형) */}
      <ScaleTableEditor fmea={fmea} type={project.meta.type} />

      {/* AP 조합표 편집 */}
      <ApTableEditor fmea={fmea} />
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
              <Th>S 심각도</Th>
              <Th>O 발생도</Th>
              <Th>D 검출도</Th>
            </tr>
          </thead>
          <tbody>
            {RATINGS.map((rating, i) => (
              <tr key={rating} className="border-t border-gray-100">
                <Td>
                  <span className="font-medium text-gray-600">{rating}</span>
                </Td>
                {DIMS.map((dim) => (
                  <Td key={dim}>
                    <CellInput
                      value={table[dim][i] ?? ''}
                      onChange={(v) => fmea.setScale(type, dim, i, v)}
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

  return (
    <section>
      <h3 className="mb-1 text-sm font-medium text-gray-700">AP 조합표</h3>
      <p className="mb-2 text-xs text-gray-400">
        AP는 (S,O,D) 조합 룩업입니다(RPN 구간 아님). 룩업 키 포맷:{' '}
        <code className="rounded bg-gray-100 px-1">"s-o-d"</code> (예: S7·O3·D4 → "7-3-4").
        JSON 불러오기로 사내 AP표를 통째로 주입할 수 있습니다.
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
