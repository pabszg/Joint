// src/ReportService.js

function sumByCategory(expenses) {
  var totals = {};
  expenses.forEach(function(e) {
    totals[e.category] = (totals[e.category] || 0) + (e.eurAmount || 0);
  });
  return totals;
}

function sumByPerson(expenses) {
  var totals = {};
  expenses.forEach(function(e) {
    totals[e.person] = (totals[e.person] || 0) + (e.eurAmount || 0);
  });
  return totals;
}

function topCategories(totals, n) {
  return Object.keys(totals)
    .map(function(cat) { return { category: cat, amount: totals[cat] }; })
    .sort(function(a, b) { return b.amount - a.amount; })
    .slice(0, n);
}

function buildWeeklyDigest(expenses, budgets, monthBudgetTotal) {
  var total = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var totals = sumByCategory(expenses);
  var top3 = topCategories(totals, 3);

  var lines = [
    '📋 <b>Weekly Digest</b>',
    'Week total: €' + total.toFixed(2),
    ''
  ];

  lines.push('Top categories:');
  top3.forEach(function(item, i) {
    lines.push((i + 1) + '. ' + item.category + ': €' + item.amount.toFixed(0));
  });

  return lines.join('\n');
}

function buildMonthlyReport(expenses, budgets, monthLabel, totalBudget, sheetsUrl) {
  var total = expenses.reduce(function(s, e) { return s + (e.eurAmount || 0); }, 0);
  var personTotals = sumByPerson(expenses);
  var categoryTotals = sumByCategory(expenses);
  var top5 = topCategories(categoryTotals, 5);
  var saved = totalBudget - total;
  var budgetLine = saved >= 0
    ? 'You saved €' + saved.toFixed(2) + ' this month! 🎉'
    : 'You were €' + Math.abs(saved).toFixed(2) + ' over budget. 📈';

  var lines = [
    '📋 <b>' + monthLabel + ' — Final Report</b>',
    '',
    'Total: €' + total.toFixed(2) + ' / €' + totalBudget + ' budget',
    budgetLine,
    ''
  ];

  Object.keys(personTotals).forEach(function(person) {
    var pct = total > 0 ? Math.round((personTotals[person] / total) * 100) : 0;
    lines.push('👤 ' + person + ': €' + personTotals[person].toFixed(0) + ' (' + pct + '%)');
  });

  lines.push('');
  lines.push('Top categories:');
  top5.forEach(function(item, i) {
    lines.push((i + 1) + '. ' + item.category + ': €' + item.amount.toFixed(0));
  });

  if (sheetsUrl) {
    lines.push('');
    lines.push('📄 Full report → ' + sheetsUrl);
  }

  return lines.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { buildWeeklyDigest, buildMonthlyReport, sumByCategory, sumByPerson };
}
