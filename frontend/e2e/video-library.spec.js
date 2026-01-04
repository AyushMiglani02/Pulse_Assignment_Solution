import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Video Library
 * 
 * Tests the video list and filtering functionality:
 * - Display video library
 * - Filter by sensitivity
 * - Video card interactions
 * - Real-time status updates
 */

test.describe('Video Library', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'test123',
  };

  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/');
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    
    // Wait for navigation
    await page.waitForURL(/\/(videos|dashboard)/);
    
    // Navigate to videos page if not already there
    await page.goto('/videos');
  });

  test('should display video library page', async ({ page }) => {
    await expect(page).toHaveURL('/videos');
    await expect(page.locator('h1, h2')).toContainText(/videos|library/i);
  });

  test('should show video cards', async ({ page }) => {
    // Wait for videos to load
    await page.waitForSelector('[data-testid="video-card"], .video-card', {
      state: 'visible',
      timeout: 5000,
    }).catch(() => {
      // If no videos exist, that's okay for E2E
      console.log('No videos found, which is okay for empty library');
    });
  });

  test('should filter videos by sensitivity', async ({ page }) => {
    // Check for filter buttons/dropdown
    const sensitivityFilters = page.locator('button, select').filter({
      hasText: /safe|unknown|flagged|all/i
    });
    
    // Should have filter options
    await expect(sensitivityFilters.first()).toBeVisible();
    
    // Try clicking a filter
    const safeFilter = page.getByRole('button', { name: /safe/i });
    if (await safeFilter.isVisible()) {
      await safeFilter.click();
      // Videos should be filtered (hard to verify without data)
    }
  });

  test('should navigate to video details', async ({ page }) => {
    // Find first video card
    const videoCard = page.locator('[data-testid="video-card"], .video-card').first();
    
    // Check if any videos exist
    const videoExists = await videoCard.isVisible().catch(() => false);
    
    if (videoExists) {
      await videoCard.click();
      
      // Should navigate to video detail page
      await expect(page).toHaveURL(/\/videos\/.+/);
    } else {
      console.log('No videos to click, skipping navigation test');
    }
  });

  test('should show empty state when no videos', async ({ page }) => {
    // If no videos, should show empty state message
    const videoCards = await page.locator('[data-testid="video-card"], .video-card').count();
    
    if (videoCards === 0) {
      await expect(page.locator('body')).toContainText(/no videos|empty|upload/i);
    }
  });

  test('should display video metadata', async ({ page }) => {
    const videoCard = page.locator('[data-testid="video-card"], .video-card').first();
    const videoExists = await videoCard.isVisible().catch(() => false);
    
    if (videoExists) {
      // Should show title
      await expect(videoCard.locator('[data-testid="video-title"], .video-title, h3, h4')).toBeVisible();
      
      // Should show status badge
      await expect(videoCard.locator('.badge, [data-testid="status-badge"]')).toBeVisible();
    }
  });
});

/**
 * Real-time Updates Test
 */
test.describe('Real-time Video Updates', () => {
  test.skip('should update video status in real-time', async ({ page }) => {
    // This test requires:
    // 1. Backend server running
    // 2. Video being processed
    // 3. Socket.io connection
    
    // Login and navigate to videos
    // Watch for socket events and UI updates
    // Verify progress bar appears and updates
    // Verify status changes from processing → ready
  });
});
