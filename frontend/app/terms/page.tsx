import Link from "next/link";

const EFFECTIVE_DATE = "2026-04-01";

export default function TermsPage() {
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
            이용약관
          </h1>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="제1조 (목적)">
          <p>
            본 약관은 논문집필 도우미(이하 &quot;회사&quot;)가 제공하는 AI 기반 논문
            수집·설문 생성·버전 관리 서비스(이하 &quot;서비스&quot;)의 이용과
            관련하여 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로
            합니다.
          </p>
        </Section>

        <Section title="제2조 (정의)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              &quot;서비스&quot;란 회사가 제공하는 논문 검색, 참고문헌 관리,
              설문 생성, 연구 버전 관리 등 일체의 기능을 의미합니다.
            </li>
            <li>
              &quot;이용자&quot;란 본 약관에 동의하고 서비스를 이용하는 회원 및
              비회원을 말합니다.
            </li>
            <li>
              &quot;회원&quot;이란 Google·Kakao 등 소셜 로그인을 통해 가입하여
              서비스를 이용하는 자를 말합니다.
            </li>
            <li>
              &quot;유료 플랜&quot;이란 Basic, Pro 등 월 정액 결제로 이용
              가능한 서비스 상품을 말합니다.
            </li>
          </ol>
        </Section>

        <Section title="제3조 (약관의 효력 및 변경)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게
              공지함으로써 효력이 발생합니다.
            </li>
            <li>
              회사는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수
              있으며, 개정 시 적용일자 및 개정사유를 명시하여 최소 7일 전(이용자
              불리한 경우 30일 전)에 공지합니다.
            </li>
            <li>
              이용자가 개정 약관의 적용일 이후에도 서비스를 계속 이용할 경우
              변경된 약관에 동의한 것으로 간주됩니다.
            </li>
          </ol>
        </Section>

        <Section title="제4조 (회원가입 및 계정)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              이용자는 소셜 로그인(Google, Kakao 등)을 통해 회원가입을 신청하며,
              회사는 실명·연령·중복가입 여부 등을 확인할 수 있습니다.
            </li>
            <li>
              회원은 가입 시 제공한 정보가 변경된 경우 즉시 수정하여야 하며,
              미수정으로 인한 불이익은 회원이 부담합니다.
            </li>
            <li>
              회원은 자신의 계정을 제3자에게 양도·대여할 수 없으며, 계정 관리
              소홀로 인한 손해에 대해 회사는 책임지지 않습니다.
            </li>
          </ol>
        </Section>

        <Section title="제5조 (서비스의 제공 및 변경)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              회사는 연중무휴, 1일 24시간 서비스를 제공함을 원칙으로 합니다. 단,
              시스템 점검·교체 또는 장애, 천재지변 등 불가항력적 사유가 있는
              경우에는 일시 중지될 수 있습니다.
            </li>
            <li>
              회사는 운영상·기술상 필요에 따라 제공하는 서비스 내용을 변경할 수
              있으며, 이 경우 변경 내용과 제공일자를 사전에 공지합니다.
            </li>
          </ol>
        </Section>

        <Section title="제6조 (유료 서비스 및 결제)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              유료 플랜의 이용요금, 결제주기, 제공 기능은 서비스 내{" "}
              <Link href="/billing" className="text-blue-600 underline">
                결제 페이지
              </Link>
              에 게시된 내용을 따릅니다.
            </li>
            <li>
              결제는 PG사(PortOne 등)를 통한 신용카드·간편결제 수단으로
              이루어지며, 매월 자동결제를 원칙으로 합니다.
            </li>
            <li>
              이용자는 결제 전 플랜별 제공 기능, 사용량 제한을 반드시 확인하여야
              합니다.
            </li>
          </ol>
        </Section>

        <Section title="제7조 (청약철회 및 환불)">
          <p>
            환불 및 청약철회에 관한 사항은{" "}
            <Link href="/refund" className="text-blue-600 underline">
              환불정책
            </Link>
            을 따릅니다. 전자상거래법상 보장되는 7일 청약철회권이 인정됩니다.
          </p>
        </Section>

        <Section title="제8조 (이용자의 의무)">
          <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-6">
            <li>타인의 정보 도용 또는 허위정보 등록</li>
            <li>저작권 등 타인의 권리 침해</li>
            <li>서비스의 안정적 운영을 방해할 수 있는 행위(자동화 스크립트,
              비정상적 대량 요청, Rate Limit 우회 등)</li>
            <li>음란·폭력적 메시지, 스팸, 기타 공서양속에 반하는 콘텐츠의 업로드</li>
            <li>회사의 사전 승낙 없이 서비스를 통해 얻은 정보를 복제·배포·상업적 이용</li>
          </ol>
        </Section>

        <Section title="제9조 (지적재산권)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              서비스에 관한 저작권 및 지적재산권은 회사에 귀속됩니다. 단,
              이용자가 직접 생성·업로드한 콘텐츠의 저작권은 이용자에게 있습니다.
            </li>
            <li>
              이용자는 서비스를 이용하여 얻은 정보 중 회사의 지적재산권이
              귀속된 정보를 회사의 사전 동의 없이 복제·전송·출판·배포할 수
              없습니다.
            </li>
          </ol>
        </Section>

        <Section title="제10조 (면책조항)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              회사는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력적
              사유로 서비스를 제공할 수 없는 경우 책임이 면제됩니다.
            </li>
            <li>
              회사는 이용자의 귀책사유로 인한 서비스 이용 장애에 대해 책임을
              지지 않습니다.
            </li>
            <li>
              AI가 생성한 콘텐츠(논문 요약, 설문 항목 등)는 참고용이며, 최종
              판단과 책임은 이용자에게 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="제11조 (분쟁해결 및 준거법)">
          <ol className="list-decimal space-y-1 pl-6">
            <li>본 약관의 해석 및 분쟁은 대한민국 법령에 따릅니다.</li>
            <li>
              서비스 이용과 관련하여 발생한 분쟁에 대해서는 회사의 본사 소재지를
              관할하는 법원을 관할법원으로 합니다.
            </li>
          </ol>
        </Section>

        <Section title="제12조 (문의)">
          <p>
            서비스에 관한 문의는 support@academi.ai 로 연락 주시기 바랍니다.
          </p>
        </Section>

        <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
          부칙: 본 약관은 {EFFECTIVE_DATE}부터 시행됩니다.
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
