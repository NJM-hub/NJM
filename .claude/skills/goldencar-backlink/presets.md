# 언어별 프리셋

키워드는 초기 후보다. 검색량은 확인되지 않았다. 서치콘솔·키워드 도구 데이터가 생기면 우선순위를 바꾼다.

## 랜딩 페이지 (2026-10-28 확인)

| 서비스 | 경로 | 상태 |
|---|---|---|
| 공항 픽업·샌딩 | `/{locale}/airport` | 200. 단 canonical이 `/{locale}`로 잘못됨 (개발 수정 대기). `/en/airport`는 307 → `/airport` |
| 프라이빗 투어 | `/{locale}/tour` | 200. 상품 목록이 HTML에 안 나옴 (개발 수정 대기) |
| 프리미엄 기사·의전 | `/{locale}/protocol` | 200 |
| 렌터카 | `/{locale}/rentcar` | 200 |
| 홈 (브랜드) | `/{locale}` | 200 |
| 서울 프라이빗 차량 (기사 포함 대절) | 없음 | **신규 페이지 제안**. 생기기 전까지 `/protocol`로 보내고 notes에 `임시 랜딩` 표시 |

`{locale}`: TW=`zh-TW`, HK=`zh-HK`, CN=`zh-CN`, JA=`ja`, TH=`th`, VI=`vi`, EN=`en`.
개발 수정 후에도 위 경로는 그대로 쓴다 (백링크 주소는 바꾸지 않는다).

## 요일 로테이션 (`오늘 큐`)

1단계 (초기 4주): 번체 중국어 + 영어 우선

| 월 | 화 | 수 | 목 | 금 |
|---|---|---|---|---|
| 대만 TW | 영어 EN | 홍콩 HK | 영어 EN | 일본어 JA |

2단계 (5주차부터, 데이터 보고 조정)

| 월 | 화 | 수 | 목 | 금 |
|---|---|---|---|---|
| 번체 TW/HK 교대 | 영어 EN | 일본어 JA | 간체 CN | 태국어 TH / 베트남어 VI 교대 |

## 언어별 프리셋

각 키워드 옆 `→` 는 랜딩 경로.

### TW 대만 — 번체 (`/zh-TW`)
- 플랫폼: Medium, Facebook, Blogger, PIXNET(검증 필요)
- 공항: 仁川機場接送 →airport · 韓國機場接送 →airport · 首爾機場接送 →airport · 金浦機場接送 →airport
- 투어: 首爾包車一日遊 →tour · 韓國私人包車旅遊 →tour
- 대절: 韓國包車 →protocol(임시) · 首爾包車 →protocol(임시) · 韓國保母車 →protocol(임시)
- 일반 앵커: 查看詳情 · 預約資訊 · 了解更多

### HK 홍콩 — 번체 (`/zh-HK`)
- 플랫폼: Facebook, Medium, Blogger
- 공항: 仁川機場接送機 →airport · 韓國機場接送 →airport · 首爾機場接送 →airport
- 투어: 首爾包車一日遊 →tour · 韓國私人包車旅遊 →tour
- 대절: 首爾包車連司機 →protocol(임시) · 韓國包車 →protocol(임시) · 韓國七人車 →protocol(임시)
- 일반 앵커: 詳情按此 · 了解更多 · 預約資料

### CN 중국 본토 — 간체 (`/zh-CN`)
- 플랫폼: Medium, Blogger, Facebook (중국 본토 사용자는 Google·Facebook 접근이 막혀 있어 해외 체류 화교·유학생 대상이 됨)
- 공항: 仁川机场接送 →airport · 韩国机场接送 →airport · 韩国机场专车 →airport · 仁川机场接机 →airport
- 투어: 首尔包车一日游 →tour · 韩国私人定制游 →tour
- 대절: 首尔包车 →protocol(임시) · 韩国包车 →protocol(임시)
- 일반 앵커: 查看详情 · 了解更多 · 预约信息
- 참고: 본토 유입의 주 채널은 小红书(샤오훙수)지만 외부 링크가 클릭되지 않아 백링크 큐 대상이 아니다. 별도 브랜드 노출 작업으로 분리.

### JA 일본어 (`/ja`)
- 플랫폼: note(검증 필요), Hatena Blog(검증 필요), Medium, Tumblr
- 공항: 仁川空港 送迎 →airport · 韓国 空港送迎 →airport · ソウル 空港送迎 →airport · 金浦空港 送迎 →airport
- 투어: ソウル 貸切ツアー →tour · 韓国 プライベートツアー →tour
- 대절: 韓国 貸切チャーター →protocol(임시) · ソウル 貸切チャーター →protocol(임시) · ソウル ハイヤー →protocol
- 일반 앵커: 詳しくはこちら · 予約ページ · 公式サイト

### TH 태국어 (`/th`)
- 플랫폼: Facebook, Blogger, Pinterest(검증 필요)
- 공항: รถรับส่งสนามบินอินชอน →airport · รถรับส่งสนามบินเกาหลี →airport
- 투어: ทัวร์ส่วนตัวโซล →tour · ทัวร์เกาหลีแบบส่วนตัว →tour
- 대절: รถเช่าพร้อมคนขับเกาหลี →protocol(임시) · เช่ารถตู้พร้อมคนขับ เกาหลี →protocol(임시)
- 일반 앵커: ดูรายละเอียด · จองได้ที่นี่ · ข้อมูลเพิ่มเติม

### VI 베트남어 (`/vi`)
- 플랫폼: Facebook, Blogger, Medium
- 공항: đưa đón sân bay Incheon →airport · đưa đón sân bay Hàn Quốc →airport
- 투어: tour Seoul 1 ngày →tour · tour riêng Hàn Quốc →tour
- 대절: thuê xe có tài xế ở Hàn Quốc →protocol(임시) · thuê xe có tài xế Seoul →protocol(임시) · xe Limousine Hàn Quốc →protocol(임시)
- 일반 앵커: xem chi tiết · đặt xe tại đây · tìm hiểu thêm

### EN 영어 (`/en`)
- 플랫폼: LinkedIn, Medium, Tumblr, Blogger, Pinterest(검증 필요)
- 공항: Incheon airport transfer →airport · Seoul airport transfer →airport · Korea airport transfer →airport · Incheon airport to Seoul →airport
- 투어: private Seoul day tour →tour
- 대절: private car service Seoul →protocol(임시) · private driver in South Korea →protocol(임시)
- 의전: chauffeur service Seoul →protocol
- 렌터카: car rental Seoul →rentcar
- 일반 앵커: learn more · booking details · GoldenCar website

## 앵커 유형

| 유형 | 예 |
|---|---|
| 브랜드 | GoldenCar · GOLDENCAR · 골든카 |
| URL | `https://goldencar.co.kr/{locale}/airport` |
| 일반 | 위 언어별 일반 앵커 |
| 부분 일치 | 키워드 + 수식어. 예: 仁川機場接送服務推薦 · Incheon airport transfer options |
| 정확 일치 | 키워드 그대로 |

비율을 기계적으로 맞추지 않는다. 최근 기록을 보고 브랜드·URL·일반 앵커가 전체의 절반 이상이 되도록 자연스럽게 섞는다.
