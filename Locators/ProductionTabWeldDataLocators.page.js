class ProductionTabWeldDataLocators {
  constructor(page) {
    this.page = page;
  }

  // ── Search ──────────────────────────────────────────────────────────────
  searchInput() {
    return this.page.locator('input[placeholder*="Search"], .search-bar input').first();
  }

  clearButton() {
    return this.page.locator('button:has(svg.lucide-x), .clear-search').first();
  }

  searchFallbackInput() {
    return this.page.locator('input[placeholder*="Search"]').first();
  }

  // ── Table ────────────────────────────────────────────────────────────────
  tableHeaders() {
    return this.page.locator('table thead th');
  }

  tableBodyRows() {
    return this.page.locator('table tbody tr');
  }

  firstDataRow() {
    return this.page.locator('table tbody tr').first();
  }

  activeTable() {
    return this.page.locator('table:visible').last();
  }

  firstTable() {
    return this.page.locator('table').first();
  }

  allTables() {
    return this.page.locator('table');
  }

  prodTableHeaders() {
    return this.page.locator('table thead th');
  }

  // ── Scroller ─────────────────────────────────────────────────────────────
  tableScroller() {
    return this.page.locator('div.relative.overflow-auto, [role="region"]').first();
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────
  tab(name) {
    return this.page.getByRole('tab', { name });
  }

  tabSelector() {
    return 'button[role="tab"]';
  }

  // ── Eye / Back buttons ────────────────────────────────────────────────────
  backButton() {
    return this.page.locator('button:has(svg.lucide-arrow-left), button[aria-label="Back"]').first();
  }

  eyeButtonInRow(row) {
    return row.locator('button:has(svg.lucide-eye), svg.lucide-eye').first();
  }

  eyeButtonInRowByCol(row, colIndex) {
    return row.locator(`td:nth-child(${colIndex}) button, td:nth-child(${colIndex}) svg.lucide-eye`).first();
  }

  weldDataEyeButton(row, colIndex) {
    return row.locator(`td:nth-child(${colIndex}) button`).first();
  }

  // ── Specific row by weld ID ───────────────────────────────────────────────
  rowByWeldId(idStr, colIndex) {
    return this.page.locator('table tbody tr').filter({
      has: this.page.locator(`td:nth-child(${colIndex})`).getByText(idStr, { exact: true })
    }).first();
  }

  // ── Cell selectors by column index ───────────────────────────────────────
  firstDataCellByColIndex(colIndex) {
    return this.page.locator(`table tbody tr:first-child td:nth-child(${colIndex})`);
  }

  allCellsByColIndex(colIndex) {
    return this.page.locator(`table tbody tr td:nth-child(${colIndex})`);
  }

  // ── Empty state ───────────────────────────────────────────────────────────
  noWeldDataText() {
    return this.page.getByText('No weld data available');
  }
}

module.exports = ProductionTabWeldDataLocators;