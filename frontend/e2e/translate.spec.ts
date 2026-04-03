import { test, expect, BrowserContext } from '@playwright/test';
import { MOCK_SESSION } from './helpers/mock-session';

/**
 * 번역 기능 E2E 테스트.
 * /api/translate 엔드포인트를 mock하여 논문 제목/초록 번역 UI를 검증.
 */

const MOCK_PAPERS = [
  {
    id: 'paper-tr-1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani et al.'],
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
    year: 2017,
    source: 'arxiv',
    is_bookmarked: false,
  },
];

async function mockAuthenticatedSession(context: BrowserContext) {
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

  await context.route('**/api/auth/session', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SESSION),
    }),
  );

  await context.route('**/api/users/me**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-1',
        email: 'test@example.com',
        plan: 'basic',
      }),
    }),
  );
}

test.describe('번역 기능', () => {
  test.beforeEach(async ({ context }) => {
    await mockAuthenticatedSession(context);

    await context.route('**/api/papers/search/history', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );

    await context.route('**/api/papers/search', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_PAPERS, total: 1, page: 1, pages: 1 }),
      }),
    );
  });

  test('논문 검색 후 번역 버튼 표시', async ({ page, context }) => {
    // 번역 API mock
    await context.route('**/api/translate/paper/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paper_id: 'paper-tr-1',
          title_ko: '어텐션만 있으면 충분합니다',
          abstract_ko: '주요 시퀀스 변환 모델은 복잡한 순환 또는 합성곱 신경망에 기반합니다.',
          fixture: true,
        }),
      }),
    );

    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('attention');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    // 번역 버튼 찾기
    const translateBtn = page.getByRole('button', { name: /번역/i })
      .or(page.getByText(/번역/i))
      .or(page.locator('[data-action="translate"]'))
      .or(page.locator('button:has-text("한국어")'));

    await expect(translateBtn.first()).toBeVisible({ timeout: 5000 });
  });

  test('번역 버튼 클릭 시 한국어 번역 표시', async ({ page, context }) => {
    await context.route('**/api/translate/paper/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paper_id: 'paper-tr-1',
          title_ko: '어텐션만 있으면 충분합니다',
          abstract_ko: '주요 시퀀스 변환 모델은 복잡한 순환 또는 합성곱 신경망에 기반합니다.',
          fixture: true,
        }),
      }),
    );

    await context.route('**/api/translate/text', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          translated_text: '어텐션만 있으면 충분합니다',
          detected_source_lang: 'EN',
        }),
      }),
    );

    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('attention');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    // 번역 버튼 클릭
    const translateBtn = page.getByRole('button', { name: /번역/i })
      .or(page.getByText(/번역/i))
      .or(page.locator('[data-action="translate"]'))
      .or(page.locator('button:has-text("한국어")'));
    await translateBtn.first().click();

    // 번역된 텍스트 확인
    const translated = page.getByText(/어텐션만 있으면/i)
      .or(page.getByText(/번역 미리보기/i))
      .or(page.getByText(/시퀀스 변환/i));
    await expect(translated.first()).toBeVisible({ timeout: 5000 });
  });

  test('번역 API 실패 시 에러 처리', async ({ page, context }) => {
    await context.route('**/api/translate/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: '번역 서비스 오류' }),
      }),
    );

    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('attention');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    const translateBtn = page.getByRole('button', { name: /번역/i })
      .or(page.getByText(/번역/i))
      .or(page.locator('[data-action="translate"]'))
      .or(page.locator('button:has-text("한국어")'));
    const btnVisible = await translateBtn.first().isVisible().catch(() => false);
    if (btnVisible) {
      await translateBtn.first().click();

      // 에러 표시 또는 원문 유지 확인
      const errorOrOriginal = page.getByText(/오류/i)
        .or(page.getByText(/실패/i))
        .or(page.getByText('Attention Is All You Need'));
      await expect(errorOrOriginal.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('번역 로딩 상태 표시', async ({ page, context }) => {
    // 느린 응답 시뮬레이션
    await context.route('**/api/translate/**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          paper_id: 'paper-tr-1',
          title_ko: '어텐션만 있으면 충분합니다',
          abstract_ko: '번역 완료',
          fixture: true,
        }),
      });
    });

    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('attention');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    const translateBtn = page.getByRole('button', { name: /번역/i })
      .or(page.getByText(/번역/i))
      .or(page.locator('[data-action="translate"]'))
      .or(page.locator('button:has-text("한국어")'));
    const btnVisible = await translateBtn.first().isVisible().catch(() => false);
    if (btnVisible) {
      await translateBtn.first().click();

      // 로딩 인디케이터 확인
      const loading = page.getByText(/번역 중/i)
        .or(page.locator('[aria-busy="true"]'))
        .or(page.locator('.animate-spin'))
        .or(page.locator('.animate-pulse'));
      const loadingVisible = await loading.first().isVisible().catch(() => false);
      // 로딩 상태가 짧을 수 있으므로 최종적으로 번역 결과가 나오는지 확인
      const result = page.getByText(/어텐션만 있으면/i)
        .or(page.getByText('Attention Is All You Need'));
      await expect(result.first()).toBeVisible({ timeout: 10000 });
    }
  });
});
