import type { FmeaType } from '../types/fmea'

// S/O/D 한국어 병기 라벨(컬럼 헤더·척도표·토스트에서 재사용 — 하드코딩 분산 금지).
export const SOD_LABELS = { S: 'S(심각도)', O: 'O(발생도)', D: 'D(검출도)' } as const
export const SOD_FULL = { S: '심각도', O: '발생도', D: '검출도' } as const
// RPN 약자 안내.
export const RPN_LABEL = 'RPN'
export const RPN_HINT = 'RPN = Risk Priority Number(위험 우선순위 지수) = S×O×D'

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
  | 'severity' | 'occurrence' | 'detection' | 'prevention' | 'detectionControl' | 'rpn'
  | 'preventiveAction' | 'detectiveAction' | 'postSOD'

type EntryOrFn = HelpEntry | ((t: FmeaType) => HelpEntry)

const REG: Record<FieldKey, EntryOrFn> = {
  // ── Step 1 ──
  scope: {
    oneLiner: '무엇을 분석하는가 — 대상 품번·사양·적용 차종 수준까지.',
    placeholder: '예: LED 헤드램프 제어 모듈(품번 A123-45), 적용 차종 X-SUV 2026 MY 설계 FMEA',
    detail: {
      description:
        '분석 대상을 구체적으로 못박는다. 두루뭉술한 제품명이 아니라 품번/사양/적용 차종·라인 수준까지 적어야 이후 구조·기능 분석의 기준이 선다.',
      good: ['LED 헤드램프 제어 모듈(품번 A123-45), X-SUV 2026 MY, 정전류 구동·조도 제어 대상'],
      bad: ['헤드램프 관련 전반(품번·차종 없음, 범위 불명확)'],
      mistakes: ['품번/사양 없이 제품명만 적음', '범위가 너무 넓어 분석이 끝나지 않음'],
    },
  },
  inScope: {
    oneLiner: '이번 FMEA가 책임지는 항목 — 구조 트리에 들어갈 것들.',
    placeholder: '예: LED 드라이버 IC, 정전류 제어 회로, 방열 설계, 커넥터 인터페이스',
    detail: {
      description:
        '경계 안쪽. Step 2 구조 트리에 실제로 올릴 항목을 구체적으로 나열한다. 여기에 없는 것은 분석 대상이 아니다.',
      good: ['LED 드라이버 IC, 정전류 제어 회로, 방열 설계, 커넥터·하네스 인터페이스'],
      bad: ['관련된 부품 전부(트리에 무엇이 오를지 불명확)'],
      mistakes: ['범위를 나열만 하고 구조 트리와 연결되지 않음', '경계가 모호해 항목이 계속 늘어남'],
    },
  },
  outOfScope: {
    oneLiner: '의도적으로 제외한 것 + "왜 뺐는지". 감사·리뷰에서 반드시 질문받는다.',
    placeholder: '예: LED 광원 모듈(공급사 DVP 검증), 통신 버스(별도 네트워크 FMEA)',
    detail: {
      description:
        '경계 바깥쪽. 무엇을 뺐는지보다 "왜 뺐는지"가 핵심이다. 별도 FMEA/공급사 검증 등 근거를 함께 적어야 리뷰·감사에서 방어된다. 이유 없는 제외는 반드시 지적받는다.',
      good: ['LED 광원 모듈 — 공급사 DVP로 검증됨 / 통신 버스 — 별도 네트워크 FMEA에서 다룸'],
      bad: ['LED 광원 모듈(이유 없이 제외)', '비워둠(=사실상 무한 범위)'],
      mistakes: ['제외 항목만 적고 이유를 안 적음', '제외를 아예 안 적어 책임 경계가 흐려짐'],
    },
  },
  assumptions: {
    oneLiner: '미확정 사양·전제한 사용조건/환경·참조한 이전 프로젝트.',
    placeholder: '예: 공급전압 12V±10%·-40~85℃, 방열판 사양 미확정, 이전 세대 A100-10 참조',
    detail: {
      description:
        '무엇을 참으로 두고 분석했는지 명시한다. ①미확정 사양(잠정값) ②전제한 사용조건/환경 ③참조한 이전 프로젝트·자산을 적어두면 나중에 판단 근거가 된다. 전제가 바뀌면 평가도 다시 봐야 한다.',
      good: [
        '사용조건: 공급전압 12V±10%, 동작온도 -40~85℃',
        '미확정: 방열판 사양은 초기값(양산 전 잠정)',
        '참조: 이전 세대 B-Sedan LDM(A100-10) 설계 자산',
      ],
      bad: ['문제 없다고 가정', '정상 조건에서 동작함(조건이 무엇인지 불명확)'],
      mistakes: ['미확정 사양을 확정처럼 적음', '전제를 안 적어 평가 기준이 사람마다 달라짐'],
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
    oneLiner: '얼마나 나쁜가 (영향 FE 기준)',
    placeholder: '',
    detail: {
      description:
        '이 고장영향(FE)이 실현되면 고객·다음 공정·법규에 얼마나 나쁜가. 부품이 얼마나 망가졌나가 아니라 그 결과의 무게를 매긴다. 같은 고장모드라도 영향이 여러 개이고 영향마다 심각도가 달라 S는 FE에 붙는다.',
      good: [
        '전자파 간섭 → 자기 제품 오작동(중간) / 타 제품 간섭 유발(법규 위반, 최고)',
        "고장 감지 시 표시를 끄면 '오독'이 '표시 안 됨'이 되어 S가 실제로 낮아짐(영향의 성격을 바꿈)",
      ],
      bad: ['발생 빈도를 S에 반영(그건 O)'],
      mistakes: ['S는 조치로 거의 안 내려간다 — 설계를 바꿔 영향의 성격 자체를 바꿔야 내려간다'],
    },
  },
  occurrence: {
    oneLiner: '얼마나 자주 (원인 FC의 빈도)',
    placeholder: '',
    detail: {
      description:
        '이 원인(FC)이 얼마나 자주 발생하는가 — 심각한 정도가 아니라 빈도·확률이다. 빈도는 원인마다 달라 O는 FC에 붙는다(부품 자체 불량은 드물고, 열에 의한 파손은 설계에 따라 잦을 수 있다).',
      good: ['예방관리(디레이팅·설계 규칙·검증된 부품·열 설계)가 튼튼하면 발생 빈도가 낮아지고 그것이 O에 반영됨'],
      bad: ['예방관리가 비어 있는데 O를 낮게 매김 = 근거 없음'],
      mistakes: ['검출 난이도를 O에 반영(그건 D)'],
    },
  },
  detection: {
    oneLiner: '얼마나 못 찾나 (낮을수록 잘 검출)',
    placeholder: '',
    detail: {
      description:
        '이 원인·고장모드를 얼마나 못 찾아내는가. S·O와 반대로 잘 검출할수록 낮은 값(1), 못 찾을수록 높은 값(10) — RPN이 곱이라 "검출 못 할 위험"으로 눈금이 매겨진다. DFMEA의 D는 "설계검증"을 묻는다: 양산 전 DV시험·시뮬레이션·열해석·설계검토·수명시험이 이 문제를 발견할 수 있는가.',
      good: [
        '설계검증(DV시험·해석, 양산 전) → DFMEA의 D',
        '공정검사(EOL·전수검사, 양산 중 출하 전) → PFMEA의 D',
        '런타임 진단(제품이 사용 중 스스로 감지) → D가 아니라 설계 특징이라 영향을 바꿈 → S에 반영',
      ],
      bad: ["출하검사를 근거로 DFMEA의 D를 낮춤 = '설계 검증은 안 했지만 검사로 걸러낸다'는 뜻"],
      mistakes: ['방향 혼동: 잘 검출=1, 못 찾음=10', '예방(발생 저감)과 검출을 뒤섞음'],
    },
  },
  prevention: {
    oneLiner: '원인 발생을 줄이는 현재 관리 → O',
    placeholder: '예: 브러시 내마모 재질 적용',
    detail: {
      description:
        '원인 발생 자체를 줄이는 "현재" 관리(설계 기준·강건설계·디레이팅·검증된 부품). O에 영향. 앞으로 할 계획은 여기가 아니라 Step 6 조치로 간다.',
      good: ['내마모 재질, 체결 토크 관리 기준, 전류 디레이팅'],
      bad: ['출하검사(그건 검출관리)', '아직 안 하는 계획을 여기 적음(그건 Step 6 조치)'],
      mistakes: ['계획을 예방관리에 적으면 아직 없는 관리로 O를 매기게 된다'],
    },
  },
  detectionControl: {
    oneLiner: '결함을 찾아내는 현재 관리 → D',
    placeholder: '예: EOL 회전시험, 도통검사',
    detail: {
      description:
        '원인·고장을 찾아내는 "현재" 관리(검사·시험). D에 영향. 예방관리와 마찬가지로 "지금 하고 있는 것"만 적고, 앞으로 할 것은 Step 6 조치로 간다.',
      good: ['EOL 회전시험, 100% 도통검사, DV 수명시험'],
      bad: ['재질 변경(그건 예방관리)', '아직 안 하는 검사를 여기 적음(그건 Step 6 조치)'],
      mistakes: ['계획을 검출관리에 적으면 아직 없는 관리로 D를 매기게 된다'],
    },
  },
  rpn: {
    oneLiner: 'RPN=S×O×D · 조치는 S→O→D 순',
    placeholder: '',
    detail: {
      description:
        'RPN(위험우선순위)=S×O×D. 곱이라 서로 다른 조합이 같은 값이 될 수 있으니 값만 보지 말고 S(안전)를 함께 본다. 조치는 S→O→D 순으로 우선한다.',
      good: [
        'S를 낮추는 설계변경: 어렵지만 근본적 (최선)',
        'O를 낮추는 예방: 불량 자체가 줄어 비용·클레임 감소 (차선)',
      ],
      bad: ['D만 낮추는 검출 강화: 불량은 그대로 만들어지고 걸러내는 비용이 계속 들며, 간헐 고장은 검사가 구조적으로 못 잡는다 (최하)'],
      mistakes: ['RPN 값만 보고 S=9·10 안전 항목을 지나침'],
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
    oneLiner: '조치 후 재평가 (전=현재 관리 기준)',
    placeholder: '',
    detail: {
      description:
        '조치 전은 "지금 있는 관리"만을 근거로 한 현재 평가, 조치 후는 조치를 실행한 뒤의 재평가다. 원본 S/O/D는 그대로 두고 별도로 기록한다.',
      good: [
        '원인 제거로 O 3→1, 검출 강화로 D 4→2',
        '어느 값이 내려갔는지로 조치 성격을 안다: O↓=예방 강화, D만↓=검사 추가(근본 해결이 아닐 수 있음)',
      ],
      bad: ['조치 전후 점수가 같음 = 그 조치는 리스크를 못 줄인 것'],
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
