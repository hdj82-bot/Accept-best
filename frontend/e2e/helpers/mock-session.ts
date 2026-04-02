import { BrowserContext } from '@playwright/test';

export const MOCK_USER = {
  name: '테스트 유저',
  email: 'test@example.com',
  image: null,
  plan: 'basic',
};

export const MOCK_SESSION = {
  user: MOCK_USER,
  accessToken: 'mock-jwt-token',
  expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
};

export async function injectMockSession(context: BrowserContext) {
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

  await context.route('**/api/auth/session', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    });
  });
}
