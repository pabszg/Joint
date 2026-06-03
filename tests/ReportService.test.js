// tests/ReportService.test.js
const { buildWeeklyDigest, buildMonthlyReport } = require('../src/ReportService');

const budgets = [
  { category: 'Groceries', limit: 300, alertThreshold: 80 },
  { category: 'Dining out', limit: 150, alertThreshold: 80 },
  { category: 'Clothing', limit: 100, alertThreshold: 80 }
];

const expenses = [
  { category: 'Groceries', eurAmount: 142, person: 'Pablo' },
  { category: 'Dining out', eurAmount: 46, person: 'Ana' },
  { category: 'Clothing', eurAmount: 90, person: 'Ana' }
];

test('buildWeeklyDigest includes total amount', () => {
  const text = buildWeeklyDigest(expenses, budgets, 300);
  expect(text).toContain('278'); // 142+46+90
});

test('buildWeeklyDigest includes top categories', () => {
  const text = buildWeeklyDigest(expenses, budgets, 300);
  expect(text).toContain('Groceries');
  expect(text).toContain('Clothing');
});

test('buildMonthlyReport includes per-person split', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 500);
  expect(text).toContain('Pablo');
  expect(text).toContain('Ana');
});

test('buildMonthlyReport shows under-budget celebration when total < budget', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 600);
  expect(text).toContain('🎉');
});

test('buildMonthlyReport shows over-budget warning when total > budget', () => {
  const text = buildMonthlyReport(expenses, budgets, 'May 2026', 200);
  expect(text).toContain('over budget');
});
