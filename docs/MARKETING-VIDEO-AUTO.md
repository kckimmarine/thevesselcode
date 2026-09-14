# TVC 마케팅 유튜브 — 자동화 제작 가이드

**목표:** 모두의 창업 Q5 + 지속 마케팅용 **친숙·전문** 90초 영상을 최소 수작업으로 제작.

## 0. 창업자 PC (Windows PowerShell)

```powershell
cd C:\path\to\thevesselcode
git pull origin master
npx playwright install chromium
$env:BASE_URL="https://www.thevesselcode.com"; npm run marketing:video-assets
```

CapCut → **가져오기** → `thevesselcode\artifacts\marketing-video\clips\` 폴더.

### Cursor Cloud Agent에서 받을 때 (Edge가 HTML+폴더로 저장되는 경우)

에이전트 채팅/미리보기에서 `artifacts/marketing-video/` **폴더 링크를 클릭**하면 Microsoft Edge가 **「웹 페이지, 전체」** 로 저장해 `…_Cursor.html` + `_files` 안에 `.js.download` 만 생길 수 있습니다. **개별 `.webm` 이 아닙니다.**

**해결:**

1. 에이전트 실행 후 **`marketing-video-assets.zip` 한 파일만** 다운로드 (아티팩트 패널 또는 로그에 표시된 ZIP 경로).
2. PC에서 ZIP 압축 해제 → `marketing-video/clips/*.webm` 을 CapCut에 가져오기.
3. 또는 **로컬에서** 위 PowerShell 명령을 실행하면 `thevesselcode\artifacts\marketing-video\` 에 파일이 직접 생성됩니다 (가장 확실).

이미 녹화만 했다면 ZIP만 다시 만들기: `npm run marketing:video-assets:zip`

## 1. 자동 생성 (Cursor / CI)

```bash
npm start   # 터미널 1
node scripts/generate-marketing-video-assets.mjs
```

프로덕션 촬영:

```bash
BASE_URL=https://www.thevesselcode.com node scripts/generate-marketing-video-assets.mjs
```

**출력** (`artifacts/marketing-video/`):

| 파일 | 용도 |
|------|------|
| `narration-ko.txt` | CapCut AI 음성 / 성우 대본 |
| `subtitles-ko.srt` | 자막 import |
| `scenes.json` | 씬 타임라인 |
| `clips/home-desktop.webm` … `toolkit-mobile.webm` | Playwright 녹화 (PC·모바일, 고정 파일명) |
| `marketing-video-assets.zip` | 위 파일 전체 (CapCut·다운로드용) |

`SKIP_RECORD=1` — 대본·SRT·ZIP만 (클립은 기존 `clips/` 사용).

## 2. 편집 (CapCut 권장)

1. **1막 (45초):** 네이비 배경 `#0a101e` + `subtitles-ko.srt` 타이밍에 맞춰 다이어그램 스티커 (ZIP, ECR/CCR/Hub/HQ).
2. **2막 (45초):** `clips/sm-desktop.webm` + `sm-mobile.webm` 교차 — **KO 토글** 상태로 녹화됨.
3. **BGM:** 저볼륨 corporate ambient (저작권-free).
4. **엔딩:** 로고 + `thevesselcode.com` 5초.

## 3. 하이브리드 콘티 (상세)

`docs/EXPORT-q5-hybrid-conti-for-gemini.md`

## 4. 앱 실화면 (선택 15초)

`engineer` / Engine / `npm start` → PMS·SPARE·Menu → Data Export & Import (별도 OBS 30초).

## 5. YouTube

- 제목: `더베슬코드(TVC-SM) — 오프라인 정비·육상 SM·Maritime Toolkit`
- 공개: **일부 공개 (Unlisted)**
- 설명: modoo 2차 + 링크 3종 (/, /sm, /toolkit)
