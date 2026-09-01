# FMEA Assistant — Project Rules

## 목적
DFMEA/PFMEA를 AIAG-VDA 7단계로 안내하고, 각 단계에서 예시를 보여주며
입력받아, 최종적으로 AIAG-VDA 표준 양식의 Excel(.xlsx)로 출력하는 로컬 웹앱.

## 기술 스택 (변경 금지)
- Vite + React + TypeScript + Tailwind
- Excel 출력: ExcelJS(4.4.0, 브라우저 UMD 번들 `dist/exceljs.min.js`를 Vite `browser` 필드로 로드). 구 xlsx-js-style에서 전환(이미지 삽입·freeze pane 지원). file:// 단일 HTML 인라인 동작 스모크 검증됨.
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
- 파생 유틸: `lib/risk.ts`(computeRPN/apKey/computeAP/buildRiskRows, `RATINGS=[1,2,4,6,8,10]`), `lib/optimization.ts`(postRPN/AP·mergeOptimizations), `lib/diagram.ts`(autoBlockPositions/systemSlots/childBlockPositions/blockPositions), `lib/excel.ts`(ExcelJS 4.4.0, 브라우저 UMD 번들; 다운로드는 writeBuffer→Blob→a.click).
- UI 상태(currentStep 등)는 `fmea:ui:v1`(localStorage 별도 키). 도메인은 `fmea:project:v1`. 줌/팬/캔버스 크기/드릴 상태는 **저장 안 함(세션 UI)**.
- `normalizeProject`(lib/factory.ts): 구버전/누락 필드 방어 로드(흰 화면 방지, 구버전 risks[] 등 무시).

## 완료 페이즈 & 확정 결정
- **Phase 0 스캐폴드**: Vite+React+TS+Tailwind v4, 7단계 Stepper + 가이드 패널, localStorage 자동저장, JSON export/import.
- **Phase 1 (Step 1~3)**: Planning 폼 / Structure 3레벨 고정 트리(유형별 라벨, level2 자식추가 비활성, PFMEA WorkElement 4M) / Function. **결정: 3레벨 고정, cascade+확인창 삭제.**
- **Phase 2 (Step 4)**: 실패체인 FE←FM←FC 3열 편집. **결정: FE/FC는 FM에 직접 연결(결정 A). 정리 로직 계층화(단일 경로).**
- **Phase 3 (Step 5)**: S/O/D 척도표·현재관리·RPN·AP. **결정 (B): RiskItem 제거, S→FE / O·D·관리→FC, 행은 파생. RPN/AP 파생·미저장. AP는 조합표 룩업(구간 금지). optimization은 failureCauseId 앵커. 척도표/AP표는 하드코딩 없이 편집 가능.**
- **Phase 4 (Step 6·7 + Excel)**: Optimization(전/후 나란히, 조치후값 별도보관) / Documentation(요약+내보내기) / **Excel(xlsx-js-style 고정, 시트=표지/FMEA/척도표, 1행=FE×FM×FC, 단일 조치는 숫자셀·다건만 "; " 병합).**
- **Excel 헤더 한국어 병기**(`lib/excel.ts`, 값·컬럼 구성·순서 불변, 헤더 문구만): 구조=`levelLabelsBilingual`(영문은 `levelLabels` 재사용, 한글 병기는 `structure.ts` `LEVEL_KO`) → System(시스템)/… , DFMEA·PFMEA 각각. 실패=고장영향(FE)/고장모드(FM)/고장원인(FC). S/O/D=화면 `SOD_LABELS` 재사용. RPN(위험우선순위)·AP(조치우선순위), 조치후 컬럼 동일. **척도표 시트**: 헤더 병기 + **S/O/D 모두 빈 등급 행은 미출력**(하나라도 문구 있으면 출력), 생략분은 하단 "그 외 등급은 기준 미정의" 각주(A:D 병합). 회사 척도 프리셋은 등급 10/8/6/4/2/1을 S/O/D 전부 채움(8·4 포함) — 앱에서 비어 보이면 프리셋 미로드/사용자 편집 탓, "회사 기본값 불러오기"로 복원.
- **Excel 서식 개선**(`lib/excel.ts`, 데이터·컬럼·값 불변, 스타일만): 전 셀 세로 가운데+wrapText, 텍스트 좌측·숫자(S/O/D/RPN/AP) 가운데 정렬, 내용 맞춤 열너비+행높이 추정. 헤더 굵게+가운데+테두리+**컬럼 그룹별 배경 톤**(구조/기능·실패·리스크·조치 4색). 의미색만: **RPN 연녹/연주황/연적**(`rpnBand`), **AP H연적·M연주황·L연녹**, **S=9·10 행의 S셀 진한 강조+굵은 테두리**(`isSafetyRow`); 그 외 셀 무채색. 얇은 테두리+그룹경계 medium 세로선. 헤더행 **AutoFilter**(정렬/필터) + **freeze pane**(ExcelJS 전환으로 헤더행 고정 `views:[{state:'frozen',ySplit:1}]` 실현 — 구 라이브러리 한계 해소). 척도표·표지도 서식(표지 프로젝트명 16pt). **ExcelJS 전환 시 서식 전부 재현**(fill/border/wrapText/열너비·행높이/AutoFilter) 스모크·앱 다운로드 XML 실측 검증. 스타일 적용은 `paint(cell,{fill,border,align,font})` 헬퍼로 일원화(색 ARGB 8-hex 그대로).
- **다이어그램 이미지 시트(4번째)**: Step 2 블록다이어그램을 데이터→정적 SVG(`lib/diagramSvg.ts`, 화면 렌더와 동일 기하·색·배지/P칩/화살표, 편집요소 없음)로 그린 뒤 `excel.ts`가 canvas로 **2x 래스터→PNG**(기존 PNG 내보내기의 SVG→canvas 경로 재사용)해 `wb.addImage`로 임베드. 구조가 없으면 시트 생략. file://에서 임베드·렌더 XML/PNG 실측 검증.
- **행 높이 CJK 폭 반영**(`rowHeights`, 표지·본표·척도표 공통): 한글·CJK·전각을 폭 2로 세어(`displayWidth`, code≥0x1100) 줄 수를 정확히 추정 — 한글을 1로 세던 과소추정으로 표지 범위(Scope)·가정(Assumptions)·긴 척도 문구가 잘리던 문제 해결. 개행(`\n`)도 줄로 계산, 상한 6→40줄. 표지 내용 열 64→72. 검증은 생성 .xlsx의 sheetN.xml `ht` 실측 vs 필요 줄 수(3개 시트 전 행 통과).
- **단일 HTML 빌드**: `dist/index.html` 하나로 인라인(file:// 실행). vite-plugin-singlefile은 Vite8/rolldown 충돌 → 커스텀 플러그인.
- **가이드/도움말**: `lib/help.ts`(필드키→{oneLiner,placeholder,detail(좋은/나쁜 예)}) + `<FieldHelp>`(? 팝오버). **가이드 예시는 `lib/steps.ts` 한 곳에 중앙화** — DFMEA/PFMEA 각각 **Step 1~7을 관통하는 하나의 사례**(DFMEA=전동 윈도우→윈도우 레귤레이터→구동 모터→브러시 마모, PFMEA=전동 윈도우 도어 조립→레귤레이터 체결→토크 미달). `STEP1_EXAMPLES`(4칸 세트)+`STEPS[].example`(단계 원라이너, 유형별)이 같은 제품·항목을 이어서 쓰고, GuidePanel에 `EXAMPLE_THREAD_NOTE`("Step 1~7 관통") 표시 + "예시 채우기". 핸드북 복붙 금지·자체 작성.
- **Step 5/6 도움말 보강**(텍스트 전부 `help.ts`, 컴포넌트 하드코딩 없음): 3계층(한줄요약/? 팝오버/placeholder). oneLiner 축약(S=얼마나 나쁜가, O=얼마나 자주, D=얼마나 못 찾나(낮을수록 잘 검출)). 팝오버 보강 — S(왜 FE에 붙나·조치로 거의 안 내려감), O(빈도≠심각도·예방관리 없으면 근거 없음), **D(방향: 잘 검출=1 / DFMEA D=설계검증 / 검출 3종: 설계검증→DFMEA·공정검사→PFMEA·런타임 진단→S)**, 예방/검출관리(‘현재’만·계획은 Step 6), **`rpn` 키 신설**(조치 우선순위 S→O→D, D만↓=최하), postSOD(전=현재 관리 기준, 전후 같으면 못 줄인 것). RiskEditor 상단 범례를 compact flex-wrap로 축약(표 영역 확보) + RPN 추가. FieldHelp는 바깥 클릭/ESC로 닫힘.
- **회사 척도 반영**: DFMEA 척도표에 사내 프리셋(`lib/scalePreset.ts`), **등급 1·2·4·6·8·10만 사용(3·5·7·9 제거)**. "회사 기본값 불러오기" 버튼 + Note 각주. **PFMEA 척도표는 빈칸(공정관리 기준 별도).**
- **AP 조합표 사내 프리셋**(`lib/apPreset.ts` `companyApPreset()`): 회사 척도 10/8/6/4/1의 **125조합 전수 + 조합별 사유 라벨 27종**을 코드에 임베드(외부 파일 불필요). AP 편집 화면 "사내 기본값 불러오기"로 주입, 이후 등급·라벨 개별 편집 가능(칩 클릭→폼). `computeAP`는 여전히 순수 "S-O-D" 룩업(RPN 구간 매핑 금지), 미등록 조합은 "미설정". 특성: S=10 조합 25개에 L 없음. 등급은 라벨 없던 버전과 100% 동일(`10-4-1`=M). **주의: 규칙안이며 품질팀 확정 전 — `10-4-1`은 첨부표대로 M(과제 예시의 H와 상충, 미해결).**
- **AP 자료형**: `ApTable = Record<"s-o-d", { ap: 'H'|'M'|'L'; label? }>`. **레거시 문자열 표("H")도 `normalizeProject`가 `{ap}`로 관용 수용**(label 없이 등급만). `risk.lookupAp`는 문자열도 관용 처리. AP 셀은 **등급+조치수준(H=조치 필수/M=권고/L=선택)+사유 라벨**(라벨 없으면 등급만, 앱이 문장 생성 금지).
- **Step 5 리스크 화면 개선**: S/O/D 한국어 병기(중앙 라벨 맵 `help.ts` `SOD_LABELS`/`RPN_HINT` 재사용) · RPN 색상 구간(≤100 녹/101~200 주황/≥201 적, **값+라벨 병행**=색약 대응, `risk.ts` `rpnBand`) · **S=9·10 안전행은 RPN 무관 ⚠강조**(`isSafetyRow`) · 등급 선택 시 척도표 문구 2초 토스트(scales에서만 읽고 없으면 "기준 미정의", **위치=뷰포트 정중앙**(`fixed left-1/2 top-1/2 -translate-x/y-1/2`), `w-[90vw] max-w-xl` 줄바꿈, `pointer-events-none`으로 아래 드롭다운 클릭 통과; 가로/세로 어느 비율에서도 안 잘림 — 테스트 편의로 우측/하단에 붙였던 것 되돌림) · AP 빈 표 안내 + 등록 조합 수 표시.
- **Phase A (Step 2 블록다이어그램 편집기, 순수 SVG)**:
  - 블록 = 구조 노드 재사용(새 엔티티 없음). **interfaces[]** 추가(노드 id 쌍, kind만; category N/C/X는 P-Diagram으로). **layout** 위성 좌표.
  - System(level0) **그룹 박스**(소속 Subsystem을 감싸는 계산 경계, 저장 안 함). 헤더=[좌 레벨라벨][우 이름]. 빈 System도 단독 드래그(layout[systemId]).
  - 드래그로 이동, 가장자리 핸들 드롭으로 연결, 연결선 클릭 편집(label/kind/방향/삭제). 다이어그램에서 System/Subsystem 생성(기존 addNode 재사용, id 반환). 이름 텍스트 더블클릭=편집.
  - 캔버스: 프리셋(작게/보통/크게, 가로+세로) + 우하단 모서리 리사이즈(React 소유), 줌(+/−/휠/맞춤/100%)·팬. **모두 세션 UI, 저장 안 함.** PNG 내보내기(줌 무관 전체, 프레임 기하로 결정적).
  - Step 2 다이어그램 모드에선 가이드 패널 숨겨 폭 확보(다른 스텝 폭 불변).
  - **Component 드릴인**: Subsystem 본체 더블클릭 → 내부 진입(`drillInto` 세션 UI, 단일값, 저장 안 함). 그 Subsystem의 Component를 블록으로 편집(생성/이름/드래그/**같은 부모 내 Component↔Component 연결**, 컨텍스트 필터 렌더). "← 상위로"+브레드크럼. 최상위 Subsystem에 **Component 개수 배지 `×n`**(개수 관례 표기, 0이면 숨김, hover=SVG `<title>` "부품 n개") + 진입 힌트. PNG 파일명에 컨텍스트 반영. 본체 더블클릭=드릴(포인터 캡처가 native dblclick 삼켜 타이밍 판정), 이름 텍스트=편집.
- **Phase A-2 (P-Diagram, 블록 단위)** — `types`에 `pDiagrams[]{ id, structureNodeId, inputs[], controls[], noises[], outputs[], errorStates[] }`. 항목=**`{id,text}`**(안정 id로 Phase B 연결), noise=**`{id,text,category}`**. 정식 5방향(Input Signal/Control Factor/Ideal Output/Error State + Noise Factor **5분류 서브섹션**: 부품편차/시간경과·열화/사용조건/사용환경/시스템상호작용). **부착 = 선택 블록(Subsystem·Component), System 제외**, 노드당 1:1 지연 생성. UI = **우측 사이드 패널**(`PDiagramPanel.tsx`), 블록 선택 시 툴바 "P-Diagram" 컨텍스트 토글로 열기. 보유 표시 = **불리언 "P" 칩**(개수 배지 `×n` 반대 코너). 순수 헬퍼는 `lib/pdiagram.ts`(PD_FIELDS/NOISE_CATEGORIES/get·hasPDiagramContent), 뮤테이터는 `useFmea`(upsert 지연생성 + add/update/removePdItem·addNoiseItem, 빈 껍데기 자동 제거). 삭제 연쇄는 `deleteStructureNode`에서 interfaces/layout과 같은 지점 정리. JSON export 자동 포함. **Excel 반영·그래픽 박스 렌더는 후속(Phase B 이후).**
- **소속 노드 맥락(Step 4·5·6, 표시 전용)**: 기능/행이 어느 구조 노드 소속인지 표시. 공통 헬퍼 `structure.ts`(`flattenTree` 트리순서, `structurePathString`, `nodeContextLabel` — System 1개면 노드명, 2+면 `A › B` 경로; 이름 비면 levelLabel 폴백). Step 4 `FailureEditor` 기능 목록을 **노드별 그룹**(헤더=레벨 라벨+소속, 트리순서, 기능 없는 노드 헤더 숨김; dangling은 "(소속 없음)")으로, FE/FC 열 헤더에 선택 FM의 `↳ 소속 · FM` 표기. **1열은 아코디언(인라인 확장)**: 기능 선택 시 그 기능 li 바로 아래에 FM 입력+`◇ Error State 가져오기`+FM 목록을 들여쓰기·연파랑 배경으로 펼치고(한 번에 하나), FE/FC 열(`Column sticky`=`self-start sticky top-2`)은 좌측이 길어져도 시야에 남김(position:sticky라 reduced-motion과 무관). Step 5 `RiskEditor` 리스크 표에 **"구조" 컬럼** 추가(파생·값 불변).
- **리스크 방식 토글 제거**: 툴바의 RPN/AP 선택 컨트롤 삭제 — RPN·AP 두 지표를 **항상 함께 표시**. `meta.riskMethod` 필드는 모델에 **유지**(저장/JSON/Excel 참조 파급 방지, Phase 3 risks[] 제거 때와 같은 이유). AP 안내는 riskMethod 무관 `apEmpty`일 때 항상 노출(임의 AP 생성 금지, 미등록=미설정).
- **개수 배지 표기 통일**(표시 전용): 식별번호로 오독되던 약자+숫자(`FM 1`/`fn 1`/`C 3`)를 **개수 관례 `×n`** 으로 통일 — Step 4 기능 목록(고장모드 수), Step 2 트리·Step 3 기능(연결 기능 수), 다이어그램 블록(Component 수). **0이면 배지 숨김**(미착수 항목 가시화), hover 툴팁으로 전체 설명(HTML `title`/SVG `<title>`). 데이터·로직 불변.
- **Step 5 표 폭·행높이 수정**(표시 전용, 가로 스크롤 금지 — S·D 동시 관찰): `table-fixed`+`<colgroup>`. **레코드당 2줄 구조**: 메인 행 9컬럼(구조 84 / FM 14% / FE 14% / S·O·D 52 / FC=나머지(가장 넓게, 행 구분 기여) / RPN 74 / AP 86), **예방/검출 관리 입력은 관리 sub-row(`colSpan=9`, full-width, 각 `flex-1 basis-64`)로 내려 문장 판독 폭 확보**(입력칸은 읽기전용과 달리 좁으면 못 씀 → 컬럼에서 분리한 근거). 텍스트 셀 `line-clamp-2`+`title`(hover 전문)로 2줄 말줄임→메인 행 높이 균일. 헤더 `th sticky top-0`(스크롤 컨테이너=main 내부 `.overflow-y-auto`), overflow 래퍼 없음. 계산/모델 불변. Step 6 `OptimizationEditor` 행 목록에 `[소속]` 프리픽스.
- **Step 5 레코드 그룹핑·관리↔점수 연결**(표시 전용): 레코드(메인+관리 sub-row)를 한 덩어리로 — 레코드 사이 **굵은 구분선**(메인 tr `border-t-2`, border-collapse:collapse라 렌더됨), 레코드 내부 두 줄은 경계선 없음, **교차 톤**(`bg-white`/`bg-slate-50/70`, 안전행=rose 우선). 관리 sub-row는 `예방관리 → 발생도 O {값}`(sky) / `검출관리 → 검출도 D {값}`(violet) 라벨·현재 점수 칩으로 짝지어 표시(52px O/D 칼럼 밑 정렬은 입력폭상 불가 → 라벨+값칩+좌측 컬러 보더로 대응, `@container @[720px]:grid-cols-2`). 모델·데이터 불변, `structureNodeId`만 읽어 표시.
- **Step 5 카드 보기·배지 통일**(표시 전용, 계산·모델 불변): 표 옆 **"표 보기/카드 보기" 토글**(세션 UI, 저장 안 함) — 표는 비교·우선순위용 유지, 카드는 레코드 1건 세로 전개(전문·말줄임 없음: 헤더=구조경로·FM·⚠안전배지·**완성도 S/O/D n/3**(미기입 주황) → 영향 FE·S → 원인 FC → 예방관리 입력·O → 검출관리 입력·D → 하단 RPN·AP). **색 체계**: S 적/O 주황/D 보라(`DIM_STYLE`), **관리↔점수 같은 색으로 묶음**(예방관리 라벨=주황=O / 검출관리 라벨=보라=D), 관리→점수 인과는 `→` 화살표, 색상만 아닌 라벨·수치 병행(색약). 척도 문구는 `scales`에서 조회(없으면 "기준 미정의"). **RPN·AP를 같은 급 라운드 pill로 통일**(`RpnPill`/`ApPill`, 표·카드 공용): RPN=구간색(≤100 녹/101~200 주황/≥201 적)+막대아이콘(`▁▄█`)+낮음/중간/높음, AP=등급·조치수준 배지(H 적/M 주황/L 녹)+사유 라벨 작은 글씨. **드롭박스 폭**: 표 S/O/D 컬럼 52→76px + `RatingSelect` px-1→px-2(두 자리 "10" 온전, 표·카드 공통). 표 관리 sub-row 예방/O 색도 sky→orange로 통일.
- **Step 6 레이아웃 수정**(표시 전용): 우측 조치 패널이 좌측 목록의 `truncate`(nowrap) min-content에 밀려 찌그러지던 문제 → 외곽을 `grid-cols-[minmax(0,1fr)_400px]`(우측 최소폭 고정, 좌측 나머지) + 좌측 `min-w-0`. **<900px**는 `flex-col` 상하 배치(목록 위·패널 아래). 조치 폼 필드는 **컨테이너 쿼리**(`@container`+`@[360px]:grid-cols-2`)로 패널 폭이 좁으면 1열 전환(도움말 세로 흘러내림·입력 눌림 방지). 행 목록은 2줄화(1줄=`[소속] FM · RPN·AP · 조치뱃지`, 2줄=`FE → FC` 회색 말줄임). 조치 로직·postRPN/AP 불변. **우측 패널 sticky**(≥900px): `min-[900px]:sticky top-4` + `max-h-[calc(100vh-8rem)] overflow-y-auto` — 좌측 목록을 스크롤해도 패널이 화면에 남고, 조치가 많아 패널이 뷰포트를 넘으면 **패널 내부에서 스크롤**(1366×768에서도 조치후 S/O/D·삭제까지 접근). 스크롤 컨테이너=`main`의 overflow-y-auto, 그리드 `items-start`라 우측이 늘어나지 않음.
- **Phase B-1 (P-Diagram → FMEA 연결)** — **출처 포인터 방식**(참조, 텍스트 비미러): `FM.errorStateId?`, `FC.noiseId?`, `FC.preventionControlId?` 전부 nullable·가산. 각자 text가 단일 진실원, 포인터는 출처만 기록. **Pull UI(가져오기, push 없음)**: Step 4 `FailureEditor`에서 FM은 같은 노드 Error State, FC는 같은 노드 Noise 셀렉트(`PdImportSelect.tsx`, text 프리필+포인터), Step 5 `RiskEditor`의 prevention은 같은 노드 Control Factor 셀렉트. **same-node 제약**(cross-node 미룸). 출처는 읽기전용 "◇" 태그. **삭제:** 상류 P-Diagram 항목 삭제 시 `removePdItem`이 인바운드 포인터만 null(FM/FC 생존); 노드 삭제는 same-node라 기존 cascade로 양쪽 정리. `normalizeProject`에 dangling 포인터 null 방어. **미룸(손대지 말 것):** 텍스트 미러·out-of-sync 표시, cross-node, push/양방향, 복수 control, Excel 출처 컬럼.

- **Step 7 품질 점검 1차(조치 관련 3규칙, 순수 계산·저장 안 함)** — AI/API 없음(file:// 단일 파일 유지), 판정=데이터 집계+규칙 적용(문장 생성 아님). 규칙 엔진 `lib/checks.ts`: `runChecks(project, config) → CheckResult[]`(파생, 미저장). 3규칙 — **R1** RPN ≥ 기준선인데 조치 없음(높음), **R2** S=9·10인데 조치 없음(RPN 무관, 높음), **R3** 조치 전/후 S·O·D 동일해 저감 0(중간). "조치 없음"=해당 FC에 optimization 레코드 부재(R1·R2 이중표시 허용). 기준선은 **하드코딩 금지** — `project.checks.rpnActionBaseline`(기본 100, 가산 필드, `factory.ts` `normalizeBaseline` 양수 방어, `useFmea.setRpnBaseline` 양수만) 사용자 편집·프로젝트 저장, **RPN 밴드색 임계(≤100/101~200/≥201)와 분리**. UI=DocumentationView "품질 점검" 섹션(기존 요약 확장): 기준선 입력 + **범위 한 줄**("조치 관련 3개 항목만 자동 점검 — 통과해도 FMEA 전체 품질 보증 아님", 전부통과를 "문제 없음"으로 오독 방지) + 규칙별 카드(높음/중간 뱃지·통과/N건·위반행 label·note·"Step 5로" 단계 점프) + 위반 합계. `CheckItem.target{step,id}`·`category` 1차부터 포함(2차 확장 대비). **검증(file:// 단일 빌드, Playwright)**: Signboard 원본은 S/O/D·조치후값 미입력이라 3항목 전부 **통과**(정상 — 미입력이라 위반 없음, 앱 버그 아님); 위반 검출은 별도 시드(S=10 무조치·RPN240 무조치·저감0)로 R1=2·R2=1·R3=1·합계4 및 기준선 100→300 재판정(R1 통과)·저장복원까지 확인.
- **미룸(손대지 말 것):** Excel 점검 시트·행 하이라이트, 2차 규칙(완결성/척도 정합/현재관리/P-Diagram·추적성).

## 남은 작업
- **Step 7 품질 점검 2차**: 완결성·척도 정합·현재관리·P-Diagram·추적성 규칙 + Excel 점검 시트·행 하이라이트(1차에서 미룸, `CheckCategory`·`CheckItem.target` 자료형은 준비됨).
- **Phase B-2 (인터페이스 → FMEA)**: 인터페이스(노드 쌍)의 실패는 "인터페이스 함수"를 거쳐 기존 FM 파이프라인을 타야 함 → `FunctionItem` 앵커를 노드|인터페이스로 일반화(FunctionEditor·buildRiskRows·structurePath·excel 파급). **침습적이라 분리·후속.**
- **Excel 반영**: P-Diagram·B-1 출처·인터페이스의 Excel 표기(B-2 뒤 별도 꼬리 작업). P-Diagram 그래픽(박스+화살표) 렌더.
- **Phase 5 (CLAUDE 연동)**: 별도 최소 Node/Express 프록시(스택 예외).

## 실사용 현황(실무 데이터)
- **Signboard(전광판, DFMEA) 실데이터 로드됨** — 예시가 아니라 실제 진행 중인 분석. 구조/기능/실패체인(FE·FM·FC)까지 입력됨.
- **Step 5의 O·D 미기입 상태**: 발생도(O)·검출도(D) 미입력이라 RPN/AP 미산출 · 품질 점검 R1/R3도 아직 근거 없음(정상). **다음 실무 작업 = D를 "설계관리(DV) 기준"으로 매기는 것**(DFMEA의 D는 설계검증 강도 — `help.ts` `detection` 팝오버 참조), 이어 O 입력 → RPN/AP·점검 활성화.

## 외부 JSON import 필드명 참조표(교정 전/후)
외부에서 만든 JSON을 불러올 때 스키마와 **키 이름이 달라 조용히 누락/기본값 대체**되던 사례 교정 기록. `normalizeProject`는 아래 "후" 키만 읽는다(누락 필드는 방어적으로 기본값). 임포트용 JSON 작성 시 이 표대로 맞출 것.

| 위치 | 전(외부 흔한 오류) | 후(스키마 정답) | 이유 |
|---|---|---|---|
| 최상위 | `title`, `type`, `riskMethod`(루트) | **`meta:{ title, type, riskMethod }`** | 정규화가 `p.meta`만 읽음 → 래핑 안 하면 기본값 대체 |
| planning | `team:["이름"]`(string[]) | **`team:[{ id, name }]`**(TeamMember[]) | 팀원은 `{id,name}` 객체 |
| functions[] | `structureId` | **`structureNodeId`** | 틀리면 기능이 노드에 안 붙어 Step 3에서 안 보임 |
| optimizations[] | `preventionAction` | **`preventiveAction`** | 오탈자(preventive) |
| optimizations[] | `detectionAction` | **`detectiveAction`** | 오탈자(detective) |
| optimizations[] | `owner` | **`responsibility`** | 담당자 |
| optimizations[] | `dueDate` | **`targetDate`** | 목표일 |
| optimizations[] | `status:"미착수"` | **`status:"open"`** | 라벨 아님·enum(`open`/`in_progress`/`done`) |
| pDiagrams[].noises[] | `category:"aging"` | **`category:"wear"`** | enum(`piece`/`wear`/`usage`/`environment`/`interaction`), `aging` 없음 |
| 최상위 | (documentation 없음) | **`documentation:{ summary:"" }`** | 스키마 완성용 기본값 |

## 미룰 것(명시적 범위 밖 — 요청 전 손대지 말 것)
- 서로 다른 Subsystem의 Component 간 연결, Subsystem↔Component 교차레벨 연결.
- 드래그로 소속 변경(reparent), 3레벨 초과 중첩, 블록 안 미니어처 미리보기.
- 줌/팬/드릴/캔버스크기 상태 저장(전부 세션 UI).
- P-Diagram 자체의 Excel 표기(인터페이스는 Step 2 다이어그램 이미지 시트에 반영됨; P-Diagram 5방향 표기는 후속).

## Step 6에서 Step 5 리스크 상세 조회
- **요약에 현재 관리 텍스트(읽기 전용)**: 전(현재) 요약 하단에 예방관리(O색)·검출관리(D색) 표시. 비면 **"관리 없음"**(앰버) 명시 — 빈칸 금지(관리 부재가 조치 불필요 판단 근거). 데이터 무변경.
- **리스크 행 더블클릭 → Step 5 카드 모달(읽기 전용)**: `RiskCard`에 **`readOnly` 분기 추가**(입력 RatingSelect/CellInput/PdImport 대신 텍스트·배지) 후 `export`해 **Step 5·6이 동일 컴포넌트 재사용**(새로 만들지 않음). 모달=구조·FM·FE·S·FC·예방관리·O·검출관리·D·RPN·AP, 색·배지·척도문구 Step 5와 동일. ESC·바깥클릭·✕로 닫힘, 내부 세로 스크롤. 단일클릭=선택 유지, 더블클릭=모달.
- **"Step 5에서 수정" 링크**: 편집은 한 화면에서만(혼동 방지) — 모달은 조회까지. 링크는 `useFmea.setFocusRow(key)`(세션 UI, 미저장) + `goTo(4)`. RiskEditor는 `focusRow`면 카드 보기로 전환→해당 카드(`id=riskcard-{key}`)로 스크롤+`ring` 강조 후 ~2.6s 뒤 자동 해제.

## Step 6 우측 패널 개선(색·AP 라벨·버튼화)
- **리스크 표시 원자 단일 출처 `components/riskBadges.tsx`** — `SafetyBadge/RpnPill/ApPill/ScoreChip` + 색맵(`DIM_STYLE/BAND_STYLE/AP_STYLE/AP_KO/AP_ACTION`)을 Step 5(`RiskEditor`)에서 추출해 이관. RiskEditor·OptimizationEditor 둘 다 여기서 import(중복 정의 금지 → 두 화면 색·배지 항상 일치). `RiskEditor.ScoreLine`도 `ScoreChip` 재사용. **ApPill은 등급 한글 병기 포함**(`M (중간) · 조치 권고`) — Step 5 표/카드에도 동일 반영.
- **전(현재) 요약 색 적용**: 단색 텍스트 → `ScoreChip`(S 적/O 주황/D 보라, hover=`project.scales` 척도문구=Step5 동일 소스) + `RpnPill`(구간색·아이콘) + `ApPill`(등급+조치수준+apTable 사유 라벨) + 안전행 `SafetyBadge`. 색+수치·라벨 병행.
- **조치 불필요 버튼화**: 상시 표시 제거 → "+ 조치 추가"·"+ 조치 불필요" 나란히. 미검토 행은 버튼만(입력란 없음), "+ 조치 불필요" 클릭 시에만 프리셋 editor 표시(이미 판단 있으면 자동). `OptPanel`은 `key={rowKey}`로 행 전환 시 열림상태 초기화. 데이터·계산 불변.
- **조치 ↔ 조치 불필요 상호 전환**(상호배타 유지, 동시 존재 금지): 버튼 disabled 대신 **클릭 시 전환**. "+ 조치 추가"→판단 자동 해제(확인창 없음, 사유 텍스트 잃음을 위 앰버 안내로 고지) 후 조치 1건 생성. "+ 조치 불필요"→조치 있으면 **확인창**(조치 내용 삭제 경고) 후 그 FC의 opt 전부 제거하고 editor 표시. "판단 취소(미검토)"는 눈에 띄는 아웃라인 버튼으로.
- **배지 정렬**(riskBadges 공통): 공통 크기 상수 `PILL`(`inline-flex items-center px-2 py-0.5 text-xs leading-none`)로 S/O/D·RPN·AP 높이·글자 통일. 요약 행은 `items-center`(좁으면 wrap). RPN 아이콘 `▁▄█`→**`▼◆▲`**(세로 중앙, 앞 여백처럼 안 보임). Step 6 요약은 `ApPill hideLabel` + AP 사유 라벨을 배지 아래 별도 줄로 분리(정렬 유지). Step 5도 동일 반영.

## Step 6 "조치 불필요" 사유 프리셋
- **모델 = `FailureCause.noActionReason?`(optional)** — optimizations 아님. 근거: O/D·현재관리와 같은 FC 귀속이라 정합, optimizations에 넣으면 `hasAction`·`postRPN`·`mergeOptimizations` 오작동. optional·가산이라 계산·정규화 무파급('조치'와 '조치 안 함 판단'을 자료구조로 분리).
- **프리셋 = `project.noActionPresets: string[]`**(편집 데이터, 하드코딩 상수 아님). 기본 6종 seed는 `lib/optimization.ts` `DEFAULT_NO_ACTION_PRESETS`, factory가 프로젝트에 복사·`normalizeProject`가 구버전 누락 시 주입(명시적 빈 배열은 존중). `useFmea.addNoActionPreset/removeNoActionPreset`, UI에서 추가·삭제.
- **UI(OptimizationEditor `NoActionSection`)**: 프리셋 드롭다운 선택 **시에만** `patchCause(fc,{noActionReason})`로 채움(자동 아님) → 이후 textarea 자유 수정, "판단 취소(미검토)"로 제거. **3-state 배지**: 조치 있음(초록 `조치 n`)/조치 불필요(슬레이트)/미검토(앰버) — 빈칸(미검토)과 판단(불필요) 구분.
- **Excel**(컬럼 신설 없음): 불필요 행(조치 레코드 없음+사유)은 **상태='조치 불필요'** + **조치(예방)='조치 불필요: {사유}'**. 미검토 행은 조치 칸 빈칸 유지(구분).
- **점검 연동**: R1(rpnNoAction)은 `noActionReason` 있는 행 **위반 제외**(검토 완료). R2(safetyNoAction)는 **S=9·10 행은 불필요 판단이 있어도 계속 표시**(안전 waive 불가), note에 "조치 불필요 판단 있음 — 재확인 권고" 표기.
- **미룸/후속**: 여러 행 일괄 적용(다중 선택)은 단일 선택뿐이라 방법 확인 후 별도.

## Step 2 다이어그램 블록 정렬(스냅·자동정렬)
- **좌표는 `layout` 위성 필드만 갱신**(도메인 불변). 격자 단일 상수 `lib/diagram.ts` `GRID=20`, `snapToGrid`.
- **스냅 그리드**: 드래그 중 `onMove`에서 `toContent`(getScreenCTM 역변환, 줌 무관)로 content 좌표 얻은 뒤 `snapToGrid` → 화면픽셀 아닌 content 기준 스냅. 어느 배율에서도 격자 배수.
- **자동 정렬 "정렬" 버튼**(툴바, `alignBlocks`): 확인창 후 `alignedPositions(structure, interfaces, drillInto)`를 `setNodePositions`(bulk)로 layout에 병합. 순수 함수는 System 그룹별로 위→아래 스택, 그룹 내부는 **타이디 트리** — 열(x)=인터페이스 from→to 최장경로 깊이(좌우 흐름), 행(y)=리프 순차·부모는 자식 y 평균(분기 상위가 자식들 세로 중앙). 좌표 전부 격자 배수. 최상위=Subsystem 그룹, 드릴=Component 그룹 동일 처리. 순환은 반복 상한으로 방어.
- **미룸/후속**: 다중 선택(Shift+클릭) 기반 부분 정렬(가로/세로/간격 균등)은 3번 — 현재 단일 선택뿐이라 별도 논의.

## Step 2 다이어그램 이름 편집 겹침 수정
- 원인: 편집 시 SVG 이름 `<text>`를 숨기지 않고 그 위에 HTML `<input>`을 겹쳐 뒤 텍스트가 비쳐 보임. 수정: **편집 중(`editing===id`)엔 원래 `<text>` 미렌더**(숨김 아님·조건부 렌더 교체) — 블록 이름·System 헤더 이름·드릴인 Component 모두 같은 메커니즘이라 함께 해결. 입력에 `bg-white` 부여.
- 제스처를 Step 4와 통일: 공용 `NameEditInput`(draft state) — **Enter 저장 / Esc 취소(원복) / blur 저장**, 빈 값은 원문 유지. 이름은 한 줄이라 줄바꿈 없음(기존 live-write→commit-on-save로 바꿔 Esc 원복 지원). 데이터·좌표·연결 로직 불변.
- **인터페이스 라벨 편집은 겹침 없음**(불투명 `bg-white` 팝오버 카드에서 편집, SVG 라벨과 분리) → 손대지 않음.

## Step 4 인라인 편집(FM·FE·FC)
- **더블클릭 → 인라인 편집**(Step 2 노드 이름 편집과 동일 제스처): 공용 `InlineEditor`(FailureEditor 내부, textarea) — **Enter 저장 / Shift+Enter 줄바꿈 / Esc 취소(원복) / blur 저장**, 빈 값은 저장 안 함(원문 유지), 여러 줄 입력. mutator는 `useFmea.setFailureModeText/EffectText/CauseText`(각 `text`만 갱신, **모델 shape·다른 필드·삭제/cascade 무관**).
- **선택 제스처 보존**: 1열 FM은 클릭=선택(FE/FC 열 갱신). 편집은 **텍스트 span 더블클릭으로만** 진입하고, 편집 중엔 select `<button>` 대신 편집기로 교체(textarea의 button 중첩 회피, `stopPropagation`으로 select 전파 차단). FE/FC는 `<li>` 내 span↔textarea 교체(`EditableText`).
- **B-1 출처 포인터와 비미러**: ◇ 출처(Error State→FM / Noise→FC) 있는 항목의 text를 고쳐도 **원본 P-Diagram 항목·포인터 불변**(확정 설계). 편집 시 "◇ 출처와 별개로 저장됩니다(원본 P-Diagram 불변)" 안내 표시, 앱은 원본을 동기화하지 않음.
- **Step 5(예방/검출관리)·Step 6(조치 텍스트 등)는 이미 편집 가능**(input↔`patchCause`/`updateOptimization`) → 손대지 않음.

## 데이터 로드·초기화
- **예시 데이터는 하드코딩 아님**: 앱은 시작 시 `loadProject()`가 `localStorage['fmea:project:v1']`를 읽고, 없으면 `createEmptyProject()`(빈 상태) 반환. 전광판 등은 이전에 그 브라우저에서 JSON을 불러와 저장돼 있을 때만 다시 뜬다(파일이 아니라 브라우저 저장소). src·dist에 Signboard/전광판 문자열 0건.
- **툴바 "새로 시작" 버튼**(`useFmea.newProject`): `createEmptyProject()`로 전 입력 비우고 Step 1로 → 저장 effect가 빈 프로젝트를 localStorage에 덮어써 예시 잔여도 제거. **되돌릴 수 없어 `window.confirm`으로 확인**(먼저 JSON 내보내기 안내). localStorage 키는 그대로 유지(삭제 아님·덮어쓰기).

## 앱 이름·개발자
- **앱 이름 = FMEA_Athena**(구 Jarvis에서 개명). 단일 출처 `lib/app.ts`(`APP_NAME`/`DEVELOPER`) — 화면(Step 7 Documentation 하단 작은 footer)·Excel 표지("작성 도구" 행, FMEA 팀/작성자와 구분되는 라벨)·`index.html` title·`package.json`(name `fmea-athena-christopher`, author)에서 사용.
- **개발자 = Christopher, Lee**.
- **localStorage 키(`fmea:project:v1`/`fmea:ui:v1`)에는 앱 이름 없음 → 개명 시 무변경**(키 바꾸면 기존 저장 데이터 유실). Excel 파일명도 프로젝트명 기준이라 앱 이름과 무관.

## 브랜치
- 개발/푸시: `claude/create-chrisfmea-jarvis-repo-1oka90` (repo `strchrislee-cmd/FMEA_Jarvis_Christopher`). ★ 이 둘의 "jarvis"는 **실제 git 브랜치명·원격 리포명**이라 변경 금지(앱 개명과 별개, 그대로 유지).
