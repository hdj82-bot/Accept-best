import Link from "next/link";

const EFFECTIVE_DATE = "2026-04-01";

export default function RefundPage() {
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
            환불정책
          </h1>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-10 text-[15px] leading-7 text-slate-700 dark:text-slate-300">
        <p className="mb-4">
          본 환불정책은 「전자상거래 등에서의 소비자보호에 관한 법률」(이하
          &quot;전자상거래법&quot;) 및 관련 법령에 근거하여 작성되었습니다.
        </p>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
          시행일: {EFFECTIVE_DATE}
        </p>

        <Section title="1. 청약철회 및 환불 기본 원칙">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              이용자는 유료 플랜 결제일로부터 <strong>7일 이내</strong>에 별도의
              수수료 없이 청약철회를 요청할 수 있습니다(전자상거래법 제17조).
            </li>
            <li>
              단, 결제 후 <strong>서비스를 실질적으로 이용(유료 기능
              사용)한 경우</strong>에는 전자상거래법 제17조 제2항에 따라
              청약철회가 제한될 수 있습니다.
            </li>
            <li>
              회사는 환불 요청을 받은 날로부터 <strong>영업일 기준 3일
              이내</strong>에 처리하며, 결제수단에 따라 실제 환급까지
              3~7영업일이 추가로 소요될 수 있습니다.
            </li>
          </ol>
        </Section>

        <Section title="2. 월 정액제 환불 기준">
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 text-left">결제 후 경과일</th>
                <th className="py-2 text-left">이용량</th>
                <th className="py-2 text-left">환불 금액</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">7일 이내</td>
                <td className="py-2">유료 기능 미사용</td>
                <td className="py-2">전액 환불</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">7일 이내</td>
                <td className="py-2">유료 기능 사용</td>
                <td className="py-2">이용 일수 및 사용량 공제 후 환불</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2">7일 초과</td>
                <td className="py-2">-</td>
                <td className="py-2">환불 불가(차회 자동결제 해지만 가능)</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
            * 공제금액 = (월 결제금액 × 이용일수 / 30) + 실제 사용 건수에 대한
            정가 상당액
          </p>
        </Section>

        <Section title="3. 자동결제(정기구독) 해지">
          <ol className="list-decimal space-y-1 pl-6">
            <li>
              이용자는{" "}
              <Link href="/settings" className="text-blue-600 underline">
                설정 페이지
              </Link>
              의 &quot;구독 취소&quot; 버튼으로 언제든지 다음 결제일 이후
              자동결제를 해지할 수 있습니다.
            </li>
            <li>
              해지 후에도 이미 결제된 기간의 만료일까지는 유료 기능을 계속
              이용할 수 있으며, 별도의 환불은 진행되지 않습니다.
            </li>
          </ol>
        </Section>

        <Section title="4. 환불 제한 사유">
          <p>다음의 경우 환불이 제한될 수 있습니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-6">
            <li>이용자의 약관 위반으로 서비스 이용이 정지된 경우</li>
            <li>무료 체험 종료 후 자동 전환된 유료 이용을 7일 경과 후 이의
              제기한 경우</li>
            <li>플랜에 포함된 월간 사용량을 이미 소진한 경우</li>
            <li>전자상거래법 제17조 제2항 각 호에 해당하는 경우</li>
          </ul>
        </Section>

        <Section title="5. 환불 신청 방법">
          <ol className="list-decimal space-y-1 pl-6">
            <li>support@academi.ai 로 환불 사유와 결제 영수증을 첨부하여
              요청</li>
            <li>회사는 영업일 기준 1일 이내 접수 확인 회신</li>
            <li>검토 후 3영업일 이내 환불 여부 및 금액 안내</li>
            <li>승인 시 최초 결제수단으로 환급 처리</li>
          </ol>
        </Section>

        <Section title="6. 분쟁해결">
          <p>
            환불 관련 분쟁 발생 시 회사와 이용자는 상호 협의하여 해결하며, 원만한
            해결이 이루어지지 않을 경우 소비자분쟁조정위원회 및 관할 법원의
            판결에 따릅니다.
          </p>
        </Section>

        <Section title="7. 문의">
          <p>
            환불 관련 문의: support@academi.ai (평일 10:00~18:00)
          </p>
        </Section>

        <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">
          본 환불정책은 {EFFECTIVE_DATE}부터 시행됩니다.
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
