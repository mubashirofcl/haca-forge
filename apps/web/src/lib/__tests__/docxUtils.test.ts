import { describe, it, expect, vi } from 'vitest';
import { exportDocxFile, downloadBlob } from '../docxUtils';

describe('WS2: Writing Studio DOCX Utilities', () => {
  describe('1. exportDocxFile', () => {
    it('generates a valid DOCX Blob from HTML and plain text', async () => {
      const title = 'Campus Reel Script - Nov 2026';
      const htmlContent = `
        <h1>Reel Hook</h1>
        <p>Are you ready to transform your career?</p>
        <h2>Scene Table</h2>
        <table>
          <tr>
            <th>Scene #</th>
            <th>Visual</th>
            <th>Audio</th>
          </tr>
          <tr>
            <td>1</td>
            <td>Student enters modern lab</td>
            <td>Welcome to HACA.</td>
          </tr>
        </table>
        <ul>
          <li>Hands on mentorship</li>
          <li>Live project deployments</li>
        </ul>
      `;

      const blob = await exportDocxFile(title, htmlContent, 'Fallback text');
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toContain('wordprocessingml');
    });

    it('preserves Malayalam Unicode characters during DOCX export generation', async () => {
      const title = 'മലയാളം സ്ക്രിപ്റ്റ്';
      const malayalamHtml = `
        <h1>ഹക്ക മാർക്കറ്റിംഗ് ഒഎസ്</h1>
        <p>നിങ്ങളുടെ കരിയർ മാറ്റാൻ തയ്യാറാണോ? ഹക്കിൽ ചേരൂ!</p>
      `;

      const blob = await exportDocxFile(title, malayalamHtml, '');
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
    });

    it('falls back gracefully to plainText when HTML content is empty', async () => {
      const title = 'Plain Text Fallback';
      const plainText = 'Line 1: Opening hook.\nLine 2: Value proposition.\nLine 3: Call to action.';

      const blob = await exportDocxFile(title, '', plainText);
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
    });
  });

  describe('2. downloadBlob Browser Utility', () => {
    it('creates object URL, triggers anchor click, and revokes object URL', () => {
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:http://localhost/test-uuid');
      const mockRevokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');
      const removeChildSpy = vi.spyOn(document.body, 'removeChild');

      const testBlob = new Blob(['sample content'], { type: 'text/plain' });
      downloadBlob(testBlob, 'script.docx');

      expect(mockCreateObjectURL).toHaveBeenCalledWith(testBlob);
      expect(appendChildSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-uuid');

      vi.restoreAllMocks();
    });
  });
});
