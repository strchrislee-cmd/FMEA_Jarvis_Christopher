import type { FmeaType } from '../types/fmea'

// 필드별 도움말을 한 곳에 모은다. (핸드북 원문 복붙 금지 — 자체 문장)
// detail에는 좋은 예/나쁜 예를 최소 한 쌍 + 흔한 실수를 담는다.
export interface HelpDetail {
  description: string
  good: string[]
  bad: string[]
  mistakes: string[]
}
export interface HelpEntry {
  oneLiner: string
  placeholder: string
  detail: HelpDetail
}

export type FieldKey =
  | 'scope' | 'inScope' | 'outOfScope' | 'assumptions' | 'team'
  | 'structL0' | 'structL1' | 'structL2' | 'fourM'
  | 'function'
  | 'fe' | 'fm' | 'fc'
  | 'severity' | 'occurrence' | 'detection' | 'prevention' | 'detectionControl'
  | 'preventiveAction' | 'detectiveAction' | 'postSOD'

type EntryOrFn = HelpEntry | ((t: FmeaType) => HelpEntry)

const REG: Record<FieldKey, EntryOrFn> = {
  // ── Step 1 ──
  scope: {
    oneLiner: '이 FMEA가 다루는 대상과 목적을 한두 문장으로.',
    placeholder: '예: 전동 윈도우 시스템의 승하강 기능 설계 FMEA',
    detail: {
      description: '무엇을, 어떤 관점(설계/공정)에서, 왜 분석하는지 범위를 정한다.',
      good: ['전동 윈도우 레귤레이터의 승하강 성능·내구 설계 검증'],
      bad: ['윈도우 관련 전체(범위 불명확)'],
      mistakes: ['범위가 너무 넓어 분석이 끝나지 않음', '포함/제외 경계를 안 정함'],
    },
  },
  inScope: {
    oneLiner: '이번 분석에 포함할 대상을 명확히.',
    placeholder: '예: 구동 모터, 레귤레이터, 기어',
    detail: {
      description: '경계 안쪽. 이번에 실제로 분석할 항목을 구체적으로 나열한다.',
      good: ['구동 모터, 레귤레이터, 감속 기어'],
      bad: ['관련된 거 전부'],
      mistakes: ['경계가 모호해 항목이 계속 늘어남'],
    },
  },
  outOfScope: {
    oneLiner: '이번엔 제외할 대상을 분명히 적어 혼선을 막는다.',
    placeholder: '예: 스위치 하네스, 도어 트림(별도 FMEA)',
    detail: {
      description: '경계 바깥쪽. 왜 제외하는지(별도 FMEA 등)까지 적으면 책임 경계가 분명해진다.',
      good: ['스위치 하네스(별도 FMEA에서 다룸)'],
      bad: ['없음(=사실상 무한 범위)'],
      mistakes: ['제외를 안 적어 책임 경계가 흐려짐'],
    },
  },
  assumptions: {
    oneLiner: '분석의 전제 조건. 나중에 평가 판단의 근거가 된다.',
    placeholder: '예: 상온·정상 전압 조건, 부품은 규격 준수',
    detail: {
      description: '어떤 조건을 참으로 두고 분석하는지 명시한다. 전제가 다르면 평가도 달라진다.',
      good: ['공급전압 12V±10%, 상온 조건, 규격 부품 사용'],
      bad: ['문제 없다고 가정'],
      mistakes: ['전제를 안 적어 평가 기준이 사람마다 달라짐'],
    },
  },
  team: {
    oneLiner: '분석에 참여하는 인원. 다기능 팀이 이상적.',
    placeholder: '이름 입력 후 추가 (예: 홍길동)',
    detail: {
      description: '설계·품질·생산·시험 등 여러 관점이 모여야 누락이 줄어든다.',
      good: ['설계/품질/생산/시험 담당으로 구성'],
      bad: ['1인 단독 작성'],
      mistakes: ['한 부서만 참여해 관점이 편중됨'],
    },
  },

  // ── Step 2 (유형별 분기) ──
  structL0: (t) =>
    t === 'DFMEA'
      ? {
          oneLiner: '분석 대상의 최상위 시스템(전체 기능 단위).',
          placeholder: '예: 전동 윈도우 시스템',
          detail: {
            description: '설계 FMEA의 최상위. 완성 기능을 담당하는 시스템 이름을 적는다.',
            good: ['전동 윈도우 시스템'],
            bad: ['자동차(너무 상위)'],
            mistakes: ['레벨을 너무 높게 잡아 하위 분해가 안 됨'],
          },
        }
      : {
          oneLiner: '분석 대상 공정 전체(라인/공정명).',
          placeholder: '예: 도어 조립 공정',
          detail: {
            description: '공정 FMEA의 최상위. 하나의 공정/라인 이름을 적는다.',
            good: ['도어 조립 공정'],
            bad: ['공장 전체 / 제품명'],
            mistakes: ['공정이 아니라 제품명을 적음'],
          },
        },
  structL1: (t) =>
    t === 'DFMEA'
      ? {
          oneLiner: '시스템을 이루는 하위 시스템/어셈블리.',
          placeholder: '예: 윈도우 레귤레이터',
          detail: {
            description: '시스템을 기능 블록으로 나눈 중간 단위.',
            good: ['레귤레이터, 구동 모터 어셈블리'],
            bad: ['부품들(레벨 혼재)'],
            mistakes: ['부품(3레벨)을 여기에 섞음'],
          },
        }
      : {
          oneLiner: '공정을 이루는 개별 작업 단계.',
          placeholder: '예: 힌지 체결',
          detail: {
            description: '공정을 순서대로 나눈 작업 스텝.',
            good: ['힌지 체결, 도어 장착'],
            bad: ['조립(모호)'],
            mistakes: ['단계가 아니라 4M 요소를 적음'],
          },
        },
  structL2: (t) =>
    t === 'DFMEA'
      ? {
          oneLiner: '가장 작은 설계 단위 부품.',
          placeholder: '예: 구동 모터',
          detail: {
            description: '더 이상 나누지 않는 설계 대상 부품.',
            good: ['구동 모터, 감속 기어'],
            bad: ['부품 일체(뭉뚱그림)'],
            mistakes: ['부품이 아니라 기능을 여기 적음'],
          },
        }
      : {
          oneLiner: '작업 단계를 구성하는 4M 요소.',
          placeholder: '예: 토크렌치(Machine)',
          detail: {
            description: '한 스텝을 이루는 Man/Machine/Material/Method 요소.',
            good: ['작업자(Man), 토크렌치(Machine)'],
            bad: ['체결(그건 작업 단계)'],
            mistakes: ['작업 단계를 반복 기재'],
          },
        },
  fourM: {
    oneLiner: 'Work Element를 사람/설비/재료/방법으로 분류(4M).',
    placeholder: '',
    detail: {
      description: 'PFMEA에서 원인(FC) 분석의 축이 되는 분류. Man/Machine/Material/Method.',
      good: ['토크렌치 → Machine, 체결절차 → Method'],
      bad: ['분류를 비워둠'],
      mistakes: ['4M을 안 정해 원인이 뭉뚱그려짐'],
    },
  },

  // ── Step 3 ──
  function: (t) => ({
    oneLiner: "그 요소가 해야 할 일을 '측정 가능하게' 기술.",
    placeholder:
      t === 'DFMEA'
        ? '예: 유리창을 5초 내 완전 상승시킨다'
        : '예: 볼트를 규정 토크 25±3N·m로 체결한다',
    detail: {
      description: '동사+대상+정량 기준으로 쓴다. 실패 분석(FM)의 기준선이 된다.',
      good:
        t === 'DFMEA'
          ? ['유리창을 5초 내 상승시킨다(측정 가능)']
          : ['규정 토크 25±3N·m로 체결한다(측정 가능)'],
      bad: t === 'DFMEA' ? ['유리창을 잘 올린다(모호)'] : ['단단히 조인다(모호)'],
      mistakes: ['정량 기준이 없어 실패 판정이 주관적', '여러 기능을 한 줄에 뭉침'],
    },
  }),

  // ── Step 4 ──
  fm: {
    oneLiner: "기능의 '부정' — 기능이 어떻게 실패하는가.",
    placeholder: '예: 모터가 회전하지 않는다',
    detail: {
      description: '해당 기능이 충족되지 못하는 방식. 기능 문장을 뒤집어 쓴다.',
      good: ['(기능: 5초 내 상승) → FM: 5초를 초과한다 / 상승하지 않는다'],
      bad: ['브러시 마모(그건 원인 FC)', '고장남(모호)'],
      mistakes: ['원인(FC)이나 영향(FE)을 FM 칸에 적음'],
    },
  },
  fe: {
    oneLiner: '그 고장이 상위/고객에 미치는 영향(결과).',
    placeholder: '예: 유리창이 안 닫혀 방수 실패',
    detail: {
      description: 'FM이 발생하면 상위 시스템·사용자·규제 측면에서 생기는 일. 심각도(S)의 근거.',
      good: ['빗물 유입으로 실내 침수 / 안전규제 위반'],
      bad: ['모터 정지(그건 FM)'],
      mistakes: ['영향(FE)과 고장모드(FM)를 혼동'],
    },
  },
  fc: {
    oneLiner: '그 고장을 일으키는 근본 원인(하위 레벨).',
    placeholder: '예: 브러시 마모로 통전 불량',
    detail: {
      description: 'FM을 유발하는 메커니즘/원인. 발생도(O)와 관리의 대상이 된다.',
      good: ['브러시 마모, 커넥터 접촉 불량'],
      bad: ['모터가 안 돎(그건 FM)'],
      mistakes: ["원인을 '고장' 수준으로만 적고 메커니즘을 안 파고듦"],
    },
  },

  // ── Step 5 ──
  severity: {
    oneLiner: '영향(FE)의 심각도. 1~10, 클수록 나쁨.',
    placeholder: '',
    detail: {
      description: 'FE(결과)를 기준으로 평가한다. 원인/빈도가 아니라 결과의 무게. 척도표 정의를 따른다.',
      good: ['안전/규제 위반 → S 9~10'],
      bad: ['발생 빈도를 S에 반영(그건 O)'],
      mistakes: ['S를 원인/빈도와 혼동', '척도표 없이 감으로 매김'],
    },
  },
  occurrence: {
    oneLiner: '원인(FC)의 발생 빈도. 1~10. 예방관리와 연동.',
    placeholder: '',
    detail: {
      description: 'FC가 얼마나 자주 발생하는가. 예방관리가 강하면 O가 낮아진다.',
      good: ['강건설계 + 양산실적 → O 낮음'],
      bad: ['검출 난이도를 O에 반영(그건 D)'],
      mistakes: ['O를 검출도(D)와 혼동'],
    },
  },
  detection: {
    oneLiner: '출하 전 검출 가능성. 1~10(1=확실 검출). 검출관리와 연동.',
    placeholder: '',
    detail: {
      description: '결함/원인을 고객 전에 잡아낼 능력. 검출이 확실할수록 D가 낮다.',
      good: ['EOL 100% 자동검사 → D 낮음'],
      bad: ['발생을 줄이는 활동을 D에 반영(그건 예방/O)'],
      mistakes: ['예방과 검출을 뒤섞음', '근거 없이 D=1 부여'],
    },
  },
  prevention: {
    oneLiner: '원인 발생 자체를 줄이는 현재 관리 → O에 영향.',
    placeholder: '예: 브러시 내마모 재질 적용',
    detail: {
      description: '원인이 생기지 않게 하는 활동(설계기준, 강건설계, 재질 등).',
      good: ['내마모 재질, 체결 토크 관리 기준'],
      bad: ['출하검사(그건 검출관리)'],
      mistakes: ['검출 활동을 예방 칸에 적음'],
    },
  },
  detectionControl: {
    oneLiner: '결함/원인을 잡아내는 현재 관리 → D에 영향.',
    placeholder: '예: EOL 회전시험, 도통검사',
    detail: {
      description: '이미 생긴 결함을 출하 전에 발견하는 활동(검사/시험).',
      good: ['EOL 회전시험, 100% 도통검사'],
      bad: ['재질 변경(그건 예방관리)'],
      mistakes: ['예방과 검출을 반대로 기입'],
    },
  },

  // ── Step 6 ──
  preventiveAction: {
    oneLiner: '발생도(O)를 낮추기 위한 개선 조치.',
    placeholder: '예: 브러시리스 모터로 설계 변경',
    detail: {
      description: '원인 발생을 줄이는 개선. 보통 O를 낮춘다.',
      good: ['브러시리스 모터로 변경 → O↓'],
      bad: ['검사 추가(그건 검출조치)'],
      mistakes: ['검출 강화를 예방으로 분류'],
    },
  },
  detectiveAction: {
    oneLiner: '검출도(D)를 낮추기 위한 개선 조치.',
    placeholder: '예: 수명시험·자동검사 추가',
    detail: {
      description: '못 잡던 결함을 잡도록 검출을 강화. 보통 D를 낮춘다.',
      good: ['EOL 수명시험 추가 → D↓'],
      bad: ['재질 변경(그건 예방조치)'],
      mistakes: ['예방/검출 조치를 뒤바꿔 기입'],
    },
  },
  postSOD: {
    oneLiner: '조치 후 예측값. S는 설계변경 없이는 잘 안 내려간다.',
    placeholder: '',
    detail: {
      description: '조치가 반영됐다고 가정한 예측 평가. 원본 S/O/D는 그대로 두고 별도로 기록한다.',
      good: ['원인 제거로 O 3→1, 검출 강화로 D 4→2'],
      bad: ['관리 강화만 하고 S를 임의로 낮춤'],
      mistakes: [
        '심각도(S)는 영향(FE) 자체가 바뀌어야 내려감 — 발생/검출 조치로는 거의 안 변함',
        '조치후 값을 원본 S/O/D에 덮어씀',
      ],
    },
  },
}

export function helpFor(key: FieldKey, type: FmeaType = 'DFMEA'): HelpEntry {
  const e = REG[key]
  return typeof e === 'function' ? e(type) : e
}
