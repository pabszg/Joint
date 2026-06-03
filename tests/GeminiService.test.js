// tests/GeminiService.test.js
const { buildSystemPrompt, parseGeminiResponse, isLowConfidence } = require('../src/GeminiService');

const CATEGORIES = [
  'Rent','Groceries','Dining out','Delivery','Transport','Health',
  'Clothing','Entertainment','Subscriptions','Home & Cleaning',
  'Travel','Learning','Savings','Other','Fees & Banking'
];

test('buildSystemPrompt includes all categories', () => {
  const prompt = buildSystemPrompt(CATEGORIES, [], '2026-06-03');
  CATEGORIES.forEach(cat => expect(prompt).toContain(cat));
});

test('buildSystemPrompt includes today date', () => {
  const prompt = buildSystemPrompt(CATEGORIES, [], '2026-06-03');
  expect(prompt).toContain('2026-06-03');
});

test('buildSystemPrompt injects corrections as few-shot examples', () => {
  const corrections = [
    { merchant: 'Mercadona', geminiGuess: 'Dining out', userCorrection: 'Groceries' }
  ];
  const prompt = buildSystemPrompt(CATEGORIES, corrections, '2026-06-03');
  expect(prompt).toContain('Mercadona');
  expect(prompt).toContain('Groceries');
  expect(prompt).toContain('Dining out');
});

test('parseGeminiResponse extracts structured expense', () => {
  const raw = JSON.stringify({
    candidates: [{
      content: { parts: [{ text: JSON.stringify({
        merchant: 'Mercadona', amount: 47.30, currency: 'EUR',
        date: '2026-06-03', category: 'Groceries', notes: '',
        confidence: 0.97, has_items: false, items: []
      })}] }
    }]
  });
  // parseGeminiResponse is a pure extraction from an already-fetched response text
  const parsed = parseGeminiResponse(raw);
  expect(parsed.merchant).toBe('Mercadona');
  expect(parsed.amount).toBe(47.30);
  expect(parsed.confidence).toBe(0.97);
});

test('isLowConfidence returns true below 0.7', () => {
  expect(isLowConfidence(0.65)).toBe(true);
  expect(isLowConfidence(0.69)).toBe(true);
});

test('isLowConfidence returns false at 0.7 or above', () => {
  expect(isLowConfidence(0.7)).toBe(false);
  expect(isLowConfidence(0.97)).toBe(false);
});
