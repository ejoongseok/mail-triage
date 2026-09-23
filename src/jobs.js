/**
 * 직군별 역할 문장 템플릿.
 *
 * 직군 이름이 아니라 **그 사람이 메일에서 무엇을 기다리는가** 를 적는다. 모델은 이 문장으로
 * "이 메일이 이 사람에게 행동을 요구하는가" 를 판정하므로, 직함보다 관심사가 중요하다.
 *
 * 이 문장은 번역물이 아니라 판정 입력이다. 어색하게 옮기면 그 언어 사용자의 판정 품질이
 * 그대로 나빠진다. 검증할 수 없는 언어는 추가하지 않는다.
 */

const NMT_JOBS_BY_LANG = {
  ko: [
    {
      group: '경영과 리더십',
      items: [
        ['대표와 CEO', '대표. 결재와 승인 요청, 계약과 투자 관련 연락, 외부 미팅 요청, 임원 보고, 주요 고객사 이슈를 챙긴다. 영업과 홍보 제안이 많이 들어오는데 대부분 급하지 않다.'],
        ['스타트업 창업자', '스타트업 대표. 투자자 연락과 IR, 계약과 법무 검토, 채용, 고객사 이슈, 정부지원 공고 마감을 챙긴다. 영업 제안과 뉴스레터가 많이 들어온다.'],
        ['CTO와 기술총괄', '기술 총괄. 기술 의사결정과 아키텍처 논의, 채용과 팀 이슈, 벤더 계약과 라이선스 갱신, 장애 보고와 보안 공지를 챙긴다.'],
        ['임원과 본부장', '본부 임원. 결재와 승인 요청, 부서 보고와 실적 자료, 예산과 인력 계획, 임원 회의 일정, 대외 협력 건을 챙긴다.'],
        ['팀장과 매니저', '팀장. 팀원의 요청과 승인 건, 일정 조율, 상위 보고 요청, 채용과 평가, 타 부서 협조 요청을 챙긴다.'],
        ['프로젝트 관리자', '프로젝트 관리자. 일정 지연과 리스크 보고, 산출물 검토 요청, 이해관계자 회의, 계약과 정산 일정을 챙긴다.'],
      ],
    },
    {
      group: '개발',
      items: [
        ['서버와 백엔드 개발', '서버 개발자. 배포와 장애 대응, 코드 리뷰 요청, API 연동 문의, 인프라 비용 알림을 챙긴다.'],
        ['프론트엔드 개발', '프론트엔드 개발자. 배포와 버그 리포트, 디자인 전달과 리뷰 요청, 브라우저 호환 이슈를 챙긴다.'],
        ['모바일 앱 개발', '모바일 앱 개발자. 스토어 심사와 배포, 크래시 리포트, 디자인 전달과 리뷰 요청을 챙긴다.'],
        ['데이터 엔지니어', '데이터 엔지니어. 파이프라인 실패 알림과 데이터 요청, 스키마 변경 협의, 비용 알림을 챙긴다.'],
        ['머신러닝과 AI', '머신러닝 엔지니어. 실험 결과 공유와 모델 배포, 데이터 요청, 논문과 기술 동향을 챙긴다.'],
        ['DevOps와 인프라', '인프라 담당자. 장애와 알럿, 보안 패치 공지, 클라우드 비용과 계약, 접근 권한 요청을 챙긴다.'],
        ['QA와 테스트', 'QA 담당자. 테스트 요청과 릴리스 일정, 버그 재현 문의, 배포 승인 요청을 챙긴다.'],
        ['보안', '보안 담당자. 취약점 제보와 보안 공지, 감사와 인증 일정, 접근 권한 승인 요청을 챙긴다.'],
        ['개발 팀 리드', '개발 팀 리드. 팀원 일정과 승인 요청, 외주와 벤더 관리, 고객사 납품, 장애 보고를 챙긴다.'],
        ['SI와 고객사 상주', 'SI 개발자. 고객사 요구사항 변경과 검수 요청, 현장 이슈와 장애, 산출물 제출 기한, 본사 보고 요청을 챙긴다. 고객사와 본사 양쪽에서 연락이 온다.'],
        ['기술 지원과 운영', '기술 지원 담당자. 사용자 문의와 장애 신고, 긴급 조치 요청, 정기 점검 일정, 이관과 인수인계 건을 챙긴다.'],
      ],
    },
    {
      group: '기획과 비즈니스',
      items: [
        ['서비스 기획과 PM', '서비스 기획자. 일정 조율과 우선순위 결정, 스펙 합의 요청, 릴리스 공지, 이해관계자 보고를 챙긴다.'],
        ['프로덕트 오너', '프로덕트 오너. 요구사항 확정 요청과 우선순위 결정, 지표 보고, 고객 피드백을 챙긴다.'],
        ['사업개발과 제휴', '사업개발 담당자. 제휴 제안과 계약 협의, 미팅 일정, 견적과 정산 문의를 챙긴다.'],
        ['전략과 경영기획', '경영기획 담당자. 보고 자료 요청과 일정, 예산과 결재, 임원 회의 준비를 챙긴다.'],
        ['솔루션 컨설팅과 제안', '솔루션 컨설턴트. 제안 요청과 입찰 공고 마감, 고객사 실무 협의, 제안서 검토 요청, 데모와 PoC 일정을 챙긴다.'],
        ['데이터 분석', '데이터 분석가. 분석 요청과 지표 문의, 리포트 공유 일정, 데이터 접근 권한을 챙긴다.'],
      ],
    },
    {
      group: '디자인',
      items: [
        ['프로덕트와 UX 디자인', '프로덕트 디자이너. 디자인 리뷰 요청과 피드백, 개발 전달 일정, 리서치 참여 요청을 챙긴다.'],
        ['브랜드와 그래픽 디자인', '브랜드 디자이너. 제작 요청과 마감 일정, 시안 피드백, 외주와 인쇄 발주를 챙긴다.'],
      ],
    },
    {
      group: '마케팅과 영업',
      items: [
        ['퍼포먼스 마케팅', '퍼포먼스 마케터. 광고 성과 리포트와 예산 승인, 매체 담당자 문의, 소재 제작 요청을 챙긴다.'],
        ['콘텐츠와 브랜드 마케팅', '콘텐츠 마케터. 원고 마감과 검수 요청, 제휴 문의, 발행 일정 조율을 챙긴다.'],
        ['B2B 영업', 'B2B 영업 담당자. 고객 문의와 견적 요청, 계약과 갱신 일정, 방문 약속을 챙긴다.'],
        ['영업 관리와 채널', '영업 관리 담당자. 대리점과 파트너 문의, 실적 보고 요청, 단가와 계약 조건 협의, 프로모션 일정을 챙긴다.'],
        ['고객 지원', '고객 지원 담당자. 고객 문의와 장애 신고, 처리 기한이 있는 요청, 내부 에스컬레이션을 챙긴다.'],
      ],
    },
    {
      group: '경영지원',
      items: [
        ['인사와 채용', '인사 담당자. 지원자 면접 일정과 처우 협의, 입퇴사 절차, 구성원 요청과 증명서 발급을 챙긴다.'],
        ['재무와 회계', '재무 담당자. 세금계산서와 정산 요청, 결재와 지출 승인, 마감 일정을 챙긴다.'],
        ['총무와 법무', '총무 담당자. 계약서 검토 요청과 서명, 비품과 시설 요청, 보험과 갱신 일정을 챙긴다.'],
      ],
    },
    {
      group: '기타',
      items: [
        ['제조와 생산 관리', '생산 관리 담당자. 발주와 납기 조율, 품질 이슈와 불량 통보, 자재 입고 지연, 설비 점검 일정을 챙긴다.'],
        ['구매와 물류', '구매 담당자. 견적 요청과 회신, 발주 승인, 입고와 배송 지연 통보, 단가 협의와 계약 갱신을 챙긴다.'],
        ['프리랜서와 1인 사업', '프리랜서. 클라이언트 문의와 견적 요청, 마감 일정, 세금계산서와 입금 확인을 챙긴다.'],
        ['학생과 연구', '학생. 과제와 제출 기한, 지도교수와 조교 연락, 장학과 행정 공지를 챙긴다.'],
      ],
    },
  ],

  en: [
    {
      group: 'Leadership',
      items: [
        ['CEO / Executive', 'CEO. Watches for approvals and sign-offs, contract and investor mail, meeting requests, executive reports and key client issues. Receives a lot of sales and PR pitches, which are rarely urgent.'],
        ['Startup founder', 'Startup founder. Watches for investor mail and IR, contracts and legal review, hiring, customer issues and grant deadlines. Receives many cold sales pitches and newsletters.'],
        ['CTO / Head of engineering', 'Head of engineering. Watches for technical decisions and architecture discussions, hiring and team issues, vendor contracts and licence renewals, incident reports and security advisories.'],
        ['VP / Department head', 'Department head. Watches for approvals, team reports and performance data, budget and headcount planning, executive meetings and partner requests.'],
        ['Team lead / Manager', 'Team lead. Watches for requests and approvals from the team, scheduling, reports requested from above, hiring and performance reviews, and cross-team asks.'],
        ['Project manager', 'Project manager. Watches for schedule slips and risk reports, deliverable reviews, stakeholder meetings, contract and invoicing dates.'],
      ],
    },
    {
      group: 'Engineering',
      items: [
        ['Backend engineer', 'Backend engineer. Watches for deploys and incidents, code review requests, API integration questions and infrastructure cost alerts.'],
        ['Frontend engineer', 'Frontend engineer. Watches for deploys and bug reports, design handoffs and review requests, and browser compatibility issues.'],
        ['Mobile engineer', 'Mobile engineer. Watches for store review and release, crash reports, design handoffs and review requests.'],
        ['Data engineer', 'Data engineer. Watches for pipeline failures and data requests, schema change discussions and cost alerts.'],
        ['ML / AI engineer', 'Machine learning engineer. Watches for experiment results and model deployment, data requests, papers and technical news.'],
        ['DevOps / Infrastructure', 'Infrastructure engineer. Watches for incidents and alerts, security patches, cloud cost and contracts, and access requests.'],
        ['QA engineer', 'QA engineer. Watches for test requests and release schedules, bug reproduction questions and deploy approvals.'],
        ['Security engineer', 'Security engineer. Watches for vulnerability reports and advisories, audit and certification dates, and access approval requests.'],
        ['Systems integration / Onsite', 'Systems integration engineer. Watches for client requirement changes and acceptance requests, onsite incidents, deliverable deadlines, and reporting requests from head office. Mail arrives from both the client and head office.'],
        ['Technical support / Operations', 'Technical support engineer. Watches for user enquiries and incident reports, urgent fix requests, scheduled maintenance, and handover items.'],
        ['Engineering lead', 'Engineering lead. Watches for team schedules and approvals, vendor and contractor management, client delivery and incident reports.'],
      ],
    },
    {
      group: 'Product and business',
      items: [
        ['Product manager', 'Product manager. Watches for scheduling and prioritisation, spec sign-offs, release notes and stakeholder reports.'],
        ['Product owner', 'Product owner. Watches for requirement sign-offs and prioritisation, metric reports and customer feedback.'],
        ['Business development', 'Business development. Watches for partnership proposals and contract talks, meeting requests, quotes and settlement questions.'],
        ['Strategy / Corporate planning', 'Corporate planning. Watches for report requests and deadlines, budget and approvals, and executive meeting preparation.'],
        ['Solution consulting / Presales', 'Solution consultant. Watches for RFP deadlines, client discovery meetings, proposal review requests, and demo or proof-of-concept scheduling.'],
        ['Data analyst', 'Data analyst. Watches for analysis requests and metric questions, report deadlines and data access requests.'],
      ],
    },
    {
      group: 'Design',
      items: [
        ['Product / UX designer', 'Product designer. Watches for design review requests and feedback, engineering handoff dates and research participation requests.'],
        ['Brand / Graphic designer', 'Brand designer. Watches for production requests and deadlines, draft feedback, and vendor or print orders.'],
      ],
    },
    {
      group: 'Marketing and sales',
      items: [
        ['Performance marketing', 'Performance marketer. Watches for campaign reports and budget approvals, questions from ad platforms and creative production requests.'],
        ['Content / Brand marketing', 'Content marketer. Watches for copy deadlines and review requests, partnership enquiries and publishing schedules.'],
        ['B2B sales', 'B2B sales. Watches for customer enquiries and quote requests, contract and renewal dates, and meeting arrangements.'],
        ['Channel / Sales operations', 'Sales operations. Watches for partner and reseller enquiries, reporting requests, pricing and contract terms, and promotion schedules.'],
        ['Customer support', 'Customer support. Watches for customer enquiries and outage reports, time-bound requests and internal escalations.'],
      ],
    },
    {
      group: 'Operations',
      items: [
        ['HR / Recruiting', 'HR. Watches for interview scheduling and offer discussions, onboarding and offboarding, employee requests and document issuance.'],
        ['Finance / Accounting', 'Finance. Watches for invoices and settlement requests, approvals and expense sign-offs, and closing deadlines.'],
        ['Legal / Office management', 'Office and legal. Watches for contract reviews and signatures, supply and facility requests, insurance and renewal dates.'],
      ],
    },
    {
      group: 'Other',
      items: [
        ['Manufacturing / Production', 'Production manager. Watches for purchase orders and delivery scheduling, quality issues and defect notices, material delays, and equipment maintenance windows.'],
        ['Procurement / Logistics', 'Procurement manager. Watches for quote requests and replies, purchase approvals, shipping and receiving delays, and pricing or contract renewals.'],
        ['Freelancer / Solo business', 'Freelancer. Watches for client enquiries and quote requests, deadlines, invoices and payment confirmations.'],
        ['Student / Researcher', 'Student. Watches for assignments and submission deadlines, messages from advisors and staff, and scholarship or administrative notices.'],
      ],
    },
  ],
};

/** 브라우저 UI 언어에 맞는 직군 목록. 없는 언어는 영어를 쓴다. */
function nmtJobs() {
  let lang = 'en';
  try {
    lang = (chrome.i18n.getUILanguage() || 'en').slice(0, 2).toLowerCase();
  } catch (_) {
    // i18n 을 못 쓰면 영어로 둔다
  }
  return NMT_JOBS_BY_LANG[lang] ?? NMT_JOBS_BY_LANG.en;
}
