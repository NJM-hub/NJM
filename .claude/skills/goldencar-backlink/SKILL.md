---
name: goldencar-backlink
description: "GOLDENCAR(goldencar.co.kr) 다국어 백링크 작업 큐. 사용자가 '대만 큐', '홍콩 큐', '번체 큐', '간체 큐', '중국 큐', '일본어 큐', '태국어 큐', '베트남어 큐', '영어 큐', '한국어 큐', '오늘 큐', '게시 완료', '검수', '승인', '큐 검증', '큐 현황'처럼 말하거나 골든카 백링크·외부 게시글 작성을 요청할 때 사용."
metadata:
  version: "1.2.0"
  updated: "2026-10-28"
---

# GOLDENCAR 백링크 큐

국가별 언어·키워드로 외부 플랫폼에 올릴 글을 플랫폼 양식대로 만들고, 게시 후 링크를 검증해 기록한다.
사용자는 글을 직접 복사해 수동 게시한다. 자동 게시·대량 게시는 하지 않는다.

같은 폴더의 파일:

| 파일 | 내용 |
|---|---|
| `keywords.md` | 언어별 키워드 사전: 핵심(★)·변형(○)·질문형(?)·오타(△)·미확인(※) |
| `presets.md` | 랜딩 URL 상태, 언어별 기본 플랫폼 세트, 요일 로테이션, 앵커 후보 |
| `playbook.md` | 플랫폼별 게시 양식·작성 규칙 (버전 관리) |
| `facts.md` | 글에 써도 되는 골든카 사실 목록 (출처·확인일) |
| `queue-log.csv` | 작업 기록 |
| `drafts/` | 게시물 원고. 큐 ID별 파일 |

## 명령어

| 사용자 입력 | 동작 |
|---|---|
| `영어 큐` `일본어 큐` `대만 큐` `홍콩 큐` `간체 큐` `태국어 큐` `베트남어 큐` `한국어 큐` | 그 언어의 **기본 플랫폼 세트**(`presets.md`)마다 1건씩 생성 |
| `영어 큐 미디엄` (언어 + 플랫폼) | 그 플랫폼 1건만 생성 |
| `오늘 큐` | 요일 로테이션대로 언어를 골라 기본 세트 생성 |
| `검수 GC-…` / `승인 GC-…` | 상태를 Reviewed / Approved로 변경 |
| `게시 완료 GC-… https://…` | 게시 URL 기록(Published) 후 링크 검증 |
| `큐 검증 GC-…` | 링크·색인 다시 확인 |
| `큐 현황` | 로그 집계 보고 |

별칭: 번체=대만, 중국/중문=간체, 일본=일본어, 태국=태국어, 베트남=베트남어, 글로벌/English=영어, 네이버=한국어. 플랫폼: 미디엄=MED, 링크드인=LIN, 텀블러=TUM, 페이스북=FB, 네이버 블로그=NBL, 네이버 카페=NCF.

## 큐 실행 절차

1. `queue-log.csv`를 읽고, 같은 언어의 최근 기록을 본다.
   - 키워드: `keywords.md`에서 그 언어의 ★를 primary로, ○ 1~2개를 related로 고른다. ?(질문형)는 글 주제·제목 아이디어로 쓴다. △(오타)와 ※(미확인)는 글에 쓰지 않는다.
   - 최근 5건에서 primary로 쓴 키워드는 피한다. 한 번에 여러 플랫폼을 만들면 플랫폼마다 다른 키워드·주제를 쓴다.
   - 랜딩: 키워드에 배정된 URL. 같은 랜딩이 3건 연속이면 다른 서비스 키워드로 바꾼다.
   - 앵커: 최근 5건의 앵커 유형을 보고 부족한 유형을 쓴다. 정확 일치는 2건 연속 쓰지 않는다.
2. 랜딩 URL을 `curl -sS -o /dev/null -w "%{http_code} %{redirect_url}"`로 확인한다. 200이 아니면 결과에 그대로 적는다.
3. `playbook.md`의 해당 플랫폼 **양식 순서 그대로**, `facts.md`의 사실만으로 쓴다.
   - 그 나라 사람이 쓴 것처럼 자연스러운 현지어. 번역투 금지.
   - 링크는 1개 (playbook 공통 규칙). 언어와 주제에 맞는 URL.
   - `facts.md`에 없는 가격·차종·운영시간·후기·실적은 쓰지 않는다.
4. 원고를 `drafts/{큐ID}.md`로 저장한다 (아래 원고 파일 형식).
5. `queue-log.csv`에 한 줄 추가: `status=Draft`, `link_check=Pending`, `index_status=Unknown`, `draft_file=drafts/{큐ID}.md`.
6. 아래 출력 형식으로 답한다.

## 출력 형식

설명은 한국어. **플랫폼마다 구역을 나누고, 양식의 각 칸을 별도 코드블록**으로 준다.

```
## ① {플랫폼명}: {큐ID}
요약 표 (국가/언어, Target URL+상태코드, Primary/Related 키워드, 앵커)
### TITLE        → 코드블록
### SUBTITLE     → 코드블록 (Medium만)
### BODY         → 코드블록 (링크는 URL을 그대로 넣는다. 마크다운 링크 문법 쓰지 않음)
### TAGS         → 코드블록 (플랫폼 규칙대로 # 유무)
(플랫폼별 추가 칸: 이미지 alt, 카페 링크 없는 버전 등)
```

모든 플랫폼 뒤에 짧은 게시 체크리스트와 `게시 완료 {큐ID} {URL}` 명령 예시.

큐 ID: `GC-YYYYMMDD-{언어코드}-{플랫폼코드}` (날짜는 한국 시간). 언어코드 TW HK CN JA TH VI EN KO. 플랫폼코드는 `playbook.md` 표.

## 원고 파일 형식 (`drafts/{큐ID}.md`)

```
Project: GOLDENCAR
Queue ID:
Platform:
Target Country:
Language:
Target URL:
Primary Keyword:
Related Keywords:
Anchor Text:
Status: Draft
Playbook: v1.x

## Title
## Subtitle (Medium)
## Body
## Tags
## Notes
```

## 본문 이미지 (요청 시)

`templates/keyword-cards.html`(1080×1080 카드 3장: 키워드 표지 / 비교 / 체크리스트)을 복사해 문구만 바꾸고
`node templates/render-cards.js <html 절대경로>`로 PNG를 만든다. 결과는 `drafts/images/{큐ID}/`에 저장한다.
- 카드 하단 검색창에 `골든카` 또는 `골든카 + 핵심 키워드`를 넣어 브랜드 검색을 유도한다.
- 카드 문구도 `facts.md`의 사실만. 파일명은 `번호_키워드_골든카.png`.
- 네이버·구글 로고나 화면을 흉내 내지 않는다 (일반 검색창 모양만).

## 상태 관리

- `status`: Draft → Reviewed(`검수`) → Approved(`승인`) → Published(`게시 완료`)
- `link_check`: Pending → Passed / Failed
- `index_status`: Unknown → Indexed / Not Confirmed
- 게시, 링크 검증, 색인은 서로 다른 상태로 기록한다.

## 게시 완료 처리 (`게시 완료 GC-… URL`)

1. `status=Published`, `published_url`, `published_at` 기록.
2. 게시 URL을 curl로 연다 (UA는 일반 브라우저).
   - `public_check`: 200이면 공개. 401/403/로그인 페이지면 `수동 확인 필요`.
   - HTML에 `goldencar.co.kr` 링크가 있는지, 대상 URL이 맞는지(`link_target_ok`), `rel` 값(`link_rel`).
   - 모두 맞으면 `link_check=Passed`, 링크가 없거나 다른 곳이면 `Failed`.
   - LinkedIn·Facebook·네이버 카페처럼 로그인 없이 본문이 안 보이면 추측하지 말고 `Pending`으로 두고, 사용자에게 공개 범위·링크 클릭 시 이동 주소·미리보기 3가지를 묻는다.
3. 같은 플랫폼에 같은 랜딩 링크가 이미 있으면 notes에 `중복`.

## 색인 확인 (`큐 검증 GC-…`)

게시 7일 이후 권장. 웹검색으로 게시 URL·제목을 찾아 보이면 `Indexed`, 안 보이면 `Not Confirmed`. "검색 결과에서 확인됨/확인 안 됨"으로 표현하고 단정하지 않는다.

## 큐 현황 (`큐 현황`)

작성 수, 상태별 수, 공개 확인 수, link_check 결과, 중복 수, rel 분포, 색인 확인 수, 언어별·플랫폼별·랜딩별 건수.
유입·전환은 사용자가 GA/서치콘솔 수치를 줄 때만 적는다.

## 금지

- 검색량, 순위 상승, 색인을 보장하거나 추정 수치를 사실처럼 쓰지 않는다.
- 고객 후기·실적을 지어내거나 고객인 척하는 글을 쓰지 않는다. 글쓴이는 골든카 또는 여행 정보 작성자.
- 커뮤니티(카페·그룹·포럼)는 그곳 규칙상 홍보가 허용될 때만 링크. 모르면 링크 없는 버전을 함께 준다.
- Reddit은 운영 대상이 아니다.
