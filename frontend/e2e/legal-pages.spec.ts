import { test, expect } from '@playwright/test';

/**
 * 법적 페이지 E2E — /terms, /privacy, /refund 접근 및 내용 확인.
 * 비인증 상태에서도 접근 가능해야 한다.
 */

test.describe('법적 페이지 (이용약관 / 개인정보처리방침 / 환불정책)', () => {
  // ── 이용약관 (/terms) ─────────────────────────────────────────────
  test.describe('/terms 이용약관', () => {
    test('페이지 접근 및 제목 확인', async ({ page }) => {
      await page.goto('/terms');
      await expect(page).toHaveURL(/\/terms/);
      await expect(page.getByRole('heading', { name: /이용약관/i })).toBeVisible({
        timeout: 5000,
      });
    });

    test('핵심 조항이 존재', async ({ page }) => {
      await page.goto('/terms');

      const requiredSections = [
        /목적/,
        /정의/,
        /약관의 효력/,
        /회원가입/,
        /서비스의 제공/,
        /유료 서비스/,
        /청약철회|환불/,
        /이용자의 의무/,
        /지적재산권/,
        /면책/,
        /분쟁해결|준거법/,
      ];

      for (const section of requiredSections) {
        await expect(page.getByText(section).first()).toBeVisible({ timeout: 3000 });
      }
    });

    test('시행일이 표시됨', async ({ page }) => {
      await page.goto('/terms');
      await expect(page.getByText(/시행일|2026/)).toBeVisible();
    });

    test('홈으로 돌아가는 링크 존재', async ({ page }) => {
      await page.goto('/terms');
      const backLink = page.getByRole('link', { name: /홈/i }).or(page.getByText(/← 홈/));
      await expect(backLink.first()).toBeVisible();
    });
  });

  // ── 개인정보처리방침 (/privacy) ───────────────────────────────────
  test.describe('/privacy 개인정보처리방침', () => {
    test('페이지 접근 및 제목 확인', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page).toHaveURL(/\/privacy/);
      await expect(
        page.getByRole('heading', { name: /개인정보처리방침|개인정보/i }),
      ).toBeVisible({ timeout: 5000 });
    });

    test('개인정보보호법 필수 항목 포함', async ({ page }) => {
      await page.goto('/privacy');

      const requiredItems = [
        /수집.*개인정보|개인정보.*항목/,
        /수집.*이용.*목적|이용.*목적/,
        /보유.*이용.*기간|보유.*기간/,
        /제3자.*제공/,
        /처리.*위탁|위탁/,
        /이용자.*권리|권리.*행사/,
        /파기/,
        /안전성.*확보|보안/,
        /쿠키|Cookie/i,
        /보호책임자/,
      ];

      for (const item of requiredItems) {
        await expect(page.getByText(item).first()).toBeVisible({ timeout: 3000 });
      }
    });

    test('개인정보 수집 항목 테이블 존재', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByText(/이메일/)).toBeVisible();
      await expect(page.getByText(/이름/).first()).toBeVisible();
    });

    test('위탁 업체 목록 포함', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByText(/PortOne|아임포트/)).toBeVisible();
      await expect(page.getByText(/Google/)).toBeVisible();
      await expect(page.getByText(/Kakao/)).toBeVisible();
    });

    test('만 14세 미만 아동 가입 제한 고지', async ({ page }) => {
      await page.goto('/privacy');
      await expect(page.getByText(/14세 미만/)).toBeVisible();
    });
  });

  // ── 환불정책 (/refund) ────────────────────────────────────────────
  test.describe('/refund 환불정책', () => {
    test('페이지 접근 및 제목 확인', async ({ page }) => {
      await page.goto('/refund');
      await expect(page).toHaveURL(/\/refund/);
      await expect(page.getByRole('heading', { name: /환불정책|환불/i })).toBeVisible({
        timeout: 5000,
      });
    });

    test('전자상거래법 언급', async ({ page }) => {
      await page.goto('/refund');
      await expect(page.getByText(/전자상거래/)).toBeVisible();
    });

    test('7일 청약철회 기간 명시', async ({ page }) => {
      await page.goto('/refund');
      await expect(page.getByText(/7일/)).toBeVisible();
    });

    test('환불 기준 테이블 존재', async ({ page }) => {
      await page.goto('/refund');
      await expect(page.getByText(/전액 환불/)).toBeVisible();
      await expect(page.getByText(/공제/)).toBeVisible();
    });

    test('환불 신청 방법 안내', async ({ page }) => {
      await page.goto('/refund');
      await expect(page.getByText(/support@academi\.ai/)).toBeVisible();
    });

    test('자동결제 해지 안내 및 설정 페이지 링크', async ({ page }) => {
      await page.goto('/refund');
      await expect(page.getByText(/구독 취소|자동결제.*해지/)).toBeVisible();

      const settingsLink = page.getByRole('link', { name: /설정/i });
      const hasLink = await settingsLink.isVisible().catch(() => false);
      if (hasLink) {
        const href = await settingsLink.getAttribute('href');
        expect(href).toContain('/settings');
      }
    });
  });

  // ── 공통: 비인증 접근 가능 ────────────────────────────────────────
  test.describe('비인증 접근', () => {
    test.beforeEach(async ({ context }) => {
      await context.route('**/api/auth/session', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: 'null',
        }),
      );
    });

    for (const path of ['/terms', '/privacy', '/refund']) {
      test(`${path} — 로그인 없이 접근 가능`, async ({ page }) => {
        await page.goto(path);
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page).toHaveURL(new RegExp(path));
      });
    }
  });

  // ── 페이지 간 링크 연결 ───────────────────────────────────────────
  test('이용약관에서 환불정책 링크 연결', async ({ page }) => {
    await page.goto('/terms');
    const refundLink = page.getByRole('link', { name: /환불정책|환불/ });
    const isVisible = await refundLink.isVisible().catch(() => false);
    if (isVisible) {
      await refundLink.click();
      await expect(page).toHaveURL(/\/refund/);
    }
  });
});
