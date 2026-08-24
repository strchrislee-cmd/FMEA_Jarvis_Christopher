import { useState } from 'react'
import type { StructureNode, FourM } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { childrenOf, deletionImpact, levelLabel } from '../lib/structure'
import { helpFor, type FieldKey } from '../lib/help'
import FieldHelp from './FieldHelp'
import StructureDiagram from './StructureDiagram'

type Fmea = ReturnType<typeof useFmea>
type Tab = 'tree' | 'diagram'
const FOUR_M: FourM[] = ['Man', 'Machine', 'Material', 'Method']
const LEVEL_KEYS: FieldKey[] = ['structL0', 'structL1', 'structL2']

// Step 2: Structure Analysis — 트리 편집 / 다이어그램 탭 전환 (다이어그램은 트리에서 자동 생성)
export default function StructureEditor({ fmea }: { fmea: Fmea }) {
  const [tab, setTab] = useState<Tab>('tree')

  return (
    <div className="max-w-3xl">
      {/* 탭 전환 */}
      <div className="mb-4 inline-flex overflow-hidden rounded-md border border-gray-300">
        {(['tree', 'diagram'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t === 'tree' ? '트리 편집' : '다이어그램'}
          </button>
        ))}
      </div>

      {tab === 'diagram' ? (
        <StructureDiagram fmea={fmea} />
      ) : (
        <TreeTab fmea={fmea} />
      )}
    </div>
  )
}

function TreeTab({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const roots = childrenOf(project.structure, null)
  const type = project.meta.type

  return (
    <>
      {/* 3레벨 + 4M 도움말 범례 (유형별로 라벨·내용이 바뀜) */}
      <div className="mb-4 space-y-1.5 rounded-md bg-gray-50 p-3">
        {LEVEL_KEYS.map((k, lv) => (
          <div key={k} className="flex items-start gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold text-gray-600">
              {levelLabel(type, lv)}
            </span>
            <FieldHelp k={k} type={type} />
          </div>
        ))}
        {type === 'PFMEA' && (
          <div className="flex items-start gap-2">
            <span className="w-24 shrink-0 text-xs font-semibold text-gray-600">4M</span>
            <FieldHelp k="fourM" type={type} />
          </div>
        )}
      </div>

      {roots.length === 0 ? (
        <p className="mb-4 text-sm text-gray-400">
          아직 구조가 없습니다. 최상위 {levelLabel(project.meta.type, 0)}부터 추가하세요.
        </p>
      ) : (
        <ul className="space-y-1">
          {roots.map((n) => (
            <TreeNode key={n.id} node={n} fmea={fmea} />
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => fmea.addNode(null)}
        className="mt-4 rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        + {levelLabel(project.meta.type, 0)} 추가
      </button>
    </>
  )
}

function TreeNode({ node, fmea }: { node: StructureNode; fmea: Fmea }) {
  const { project, addNode, renameNode, removeNode, setNodeCategory } = fmea
  const children = childrenOf(project.structure, node.id)
  const funcCount = project.functions.filter((f) => f.structureNodeId === node.id).length
  const isPfmeaWorkElement = project.meta.type === 'PFMEA' && node.level === 2
  const canAddChild = node.level < 2

  function handleDelete() {
    const { nodes, functions } = deletionImpact(project, node.id)
    if (nodes > 0 || functions > 0) {
      const ok = window.confirm(
        `이 노드를 삭제하면 하위 노드 ${nodes}개, 연결된 기능 ${functions}개가 함께 삭제됩니다. 계속할까요?`,
      )
      if (!ok) return
    }
    removeNode(node.id)
  }

  return (
    <li>
      <div className="flex items-center gap-2 py-0.5">
        <span className="w-24 shrink-0 text-xs font-medium text-gray-400">
          {levelLabel(project.meta.type, node.level)}
        </span>
        <input
          type="text"
          value={node.name}
          onChange={(e) => renameNode(node.id, e.target.value)}
          placeholder={
            helpFor(LEVEL_KEYS[node.level] ?? 'structL0', project.meta.type).placeholder
          }
          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
        />
        {isPfmeaWorkElement && (
          <select
            value={node.category ?? ''}
            onChange={(e) =>
              setNodeCategory(node.id, (e.target.value || undefined) as FourM | undefined)
            }
            className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-700 outline-none focus:border-blue-500"
          >
            <option value="">4M…</option>
            {FOUR_M.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {funcCount > 0 && (
          <span
            title="연결된 기능 수"
            className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600"
          >
            fn {funcCount}
          </span>
        )}
        {canAddChild && (
          <button
            type="button"
            onClick={() => addNode(node.id)}
            className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
          >
            + 자식
          </button>
        )}
        <button
          type="button"
          onClick={() => addNode(node.parentId)}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
        >
          + 형제
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
        >
          삭제
        </button>
      </div>
      {children.length > 0 && (
        <ul className="ml-6 space-y-1 border-l border-gray-100 pl-2">
          {children.map((c) => (
            <TreeNode key={c.id} node={c} fmea={fmea} />
          ))}
        </ul>
      )}
    </li>
  )
}
