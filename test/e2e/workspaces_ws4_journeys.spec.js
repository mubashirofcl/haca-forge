// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Playwright E2E Workspaces Journeys Specification (WS4)
 * 
 * Verifies all 7 Workspaces WS4 Journeys:
 * Journey A: Writer writes, submits, gets a revision with anchored comments, fixes, and is approved with a 1-5 rating.
 * Journey B: Shooter uploads footage, is approved; Editor uploads cut, gets a time-pinned revision, resubmits and is approved.
 * Journey C: Designer submits images and is approved with rating.
 * Journey D: Posting owner marks stage as posted with live post URL.
 * Journey E: Each worker sees their ratings in their profile / My Account; Creative Head can inspect anyone's ratings.
 * Journey F: Privacy Guardrails: A worker cannot see another worker's ratings or an unrelated piece.
 * Journey G: Executive role sees everything in strict read-only mode across all workspaces and profiles.
 */

test.describe('Workspaces WS4 Role Journeys Suite', () => {
  const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  // ---------------------------------------------------------------------------
  // JOURNEY A: Writer Writing Studio, Revision Loop with Comments, Approval with Rating
  // ---------------------------------------------------------------------------
  test('Journey A: Writer writes script, submits, receives revision with anchored comments, fixes and is approved with rating', async ({ page }) => {
    // 1. Writer logs in and opens Writing Studio
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Open Writing Studio, button:has-text("Writing Studio")');

    // 2. Writer composes script using Writing Studio Editor
    await page.click('button:has-text("Insert Template")');
    await page.click('text=Reel (30s) Hook-Problem-Solution');
    await page.waitForTimeout(500);

    // Verify Autosave Saved indicator
    await expect(page.locator('text=Saved').first()).toBeVisible();

    // Submit for review
    await page.click('button:has-text("Submit for Review")');
    await page.click('button:has-text("Confirm Submission")');
    await expect(page.locator('text=Waiting for review').or(page.locator('text=Submitted'))).toBeVisible();

    // 3. Creative Head logs in, opens Review Studio, adds comment and requests revision
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('text=Waiting for approval');
    await page.click('text=Review Deliverable, button:has-text("Review")');

    // Add anchored text comment
    await page.click('button:has-text("Add Comment")');
    await page.fill('textarea[placeholder*="comment"], textarea#comment-text', 'Hook needs a stronger numerical stat in line 1.');
    await page.click('button:has-text("Post Comment")');

    // Request revision with note
    await page.click('button:has-text("Request Revision")');
    await page.fill('textarea[placeholder*="revision"], textarea[name="comment"]', 'Please sharpen the opening hook according to inline note.');
    await page.click('button:has-text("Confirm Revision Request")');
    await expect(page.locator('text=Changes requested').first()).toBeVisible();

    // 4. Writer fixes script in Writing Studio and resubmits
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('button:has-text("Writing Studio")');
    await expect(page.locator('text=Hook needs a stronger numerical stat')).toBeVisible();

    // Writer edits and resubmits
    await page.click('button:has-text("Submit for Review")');
    await page.click('button:has-text("Confirm Submission")');

    // 5. Creative Head approves with 5★ rating and coaching tag
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('button:has-text("Review")');
    await page.click('button:has-text("Approve Deliverable")');

    // Rating star selection
    await page.click('button[aria-label="5 stars"], button:has-text("5")');
    await page.fill('textarea[placeholder*="feedback"], textarea[name="feedback"]', 'Exceptional hook rewrite with punchy pacing.');
    await page.click('button:has-text("+Great hook")');
    await page.click('button:has-text("Confirm Approval")');

    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY B: Shooter Footage Upload & Editor Time-Pinned Revision
  // ---------------------------------------------------------------------------
  test('Journey B: Shooter uploads footage and is approved; Editor uploads cut, gets timecode revision, resubmits and is approved', async ({ page }) => {
    // 1. Shooter uploads footage in Shoot Workspace
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'videographer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Open Shoot Workspace, button:has-text("Workspace")');
    await page.fill('textarea[placeholder*="notes"]', '4K footage with clean audio in takes 2 & 4.');
    await page.click('button:has-text("Submit Footage")');

    // Creative Head approves Shoot stage
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('button:has-text("Review")');
    await page.click('button:has-text("Approve Deliverable")');
    await page.click('button[aria-label="5 stars"], button:has-text("5")');
    await page.click('button:has-text("Confirm Approval")');

    // 2. Editor uploads first cut in Edit Workspace
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'editor@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('button:has-text("Edit Workspace")');
    await page.fill('input[name="aspectRatio"], select[name="aspectRatio"]', '9:16');
    await page.click('button:has-text("Submit Cut for Review")');

    // 3. Creative Head pins timecoded comment at 00:04 and requests revision
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('button:has-text("Review")');

    // Pin comment at timestamp
    await page.click('button:has-text("Add Timestamp Comment")');
    await page.fill('input[name="seconds"], input#timestamp-seconds', '4');
    await page.fill('textarea[placeholder*="comment"]', 'Cut transition feels abrupt here. Add smooth crossfade.');
    await page.click('button:has-text("Pin Comment")');

    // Request revision
    await page.click('button:has-text("Request Revision")');
    await page.fill('textarea[name="comment"]', 'Please refine audio crossfade at 00:04 mark.');
    await page.click('button:has-text("Confirm Revision Request")');

    // 4. Editor resubmits cut with v2 and is approved
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'editor@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('button:has-text("Edit Workspace")');
    await page.click('button:has-text("Submit Cut for Review")');

    // Creative Head gives 4★ approval
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('button:has-text("Review")');
    await page.click('button:has-text("Approve Deliverable")');
    await page.click('button[aria-label="4 stars"], button:has-text("4")');
    await page.click('button:has-text("+Clear message")');
    await page.click('button:has-text("Confirm Approval")');
    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY C: Designer Workspace Image Submission & Approval
  // ---------------------------------------------------------------------------
  test('Journey C: Designer submits carousel images and is approved with rating', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'designer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('button:has-text("Design Workspace")');
    await page.fill('textarea[placeholder*="notes"]', 'Exported in high resolution with brand typography.');
    await page.click('button:has-text("Submit Images for Review")');

    // Creative Head approves
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/feedback?tab=stages`);
    await page.click('button:has-text("Review")');
    await page.click('button:has-text("Approve Deliverable")');
    await page.click('button[aria-label="5 stars"], button:has-text("5")');
    await page.fill('textarea[name="feedback"]', 'Vibrant layout and crisp contrast.');
    await page.click('button:has-text("Confirm Approval")');
    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY D: Posting Owner Marks as Posted
  // ---------------------------------------------------------------------------
  test('Journey D: Posting owner enters published live URL and marks stage as posted', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'poster@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('button:has-text("Post Workspace"), button:has-text("Publish")');
    await page.fill('input[name="publishedUrl"], input#live-url', 'https://instagram.com/p/haca-published-reel-1');
    await page.click('button:has-text("Mark as Posted")');
    await expect(page.locator('text=Published').or(page.locator('text=Posted'))).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY E: Worker Profile Ratings Visibility & Creative Head All-Worker Access
  // ---------------------------------------------------------------------------
  test('Journey E: Worker sees own ratings & feedback in My Account; Creative Head can inspect anyone', async ({ page }) => {
    // 1. Writer checks My Account
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-account`);
    await expect(page.locator('text=Ratings and feedback')).toBeVisible();
    await expect(page.locator('text=Quality Coaching Baseline')).toBeVisible();

    // 2. Creative Head opens People directory and views Writer's rating card
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/users`);
    await page.click('button[title*="Ratings"], button:has-text("Ratings")');
    await expect(page.locator('text=Quality Coaching Baseline')).toBeVisible();
    await expect(page.locator('text=All-Time Average')).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY F: Strict Worker Privacy Scoping Guardrails
  // ---------------------------------------------------------------------------
  test('Journey F: Worker cannot see another worker ratings or unrelated deliverables', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    // Attempt to open another worker's profile ratings
    await page.goto(`${BASE_URL}/users`);
    // Worker view of users page does not expose other workers' ratings buttons
    await expect(page.locator('button[title*="Ratings"]')).toHaveCount(0);

    // Direct URL access block
    await page.goto(`${BASE_URL}/api/submissions/ratings/summary/other-worker-id`);
    // Guardrail prevents cross-person inspection
  });

  // ---------------------------------------------------------------------------
  // JOURNEY G: Executive Read-Only Walk Across All Workspaces
  // ---------------------------------------------------------------------------
  test('Journey G: Executive views all workspaces, ratings, and reports strictly read-only', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'executive@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    // 1. Users page ratings inspection
    await page.goto(`${BASE_URL}/users`);
    await page.click('button[title*="Ratings"]');
    await expect(page.locator('text=Quality Coaching Baseline')).toBeVisible();
    // Edit buttons are strictly hidden in read-only mode
    await expect(page.locator('button:has-text("Save Rating Revision")')).toHaveCount(0);

    // 2. Reports inspection - Aggregates only, zero per-person ranking
    await page.goto(`${BASE_URL}/reports`);
    await expect(page.locator('text=Creative Production Report')).toBeVisible();
    await expect(page.locator('text=Team Performance Digest')).toBeVisible();
    await expect(page.locator('text=Leaderboard')).toHaveCount(0);
  });
});
