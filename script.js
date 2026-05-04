// Global variables
let expenses = [];

// Function to add an expense
function addExpense(amount, category) {
    const date = new Date();
    expenses.push({ amount, category, date });
    updateAnalytics();
}

// Function to display expenses in a table
function displayExpenses() {
    const table = document.getElementById('expensesTable');
    table.innerHTML = ''; // Clear previous entries

    expenses.forEach(expense => {
        const row = table.insertRow();
        row.insertCell(0).innerText = expense.date.toISOString().substring(0, 10);
        row.insertCell(1).innerText = expense.category;
        row.insertCell(2).innerText = expense.amount.toFixed(2);
    });
}

// Function to calculate total expenses
function calculateTotal() {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Function to update analytics dashboard
function updateAnalytics() {
    const total = calculateTotal();
    document.getElementById('totalExpenses').innerText = `Total Expenses: $${total.toFixed(2)}`;
    displayExpenses();
}

// Event listener for adding an expense
document.getElementById('addExpenseButton').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const category = document.getElementById('expenseCategory').value;
    addExpense(amount, category);
});
