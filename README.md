# FMEA_Athena_Christopher
Chris가 FMEA를 쉽고 빠르게 수행할 수 있도록 도움주는 헬퍼 (개발: Christopher, Lee)

DFMEA/PFMEA를 AIAG-VDA 7단계로 안내하고, 각 단계 입력을 받아 AIAG-VDA 표준
양식의 Excel(.xlsx)로 내보내는 로컬 웹앱입니다. (Vite + React + TypeScript + Tailwind)

## 개발

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
```

## 단일 HTML 파일 (Node 없이 실행)

`npm run build`는 JS/CSS를 전부 인라인해 **`dist/index.html` 한 개**만 생성합니다.
Node/서버가 없는 PC에서도 이 파일 하나를 복사한 뒤 브라우저에서 `file://`로
더블클릭해 열면 앱이 그대로 동작합니다.

- 저장: 브라우저 `localStorage` 자동 저장
- 데이터 이동: 상단 JSON 내보내기/불러오기
- 결과물: Step 7에서 Excel(.xlsx) 내보내기
- 권장 브라우저: Chrome / Edge (`file://` 다운로드·localStorage 동작 확인됨)
