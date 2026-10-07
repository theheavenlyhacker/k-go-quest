import { impactReport, type ImpactReport, type Tile } from './admin';
import { escapeHtml, pct } from './format';

/** One aggregate-only formatter shared by the screen and printable report. */
export function formatImpactReport(report: ImpactReport) {
  const quarter = report.quarter ?? 'Unavailable';
  const { tiles, barangays } = impactReport((report.reachByBarangay ?? []).map((b) => ({
    quarter, barangay: b.barangay, learners: b.learners, lessons: b.lessons, offlineLessons: b.offlineLessons,
  })), quarter);
  // Headline aggregates need not equal the rows (e.g. Learners without a school).
  tiles[0].value = report.learnersReached?.toLocaleString('en-US') ?? 'Unavailable';
  tiles[2].value = report.lessonsCompleted?.toLocaleString('en-US') ?? 'Unavailable';
  tiles[3].value = report.offlineUsageShare == null ? 'Unavailable' : pct(report.offlineUsageShare);
  tiles.push({ key: 'mastery', label: 'Mean estimated Mastery change', value: report.meanEstimatedMasteryChange == null ? 'Unavailable' : `${report.meanEstimatedMasteryChange > 0 ? '+' : ''}${report.meanEstimatedMasteryChange.toFixed(2)} pp`, tone: 'brand' } satisfies Tile);
  const total = report.totalTablets;
  const checked = report.tabletsCheckedInQuarter;
  const coverage = total === 0 ? 'No Shared Tablets registered.' : total == null || checked == null
    ? 'Shared Tablet check-in coverage unavailable.'
    : `${pct(checked / total)} (${checked.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}) of registered Shared Tablets have their latest recorded check-in in this quarter.`;
  return {
    jurisdiction: report.jurisdictionId, quarter, tiles, barangays, disclaimer: report.disclaimer,
    dataQuality: `Data quality: ${report.studentsWithPractice.toLocaleString('en-US')} of ${report.activeStudents.toLocaleString('en-US')} currently provisioned Learners have recorded practice. ${coverage} Past-quarter coverage is a lower bound: later check-ins replace earlier records. Mastery change uses server receipt months, averages skill changes per provisioned Learner, and counts missing practice as zero.`,
  };
}

export function impactReportHtml(view: ReturnType<typeof formatImpactReport>): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>LGU Impact Report</title>
<style>@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#182b27;font-size:12px}h1{font-size:25px}.tiles{display:flex;flex-wrap:wrap;gap:12px}.tile{border:1px solid #c9d6d0;padding:12px;width:40%;break-inside:avoid}.value{font-size:23px;font-weight:bold}table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #d5dfdb}tr{break-inside:avoid}.track{height:9px;background:#e8eeeb}.bar{height:9px;background:#23614f}p{line-height:1.5;white-space:pre-wrap}</style></head><body>
<h1>LGU Impact Report</h1><p>Jurisdiction: ${escapeHtml(view.jurisdiction)} · ${escapeHtml(view.quarter)}</p>
<div class="tiles">${view.tiles.map((t) => `<div class="tile"><div class="value">${escapeHtml(t.value)}</div>${escapeHtml(t.label)}</div>`).join('')}</div>
<h2>Reach by barangay</h2><table><thead><tr><th>Barangay</th><th>Learners reached</th><th>Reach</th></tr></thead><tbody>${view.barangays.map((b) => `<tr><td>${escapeHtml(b.name)}</td><td>${b.learners.toLocaleString('en-US')}</td><td><div class="track"><div class="bar" style="width:${Math.round(b.share * 100)}%"></div></div></td></tr>`).join('')}</tbody></table>
${view.barangays.length ? '' : '<p>No reach recorded in this quarter.</p>'}
<p>${escapeHtml(view.disclaimer)}</p><p>${escapeHtml(view.dataQuality)}</p></body></html>`;
}
