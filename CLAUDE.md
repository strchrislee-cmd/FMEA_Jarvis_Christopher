# FMEA Assistant — Project Rules

## 목적
DFMEA/PFMEA를 AIAG-VDA 7단계로 안내하고, 각 단계에서 예시를 보여주며
입력받아, 최종적으로 AIAG-VDA 표준 양식의 Excel(.xlsx)로 출력하는 로컬 웹앱.

## 기술 스택 (변경 금지)
- Vite + React + TypeScript + Tailwind
- Excel 출력: SheetJS(xlsx)
- 저장: localStorage + JSON export/import (서버 DB 없음)
- Phase 5의 Claude 연동만 별도 최소 Node/Express 프록시 사용

## 작업 방식
- 한 번에 한 Phase만. 내가 "다음 Phase" 라고 할 때까지 다음으로 넘어가지 말 것.
- 코드 작성 전, 가정과 설계 결정을 먼저 3~5줄로 요약해 확인받을 것.
- 최소 구현 우선. 요청하지 않은 기능/추상화/설정 옵션 추가 금지.
- 기존 코드 스타일 유지, 무관한 리팩터링 금지.
- 각 Phase 끝에 "검증 방법"을 실제로 실행해 결과를 보여줄 것.

## FMEA 도메인 정의 (반드시 준수)
- AIAG-VDA 7단계:
  1 Planning&Preparation, 2 Structure Analysis, 3 Function Analysis,
  4 Failure Analysis, 5 Risk Analysis, 6 Optimization, 7 Documentation
- DFMEA 구조: System → Subsystem → Component (초점=설계, 관리=설계검증/DV)
- PFMEA 구조: Process → Step → Work Element(4M: Man/Machine/Material/Method)
  (초점=공정, 관리=공정관리, 특별특성 포함)
- Failure Analysis는 실패체인으로 연결: Failure Effect(FE) ← Failure Mode(FM) ← Failure Cause(FC)
- 평가 척도 S/O/D는 각 1~10, 사용자가 편집 가능한 표로 제공(핸드북 원문 복붙 금지, 편집 가능한 자체 표)
- 리스크 산정은 RPN(=S×O×D)과 AP(H/M/L) 둘 다 지원, 프로젝트 설정에서 토글

---

# 진행 상황 & 확정 설계 (새 대화는 이 파일만 읽어도 맥락 파악 가능)

## 핵심 불변 원칙 (모든 페이즈 공통)
- **단일 진실원(single source of truth)**: 파생값은 저장하지 않는다.
  - RPN = S×O×D, AP = (S,O,D) 조합표 **룩업**(RPN 구간 매핑 금지, 키 없으면 "미설정" — 임의값 금지).
  - S는 FE에, O·D·현재관리(prevention/detectionControl)는 FC에 저장. 리스크 행(FE×FM×FC)·조치후 RPN/AP도 파생.
- **단일 삭제 경로**: `lib/structure.ts`의 계층 헬퍼 하나로만 삭제 연쇄.
  - `deleteStructureNode → removeFunctions → removeFailureModes → removeFailureCauses`. 직접 삭제(기능/FM/FC)도 같은 경로 재사용.
  - 노드 앵커 위성(interfaces, layout, [예정] pDiagrams)은 `deleteStructureNode`의 `removedNodes` 단계에서 함께 정리(고아 0).
- **layout은 위성 필드**: 블록 좌표는 `layout: {nodeId:{x,y}}`에만. 도메인 배열엔 좌표를 절대 넣지 않는다. 좌표 없으면 자동배치 폴백.
- **file:// 단일 파일 보장**: `npm run build`가 JS/CSS를 인라인해 `dist/index.html` 하나만 생성(vite.config의 커스텀 `singleFile` writeBundle 플러그인). 회사 PC에서 Node 없이 더블클릭 실행. **검증은 반드시 file:// 단일 빌드에서** 실행해 보고.
- **순수 SVG(다이어그램)**: React Flow 미사용. 줌/팬은 content `<g>` transform + 화면→content 변환을 그 g의 `getScreenCTM().inverse()`로 일원화(모든 배율에서 드래그/드롭 정확). **React Flow 에스컬레이션 기준**: 인터페이스 밀도가 높아 직선/베지어가 겹쳐 판독 붕괴하거나 orthogonal 자동 라우팅·미니맵이 실무상 필요해질 때(그때 스택 변경 승인 + file:// 인라인 스모크 테스트 선행).
- 검증은 Playwright(전역 `/opt/node22/.../playwright`, chromium `/opt/pw-browsers/chromium-1194/...`)로 file:// 로드해 실행.

## 데이터 모델 요지 (`src/types/fmea.ts` — 평면+id 정규화)
`FmeaProject` = 도메인 데이터 1건. 참조는 전부 id(문자열, uuid).
- `meta{ title, type: DFMEA|PFMEA, riskMethod: RPN|AP }`
- `planning{ scope, inScope, outOfScope, assumptions, team[] }`  (Step 1)
- `structure: StructureNode[]{ id, parentId|null, name, level(0/1/2), category?(4M) }`  (트리; 0=System,1=Subsystem,2=Component)
- `functions[]{ id, structureNodeId, text }`  → structure
- `failureModes[]{ id, functionId, text, errorStateId? }`  → function (실패=기능의 부정). errorStateId = P-Diagram 출처(B-1)
- `failureEffects[]{ id, failureModeId, text, severity? }`  (S는 여기)
- `failureCauses[]{ id, failureModeId, text, prevention?, occurrence?, detectionControl?, detection?, noiseId?, preventionControlId? }`  (O·D·관리는 여기; noiseId·preventionControlId = P-Diagram 출처, B-1)
- `optimizations[]{ id, failureCauseId, preventiveAction, detectiveAction, responsibility, targetDate, status, severity?, occurrence?, detection? }`  (조치후 S/O/D는 원본 FE/FC 미변경, 여기 별도 보관)
- `scales{ DFMEA, PFMEA }` 각 `{ S,O,D: string[10] }`  (등급 1~10 설명, 편집·export 대상)
- `apTable: Record<"s-o-d", H|M|L>`  (AP 조합표; 편집/JSON주입)
- `documentation{ summary }`
- `interfaces[]{ id, fromNodeId, toNodeId, label, kind: 신호|전원|기계 }`  (블록 간, 노드 id 쌍)
- `layout: Record<nodeId,{x,y}>`  (블록 배치 좌표 위성, export 별도 섹션)
- `pDiagrams[]{ id, structureNodeId, inputs[], controls[], noises[], outputs[], errorStates[] }`  (블록 단위 P-Diagram; 항목 `{id,text}`, noise `{id,text,category}`)
- 파생 유틸: `lib/risk.ts`(computeRPN/apKey/computeAP/buildRiskRows, `RATINGS=[1,2,4,6,8,10]`), `lib/optimization.ts`(postRPN/AP·mergeOptimizations), `lib/diagram.ts`(autoBlockPositions/systemSlots/childBlockPositions/blockPositions), `lib/excel.ts`(SheetJS xlsx-js-style@1.2.0 고정).
- UI 상태(currentStep 등)는 `fmea:ui:v1`(localStorage 별도 키). 도메인은 `fmea:project:v1`. 줌/팬/캔버스 크기/드릴 상태는 **저장 안 함(세션 UI)**.
- `normalizeProject`(lib/factory.ts): 구버전/누락 필드 방어 로드(흰 화면 방지, 구버전 risks[] 등 무시).

## 완료 페이즈 & 확정 결정
- **Phase 0 스캐폴드**: Vite+React+TS+Tailwind v4, 7단계 Stepper + 가이드 패널, localStorage 자동저장, JSON export/import.
- **Phase 1 (Step 1~3)**: Planning 폼 / Structure 3레벨 고정 트리(유형별 라벨, level2 자식추가 비활성, PFMEA WorkElement 4M) / Function. **결정: 3레벨 고정, cascade+확인창 삭제.**
- **Phase 2 (Step 4)**: 실패체인 FE←FM←FC 3열 편집. **결정: FE/FC는 FM에 직접 연결(결정 A). 정리 로직 계층화(단일 경로).**
- **Phase 3 (Step 5)**: S/O/D 척도표·현재관리·RPN·AP. **결정 (B): RiskItem 제거, S→FE / O·D·관리→FC, 행은 파생. RPN/AP 파생·미저장. AP는 조합표 룩업(구간 금지). optimization은 failureCauseId 앵커. 척도표/AP표는 하드코딩 없이 편집 가능.**
- **Phase 4 (Step 6·7 + Excel)**: Optimization(전/후 나란히, 조치후값 별도보관) / Documentation(요약+내보내기) / **Excel(xlsx-js-style 고정, 시트=표지/FMEA/척도표, 1행=FE×FM×FC, 단일 조치는 숫자셀·다건만 "; " 병합).**
- **Excel 헤더 한국어 병기**(`lib/excel.ts`, 값·컬럼 구성·순서 불변, 헤더 문구만): 구조=`levelLabelsBilingual`(영문은 `levelLabels` 재사용, 한글 병기는 `structure.ts` `LEVEL_KO`) → System(시스템)/… , DFMEA·PFMEA 각각. 실패=고장영향(FE)/고장모드(FM)/고장원인(FC). S/O/D=화면 `SOD_LABELS` 재사용. RPN(위험우선순위)·AP(조치우선순위), 조치후 컬럼 동일. **척도표 시트**: 헤더 병기 + **S/O/D 모두 빈 등급 행은 미출력**(하나라도 문구 있으면 출력), 생략분은 하단 "그 외 등급은 기준 미정의" 각주(A:D 병합). 회사 척도 프리셋은 등급 10/8/6/4/2/1을 S/O/D 전부 채움(8·4 포함) — 앱에서 비어 보이면 프리셋 미로드/사용자 편집 탓, "회사 기본값 불러오기"로 복원.
- **Excel 서식 개선**(`lib/excel.ts`, 데이터·컬럼·값 불변, 스타일만): 전 셀 세로 가운데+wrapText, 텍스트 좌측·숫자(S/O/D/RPN/AP) 가운데 정렬, 내용 맞춤 열너비+행높이 추정. 헤더 굵게+가운데+테두리+**컬럼 그룹별 배경 톤**(구조/기능·실패·리스크·조치 4색). 의미색만: **RPN 연녹/연주황/연적**(`rpnBand`), **AP H연적·M연주황·L연녹**, **S=9·10 행의 S셀 진한 강조+굵은 테두리**(`isSafetyRow`); 그 외 셀 무채색. 얇은 테두리+그룹경계 medium 세로선. 헤더행 **AutoFilter**(정렬/필터). 척도표·표지도 서식(표지 프로젝트명 16pt). **한계: freeze pane은 pinned xlsx-js-style(0.18.5) 라이터가 미출력 → AutoFilter로 대체(스크롤 고정은 미지원).** 검증은 앱 다운로드 캡처 → 생성 xlsx의 값(불변)·styles.xml 실측.
- **단일 HTML 빌드**: `dist/index.html` 하나로 인라인(file:// 실행). vite-plugin-singlefile은 Vite8/rolldown 충돌 → 커스텀 플러그인.
- **가이드/도움말**: `lib/help.ts`(필드키→{oneLiner,placeholder,detail(좋은/나쁜 예)}) + `<FieldHelp>`(? 팝오버). Step 1 세트 예시(LED 헤드램프 계열) + "예시 채우기".
- **회사 척도 반영**: DFMEA 척도표에 사내 프리셋(`lib/scalePreset.ts`), **등급 1·2·4·6·8·10만 사용(3·5·7·9 제거)**. "회사 기본값 불러오기" 버튼 + Note 각주. **PFMEA 척도표는 빈칸(공정관리 기준 별도).**
- **AP 조합표 사내 프리셋**(`lib/apPreset.ts` `companyApPreset()`): 회사 척도 10/8/6/4/1의 **125조합 전수 + 조합별 사유 라벨 27종**을 코드에 임베드(외부 파일 불필요). AP 편집 화면 "사내 기본값 불러오기"로 주입, 이후 등급·라벨 개별 편집 가능(칩 클릭→폼). `computeAP`는 여전히 순수 "S-O-D" 룩업(RPN 구간 매핑 금지), 미등록 조합은 "미설정". 특성: S=10 조합 25개에 L 없음. 등급은 라벨 없던 버전과 100% 동일(`10-4-1`=M). **주의: 규칙안이며 품질팀 확정 전 — `10-4-1`은 첨부표대로 M(과제 예시의 H와 상충, 미해결).**
- **AP 자료형**: `ApTable = Record<"s-o-d", { ap: 'H'|'M'|'L'; label? }>`. **레거시 문자열 표("H")도 `normalizeProject`가 `{ap}`로 관용 수용**(label 없이 등급만). `risk.lookupAp`는 문자열도 관용 처리. AP 셀은 **등급+조치수준(H=조치 필수/M=권고/L=선택)+사유 라벨**(라벨 없으면 등급만, 앱이 문장 생성 금지).
- **Step 5 리스크 화면 개선**: S/O/D 한국어 병기(중앙 라벨 맵 `help.ts` `SOD_LABELS`/`RPN_HINT` 재사용) · RPN 색상 구간(≤100 녹/101~200 주황/≥201 적, **값+라벨 병행**=색약 대응, `risk.ts` `rpnBand`) · **S=9·10 안전행은 RPN 무관 ⚠강조**(`isSafetyRow`) · 등급 선택 시 척도표 문구 2초 토스트(scales에서만 읽고 없으면 "기준 미정의", **위치=하단 가운데 `w-[90vw] max-w-xl` 줄바꿈**; 가로/세로 어느 비율에서도 안 잘림 — 테스트 편의로 우측에 붙였던 것 되돌림) · AP 빈 표 안내 + 등록 조합 수 표시.
- **Phase A (Step 2 블록다이어그램 편집기, 순수 SVG)**:
  - 블록 = 구조 노드 재사용(새 엔티티 없음). **interfaces[]** 추가(노드 id 쌍, kind만; category N/C/X는 P-Diagram으로). **layout** 위성 좌표.
  - System(level0) **그룹 박스**(소속 Subsystem을 감싸는 계산 경계, 저장 안 함). 헤더=[좌 레벨라벨][우 이름]. 빈 System도 단독 드래그(layout[systemId]).
  - 드래그로 이동, 가장자리 핸들 드롭으로 연결, 연결선 클릭 편집(label/kind/방향/삭제). 다이어그램에서 System/Subsystem 생성(기존 addNode 재사용, id 반환). 이름 텍스트 더블클릭=편집.
  - 캔버스: 프리셋(작게/보통/크게, 가로+세로) + 우하단 모서리 리사이즈(React 소유), 줌(+/−/휠/맞춤/100%)·팬. **모두 세션 UI, 저장 안 함.** PNG 내보내기(줌 무관 전체, 프레임 기하로 결정적).
  - Step 2 다이어그램 모드에선 가이드 패널 숨겨 폭 확보(다른 스텝 폭 불변).
  - **Component 드릴인**: Subsystem 본체 더블클릭 → 내부 진입(`drillInto` 세션 UI, 단일값, 저장 안 함). 그 Subsystem의 Component를 블록으로 편집(생성/이름/드래그/**같은 부모 내 Component↔Component 연결**, 컨텍스트 필터 렌더). "← 상위로"+브레드크럼. 최상위 Subsystem에 **Component 개수 배지 `C n`** + 진입 힌트. PNG 파일명에 컨텍스트 반영. 본체 더블클릭=드릴(포인터 캡처가 native dblclick 삼켜 타이밍 판정), 이름 텍스트=편집.
- **Phase A-2 (P-Diagram, 블록 단위)** — `types`에 `pDiagrams[]{ id, structureNodeId, inputs[], controls[], noises[], outputs[], errorStates[] }`. 항목=**`{id,text}`**(안정 id로 Phase B 연결), noise=**`{id,text,category}`**. 정식 5방향(Input Signal/Control Factor/Ideal Output/Error State + Noise Factor **5분류 서브섹션**: 부품편차/시간경과·열화/사용조건/사용환경/시스템상호작용). **부착 = 선택 블록(Subsystem·Component), System 제외**, 노드당 1:1 지연 생성. UI = **우측 사이드 패널**(`PDiagramPanel.tsx`), 블록 선택 시 툴바 "P-Diagram" 컨텍스트 토글로 열기. 보유 표시 = **불리언 "P" 칩**(`C n` 반대 코너). 순수 헬퍼는 `lib/pdiagram.ts`(PD_FIELDS/NOISE_CATEGORIES/get·hasPDiagramContent), 뮤테이터는 `useFmea`(upsert 지연생성 + add/update/removePdItem·addNoiseItem, 빈 껍데기 자동 제거). 삭제 연쇄는 `deleteStructureNode`에서 interfaces/layout과 같은 지점 정리. JSON export 자동 포함. **Excel 반영·그래픽 박스 렌더는 후속(Phase B 이후).**
- **Phase B-1 (P-Diagram → FMEA 연결)** — **출처 포인터 방식**(참조, 텍스트 비미러): `FM.errorStateId?`, `FC.noiseId?`, `FC.preventionControlId?` 전부 nullable·가산. 각자 text가 단일 진실원, 포인터는 출처만 기록. **Pull UI(가져오기, push 없음)**: Step 4 `FailureEditor`에서 FM은 같은 노드 Error State, FC는 같은 노드 Noise 셀렉트(`PdImportSelect.tsx`, text 프리필+포인터), Step 5 `RiskEditor`의 prevention은 같은 노드 Control Factor 셀렉트. **same-node 제약**(cross-node 미룸). 출처는 읽기전용 "◇" 태그. **삭제:** 상류 P-Diagram 항목 삭제 시 `removePdItem`이 인바운드 포인터만 null(FM/FC 생존); 노드 삭제는 same-node라 기존 cascade로 양쪽 정리. `normalizeProject`에 dangling 포인터 null 방어. **미룸(손대지 말 것):** 텍스트 미러·out-of-sync 표시, cross-node, push/양방향, 복수 control, Excel 출처 컬럼.

## 남은 작업
- **Phase B-2 (인터페이스 → FMEA)**: 인터페이스(노드 쌍)의 실패는 "인터페이스 함수"를 거쳐 기존 FM 파이프라인을 타야 함 → `FunctionItem` 앵커를 노드|인터페이스로 일반화(FunctionEditor·buildRiskRows·structurePath·excel 파급). **침습적이라 분리·후속.**
- **Excel 반영**: P-Diagram·B-1 출처·인터페이스의 Excel 표기(B-2 뒤 별도 꼬리 작업). P-Diagram 그래픽(박스+화살표) 렌더.
- **Phase 5 (CLAUDE 연동)**: 별도 최소 Node/Express 프록시(스택 예외).

## 미룰 것(명시적 범위 밖 — 요청 전 손대지 말 것)
- 서로 다른 Subsystem의 Component 간 연결, Subsystem↔Component 교차레벨 연결.
- 드래그로 소속 변경(reparent), 3레벨 초과 중첩, 블록 안 미니어처 미리보기.
- 줌/팬/드릴/캔버스크기 상태 저장(전부 세션 UI).
- P-Diagram/인터페이스의 Excel·이미지 삽입(커뮤니티 SheetJS는 이미지 미지원).

## 브랜치
- 개발/푸시: `claude/create-chrisfmea-jarvis-repo-1oka90` (repo `strchrislee-cmd/FMEA_Jarvis_Christopher`).
