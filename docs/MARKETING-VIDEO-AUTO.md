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

### Cursor Artifacts에서 파일이 안 받아질 때

**흔한 증상**

- Artifacts 목록에서 **우클릭 → 다운로드**가 없거나 동작하지 않음
- 링크를 Edge로 열면 **`…_Cursor.html` + `_files`** (`.js.download`만) — **WebM이 아님**

**권장 순서 (확실한 방법)**

| 방법 | 설명 |
|------|------|
| **1. 로컬 PC** | 위 §0 PowerShell 4줄 → `thevesselcode\artifacts\marketing-video\` 에 바로 생성 (**가장 확실**) |
| **2. GitHub Actions** | `master`에 워크플로 병합 후: [Actions → **Marketing video assets** → **Run workflow**](https://github.com/kckimmarine/thevesselcode/actions/workflows/marketing-video-assets.yml) → 완료된 Run 하단 **Artifacts → marketing-video-assets** → **Download** (ZIP) |
| **3. GitHub CLI** | `gh run download -n marketing-video-assets` (최근 성공 Run, [gh](https://cli.github.com/) 설치·로그인 필요) |

Cursor Artifacts 패널은 브라우저·버전에 따라 **개별 파일 다운로드가 지원되지 않는 경우**가 있습니다. CapCut용 클립은 **로컬 생성** 또는 **Actions ZIP**을 쓰세요.

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
