import Stepper from './components/Stepper'
import Toolbar from './components/Toolbar'
import InputArea from './components/InputArea'
import GuidePanel from './components/GuidePanel'
import { useFmea } from './state/useFmea'

export default function App() {
  const { project, currentStep, updateMeta, goPrev, goNext, goTo, importProject } =
    useFmea()

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900">
      <Toolbar project={project} onMeta={updateMeta} onImport={importProject} />
      <div className="flex flex-1 overflow-hidden">
        <Stepper currentStep={currentStep} onSelect={goTo} />
        <InputArea currentStep={currentStep} onPrev={goPrev} onNext={goNext} />
        <GuidePanel currentStep={currentStep} fmeaType={project.meta.type} />
      </div>
    </div>
  )
}
