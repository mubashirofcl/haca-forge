/**
 * Specialized Scriptwriting Tools & Calculations
 * Governed by docs/WORKSPACES.md § 2.6
 */

export interface SceneTableRow {
  sceneNumber: number;
  visual: string;
  audio: string;
  estTime: number; // in seconds
}

export interface ShotListItem {
  sceneNumber: number;
  visual: string;
  audio?: string;
  estTime?: number;
}

export interface ScriptDurationStats {
  wordCount: number;
  wpm: number;
  estimatedSeconds: number;
  targetSeconds: number;
  isOverTarget: boolean;
  diffSeconds: number;
  warningMessage?: string;
}

export interface HookCheckResult {
  openingText: string;
  wordCount: number;
  passes: boolean;
  warningMessage?: string;
}

export interface PlatformCaptionStats {
  charCount: number;
  maxChars: number;
  remainingChars: number;
  isOverLimit: boolean;
  percent: number;
}

export interface CaptionAnalysis {
  caption: string;
  hashtags: string;
  totalChars: number;
  instagram: PlatformCaptionStats;
  linkedin: PlatformCaptionStats;
}

/**
 * 1. Duration Maths
 * Computes spoken duration in seconds at configurable WPM (default 130 WPM).
 * Checks against target duration chips (15s, 30s, 60s, 90s).
 */
export function calculateDurationStats(
  wordCount: number,
  targetSeconds: number = 60,
  wpm: number = 130
): ScriptDurationStats {
  const safeWpm = wpm > 0 ? wpm : 130;
  const estimatedSeconds = Math.round((wordCount / safeWpm) * 60);
  const diffSeconds = estimatedSeconds - targetSeconds;
  const isOverTarget = diffSeconds > 0;

  let warningMessage: string | undefined;
  if (isOverTarget) {
    warningMessage = `Estimated duration (${estimatedSeconds}s) exceeds your ${targetSeconds}s target by ${diffSeconds}s.`;
  }

  return {
    wordCount,
    wpm: safeWpm,
    estimatedSeconds,
    targetSeconds,
    isOverTarget,
    diffSeconds,
    warningMessage,
  };
}

/**
 * 2. Hook Check
 * Evaluates the first opening sentence or first line (up to 12 words limit).
 */
export function checkHook(fullText: string): HookCheckResult {
  if (!fullText || !fullText.trim()) {
    return {
      openingText: '',
      wordCount: 0,
      passes: true,
    };
  }

  // Remove HTML tags while preserving linebreaks / paragraph boundaries
  const cleaned = fullText
    .replace(/<\/(p|h[1-6]|tr|div|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();

  // Find first non-empty line or first sentence
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let openingLine = lines[0] || '';
  // If first line has a sentence break (. ! ?), take up to first sentence
  const sentenceMatch = openingLine.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch) {
    openingLine = sentenceMatch[0].trim();
  }

  const words = openingLine.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const passes = wordCount <= 12;

  let warningMessage: string | undefined;
  if (!passes) {
    warningMessage = `Hook is ${wordCount} words (limit: 12 words). May be too long for a 3-second reel drop-off threshold.`;
  }

  return {
    openingText: openingLine,
    wordCount,
    passes,
    warningMessage,
  };
}

/**
 * 3. Caption & Hashtag Platform Counters
 * Instagram limit: 2,200 chars.
 * LinkedIn limit: 3,000 chars.
 */
export function checkCaptionLimits(caption: string = '', hashtags: string = ''): CaptionAnalysis {
  const combined = [caption.trim(), hashtags.trim()].filter(Boolean).join('\n\n');
  const totalChars = combined.length;

  const instaMax = 2200;
  const instaRemaining = instaMax - totalChars;
  const instaPercent = Math.min(100, Math.round((totalChars / instaMax) * 100));

  const linkedinMax = 3000;
  const linkedinRemaining = linkedinMax - totalChars;
  const linkedinPercent = Math.min(100, Math.round((totalChars / linkedinMax) * 100));

  return {
    caption,
    hashtags,
    totalChars,
    instagram: {
      charCount: totalChars,
      maxChars: instaMax,
      remainingChars: instaRemaining,
      isOverLimit: totalChars > instaMax,
      percent: instaPercent,
    },
    linkedin: {
      charCount: totalChars,
      maxChars: linkedinMax,
      remainingChars: linkedinRemaining,
      isOverLimit: totalChars > linkedinMax,
      percent: linkedinPercent,
    },
  };
}

/**
 * 4. Two-Column Scene Table extraction & totals
 * Parses HTML or table DOM to calculate totals and shot list.
 */
export function extractSceneTableData(tableHtmlOrText: string): {
  rows: SceneTableRow[];
  totalEstimatedSeconds: number;
  shotList: ShotListItem[];
} {
  const rows: SceneTableRow[] = [];

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tableHtmlOrText, 'text/html');
    const trElements = doc.querySelectorAll('tr');

    let currentSceneNum = 1;
    trElements.forEach((tr, index) => {
      // Skip header row if contains <th>
      if (tr.querySelector('th') && index === 0) return;

      const cells = tr.querySelectorAll('td');
      if (cells.length >= 2) {
        let sceneNum = currentSceneNum;
        let visual = '';
        let audio = '';
        let estTime = 0;

        if (cells.length >= 4) {
          const rawDigits = cells[0].textContent?.replace(/\D/g, '') || '';
          const parsedNum = parseInt(rawDigits, 10);
          sceneNum = !isNaN(parsedNum) ? parsedNum : currentSceneNum;
          visual = cells[1].textContent?.trim() || '';
          audio = cells[2].textContent?.trim() || '';
          estTime = parseFloat(cells[3].textContent?.replace(/[^\d.]/g, '') || '0') || 0;
        } else if (cells.length === 3) {
          const firstText = cells[0].textContent?.trim() || '';
          const digitsInFirst = parseInt(firstText.replace(/\D/g, ''), 10);
          if (!isNaN(digitsInFirst) || /^(scene|shot|ദൃശ്യം)/i.test(firstText)) {
            sceneNum = !isNaN(digitsInFirst) ? digitsInFirst : currentSceneNum;
            visual = cells[1].textContent?.trim() || '';
            audio = cells[2].textContent?.trim() || '';
          } else {
            visual = cells[0].textContent?.trim() || '';
            audio = cells[1].textContent?.trim() || '';
            estTime = parseFloat(cells[2].textContent?.replace(/[^\d.]/g, '') || '0') || 0;
          }
        } else if (cells.length === 2) {
          visual = cells[0].textContent?.trim() || '';
          audio = cells[1].textContent?.trim() || '';
        }

        // If estTime not specified, estimate from spoken audio words (approx 130 WPM)
        if (estTime === 0 && audio) {
          const words = audio.split(/\s+/).filter(Boolean).length;
          estTime = Math.max(2, Math.round((words / 130) * 60));
        }

        if (visual || audio) {
          rows.push({
            sceneNumber: sceneNum,
            visual,
            audio,
            estTime,
          });
          currentSceneNum = sceneNum + 1;
        }
      }
    });
  }

  const totalEstimatedSeconds = rows.reduce((sum, r) => sum + (r.estTime || 0), 0);
  const shotList: ShotListItem[] = rows
    .filter((r) => r.visual.length > 0)
    .map((r) => ({
      sceneNumber: r.sceneNumber,
      visual: r.visual,
      audio: r.audio,
      estTime: r.estTime,
    }));

  return {
    rows,
    totalEstimatedSeconds,
    shotList,
  };
}

/**
 * 5. Script Templates Library
 * High-converting pre-structured industry formats
 */
export interface ScriptTemplate {
  id: string;
  title: string;
  description: string;
  badge: string;
  htmlContent: string;
}

export const SCRIPT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'reel-script',
    title: 'Reel Script (15s–60s)',
    badge: 'Reel',
    description: 'Hook (0–3s), Body / Value points (3–50s), Strong Call to Action (CTA).',
    htmlContent: `
<h1>Reel Script: [Working Title]</h1>
<p><strong>Target Duration:</strong> 45s | <strong>Target Audience:</strong> Students & Young Pros | <strong>Tone:</strong> High Energy</p>

<h3>Hook (0–3s)</h3>
<p><em>"Nobody told me robotics would look like this..."</em></p>

<h3>Body / Value Progression (3–40s)</h3>
<p>Here is what happens when you step into the HACA workshop for the first time.</p>
<table>
  <thead>
    <tr>
      <th>Scene #</th>
      <th>Visual (Shot / Action)</th>
      <th>Audio (Dialogue / VO)</th>
      <th>Est. Time (s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Fast zoom into buzzing robotic arm assembling circuit</td>
      <td>"From day one, you build real industrial prototypes."</td>
      <td>5</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Student smiles as automated rover navigates obstacle</td>
      <td>"No boring theory. Just pure hands-on problem solving."</td>
      <td>8</td>
    </tr>
    <tr>
      <td>3</td>
      <td>Split screen: schematic diagram & finished PCB board</td>
      <td>"Industry-grade tools, expert mentorship, zero fluff."</td>
      <td>10</td>
    </tr>
  </tbody>
</table>

<h3>Call to Action (CTA) (40–45s)</h3>
<p><strong>Visual:</strong> Speaker looks directly at lens, holds up prototype.<br/>
<strong>Dialogue:</strong> "Admissions for Winter 2026 are open. Tap the link in bio to reserve your workshop seat!"</p>
`,
  },
  {
    id: 'explainer',
    title: 'Explainer Video',
    badge: 'Video',
    description: 'Problem, Mechanism, Demonstration, Summary, CTA.',
    htmlContent: `
<h1>Explainer: [Concept / Product Name]</h1>
<p><strong>Goal:</strong> Demystify complex topic into 3 clear steps.</p>

<h3>1. The Problem</h3>
<p>Why do 80% of students struggle to land core tech roles right after graduation?</p>

<h3>2. The Mechanism</h3>
<p>Traditional colleges teach 10-year-old curriculum. HACA connects directly with live production pipelines.</p>

<h3>3. Real Demonstration</h3>
<table>
  <thead>
    <tr>
      <th>Scene #</th>
      <th>Visual</th>
      <th>Audio</th>
      <th>Est. Time (s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Screen recording: Git workflow & CI/CD deployment</td>
      <td>"Students push code straight into production on day three."</td>
      <td>12</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Mentor reviewing pull request with junior engineer</td>
      <td>"You learn peer review, code quality, and real-world standards."</td>
      <td>15</td>
    </tr>
  </tbody>
</table>

<h3>4. Summary & CTA</h3>
<p>"Ready to bridge the gap? Apply today at haca.edu."</p>
`,
  },
  {
    id: 'student-voices',
    title: 'Student Voices / Testimonial',
    badge: 'Story',
    description: 'Profile intro, Before state, Pivot point, HACA experience, Outcome.',
    htmlContent: `
<h1>Student Spotlight: [Student Name]</h1>
<p><strong>Program:</strong> Embedded Systems & Robotics | <strong>Current Role:</strong> Junior Robotics Engineer</p>

<h3>The Pivot</h3>
<p><em>"Before HACA, I knew theory from textbooks, but I had never held an oscilloscope or calibrated a brushless motor."</em></p>

<table>
  <thead>
    <tr>
      <th>Scene #</th>
      <th>Visual</th>
      <th>Audio</th>
      <th>Est. Time (s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Student working in lab soldering microcontroller</td>
      <td>"The faculty treated us like junior engineering colleagues from day one."</td>
      <td>10</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Cut to student speaking on camera, confident posture</td>
      <td>"In four months, I built three production-grade projects that landed me my job."</td>
      <td>12</td>
    </tr>
  </tbody>
</table>

<h3>Takeaway & Advice</h3>
<p>"If you want to actually build things, this is the only place you need to be."</p>
`,
  },
  {
    id: 'event-promo',
    title: 'Event Promo',
    badge: 'Event',
    description: 'Event name, Date/Location, Key takeaway, Urgency, CTA.',
    htmlContent: `
<h1>Event Promo: [Event Title 2026]</h1>
<p><strong>Date & Time:</strong> Saturday, Nov 15 · 10:00 AM IST | <strong>Location:</strong> HACA Main Campus & Online Stream</p>

<h3>Hook & Announcement</h3>
<p>Mark your calendar. The biggest student robotics showcase of 2026 is happening this Saturday!</p>

<table>
  <thead>
    <tr>
      <th>Scene #</th>
      <th>Visual</th>
      <th>Audio</th>
      <th>Est. Time (s)</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Fast montage of previous year showcase: crowd, robots, awards</td>
      <td>"Over 40 live autonomous robot demonstrations, 500+ attendees."</td>
      <td>8</td>
    </tr>
    <tr>
      <td>2</td>
      <td>Keynote speaker intro card with logo</td>
      <td>"Featuring guest judges from leading autonomous vehicle startups."</td>
      <td>7</td>
    </tr>
  </tbody>
</table>

<h3>Urgency & Registration</h3>
<p><strong>CTA:</strong> Seats are strictly limited to 150 guests. Scan the QR code or click the link to claim your free pass now!</p>
`,
  },
  {
    id: 'poster-copy',
    title: 'Poster & Social Copy',
    badge: 'Design',
    description: 'Headline, Subhead, Body copy, CTA, Hashtags.',
    htmlContent: `
<h1>Poster Copy: [Campaign Name]</h1>

<h3>Main Headline</h3>
<h1>STOP MEMORIZING. START BUILDING.</h1>

<h3>Subhead</h3>
<p>Kerala's premier experiential learning academy for hardware & software builders.</p>

<h3>Key Highlights (Bullets on Graphic)</h3>
<ul>
  <li>100% Project-Based Learning</li>
  <li>Industry Mentors & Live Lab Access</li>
  <li>Placement Assurance with Top Tech Partners</li>
</ul>

<h3>Call to Action (CTA Badge)</h3>
<p><strong>"Batch Starts Nov 2026 · Limited to 25 Seats · Apply at haca.edu"</strong></p>
`,
  },
  {
    id: 'carousel',
    title: 'Carousel (7 Slides)',
    badge: 'Carousel',
    description: 'Slide 1 (Hook/Cover), Slides 2–6 (Content progression), Slide 7 (CTA).',
    htmlContent: `
<h1>Instagram Carousel: [Topic Headline]</h1>

<h3>Slide 1 (Cover / Hook)</h3>
<h2>5 Things You Must Know Before Learning Robotics in 2026 👉</h2>
<p><em>(Bold typography, high contrast dark card)</em></p>

<h3>Slide 2 (Point 1: Fundamentals)</h3>
<p><strong>1. Stop buying kits before understanding C/C++.</strong><br/>
Real engineering begins with registers and memory management, not plug-and-play modules.</p>

<h3>Slide 3 (Point 2: Schematics)</h3>
<p><strong>2. Reading circuit schematics is a superpower.</strong><br/>
Learn KiCad early. Designing PCBs separates hobbyists from professional engineers.</p>

<h3>Slide 4 (Point 3: Kinematics)</h3>
<p><strong>3. Brush up on linear algebra.</strong><br/>
Forward & inverse kinematics require solid matrix mathematics.</p>

<h3>Slide 5 (Point 4: Debugging)</h3>
<p><strong>4. Get comfortable with a logic analyzer.</strong><br/>
Timing issues in I2C/SPI can only be diagnosed with the right tools.</p>

<h3>Slide 6 (Point 5: Real Projects)</h3>
<p><strong>5. Build one finished system over ten half-baked toys.</strong><br/>
Recruiters care about enclosure design, reliability, and code documentation.</p>

<h3>Slide 7 (Summary & Save)</h3>
<p><strong>Found this helpful?</strong><br/>
📌 Save for later · 💬 Drop your questions below · 🚀 Follow @haca_official for daily engineering guides.</p>
`,
  },
  {
    id: 'story-frame',
    title: '3-Frame Story Sequence',
    badge: 'Story',
    description: 'Question sticker, Value frame, Link sticker CTA.',
    htmlContent: `
<h1>Story Sequence: [Topic]</h1>

<h3>Frame 1 (Interactive Question)</h3>
<p><strong>Background:</strong> Workshop photo with poll sticker.<br/>
<strong>Sticker:</strong> "What is your biggest roadblock in learning embedded systems?"<br/>
[ A) Hardware Cost ] [ B) No Guidance ]</p>

<h3>Frame 2 (Insight / Solution)</h3>
<p><strong>Visual:</strong> Quick 5-second video snippet of mentor explaining a concept.<br/>
<strong>Text overlay:</strong> "Most beginners quit because tutorials skip real hardware debugging."</p>

<h3>Frame 3 (Link Sticker CTA)</h3>
<p><strong>Text:</strong> "We just opened free access to our Starter Workshop curriculum."<br/>
<strong>Link Sticker:</strong> [ TAP TO ACCESS FREE LAB ]</p>
`,
  },
];
