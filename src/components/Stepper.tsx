import { STEPS } from '../lib/steps'

interface Props {
  currentStep: number
  onSelect: (step: number) => void
}

// 좌측 7단계 stepper: 현재 단계 표시 + 클릭 이동
export default function Stepper({ currentStep, onSelect }: Props) {
  return (
    <nav className="w-64 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-gray-500">
        AIAG-VDA 7 Steps
      </h2>
      <ol className="space-y-1">
        {STEPS.map((step, idx) => {
          const active = idx === currentStep
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(idx)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active ? 'bg-white text-blue-600' : 'bg-gray-300 text-gray-700'
                  }`}
                >
                  {step.id}
                </span>
                <span className="truncate">{step.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
