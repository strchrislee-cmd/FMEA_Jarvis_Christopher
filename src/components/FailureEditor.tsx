import { useState } from 'react'
import type { useFmea } from '../state/useFmea'
import { levelLabel } from '../lib/structure'

type Fmea = ReturnType<typeof useFmea>

// Step 4: Failure Analysis — 실패체인 FE ← FM ← FC
// 기능(부정 → FM) 목록 선택 → FM 추가/선택 → 선택 FM의 FE / FC 편집
export default function FailureEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const [functionId, setFunctionId] = useState<string | null>(null)
  const [modeId, setModeId] = useState<string | null>(null)

  const modesOfFunction = project.failureModes.filter((m) => m.functionId === functionId)
  const selectedMode = project.failureModes.find((m) => m.id === modeId) ?? null

  if (project.functions.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Step 3에서 기능을 먼저 만드세요. 실패분석은 기능의 부정에서 출발합니다.
      </p>
    )
  }

  return (
    <div className="grid max-w-5xl grid-cols-3 gap-4">
      {/* 1열: 기능 → FM */}
      <Column title="기능 → 고장모드(FM)">
        <ul className="space-y-0.5">
          {project.functions.map((f) => {
            const node = project.structure.find((n) => n.id === f.structureNodeId)
            const fmCount = project.failureModes.filter((m) => m.functionId === f.id).length
            const active = f.id === functionId
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => {
                    setFunctionId(f.id)
                    setModeId(null)
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${
                    active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                  }`}
                >
                  <span className="flex-1">
                    {node && (
                      <span
                        className={`mr-1 text-xs ${active ? 'text-blue-100' : 'text-gray-400'}`}
                      >
                        [{node.name || levelLabel(project.meta.type, node.level)}]
                      </span>
                    )}
                    {f.text}
                  </span>
                  {fmCount > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        active ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      FM {fmCount}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        {functionId && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <ItemAdder
              placeholder="고장모드(FM) 추가"
              onAdd={(t) => fmea.addFailureMode(functionId, t)}
            />
            <ul className="mt-2 space-y-1">
              {modesOfFunction.map((m) => {
                const active = m.id === modeId
                return (
                  <li key={m.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setModeId(m.id)}
                      className={`flex-1 rounded-md px-2 py-1 text-left text-sm ${
                        active
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {m.text}
                    </button>
                    <DeleteBtn
                      onClick={() => {
                        fmea.removeFailureMode(m.id)
                        if (m.id === modeId) setModeId(null)
                      }}
                    />
                  </li>
                )
              })}
              {modesOfFunction.length === 0 && <Empty text="고장모드가 없습니다." />}
            </ul>
          </div>
        )}
      </Column>

      {/* 2열: FE */}
      <Column title="영향 FE" hint="상위 레벨에 대한 영향">
        {!selectedMode ? (
          <Empty text="왼쪽에서 고장모드(FM)를 선택하세요." />
        ) : (
          <>
            <ItemAdder
              placeholder="영향(FE) 추가"
              onAdd={(t) => fmea.addFailureEffect(selectedMode.id, t)}
            />
            <ChildList
              items={project.failureEffects.filter((e) => e.failureModeId === selectedMode.id)}
              onRemove={fmea.removeFailureEffect}
            />
          </>
        )}
      </Column>

      {/* 3열: FC */}
      <Column title="원인 FC" hint="하위 레벨 원인">
        {!selectedMode ? (
          <Empty text="왼쪽에서 고장모드(FM)를 선택하세요." />
        ) : (
          <>
            <ItemAdder
              placeholder="원인(FC) 추가"
              onAdd={(t) => fmea.addFailureCause(selectedMode.id, t)}
            />
            <ChildList
              items={project.failureCauses.filter((c) => c.failureModeId === selectedMode.id)}
              onRemove={fmea.removeFailureCause}
            />
          </>
        )}
      </Column>
    </div>
  )
}

function Column({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <h3 className="text-sm font-medium text-gray-700">
        {title}
        {hint && <span className="ml-1 text-xs font-normal text-gray-400">· {hint}</span>}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  )
}

function ItemAdder({
  placeholder,
  onAdd,
}: {
  placeholder: string
  onAdd: (text: string) => void
}) {
  const [text, setText] = useState('')
  function add() {
    const t = text.trim()
    if (!t) return
    onAdd(t)
    setText('')
  }
  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        placeholder={placeholder}
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
      />
      <button
        type="button"
        onClick={add}
        className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-sm font-medium text-white hover:bg-blue-700"
      >
        추가
      </button>
    </div>
  )
}

function ChildList({
  items,
  onRemove,
}: {
  items: { id: string; text: string }[]
  onRemove: (id: string) => void
}) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((it) => (
        <li
          key={it.id}
          className="flex items-start justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        >
          <span className="flex-1">{it.text}</span>
          <DeleteBtn onClick={() => onRemove(it.id)} />
        </li>
      ))}
      {items.length === 0 && <Empty text="항목이 없습니다." />}
    </ul>
  )
}

function DeleteBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded px-1 text-xs text-red-600 hover:underline"
    >
      삭제
    </button>
  )
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-400">{text}</p>
}
