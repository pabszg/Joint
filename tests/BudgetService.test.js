// tests/BudgetService.test.js
const { checkBudget, formatBudgetSave, formatStatusMessage } = require('../src/BudgetService');

const budgets = [
  { category: 'Groceries', limit: 300, alertThreshold: 80 },
  { category: 'Clothing', limit: 100, alertThreshold: 80 }
];

test('checkBudget returns null when category has no budget', () => {
  expect(checkBudget('Travel', 50, budgets)).toBeNull();
});

test('checkBudget returns null when spend is below threshold', () => {
  expect(checkBudget('Groceries', 100, budgets)).toBeNull(); // 33% < 80%
});

test('checkBudget returns warning object at 80% threshold', () => {
  const result = checkBudget('Groceries', 250, budgets); // 83%
  expect(result).not.toBeNull();
  expect(result.type).toBe('warning');
  expect(result.percentage).toBeCloseTo(83.3, 0);
});

test('checkBudget returns over_budget when spend exceeds limit', () => {
  const result = checkBudget('Clothing', 110, budgets);
  expect(result.type).toBe('over_budget');
  expect(result.percentage).toBeCloseTo(110, 0);
});

test('formatBudgetSave shows spend and budget', () => {
  const text = formatBudgetSave('Groceries', 142.30, 300, 47);
  expect(text).toContain('Groceries');
  expect(text).toContain('142.30');
  expect(text).toContain('300');
  expect(text).toContain('47%');
});

test('formatStatusMessage includes all categories with spend', () => {
  const expenses = [
    { category: 'Groceries', eurAmount: 142 },
    { category: 'Clothing', eurAmount: 90 }
  ];
  const text = formatStatusMessage(expenses, budgets, new Date('2026-06-03'), 30);
  expect(text).toContain('Groceries');
  expect(text).toContain('Clothing');
  expect(text).toContain('142');
});
