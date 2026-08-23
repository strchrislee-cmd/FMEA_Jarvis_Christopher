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
