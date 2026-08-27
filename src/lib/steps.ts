import type { FmeaType, Planning } from '../types/fmea'

// AIAG-VDA 7단계 가이드 정의. example은 '예시 보기' 토글에서 보여줄 워크드 예시.
export interface StepGuide {
  id: number
  title: string
  description: string
  example: (type: FmeaType) => string
}

// 예시 정책: DFMEA/PFMEA 각각 "하나의 관통 사례"를 Step 1~7 전체에 이어서 쓴다.
//   DFMEA = 전동 윈도우 시스템 → 윈도우 레귤레이터 → 구동 모터 → (브러시 마모)
//   PFMEA = 전동 윈도우 도어 조립 라인 → 레귤레이터 체결 → (토크 미달)
// 모든 예시 텍스트는 이 파일 한 곳에서 관리한다(컴포넌트에 흩뿌리지 않음). 핸드북 복붙 금지, 자체 작성.
export const EXAMPLE_THREAD_NOTE =
  '↕ 이 예시는 Step 1~7을 관통하는 하나의 사례입니다(같은 제품·같은 항목).'

// Step 1 세트 예시: scope/in-scope/out-of-scope/가정 네 칸이 맞물린 완성 예시.
export type Step1Example = Pick<
  Planning,
  'scope' | 'inScope' | 'outOfScope' | 'assumptions'
>

const STEP1_EXAMPLES: Record<FmeaType, Step1Example> = {
  DFMEA: {
    scope:
      '전동 윈도우 시스템(Power Window) 설계 FMEA. 품번 PW-220(운전석 도어), 적용 차종 X-SUV 2026 MY. 유리창 승·하강 구동과 끼임 방지 제어를 대상으로 한다.',
    inScope:
      '윈도우 레귤레이터, 구동 모터(브러시 DC), 모터 제어 ECU, 승하강 스위치, 커넥터·하네스. (구조 트리에 들어갈 항목)',
    outOfScope:
      '도어 글라스·실링(기구 FMEA), 차량 통신 버스(별도 네트워크 FMEA), 배터리·전원 분배(전원계 FMEA). — 제외 이유: 각각 별도 검증 체계로 커버되어 중복 분석을 피하기 위함.',
    assumptions:
      '공급전압 12V±10%·동작온도 -40~85℃ 전제. 유리 승강 하중은 규격 준수로 가정. 이전 세대 B-Sedan 전동 윈도우(품번 PW-100) 설계 자산을 참조. 방수 그로밋 사양은 아직 미확정(초기값)으로 두고 평가한다.',
  },
  PFMEA: {
    scope:
      '전동 윈도우 도어 조립 공정 FMEA. 라인 L-07, 완성품 품번 PW-220. 레귤레이터 장착~모터 체결~하네스 결선~승강 기능검사까지의 조립 공정을 대상으로 한다.',
    inScope:
      '레귤레이터 볼트 체결, 구동 모터 장착, 커넥터 삽입, 하네스 클립 고정, 승강 기능·끼임 검사 공정. (공정 트리에 들어갈 항목)',
    outOfScope:
      '구동 모터 부품 전공정(별도 PFMEA), 원자재 입고검사(수입검사 절차서로 관리), 포장·출하. — 제외 이유: 전공정·입고 단계는 별도 관리 체계가 있어 이 라인 범위에서 제외.',
    assumptions:
      '작업자는 표준작업 교육 이수로 가정. 체결 토크 관리기준은 양산 검증 전이라 잠정값. 설비는 정기 예방보전(PM) 완료 상태를 전제. 이전 X-SUV 리어 도어 라인(L-05) 공정 실적을 참조한다.',
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
      '분석 대상과 범위를 정하고 FMEA 유형(DFMEA/PFMEA)을 결정합니다. 상단 툴바에서 제목·유형을 설정하세요. (RPN·AP는 항상 함께 산출됩니다.)',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 제목: "전동 윈도우 시스템 DFMEA", 유형: DFMEA — 아래 "예시 채우기"로 범위/경계/가정을 넣어보세요.'
        : '예) 제목: "전동 윈도우 도어 조립 라인 PFMEA", 유형: PFMEA',
  },
  {
    id: 2,
    title: 'Structure Analysis',
    description:
      'DFMEA는 System→Subsystem→Component, PFMEA는 Process→Step→Work Element(4M)로 대상을 트리로 분해합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 전동 윈도우(System) → 윈도우 레귤레이터(Subsystem) → 구동 모터(Component)'
        : '예) 전동 윈도우 도어 조립(Process) → 레귤레이터 체결(Step) → 작업자/토크렌치/볼트/체결절차(4M)',
  },
  {
    id: 3,
    title: 'Function Analysis',
    description:
      '각 구조 요소가 수행해야 할 기능을 정의합니다. 실패 분석의 기준선이 되므로 측정 가능한 형태로 기술합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) 구동 모터: "지정 토크로 유리창을 5초 내 완전 상승시킨다"'
        : '예) 레귤레이터 체결: "볼트를 규정 토크 25±3N·m로 체결한다"',
  },
  {
    id: 4,
    title: 'Failure Analysis',
    description:
      '실패는 기능의 부정입니다. 실패체인 FE(영향) ← FM(고장모드) ← FC(원인)를 기능마다 도출합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) [구동 모터] FE "유리창 상승 불가로 방수·보안 실패" ← FM "모터가 회전하지 않는다" ← FC "브러시 마모로 통전 불량"'
        : '예) [레귤레이터 체결] FE "체결 풀림으로 유리 유격·이음" ← FM "규정 토크 미달로 체결" ← FC "토크렌치 미교정"',
  },
  {
    id: 5,
    title: 'Risk Analysis',
    description:
      '고장모드별 현재 예방/검출 관리를 적고 S/O/D(각 1~10)를 평가합니다. RPN(S×O×D)과 AP를 함께 산출합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) [구동 모터] 예방 "브러시 내마모 재질 적용"→O, 검출 "EOL 회전토크 시험"→D · S7·O3·D4 → RPN 84'
        : '예) [레귤레이터 체결] 예방 "토크렌치 일상점검 체크리스트"→O, 검출 "체결토크 100% 모니터링"→D · S6·O4·D4 → RPN 96',
  },
  {
    id: 6,
    title: 'Optimization',
    description:
      '리스크가 높은 항목에 권고 조치·책임자·목표일을 정하고, 조치 후 S/O/D를 재평가합니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) [구동 모터] 조치 "브러시리스(BLDC) 모터로 변경", 책임: 설계팀, 목표: 2026-Q3 · 조치 후 O 3→1 (RPN 84→28)'
        : '예) [레귤레이터 체결] 조치 "토크 자동체결기+에러프루핑 도입", 책임: 생기팀, 목표: 2026-Q3 · 조치 후 D 4→2 (RPN 96→48)',
  },
  {
    id: 7,
    title: 'Documentation',
    description:
      '분석 결과와 잔여 리스크, 후속 조치를 요약합니다. 이후 AIAG-VDA 표준 양식 Excel로 내보냅니다.',
    example: (t) =>
      t === 'DFMEA'
        ? '예) "구동 모터 회전정지 등 주요 고장모드 3건 식별. 브러시리스 전환으로 최대 RPN 84→28 저감. 잔여 조치 1건 추적."'
        : '예) "레귤레이터 체결 토크 미달 등 3건 식별. 자동체결·에러프루핑으로 최대 RPN 96→48 저감. 잔여 조치 1건 추적."',
  },
]
