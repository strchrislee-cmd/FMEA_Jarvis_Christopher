import type { FmeaType } from '../types/fmea'

// AIAG-VDA 7단계 가이드 정의. example은 '예시 보기' 토글에서 보여줄 워크드 예시.
export interface StepGuide {
  id: number
  title: string
  description: string
  example: (type: FmeaType) => string
}

export const STEPS: StepGuide[] = [
  {
    id: 1,
    title: 'Planning & Preparation',
    description:
      '분석 대상과 범위를 정하고 FMEA 유형(DFMEA/PFMEA)과 리스크 산정 방식(RPN/AP)을 결정합니다. 상단 툴바에서 제목·유형·방식을 설정하세요.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 제목: "전동 윈도우 시스템 DFMEA", 유형: DFMEA, 방식: AP'
        : '예) 제목: "도어 조립 라인 PFMEA", 유형: PFMEA, 방식: AP',
  },
  {
    id: 2,
    title: 'Structure Analysis',
    description:
      'DFMEA는 System→Subsystem→Component, PFMEA는 Process→Step→Work Element(4M)로 대상을 트리로 분해합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 전동 윈도우(System) → 윈도우 레귤레이터(Subsystem) → 구동 모터(Component)'
        : '예) 도어 조립(Process) → 힌지 체결(Step) → 작업자/토크렌치/볼트/체결절차(4M)',
  },
  {
    id: 3,
    title: 'Function Analysis',
    description:
      '각 구조 요소가 수행해야 할 기능을 정의합니다. 실패 분석의 기준선이 되므로 측정 가능한 형태로 기술합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 구동 모터: "지정 토크로 유리창을 5초 내 완전 상승시킨다"'
        : '예) 힌지 체결: "볼트를 규정 토크 25±3N·m로 체결한다"',
  },
  {
    id: 4,
    title: 'Failure Analysis',
    description:
      '실패는 기능의 부정입니다. 실패체인 FE(영향) ← FM(고장모드) ← FC(원인)를 기능마다 도출합니다.',
    example: () =>
      '예) FE: "유리창 상승 불가로 방수 실패" ← FM: "모터 회전 정지" ← FC: "브러시 마모"',
  },
  {
    id: 5,
    title: 'Risk Analysis',
    description:
      '고장모드별 현재 예방/검출 관리를 적고 S/O/D(각 1~10)를 평가합니다. RPN(S×O×D)과 AP를 함께 산출합니다.',
    example: () =>
      '예) 예방: "브러시 내마모 재질", 검출: "EOL 회전시험" · S=7, O=3, D=4 → RPN=84',
  },
  {
    id: 6,
    title: 'Optimization',
    description:
      '리스크가 높은 항목에 권고 조치·책임자·목표일을 정하고, 조치 후 S/O/D를 재평가합니다.',
    example: () =>
      '예) 조치: "브러시리스 모터로 변경", 책임: 설계팀, 목표: 2026-Q3 · 조치 후 O=1',
  },
  {
    id: 7,
    title: 'Documentation',
    description:
      '분석 결과와 잔여 리스크, 후속 조치를 요약합니다. 이후 AIAG-VDA 표준 양식 Excel로 내보냅니다.',
    example: () =>
      '예) "주요 고장모드 3건 식별, 조치 후 최대 RPN 84→24로 저감. 잔여 조치 1건 추적."',
  },
]
