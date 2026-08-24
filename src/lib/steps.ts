import type { FmeaType, Planning } from '../types/fmea'

// AIAG-VDA 7단계 가이드 정의. example은 '예시 보기' 토글에서 보여줄 워크드 예시.
export interface StepGuide {
  id: number
  title: string
  description: string
  example: (type: FmeaType) => string
}

// Step 1 세트 예시: scope/in-scope/out-of-scope/가정 네 칸이 맞물린 완성 예시.
// 자동차 전장/LED 조명 계열(LED 헤드램프)로 통일. DFMEA=설계, PFMEA=조립 공정 관점.
export type Step1Example = Pick<
  Planning,
  'scope' | 'inScope' | 'outOfScope' | 'assumptions'
>

const STEP1_EXAMPLES: Record<FmeaType, Step1Example> = {
  DFMEA: {
    scope:
      'LED 헤드램프 제어 모듈(LDM) 설계 FMEA. 품번 A123-45(로우/하이빔 통합 구동), 적용 차종 X-SUV 2026 MY. 정전류 구동·조도 제어·고장진단 회로를 대상으로 한다.',
    inScope:
      'LED 드라이버 IC, 정전류 제어 회로, 방열(써멀) 설계, 커넥터·하네스 인터페이스, 오픈/쇼트 검출 진단 로직. (구조 트리에 들어갈 항목)',
    outOfScope:
      'LED 광원 모듈 자체(공급사 DVP로 검증됨), 차량 통신 버스(별도 네트워크 FMEA), 하우징 방수(기구 FMEA 담당). — 제외 이유: 각각 별도 검증 체계로 커버되어 중복 분석을 피하기 위함.',
    assumptions:
      '공급전압 12V±10%·동작온도 -40~85℃ 전제. LED Vf는 공급사 규격 준수로 가정. 이전 세대 B-Sedan LDM(품번 A100-10) 설계 자산을 참조. 방열판 사양은 아직 미확정(초기값)으로 두고 평가한다.',
  },
  PFMEA: {
    scope:
      'LED 헤드램프 모듈 조립 공정 FMEA. 라인 L-07, 완성품 품번 A123-45. PCB 실장 이후~렌즈 접합~기밀검사까지의 조립 공정을 대상으로 한다.',
    inScope:
      'PCB 스크루 체결, 커넥터 삽입, 방열 그리스 도포, 렌즈 접착·경화, 기밀(리크) 검사 공정. (공정 트리에 들어갈 항목)',
    outOfScope:
      'LED 기판 SMT 전공정(별도 PFMEA), 원자재 입고검사(수입검사 절차서로 관리), 포장·출하. — 제외 이유: 전공정·입고 단계는 별도 관리 체계가 있어 이 라인 범위에서 제외.',
    assumptions:
      '작업자는 표준작업 교육 이수로 가정. 접착제 경화온도 관리기준은 양산 검증 전이라 잠정값. 설비는 정기 예방보전(PM) 완료 상태를 전제. 이전 X-SUV 리어램프 라인(L-05) 공정 실적을 참조한다.',
  },
}

export function step1Example(type: FmeaType): Step1Example {
  return STEP1_EXAMPLES[type]
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
