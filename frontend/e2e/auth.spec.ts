import { test, expect } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

test.describe('인증', () => {
  test('미인증 상태에서 /dashboard 접근 시 /login으로 리다이렉트', async ({ page }) => {
    await page.route('**/api/auth/session', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('/login 페이지에 Google OAuth 버튼 존재', async ({ page }) => {
    await page.route('**/api/auth/session', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    });

    await page.goto('/login');
    const googleBtn = page.getByRole('button', { name: /Google/i })
      .or(page.getByText(/Google로 로그인/i))
      .or(page.locator('[data-provider="google"]'));
    await expect(googleBtn.first()).toBeVisible();
  });

  test('인증 후 /dashboard 접근 성공', async ({ page, context }) => {
    await injectMockSession(context);

    await context.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
          plan: 'basic',
          plan_expires_at: null,
        }),
      });
    });

    await context.route('**/api/users/me/usage', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ research_count: 2, year_month: '2026-04' }),
      });
    });

    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
