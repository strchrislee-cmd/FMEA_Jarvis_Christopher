import type { useFmea } from '../state/useFmea'
import { buildRiskRows } from '../lib/risk'
import { exportExcel } from '../lib/excel'

type Fmea = ReturnType<typeof useFmea>

// Step 7: Documentation — 새 편집 화면 없음. 전체 요약 + Excel 내보내기.
export default function DocumentationView({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)

  // 완성 행(RPN 산출 가능)만 대상으로 AP 분포 / RPN 상위
  const complete = rows.filter((r) => r.rpn != null)
  const apDist = { H: 0, M: 0, L: 0, 미설정: 0 }
  for (const r of complete) {
    if (r.ap === 'H' || r.ap === 'M' || r.ap === 'L') apDist[r.ap]++
    else apDist['미설정']++
  }
  const topRpn = [...complete].sort((a, b) => (b.rpn ?? 0) - (a.rpn ?? 0)).slice(0, 5)

  const stats = [
    ['구조 노드', project.structure.length],
    ['기능', project.functions.length],
    ['고장모드 FM', project.failureModes.length],
    ['영향 FE', project.failureEffects.length],
    ['원인 FC', project.failureCauses.length],
    ['리스크 행', rows.length],
    ['조치', project.optimizations.length],
  ] as const

  return (
    <div className="max-w-3xl space-y-6">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">전체 요약</h3>
          <button
            type="button"
            onClick={() => exportExcel(project)}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Excel 내보내기 (.xlsx)
          </button>
        </div>
        <dl className="mt-3 grid grid-cols-4 gap-3">
          {stats.map(([label, n]) => (
            <div key={label} className="rounded-lg border border-gray-200 p-3">
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          AP 분포 <span className="text-xs font-normal text-gray-400">(RPN 산출된 행 기준)</span>
        </h3>
        <div className="flex gap-3">
          {(['H', 'M', 'L', '미설정'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-gray-200 px-4 py-2 text-center">
              <div className="text-xs text-gray-500">{k}</div>
              <div className="text-lg font-semibold">{apDist[k]}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-medium text-gray-700">RPN 상위 항목</h3>
        {topRpn.length === 0 ? (
          <p className="text-sm text-gray-400">RPN이 산출된 행이 없습니다.</p>
        ) : (
          <ol className="space-y-1">
            {topRpn.map((r) => (
              <li
                key={`${r.fe.id}-${r.fm.id}-${r.fc.id}`}
                className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-1.5 text-sm"
              >
                <span className="truncate">
                  {r.fm.text} · {r.fe.text} · {r.fc.text}
                </span>
                <span className="ml-2 shrink-0 font-medium">
                  RPN {r.rpn} · AP {r.ap ?? '미설정'}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
