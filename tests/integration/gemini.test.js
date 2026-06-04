// tests/integration/gemini.test.js
// Real Gemini API call — requires a valid GEMINI_API_KEY in .env

require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CATEGORIES = [
  'Alquiler', 'Supermercado', 'Restaurantes', 'Delivery', 'Transporte',
  'Salud', 'Ropa', 'Entretenimiento', 'Suscripciones',
  'Hogar y Limpieza', 'Viajes', 'Formación', 'Ahorros', 'Otros', 'Comisiones y Banco'
];

function buildPrompt(userText) {
  const today = new Date().toISOString().split('T')[0];
  return [
    "You are an expense parser for a couple's shared expense tracker.",
    `Today's date is ${today}.`,
    '',
    "Extract expense data from the user's message.",
    'Return ONLY valid JSON matching this exact schema — no markdown, no explanation:',
    '{',
    '  "merchant": string,',
    '  "amount": number,',
    '  "currency": string (ISO 4217, default "EUR"),',
    '  "date": string (ISO 8601),',
    '  "category": string (MUST be one of the categories below),',
    '  "notes": string,',
    '  "confidence": number (0.0 to 1.0)',
    '}',
    '',
    'Categories: ' + CATEGORIES.join(', '),
    '',
    'User message: ' + userText
  ].join('\n');
}

async function classifyExpense(text) {
  const res = await fetch(`${API_URL}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(text) }] }],
      generationConfig: { responseMimeType: 'application/json' }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const raw = data.candidates[0].content.parts[0].text;
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

(async () => {
  console.log('\n=== Gemini Integration Tests ===\n');

  if (!API_KEY) {
    console.error('❌ GEMINI_API_KEY not set in .env');
    process.exit(1);
  }

  const testCases = [
    { input: 'Mercadona 47.30',    expectCategory: 'Supermercado',  expectCurrency: 'EUR' },
    { input: 'Uber Eats pizza 22€', expectCategory: 'Delivery',     expectCurrency: 'EUR' },
    { input: 'Netflix 15.99 EUR',  expectCategory: 'Suscripciones', expectCurrency: 'EUR' }
  ];

  let passed = 0;
  for (const tc of testCases) {
    process.stdout.write(`  "${tc.input}" → `);
    try {
      const result = await classifyExpense(tc.input);
      const catOk = result.category === tc.expectCategory;
      const curOk = result.currency === tc.expectCurrency;
      const amountOk = typeof result.amount === 'number' && result.amount > 0;

      if (catOk && curOk && amountOk) {
        console.log(`✅  ${result.merchant} | ${result.amount} ${result.currency} | ${result.category} (confidence: ${result.confidence})`);
        passed++;
      } else {
        console.log(`⚠️  ${JSON.stringify(result)}`);
        if (!catOk) console.log(`     Expected category "${tc.expectCategory}", got "${result.category}"`);
        if (!curOk) console.log(`     Expected currency "${tc.expectCurrency}", got "${result.currency}"`);
        if (!amountOk) console.log(`     Invalid amount: ${result.amount}`);
      }
    } catch (err) {
      console.error(`❌  Error: ${err.message}`);
    }
  }

  console.log(`\n${passed}/${testCases.length} test cases passed`);
  if (passed === testCases.length) {
    console.log('=== Gemini: All checks passed ✅ ===\n');
  } else {
    console.log('=== Gemini: Some checks failed ⚠️  ===\n');
    process.exit(1);
  }
})();
