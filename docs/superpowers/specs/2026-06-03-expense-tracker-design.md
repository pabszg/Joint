# Expense Tracker for Couples — Design Spec
**Date:** 2026-06-03  
**Status:** Approved  
**Inspiration:** [HogarBot](https://hogarbot.netlify.app/)

---

## Overview

A Telegram bot for couples to track shared household expenses with minimal friction. Users send text messages or receipt photos; Gemini AI classifies and extracts structured expense data; Google Apps Script orchestrates everything; Google Sheets is the database and dashboard; Google Drive stores receipt images. Designed in the spirit of SAP Concur — with receipt capture, confirmation flows, budget enforcement, and monthly reporting.

---

## Architecture

### Components

```
Telegram (user) 
  → Apps Script Webhook 
    → Gemini API (text + image classification) 
    → Google Sheets (data storage + dashboard) 
    → Google Drive (receipt image storage)
  ← Apps Script (confirmation + alerts + reports)
← Telegram (user)
```

### Apps Script Modules

| File | Responsibility |
|------|----------------|
| `Webhook.gs` | Receives Telegram webhook POST, routes to handlers |
| `GeminiService.gs` | Calls Gemini API for text and image classification |
| `SheetsService.gs` | All read/write operations on Google Sheets |
| `DriveService.gs` | Downloads Telegram file, saves to Google Drive folder |
| `TelegramService.gs` | Sends messages, keyboards, and confirmations via Bot API |
| `ReportService.gs` | Generates weekly digests and monthly summaries |
| `StateService.gs` | Manages ephemeral conversation state via PropertiesService |
| `BudgetService.gs` | Checks spending against limits, triggers alerts |
| `Config.gs` | Reads settings from the Config tab; single source of truth |

---

## Telegram Conversation Flows

### 1. Text Expense Entry
1. User sends: `"Mercadona 47.30"` (or natural language like `"spent 12 on coffee"`)
2. Bot calls Gemini, receives JSON
3. Bot replies with parsed data + inline keyboard: **✅ Confirm / ✏️ Edit / ❌ Cancel**
4. On confirm → row appended to Expenses tab, budget check run
5. Bot confirms save + shows category budget progress: `"Groceries: €142 / €300 (47%)"`

### 2. Receipt Photo Entry
1. User sends a photo (with optional caption)
2. Bot replies: `"⏳ Reading receipt…"`
3. Apps Script downloads image from Telegram, converts to base64
4. Gemini processes image → returns JSON (merchant, amount, currency, date, category, items[])
5. Receipt image saved to Google Drive under `Receipts/YYYY-MM/`
6. Bot sends confirmation message with Drive link + inline keyboard
7. On confirm → row appended with receipt URL, budget check run

### 3. Edit Flow (✏️)
1. Bot asks which field to edit: Merchant / Amount / Category / Date
2. User replies with corrected value
3. Correction stored in Corrections tab (for reinforcement learning)
4. Updated data confirmed and saved

### 4. /status Command
Returns a live spending snapshot for the current month:
- Total spent vs total budget
- Month-end projection (linear extrapolation)
- Per-category breakdown with progress bars (emoji-based) and alert indicators

### 5. Weekly Digest (Auto)
- Triggered every Sunday at 20:00 via Apps Script time-based trigger
- Sent to both users in Telegram
- Contains: week total, top 3 categories, remaining monthly budget

### 6. Monthly Report (Auto)
- Triggered on the 1st of each month via Apps Script time-based trigger
- Sent to both users in Telegram
- Contains: total vs budget, per-person split, top 5 categories, month-over-month delta
- Includes link to the Reports tab in Sheets

### 7. Budget Alert
- Triggered automatically after every expense save
- Fires when a category reaches the configured alert threshold (default 80%)
- Message: `"⚠️ Clothing budget at 89% (€89.95 / €100)"`

---

## Google Sheets Data Model

### Tab: Expenses
Primary ledger — one row per expense.

| Column | Type | Notes |
|--------|------|-------|
| ID | String | Auto-generated, e.g. `EXP-001` |
| Date | Date | ISO 8601 |
| Merchant | String | Extracted by Gemini |
| Amount | Number | Original amount |
| Currency | String | ISO 4217, default EUR |
| EUR Amount | Number | Converted to base currency |
| Category | String | From fixed 15-category list |
| Person | String | Telegram display name |
| Notes | String | Optional user note or caption |
| Has Items | Boolean | TRUE if itemization data exists (Phase 3) |
| Receipt URL | String | Google Drive link, empty if no photo |

### Tab: Items *(Phase 3 — structure defined now)*
Foreign-keyed to Expenses for itemized receipts.

| Column | Type |
|--------|------|
| Expense ID | String |
| Item Name | String |
| Quantity | Number |
| Unit Price | Number |
| Category Override | String |

### Tab: Budgets
User-editable directly in Sheets.

| Column | Type |
|--------|------|
| Category | String |
| Monthly Limit (EUR) | Number |
| Alert Threshold % | Number (default 80) |

### Tab: Categories
Single source of truth for the fixed category list.

| Column | Type |
|--------|------|
| Category | String |
| Emoji | String |
| Active | Boolean |

**15 categories (Phase 1):**
🏠 Rent · 🛒 Groceries · 🍽️ Dining out · 🛵 Delivery · 🚗 Transport · 💊 Health · 👗 Clothing · 🎬 Entertainment · 📱 Subscriptions · 🧹 Home & Cleaning · ✈️ Travel · 📚 Learning · 💰 Savings · 🔧 Other · 🏦 Fees & Banking

### Tab: Corrections
Stores user category corrections to power reinforcement learning.

| Column | Type |
|--------|------|
| Timestamp | DateTime |
| Merchant | String |
| Gemini Guess | String |
| User Correction | String |
| Confidence at Time | Number |

### Tab: Dashboard
Read-only, formula-driven. Updated automatically on each Expenses row append.
- Monthly totals per category (SUMIF)
- Per-person totals (SUMIF)
- Budget vs actual per category
- Month-to-date and projected month-end

### Tab: Reports
Auto-generated monthly report rows. One section per month.

### Tab: Config
Single-row settings read by `Config.gs`.

| Key | Example Value |
|-----|---------------|
| User1Name | Pablo |
| User1TelegramID | 123456789 |
| User2Name | Partner |
| User2TelegramID | 987654321 |
| BaseCurrency | EUR |
| GeminiAPIKey | AIza… |
| DriveFolderID | 1abc… |
| ReportDayOfMonth | 1 |
| DefaultAlertThreshold | 80 |

---

## Gemini Integration

### Model
`gemini-2.0-flash` — multimodal, fast, cost-effective.

### Text Input
```json
{
  "model": "gemini-2.0-flash",
  "contents": [{
    "role": "user",
    "parts": [{ "text": "<system_prompt> + user_message" }]
  }],
  "generationConfig": { "responseMimeType": "application/json" }
}
```

### Image Input
```json
{
  "model": "gemini-2.0-flash",
  "contents": [{
    "role": "user",
    "parts": [
      { "text": "<system_prompt>" },
      { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } }
    ]
  }],
  "generationConfig": { "responseMimeType": "application/json" }
}
```

### Response JSON Schema
```json
{
  "merchant": "Mercadona",
  "amount": 47.30,
  "currency": "EUR",
  "date": "2026-06-03",
  "category": "Groceries",
  "notes": "",
  "confidence": 0.97,
  "has_items": false,
  "items": []
}
```

### System Prompt Design
The system prompt passed to Gemini on every call includes:
1. Role: expense parser for a couple's tracker
2. Fixed category list (from Categories tab)
3. Last 20 correction examples from the Corrections tab (few-shot reinforcement)
4. Output format instructions (JSON schema above)
5. Today's date (for relative date resolution like "yesterday")

### Conversation State Management
Apps Script webhook handlers are stateless — each HTTP request has no memory of prior ones. Multi-step flows (edit field selection, low-confidence clarification) use `PropertiesService.getUserProperties()` keyed by Telegram `chat_id` to store pending state between turns. State is cleared on confirm, cancel, or timeout (10 minutes). `StateService.gs` owns all reads and writes to PropertiesService.

### Low Confidence Handling
If `confidence < 0.7`, the bot asks the user to clarify the ambiguous field before saving rather than guessing.

### Reinforcement Learning (Prompt-Based)
- Every user correction (✏️ edit flow) is logged to the Corrections tab
- `GeminiService.gs` reads the most recent 20 corrections on each call
- These are injected into the system prompt as few-shot examples:
  *"Previously: 'Mercadona' → Groceries (not Dining)"*
- Over time, confidence scores improve for familiar merchants and patterns
- No model fine-tuning required — all learning lives in Sheets

---

## Google Drive Structure

```
📁 Expense Tracker (root folder — ID stored in Config)
  📁 Receipts
    📁 2026-06
      receipt_EXP-002_20260602.jpg
      receipt_EXP-007_20260614.jpg
    📁 2026-07
      …
```

- Receipt filenames include the Expense ID for easy cross-reference
- Folder created automatically if it doesn't exist
- Drive link stored in the `Receipt URL` column of the Expenses tab

---

## Budget & Alerts

- Budgets defined per category in the Budgets tab (editable directly in Sheets)
- After every expense save, `BudgetService.gs` compares month-to-date spend against the limit
- Alert fires when spend crosses the threshold (default 80%, configurable per category)
- Only one alert per category per day to avoid spam
- Over-budget notification sent if spend exceeds 100%

---

## Reporting

### /status (on-demand)

- Current month totals vs budget per category
- Month-end projection (days elapsed / days in month × total spent)
- Per-person breakdown

### Monthly Report (automated)
- Apps Script time-based trigger fires on 1st of month at 09:00
- Report sent to both Telegram users
- Contents: total spent vs budget, savings/overage, per-person split, top 5 categories, MoM delta, link to Sheets

---

## Roadmap

### Phase 2 — Multi-Currency
- Accept any ISO 4217 currency in text or on receipts
- Integrate exchange rate API (e.g. exchangerate-api.com free tier)
- Store original amount + currency; convert to EUR for all calculations
- Already designed into the Expenses schema (`Currency` + `EUR Amount` columns)

### Phase 3 — Itemization
- Parse line items from receipts (Gemini already returns `items[]`)
- Populate Items tab with per-item rows linked by Expense ID
- Per-item category override in edit flow
- Dashboard breakdown by item category

### Phase 4 — Power Features
- Yearly report and trend charts
- AI-generated spending insights (Gemini summarises patterns)
- Custom categories via `/addcategory` bot command
- Installment / recurring expense support

---

## Out of Scope (Phase 1)
- Web dashboard or mobile app
- WhatsApp support
- Bank sync / open banking integration
- Approval workflows between partners
- Multi-household / multi-couple support
- Push notifications outside Telegram
