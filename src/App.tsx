import { useState } from 'react'
import Stepper from './components/Stepper'
import Toolbar from './components/Toolbar'
import InputArea, { type StructureTab } from './components/InputArea'
import GuidePanel from './components/GuidePanel'
import { useFmea } from './state/useFmea'

export default function App() {
  const fmea = useFmea()
  const { project, currentStep, updateMeta, goTo, importProject } = fmea
  // Step 2 트리/다이어그램 탭을 올려 관리 — 다이어그램 모드에선 가이드 패널을 숨겨 폭 확보
  const [structureTab, setStructureTab] = useState<StructureTab>('tree')
  const hideGuide = currentStep === 1 && structureTab === 'diagram'

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900">
      <Toolbar project={project} onMeta={updateMeta} onImport={importProject} />
      <div className="flex flex-1 overflow-hidden">
        <Stepper currentStep={currentStep} onSelect={goTo} />
        <InputArea fmea={fmea} structureTab={structureTab} setStructureTab={setStructureTab} />
        {!hideGuide && <GuidePanel fmea={fmea} />}
      </div>
    </div>
  )
}
