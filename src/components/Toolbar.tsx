import { useRef } from 'react'
import type { FmeaProject, FmeaType } from '../types/fmea'

interface Props {
  project: FmeaProject
  onMeta: (patch: Partial<FmeaProject['meta']>) => void
  onImport: (next: FmeaProject) => void
}

// 상단 툴바: 제목/유형/방식 토글 + JSON 내보내기/불러오기
export default function Toolbar({ project, onMeta, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  function exportJson() {
    const blob = new Blob([JSON.stringify(project, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.meta.title || 'fmea-project'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onImport(JSON.parse(String(reader.result)) as FmeaProject)
      } catch {
        alert('JSON 파싱에 실패했습니다.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const types: FmeaType[] = ['DFMEA', 'PFMEA']

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-3">
      <input
        type="text"
        value={project.meta.title}
        onChange={(e) => onMeta({ title: e.target.value })}
        placeholder="프로젝트 제목"
        className="min-w-48 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
      />

      {/* 리스크 방식(RPN/AP) 토글은 제거 — 두 지표를 항상 함께 표시한다.
          riskMethod 필드는 모델에 유지(저장/JSON/Excel 참조 파급 방지). */}
      <ToggleGroup
        label="유형"
        options={types}
        value={project.meta.type}
        onChange={(v) => onMeta({ type: v })}
      />

      <div className="ml-auto flex gap-2">
        <button
          type="button"
          onClick={exportJson}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          JSON 내보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          JSON 불러오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          onChange={importJson}
          className="hidden"
        />
      </div>
    </header>
  )
}

function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-gray-300">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              value === opt
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
