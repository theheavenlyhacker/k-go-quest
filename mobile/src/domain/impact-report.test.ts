import { describe, expect, it } from 'vitest';
import recorded from './recorded/admin-impact-report.json';
import { parseImpactReport } from './admin';
import { formatImpactReport, impactReportHtml } from './impact-report';

describe('quarterly Impact Report', () => {
  it('uses server headline numbers and identical formatted values in PDF and screen', () => {
    const report = parseImpactReport({ ...recorded, learnersReached: 45, offlineUsageShare: 0.3571, meanEstimatedMasteryChange: -1.234, totalTablets: 8, tabletsCheckedInQuarter: 3 });
    const view = formatImpactReport(report);
    expect(view.tiles.map((t) => t.value)).toEqual(['45', '2', '84', '36%', '-1.23 pp']);
    const html = impactReportHtml(view);
    for (const tile of view.tiles) { expect(html).toContain(tile.label); expect(html).toContain(tile.value); }
    expect(html).toContain(view.dataQuality);
    expect(html).toContain(recorded.disclaimer);
    expect(view.dataQuality).toContain('28 of 30');
    expect(view.dataQuality).toContain('38%');
  });

  it('always includes disclaimer and quality footnote, even without reach or estimates', () => {
    const view = formatImpactReport(parseImpactReport({ ...recorded, learnersReached: 0, lessonsCompleted: 0, reachByBarangay: [], meanEstimatedMasteryChange: null, totalTablets: 0, tabletsCheckedInQuarter: 0 }));
    expect(view.tiles.at(-1)?.value).toBe('Unavailable');
    const html = impactReportHtml(view);
    expect(html).toContain(recorded.disclaimer);
    expect(html).toContain('Data quality');
    expect(html).toContain('No Shared Tablets registered');
    expect(html).not.toContain('NaN');
  });

  it('escapes server text and outputs aggregates without Learner aliases', () => {
    const view = formatImpactReport(parseImpactReport({ ...recorded, jurisdictionId: '<script>alert(1)</script>', disclaimer: 'Safe < & >', reachByBarangay: [{ barangay: '<Pembo>', learners: 3, lessons: 2, offlineLessons: 1 }], users: [{ alias: 'PRIVATE ALIAS' }] }));
    const html = impactReportHtml(view);
    expect(html).toContain('&lt;Pembo&gt;');
    expect(html).toContain('Safe &lt; &amp; &gt;');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('PRIVATE ALIAS');
  });
});
