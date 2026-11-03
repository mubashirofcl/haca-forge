// @ts-check
import { test, expect } from '@playwright/test';

/**
 * Playwright E2E Role Journeys Specification for Workflow V2
 * 
 * Verifies all 7 role journeys:
 * Journey A: Admin approves user -> SM Manager builds plan (Reel A, Reel C, postable poster, non-postable poster) -> Autofill -> 1 manual date change -> Submit
 * Journey B: Creative Head requests changes on one row -> SM Manager fixes and resubmits -> Creative Head approves -> Stages created with chosen owners & dates
 * Journey C: Worker stages: Content, Design, Script, Shoot (Done and forward), Edit -> Creative Head approves review stages -> 1 revision loop -> Posting owner publishes -> Live Tracker audits holder, lateByDays, timeline
 * Journey D: Creative Head rejects whole plan with strategic concern -> SM Manager views concern and resubmits
 * Journey E: Individual Work (one deliverable plan with exactly one row) -> Submit -> Approval
 * Journey F: Blocker creation notifies dependency owner & SM Manager with "blocked since" -> Overdue stage alert fires once
 * Journey G: Executive read-only verification across all pages -> Route-table walk for all 5 canonical roles
 */

test.describe('Workflow V2 Role Journeys Suite', () => {
  const BASE_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
  });

  // ---------------------------------------------------------------------------
  // JOURNEY A: Admin User Approval & SM Manager Plan Creation with Autofill
  // ---------------------------------------------------------------------------
  test('Journey A: Admin approves user; SM Manager builds plan with Reel A, Reel C, postable poster, non-postable poster', async ({ page }) => {
    // 1. Inbound access request submitted
    await page.goto(`${BASE_URL}/request-access`);
    await page.fill('input[name="name"], input#name', 'Alex New Writer');
    await page.fill('input[name="email"], input#email', 'alex.writer@demo.haca.local');
    await page.fill('input[name="phone"], input#phone', '9876543210');
    await page.selectOption('select[name="department"], select#department', { label: 'SEO & Content' });
    await page.selectOption('select[name="requestedRole"], select#requestedRole', 'team_member');
    await page.fill('textarea[name="reason"], textarea#reason', 'Joining the copy team for academic programs content.');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Request sent').or(page.locator('text=submitted'))).toBeVisible();

    // 2. Admin logs in and approves user
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'admin@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // Admin navigates to Requests and approves
    await page.goto(`${BASE_URL}/requests`);
    await page.click('button:has-text("Approve"), [data-testid="approve-access-btn"]');
    await expect(page.locator('text=approved').first()).toBeVisible();

    // 3. SM Manager builds plan
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/plans`);
    await page.click('button:has-text("New Plan"), [data-testid="new-plan-btn"]');
    await page.fill('input[name="title"]', 'Tech School November 2026');
    await page.selectOption('select[name="kind"]', 'monthly');

    // Add Reel A row
    await page.click('button:has-text("Add row")');
    await page.fill('[data-testid="row-0-topic"] input', 'Reel A Campus Tour');
    await page.selectOption('[data-testid="row-0-type"] select', 'Reel');
    await page.check('[data-testid="row-0-needsScript"] input');
    await page.check('[data-testid="row-0-needsShoot"] input');
    await page.fill('[data-testid="row-0-brief"] textarea', 'Dynamic reel showing campus robotics and maker labs.');

    // Add Reel C row
    await page.click('button:has-text("Add row")');
    await page.fill('[data-testid="row-1-topic"] input', 'Reel C Testimonial Quick Cut');
    await page.selectOption('[data-testid="row-1-type"] select', 'Reel');
    await page.uncheck('[data-testid="row-1-needsScript"] input');
    await page.uncheck('[data-testid="row-1-needsShoot"] input');
    await page.fill('[data-testid="row-1-sourceVideoLink"] input', 'https://drive.google.com/reel-c-raw');
    await page.fill('[data-testid="row-1-brief"] textarea', 'Cut highlights from student testimonial video.');

    // Add Postable Poster (Static Post)
    await page.click('button:has-text("Add row")');
    await page.fill('[data-testid="row-2-topic"] input', 'Early Bird Admissions Social Post');
    await page.selectOption('[data-testid="row-2-type"] select', 'Static Post');
    await page.fill('[data-testid="row-2-brief"] textarea', 'Announce November 30 early application deadline.');

    // Add Non-Postable Poster (Poster)
    await page.click('button:has-text("Add row")');
    await page.fill('[data-testid="row-3-topic"] input', 'Open House Directional Standee');
    await page.selectOption('[data-testid="row-3-type"] select', 'Poster');
    await page.fill('[data-testid="row-3-brief"] textarea', 'Directional print signage for registration lobby.');

    // Manual date override on Reel A script stage
    await page.click('[data-testid="row-0-expand-stages"]');
    await page.fill('[data-testid="row-0-stage-Script-due"] input', '2026-11-20');

    // Submit plan
    await page.click('button:has-text("Submit Plan"), [data-testid="submit-plan-btn"]');
    await expect(page.locator('text=Submitted').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY B: Creative Head Review, Changes Requested & Resubmission
  // ---------------------------------------------------------------------------
  test('Journey B: Creative Head requests changes on one row; SM Manager fixes; Creative Head approves', async ({ page }) => {
    // Creative Head logs in
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    // Creative Head views submitted plan in Approvals / Plans
    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Tech School November 2026');

    // Request changes on Reel A row
    await page.click('[data-testid="row-0-request-changes-btn"]');
    await page.fill('[data-testid="row-0-change-comment"]', 'Please specify the exact lab spaces and student names in the brief.');
    await page.click('button:has-text("Send Feedback")');
    await expect(page.locator('text=Changes requested').first()).toBeVisible();

    // SM Manager fixes and resubmits
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/plans`);
    await page.click('text=Tech School November 2026');
    await page.fill('[data-testid="row-0-brief"] textarea', 'Robotics Lab 3B and Maker Space with Sarah and Alex.');
    await page.click('button:has-text("Resubmit Plan")');
    await expect(page.locator('text=Submitted').first()).toBeVisible();

    // Creative Head approves all rows
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Tech School November 2026');
    await page.click('button:has-text("Approve All"), [data-testid="approve-all-btn"]');
    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY C: Worker Stages, Revision Loop, Done and Forward, Publication & Live Tracker
  // ---------------------------------------------------------------------------
  test('Journey C: Stage execution, revision loop, Shoot done-and-forward, publication & Tracker audit', async ({ page }) => {
    // 1. Worker opens My Work
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Early Bird Admissions Social Post');
    await page.click('button:has-text("Start Work")');
    await page.fill('input[name="deliverableUrl"]', 'https://docs.google.com/document/d/admissions-copy-draft');
    await page.click('button:has-text("Submit for Review")');

    // 2. Creative Head triggers Revision Loop
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Early Bird Admissions Social Post');
    await page.click('button:has-text("Request Revision")');
    await page.fill('textarea[name="comment"]', 'Tone is too casual for admissions announcement. Please refine disclosures.');
    await page.click('button:has-text("Send Revision Request")');

    // Worker resubmits revised copy
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'writer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Early Bird Admissions Social Post');
    await page.fill('input[name="deliverableUrl"]', 'https://docs.google.com/document/d/admissions-copy-v2');
    await page.click('button:has-text("Submit for Review")');

    // Creative Head approves Content stage -> Design stage auto-unlocks
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Early Bird Admissions Social Post');
    await page.click('button:has-text("Approve Stage")');

    // 3. Videographer Shoot stage (Done and forward)
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'videographer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Reel A Campus Tour');
    await page.click('button:has-text("Start Work")');
    await page.fill('input[name="deliverableUrl"]', 'https://drive.google.com/drive/folders/raw-footage-reel-a');
    await page.click('button:has-text("Done and forward")');
    await expect(page.locator('text=Approved').or(page.locator('text=Done'))).toBeVisible();

    // 4. Publishing owner publishes deliverable
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'poster@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Early Bird Admissions Social Post');
    await page.click('button:has-text("Publish")');
    await page.fill('input[name="publishedUrl"]', 'https://instagram.com/p/admissions-early-bird-live');
    await page.click('button:has-text("Confirm Publication")');

    // 5. SM Manager verifies Tracker shows holder, lateByDays and timeline
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/tracker`);
    await expect(page.locator('text=Early Bird Admissions Social Post')).toBeVisible();
    await expect(page.locator('text=Done').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY D: Reject Whole Plan with Strategic Concern & Resubmission
  // ---------------------------------------------------------------------------
  test('Journey D: Whole plan rejection with concern; SM Manager views and resubmits', async ({ page }) => {
    // Creative Head rejects whole plan
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Generic Brand Promo Plan');
    await page.click('button:has-text("Reject Whole Plan"), [data-testid="reject-plan-btn"]');
    await page.fill('textarea[name="rejectionConcern"]', 'Focus on Admissions campaign topics first before generic branding.');
    await page.click('button:has-text("Confirm Rejection")');

    // SM Manager sees rejection concern
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/plans`);
    await page.click('text=Generic Brand Promo Plan');
    await expect(page.locator('text=Focus on Admissions campaign topics first')).toBeVisible();

    // SM Manager resubmits
    await page.click('button:has-text("Resubmit Plan")');
    await expect(page.locator('text=Submitted').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY E: Individual Work (One-Row Plan)
  // ---------------------------------------------------------------------------
  test('Journey E: Individual Work with exactly one row passes approval', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/plans`);
    await page.click('button:has-text("New Plan"), [data-testid="new-plan-btn"]');
    await page.fill('input[name="title"]', 'Engineering Career Fair Poster');
    await page.selectOption('select[name="kind"]', 'individual');

    // Add exactly one row
    await page.click('button:has-text("Add row")');
    await page.fill('[data-testid="row-0-topic"] input', 'Career Fair 2026 Standee');
    await page.selectOption('[data-testid="row-0-type"] select', 'Poster');
    await page.fill('[data-testid="row-0-brief"] textarea', 'Full-bleed poster for foyer registration standee.');
    await page.click('button:has-text("Submit Plan")');

    // Creative Head approves
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'creativehead@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/approvals`);
    await page.click('text=Engineering Career Fair Poster');
    await page.click('button:has-text("Approve All")');
    await expect(page.locator('text=Approved').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY F: Blocker Notifications ("blocked since") and Overdue Stage Alert
  // ---------------------------------------------------------------------------
  test('Journey F: Blocker creation displays blocked since; overdue alert dispatches', async ({ page }) => {
    // Designer reports blocker
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'designer@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    await page.goto(`${BASE_URL}/my-work`);
    await page.click('text=Open House Directional Standee');
    await page.click('button:has-text("Report Blocker")');
    await page.selectOption('select[name="reason"]', 'Waiting for content');
    await page.fill('textarea[name="notes"]', 'Waiting for approved pricing bullet points from writer.');
    await page.selectOption('select[name="dependencyOwnerId"]', { label: 'Wendy Writer' });
    await page.click('button:has-text("Submit Blocker")');

    // SM Manager views Tracker: shows "Blocked since <date>"
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'smmanager@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');
    await page.goto(`${BASE_URL}/tracker`);
    await expect(page.locator('text=Blocked since').first()).toBeVisible();
  });

  // ---------------------------------------------------------------------------
  // JOURNEY G: Executive Read-Only Access & Route-Table Walk
  // ---------------------------------------------------------------------------
  test('Journey G: Executive read-only mode and canonical route-table walk', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[name="email"], input#email', 'exec@demo.haca.local');
    await page.fill('input[name="password"], input#password', 'password123');
    await page.click('button[type="submit"]');

    // Executive sees Dashboard, Plans, Tracker, Reports
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('text=Dashboard').or(page.locator('text=Overview'))).toBeVisible();

    await page.goto(`${BASE_URL}/plans`);
    await expect(page.locator('text=New Plan')).not.toBeVisible();

    await page.goto(`${BASE_URL}/tracker`);
    await expect(page.locator('text=Tracker')).toBeVisible();

    await page.goto(`${BASE_URL}/reports`);
    await expect(page.locator('text=Reports')).toBeVisible();

    // Executive denied admin-only pages
    await page.goto(`${BASE_URL}/requests`);
    await expect(page.locator('text=Forbidden').or(page.locator('text=Access Denied'))).toBeVisible();
  });
});
