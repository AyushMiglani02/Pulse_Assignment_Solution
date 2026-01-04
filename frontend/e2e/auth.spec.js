import { test, expect } from '@playwright/test';

/**
 * E2E Test Suite: Authentication Flow
 * 
 * Tests the complete user authentication flow including:
 * - User registration
 * - Login
 * - Logout
 * - Protected route access
 */

test.describe('Authentication Flow', () => {
  const testUser = {
    email: `test.user.${Date.now()}@example.com`,
    password: 'Test123!@#',
    name: 'Test User',
  };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page by default', async ({ page }) => {
    await expect(page).toHaveTitle(/Pulse/);
    await expect(page.locator('h2')).toContainText(/sign in|login/i);
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i)).toBeVisible();
  });

  test('should register a new user', async ({ page }) => {
    // Navigate to register page
    await page.getByRole('link', { name: /register|sign up/i }).click();
    
    // Fill registration form
    await page.getByPlaceholder(/name/i).fill(testUser.name);
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/password/i).first().fill(testUser.password);
    
    // Submit form
    await page.getByRole('button', { name: /register|sign up/i }).click();
    
    // Should redirect to dashboard/videos page
    await expect(page).toHaveURL(/\/(videos|dashboard)/);
    
    // Should show user name or profile
    await expect(page.locator('body')).toContainText(testUser.name);
  });

  test('should login existing user', async ({ page }) => {
    // Fill login form
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/password/i).fill(testUser.password);
    
    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click();
    
    // Should redirect to dashboard
    await expect(page).toHaveURL(/\/(videos|dashboard)/);
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByPlaceholder(/email/i).fill('invalid@example.com');
    await page.getByPlaceholder(/password/i).fill('wrongpassword');
    
    await page.getByRole('button', { name: /sign in|login/i }).click();
    
    // Should show error message
    await expect(page.locator('body')).toContainText(/invalid|error|failed/i);
    
    // Should stay on login page
    await expect(page).toHaveURL('/');
  });

  test('should logout user', async ({ page }) => {
    // Login first
    await page.getByPlaceholder(/email/i).fill(testUser.email);
    await page.getByPlaceholder(/password/i).fill(testUser.password);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    
    await expect(page).toHaveURL(/\/(videos|dashboard)/);
    
    // Logout
    await page.getByRole('button', { name: /logout|sign out/i }).click();
    
    // Should redirect to login
    await expect(page).toHaveURL('/');
  });

  test('should redirect to login when accessing protected route', async ({ page }) => {
    // Try to access protected route without auth
    await page.goto('/videos');
    
    // Should redirect to login
    await expect(page).toHaveURL('/');
  });
});
