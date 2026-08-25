import type { PdItem } from '../types/fmea'

// P-Diagram 항목을 골라 FMEA 항목으로 "가져오기"(pull)하는 셀렉트.
// 고르면 onPick(항목) 호출 후 셀렉트는 다시 안내 문구로 초기화. 항목 없으면 렌더 안 함.
export default function PdImportSelect({
  label,
  items,
  onPick,
}: {
  label: string
  items: PdItem[]
  onPick: (item: PdItem) => void
}) {
  if (items.length === 0) return null
  return (
    <select
      value=""
      onChange={(e) => {
        const it = items.find((i) => i.id === e.target.value)
        if (it) onPick(it)
        e.currentTarget.value = ''
      }}
      className="min-w-0 max-w-full rounded-md border border-dashed border-blue-300 bg-blue-50/40 px-2 py-1 text-xs text-blue-700 outline-none focus:border-blue-500"
      title="P-Diagram에서 가져오기"
    >
      <option value="">{label}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id}>
          {i.text || '(빈 항목)'}
        </option>
      ))}
    </select>
  )
}
