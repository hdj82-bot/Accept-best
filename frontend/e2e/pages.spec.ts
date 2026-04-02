import { test, expect, BrowserContext } from '@playwright/test';
import { MOCK_SESSION } from './helpers/mock-session';

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
        plan_expires_at: null,
      }),
    }),
  );
}

test.describe('페이지 기본 렌더링', () => {
  test('survey page loads', async ({ page, context }) => {
    await mockSession(context, 'free');

    await context.route('**/api/survey/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.goto('/survey');

    await expect(
      page.getByText(/설문문항 생성기/i)
        .or(page.getByRole('heading', { name: /설문/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('versions page loads', async ({ page, context }) => {
    await mockSession(context, 'free');

    await context.route('**/api/versions/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.goto('/versions');

    await expect(
      page.getByText(/버전 기록/i)
        .or(page.getByRole('heading', { name: /버전/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('refs page loads', async ({ page, context }) => {
    await mockSession(context, 'free');

    await context.route('**/api/references/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
    );

    await page.goto('/refs');

    await expect(
      page.getByText(/참고문헌 관리/i)
        .or(page.getByRole('heading', { name: /참고문헌/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('settings page loads', async ({ page, context }) => {
    await mockSession(context, 'free');

    await context.route('**/api/billing/current', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: 'free', expires_at: null, research_count: 0 }),
      }),
    );

    await page.goto('/settings');

    await expect(
      page.getByText(/계정 설정/i)
        .or(page.getByRole('heading', { name: /설정/i }))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('checkup page shows pro gate for free user', async ({ page, context }) => {
    await mockSession(context, 'free');

    await page.goto('/checkup');

    // pro 플랜 안내 문구가 보여야 함
    await expect(
      page.getByText(/pro 플랜/i)
        .or(page.getByText(/Pro 플랜/i))
        .or(page.getByText(/업그레이드/i))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });

  test('not found page', async ({ page, context }) => {
    await mockSession(context, 'free');

    await page.goto('/nonexistent-page-xyz');

    await expect(
      page.getByText(/404/i)
        .or(page.getByText(/찾을 수 없/i))
        .or(page.getByText(/not found/i))
        .first(),
    ).toBeVisible({ timeout: 5000 });
  });
});
