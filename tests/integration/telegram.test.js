// tests/integration/telegram.test.js
// Real Telegram Bot API calls — requires a valid TELEGRAM_BOT_TOKEN in .env

require('dotenv').config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BASE = `https://api.telegram.org/bot${TOKEN}`;

async function telegramGet(method) {
  const res = await fetch(`${BASE}/${method}`);
  return res.json();
}

async function telegramPost(method, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

(async () => {
  console.log('\n=== Telegram Integration Tests ===\n');

  if (!TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not set in .env');
    process.exit(1);
  }

  // 1. Verify bot token
  console.log('1. getMe — verifying bot token...');
  const me = await telegramGet('getMe');
  if (!me.ok) {
    console.error('❌ getMe failed:', me.description);
    process.exit(1);
  }
  console.log(`   ✅ Bot: @${me.result.username} (id: ${me.result.id})`);

  // 2. getWebhookInfo — confirm webhook state
  console.log('\n2. getWebhookInfo — checking webhook...');
  const webhook = await telegramGet('getWebhookInfo');
  if (!webhook.ok) {
    console.error('❌ getWebhookInfo failed:', webhook.description);
  } else {
    const url = webhook.result.url || '(none)';
    const pending = webhook.result.pending_update_count || 0;
    console.log(`   ✅ Webhook URL : ${url}`);
    console.log(`   ✅ Pending msgs: ${pending}`);
    if (webhook.result.last_error_message) {
      console.warn(`   ⚠️  Last error  : ${webhook.result.last_error_message}`);
    }
  }

  // 3. Send a test message to User1
  const user1Id = process.env.USER1_TELEGRAM_ID;
  console.log(`\n3. sendMessage — sending test message to ${process.env.USER1_NAME} (${user1Id})...`);
  const msg = await telegramPost('sendMessage', {
    chat_id: user1Id,
    text: '🔧 <b>Integration test</b> — bot is alive and credentials work!',
    parse_mode: 'HTML'
  });
  if (!msg.ok) {
    console.error('❌ sendMessage failed:', msg.description);
  } else {
    console.log(`   ✅ Message sent (message_id: ${msg.result.message_id})`);
  }

  console.log('\n=== Telegram: All checks passed ✅ ===\n');
})();
