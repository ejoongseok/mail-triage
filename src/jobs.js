/**
 * 직군별 역할 문장 템플릿.
 *
 * 직군 이름이 아니라 **그 사람이 메일에서 무엇을 기다리는가** 를 적는다. 이 문장은 판정 입력의
 * 한 줄로 들어간다. 행동 필요 판정은 메일에 요청 표현이 있는지를 주로 보므로, 챙길 일을 적는
 * 것보다 읽기만 하는 메일의 종류를 적는 쪽이 판정에 더 잘 반영된다.
 *
 * 형식은 셋이다. 직무, "직접 답하거나 처리하는 것", "읽기만 하는 것". 읽기만 하는 것에 공지를
 * 적으면 교육 수강 안내처럼 할 일이 담긴 공지도 함께 내려갈 수 있고, "요청 없이 알리기만 하는"
 * 처럼 좁혀 적어도 내려간다. 그런 공지는 설정의 항상 확인 목록이 맡는다. 그 직군의 업무인
 * 것(인사 담당의 사내 공지, 재무 담당의 결제 내역, 사업개발 담당의 제휴 제안)은 읽기만 하는
 * 것에 넣지 않는다.
 *
 * 회신 불가 주소(noreply 계열)에서 오는 알림은 모델에 닿지 않고, 그 밖의 주소에서 오는 알림도
 * 역할 문장으로는 강조까지 끌어올리기 어렵다. 그래서 알림은 예시에 넣지 않고, 꼭 봐야 하는
 * 알림은 설정의 항상 확인 목록이 맡는다.
 *
 * 이 문장은 번역물이 아니라 판정 입력이다. 어색하게 옮기면 그 언어 사용자의 판정 품질이
 * 그대로 나빠진다. 검증할 수 없는 언어는 추가하지 않는다.
 */

const NMT_JOBS_BY_LANG = {
  ko: [
    {
      group: '경영과 리더십',
      items: [
        ['대표와 CEO', '대표. 직접 답하거나 처리하는 것: 결재와 승인 요청, 계약과 투자 관련 연락, 외부 미팅 요청, 임원 보고, 주요 고객사 이슈. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 행사 안내, 대부분의 영업과 홍보 제안.'],
        ['스타트업 창업자', '스타트업 대표. 직접 답하거나 처리하는 것: 투자자 연락과 IR, 계약과 법무 검토, 채용, 고객사 이슈, 정부지원 공고 마감. 읽기만 하는 것: 뉴스레터와 행사 안내, 대부분의 영업 제안과 광고.'],
        ['CTO와 기술총괄', '기술 총괄. 직접 답하거나 처리하는 것: 기술 의사결정과 아키텍처 논의, 채용과 팀 이슈, 벤더 계약과 라이선스 갱신, 장애와 보안 사고 보고. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 팀의 진행 공유, 기술 뉴스레터와 행사 안내, 광고와 영업 제안.'],
        ['임원과 본부장', '본부 임원. 직접 답하거나 처리하는 것: 결재와 승인 요청, 부서 보고와 실적 자료 요청, 예산과 인력 계획, 임원 회의 일정, 대외 협력 건. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지와 복지 안내, 다른 부서의 진행 공유, 뉴스레터와 광고.'],
        ['팀장과 매니저', '팀장. 직접 답하거나 처리하는 것: 팀원의 요청과 승인 건, 일정 조율, 상위 보고 요청, 채용과 평가, 타 부서 협조 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지와 복지 안내, 다른 팀의 진행 공유, 뉴스레터와 광고.'],
        ['프로젝트 관리자', '프로젝트 관리자. 직접 답하거나 처리하는 것: 일정 지연과 리스크 보고, 산출물 검토 요청, 이해관계자 회의, 계약과 정산 일정. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 프로젝트의 진행 공유, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '개발',
      items: [
        ['서버와 백엔드 개발', '서버 개발자. 직접 답하거나 처리하는 것: 코드 리뷰 요청, API 연동 문의, 장애 원인 문의, 배포 일정 조율. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 팀의 배포 공유, 기술 뉴스레터와 행사 안내, 광고.'],
        ['프론트엔드 개발', '프론트엔드 개발자. 직접 답하거나 처리하는 것: 버그 리포트, 디자인 전달과 리뷰 요청, 브라우저 호환 문의, 배포 일정 조율. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 팀의 배포 공유, 기술 뉴스레터와 행사 안내, 광고.'],
        ['모바일 앱 개발', '모바일 앱 개발자. 직접 답하거나 처리하는 것: 버그 리포트, 디자인 전달과 리뷰 요청, 출시 일정 조율, 앱 동작 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 팀의 배포 공유, 기술 뉴스레터와 행사 안내, 광고.'],
        ['데이터 엔지니어', '데이터 엔지니어. 직접 답하거나 처리하는 것: 데이터 요청, 스키마 변경 협의, 파이프라인 장애 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 리포트, 기술 뉴스레터와 행사 안내, 광고.'],
        ['머신러닝과 AI', '머신러닝 엔지니어. 직접 답하거나 처리하는 것: 데이터 요청, 실험과 모델 배포 협의, 리뷰 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 논문과 기술 뉴스레터, 행사 안내, 광고.'],
        ['DevOps와 인프라', '인프라 담당자. 직접 답하거나 처리하는 것: 장애 대응 요청, 접근 권한 요청, 보안 패치 적용 요청, 클라우드 계약 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 점검과 작업 안내, 뉴스레터와 광고.'],
        ['QA와 테스트', 'QA 담당자. 직접 답하거나 처리하는 것: 테스트 요청, 버그 재현 문의, 배포 승인 요청, 릴리스 일정 조율. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 팀의 진행 공유, 뉴스레터와 광고.'],
        ['보안', '보안 담당자. 직접 답하거나 처리하는 것: 취약점 제보, 접근 권한 승인 요청, 감사와 인증 자료 요청, 보안 사고 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 보안 뉴스레터와 행사 안내, 광고와 영업 제안.'],
        ['개발 팀 리드', '개발 팀 리드. 직접 답하거나 처리하는 것: 팀원의 승인과 일정 요청, 코드 리뷰와 설계 검토 요청, 외주 산출물 검수, 고객사 납품과 장애 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지와 복지 안내, 다른 팀의 진행 공유, 정기 리포트, 뉴스레터와 행사 안내, 광고와 영업 제안.'],
        ['SI와 고객사 상주', 'SI 개발자. 직접 답하거나 처리하는 것: 고객사 요구사항 변경과 검수 요청, 현장 이슈와 장애 문의, 산출물 제출 기한, 본사 보고 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 공지, 다른 프로젝트의 진행 공유, 뉴스레터와 광고.'],
        ['기술 지원과 운영', '기술 지원 담당자. 직접 답하거나 처리하는 것: 사용자 문의와 장애 신고, 긴급 조치 요청, 이관과 인수인계 건. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 점검 안내, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '기획과 비즈니스',
      items: [
        ['서비스 기획과 PM', '서비스 기획자. 직접 답하거나 처리하는 것: 일정 조율과 우선순위 결정 요청, 스펙 합의 요청, 이해관계자 보고 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 릴리스 공지, 뉴스레터와 광고.'],
        ['프로덕트 오너', '프로덕트 오너. 직접 답하거나 처리하는 것: 요구사항 확정 요청, 우선순위 결정, 답이 필요한 고객 피드백. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 지표 리포트, 뉴스레터와 광고.'],
        ['사업개발과 제휴', '사업개발 담당자. 직접 답하거나 처리하는 것: 제휴 제안과 계약 협의, 미팅 일정, 견적과 정산 문의. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 행사 안내.'],
        ['전략과 경영기획', '경영기획 담당자. 직접 답하거나 처리하는 것: 보고 자료 요청과 기한, 예산과 결재, 임원 회의 준비. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 다른 부서의 진행 공유, 뉴스레터와 광고.'],
        ['솔루션 컨설팅과 제안', '솔루션 컨설턴트. 직접 답하거나 처리하는 것: 제안 요청과 입찰 마감, 고객사 실무 협의, 제안서 검토 요청, 데모와 PoC 일정. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['데이터 분석', '데이터 분석가. 직접 답하거나 처리하는 것: 분석 요청과 지표 문의, 리포트 기한, 데이터 접근 권한 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 자동 리포트, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '디자인',
      items: [
        ['프로덕트와 UX 디자인', '프로덕트 디자이너. 직접 답하거나 처리하는 것: 디자인 리뷰 요청과 피드백, 개발 전달 일정, 리서치 참여 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 디자인 뉴스레터와 행사 안내, 광고.'],
        ['브랜드와 그래픽 디자인', '브랜드 디자이너. 직접 답하거나 처리하는 것: 제작 요청과 마감, 시안 피드백, 외주와 인쇄 발주. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '마케팅과 영업',
      items: [
        ['퍼포먼스 마케팅', '퍼포먼스 마케터. 직접 답하거나 처리하는 것: 예산 승인 요청, 매체 담당자 문의, 소재 제작 요청. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 정기 성과 리포트, 광고 플랫폼의 홍보 메일.'],
        ['콘텐츠와 브랜드 마케팅', '콘텐츠 마케터. 직접 답하거나 처리하는 것: 원고 마감과 검수 요청, 제휴 문의, 발행 일정 조율. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['B2B 영업', 'B2B 영업 담당자. 직접 답하거나 처리하는 것: 고객 문의와 견적 요청, 계약과 갱신 일정, 방문 약속. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 행사 안내.'],
        ['영업 관리와 채널', '영업 관리 담당자. 직접 답하거나 처리하는 것: 대리점과 파트너 문의, 실적 보고 요청, 단가와 계약 조건 협의, 프로모션 일정. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['고객 지원', '고객 지원 담당자. 직접 답하거나 처리하는 것: 고객 문의와 장애 신고, 처리 기한이 있는 요청, 내부 에스컬레이션. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '경영지원',
      items: [
        ['인사와 채용', '인사 담당자. 직접 답하거나 처리하는 것: 지원자 면접 일정과 처우 협의, 입퇴사 절차, 구성원 요청과 증명서 발급. 읽기만 하는 것: 다른 부서의 진행 공유, 뉴스레터와 행사 안내, 채용 플랫폼의 광고.'],
        ['재무와 회계', '재무 담당자. 직접 답하거나 처리하는 것: 세금계산서와 정산 요청, 결재와 지출 승인, 마감 일정. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['총무와 법무', '총무 담당자. 직접 답하거나 처리하는 것: 계약서 검토 요청과 서명, 비품과 시설 요청, 보험과 갱신 일정. 읽기만 하는 것: 다른 부서의 진행 공유, 뉴스레터와 광고.'],
      ],
    },
    {
      group: '기타',
      items: [
        ['제조와 생산 관리', '생산 관리 담당자. 직접 답하거나 처리하는 것: 발주와 납기 조율, 품질 이슈와 불량 통보, 자재 입고 지연, 설비 점검 일정. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['구매와 물류', '구매 담당자. 직접 답하거나 처리하는 것: 견적 요청과 회신, 발주 승인, 입고와 배송 지연 통보, 단가 협의와 계약 갱신. 읽기만 하는 것: 요청 없이 알리기만 하는 사내 공지, 뉴스레터와 광고.'],
        ['프리랜서와 1인 사업', '프리랜서. 직접 답하거나 처리하는 것: 클라이언트 문의와 견적 요청, 마감 일정, 세금계산서와 입금 확인. 읽기만 하는 것: 요청 없이 알리기만 하는 플랫폼 공지, 뉴스레터와 광고.'],
        ['학생과 연구', '학생. 직접 답하거나 처리하는 것: 과제와 제출 기한, 지도교수와 조교 연락, 장학과 행정 신청 기한. 읽기만 하는 것: 요청 없이 알리기만 하는 학과 공지, 뉴스레터와 광고.'],
      ],
    },
  ],

  en: [
    {
      group: 'Leadership',
      items: [
        ['CEO / Executive', 'CEO. Answer or handle directly: approvals and sign-offs, contract and investor mail, meeting requests, executive reports, key client issues. Only read: company notices that only announce, newsletters and event invitations, most sales and PR pitches.'],
        ['Startup founder', 'Startup founder. Answer or handle directly: investor mail and IR, contracts and legal review, hiring, customer issues, grant deadlines. Only read: newsletters and event invitations, most cold sales pitches and ads.'],
        ['CTO / Head of engineering', 'Head of engineering. Answer or handle directly: technical decisions and architecture discussions, hiring and team issues, vendor contracts and licence renewals, incident and security reports. Only read: company notices that only announce, updates from other teams, tech newsletters and event invitations, ads and sales pitches.'],
        ['VP / Department head', 'Department head. Answer or handle directly: approvals, requests for team reports and performance data, budget and headcount planning, executive meetings, partner requests. Only read: company notices and benefit announcements that ask nothing, updates from other departments, newsletters and ads.'],
        ['Team lead / Manager', 'Team lead. Answer or handle directly: requests and approvals from the team, scheduling, reports requested from above, hiring and reviews, requests from other teams. Only read: company notices and benefit announcements that ask nothing, updates from other teams, newsletters and ads.'],
        ['Project manager', 'Project manager. Answer or handle directly: schedule slips and risk reports, deliverable review requests, stakeholder meetings, contract and invoicing dates. Only read: company notices that only announce, updates from other projects, newsletters and ads.'],
      ],
    },
    {
      group: 'Engineering',
      items: [
        ['Backend engineer', 'Backend engineer. Answer or handle directly: code review requests, API integration questions, questions about incident causes, release scheduling. Only read: company notices that only announce, release updates from other teams, tech newsletters and event invitations, ads.'],
        ['Frontend engineer', 'Frontend engineer. Answer or handle directly: bug reports, design handoffs and review requests, browser compatibility questions, release scheduling. Only read: company notices that only announce, release updates from other teams, tech newsletters and event invitations, ads.'],
        ['Mobile engineer', 'Mobile engineer. Answer or handle directly: bug reports, design handoffs and review requests, release scheduling, questions about app behaviour. Only read: company notices that only announce, release updates from other teams, tech newsletters and event invitations, ads.'],
        ['Data engineer', 'Data engineer. Answer or handle directly: data requests, schema change discussions, questions about pipeline incidents. Only read: company notices that only announce, regular reports, tech newsletters and event invitations, ads.'],
        ['ML / AI engineer', 'Machine learning engineer. Answer or handle directly: data requests, experiment and model deployment discussions, review requests. Only read: company notices that only announce, papers and tech newsletters, event invitations, ads.'],
        ['DevOps / Infrastructure', 'Infrastructure engineer. Answer or handle directly: incident response requests, access requests, security patch requests, cloud contract questions. Only read: company notices that only announce, scheduled maintenance notices, newsletters and ads.'],
        ['QA engineer', 'QA engineer. Answer or handle directly: test requests, bug reproduction questions, deploy approval requests, release scheduling. Only read: company notices that only announce, updates from other teams, newsletters and ads.'],
        ['Security engineer', 'Security engineer. Answer or handle directly: vulnerability reports, access approval requests, requests for audit and certification evidence, security incident questions. Only read: company notices that only announce, security newsletters and event invitations, ads and sales pitches.'],
        ['Systems integration / Onsite', 'Systems integration engineer. Answer or handle directly: client requirement changes and acceptance requests, onsite issues and incident questions, deliverable deadlines, reporting requests from head office. Only read: notices that only announce, updates from other projects, newsletters and ads.'],
        ['Technical support / Operations', 'Technical support engineer. Answer or handle directly: user enquiries and incident reports, urgent fix requests, handover items. Only read: company notices that only announce, scheduled maintenance notices, newsletters and ads.'],
        ['Engineering lead', 'Engineering lead. Answer or handle directly: approvals and schedule requests from the team, code and design review requests, vendor deliverable acceptance, client delivery and incident questions. Only read: company notices and benefit announcements that ask nothing, updates from other teams, regular reports, newsletters and event invitations, ads and sales pitches.'],
      ],
    },
    {
      group: 'Product and business',
      items: [
        ['Product manager', 'Product manager. Answer or handle directly: scheduling and prioritisation requests, spec sign-off requests, stakeholder report requests. Only read: company notices that only announce, release notes, newsletters and ads.'],
        ['Product owner', 'Product owner. Answer or handle directly: requirement sign-off requests, prioritisation decisions, customer feedback that needs a reply. Only read: company notices that only announce, regular metric reports, newsletters and ads.'],
        ['Business development', 'Business development. Answer or handle directly: partnership proposals and contract talks, meeting requests, quote and settlement questions. Only read: company notices that only announce, newsletters and event invitations.'],
        ['Strategy / Corporate planning', 'Corporate planning. Answer or handle directly: report requests and deadlines, budget and approvals, executive meeting preparation. Only read: company notices that only announce, updates from other departments, newsletters and ads.'],
        ['Solution consulting / Presales', 'Solution consultant. Answer or handle directly: RFP and bid deadlines, client discovery meetings, proposal review requests, demo and proof-of-concept scheduling. Only read: company notices that only announce, newsletters and ads.'],
        ['Data analyst', 'Data analyst. Answer or handle directly: analysis requests and metric questions, report deadlines, data access requests. Only read: company notices that only announce, scheduled automatic reports, newsletters and ads.'],
      ],
    },
    {
      group: 'Design',
      items: [
        ['Product / UX designer', 'Product designer. Answer or handle directly: design review requests and feedback, engineering handoff dates, research participation requests. Only read: company notices that only announce, design newsletters and event invitations, ads.'],
        ['Brand / Graphic designer', 'Brand designer. Answer or handle directly: production requests and deadlines, draft feedback, vendor and print orders. Only read: company notices that only announce, newsletters and ads.'],
      ],
    },
    {
      group: 'Marketing and sales',
      items: [
        ['Performance marketing', 'Performance marketer. Answer or handle directly: budget approval requests, questions from ad platforms, creative production requests. Only read: company notices that only announce, scheduled performance reports, promotional mail from ad platforms.'],
        ['Content / Brand marketing', 'Content marketer. Answer or handle directly: copy deadlines and review requests, partnership enquiries, publishing schedules. Only read: company notices that only announce, newsletters and ads.'],
        ['B2B sales', 'B2B sales. Answer or handle directly: customer enquiries and quote requests, contract and renewal dates, meeting arrangements. Only read: company notices that only announce, newsletters and event invitations.'],
        ['Channel / Sales operations', 'Sales operations. Answer or handle directly: partner and reseller enquiries, reporting requests, pricing and contract terms, promotion schedules. Only read: company notices that only announce, newsletters and ads.'],
        ['Customer support', 'Customer support. Answer or handle directly: customer enquiries and outage reports, requests with a deadline, internal escalations. Only read: company notices that only announce, newsletters and ads.'],
      ],
    },
    {
      group: 'Operations',
      items: [
        ['HR / Recruiting', 'HR. Answer or handle directly: interview scheduling and offer discussions, onboarding and offboarding, employee requests and document issuance. Only read: updates from other departments, newsletters and event invitations, ads from hiring platforms.'],
        ['Finance / Accounting', 'Finance. Answer or handle directly: invoices and settlement requests, approvals and expense sign-offs, closing deadlines. Only read: company notices that only announce, newsletters and ads.'],
        ['Legal / Office management', 'Office and legal. Answer or handle directly: contract reviews and signatures, supply and facility requests, insurance and renewal dates. Only read: updates from other departments, newsletters and ads.'],
      ],
    },
    {
      group: 'Other',
      items: [
        ['Manufacturing / Production', 'Production manager. Answer or handle directly: purchase orders and delivery scheduling, quality issues and defect notices, material delays, equipment maintenance windows. Only read: company notices that only announce, newsletters and ads.'],
        ['Procurement / Logistics', 'Procurement manager. Answer or handle directly: quote requests and replies, purchase approvals, shipping and receiving delays, pricing and contract renewals. Only read: company notices that only announce, newsletters and ads.'],
        ['Freelancer / Solo business', 'Freelancer. Answer or handle directly: client enquiries and quote requests, deadlines, invoices and payment confirmations. Only read: platform notices that only announce, newsletters and ads.'],
        ['Student / Researcher', 'Student. Answer or handle directly: assignments and submission deadlines, messages from advisors and staff, scholarship and administrative application deadlines. Only read: department notices that only announce, newsletters and ads.'],
      ],
    },
  ],
};

/**
 * 직군별 항상 확인 추천 단어. 직군 이름마다 [단어, 이유] 의 목록이다.
 *
 * 설정 화면이 역할 문장에 맞는 직군의 것을 이유와 함께 보여 주고, 사용자가 추가를 눌러야
 * 항상 확인 목록에 들어간다. 저절로 넣지 않는다. 메일함마다 제목을 쓰는 방식이 달라, 맞지
 * 않는 단어는 헛걸림만 늘린다.
 *
 * 고르는 기준.
 *   - 역할 문장으로는 살리기 어려운 메일이어야 한다. 회신 불가 주소에서 와서 판정 없이 흐려지는
 *     알림, 참조나 단체 주소로 받아 흐려지는 요청, 요청 문장 없이 오는 통보다.
 *   - 그 직군이 받는 쪽인 말만 고른다. 내가 보낸 메일은 목록보다 앞서 흐리지만, 내 요청에 상대가
 *     보낸 회신(RE:)은 원래 제목을 달고 와 목록에 걸린다. 그 직군이 흔히 보내는 요청 구절을
 *     권하면 그런 회신까지 강조한다.
 *   - 제목의 일부만 맞아도 걸리므로 구절을 쓴다. 두 글자 단어와 영어 한 단어는 시험의 허용
 *     목록에 있는 것만 쓰고, 이유 문장에 그 말이 걸리는 범위를 적는다.
 *   - 같은 직군의 읽기만 하는 것(뉴스레터, 공지)에 흔한 말은 쓰지 않는다.
 *   - 계정이나 돈을 미끼로 삼는 말(비밀번호, 계정 정지, 결제 실패, 송금 같은)과, 사칭 메일 제목에
 *     흔한 invoice 와 urgent 는 쓰지 않는다. 세금계산서, 발주서, DocuSign 처럼 사칭에도 쓰이는
 *     업무 서식 이름은 그 서식을 처리하는 직군에만 둔다. 긴급은 장애와 고객 대응이 일인 직군에만
 *     둔다.
 *   - 권할 말이 없으면 빈 목록으로 둔다. 빈 목록이면 설정 화면에 추천이 나오지 않는다.
 *
 * 이유 문장에는 이 단어를 넣으면 무엇이 달라지는지를 적는다. 모델이 그 메일을 어떻게 판정하는지는
 * 잰 근거가 있을 때만, 가능성으로 적는다.
 */
const NMT_JOB_HINTS_BY_LANG = {
  ko: {
    '대표와 CEO': [
      ['결재 요청', '전자결재 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['서명 요청', '전자계약 서명 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '스타트업 창업자': [
      ['서명 요청', '전자계약 서명 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['세금계산서', '세금계산서 발행 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    'CTO와 기술총괄': [
      ['장애 발생', '장애 알림과 보고. 회신 불가 주소에서 오거나 참조로 받아도 강조됩니다'],
      ['라이선스 만료', '라이선스 만료 안내. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '임원과 본부장': [
      ['결재 요청', '전자결재 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['승인 요청', '휴가와 경비 같은 승인 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '팀장과 매니저': [
      ['승인 요청', '휴가와 경비 같은 승인 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['협조 요청', '다른 팀이 보낸 협조 요청. 참조나 단체 주소로 받아도 강조됩니다'],
      ['정산 마감', '경비 정산 마감 안내. 참조로 받아도 강조됩니다'],
    ],
    '프로젝트 관리자': [
      ['일정 지연', '일정 지연 보고. 요청 문장이 없어도 강조됩니다'],
    ],
    '서버와 백엔드 개발': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['Run failed', 'GitHub Actions 실패 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['장애 발생', '장애 알림과 보고. 회신 불가 주소에서 오거나 참조로 받아도 강조됩니다'],
    ],
    '프론트엔드 개발': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['Run failed', 'GitHub Actions 실패 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '모바일 앱 개발': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['Run failed', 'GitHub Actions 실패 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '데이터 엔지니어': [
      ['Airflow alert', 'Airflow 작업 실패 메일의 기본 제목. 요청 문장이 없어도 강조됩니다'],
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
    ],
    '머신러닝과 AI': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['Run failed', 'GitHub Actions 실패 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    'DevOps와 인프라': [
      ['FIRING:', '제목에 FIRING: 이 든 메일은 모두 걸립니다. Prometheus 경보 메일의 기본 제목이고, 해소 알림(RESOLVED)은 걸리지 않습니다'],
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['장애 발생', '장애 알림과 보고. 회신 불가 주소에서 오거나 참조로 받아도 강조됩니다'],
    ],
    'QA와 테스트': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['Run failed', 'GitHub Actions 실패 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['테스트 요청', '테스트 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '보안': [
      ['취약점 제보', '외부에서 온 취약점 제보. 요청 문장이 없어도 강조됩니다'],
    ],
    '개발 팀 리드': [
      ['Failed pipeline', 'GitLab 파이프라인 실패 알림. 요청 문장이 없어 판정으로는 흐려질 수 있습니다'],
      ['긴급', '제목에 긴급이 든 메일은 모두 걸립니다. 참조로 받았거나 전사 공지여도 강조됩니다'],
      ['담당자 선정', '담당자를 정하라는 안내. 공지 형식이라 판정으로는 흐려질 수 있습니다'],
      ['정산 마감', '경비 정산 마감 안내. 참조로 받아도 강조됩니다'],
    ],
    'SI와 고객사 상주': [
      ['긴급', '제목에 긴급이 든 메일은 모두 걸립니다. 참조로 받았거나 전사 공지여도 강조됩니다'],
      ['장애 발생', '장애 알림과 보고. 회신 불가 주소에서 오거나 참조로 받아도 강조됩니다'],
    ],
    '기술 지원과 운영': [
      ['장애 신고', '사용자의 장애 신고. 참조나 단체 주소로 받아도 강조됩니다'],
      ['긴급', '제목에 긴급이 든 메일은 모두 걸립니다. 참조로 받았거나 전사 공지여도 강조됩니다'],
    ],
    '서비스 기획과 PM': [
      ['확정 요청', '스펙과 일정 확정 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '프로덕트 오너': [
      ['확정 요청', '요구사항 확정 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '사업개발과 제휴': [
      ['제휴 제안', '외부의 제휴 제안. 판정 기준은 제휴 제안을 영업 메일과 같은 종류로 봅니다'],
      ['견적 요청', '고객의 견적 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '전략과 경영기획': [
      ['결재 요청', '전자결재 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '솔루션 컨설팅과 제안': [
      ['제안 요청', '고객의 제안 요청과 RFP. 참조나 단체 주소로 받아도 강조됩니다'],
      ['입찰 공고', '입찰 공고 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '데이터 분석': [
      ['분석 요청', '분석 요청. 참조나 단체 주소로 받아도 강조됩니다'],
      ['추출 요청', '데이터 추출 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '프로덕트와 UX 디자인': [
      ['디자인 요청', '디자인 작업 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '브랜드와 그래픽 디자인': [
      ['제작 요청', '제작 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    '퍼포먼스 마케팅': [
      ['비승인', '광고 심사 비승인 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '콘텐츠와 브랜드 마케팅': [
      ['검수 요청', '콘텐츠 검수 요청. 참조나 단체 주소로 받아도 강조됩니다'],
    ],
    'B2B 영업': [
      ['견적 요청', '고객의 견적 요청. 참조나 단체 주소로 받아도 강조됩니다'],
      ['계약 갱신', '계약 갱신 안내. 요청 문장이 없어도 강조됩니다'],
    ],
    '영업 관리와 채널': [
      ['발주서', '대리점과 파트너의 발주서. 요청 문장이 없어도 강조됩니다'],
    ],
    '고객 지원': [
      ['장애 신고', '고객의 장애 신고. 참조나 단체 주소로 받아도 강조됩니다'],
      ['긴급', '제목에 긴급이 든 메일은 모두 걸립니다. 참조로 받았거나 전사 공지여도 강조됩니다'],
    ],
    '인사와 채용': [
      ['지원자', '채용 플랫폼의 지원자 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다. 지원자격처럼 지원자가 든 다른 말에도 걸립니다'],
    ],
    '재무와 회계': [
      ['세금계산서', '세금계산서 발행 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '총무와 법무': [
      ['서명 요청', '전자계약 서명 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
      ['계약 만료', '계약 만료 안내. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '제조와 생산 관리': [
      ['납기 지연', '납기 지연 통보. 요청 문장이 없어도 강조됩니다'],
      ['불량', '제목에 불량이 든 메일은 모두 걸립니다. 요청 문장이 없어도 강조됩니다'],
    ],
    '구매와 물류': [
      ['입고 지연', '입고 지연 통보. 요청 문장이 없어도 강조됩니다'],
      ['배송 지연', '배송 지연 통보. 요청 문장이 없어도 강조됩니다'],
    ],
    '프리랜서와 1인 사업': [
      ['견적 요청', '클라이언트의 견적 요청. 참조나 단체 주소로 받아도 강조됩니다'],
      ['세금계산서', '세금계산서 발행 알림. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
    '학생과 연구': [
      ['과제', '제목에 과제가 든 메일은 모두 걸립니다. 전체 공지로 와도 강조됩니다'],
      ['제출 마감', '제출 마감 안내. 요청 문장이 없어도 강조됩니다'],
      ['장학금', '장학금 안내. 회신 불가 주소에서 오면 판정 없이 흐려집니다'],
    ],
  },
  en: {
    'CEO / Executive': [
      ['DocuSign', 'All DocuSign mail, signature requests and completion notices alike. Dimmed without judgement when it comes from a no-reply address'],
      ['approval request', 'Approval requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Startup founder': [
      ['DocuSign', 'All DocuSign mail, signature requests and completion notices alike. Dimmed without judgement when it comes from a no-reply address'],
    ],
    'CTO / Head of engineering': [
      ['license renewal', 'Licence renewal notices. Dimmed without judgement when they come from a no-reply address'],
    ],
    'VP / Department head': [
      ['approval request', 'Approval requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Team lead / Manager': [
      ['approval request', 'Approval requests. Highlighted even when you are copied or reached through a group address'],
      ['time off request', 'Leave requests from HR tools. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Project manager': [],
    'Backend engineer': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Frontend engineer': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Mobile engineer': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Data engineer': [
      ['Airflow alert', 'Default subject of Airflow task failure mail. Highlighted even with no request in the text'],
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
    ],
    'ML / AI engineer': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
    ],
    'DevOps / Infrastructure': [
      ['FIRING:', 'Every subject containing FIRING: matches. Prometheus alert mail uses it by default, and resolved notices do not match'],
      ['TRIGGERED', 'Every subject containing triggered matches, CI and automation notices included. Datadog and PagerDuty alerts use it'],
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
    ],
    'QA engineer': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
      ['test request', 'Test requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Security engineer': [],
    'Systems integration / Onsite': [],
    'Technical support / Operations': [
      ['incident report', 'Incident reports from users. Highlighted even when you are copied or reached through a group address'],
    ],
    'Engineering lead': [
      ['Failed pipeline', 'GitLab pipeline failure alerts. With no request in the text, judgement may leave them dimmed'],
      ['Run failed', 'GitHub Actions failure alerts. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Product manager': [],
    'Product owner': [
      ['sign-off request', 'Requirement sign-off requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Business development': [
      ['partnership proposal', 'Partnership proposals. The judgement criteria treat them as the same kind as sales mail'],
      ['quote request', 'Customer quote requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Strategy / Corporate planning': [
      ['approval request', 'Approval requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Solution consulting / Presales': [
      ['RFP', 'Every subject containing RFP matches, RFP newsletters included. Highlighted even when you are copied or reached through a group address'],
    ],
    'Data analyst': [
      ['data request', 'Data requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Product / UX designer': [
      ['design request', 'Design requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Brand / Graphic designer': [
      ['design request', 'Production requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Performance marketing': [
      ['disapproved', 'Every subject containing disapproved matches. Ad review rejections use it and are dimmed without judgement when they come from a no-reply address'],
    ],
    'Content / Brand marketing': [
      ['review request', 'Content review requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'B2B sales': [
      ['quote request', 'Customer quote requests. Highlighted even when you are copied or reached through a group address'],
      ['contract renewal', 'Contract renewal notices. Highlighted even with no request in the text'],
    ],
    'Channel / Sales operations': [
      ['purchase order', 'Purchase orders from partners. Highlighted even with no request in the text'],
    ],
    'Customer support': [
      ['escalation', 'Every subject containing escalation matches. Highlighted even when you are copied or reached through a group address'],
    ],
    'HR / Recruiting': [
      ['new applicant', 'Applicant alerts from hiring platforms. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Finance / Accounting': [
      ['expense report', 'Expense reports waiting for approval. Dimmed without judgement when they come from a no-reply address'],
    ],
    'Legal / Office management': [
      ['DocuSign', 'All DocuSign mail, signature requests and completion notices alike. Dimmed without judgement when it comes from a no-reply address'],
      ['contract renewal', 'Contract renewal notices. Highlighted even with no request in the text'],
    ],
    'Manufacturing / Production': [
      ['quality issue', 'Quality issue notices. Highlighted even with no request in the text'],
    ],
    'Procurement / Logistics': [
      ['delivery delay', 'Delivery delay notices. Highlighted even with no request in the text'],
    ],
    'Freelancer / Solo business': [
      ['quote request', 'Client quote requests. Highlighted even when you are copied or reached through a group address'],
    ],
    'Student / Researcher': [
      ['assignment', 'Every message with assignment in the subject matches. Highlighted even when sent as an announcement'],
    ],
  },
};

/** 브라우저 UI 언어 가운데 직군 목록이 있는 것. 없는 언어는 영어를 쓴다. */
function nmtJobLang() {
  let lang = 'en';
  try {
    lang = (chrome.i18n.getUILanguage() || 'en').slice(0, 2).toLowerCase();
  } catch (_) {
    // i18n 을 못 쓰면 영어로 둔다
  }
  return Object.hasOwn(NMT_JOBS_BY_LANG, lang) ? lang : 'en';
}

/** 브라우저 UI 언어에 맞는 직군 목록. */
function nmtJobs() {
  return NMT_JOBS_BY_LANG[nmtJobLang()];
}

/**
 * 역할 문장에 맞는 직군 이름과 그 추천 단어. 맞는 직군이 없으면 null.
 *
 * 예시 문장을 고쳐 써도 첫 문장(직무)이 같으면 그 직군으로 본다. 고쳐 쓰라고 안내해 놓고
 * 고치는 순간 추천이 사라지면 안 된다. 세 부분을 줄을 바꿔 적거나 영어 대소문자를 바꿔 적어도
 * 같은 직무로 본다.
 */
function nmtJobHints(persona) {
  const head = (text) => text.trim().split(/\.\s+/)[0].replace(/\.$/, '').toLowerCase();
  const mine = head(persona || '');
  if (!mine) return null;

  const lang = nmtJobLang();
  for (const { items } of NMT_JOBS_BY_LANG[lang]) {
    for (const [name, template] of items) {
      if (head(template) === mine) return { name, hints: NMT_JOB_HINTS_BY_LANG[lang]?.[name] ?? [] };
    }
  }
  return null;
}

/** 목록에 이 줄이 이미 있는가. 목록 규칙처럼 대소문자와 앞뒤 공백은 가리지 않는다 */
function nmtListHas(list, line) {
  const want = line.trim().toLowerCase();
  return (list || '').split('\n').some((x) => x.trim().toLowerCase() === want);
}

/** 목록 끝에 한 줄을 더한다. 이미 있으면 그대로 돌려준다 */
function nmtListAdd(list, line) {
  if (nmtListHas(list, line)) return list;
  const base = (list || '').replace(/\s+$/, '');
  return base ? base + '\n' + line.trim() : line.trim();
}
