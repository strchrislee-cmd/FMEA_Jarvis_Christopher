import { useState } from 'react'
import type { OptStatus } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { buildRiskRows, type RiskRow } from '../lib/risk'
import { OPT_STATUS_LABELS, postAP, postRPN } from '../lib/optimization'

type Fmea = ReturnType<typeof useFmea>
const RATINGS = Array.from({ length: 10 }, (_, i) => i + 1)
const STATUSES: OptStatus[] = ['open', 'in_progress', 'done']

// Step 6: Optimization — 리스크 행에서 개선 필요 항목의 FC에 조치 추가 (전/후 나란히)
export default function OptimizationEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)
  const [rowKey, setRowKey] = useState<string | null>(null)
  const selected = rows.find((r) => `${r.fe.id}-${r.fm.id}-${r.fc.id}` === rowKey) ?? null

  if (rows.length === 0) {
    return <p className="text-sm text-gray-400">Step 4~5에서 리스크 행을 먼저 구성하세요.</p>
  }

  return (
    <div className="grid max-w-6xl grid-cols-[1fr_1.2fr] gap-4">
      {/* 좌: 리스크 행 목록 */}
      <div className="rounded-lg border border-gray-200 p-3">
        <h3 className="mb-2 text-sm font-medium text-gray-700">리스크 행 (개선 대상 선택)</h3>
        <ul className="space-y-0.5">
          {rows.map((r) => {
            const key = `${r.fe.id}-${r.fm.id}-${r.fc.id}`
            const optCount = project.optimizations.filter(
              (o) => o.failureCauseId === r.fc.id,
            ).length
            const active = key === rowKey
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setRowKey(key)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs ${
                    active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="flex-1 truncate">
                    {r.fm.text} · {r.fe.text} · {r.fc.text}
                  </span>
                  <span className={active ? 'text-blue-100' : 'text-gray-400'}>
                    RPN {r.rpn ?? '—'}
                  </span>
                  {optCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 ${
                        active ? 'bg-white/20 text-white' : 'bg-green-50 text-green-700'
                      }`}
                    >
                      조치 {optCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* 우: 선택 행의 FC 조치 편집 */}
      <div className="rounded-lg border border-gray-200 p-3">
        {!selected ? (
          <p className="text-sm text-gray-400">왼쪽에서 리스크 행을 선택하세요.</p>
        ) : (
          <OptPanel fmea={fmea} row={selected} />
        )}
      </div>
    </div>
  )
}

function OptPanel({ fmea, row }: { fmea: Fmea; row: RiskRow }) {
  const { project } = fmea
  const opts = project.optimizations.filter((o) => o.failureCauseId === row.fc.id)

  return (
    <div>
      {/* 전(현재) */}
      <div className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
        <span className="font-medium text-gray-700">전(현재)</span> · FC: {row.fc.text} ·
        S {row.s ?? '—'} / O {row.o ?? '—'} / D {row.d ?? '—'} ·{' '}
        <span className="font-medium">RPN {row.rpn ?? '—'}</span> · AP{' '}
        {row.rpn == null ? '—' : (row.ap ?? '미설정')}
      </div>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">조치 (원인 FC 단위)</h3>
        <button
          type="button"
          onClick={() => fmea.addOptimization(row.fc.id)}
          className="rounded-md bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
        >
          + 조치 추가
        </button>
      </div>

      {opts.length === 0 ? (
        <p className="text-sm text-gray-400">조치가 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {opts.map((o) => {
            const pRpn = postRPN(o)
            const pAp = postAP(o, project.apTable)
            return (
              <li key={o.id} className="rounded-md border border-gray-200 p-2">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="예방조치">
                    <TextInput
                      value={o.preventiveAction}
                      onChange={(v) => fmea.updateOptimization(o.id, { preventiveAction: v })}
                    />
                  </Field>
                  <Field label="검출조치">
                    <TextInput
                      value={o.detectiveAction}
                      onChange={(v) => fmea.updateOptimization(o.id, { detectiveAction: v })}
                    />
                  </Field>
                  <Field label="담당자">
                    <TextInput
                      value={o.responsibility}
                      onChange={(v) => fmea.updateOptimization(o.id, { responsibility: v })}
                    />
                  </Field>
                  <Field label="목표일">
                    <input
                      type="date"
                      value={o.targetDate}
                      onChange={(e) => fmea.updateOptimization(o.id, { targetDate: e.target.value })}
                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </Field>
                </div>

                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <Field label="상태">
                    <select
                      value={o.status}
                      onChange={(e) =>
                        fmea.updateOptimization(o.id, { status: e.target.value as OptStatus })
                      }
                      className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {OPT_STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Rating label="조치후 S" value={o.severity} onChange={(v) => fmea.updateOptimization(o.id, { severity: v })} />
                  <Rating label="조치후 O" value={o.occurrence} onChange={(v) => fmea.updateOptimization(o.id, { occurrence: v })} />
                  <Rating label="조치후 D" value={o.detection} onChange={(v) => fmea.updateOptimization(o.id, { detection: v })} />
                  <div className="ml-auto text-xs text-gray-600">
                    후 RPN <span className="font-medium">{pRpn ?? '—'}</span> · AP{' '}
                    {pRpn == null ? '—' : (pAp ?? '미설정')}
                  </div>
                </div>

                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    전 RPN {row.rpn ?? '—'} → 후 RPN {pRpn ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => fmea.removeOptimization(o.id)}
                    className="text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <div className="mt-0.5">{children}</div>
    </label>
  )
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
    />
  )
}

function Rating({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  return (
    <label className="text-xs text-gray-500">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        className="ml-1 w-14 rounded-md border border-gray-300 px-1 py-1 text-sm"
      >
        <option value="">—</option>
        {RATINGS.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </label>
  )
}
