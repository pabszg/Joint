// src/GeminiService.js

var GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

function buildSystemPrompt(categories, corrections, today) {
  var categoryList = categories.join(', ');

  var correctionsBlock = '';
  if (corrections.length > 0) {
    var examples = corrections.map(function(c) {
      return '- "' + c.merchant + '" → ' + c.userCorrection + ' (not ' + c.geminiGuess + ')';
    }).join('\n');
    correctionsBlock = '\n\nLearned corrections from this couple — prefer these:\n' + examples;
  }

  return [
    'You are an expense parser for a couple\'s shared expense tracker.',
    'Today\'s date is ' + today + '.',
    '',
    'Extract expense data from the user\'s message or receipt image.',
    'Return ONLY valid JSON matching this exact schema — no markdown, no explanation:',
    '{',
    '  "merchant": string,',
    '  "amount": number (no currency symbols),',
    '  "currency": string (ISO 4217, default "EUR"),',
    '  "date": string (ISO 8601, default today),',
    '  "category": string (MUST be one of the categories below),',
    '  "notes": string (empty string if none),',
    '  "confidence": number (0.0 to 1.0),',
    '  "has_items": boolean,',
    '  "items": []',
    '}',
    '',
    'Categories (use EXACTLY these names):',
    categoryList,
    correctionsBlock
  ].join('\n');
}

function parseGeminiResponse(responseText) {
  var result = JSON.parse(responseText);
  var content = result.candidates[0].content.parts[0].text;
  // Strip markdown code blocks if present
  var cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

function isLowConfidence(confidence) {
  return confidence < 0.7;
}

function classifyExpense(text, categories, corrections, apiKey) {
  var today = new Date().toISOString().split('T')[0];
  var prompt = buildSystemPrompt(categories, corrections, today);

  var payload = {
    contents: [{ role: 'user', parts: [{ text: prompt + '\n\nUser message: ' + text }] }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var response = UrlFetchApp.fetch(GEMINI_API_BASE + '?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return parseGeminiResponse(response.getContentText());
}

function classifyReceipt(imageBase64, mimeType, categories, corrections, apiKey) {
  var today = new Date().toISOString().split('T')[0];
  var prompt = buildSystemPrompt(categories, corrections, today);
  prompt += '\n\nExtract expense data from this receipt image.';

  var payload = {
    contents: [{
      role: 'user',
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
      ]
    }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  var response = UrlFetchApp.fetch(GEMINI_API_BASE + '?key=' + apiKey, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  return parseGeminiResponse(response.getContentText());
}

if (typeof module !== 'undefined') {
  module.exports = { buildSystemPrompt, parseGeminiResponse, isLowConfidence, classifyExpense, classifyReceipt };
}
