import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

const ADMIN_USER = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  plan: 'admin',
  plan_expires_at: null,
  created_at: '2024-01-01T00:00:00Z',
};

const NORMAL_USER = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'User',
  plan: 'basic',
  plan_expires_at: null,
  created_at: '2026-03-10T00:00:00Z',
};

const MOCK_STATS = {
  total_users: 42,
  plan_distribution: { free: 20, basic: 15, pro: 6, admin: 1 },
  daily_usage: [
    { date: '2026-03-31', count: 12 },
    { date: '2026-04-01', count: 18 },
    { date: '2026-04-02', count: 7 },
    { date: '2026-04-03', count: 24 },
    { date: '2026-04-04', count: 15 },
    { date: '2026-04-05', count: 9 },
    { date: '2026-04-06', count: 31 },
  ],
};

const MOCK_ADMIN_USERS = [
  {
    id: 'u-1',
    email: 'alice@example.com',
    plan: 'pro',
    monthly_usage: {
      year_month: '2026-04',
      research_count: 12,
      survey_count: 8,
      summary_count: 45,
    },
    created_at: '2025-11-20T10:00:00Z',
  },
  {
    id: 'u-2',
    email: 'bob@example.com',
    plan: 'basic',
    monthly_usage: {
      year_month: '2026-04',
      research_count: 3,
      survey_count: 1,
      summary_count: 12,
    },
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'u-3',
    email: 'charlie@example.com',
    plan: 'free',
    monthly_usage: {
      year_month: '2026-04',
      research_count: 0,
      survey_count: 0,
      summary_count: 0,
    },
    created_at: '2026-02-15T10:00:00Z',
  },
];

const MOCK_PAYMENTS = [
  {
    id: 'p-1',
    merchant_uid: 'order-001',
    imp_uid: 'imp-001',
    amount: 19900,
    plan: 'basic',
    status: 'paid',
    created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 'p-2',
    merchant_uid: 'order-002',
    imp_uid: 'imp-002',
    amount: 49900,
    plan: 'pro',
    status: 'paid',
    created_at: '2026-04-03T10:00:00Z',
  },
  {
    id: 'p-3',
    merchant_uid: 'order-003',
    imp_uid: 'imp-003',
    amount: 19900,
    plan: 'basic',
    status: 'failed',
    created_at: '2026-04-05T10:00:00Z',
  },
];

async function mockAdminEndpoints(context: BrowserContext, user = ADMIN_USER) {
  await context.route('**/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(user) }),
  );
  await context.route('**/admin/stats', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_STATS) }),
  );
  await context.route('**/admin/users', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ADMIN_USERS) }),
  );
  await context.route('**/admin/users/*', (route) => {
    if (route.request().method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.continue();
  });
  await context.route('**/payment/history', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PAYMENTS) }),
  );
}

async function setOnboarded(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('academi:onboarded:v1', '1');
  });
}

test.describe('관리자 대시보드', () => {
  test('비관리자 유저는 /dashboard 로 리다이렉트된다', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context, NORMAL_USER);
    await setOnboarded(page);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('관리자는 개요 탭이 기본 노출된다', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: '관리자 대시보드' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /개요/ })).toHaveAttribute('aria-selected', 'true');
    // KPI 카드 내용
    await expect(page.getByText('42', { exact: false })).toBeVisible();
  });

  test('탭 간 전환 (키보드 방향키 포함)', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    const overviewTab = page.getByRole('tab', { name: /개요/ });
    const usersTab = page.getByRole('tab', { name: /유저/ });
    await overviewTab.focus();
    await page.keyboard.press('ArrowRight');
    await expect(usersTab).toHaveAttribute('aria-selected', 'true');
  });

  test('유저 탭 - 이메일 검색으로 필터링', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    await page.getByRole('tab', { name: /유저/ }).click();
    await expect(page.getByText('alice@example.com')).toBeVisible();
    await expect(page.getByText('bob@example.com')).toBeVisible();

    await page.getByLabel('이메일 검색').fill('alice');
    await expect(page.getByText('alice@example.com')).toBeVisible();
    await expect(page.getByText('bob@example.com')).not.toBeVisible();
  });

  test('유저 탭 - 플랜 필터', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    await page.getByRole('tab', { name: /유저/ }).click();
    await page.getByLabel('플랜 필터').selectOption('free');
    await expect(page.getByText('charlie@example.com')).toBeVisible();
    await expect(page.getByText('alice@example.com')).not.toBeVisible();
  });

  test('사용량 탭 - 카테고리별 랭킹 표시', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    await page.getByRole('tab', { name: /사용량/ }).click();
    await expect(page.getByRole('heading', { name: /Top 10 사용자/ })).toBeVisible();
    // alice (pro, usage 65) 가 1위
    await expect(page.getByText('alice@example.com')).toBeVisible();
  });

  test('결제 탭 - 완료 건수와 매출 표시', async ({ page, context }) => {
    await injectMockSession(context);
    await mockAdminEndpoints(context);
    await setOnboarded(page);

    await page.goto('/admin');
    await page.getByRole('tab', { name: /결제/ }).click();
    // 완료 2건, 실패 1건
    await expect(page.getByText('order-001')).toBeVisible();
    await expect(page.getByText('order-002')).toBeVisible();
    // 매출 69,800원
    await expect(page.getByText(/69,800원/)).toBeVisible();
  });
});
