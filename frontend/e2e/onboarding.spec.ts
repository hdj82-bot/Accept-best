import { test, expect } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

const MOCK_USER = {
  id: 'user-1',
  email: 'new@example.com',
  name: '신규 유저',
  plan: 'free',
  plan_expires_at: null,
  created_at: '2026-04-06T00:00:00Z',
};

async function mockDashboardEndpoints(context: import('@playwright/test').BrowserContext) {
  await context.route('**/users/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) }),
  );
  await context.route('**/users/me/usage', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ year_month: '2026-04', research_count: 0, survey_count: 0, summary_count: 0 }),
    }),
  );
  await context.route('**/research/notes', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await context.route('**/search/history', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
}

test.describe('온보딩 튜토리얼', () => {
  test('신규 유저에게 첫 방문 시 자동 표시', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);
    // localStorage 에 완료 플래그가 없는 상태

    await page.goto('/dashboard');
    const dialog = page.getByTestId('onboarding-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toContainText('환영');
  });

  test('건너뛰기 클릭 시 닫히고 플래그 저장', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);

    await page.goto('/dashboard');
    await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
    await page.getByRole('button', { name: '건너뛰기' }).click();
    await expect(page.getByTestId('onboarding-dialog')).not.toBeVisible();

    const flag = await page.evaluate(() =>
      window.localStorage.getItem('academi:onboarded:v1'),
    );
    expect(flag).toBe('1');
  });

  test('단계 순회 (다음/이전 버튼)', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /환영/ })).toBeVisible();

    // 다음 단계로
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page.getByRole('heading', { name: /1단계/ })).toBeVisible();

    // 또 다음
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page.getByRole('heading', { name: /2단계/ })).toBeVisible();

    // 이전 버튼으로 복귀
    await page.getByRole('button', { name: '이전' }).click();
    await expect(page.getByRole('heading', { name: /1단계/ })).toBeVisible();
  });

  test('ESC 키로 닫기', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);

    await page.goto('/dashboard');
    await expect(page.getByTestId('onboarding-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('onboarding-dialog')).not.toBeVisible();
  });

  test('플래그가 있으면 자동 표시되지 않음', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);
    await page.addInitScript(() => {
      window.localStorage.setItem('academi:onboarded:v1', '1');
    });

    await page.goto('/dashboard');
    // 대시보드는 로드되지만 온보딩 다이얼로그는 표시되지 않음
    await expect(page.getByRole('heading', { name: '논문집필 도우미' })).toBeVisible();
    await expect(page.getByTestId('onboarding-dialog')).not.toBeVisible();
  });

  test('진행률 바가 각 단계에 맞게 변화', async ({ page, context }) => {
    await injectMockSession(context);
    await mockDashboardEndpoints(context);

    await page.goto('/dashboard');
    const progress = page.getByRole('progressbar');
    await expect(progress).toHaveAttribute('aria-valuenow', '1');

    await page.getByRole('button', { name: '다음' }).click();
    await expect(progress).toHaveAttribute('aria-valuenow', '2');
  });
});
