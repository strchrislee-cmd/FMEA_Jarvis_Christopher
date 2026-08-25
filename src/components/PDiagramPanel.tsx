import type { NoiseCategory, PdItem } from '../types/fmea'
import type { useFmea } from '../state/useFmea'
import { levelLabel } from '../lib/structure'
import { getPDiagram, NOISE_CATEGORIES, PD_FIELDS } from '../lib/pdiagram'

type Fmea = ReturnType<typeof useFmea>

// Step 2 다이어그램: 선택한 블록(Subsystem·Component)의 P-Diagram을 편집하는 사이드 패널.
// 정식 5방향(입력신호/제어인자/이상출력/오류상태 + 잡음인자 5분류)을 입력·저장·표시한다.
// (그래픽 박스+화살표 렌더는 후속. 여기 목적은 데이터 입력.)
export default function PDiagramPanel({
  fmea,
  nodeId,
  onClose,
}: {
  fmea: Fmea
  nodeId: string
  onClose: () => void
}) {
  const { project } = fmea
  const node = project.structure.find((n) => n.id === nodeId)
  if (!node) return null
  const pd = getPDiagram(project, nodeId)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="flex items-start justify-between border-b border-gray-100 px-3 py-2">
        <div className="min-w-0">
          <div className="text-xs font-medium text-gray-400">
            P-Diagram · {levelLabel(project.meta.type, node.level)}
          </div>
          <div className="truncate text-sm font-semibold text-gray-800">
            {node.name || '(이름 없음)'}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          닫기
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {PD_FIELDS.map((f) => (
          <ListSection
            key={f.key}
            label={f.label}
            hint={f.hint}
            items={(pd?.[f.key] ?? []) as PdItem[]}
            onAdd={() => fmea.addPdItem(nodeId, f.key)}
            onChange={(id, text) => fmea.updatePdItem(nodeId, f.key, id, text)}
            onRemove={(id) => fmea.removePdItem(nodeId, f.key, id)}
          />
        ))}

        {/* 잡음 인자 — 5분류 서브섹션 */}
        <div>
          <div className="mb-1 text-xs font-semibold text-gray-700">잡음 인자</div>
          <div className="mb-2 text-[11px] leading-tight text-gray-400">
            Noise Factor — 제어 불가한 편차 요인(5분류)
          </div>
          <div className="space-y-3">
            {NOISE_CATEGORIES.map((c) => (
              <NoiseSection
                key={c.key}
                label={c.label}
                items={(pd?.noises ?? []).filter((n) => n.category === c.key)}
                onAdd={() => fmea.addNoiseItem(nodeId, c.key as NoiseCategory)}
                onChange={(id, text) => fmea.updatePdItem(nodeId, 'noises', id, text)}
                onRemove={(id) => fmea.removePdItem(nodeId, 'noises', id)}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

function ItemRow({
  item,
  onChange,
  onRemove,
}: {
  item: PdItem
  onChange: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={item.text}
        autoFocus={item.text === ''}
        onChange={(e) => onChange(item.id, e.target.value)}
        className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm outline-none focus:border-blue-500"
      />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="shrink-0 rounded border border-gray-200 px-1.5 py-1 text-xs text-red-500 hover:bg-red-50"
        aria-label="삭제"
      >
        ×
      </button>
    </div>
  )
}

function ListSection({
  label,
  hint,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string
  hint: string
  items: PdItem[]
  onAdd: () => void
  onChange: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-700">{label}</div>
      <div className="mb-1.5 text-[11px] leading-tight text-gray-400">{hint}</div>
      <div className="space-y-1">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} onChange={onChange} onRemove={onRemove} />
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50"
      >
        + 추가
      </button>
    </div>
  )
}

function NoiseSection({
  label,
  items,
  onAdd,
  onChange,
  onRemove,
}: {
  label: string
  items: PdItem[]
  onAdd: () => void
  onChange: (id: string, text: string) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="rounded-md bg-gray-50 px-2 py-1.5">
      <div className="mb-1 text-[11px] font-medium text-gray-500">{label}</div>
      <div className="space-y-1">
        {items.map((it) => (
          <ItemRow key={it.id} item={it} onChange={onChange} onRemove={onRemove} />
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="mt-1 rounded border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-500 hover:bg-white"
      >
        + 추가
      </button>
    </div>
  )
}
