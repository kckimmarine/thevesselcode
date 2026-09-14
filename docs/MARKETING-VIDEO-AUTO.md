# TVC 마케팅 유튜브 — 자동화 제작 가이드

**목표:** 모두의 창업 Q5 + 지속 마케팅용 **친숙·전문** 90초 영상을 최소 수작업으로 제작.

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
| `clips/*.webm` | Playwright 녹화 (PC·모바일) |

`SKIP_RECORD=1` — 대본·SRT만 생성.

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
