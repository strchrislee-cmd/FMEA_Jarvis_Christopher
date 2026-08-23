import { useState } from 'react'
import type { useFmea } from '../state/useFmea'

type Fmea = ReturnType<typeof useFmea>

// Step 1: Planning & Preparation — 범위/경계/가정/팀원 (최소 필드만)
export default function StepPlanning({ fmea }: { fmea: Fmea }) {
  const { project, updatePlanning, addTeamMember, removeTeamMember } = fmea
  const { planning } = project
  const [memberName, setMemberName] = useState('')

  function addMember() {
    const name = memberName.trim()
    if (!name) return
    addTeamMember(name)
    setMemberName('')
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Field label="범위 (Scope)">
        <textarea
          value={planning.scope}
          onChange={(e) => updatePlanning({ scope: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
          placeholder="이 FMEA가 다루는 분석 범위를 기술"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="In-scope (경계 내)">
          <textarea
            value={planning.inScope}
            onChange={(e) => updatePlanning({ inScope: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
            placeholder="포함되는 대상"
          />
        </Field>
        <Field label="Out-of-scope (경계 외)">
          <textarea
            value={planning.outOfScope}
            onChange={(e) => updatePlanning({ outOfScope: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
            placeholder="제외되는 대상"
          />
        </Field>
      </div>

      <Field label="가정 (Assumptions)">
        <textarea
          value={planning.assumptions}
          onChange={(e) => updatePlanning({ assumptions: e.target.value })}
          rows={3}
          className="w-full rounded-md border border-gray-300 p-2 text-sm outline-none focus:border-blue-500"
          placeholder="분석의 전제/가정"
        />
      </Field>

      <Field label="팀원 (Team)">
        <div className="flex gap-2">
          <input
            type="text"
            value={memberName}
            onChange={(e) => setMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
            placeholder="이름 입력 후 추가"
            className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={addMember}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            추가
          </button>
        </div>
        {planning.team.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {planning.team.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm"
              >
                {m.name}
                <button
                  type="button"
                  onClick={() => removeTeamMember(m.id)}
                  aria-label={`${m.name} 삭제`}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-300 hover:text-gray-700"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
