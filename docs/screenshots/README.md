# 스크린샷

이 디렉토리에는 [사용자 가이드](../user-guide.md)에서 참조하는 스크린샷 이미지가 저장됩니다.

## 필요한 파일 목록

아래 파일들을 **1600x1000** 이상 해상도로 캡처하여 이 디렉토리에 추가하세요.

| 파일명 | 페이지/경로 | 설명 |
| --- | --- | --- |
| `login.png` | `/login` | Google/Kakao 로그인 버튼이 보이는 화면 |
| `dashboard.png` | `/dashboard` | 최근 연구 노트 카드, 사용량 위젯 |
| `search.png` | `/research` | 논문 검색 결과가 노출된 상태 |
| `collections.png` | `/collections` | 컬렉션 목록 + 논문 슬라이드 패널 |
| `research.png` | `/research/{id}` | 에디터 + 자동저장 상태 표시 |
| `export.png` | `/research/{id}` | **[내보내기]** 드롭다운이 열린 상태 |
| `settings.png` | `/settings` | 프로필·구독·로그아웃 섹션 |
| `versions.png` | `/research/{id}` | 버전 히스토리 패널 또는 diff 뷰 |
| `survey.png` | `/survey` | 설문 생성 폼 + 생성된 문항 목록 |
| `billing.png` | `/billing` | 플랜 비교 카드 + 업그레이드 버튼 |

## 캡처 가이드

### 1. 환경 준비

```bash
cd frontend
npm run build && npm start
# 또는 개발 모드: npm run dev
```

### 2. 시드 데이터

```bash
# 루트에서
make seed
```

Playwright mock 세션과 동일한 테스트 계정(`test@example.com`)을 사용하면 일관된 스크린샷을 얻을 수 있습니다.

### 3. 캡처 방법

| 항목 | 권장값 |
| --- | --- |
| 뷰포트 | Desktop 1600x1000 (DevTools → Responsive) |
| 포맷 | PNG (무손실) |
| 다크모드 | 라이트/다크 각 1장 촬영 권장 (라이트 우선) |
| 개인정보 | 이메일·토큰 등은 흐림 처리 |

**Playwright 자동 캡처 스니펫** (선택):

```typescript
// e2e 내에서 스크린샷 자동 저장
await page.goto('/dashboard');
await page.screenshot({ path: 'docs/screenshots/dashboard.png', fullPage: true });
```

### 4. 최적화

```bash
# pngquant으로 파일 크기 축소 (lossy 80%)
pngquant --quality=65-80 --ext .png --force docs/screenshots/*.png
```

## 데모 GIF

`../../README.md` 상단에 사용될 시연 GIF (`demo.gif`, 최대 8MB):

### 녹화 흐름 (총 8~10초)

1. 로그인 화면 → 대시보드 진입 (2초)
2. 검색 → 논문 카드 → 컬렉션 추가 (4초)
3. Export 드롭다운 → Markdown 클릭 → 완료 토스트 (2초)

### 제작 가이드

```bash
# ffmpeg로 mp4 → gif 변환
ffmpeg -i demo.mp4 -vf "fps=12,scale=800:-1:flags=lanczos" \
  -gifflags +transdiff demo.gif

# 또는 gifski (더 작은 파일)
gifski --fps 12 --width 800 -o demo.gif demo.mp4
```

| 항목 | 권장값 |
| --- | --- |
| FPS | 12 |
| 폭 | 800px |
| 최대 크기 | 8MB |
| 포맷 | GIF (gifski 권장) |
