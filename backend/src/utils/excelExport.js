const ExcelJS = require('exceljs');

/**
 * Stream an achievement report as an Excel file to the HTTP response.
 *
 * @param {object} res - Express response object
 * @param {Array}  rows - Achievement data rows
 * @param {string} filename - Desired filename (without extension)
 */
async function streamAchievementReport(res, rows, filename = 'coresync_report') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'CoreSync';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Achievement Report', {
    pageSetup: { orientation: 'landscape' },
  });

  // ── Header style ───────────────────────────────────────────────────────
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };

  // ── Define columns ─────────────────────────────────────────────────────
  sheet.columns = [
    { header: 'Employee',      key: 'employee_name',    width: 22 },
    { header: 'Department',    key: 'department',       width: 18 },
    { header: 'Thrust Area',   key: 'thrust_area',      width: 22 },
    { header: 'Goal Title',    key: 'title',            width: 38 },
    { header: 'UoM',           key: 'uom_type',         width: 12 },
    { header: 'Target',        key: 'target_value',     width: 12 },
    { header: 'Quarter',       key: 'quarter',          width: 10 },
    { header: 'Actual',        key: 'actual_value',     width: 12 },
    { header: 'Progress %',    key: 'progress_score',   width: 14 },
    { header: 'Status',        key: 'progress_status',  width: 16 },
    { header: 'Momentum',      key: 'momentum_flag',    width: 16 },
    { header: 'Weightage %',   key: 'weightage',        width: 14 },
    { header: 'Goal Status',   key: 'goal_status',      width: 14 },
    { header: 'Manager',       key: 'manager_name',     width: 22 },
  ];

  // Apply header styles
  sheet.getRow(1).eachCell(cell => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF3730A3' } },
    };
  });
  sheet.getRow(1).height = 28;

  // ── Status color map ───────────────────────────────────────────────────
  const momentumColors = {
    ACCELERATING: 'FF10B981',
    STABLE:       'FF6B7280',
    DECELERATING: 'FFF59E0B',
  };

  const statusColors = {
    COMPLETED:   'FF10B981',
    ON_TRACK:    'FF4F46E5',
    NOT_STARTED: 'FF94A3B8',
  };

  // ── Add data rows ──────────────────────────────────────────────────────
  rows.forEach((row, idx) => {
    const dataRow = sheet.addRow({
      employee_name:   row.employee_name,
      department:      row.department,
      thrust_area:     row.thrust_area,
      title:           row.title,
      uom_type:        row.uom_type,
      target_value:    row.target_value ?? row.target_date ?? '-',
      quarter:         row.quarter || '-',
      actual_value:    row.actual_value ?? row.actual_date ?? '-',
      progress_score:  row.progress_score != null
                         ? `${(row.progress_score * 100).toFixed(1)}%`
                         : '-',
      progress_status: row.progress_status || '-',
      momentum_flag:   row.momentum_flag || '-',
      weightage:       `${row.weightage}%`,
      goal_status:     row.goal_status,
      manager_name:    row.manager_name || '-',
    });

    // Alternate row shading
    const bg = idx % 2 === 0 ? 'FFFAFAFF' : 'FFFFFFFF';
    dataRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
      cell.alignment = { vertical: 'middle' };
    });

    // Color momentum cell
    if (row.momentum_flag) {
      const momentumCell = dataRow.getCell('momentum_flag');
      momentumCell.font = { color: { argb: momentumColors[row.momentum_flag] || 'FF6B7280' }, bold: true };
    }

    // Color status cell
    if (row.progress_status) {
      const statusCell = dataRow.getCell('progress_status');
      statusCell.font = { color: { argb: statusColors[row.progress_status] || 'FF6B7280' }, bold: true };
    }

    dataRow.height = 22;
  });

  // ── Auto-filter on header row ──────────────────────────────────────────
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: sheet.columns.length },
  };

  // Freeze header row
  sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

  // ── Add summary sheet ──────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary');
  summary.addRow(['CoreSync Achievement Report']);
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.addRow(['Generated:', new Date().toLocaleString()]);
  summary.addRow(['Total Goals:', rows.length]);
  const completed = rows.filter(r => r.progress_status === 'COMPLETED').length;
  const onTrack   = rows.filter(r => r.progress_status === 'ON_TRACK').length;
  summary.addRow(['Completed:', completed]);
  summary.addRow(['On Track:', onTrack]);
  summary.addRow(['Not Started:', rows.length - completed - onTrack]);
  summary.columns = [{ width: 24 }, { width: 20 }];

  // ── Stream to response ─────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}_${Date.now()}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { streamAchievementReport };
