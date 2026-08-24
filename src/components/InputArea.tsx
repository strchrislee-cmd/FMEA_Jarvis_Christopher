import { STEPS } from '../lib/steps'
import type { useFmea } from '../state/useFmea'
import StepPlanning from './StepPlanning'
import StructureEditor from './StructureEditor'
import FunctionEditor from './FunctionEditor'
import FailureEditor from './FailureEditor'
import RiskEditor from './RiskEditor'
import OptimizationEditor from './OptimizationEditor'
import DocumentationView from './DocumentationView'

type Fmea = ReturnType<typeof useFmea>
export type StructureTab = 'tree' | 'diagram'

// 중앙 입력 영역: 단계별 편집기 라우팅.
export default function InputArea({
  fmea,
  structureTab,
  setStructureTab,
}: {
  fmea: Fmea
  structureTab: StructureTab
  setStructureTab: (t: StructureTab) => void
}) {
  const { currentStep, goPrev, goNext } = fmea
  const step = STEPS[currentStep]
  const isFirst = currentStep === 0
  const isLast = currentStep === STEPS.length - 1

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          {step.id}. {step.title}
        </h2>
        {currentStep === 0 ? (
          <StepPlanning fmea={fmea} />
        ) : currentStep === 1 ? (
          <StructureEditor fmea={fmea} tab={structureTab} setTab={setStructureTab} />
        ) : currentStep === 2 ? (
          <FunctionEditor fmea={fmea} />
        ) : currentStep === 3 ? (
          <FailureEditor fmea={fmea} />
        ) : currentStep === 4 ? (
          <RiskEditor fmea={fmea} />
        ) : currentStep === 5 ? (
          <OptimizationEditor fmea={fmea} />
        ) : (
          <DocumentationView fmea={fmea} />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← 이전
        </button>
        <span className="text-sm text-gray-500">
          {currentStep + 1} / {STEPS.length}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={isLast}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 →
        </button>
      </div>
    </main>
  )
}
