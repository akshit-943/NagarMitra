import PDFDocument from 'pdfkit';

/**
 * CivicPulse AI — Professional Civic Impact & Transparency PDF Generator
 * 
 * Generates an executive-ready, downloadable municipal transparency report
 * using actual database records and deterministic analytics.
 * Strictly omits all personal citizen identifiers and confidential internal notes.
 */
export const generateCivicImpactPdf = (reportData, res) => {
  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    info: {
      Title: 'CivicPulse AI — Municipal Civic Impact & Transparency Report',
      Author: 'CivicPulse AI Municipal Intelligence Platform',
      Subject: 'Public Civic Grievance & SLA Performance Audit',
    },
  });

  // Pipe directly to HTTP response stream
  doc.pipe(res);

  const colors = {
    primary: '#191B1D',      // Deep charcoal
    secondary: '#4B4E54',    // Muted charcoal
    muted: '#7E828B',        // Subtle grey
    accent: '#8CA81F',       // Olive/Lime green
    border: '#E6E5DE',       // Soft border
    bgBox: '#F7F7F4',        // Warm off-white
    alertRose: '#9E2A2B',
  };

  const {
    filterSummary = {},
    overview = {},
    categoryDistribution = [],
    departmentPerformance = [],
    hotspots = [],
    recommendations = [],
    generatedAt = new Date().toLocaleString(),
  } = reportData;

  // ---------------------------------------------------------------------------
  // 1. HEADER & BRANDING
  // ---------------------------------------------------------------------------
  doc.rect(40, 40, 515, 60).fill(colors.bgBox);
  doc.rect(40, 40, 515, 60).stroke(colors.border);

  // Logo pill
  doc.circle(65, 70, 14).fill(colors.primary);
  doc.circle(65, 70, 5).fill(colors.accent);

  doc.fillColor(colors.primary).fontSize(16).font('Helvetica-Bold')
    .text('CivicPulse AI', 90, 55);

  doc.fillColor(colors.secondary).fontSize(9).font('Helvetica')
    .text('Municipal Civic Grievance & Public Impact Intelligence Report', 90, 74);

  doc.fillColor(colors.muted).fontSize(8)
    .text(`Generated: ${generatedAt}`, 360, 56, { align: 'right', width: 180 })
    .text(`Period: ${filterSummary.timeRangeLabel || 'All Time'}`, 360, 72, { align: 'right', width: 180 });

  doc.moveDown(2);

  // ---------------------------------------------------------------------------
  // 2. EXECUTIVE SUMMARY & KEY PERFORMANCE INDICATORS
  // ---------------------------------------------------------------------------
  let currentY = 115;
  doc.fillColor(colors.primary).fontSize(12).font('Helvetica-Bold')
    .text('1. Executive Transparency Overview', 40, currentY);

  currentY += 18;

  // 4 KPI Cards
  const cardW = 120;
  const cardH = 46;
  const cards = [
    { label: 'Citizen Reports', value: `${overview.totalComplaints || 0}`, note: 'Individual reports' },
    { label: 'Master Issues', value: `${overview.totalMasterIssues || 0}`, note: 'Unique civic issues' },
    { label: 'Resolution Rate', value: `${overview.resolutionRate || 0}%`, note: `${overview.resolvedIssues || 0} resolved` },
    { label: 'SLA Compliance', value: `${overview.slaComplianceRate || 100}%`, note: `${overview.overdueIssues || 0} overdue` },
  ];

  cards.forEach((c, i) => {
    const x = 40 + i * (cardW + 11);
    doc.rect(x, currentY, cardW, cardH).fill(colors.bgBox).stroke(colors.border);
    doc.fillColor(colors.muted).fontSize(7.5).font('Helvetica')
      .text(c.label, x + 8, currentY + 6);
    doc.fillColor(colors.primary).fontSize(14).font('Helvetica-Bold')
      .text(c.value, x + 8, currentY + 18);
    doc.fillColor(colors.secondary).fontSize(7).font('Helvetica')
      .text(c.note, x + 8, currentY + 34);
  });

  currentY += cardH + 16;

  // Secondary metrics line
  doc.fillColor(colors.secondary).fontSize(8).font('Helvetica')
    .text(
      `Active Workload: ${overview.inProgressIssues || 0} In Progress • ${overview.awaitingActionIssues || 0} Awaiting Action • Average Cycle Time: ${overview.avgResolutionHours || 0} hours`,
      40, currentY
    );

  currentY += 22;

  // ---------------------------------------------------------------------------
  // 3. CATEGORY DISTRIBUTION TABLE
  // ---------------------------------------------------------------------------
  doc.fillColor(colors.primary).fontSize(12).font('Helvetica-Bold')
    .text('2. Civic Grievance Category Breakdown', 40, currentY);

  currentY += 16;

  // Table header
  doc.rect(40, currentY, 515, 18).fill('#ECE8F9');
  doc.fillColor(colors.primary).fontSize(8).font('Helvetica-Bold')
    .text('Category', 50, currentY + 5)
    .text('Master Issues', 240, currentY + 5)
    .text('Citizen Reports', 340, currentY + 5)
    .text('Share (%)', 460, currentY + 5);

  currentY += 18;

  const cats = categoryDistribution.slice(0, 6);
  if (cats.length === 0) {
    doc.fillColor(colors.muted).fontSize(8).font('Helvetica')
      .text('No category records recorded for the selected filter interval.', 50, currentY + 6);
    currentY += 20;
  } else {
    cats.forEach((cat, idx) => {
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : colors.bgBox;
      doc.rect(40, currentY, 515, 16).fill(rowBg);
      doc.fillColor(colors.primary).fontSize(8).font('Helvetica')
        .text(cat.category, 50, currentY + 4)
        .text(`${cat.masterCount || cat.count || 0}`, 240, currentY + 4)
        .text(`${cat.reportCount || cat.count || 0}`, 340, currentY + 4)
        .text(`${cat.percentage || 0}%`, 460, currentY + 4);
      currentY += 16;
    });
  }

  currentY += 14;

  // ---------------------------------------------------------------------------
  // 4. DEPARTMENT PERFORMANCE & SLA COMPLIANCE
  // ---------------------------------------------------------------------------
  doc.fillColor(colors.primary).fontSize(12).font('Helvetica-Bold')
    .text('3. Municipal Department Performance Matrix', 40, currentY);

  currentY += 16;

  // Department Table Header
  doc.rect(40, currentY, 515, 18).fill('#E3ECE1');
  doc.fillColor(colors.primary).fontSize(7.5).font('Helvetica-Bold')
    .text('Department', 50, currentY + 5)
    .text('Total', 220, currentY + 5)
    .text('Resolved', 270, currentY + 5)
    .text('Overdue', 330, currentY + 5)
    .text('Res. Rate', 390, currentY + 5)
    .text('SLA Compliance', 460, currentY + 5);

  currentY += 18;

  const depts = departmentPerformance.slice(0, 7);
  if (depts.length === 0) {
    doc.fillColor(colors.muted).fontSize(8).font('Helvetica')
      .text('No department assignments recorded for this period.', 50, currentY + 6);
    currentY += 20;
  } else {
    depts.forEach((dept, idx) => {
      const rowBg = idx % 2 === 0 ? '#FFFFFF' : colors.bgBox;
      doc.rect(40, currentY, 515, 16).fill(rowBg);
      doc.fillColor(colors.primary).fontSize(7.5).font('Helvetica')
        .text(dept.department, 50, currentY + 4, { width: 165, ellipsis: true })
        .text(`${dept.totalAssigned || dept.total || 0}`, 220, currentY + 4)
        .text(`${dept.resolved || 0}`, 270, currentY + 4)
        .text(`${dept.overdue || 0}`, 330, currentY + 4)
        .text(`${dept.resolutionRate || 0}%`, 390, currentY + 4)
        .text(`${dept.slaComplianceRate || 100}%`, 460, currentY + 4);
      currentY += 16;
    });
  }

  currentY += 16;

  // ---------------------------------------------------------------------------
  // 5. DETERMINISTIC RESOURCE ALLOCATION RECOMMENDATIONS
  // ---------------------------------------------------------------------------
  doc.fillColor(colors.primary).fontSize(12).font('Helvetica-Bold')
    .text('4. Resource Allocation & Operational Insights', 40, currentY);

  currentY += 16;

  const recs = recommendations.slice(0, 3);
  if (recs.length === 0) {
    doc.rect(40, currentY, 515, 34).fill(colors.bgBox).stroke(colors.border);
    doc.fillColor(colors.secondary).fontSize(8).font('Helvetica')
      .text('All municipal infrastructure clusters are currently performing within acceptable SLA thresholds. Continue routine inspection dispatch.', 50, currentY + 10, { width: 495 });
    currentY += 42;
  } else {
    recs.forEach((rec) => {
      doc.rect(40, currentY, 515, 42).fill(colors.bgBox).stroke(colors.border);
      doc.fillColor(colors.primary).fontSize(8.5).font('Helvetica-Bold')
        .text(`${rec.area} • ${rec.category} [${rec.urgency || 'Priority'} Attention]`, 50, currentY + 6);
      doc.fillColor(colors.secondary).fontSize(7.5).font('Helvetica')
        .text(`Finding: ${rec.reason}`, 50, currentY + 18, { width: 495 })
        .text(`Suggested Municipal Action: ${rec.suggestedAction}`, 50, currentY + 29, { width: 495 });
      currentY += 48;
    });
  }

  // ---------------------------------------------------------------------------
  // 6. LEGAL & PRIVACY TRANSPARENCY DISCLAIMER FOOTER
  // ---------------------------------------------------------------------------
  doc.rect(40, 750, 515, 45).fill('#F0EFEA').stroke(colors.border);
  doc.fillColor(colors.muted).fontSize(7).font('Helvetica')
    .text(
      'CivicPulse AI Public Transparency Engine • Generated from live verified database records.',
      50, 756
    )
    .text(
      'Privacy Safeguard Notice: In accordance with public transparency standards, all individual resident identities, contact information, private officer emails, and internal authority communications are strictly omitted from this document.',
      50, 766, { width: 495 }
    )
    .text(
      'System-Generated Notice: Analytical recommendations are computational proposals intended for municipal resource planning, not binding administrative decrees.',
      50, 779, { width: 495 }
    );

  doc.end();
};
