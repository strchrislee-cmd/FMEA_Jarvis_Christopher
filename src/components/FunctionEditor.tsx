import { useState } from 'react'
import type { StructureNode } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { childrenOf, levelLabel } from '../lib/structure'
import { helpFor } from '../lib/help'
import FieldHelp from './FieldHelp'

type Fmea = ReturnType<typeof useFmea>

// Step 3: Function Analysis — 구조 노드를 선택하면 그 노드에 기능을 추가/삭제
export default function FunctionEditor({ fmea }: { fmea: Fmea }) {
  const { project, addFunction, removeFunction } = fmea
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [text, setText] = useState('')

  const roots = childrenOf(project.structure, null)
  const selected = project.structure.find((n) => n.id === selectedId) ?? null
  const funcs = project.functions.filter((f) => f.structureNodeId === selectedId)

  function add() {
    const t = text.trim()
    if (!t || !selectedId) return
    addFunction(selectedId, t)
    setText('')
  }

  return (
    <div className="grid max-w-4xl grid-cols-2 gap-6">
      {/* 좌: 구조 트리(선택) */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">구조 선택</h3>
        {roots.length === 0 ? (
          <p className="text-sm text-gray-400">Step 2에서 구조를 먼저 만드세요.</p>
        ) : (
          <ul className="space-y-0.5">
            {roots.map((n) => (
              <SelectableNode
                key={n.id}
                node={n}
                fmea={fmea}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            ))}
          </ul>
        )}
      </div>

      {/* 우: 선택 노드의 기능 목록 */}
      <div>
        <h3 className="mb-2 text-sm font-medium text-gray-700">
          기능 / 요구사항
          {selected && (
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({levelLabel(project.meta.type, selected.level)}:{' '}
              {selected.name || '이름 없음'})
            </span>
          )}
        </h3>
        <div className="mb-2">
          <FieldHelp k="function" type={project.meta.type} />
        </div>
        {!selected ? (
          <p className="text-sm text-gray-400">왼쪽에서 구조 노드를 선택하세요.</p>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder={helpFor('function', project.meta.type).placeholder}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="button"
                onClick={add}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                추가
              </button>
            </div>
            <ul className="mt-3 space-y-1">
              {funcs.map((f) => (
                <li
                  key={f.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <span className="flex-1">{f.text}</span>
                  <button
                    type="button"
                    onClick={() => removeFunction(f.id)}
                    className="shrink-0 text-xs text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </li>
              ))}
              {funcs.length === 0 && (
                <li className="text-sm text-gray-400">연결된 기능이 없습니다.</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function SelectableNode({
  node,
  fmea,
  selectedId,
  onSelect,
}: {
  node: StructureNode
  fmea: Fmea
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const { project } = fmea
  const children = childrenOf(project.structure, node.id)
  const funcCount = project.functions.filter((f) => f.structureNodeId === node.id).length
  const active = node.id === selectedId

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm ${
          active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
        }`}
      >
        <span className={`text-xs ${active ? 'text-blue-100' : 'text-gray-400'}`}>
          {levelLabel(project.meta.type, node.level)}
        </span>
        <span className="flex-1 truncate">{node.name || '이름 없음'}</span>
        {funcCount > 0 && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              active ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'
            }`}
          >
            fn {funcCount}
          </span>
        )}
      </button>
      {children.length > 0 && (
        <ul className="ml-4 space-y-0.5 border-l border-gray-100 pl-2">
          {children.map((c) => (
            <SelectableNode
              key={c.id}
              node={c}
              fmea={fmea}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
