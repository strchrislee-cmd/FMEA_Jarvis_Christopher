import { useEffect, useRef, useState } from 'react'
import type { FmeaType } from '../types/fmea'
import { helpFor, type FieldKey } from '../lib/help'

// 3단 도움말 중 (1) 항상 보이는 한 줄 + (3) ? 클릭 팝오버 담당.
// (2) placeholder는 각 폼에서 helpFor(key,type).placeholder로 입력창에 직접 적용.
export default function FieldHelp({ k, type }: { k: FieldKey; type?: FmeaType }) {
  const help = helpFor(k, type)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const { detail } = help

  return (
    <span ref={ref} className="relative inline-flex items-start gap-1 align-top text-xs text-gray-500">
      <span>{help.oneLiner}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="자세한 도움말"
        aria-expanded={open}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-300 text-[10px] font-bold text-gray-500 hover:bg-gray-100"
      >
        ?
      </button>
      {open && (
        <div
          role="dialog"
          className="absolute left-0 top-6 z-30 w-80 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg"
        >
          <p className="text-sm text-gray-700">{detail.description}</p>
          <div className="mt-2">
            <p className="text-xs font-semibold text-green-700">좋은 예</p>
            <ul className="mt-0.5 list-disc pl-4 text-xs text-gray-600">
              {detail.good.map((g, i) => (
                <li key={i}>{g}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold text-red-600">나쁜 예</p>
            <ul className="mt-0.5 list-disc pl-4 text-xs text-gray-600">
              {detail.bad.map((bd, i) => (
                <li key={i}>{bd}</li>
              ))}
            </ul>
          </div>
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-500">흔한 실수</p>
            <ul className="mt-0.5 list-disc pl-4 text-xs text-gray-600">
              {detail.mistakes.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </span>
  )
}
