import { test, expect } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

const MOCK_PAPERS = [
  {
    id: 'paper-1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani et al.'],
    abstract: '트랜스포머 아키텍처를 소개하는 논문입니다.',
    year: 2017,
    source: 'arxiv',
    is_bookmarked: false,
  },
  {
    id: 'paper-2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Devlin et al.'],
    abstract: 'BERT 언어 모델을 소개합니다.',
    year: 2018,
    source: 'semantic_scholar',
    is_bookmarked: true,
  },
];

test.describe('논문 검색', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockSession(context);

    await context.route('**/api/users/me**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'test@example.com', plan: 'basic' }),
      });
    });

    await context.route('**/api/papers/search/history', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'h-1', query: 'transformer', created_at: new Date().toISOString() },
          { id: 'h-2', query: 'BERT language model', created_at: new Date().toISOString() },
        ]),
      });
    });

    await context.route('**/api/papers/search', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_PAPERS, total: 2, page: 1, pages: 1 }),
      });
    });
  });

  test('검색창 입력 → 결과 카드 표시', async ({ page }) => {
    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BERT: Pre-training')).toBeVisible();
  });

  test('필터 패널 열기 → 연도 범위 입력 → 검색 재실행', async ({ page, context }) => {
    let searchCalled = 0;
    await context.route('**/api/papers/search', (route) => {
      searchCalled++;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_PAPERS, total: 2, page: 1, pages: 1 }),
      });
    });

    await page.goto('/research');

    // 초기 검색
    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 필터 패널 열기
    const filterToggle = page.getByRole('button', { name: /필터/i })
      .or(page.getByText(/필터/i).first());
    await filterToggle.click();

    // 연도 범위 입력
    const yearFrom = page.locator('input[placeholder*="시작"]')
      .or(page.locator('input[name="year_from"]'))
      .or(page.locator('input[type="number"]').first());
    await yearFrom.fill('2017');

    const yearTo = page.locator('input[placeholder*="종료"]')
      .or(page.locator('input[name="year_to"]'))
      .or(page.locator('input[type="number"]').last());
    await yearTo.fill('2023');

    await page.waitForTimeout(1000);
    expect(searchCalled).toBeGreaterThan(1);
  });

  test('BookmarkButton 클릭 → 아이콘 토글', async ({ page, context }) => {
    await context.route('**/api/bookmarks/paper-1', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      } else if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 204 });
      } else {
        route.continue();
      }
    });

    await page.goto('/research');
    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    // 첫 번째 카드의 북마크 버튼
    const bookmarkBtn = page.locator('[data-paper-id="paper-1"] button[aria-label*="북마크"]')
      .or(page.locator('[data-paper-id="paper-1"] button').first());
    const initialAriaLabel = await bookmarkBtn.getAttribute('aria-label').catch(() => '');
    await bookmarkBtn.click();
    await page.waitForTimeout(300);

    const updatedAriaLabel = await bookmarkBtn.getAttribute('aria-label').catch(() => '');
    expect(updatedAriaLabel).not.toBe(initialAriaLabel);
  });

  test('검색창 클릭 → 히스토리 드롭다운 표시', async ({ page }) => {
    await page.goto('/research');

    const searchInput = page.getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.click();

    await expect(page.getByText('transformer')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('BERT language model')).toBeVisible();
  });
});
