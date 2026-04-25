import type { ReportDocument, ReportTable } from '../../core/src';

export function renderTerminalReport(report: ReportDocument) {
  const lines: string[] = [`* ${report.headline}`, ''];

  if (report.metrics.length) {
    lines.push('Key data:');
    for (const metric of report.metrics) {
      lines.push(`- ${metric.label}: ${metric.value}`);
    }
    lines.push('');
  }

  for (const section of report.sections) {
    lines.push(section.title);
    lines.push('');
    lines.push(section.body);
    for (const item of section.items ?? []) {
      lines.push(`- ${item}`);
    }
    lines.push('');
  }

  for (const table of report.tables) {
    lines.push(table.title);
    lines.push('');
    lines.push(renderTable(table));
    lines.push('');
  }

  if (report.recommendedActions.length) {
    lines.push('Recommended actions:');
    for (const action of report.recommendedActions) {
      lines.push(`- ${action}`);
    }
  }

  return lines.join('\n').trimEnd();
}

function renderTable(table: ReportTable) {
  const widths = table.columns.map((column, index) => {
    const cells = table.rows.map((row) => row[index] ?? '');
    return Math.max(column.length, ...cells.map((cell) => cell.length));
  });
  const border = `+${widths.map((width) => '-'.repeat(width + 2)).join('+')}+`;
  const header = rowLine(table.columns, widths);
  const rows = table.rows.map((row) => rowLine(row, widths));

  return [border, header, border, ...rows, border].join('\n');
}

function rowLine(row: string[], widths: number[]) {
  return `|${widths.map((width, index) => ` ${(row[index] ?? '').padEnd(width)} `).join('|')}|`;
}
