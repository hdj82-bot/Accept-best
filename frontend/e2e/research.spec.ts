import { test, expect } from '@playwright/test';
import { injectMockSession } from './helpers/mock-session';

test.describe('연구 노트', () => {
  test.beforeEach(async ({ context }) => {
    await injectMockSession(context);

    await context.route('**/api/users/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'test@example.com', plan: 'basic' }),
      });
    });

    await context.route('**/api/users/me/usage', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ research_count: 1, year_month: '2026-04' }),
      });
    });

    await context.route('**/api/research/', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else {
        route.continue();
      }
    });
  });

  test('/dashboard에서 새 연구 시작 → /research 이동', async ({ page }) => {
    await page.goto('/dashboard');
    const startBtn = page.getByRole('button', { name: /새 연구 시작/i })
      .or(page.getByText(/새 연구 시작/i));
    await expect(startBtn.first()).toBeVisible();
    await startBtn.first().click();
    await expect(page).toHaveURL(/\/research/);
  });

  test('/research 노트 작성 후 자동저장 트리거', async ({ page, context }) => {
    let versionSaved = false;
    await context.route('**/api/versions/', (route) => {
      if (route.request().method() === 'POST') {
        versionSaved = true;
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'v-1', save_type: 'auto' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/research');
    const editor = page.getByRole('textbox').or(page.locator('textarea')).first();
    await editor.fill('자동저장 테스트 내용입니다.');

    // 3초 debounce 대기 (여유 있게 4초)
    await page.waitForTimeout(4000);
    expect(versionSaved).toBe(true);
  });

  test('저장 버튼 클릭 → /research/{id} 리다이렉트', async ({ page, context }) => {
    await context.route('**/api/research/', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'note-123', content: '테스트', created_at: new Date().toISOString() }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/research');
    const editor = page.getByRole('textbox').or(page.locator('textarea')).first();
    await editor.fill('저장 테스트 내용');

    const saveBtn = page.getByRole('button', { name: /저장/i });
    await saveBtn.click();
    await expect(page).toHaveURL(/\/research\/note-123/);
  });

  test('ExportButton 드롭다운 → Markdown 클릭 → 로딩 표시', async ({ page, context }) => {
    await context.route('**/api/research/note-1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'note-1', content: '내용', created_at: new Date().toISOString() }),
      });
    });

    await context.route('**/api/export/markdown/note-1', (route) => {
      route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ task_id: 'task-abc' }),
      });
    });

    await context.route('**/api/export/status/task-abc', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'PENDING' }),
      });
    });

    await page.goto('/research/note-1');
    const exportBtn = page.getByRole('button', { name: /내보내기/i })
      .or(page.getByText(/Export/i))
      .first();
    await exportBtn.click();

    const markdownOption = page.getByText(/Markdown/i);
    await expect(markdownOption).toBeVisible();
    await markdownOption.click();

    const loading = page.getByText(/내보내는 중/i)
      .or(page.locator('[aria-busy="true"]'))
      .or(page.locator('.animate-spin'));
    await expect(loading.first()).toBeVisible({ timeout: 3000 });
  });
});
