import { useState } from 'react'
import { EXAMPLE_THREAD_NOTE, STEPS, step1Example, type Step1Example } from '../lib/steps'
import type { useFmea } from '../state/useFmea'

type Fmea = ReturnType<typeof useFmea>

interface Props {
  fmea: Fmea
}

// 우측 가이드 패널: 단계 설명 + '예시 보기' 토글로 워크드 예시 표시
export default function GuidePanel({ fmea }: Props) {
  const [showExample, setShowExample] = useState(false)
  const { currentStep, project } = fmea
  const fmeaType = project.meta.type
  const step = STEPS[currentStep]
  const isStep1 = currentStep === 0

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-gray-50 p-5">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-600">
        Step {step.id}
      </div>
      <h3 className="mb-3 text-base font-semibold text-gray-900">{step.title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{step.description}</p>

      <button
        type="button"
        onClick={() => setShowExample((v) => !v)}
        className="mt-4 text-sm font-medium text-blue-600 hover:underline"
      >
        {showExample ? '예시 숨기기' : '예시 보기'}
      </button>

      {showExample && (
        <>
          {isStep1 ? (
            <Step1ExampleView fmea={fmea} type={fmeaType} />
          ) : (
            <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-relaxed text-gray-700">
              {step.example(fmeaType)}
            </div>
          )}
          {/* 예시가 Step 1~7을 관통하는 하나의 사례임을 표시 */}
          <p className="mt-2 text-[11px] leading-snug text-blue-500">{EXAMPLE_THREAD_NOTE}</p>
        </>
      )}
    </aside>
  )
}

// Step 1: scope/in-scope/out-of-scope/가정 4칸이 맞물린 세트 예시 + '예시 채우기'
function Step1ExampleView({ fmea, type }: { fmea: Fmea; type: 'DFMEA' | 'PFMEA' }) {
  const ex = step1Example(type)
  const rows: [string, keyof Step1Example][] = [
    ['범위 (Scope)', 'scope'],
    ['In-scope (경계 내)', 'inScope'],
    ['Out-of-scope (경계 외)', 'outOfScope'],
    ['가정 (Assumptions)', 'assumptions'],
  ]

  function fill() {
    const p = fmea.project.planning
    const hasData =
      p.scope.trim() || p.inScope.trim() || p.outOfScope.trim() || p.assumptions.trim()
    if (hasData && !window.confirm('기존 입력을 예시로 덮어씁니다. 계속할까요?')) return
    fmea.updatePlanning(ex)
  }

  return (
    <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3">
      <div className="mb-2 text-xs font-semibold text-blue-700">{type} 세트 예시</div>
      <dl className="space-y-2 text-sm leading-relaxed text-gray-700">
        {rows.map(([label, key]) => (
          <div key={key}>
            <dt className="text-xs font-semibold text-gray-500">{label}</dt>
            <dd className="mt-0.5">{ex[key]}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        onClick={fill}
        className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        예시 채우기
      </button>
    </div>
  )
}
