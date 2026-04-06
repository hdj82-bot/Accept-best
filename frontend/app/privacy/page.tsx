import Link from "next/link";

const EFFECTIVE_DATE = "2026-04-01";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            ← 홈
          </Link>
          <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            개인정보처리방침
          </h1>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
        <p className="mb-4">
          논문집필 도우미(이하 &quot;회사&quot;)는 「개인정보 보호법」 및
          관련 법령상의 개인정보 보호 규정을 준수하며, 이용자의 개인정보를
          소중히 다루기 위해 본 방침을 수립·공개합니다.
        </p>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="1. 수집하는 개인정보 항목 및 수집 방법">
          <p>회사는 다음과 같은 개인정보를 수집합니다.</p>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left">구분</th>
                <th className="py-2 text-left">항목</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 align-top">필수</td>
                <td className="py-2">이메일, 이름, 소셜 로그인 식별자(Google/Kakao OAuth ID), 프로필 이미지 URL</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 align-top">자동수집</td>
                <td className="py-2">서비스 이용기록, 접속 로그, IP 주소, 쿠키, 기기정보, 브라우저 정보</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 align-top">유료결제</td>
                <td className="py-2">결제수단(카드사명, 승인번호), 결제내역 (카드번호는 PG사가 직접 수집·보관)</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            수집 방법: 소셜 로그인 인증, 서비스 이용 과정에서의 자동 생성, 결제
            시 이용자 입력
          </p>
        </Section>

        <Section title="2. 개인정보의 수집·이용 목적">
          <ol className="list-decimal space-y-1 pl-6">
            <li>회원 식별 및 본인 확인, 서비스 부정이용 방지</li>
            <li>서비스 제공(논문 검색, 컬렉션 관리, 설문 생성, 버전 관리)</li>
            <li>유료 플랜 결제 처리 및 환불·청약철회 대응</li>
            <li>공지사항 전달, 고객 문의 응대</li>
            <li>서비스 개선, 이용통계 분석, 신규 기능 개발</li>
          </ol>
        </Section>

        <Section title="3. 개인정보의 보유 및 이용 기간">
          <ul className="list-disc space-y-1 pl-6">
            <li>회원 정보: 회원탈퇴 시 즉시 파기</li>
            <li>부정이용 기록: 1년 보관 후 파기</li>
            <li>전자상거래법에 따른 보관 의무:
              <ul className="mt-1 list-[circle] space-y-0.5 pl-5">
                <li>계약 또는 청약철회 기록: 5년</li>
                <li>대금결제 및 재화 공급 기록: 5년</li>
                <li>소비자 불만·분쟁 처리 기록: 3년</li>
                <li>통신비밀보호법에 의한 접속기록: 3개월</li>
              </ul>
            </li>
          </ul>
        </Section>

        <Section title="4. 개인정보의 제3자 제공">
          <p>
            회사는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 단,
            아래의 경우 예외로 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>이용자가 사전에 동의한 경우</li>
            <li>법령의 규정에 의하거나 수사기관의 적법한 절차에 따른 요구가 있는 경우</li>
          </ul>
        </Section>

        <Section title="5. 개인정보 처리의 위탁">
          <p>회사는 원활한 서비스 제공을 위해 다음과 같이 업무를 위탁합니다.</p>
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left">수탁자</th>
                <th className="py-2 text-left">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">PortOne (아임포트)</td>
                <td className="py-2">결제 처리 및 결제수단 인증</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">Google LLC</td>
                <td className="py-2">OAuth 인증</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">Kakao Corp.</td>
                <td className="py-2">OAuth 인증</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">OpenAI</td>
                <td className="py-2">AI 기반 텍스트 생성 처리</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">Sentry</td>
                <td className="py-2">오류 로그 수집 및 분석</td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="6. 이용자의 권리와 행사 방법">
          <p>
            이용자는 언제든지 다음의 권리를 행사할 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>개인정보 열람 및 정정·삭제 요구</li>
            <li>처리정지 요구</li>
            <li>동의 철회 및 회원탈퇴</li>
          </ul>
          <p className="mt-2">
            권리 행사는{" "}
            <Link href="/settings" className="text-blue-600 underline">
              설정 페이지
            </Link>{" "}
            또는 privacy@academi.ai 이메일로 요청 가능합니다.
          </p>
        </Section>

        <Section title="7. 개인정보의 파기">
          <p>
            보유기간 경과, 처리목적 달성 등 개인정보가 불필요하게 된 때에는
            지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는
            복구·재생 할 수 없는 기술적 방법을 사용하여 삭제합니다.
          </p>
        </Section>

        <Section title="8. 개인정보의 안전성 확보 조치">
          <ul className="list-disc space-y-1 pl-6">
            <li>개인정보 암호화 저장 및 전송 (HTTPS/TLS)</li>
            <li>접근권한 관리 및 접근통제 시스템</li>
            <li>비밀번호 일방향 암호화 (OAuth 토큰의 안전한 저장)</li>
            <li>개인정보 취급자 교육 및 최소인원 운영</li>
            <li>해킹 및 바이러스 대비 보안시스템 운영</li>
          </ul>
        </Section>

        <Section title="9. 쿠키(Cookie)의 운영">
          <p>
            회사는 이용자 맞춤형 서비스 제공을 위해 쿠키를 사용합니다. 이용자는
            브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 이 경우 일부
            서비스 이용에 제한이 있을 수 있습니다.
          </p>
        </Section>

        <Section title="10. 만 14세 미만 아동의 개인정보">
          <p>
            회사는 만 14세 미만 아동의 회원가입을 받지 않습니다.
          </p>
        </Section>

        <Section title="11. 개인정보 보호책임자">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p>· 성명: 개인정보 보호책임자</p>
            <p>· 이메일: privacy@academi.ai</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              기타 개인정보 침해 신고는 개인정보분쟁조정위원회(www.kopico.go.kr),
              개인정보침해신고센터(privacy.kisa.or.kr, 국번없이 118)로 문의
              가능합니다.
            </p>
          </div>
        </Section>

        <Section title="12. 방침의 변경">
          <p>
            본 개인정보처리방침이 변경될 경우, 변경사항 시행 7일 전에 서비스
            내 공지사항을 통해 고지합니다.
          </p>
        </Section>

        <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
          시행일자: {EFFECTIVE_DATE}
        </p>
      </article>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
