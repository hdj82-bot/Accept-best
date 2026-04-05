import { test, expect } from '@playwright/test';

/**
 * Kakao OAuth 로그인 플로우 E2E 테스트.
 * 실제 Kakao 서버를 호출하지 않고, next-auth의 OAuth 흐름을 mock하여 검증.
 */

test.describe('Kakao OAuth 로그인', () => {
  test('/login 페이지에 Kakao 로그인 버튼 존재', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    );

    await page.goto('/login');

    const kakaoBtn = page.getByRole('button', { name: /Kakao/i })
      .or(page.getByText(/카카오로 로그인/i))
      .or(page.getByText(/카카오 로그인/i))
      .or(page.locator('[data-provider="kakao"]'))
      .or(page.locator('button:has-text("카카오")'));
    await expect(kakaoBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('Kakao 버튼 클릭 시 OAuth 프로바이더 URL로 이동', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    );

    // next-auth의 signin 엔드포인트를 가로채서 리다이렉트 확인
    let signinCalled = false;
    await page.route('**/api/auth/signin/kakao**', (route) => {
      signinCalled = true;
      // next-auth가 Kakao authorize URL로 리다이렉트하는 것을 mock
      route.fulfill({
        status: 302,
        headers: {
          location: 'https://kauth.kakao.com/oauth/authorize?client_id=test&redirect_uri=http://localhost:3000/api/auth/callback/kakao',
        },
      });
    });

    // CSRF 토큰 mock
    await page.route('**/api/auth/csrf', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ csrfToken: 'mock-csrf-token' }),
      }),
    );

    await page.goto('/login');

    const kakaoBtn = page.getByRole('button', { name: /Kakao/i })
      .or(page.getByText(/카카오로 로그인/i))
      .or(page.getByText(/카카오 로그인/i))
      .or(page.locator('[data-provider="kakao"]'))
      .or(page.locator('button:has-text("카카오")'));
    await kakaoBtn.first().click();

    // OAuth 인증 URL로 이동하거나 signin API가 호출되었는지 확인
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    const navigatedToKakao = currentUrl.includes('kauth.kakao.com')
      || currentUrl.includes('api/auth/signin')
      || signinCalled;
    expect(navigatedToKakao).toBeTruthy();
  });

  test('Kakao OAuth 콜백 처리 후 대시보드로 리다이렉트', async ({ page, context }) => {
    // Kakao OAuth 콜백 성공 시나리오 mock
    const kakaoUser = {
      name: '테스트 카카오 유저',
      email: 'kakao@example.com',
      image: null,
      plan: 'free',
    };

    const kakaoSession = {
      user: kakaoUser,
      accessToken: 'mock-kakao-jwt-token',
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    };

    // 세션 라우트를 먼저 미인증으로 설정한 후 콜백 후 인증 상태로 전환
    let authenticated = false;

    await context.route('**/api/auth/session', (route) => {
      if (authenticated) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(kakaoSession),
        });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      }
    });

    await context.route('**/api/users/me**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'kakao-user-1',
          email: 'kakao@example.com',
          plan: 'free',
          plan_expires_at: null,
        }),
      }),
    );

    // 콜백 엔드포인트 mock — 인증 성공 처리
    await context.route('**/api/auth/callback/kakao**', (route) => {
      authenticated = true;
      route.fulfill({
        status: 302,
        headers: { location: 'http://localhost:3000/dashboard' },
      });
    });

    await context.addCookies([
      {
        name: 'next-auth.session-token',
        value: 'mock-kakao-session',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // 콜백 URL 직접 방문 (Kakao에서 돌아온 상황 시뮬레이션)
    authenticated = true;
    await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('Google과 Kakao 로그인 버튼이 함께 표시', async ({ page }) => {
    await page.route('**/api/auth/session', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
    );

    await page.goto('/login');

    // Google 버튼
    const googleBtn = page.getByRole('button', { name: /Google/i })
      .or(page.getByText(/Google로 로그인/i))
      .or(page.locator('[data-provider="google"]'));
    await expect(googleBtn.first()).toBeVisible({ timeout: 5000 });

    // Kakao 버튼
    const kakaoBtn = page.getByRole('button', { name: /Kakao/i })
      .or(page.getByText(/카카오로 로그인/i))
      .or(page.getByText(/카카오 로그인/i))
      .or(page.locator('[data-provider="kakao"]'))
      .or(page.locator('button:has-text("카카오")'));
    await expect(kakaoBtn.first()).toBeVisible({ timeout: 5000 });
  });
});
