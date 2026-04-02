import { test, expect, BrowserContext } from '@playwright/test';
import { MOCK_SESSION } from './helpers/mock-session';

const PLAN_LIST = [
  { plan: 'free',  price: 0,     name: 'Free' },
  { plan: 'basic', price: 9900,  name: 'Basic' },
  { plan: 'pro',   price: 29900, name: 'Pro' },
];

async function mockSession(context: BrowserContext, plan: 'free' | 'basic' | 'pro') {
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
        plan_expires_at: plan === 'free' ? null : new Date(Date.now() + 30 * 86400_000).toISOString(),
      }),
    }),
  );

  await context.route('**/api/billing/plans', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PLAN_LIST),
    }),
  );

  await context.route('**/api/billing/current', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        plan,
        expires_at: plan === 'free' ? null : new Date(Date.now() + 30 * 86400_000).toISOString(),
        research_count: 1,
      }),
    }),
  );
}

test.describe('결제 / 플랜', () => {
  test('billing page shows plan options', async ({ page, context }) => {
    await mockSession(context, 'free');
    await page.goto('/billing');

    await expect(page.getByText(/Basic/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/Pro/i)).toBeVisible({ timeout: 5000 });
  });

  test('free user sees upgrade prompt', async ({ page, context }) => {
    await mockSession(context, 'free');
    await page.goto('/billing');

    // 업그레이드 버튼이 하나 이상 보여야 함
    const upgradeBtn = page
      .getByRole('button', { name: /업그레이드/i })
      .or(page.getByText(/업그레이드/i).first())
      .or(page.getByRole('link', { name: /upgrade/i }));

    await expect(upgradeBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('cancel subscription button visible for paid user', async ({ page, context }) => {
    await mockSession(context, 'basic');

    // 구독 취소 요청 mock (실제로 호출되지 않아도 됨)
    await context.route('**/api/billing/cancel', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/settings');

    const cancelBtn = page
      .getByRole('button', { name: /구독 취소/i })
      .or(page.getByText(/구독 취소/i).first())
      .or(page.getByRole('button', { name: /cancel/i }));

    await expect(cancelBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
