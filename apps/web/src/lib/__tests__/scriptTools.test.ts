import { describe, it, expect } from 'vitest';
import {
  calculateDurationStats,
  checkHook,
  checkCaptionLimits,
  extractSceneTableData,
  SCRIPT_TEMPLATES,
} from '../scriptTools';

describe('WS2: Writing Studio Script Tools & Pure Functions', () => {
  describe('1. Duration Estimator & Pacing Maths', () => {
    it('estimates exact seconds based on words and WPM', () => {
      // 130 words at 130 WPM = 60 seconds
      const res1 = calculateDurationStats(130, 60, 130);
      expect(res1.estimatedSeconds).toBe(60);
      expect(res1.isOverTarget).toBe(false);

      // 65 words at 130 WPM = 30 seconds
      const res2 = calculateDurationStats(65, 30, 130);
      expect(res2.estimatedSeconds).toBe(30);
      expect(res2.isOverTarget).toBe(false);

      // 110 WPM (slow / deliberate)
      const resSlow = calculateDurationStats(55, 30, 110);
      expect(resSlow.estimatedSeconds).toBe(30);

      // 150 WPM (fast / energetic)
      const resFast = calculateDurationStats(75, 30, 150);
      expect(resFast.estimatedSeconds).toBe(30);
    });

    it('generates clear warning when script exceeds target duration chips (15s, 30s, 60s, 90s)', () => {
      // 15s Target
      const over15 = calculateDurationStats(45, 15, 130); // ~21s
      expect(over15.isOverTarget).toBe(true);
      expect(over15.warningMessage).toContain('exceeds your 15s target');

      // 30s Target
      const over30 = calculateDurationStats(90, 30, 130); // ~42s
      expect(over30.isOverTarget).toBe(true);
      expect(over30.warningMessage).toContain('exceeds your 30s target');

      // 60s Target
      const over60 = calculateDurationStats(160, 60, 130); // ~74s
      expect(over60.isOverTarget).toBe(true);
      expect(over60.warningMessage).toContain('exceeds your 60s target');

      // 90s Target
      const over90 = calculateDurationStats(240, 90, 130); // ~111s
      expect(over90.isOverTarget).toBe(true);
      expect(over90.warningMessage).toContain('exceeds your 90s target');
    });

    it('handles zero or negative word counts gracefully', () => {
      const zero = calculateDurationStats(0, 30, 130);
      expect(zero.estimatedSeconds).toBe(0);
      expect(zero.isOverTarget).toBe(false);
      expect(zero.warningMessage).toBeUndefined();
    });
  });

  describe('2. Hook Check (0–3s / 12-Word Limit)', () => {
    it('passes when opening sentence is within 12 words', () => {
      const hookHtml = '<p>Stop scrolling if you want to master design.</p><p>Second sentence here.</p>';
      const res = checkHook(hookHtml);
      expect(res.passes).toBe(true);
      expect(res.wordCount).toBe(8);
      expect(res.openingText).toBe('Stop scrolling if you want to master design.');
      expect(res.warningMessage).toBeUndefined();
    });

    it('warns when opening sentence exceeds 12 words', () => {
      const longHook =
        '<p>Are you currently struggling with your career and looking for an institute that guarantees hands on industry training right away?</p>';
      const res = checkHook(longHook);
      expect(res.passes).toBe(false);
      expect(res.wordCount).toBe(20);
      expect(res.warningMessage).toContain('limit: 12 words');
    });

    it('accurately parses Malayalam Unicode opening line', () => {
      const malayalamHook = '<p>നിങ്ങളുടെ കരിയർ മാറ്റാൻ തയ്യാറാണോ? ഹക്കിൽ ചേരൂ!</p>';
      const res = checkHook(malayalamHook);
      expect(res.passes).toBe(true);
      expect(res.wordCount).toBe(4);
      expect(res.openingText).toContain('കരിയർ');
    });

    it('extracts opening line when text is prefixed with headings', () => {
      const html = '<h1>Campus Reel Script</h1><p>Learn real skills in 90 days.</p>';
      const res = checkHook(html);
      expect(res.passes).toBe(true);
      expect(res.wordCount).toBe(3);
      expect(res.openingText).toBe('Campus Reel Script');
    });
  });

  describe('3. Caption & Hashtag Section Platform Limits', () => {
    it('validates Instagram character (2,200) limits', () => {
      const caption = 'Exciting news for students! Admissions open.';
      const tags = '#HACA #Learning #Code #Design';

      const res = checkCaptionLimits(caption, tags);
      expect(res.instagram.maxChars).toBe(2200);
      expect(res.instagram.charCount).toBeGreaterThan(0);
      expect(res.instagram.isOverLimit).toBe(false);

      // Over char limit (> 2200)
      const longCaption = 'A'.repeat(2250);
      const overCharRes = checkCaptionLimits(longCaption, tags);
      expect(overCharRes.instagram.isOverLimit).toBe(true);
      expect(overCharRes.instagram.remainingChars).toBeLessThan(0);
    });

    it('validates LinkedIn character (3,000) limits', () => {
      const caption = 'We are proud to share our latest achievements.';
      const tags = '#Career #Leadership #HACA #Education #Kerala';

      const res = checkCaptionLimits(caption, tags);
      expect(res.linkedin.maxChars).toBe(3000);
      expect(res.linkedin.isOverLimit).toBe(false);

      // Over limit (> 3000)
      const excessiveCaption = 'B'.repeat(3050);
      const overRes = checkCaptionLimits(excessiveCaption, tags);
      expect(overRes.linkedin.isOverLimit).toBe(true);
    });
  });

  describe('4. Scene Table Parser & Automatic Shot List Generator', () => {
    it('extracts shot list rows from standard 2-column or 3-column scene table', () => {
      const tableHtml = `
        <table>
          <thead>
            <tr>
              <th>Scene #</th>
              <th>Visual / Action</th>
              <th>Audio / Dialogue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Close-up shot of student soldering IoT board</td>
              <td>Stop waiting for miracles. Build real hardware.</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Wide view of HACA studio room with students filming</td>
              <td>Get complete hands-on production training from day one.</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Campus mentor explaining timeline on whiteboard</td>
              <td>Admissions close this Friday. Link in bio.</td>
            </tr>
          </tbody>
        </table>
      `;

      const { shotList, totalEstimatedSeconds } = extractSceneTableData(tableHtml);
      expect(shotList.length).toBe(3);

      expect(shotList[0].sceneNumber).toBe(1);
      expect(shotList[0].visual).toContain('Close-up shot of student');
      expect(shotList[0].audio).toContain('Stop waiting for miracles');
      expect(shotList[0].estTime).toBeGreaterThan(0);

      expect(shotList[1].sceneNumber).toBe(2);
      expect(shotList[1].visual).toContain('Wide view of HACA studio room');

      expect(shotList[2].sceneNumber).toBe(3);
      expect(shotList[2].visual).toContain('Campus mentor explaining timeline');

      expect(totalEstimatedSeconds).toBeGreaterThan(0);
    });

    it('handles tables without explicit thead or with Malayalam content', () => {
      const malayalamTable = `
        <table>
          <tr>
            <td>ദൃശ്യം 1</td>
            <td>ലാബിൽ വിദ്യാർത്ഥികൾ പ്രവർത്തിക്കുന്നു</td>
            <td>നിങ്ങളുടെ ഭാവി ഇവിടെ തുടങ്ങുന്നു.</td>
          </tr>
        </table>
      `;

      const { shotList } = extractSceneTableData(malayalamTable);
      expect(shotList.length).toBe(1);
      expect(shotList[0].visual).toContain('ലാബിൽ');
      expect(shotList[0].audio).toContain('ഭാവി');
    });

    it('returns empty shot list when document has no tables', () => {
      const textOnlyHtml = '<p>Simple paragraph with no tables.</p>';
      const { shotList, totalEstimatedSeconds } = extractSceneTableData(textOnlyHtml);
      expect(shotList).toEqual([]);
      expect(totalEstimatedSeconds).toBe(0);
    });
  });

  describe('5. Pre-structured Script Templates', () => {
    const templateIds = [
      'reel-script',
      'explainer',
      'student-voices',
      'event-promo',
      'poster-copy',
      'carousel',
      'story-frame',
    ];

    it('provides all 7 required script templates with valid HTML structure', () => {
      expect(SCRIPT_TEMPLATES.length).toBe(7);

      for (const id of templateIds) {
        const tpl = SCRIPT_TEMPLATES.find((t) => t.id === id);
        expect(tpl).toBeDefined();
        expect(tpl?.title).toBeTruthy();
        expect(tpl?.htmlContent).toBeTruthy();
        expect(tpl?.badge).toBeTruthy();

        // Content must contain headings and tables or section divs
        expect(tpl?.htmlContent).toContain('<h');
      }
    });

    it('parses shot list from Reel, Explainer, Student Voices, and Event Promo templates', () => {
      for (const id of ['reel-script', 'explainer', 'student-voices', 'event-promo']) {
        const tpl = SCRIPT_TEMPLATES.find((t) => t.id === id);
        expect(tpl).toBeDefined();
        const { shotList } = extractSceneTableData(tpl!.htmlContent);
        expect(shotList.length).toBeGreaterThan(0);
        expect(shotList[0].visual).toBeTruthy();
        expect(shotList[0].audio).toBeTruthy();
      }
    });
  });
});
