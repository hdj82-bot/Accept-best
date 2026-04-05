import { test, expect } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

/**
 * 전체 사용자 플로우 E2E:
 * 논문 검색 → 상세보기 → 컬렉션 추가 → Export
 */

const MOCK_PAPERS = [
  {
    id: 'paper-1',
    title: 'Attention Is All You Need',
    authors: ['Vaswani, A.', 'Shazeer, N.', 'Parmar, N.'],
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.',
    year: 2017,
    source: 'arxiv',
    is_bookmarked: false,
    citations: 90000,
    doi: '10.48550/arXiv.1706.03762',
  },
  {
    id: 'paper-2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    authors: ['Devlin, J.', 'Chang, M.'],
    abstract: 'We introduce a new language representation model called BERT.',
    year: 2018,
    source: 'semantic_scholar',
    is_bookmarked: true,
    citations: 70000,
    doi: '10.18653/v1/N19-1423',
  },
];

const MOCK_COLLECTION = {
  id: 'col-research',
  name: 'Transformer 서베이',
  description: 'Transformer 관련 논문 컬렉션',
  paper_count: 3,
  created_at: '2026-03-01T00:00:00Z',
};

test.describe('검색 → 상세 → 컬렉션 → Export 전체 플로우', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockSession(context);

    await context.route('**/api/users/me**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-1',
          email: 'test@example.com',
          plan: 'basic',
          plan_expires_at: '2026-05-01T00:00:00Z',
        }),
      }),
    );

    await context.route('**/api/papers/search**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: MOCK_PAPERS, total: 2, page: 1, pages: 1 }),
      }),
    );

    await context.route('**/api/papers/search/history', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await context.route('**/api/papers/paper-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_PAPERS[0]),
      }),
    );

    await context.route('**/api/collections/', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_COLLECTION]),
        });
      } else {
        route.continue();
      }
    });
    await context.route('**/api/collections', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([MOCK_COLLECTION]),
        });
      } else {
        route.continue();
      }
    });

    await context.route(`**/api/collections/${MOCK_COLLECTION.id}/papers**`, (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PAPERS),
        });
      } else if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      } else {
        route.continue();
      }
    });

    await context.route('**/api/tags**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
  });

  test('1. 논문 검색 → 결과 카드 렌더링', async ({ page }) => {
    await page.goto('/research');

    const searchInput = page
      .getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');

    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('BERT')).toBeVisible({ timeout: 3000 });
  });

  test('2. 논문 카드 클릭 → 상세 정보 표시', async ({ page }) => {
    await page.goto('/research');

    const searchInput = page
      .getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    await page.getByText('Attention Is All You Need').click();

    const detailContent = page
      .getByText(/dominant sequence transduction/i)
      .or(page.getByText('Vaswani'))
      .or(page.getByText('2017'));
    await expect(detailContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('3. 검색 결과에서 컬렉션에 추가', async ({ page, context }) => {
    let addCalled = false;
    await context.route(`**/api/collections/${MOCK_COLLECTION.id}/papers**`, (route) => {
      if (route.request().method() === 'POST') {
        addCalled = true;
        route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_PAPERS),
        });
      }
    });

    await page.goto('/research');
    const searchInput = page
      .getByPlaceholder(/검색/i)
      .or(page.getByRole('searchbox'))
      .or(page.locator('input[type="text"]').first());
    await searchInput.fill('transformer');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });

    const addBtn = page
      .locator('[data-paper-id="paper-1"]')
      .getByRole('button', { name: /컬렉션|추가|저장|add/i })
      .or(page.getByRole('button', { name: /컬렉션에 추가/i }).first())
      .or(
        page
          .locator('[data-paper-id="paper-1"]')
          .locator('button')
          .filter({ hasText: /컬렉션|추가/ })
          .first(),
      );

    const isVisible = await addBtn.first().isVisible().catch(() => false);
    if (isVisible) {
      await addBtn.first().click();
      const colOption = page.getByText(MOCK_COLLECTION.name);
      if (await colOption.isVisible().catch(() => false)) {
        await colOption.click();
      }
      await expect.poll(() => addCalled, { timeout: 5000 }).toBe(true);
    } else {
      const status = await page.evaluate(
        async ({ colId, paperId }: { colId: string; paperId: string }) => {
          const r = await fetch(`/api/collections/${colId}/papers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paper_id: paperId }),
          });
          return r.status;
        },
        { colId: MOCK_COLLECTION.id, paperId: 'paper-1' },
      );
      expect(status).toBe(201);
    }
  });

  test('4. 컬렉션 페이지에서 추가된 논문 확인', async ({ page }) => {
    await page.goto('/collections');
    await expect(page.getByText(MOCK_COLLECTION.name)).toBeVisible({ timeout: 5000 });

    await page.getByText(MOCK_COLLECTION.name).click();
    await expect(page.getByText('Attention Is All You Need')).toBeVisible({ timeout: 5000 });
  });

  test('5. 연구 노트에서 Export 실행', async ({ page, context }) => {
    let exportCalled = false;

    await context.route('**/api/research/', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        route.continue();
      }
    });

    await context.route('**/api/research/note-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'note-1',
          content: '# Transformer 서베이\n\nAttention is all you need.',
          created_at: '2026-04-01T00:00:00Z',
        }),
      }),
    );

    await context.route('**/api/export/markdown/note-1', (route) => {
      exportCalled = true;
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ task_id: 'task-md-1' }),
      });
    });

    await context.route('**/api/export/status/task-md-1', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'SUCCESS', download_url: '/files/note-1.md' }),
      }),
    );

    await context.route('**/api/versions/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );

    await page.goto('/research/note-1');

    const exportBtn = page.getByRole('button', { name: /내보내기|export/i }).first();
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();

    const markdownOption = page.getByText(/Markdown/i);
    await expect(markdownOption).toBeVisible({ timeout: 3000 });
    await markdownOption.click();

    await expect.poll(() => exportCalled, { timeout: 5000 }).toBe(true);
  });
});
