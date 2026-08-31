import { useState } from 'react'
import type { OptStatus } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { buildRiskRows, RATINGS, type RiskRow } from '../lib/risk'
import { nodeContextLabel } from '../lib/structure'
import { OPT_STATUS_LABELS, postAP, postRPN } from '../lib/optimization'
import { helpFor, type FieldKey } from '../lib/help'
import FieldHelp from './FieldHelp'

type Fmea = ReturnType<typeof useFmea>
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
    // 좁은 화면(<900px): 상하 배치(목록 위, 패널 아래). ≥900px: 좌=나머지폭, 우=최소폭 고정.
    // 우측 고정폭(400px)이 도움말/폼이 찌그러지지 않게 보장하고, 좌측이 남는 폭을 쓴다.
    <div className="flex max-w-6xl flex-col gap-4 min-[900px]:grid min-[900px]:grid-cols-[minmax(0,1fr)_400px] min-[900px]:items-start">
      {/* 좌: 리스크 행 목록 (min-w-0 로 truncate가 트랙을 밀지 않게) */}
      <div className="min-w-0 rounded-lg border border-gray-200 p-3">
        <h3 className="mb-2 text-sm font-medium text-gray-700">리스크 행 (개선 대상 선택)</h3>
        <ul className="space-y-0.5">
          {rows.map((r) => {
            const key = `${r.fe.id}-${r.fm.id}-${r.fc.id}`
            const optCount = project.optimizations.filter(
              (o) => o.failureCauseId === r.fc.id,
            ).length
            const nodeId = project.functions.find((f) => f.id === r.fm.functionId)?.structureNodeId
            const nodeLabel = nodeId ? nodeContextLabel(project.structure, nodeId, project.meta.type) : ''
            const active = key === rowKey
            const apCell = r.rpn == null ? '—' : (r.ap ?? '미설정')
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setRowKey(key)}
                  className={`flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left ${
                    active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  {/* 1줄: [소속] FM · RPN/AP · 조치 뱃지(우측) */}
                  <div className="flex w-full items-center gap-2 text-xs">
                    {nodeLabel && (
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[10px] ${
                          active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {nodeLabel}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate font-medium">{r.fm.text}</span>
                    <span className={`shrink-0 tabular-nums ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                      RPN {r.rpn ?? '—'} · AP {apCell}
                    </span>
                    {/* 3-state: 조치 있음(초록) / 조치 불필요(슬레이트) / 미검토(앰버) */}
                    {(() => {
                      const base = 'shrink-0 rounded-full px-1.5 py-0.5 text-xs'
                      if (optCount > 0)
                        return (
                          <span className={`${base} ${active ? 'bg-white/20 text-white' : 'bg-green-50 text-green-700'}`}>
                            조치 {optCount}
                          </span>
                        )
                      if (r.fc.noActionReason?.trim())
                        return (
                          <span className={`${base} ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`} title={r.fc.noActionReason}>
                            조치 불필요
                          </span>
                        )
                      return (
                        <span className={`${base} ${active ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'}`}>
                          미검토
                        </span>
                      )
                    })()}
                  </div>
                  {/* 2줄: FE → FC (작은 회색, 말줄임) */}
                  <div className={`w-full truncate text-[11px] ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                    {r.fe.text} → {r.fc.text}
                  </div>
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
    // @container: 아래 폼이 뷰포트가 아니라 이 패널 자체 폭에 반응(좁으면 1열)
    <div className="@container">
      {/* 전(현재) */}
      <div className="mb-3 rounded-md bg-gray-50 p-2 text-xs text-gray-600">
        <span className="font-medium text-gray-700">전(현재)</span> · FC: {row.fc.text} ·
        S {row.s ?? '—'} / O {row.o ?? '—'} / D {row.d ?? '—'} ·{' '}
        <span className="font-medium">RPN {row.rpn ?? '—'}</span> · AP{' '}
        {row.rpn == null ? '—' : (row.ap ?? '미설정')}
      </div>

      {/* 조치 불필요 판단(FC 단위). 조치 레코드와 별개 — 미검토(빈칸)와 구분. */}
      <NoActionSection fmea={fmea} fc={row.fc} hasOpts={opts.length > 0} />

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

      {/* 예방/검출 조치 · 조치후 S/O/D 도움말 범례 */}
      <div className="mb-3 space-y-1.5 rounded-md bg-gray-50 p-2">
        {(
          [
            ['예방조치', 'preventiveAction'],
            ['검출조치', 'detectiveAction'],
            ['조치후 S/O/D', 'postSOD'],
          ] as [string, FieldKey][]
        ).map(([label, k]) => (
          <div key={k} className="flex items-start gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold text-gray-600">{label}</span>
            <FieldHelp k={k} />
          </div>
        ))}
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
                <div className="grid grid-cols-1 gap-2 @[360px]:grid-cols-2">
                  <Field label="예방조치">
                    <TextInput
                      value={o.preventiveAction}
                      onChange={(v) => fmea.updateOptimization(o.id, { preventiveAction: v })}
                      placeholder={helpFor('preventiveAction').placeholder}
                    />
                  </Field>
                  <Field label="검출조치">
                    <TextInput
                      value={o.detectiveAction}
                      onChange={(v) => fmea.updateOptimization(o.id, { detectiveAction: v })}
                      placeholder={helpFor('detectiveAction').placeholder}
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

// "조치 불필요" 판단 섹션: 프리셋 드롭다운으로 사유를 채우고(선택 시에만) 자유 수정.
// 사유 없음 = 미검토(빈칸). 프리셋 목록은 프로젝트 저장 데이터(추가/삭제 가능).
function NoActionSection({ fmea, fc, hasOpts }: { fmea: Fmea; fc: RiskRow['fc']; hasOpts: boolean }) {
  const { project } = fmea
  const reason = fc.noActionReason?.trim() ?? ''
  const [newPreset, setNewPreset] = useState('')
  const set = (v: string | undefined) => fmea.patchCause(fc.id, { noActionReason: v })

  return (
    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">조치 불필요 판단</span>
        {reason && (
          <button type="button" onClick={() => set(undefined)} className="text-xs text-slate-500 hover:underline">
            판단 취소(미검토)
          </button>
        )}
      </div>
      {reason ? (
        <textarea
          value={fc.noActionReason ?? ''}
          onChange={(e) => set(e.target.value)}
          rows={2}
          className="w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500"
        />
      ) : (
        <p className="mb-1 text-xs text-slate-500">
          RPN·AP가 낮아 조치가 불필요하면 사유를 선택하세요. 선택 전에는 <b>미검토(빈칸)</b>로 남습니다.
        </p>
      )}
      {/* 프리셋 선택 시에만 채움(자동 아님) */}
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) set(e.target.value)
          e.currentTarget.value = ''
        }}
        className="mt-1 w-full rounded-md border border-dashed border-slate-400 bg-white px-2 py-1 text-xs text-slate-700 outline-none"
      >
        <option value="">{reason ? '다른 사유 프리셋으로 교체…' : '조치 불필요 — 사유 프리셋 선택…'}</option>
        {project.noActionPresets.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {hasOpts && reason && (
        <p className="mt-1 text-[11px] text-amber-600">※ 조치가 있어 Excel엔 조치 내용이 출력됩니다(불필요 사유는 화면 참고용).</p>
      )}
      <details className="mt-1.5">
        <summary className="cursor-pointer text-[11px] text-slate-500">사유 프리셋 관리</summary>
        <div className="mt-1 flex gap-1">
          <input
            value={newPreset}
            onChange={(e) => setNewPreset(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                fmea.addNoActionPreset(newPreset)
                setNewPreset('')
              }
            }}
            placeholder="사유 추가"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={() => {
              fmea.addNoActionPreset(newPreset)
              setNewPreset('')
            }}
            className="shrink-0 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
          >
            추가
          </button>
        </div>
        <ul className="mt-1 flex flex-wrap gap-1">
          {project.noActionPresets.map((p) => (
            <li
              key={p}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
            >
              <span className="max-w-40 truncate" title={p}>
                {p}
              </span>
              <button
                type="button"
                onClick={() => fmea.removeNoActionPreset(p)}
                aria-label={`${p} 삭제`}
                className="text-slate-400 hover:text-slate-700"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </details>
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

function TextInput({
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
