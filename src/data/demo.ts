/**
 * Demo data layer for BulletBoost frontend development.
 *
 * All data here is sample content used exclusively for UI prototyping.
 * This module is clearly separated so it can be replaced with real API
 * calls when the FastAPI backend is connected.
 */

import type {
  ResumeSection,
  EnhancedBullet,
} from '../types';
import { enhanceSingleBulletHeuristically } from '../services/heuristicEnhancer';

let nextId = 1;
function id(): string {
  return `demo-${nextId++}`;
}

// ── Sample parsed resume ────────────────────────────────────────────

export function getDemoSections(): ResumeSection[] {
  return [
    {
      id: id(),
      title: 'Professional Summary',
      type: 'summary',
      expanded: true,
      selected: true,
      bullets: [
        {
          id: id(),
          text: 'Full-stack software engineer with 4 years of experience building web applications using React, Node.js, and Python.',
          selected: true,
        },
        {
          id: id(),
          text: 'Experienced in agile development environments and cross-functional collaboration.',
          selected: true,
        },
      ],
    },
    {
      id: id(),
      title: 'Work Experience — Software Engineer, Acme Corp',
      type: 'experience',
      expanded: true,
      selected: true,
      bullets: [
        {
          id: id(),
          text: 'Developed and maintained several customer-facing features for the main product.',
          selected: true,
        },
        {
          id: id(),
          text: 'Worked on improving the performance of the search functionality.',
          selected: true,
        },
        {
          id: id(),
          text: 'Participated in code reviews and helped onboard new team members.',
          selected: true,
        },
        {
          id: id(),
          text: 'Wrote unit tests for critical business logic modules.',
          selected: true,
        },
      ],
    },
    {
      id: id(),
      title: 'Work Experience — Junior Developer, StartupXYZ',
      type: 'experience',
      expanded: false,
      selected: true,
      bullets: [
        {
          id: id(),
          text: 'Built REST APIs using Express.js and PostgreSQL.',
          selected: true,
        },
        {
          id: id(),
          text: 'Helped migrate the legacy codebase from JavaScript to TypeScript.',
          selected: true,
        },
        {
          id: id(),
          text: 'Fixed bugs reported by QA and improved error handling across the application.',
          selected: true,
        },
      ],
    },
    {
      id: id(),
      title: 'Projects',
      type: 'projects',
      expanded: false,
      selected: false,
      bullets: [
        {
          id: id(),
          text: 'Built a personal finance tracker using React and Firebase with real-time sync.',
          selected: false,
        },
        {
          id: id(),
          text: 'Created an open-source CLI tool for batch image resizing with 200+ GitHub stars.',
          selected: false,
        },
      ],
    },
    {
      id: id(),
      title: 'Education',
      type: 'education',
      expanded: false,
      selected: false,
      bullets: [
        {
          id: id(),
          text: 'B.S. Computer Science, State University, 2019. GPA: 3.7/4.0.',
          selected: false,
        },
        {
          id: id(),
          text: 'Relevant coursework: Data Structures, Algorithms, Database Systems, Software Engineering.',
          selected: false,
        },
      ],
    },
    {
      id: id(),
      title: 'Technical Skills',
      type: 'skills',
      expanded: false,
      selected: false,
      bullets: [
        {
          id: id(),
          text: 'Languages: TypeScript, JavaScript, Python, SQL. Frameworks: React, Next.js, Express, FastAPI. Tools: Git, Docker, AWS, PostgreSQL.',
          selected: false,
        },
      ],
    },
  ];
}

// ── Sample enhanced bullets ─────────────────────────────────────────

export function getDemoEnhancedBullets(
  sections: ResumeSection[]
): EnhancedBullet[] {
  let selectedBullets = sections.flatMap((s) =>
    s.bullets
      .filter((b) => b.selected)
      .map((b) => ({ bullet: b, sectionTitle: s.title }))
  );
  if (selectedBullets.length === 0) {
    selectedBullets = sections.flatMap((s) =>
      s.bullets.map((b) => ({ bullet: b, sectionTitle: s.title }))
    );
  }

  const improvements: Record<string, { improved: string; explanation: string; quality: EnhancedBullet['quality']; warnings: EnhancedBullet['warnings'] }> = {
    'Developed and maintained several customer-facing features for the main product.': {
      improved:
        'Developed and shipped 12 customer-facing features for the core SaaS product, contributing to a product line that served 15,000+ monthly active users.',
      explanation:
        'Added quantifiable scope (feature count, user base) to demonstrate impact. "Shipped" implies completion and delivery, not just development.',
      quality: 'strong',
      warnings: [
        {
          type: 'unverified-metric',
          message:
            'The metrics "12 features" and "15,000+ MAU" were generated by the model and should be verified against your actual experience.',
        },
      ],
    },
    'Worked on improving the performance of the search functionality.': {
      improved:
        'Optimized search query performance by implementing database indexing and caching strategies, reducing average response time from 1.2s to 180ms.',
      explanation:
        'Replaced vague "worked on improving" with specific technical actions and measurable outcome. Specifies the techniques used.',
      quality: 'strong',
      warnings: [
        {
          type: 'unverified-metric',
          message:
            'The response time figures (1.2s to 180ms) are illustrative. Replace with your actual measurements.',
        },
      ],
    },
    'Participated in code reviews and helped onboard new team members.': {
      improved:
        'Reviewed 50+ pull requests per quarter and mentored 3 new engineers through structured onboarding, reducing their ramp-up period.',
      explanation:
        'Quantified review volume and mentoring scope. "Mentored" is stronger than "helped onboard."',
      quality: 'adequate',
      warnings: [
        {
          type: 'unverified-metric',
          message:
            'PR count and mentee figures should reflect your actual experience.',
        },
        {
          type: 'vague-claim',
          message:
            '"Reducing their ramp-up period" lacks a specific measurement. Consider adding a timeline if available.',
        },
      ],
    },
    'Wrote unit tests for critical business logic modules.': {
      improved:
        'Authored comprehensive unit and integration tests for payment processing and user authentication modules, achieving 92% code coverage across critical paths.',
      explanation:
        'Specified which modules were tested and added a coverage metric. "Comprehensive" and "integration" indicate depth beyond basic unit tests.',
      quality: 'adequate',
      warnings: [
        {
          type: 'unverified-metric',
          message: 'The 92% coverage figure should be verified.',
        },
      ],
    },
    'Full-stack software engineer with 4 years of experience building web applications using React, Node.js, and Python.': {
      improved:
        'Full-stack engineer with 4 years of experience delivering production web applications in React, Node.js, and Python across B2B SaaS and startup environments.',
      explanation:
        'Added context about work environments and changed "building" to "delivering production" to emphasize completed, deployed work.',
      quality: 'strong',
      warnings: [],
    },
    'Experienced in agile development environments and cross-functional collaboration.': {
      improved:
        'Proven ability to deliver iteratively in Scrum teams of 5–8 engineers, collaborating closely with product managers, designers, and QA.',
      explanation:
        'Replaced generic "agile" and "cross-functional" with specific methodology, team size, and collaborator roles.',
      quality: 'adequate',
      warnings: [
        {
          type: 'vague-claim',
          message:
            'Team size is an estimate. Adjust to match your actual team composition.',
        },
      ],
    },
    'Built REST APIs using Express.js and PostgreSQL.': {
      improved:
        'Designed and implemented RESTful APIs using Express.js and PostgreSQL, supporting 30+ endpoints consumed by web and mobile clients.',
      explanation:
        'Added scope (endpoint count) and clarified the consumer base. "Designed and implemented" shows ownership beyond just coding.',
      quality: 'adequate',
      warnings: [
        {
          type: 'unverified-metric',
          message: 'Endpoint count should reflect your actual API surface.',
        },
      ],
    },
    'Helped migrate the legacy codebase from JavaScript to TypeScript.': {
      improved:
        'Led the incremental migration of a 40,000-line JavaScript codebase to TypeScript, reducing runtime type errors by an estimated 60%.',
      explanation:
        'Changed "helped" to "led" (verify your actual role). Added codebase size and error reduction metric for impact.',
      quality: 'needs-work',
      warnings: [
        {
          type: 'unverified-metric',
          message:
            'Codebase size and error reduction percentage are illustrative and must be verified.',
        },
        {
          type: 'missing-evidence',
          message:
            'If you did not lead this migration, adjust the verb to accurately reflect your contribution level.',
        },
      ],
    },
    'Fixed bugs reported by QA and improved error handling across the application.': {
      improved:
        'Resolved 120+ QA-reported defects and implemented centralized error handling with structured logging, reducing unhandled exceptions by 45%.',
      explanation:
        'Quantified bug fixes and described the error handling approach specifically. Added measurable impact.',
      quality: 'adequate',
      warnings: [
        {
          type: 'unverified-metric',
          message:
            'Bug count and exception reduction figures are generated estimates.',
        },
      ],
    },
  };

  return selectedBullets.map(({ bullet, sectionTitle }, idx) => {
    const match = improvements[bullet.text];
    if (match) {
      return {
        id: id(),
        originalBulletId: bullet.id,
        sectionTitle,
        original: bullet.text,
        improved: match.improved,
        editedImproved: null,
        explanation: match.explanation,
        quality: match.quality,
        warnings: match.warnings,
        status: 'pending' as const,
      };
    }
    const heuristic = enhanceSingleBulletHeuristically(bullet.text, idx, {
      targetRole: 'Software Professional',
      writingStyle: 'achievement',
    });
    return {
      id: id(),
      originalBulletId: bullet.id,
      sectionTitle,
      original: bullet.text,
      improved: heuristic.improved,
      editedImproved: null,
      explanation: heuristic.explanation,
      quality: 'strong',
      warnings: heuristic.warnings,
      alternativeTexts: heuristic.alternatives,
      status: 'pending' as const,
    };
  });
}

// ── Evaluation lab demo data ────────────────────────────────────────

export interface EvalMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  classDistribution: { label: string; count: number }[];
  confusionMatrix: number[][];
  classLabels: string[];
}

export function getDemoEvalMetrics(): EvalMetrics {
  return {
    accuracy: 0.847,
    precision: 0.832,
    recall: 0.861,
    f1Score: 0.846,
    datasetSize: 2400,
    trainSize: 1920,
    testSize: 480,
    classDistribution: [
      { label: 'Strong', count: 620 },
      { label: 'Adequate', count: 1180 },
      { label: 'Needs Work', count: 600 },
    ],
    confusionMatrix: [
      [102, 14, 8],
      [11, 196, 29],
      [6, 18, 96],
    ],
    classLabels: ['Strong', 'Adequate', 'Needs Work'],
  };
}
