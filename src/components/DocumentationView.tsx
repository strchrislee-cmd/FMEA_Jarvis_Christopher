import type { useFmea } from '../state/useFmea'
import { buildRiskRows } from '../lib/risk'
import { exportExcel } from '../lib/excel'
import { runChecks, type CheckResult, type CheckSeverity } from '../lib/checks'
import { APP_NAME, DEVELOPER } from '../lib/app'

type Fmea = ReturnType<typeof useFmea>

const SEV_STYLE: Record<CheckSeverity, string> = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-600',
}
const SEV_LABEL: Record<CheckSeverity, string> = { high: '높음', medium: '중간', low: '낮음' }

// Step 7: Documentation — 새 편집 화면 없음. 전체 요약 + Excel 내보내기.
export default function DocumentationView({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const rows = buildRiskRows(project)
  // 품질 점검(파생, 저장 안 함). 기준선은 project.checks에서.
  const findings = runChecks(project, project.checks)
  const totalViolations = findings.reduce((n, f) => n + f.items.length, 0)

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

      {/* 품질 점검 — 순수 계산, 조치 관련 3개 항목만. "전부 통과 = 문제 없음" 오해 방지 문구 포함. */}
      <section>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-gray-700">품질 점검</h3>
          <label className="flex items-center gap-1 text-xs text-gray-500">
            RPN 조치 기준선
            <input
              type="number"
              min={1}
              value={project.checks.rpnActionBaseline}
              onChange={(e) => fmea.setRpnBaseline(Number(e.target.value))}
              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>
        <p className="mb-3 text-xs text-gray-400">
          조치 관련 3개 항목만 자동 점검합니다 — 통과해도 FMEA 전체 품질을 보증하지는 않습니다.
        </p>
        <div className="space-y-2">
          {findings.map((f) => (
            <CheckCard key={f.ruleId} finding={f} onJump={(step) => fmea.goTo(step)} />
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {totalViolations === 0
            ? '점검한 3개 항목에서 위반 없음.'
            : `점검 위반 합계 ${totalViolations}건.`}
        </p>
      </section>

      {/* 개발자 정보(비침습) — 작업 화면을 방해하지 않게 Step 7 하단에만 작게. */}
      <footer className="border-t border-gray-100 pt-3 text-xs text-gray-400">
        {APP_NAME} · 개발: {DEVELOPER}
      </footer>
    </div>
  )
}

function CheckCard({ finding, onJump }: { finding: CheckResult; onJump: (step: number) => void }) {
  const pass = finding.items.length === 0
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${SEV_STYLE[finding.severity]}`}>
          {SEV_LABEL[finding.severity]}
        </span>
        <span className="flex-1 text-sm font-medium text-gray-700">{finding.title}</span>
        {pass ? (
          <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">통과</span>
        ) : (
          <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600">
            {finding.items.length}건
          </span>
        )}
      </div>
      {!pass && (
        <ul className="mt-2 space-y-1">
          {finding.items.map((it) => (
            <li
              key={`${finding.ruleId}-${it.target.id}`}
              className="flex items-start justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5 text-xs"
            >
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-gray-700">{it.label}</span>
                <span className="text-gray-500">{it.note}</span>
              </span>
              <button
                type="button"
                onClick={() => onJump(it.target.step)}
                className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-gray-600 hover:bg-gray-100"
              >
                Step 5로
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
