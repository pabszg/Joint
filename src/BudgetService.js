// src/BudgetService.js

function checkBudget(category, spend, budgets) {
  var budget = null;
  for (var i = 0; i < budgets.length; i++) {
    if (budgets[i].category === category) { budget = budgets[i]; break; }
  }
  if (!budget) return null;

  var percentage = (spend / budget.limit) * 100;
  if (spend > budget.limit) {
    return { type: 'over_budget', category: category, spend: spend, limit: budget.limit, percentage: percentage };
  }
  if (percentage >= budget.alertThreshold) {
    return { type: 'warning', category: category, spend: spend, limit: budget.limit, percentage: percentage };
  }
  return null;
}

function formatBudgetSave(category, spend, limit, percentage) {
  return category + ' this month: €' + spend.toFixed(2) + ' / €' + limit + ' (' + Math.round(percentage) + '%)';
}

function formatBudgetAlert(alertResult) {
  var emoji = alertResult.type === 'over_budget' ? '🚨' : '⚠️';
  return emoji + ' ' + alertResult.category + ' budget at ' +
    Math.round(alertResult.percentage) + '% (€' +
    alertResult.spend.toFixed(2) + ' / €' + alertResult.limit + ')';
}

function sumByCategory(expenses) {
  var totals = {};
  for (var i = 0; i < expenses.length; i++) {
    var cat = expenses[i].category;
    totals[cat] = (totals[cat] || 0) + (expenses[i].eurAmount || 0);
  }
  return totals;
}

function formatStatusMessage(expenses, budgets, today, daysInMonth) {
  var totals = sumByCategory(expenses);
  var totalSpent = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var totalBudget = budgets.reduce(function(s, b) { return s + b.limit; }, 0);
  var dayOfMonth = today.getDate();
  var projected = daysInMonth > 0 ? (totalSpent / dayOfMonth) * daysInMonth : 0;

  var lines = [
    '📊 <b>' + formatMonthYear(today) + ' — Day ' + dayOfMonth + '/' + daysInMonth + '</b>',
    'Total spent: €' + totalSpent.toFixed(2) + ' / €' + totalBudget,
    'Projected month-end: €' + projected.toFixed(2),
    ''
  ];

  budgets.forEach(function(b) {
    var spend = totals[b.category] || 0;
    if (spend === 0) return;
    var pct = Math.round((spend / b.limit) * 100);
    var flag = pct >= 100 ? ' 🚨' : pct >= b.alertThreshold ? ' ⚠️' : ' ✅';
    lines.push(b.category + ': €' + spend.toFixed(0) + ' / €' + b.limit + flag);
  });

  return lines.join('\n');
}

function formatMonthYear(date) {
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  return months[date.getMonth()] + ' ' + date.getFullYear();
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

if (typeof module !== 'undefined') {
  module.exports = { checkBudget, formatBudgetSave, formatBudgetAlert, formatStatusMessage, sumByCategory, getDaysInMonth };
}
