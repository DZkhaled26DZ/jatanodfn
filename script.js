// Constants
const API_KEY = 'nc3cvP0d3LZzL9AIIgQQsjU6MKN8g5oanFkiAo4BdykbaOlce3HsTbWB3mPCoL8z';
const BASE_URL = 'https://api.binance.com/api/v3/';
const NOTIFICATION_SOUND = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');

// State management
let filters = {
    lowerTail: 0,
    upperTail: 0,
    enableLowerTail: false,
    enableUpperTail: false
};

let autoRefreshInterval;
let previousSymbols = new Set();

// DOM Elements
const filtersForm = document.getElementById('filters-form');
const stopAnalysisBtn = document.getElementById('stop-analysis');
const refreshIntervalInput = document.getElementById('refresh-interval');
const enableAutoRefreshCheckbox = document.getElementById('enable-auto-refresh');
const enableNotificationsCheckbox = document.getElementById('enable-notifications');
const notification = document.getElementById('notification');
const notificationText = document.getElementById('notification-text');
const modal = document.getElementById('targets-modal');
const modalCloseBtn = document.querySelector('.close');

// Event Listeners
filtersForm.addEventListener('submit', handleFilterSubmit);
stopAnalysisBtn.addEventListener('click', stopAutoRefresh);
modalCloseBtn.addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
});

document.querySelector('.close-btn')?.addEventListener('click', () => {
    notification.style.display = 'none';
});

// Main Functions
function handleFilterSubmit(e) {
    e.preventDefault();
    
    filters.lowerTail = parseFloat(document.getElementById('lower-tail').value);
    filters.upperTail = parseFloat(document.getElementById('upper-tail').value);
    filters.enableLowerTail = document.getElementById('enable-lower-tail').checked;
    filters.enableUpperTail = document.getElementById('enable-upper-tail').checked;

    if (enableAutoRefreshCheckbox.checked) {
        startAutoRefresh();
    } else {
        fetchCurrencyData();
    }
}

function startAutoRefresh() {
    const interval = Math.max(5, parseInt(refreshIntervalInput.value)) * 1000;
    stopAutoRefresh(); // Clear any existing interval
    
    fetchCurrencyData(); // Initial fetch
    autoRefreshInterval = setInterval(fetchCurrencyData, interval);
    
    stopAnalysisBtn.disabled = false;
}

function stopAutoRefresh() {
    clearInterval(autoRefreshInterval);
    stopAnalysisBtn.disabled = true;
}

async function fetchCurrencyData() {
    try {
        const response = await fetch(`${BASE_URL}ticker/24hr`);
        const data = await response.json();
        const filteredCurrencies = data.filter(currency => checkTailCondition(currency));
        
        updateCurrencyTable(filteredCurrencies);
        checkForNewCurrencies(filteredCurrencies);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showNotification('حدث خطأ في جلب البيانات', 'error');
    }
}

function checkTailCondition(currency) {
    const price = parseFloat(currency.lastPrice);
    const lowPrice = parseFloat(currency.lowPrice);
    const highPrice = parseFloat(currency.highPrice);

    let valid = true;

    if (filters.enableLowerTail) {
        const lowerTailPercentage = ((price - lowPrice) / price) * 100;
        valid = valid && (lowerTailPercentage >= filters.lowerTail);
    }

    if (filters.enableUpperTail) {
        const upperTailPercentage = ((highPrice - price) / price) * 100;
        valid = valid && (upperTailPercentage >= filters.upperTail);
    }

    return valid;
}

function updateCurrencyTable(currencies) {
    const tableBody = document.querySelector('#currency-table tbody');
    tableBody.innerHTML = '';

    currencies.forEach(currency => {
        const row = document.createElement('tr');
        const timestamp = new Date().toLocaleString('ar-DZ', { 
            timeZone: 'Africa/Algiers', 
            hour12: false 
        });
        
        const priceChange = parseFloat(currency.priceChangePercent);
        const recommendation = priceChange > 0 ? 'شراء 🚀' : 'بيع 🔻';
        
        row.innerHTML = `
            <td>${currency.symbol}</td>
            <td>${parseFloat(currency.lastPrice).toFixed(8)}</td>
            <td>${parseFloat(currency.volume).toFixed(2)}</td>
            <td>${timestamp}</td>
            <td class="${priceChange > 0 ? 'positive' : 'negative'}">${recommendation}</td>
            <td>
                <button class="action-btn trade-btn" onclick="openBinanceTrading('${currency.symbol}')">
                    <span>تداول 💱</span>
                </button>
                <button class="action-btn info-btn" onclick="showTargets('${currency.symbol}', ${currency.lastPrice})">
                    <span>تحليل 📊</span>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function openBinanceTrading(symbol) {
    window.open(`https://www.binance.com/ar/trade/${symbol}?type=spot`, '_blank');
}

function showTargets(symbol, currentPrice) {
    const price = parseFloat(currentPrice);
    const targets = calculateTargets(price);
    const stopLoss = calculateStopLoss(price);
    
    document.getElementById('modal-symbol').textContent = symbol;
    document.getElementById('target1').textContent = targets[0].toFixed(8);
    document.getElementById('target2').textContent = targets[1].toFixed(8);
    document.getElementById('target3').textContent = targets[2].toFixed(8);
    document.getElementById('stop-loss').textContent = stopLoss.toFixed(8);
    
    // Update stats
    fetchAndDisplayStats(symbol);
    
    modal.style.display = 'block';
}

async function fetchAndDisplayStats(symbol) {
    try {
        const response = await fetch(`${BASE_URL}ticker/24hr?symbol=${symbol}`);
        const data = await response.json();
        
        document.getElementById('volume-24h').textContent = parseFloat(data.volume).toFixed(2);
        document.getElementById('change-24h').textContent = `${data.priceChangePercent}%`;
        document.getElementById('high-24h').textContent = parseFloat(data.highPrice).toFixed(8);
        document.getElementById('low-24h').textContent = parseFloat(data.lowPrice).toFixed(8);
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function calculateTargets(currentPrice) {
    return [
        currentPrice * 1.02, // Target 1: +2%
        currentPrice * 1.05, // Target 2: +5%
        currentPrice * 1.10  // Target 3: +10%
    ];
}

function calculateStopLoss(currentPrice) {
    return currentPrice * 0.98; // Stop Loss: -2%
}

function checkForNewCurrencies(currencies) {
    if (!enableNotificationsCheckbox.checked) return;
    
    const currentSymbols = new Set(currencies.map(c => c.symbol));
    const newSymbols = [...currentSymbols].filter(symbol => !previousSymbols.has(symbol));
    
    if (newSymbols.length > 0) {
        playNotificationSound();
        showNotification(`عملات جديدة متوافقة مع الشروط: ${newSymbols.join(', ')}`);
    }
    
    previousSymbols = currentSymbols;
}

function playNotificationSound() {
    NOTIFICATION_SOUND.play().catch(error => console.error('Error playing sound:', error));
}

function showNotification(message, type = 'success') {
    notificationText.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Set default values
    refreshIntervalInput.value = 30;
    enableAutoRefreshCheckbox.checked = false;
    enableNotificationsCheckbox.checked = true;
});