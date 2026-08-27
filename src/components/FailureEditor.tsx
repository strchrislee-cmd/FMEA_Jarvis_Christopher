import { useState } from 'react'
import type { useFmea } from '../state/useFmea'
import { flattenTree, levelLabel, nodeContextLabel } from '../lib/structure'
import { getPDiagram } from '../lib/pdiagram'
import { helpFor, type FieldKey } from '../lib/help'
import FieldHelp from './FieldHelp'
import PdImportSelect from './PdImportSelect'

type Fmea = ReturnType<typeof useFmea>

// 특정 기능(functionId)이 속한 구조 노드 id — P-Diagram 조회에 사용.
function nodeOfFunction(project: Fmea['project'], functionId: string | null | undefined) {
  const f = project.functions.find((x) => x.id === functionId)
  return f?.structureNodeId
}

// Step 4: Failure Analysis — 실패체인 FE ← FM ← FC
// 기능(부정 → FM) 목록 선택 → FM 추가/선택 → 선택 FM의 FE / FC 편집
export default function FailureEditor({ fmea }: { fmea: Fmea }) {
  const { project } = fmea
  const [functionId, setFunctionId] = useState<string | null>(null)
  const [modeId, setModeId] = useState<string | null>(null)

  const selectedMode = project.failureModes.find((m) => m.id === modeId) ?? null
  // FE/FC 열 헤더에 붙일 소속 표기: "노드 소속 · 선택 FM". 선택 FM이 있을 때만.
  const fmContext = selectedMode
    ? `${nodeContextLabel(project.structure, nodeOfFunction(project, selectedMode.functionId) ?? '', project.meta.type)} · ${truncate(selectedMode.text, 24)}`
    : undefined

  // 선택된 기능 바로 아래에 펼치는 FM 패널(입력 + Error State 가져오기 + FM 목록).
  const fmPanel = (fid: string) => {
    const modes = project.failureModes.filter((m) => m.functionId === fid)
    return (
      <div className="ml-2 mt-1 rounded-md border-l-2 border-blue-300 bg-blue-50/50 px-2 py-2">
        <ItemAdder placeholder={helpFor('fm').placeholder} onAdd={(t) => fmea.addFailureMode(fid, t)} />
        {/* P-Diagram Error State에서 가져오기(pull) — 같은 노드 한정 */}
        <div className="mt-1">
          <PdImportSelect
            label="◇ Error State에서 가져오기"
            items={getPDiagram(project, nodeOfFunction(project, fid) ?? '')?.errorStates ?? []}
            onPick={(it) => fmea.addFailureMode(fid, it.text, it.id)}
          />
        </div>
        <ul className="mt-2 space-y-1">
          {modes.map((m) => {
            const active = m.id === modeId
            return (
              <li key={m.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setModeId(m.id)}
                  className={`flex flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm ${
                    active ? 'bg-blue-600 text-white' : 'border border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  {m.errorStateId && (
                    <span
                      title="P-Diagram Error State에서 가져옴"
                      className={`shrink-0 text-xs ${active ? 'text-blue-100' : 'text-amber-600'}`}
                    >
                      ◇
                    </span>
                  )}
                  <span className="flex-1">{m.text}</span>
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
          {modes.length === 0 && <Empty text="고장모드가 없습니다." />}
        </ul>
      </div>
    )
  }

  if (project.functions.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Step 3에서 기능을 먼저 만드세요. 실패분석은 기능의 부정에서 출발합니다.
      </p>
    )
  }

  return (
    <div className="grid max-w-5xl grid-cols-3 gap-4">
      {/* 1열: 기능 → FM — 구조 노드별 그룹(트리 순서), 기능 있는 노드만 헤더 표시 */}
      <Column title="기능 → 고장모드(FM)" helpKey="fm">
        <div className="space-y-2">
          {flattenTree(project.structure).map((node) => {
            const funcs = project.functions.filter((f) => f.structureNodeId === node.id)
            if (funcs.length === 0) return null
            return (
              <div key={node.id}>
                {/* 그룹 헤더: 레벨 라벨 + 노드 소속(1 System=이름, 2+ =경로) */}
                <div className="flex items-baseline gap-1.5 px-1 pb-0.5 text-xs">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-500">
                    {levelLabel(project.meta.type, node.level)}
                  </span>
                  <span className="font-semibold text-gray-700">
                    {nodeContextLabel(project.structure, node.id, project.meta.type)}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {funcs.map((f) => {
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
                          <span className="flex-1">{f.text}</span>
                          {fmCount > 0 && (
                            <span
                              title={`고장모드 ${fmCount}개`}
                              className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                                active ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-600'
                              }`}
                            >
                              ×{fmCount}
                            </span>
                          )}
                        </button>
                        {/* 인라인 확장: 선택 기능 바로 아래에 FM 패널 */}
                        {active && fmPanel(f.id)}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {/* 방어: 트리에 없는 노드를 참조하는 기능도 숨기지 않는다 */}
          {(() => {
            const known = new Set(project.structure.map((n) => n.id))
            const orphans = project.functions.filter((f) => !known.has(f.structureNodeId))
            if (orphans.length === 0) return null
            return (
              <div>
                <div className="px-1 pb-0.5 text-xs font-semibold text-gray-400">(소속 없음)</div>
                <ul className="space-y-0.5">
                  {orphans.map((f) => {
                    const active = f.id === functionId
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setFunctionId(f.id)
                            setModeId(null)
                          }}
                          className={`flex w-full rounded-md px-2 py-1 text-left text-sm ${
                            active ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                          }`}
                        >
                          {f.text}
                        </button>
                        {active && fmPanel(f.id)}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })()}
        </div>
      </Column>

      {/* 2열: FE */}
      <Column title="영향 FE" hint="상위 레벨에 대한 영향" helpKey="fe" context={fmContext} sticky>
        {!selectedMode ? (
          <Empty text="왼쪽에서 고장모드(FM)를 선택하세요." />
        ) : (
          <>
            <ItemAdder
              placeholder={helpFor('fe').placeholder}
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
      <Column title="원인 FC" hint="하위 레벨 원인" helpKey="fc" context={fmContext} sticky>
        {!selectedMode ? (
          <Empty text="왼쪽에서 고장모드(FM)를 선택하세요." />
        ) : (
          <>
            <ItemAdder
              placeholder={helpFor('fc').placeholder}
              onAdd={(t) => fmea.addFailureCause(selectedMode.id, t)}
            />
            {/* P-Diagram Noise Factor에서 가져오기(pull) — 같은 노드 한정 */}
            <div className="mt-1">
              <PdImportSelect
                label="◇ Noise Factor에서 가져오기"
                items={getPDiagram(project, nodeOfFunction(project, selectedMode.functionId) ?? '')?.noises ?? []}
                onPick={(it) => fmea.addFailureCause(selectedMode.id, it.text, it.id)}
              />
            </div>
            <ChildList
              items={project.failureCauses.filter((c) => c.failureModeId === selectedMode.id)}
              onRemove={fmea.removeFailureCause}
              badgeOf={(c) => ((c as { noiseId?: string }).noiseId ? '◇' : null)}
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
  helpKey,
  context,
  sticky,
  children,
}: {
  title: string
  hint?: string
  helpKey?: FieldKey
  context?: string
  sticky?: boolean
  children: React.ReactNode
}) {
  // sticky: 좌측 아코디언이 길어져도 우측 FE/FC 열이 시야에 남게(self-start로 그리드 stretch 해제).
  // position:sticky는 애니메이션이 없어 prefers-reduced-motion과 무관하게 안전.
  return (
    <div className={`rounded-lg border border-gray-200 p-3 ${sticky ? 'self-start sticky top-2' : ''}`}>
      <h3 className="text-sm font-medium text-gray-700">
        {title}
        {hint && <span className="ml-1 text-xs font-normal text-gray-400">· {hint}</span>}
      </h3>
      {context && (
        <div className="mt-0.5 truncate text-xs text-blue-600" title={context}>
          ↳ {context}
        </div>
      )}
      {helpKey && (
        <div className="mt-1">
          <FieldHelp k={helpKey} />
        </div>
      )}
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

function ChildList<T extends { id: string; text: string }>({
  items,
  onRemove,
  badgeOf,
}: {
  items: T[]
  onRemove: (id: string) => void
  badgeOf?: (item: T) => string | null
}) {
  return (
    <ul className="mt-2 space-y-1">
      {items.map((it) => {
        const badge = badgeOf?.(it) ?? null
        return (
          <li
            key={it.id}
            className="flex items-start justify-between gap-2 rounded-md border border-gray-200 px-2 py-1.5 text-sm"
          >
            <span className="flex-1">
              {badge && (
                <span title="P-Diagram에서 가져옴" className="mr-1 text-xs text-amber-600">
                  {badge}
                </span>
              )}
              {it.text}
            </span>
            <DeleteBtn onClick={() => onRemove(it.id)} />
          </li>
        )
      })}
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

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}
