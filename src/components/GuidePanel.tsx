import { useState } from 'react'
import { STEPS } from '../lib/steps'
import type { FmeaType } from '../types/fmea'

interface Props {
  currentStep: number
  fmeaType: FmeaType
}

// 우측 가이드 패널: 단계 설명 + '예시 보기' 토글로 워크드 예시 표시
export default function GuidePanel({ currentStep, fmeaType }: Props) {
  const [showExample, setShowExample] = useState(false)
  const step = STEPS[currentStep]

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
        <div className="mt-3 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm leading-relaxed text-gray-700">
          {step.example(fmeaType)}
        </div>
      )}
    </aside>
  )
}
