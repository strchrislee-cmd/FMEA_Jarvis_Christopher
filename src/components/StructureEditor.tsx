import type { StructureNode, FourM } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { childrenOf, deletionImpact, levelLabel } from '../lib/structure'

type Fmea = ReturnType<typeof useFmea>
const FOUR_M: FourM[] = ['Man', 'Machine', 'Material', 'Method']

// Step 2: Structure Analysis — 평면 배열 + parentId 트리 편집기 (3레벨 고정)
export default function StructureEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const roots = childrenOf(project.structure, null)

  return (
    <div className="max-w-3xl">
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
    </div>
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
          placeholder="이름"
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
