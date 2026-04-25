import type { ReportDocument } from '../../core/src';

export function renderMarkdownReport(report: ReportDocument) {
  const lines: string[] = [`# ${report.title}`, '', report.headline, ''];

  if (report.metrics.length) {
    lines.push('## Key Data', '');
    for (const metric of report.metrics) {
      lines.push(`- **${metric.label}:** ${metric.value}`);
    }
    lines.push('');
  }

  for (const section of report.sections) {
    lines.push(`## ${section.title}`, '', section.body, '');
    for (const item of section.items ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  for (const table of report.tables) {
    lines.push(`## ${table.title}`, '');
    lines.push(`| ${table.columns.join(' |')} |`);
    lines.push(`| ${table.columns.map(() => '---').join(' | ')} |`);
    for (const row of table.rows) {
      lines.push(`| ${row.join(' | ')} |`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
