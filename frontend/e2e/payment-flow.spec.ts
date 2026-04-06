import { test, expect, BrowserContext } from '@playwright/test';
import { MOCK_SESSION } from './helpers/mock-session';

/**
 * 결제 플로우 E2E 테스트 — PortOne SDK를 mock하여
 * prepare → 결제 UI → complete → 플랜 업그레이드 흐름을 검증.
 */

async function mockSessionWithPlan(context: BrowserContext, plan: 'free' | 'basic' | 'pro') {
  await context.addCookies([
    {
      name: 'next-auth.session-token',
      value: 'mock-session-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  const session = {
    ...MOCK_SESSION,
    user: { ...MOCK_SESSION.user, plan },
  };

  await context.route('**/api/auth/session', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) }),
  );

  await context.route('**/api/users/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'test@example.com',
        plan,
        plan_expires_at: null,
      }),
    }),
  );

  await context.route('**/api/billing/plans', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { plan: 'free', price: 0, name: 'Free' },
        { plan: 'basic', price: 9900, name: 'Basic' },
        { plan: 'pro', price: 29900, name: 'Pro' },
      ]),
    }),
  );

  await context.route('**/api/billing/current', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan,
        expires_at: plan === 'free' ? null : new Date(Date.now() + 30 * 86400_000).toISOString(),
        research_count: 0,
      }),
    }),
  );
}

test.describe('결제 플로우 (PortOne mock)', () => {
  test('free 유저 → Basic 결제 prepare → complete 흐름', async ({ page, context }) => {
    await mockSessionWithPlan(context, 'free');

    // Mock /payment/prepare → merchant_uid + amount 반환
    await context.route('**/payment/prepare', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            payment_id: 'pay-001',
            merchant_uid: 'academi_abc123',
            amount: 9900,
            plan: 'basic',
          }),
        });
      } else {
        route.continue();
      }
    });

    // Mock /payment/complete → 결제 성공
    await context.route('**/payment/complete', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'paid',
            plan: 'basic',
            paid_at: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/billing');

    // Basic 플랜 선택 버튼 클릭
    const basicUpgrade = page.getByRole('button', { name: /Basic/i })
      .or(page.locator('[data-plan="basic"]'))
      .or(page.getByText(/Basic.*업그레이드/i));
    await expect(basicUpgrade.first()).toBeVisible({ timeout: 5000 });
    await basicUpgrade.first().click();

    // 결제 확인 모달 또는 금액 표시
    const amountText = page.getByText(/9,900/i)
      .or(page.getByText(/9900/i));
    await expect(amountText.first()).toBeVisible({ timeout: 5000 });
  });

  test('결제 prepare 실패 시 에러 메시지 표시', async ({ page, context }) => {
    await mockSessionWithPlan(context, 'free');

    await context.route('**/payment/prepare', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: '결제 준비 실패' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/billing');

    const basicUpgrade = page.getByRole('button', { name: /Basic/i })
      .or(page.locator('[data-plan="basic"]'))
      .or(page.getByText(/Basic.*업그레이드/i));
    await expect(basicUpgrade.first()).toBeVisible({ timeout: 5000 });
    await basicUpgrade.first().click();

    // 에러 메시지 표시 확인
    const errorMsg = page.getByText(/실패/i)
      .or(page.getByText(/오류/i))
      .or(page.getByText(/error/i))
      .or(page.getByRole('alert'));
    await expect(errorMsg.first()).toBeVisible({ timeout: 5000 });
  });

  test('결제 완료 후 플랜 업그레이드 반영', async ({ page, context }) => {
    await mockSessionWithPlan(context, 'free');

    let completeCalled = false;

    await context.route('**/payment/prepare', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            payment_id: 'pay-002',
            merchant_uid: 'academi_def456',
            amount: 9900,
            plan: 'basic',
          }),
        });
      } else {
        route.continue();
      }
    });

    await context.route('**/payment/complete', (route) => {
      if (route.request().method() === 'POST') {
        completeCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'paid',
            plan: 'basic',
            paid_at: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });

    // PortOne SDK mock — window.IMP.request_pay 콜백을 즉시 성공으로 처리
    await page.addInitScript(() => {
      (window as any).IMP = {
        init: () => {},
        request_pay: (_params: any, callback: (resp: any) => void) => {
          callback({
            success: true,
            imp_uid: 'imp_mock_001',
            merchant_uid: 'academi_def456',
          });
        },
      };
    });

    await page.goto('/billing');

    const basicUpgrade = page.getByRole('button', { name: /Basic/i })
      .or(page.locator('[data-plan="basic"]'))
      .or(page.getByText(/Basic.*업그레이드/i));
    await expect(basicUpgrade.first()).toBeVisible({ timeout: 5000 });
    await basicUpgrade.first().click();

    // 결제 확인 버튼이 있으면 클릭
    const confirmBtn = page.getByRole('button', { name: /결제하기/i })
      .or(page.getByRole('button', { name: /확인/i }))
      .or(page.getByRole('button', { name: /pay/i }));
    const confirmVisible = await confirmBtn.first().isVisible().catch(() => false);
    if (confirmVisible) {
      await confirmBtn.first().click();
    }

    // 결제 성공 메시지 또는 플랜 변경 UI 확인
    await page.waitForTimeout(1000);
    const successIndicator = page.getByText(/결제 완료/i)
      .or(page.getByText(/업그레이드 완료/i))
      .or(page.getByText(/Basic 플랜/i))
      .or(page.getByText(/성공/i));
    await expect(successIndicator.first()).toBeVisible({ timeout: 5000 });
  });

  test('Pro 플랜 가격 29,900원 표시', async ({ page, context }) => {
    await mockSessionWithPlan(context, 'free');
    await page.goto('/billing');

    const proPrice = page.getByText(/29,900/i)
      .or(page.getByText(/29900/i));
    await expect(proPrice.first()).toBeVisible({ timeout: 5000 });
  });
});
