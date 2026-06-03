// src/Triggers.js

function installTriggers() {
  // Remove existing triggers to avoid duplicates
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  // Weekly digest — every Sunday at 20:00
  ScriptApp.newTrigger('sendWeeklyDigest')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .nearMinute(0)
    .create();

  // Monthly report — every day, but the function checks if it's the right day
  ScriptApp.newTrigger('sendMonthlyReport')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .nearMinute(0)
    .create();

  Logger.log('Triggers installed successfully.');
}

function sendWeeklyDigest() {
  var config = getConfig();
  var token = config.telegramBotToken;
  var expenses = getWeekExpenses();
  var budgets = getBudgets();
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth() + 1;
  var monthExpenses = getMonthExpenses(year, month);
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);
  var monthSpend = monthExpenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var remaining = totalBudget - monthSpend;

  var text = buildWeeklyDigest(expenses, budgets, totalBudget);
  text += '\n\nRemaining this month: €' + remaining.toFixed(2);

  sendMessage(token, config.user1TelegramId, text);
  if (config.user2TelegramId && config.user2TelegramId !== config.user1TelegramId) {
    sendMessage(token, config.user2TelegramId, text);
  }
}

function sendMonthlyReport() {
  var config = getConfig();
  var now = new Date();
  if (now.getDate() !== config.reportDayOfMonth) return;

  var token = config.telegramBotToken;
  // Report on the previous month
  var reportMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  var reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  var expenses = getMonthExpenses(reportYear, reportMonth);
  var budgets = getBudgets();
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);

  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var monthLabel = months[reportMonth - 1] + ' ' + reportYear;

  var text = buildMonthlyReport(expenses, budgets, monthLabel, totalBudget);

  sendMessage(token, config.user1TelegramId, text);
  if (config.user2TelegramId && config.user2TelegramId !== config.user1TelegramId) {
    sendMessage(token, config.user2TelegramId, text);
  }
}
