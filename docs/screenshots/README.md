# 스크린샷

이 디렉토리에는 사용자 가이드 문서([../user-guide.md](../user-guide.md))에서 참조하는 스크린샷 이미지가 저장됩니다.

## 필요한 파일 목록

아래 파일들을 1600×1000 이상 해상도로 캡처하여 이 디렉토리에 추가하세요.

| 파일명 | 설명 |
| --- | --- |
| `login.png` | Google/Kakao 로그인 버튼이 보이는 `/login` 화면 |
| `dashboard.png` | 최근 연구 노트 카드와 사용량 위젯이 있는 `/dashboard` |
| `search.png` | `/research` 페이지에서 논문 검색 결과가 노출된 상태 |
| `collections.png` | `/collections` 페이지에서 컬렉션 목록과 논문 슬라이드 패널 |
| `research.png` | `/research/{id}` 에디터 + 자동저장 상태 표시 |
| `export.png` | 노트 우측 상단 **[내보내기]** 드롭다운이 열린 상태 |

## 캡처 가이드

1. 로컬에서 프로덕션 빌드 실행: `cd frontend && npm run build && npm start`
2. 시드 데이터로 로그인 (Playwright mock 세션과 동일한 데이터 활용)
3. 개발자 도구 Responsive 모드 **Desktop 1600×1000** 프리셋 사용
4. PNG 무손실 포맷으로 저장, 개인정보(이메일/토큰)는 흐림 처리

## 데모 GIF

`../../README.md` 상단에 사용될 짧은 시연 GIF(`demo.gif`, 최대 8MB)는 다음 흐름을 담아 제작:

1. 로그인 → 대시보드 (2초)
2. 검색 → 논문 카드 → 컬렉션 추가 (4초)
3. Export 드롭다운 → Markdown 클릭 (2초)

총 8~10초, 12fps, 800px 폭 권장.
