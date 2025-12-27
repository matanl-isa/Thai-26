// ==== FIREBASE CONFIGURATION ====
// You need to create a Firebase project and replace these values
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase (only if config is set)
let db = null;
let tripRef = null;
let currentTripCode = null;
let isConnected = false;

function initFirebase() {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        
        // Check for saved trip code
        const savedCode = localStorage.getItem('tripCode');
        if (savedCode) {
            connectToTrip(savedCode);
        }
    }
}

// ==== DATA STORAGE ====
let tripData = {
    days: [],
    flights: [],
    hotels: [],
    attractions: [],
    packing: {
        clothing: [],
        health: [],
        tech: []
    },
    budget: []
};

// Load from localStorage
function loadData() {
    const saved = localStorage.getItem('thailandTrip');
    if (saved) {
        tripData = JSON.parse(saved);
        renderAll();
    }
}

// Save to localStorage and Firebase
function saveData() {
    localStorage.setItem('thailandTrip', JSON.stringify(tripData));
    
    // Sync to Firebase if connected
    if (isConnected && tripRef) {
        updateSyncStatus('syncing');
        tripRef.set(tripData)
            .then(() => {
                updateSyncStatus('connected');
            })
            .catch((error) => {
                console.error('Sync error:', error);
                updateSyncStatus('offline');
            });
    }
}

// ==== SYNC STATUS ====
function updateSyncStatus(status) {
    const statusEl = document.getElementById('sync-status');
    const iconEl = statusEl.querySelector('.sync-icon');
    const textEl = statusEl.querySelector('.sync-text');
    
    statusEl.className = 'sync-status ' + status;
    
    switch(status) {
        case 'connected':
            iconEl.textContent = '●';
            textEl.textContent = 'מסונכרן';
            break;
        case 'syncing':
            iconEl.textContent = '◐';
            textEl.textContent = 'מסנכרן...';
            break;
        case 'offline':
        default:
            iconEl.textContent = '●';
            textEl.textContent = 'לא מחובר';
            break;
    }
}

// ==== SHARE MODAL ====
function openShareModal() {
    document.getElementById('shareModal').classList.add('active');
    
    if (isConnected) {
        document.getElementById('share-create').style.display = 'none';
        document.getElementById('share-connected').style.display = 'block';
        document.getElementById('tripCodeDisplay').textContent = currentTripCode;
    } else {
        document.getElementById('share-create').style.display = 'block';
        document.getElementById('share-connected').style.display = 'none';
    }
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('active');
}

// Generate random 6-character code
function generateTripCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Create new trip in Firebase
function createNewTrip() {
    if (!db) {
        alert('Firebase לא מוגדר. אנא עקוב אחר הוראות ההתקנה.');
        return;
    }
    
    const code = generateTripCode();
    
    // Check if code already exists
    db.ref('trips/' + code).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                // Code exists, try again
                createNewTrip();
            } else {
                // Create new trip
                db.ref('trips/' + code).set(tripData)
                    .then(() => {
                        connectToTrip(code);
                        localStorage.setItem('tripCode', code);
                        alert('נוצר קוד שיתוף: ' + code);
                    })
                    .catch((error) => {
                        alert('שגיאה ביצירת הטיול: ' + error.message);
                    });
            }
        });
}

// Join existing trip
function joinTrip() {
    const code = document.getElementById('joinCode').value.toUpperCase().trim();
    
    if (code.length !== 6) {
        alert('הקוד חייב להיות בן 6 תווים');
        return;
    }
    
    if (!db) {
        alert('Firebase לא מוגדר. אנא עקוב אחר הוראות ההתקנה.');
        return;
    }
    
    db.ref('trips/' + code).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                tripData = snapshot.val();
                localStorage.setItem('thailandTrip', JSON.stringify(tripData));
                localStorage.setItem('tripCode', code);
                connectToTrip(code);
                renderAll();
                alert('הצטרפת לטיול בהצלחה!');
            } else {
                alert('קוד לא נמצא. בדוק שהקוד נכון.');
            }
        })
        .catch((error) => {
            alert('שגיאה בהצטרפות: ' + error.message);
        });
}

// Connect to trip and listen for changes
function connectToTrip(code) {
    if (!db) return;
    
    currentTripCode = code;
    tripRef = db.ref('trips/' + code);
    isConnected = true;
    
    // Listen for real-time updates
    tripRef.on('value', (snapshot) => {
        if (snapshot.exists()) {
            const newData = snapshot.val();
            // Only update if data is different (to avoid infinite loop)
            if (JSON.stringify(newData) !== JSON.stringify(tripData)) {
                tripData = newData;
                localStorage.setItem('thailandTrip', JSON.stringify(tripData));
                renderAll();
            }
            updateSyncStatus('connected');
        }
    });
    
    // Update modal state
    document.getElementById('share-create').style.display = 'none';
    document.getElementById('share-connected').style.display = 'block';
    document.getElementById('tripCodeDisplay').textContent = code;
    
    updateSyncStatus('connected');
}

// Disconnect from cloud
function disconnectTrip() {
    if (confirm('האם להתנתק מהענן? הנתונים יישמרו מקומית בלבד.')) {
        if (tripRef) {
            tripRef.off();
        }
        tripRef = null;
        currentTripCode = null;
        isConnected = false;
        localStorage.removeItem('tripCode');
        
        updateSyncStatus('offline');
        
        document.getElementById('share-create').style.display = 'block';
        document.getElementById('share-connected').style.display = 'none';
    }
}

// Copy code to clipboard
function copyCode() {
    navigator.clipboard.writeText(currentTripCode).then(() => {
        alert('הקוד הועתק! ' + currentTripCode);
    });
}

// ==== TAB NAVIGATION ====
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    
    // Re-render dashboard charts when switching to dashboard tab
    if (tabId === 'dashboard') {
        setTimeout(() => {
            renderDashboard();
        }, 50);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==== DAY MANAGEMENT ====
function openDayModal() {
    document.getElementById('dayModal').classList.add('active');
    document.getElementById('dayNumber').value = tripData.days.length + 1;
}

function closeDayModal() {
    document.getElementById('dayModal').classList.remove('active');
    document.getElementById('dayNumber').value = '';
    document.getElementById('dayDate').value = '';
    document.getElementById('dayTitle').value = '';
}

function addDay(e) {
    e.preventDefault();
    
    const day = {
        id: Date.now(),
        number: parseInt(document.getElementById('dayNumber').value),
        date: document.getElementById('dayDate').value,
        title: document.getElementById('dayTitle').value,
        activities: []
    };
    
    tripData.days.push(day);
    tripData.days.sort((a, b) => a.number - b.number);
    
    saveData();
    renderDays();
    closeDayModal();
}

function deleteDay(dayId) {
    if (confirm('האם למחוק יום זה?')) {
        tripData.days = tripData.days.filter(d => d.id !== dayId);
        saveData();
        renderDays();
    }
}

function renderDays() {
    const container = document.getElementById('days-container');
    
    if (tripData.days.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📅</div>
                <h3 class="empty-state-title">טרם הוספת ימים למסלול</h3>
                <p class="empty-state-text">התחל לבנות את מסלול הטיול שלך על ידי הוספת ימים ופעילויות</p>
                <button class="btn btn-primary" onclick="openDayModal()">הוסף יום ראשון</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tripData.days.map(day => `
        <div class="day-item">
            <div class="day-header">
                <div>
                    <div class="day-number">יום ${day.number} - ${day.title}</div>
                    <div class="day-date">${formatDate(day.date)}</div>
                </div>
                <div class="flex gap-1">
                    <button class="btn btn-primary btn-sm" onclick="openActivityModal(${day.id})">+ פעילות</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteDay(${day.id})">🗑️</button>
                </div>
            </div>
            <div id="activities-${day.id}">
                ${renderActivities(day)}
            </div>
        </div>
    `).join('');
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ==== ACTIVITY MANAGEMENT ====
function openActivityModal(dayId) {
    document.getElementById('activityModal').classList.add('active');
    document.getElementById('activityDayId').value = dayId;
}

function closeActivityModal() {
    document.getElementById('activityModal').classList.remove('active');
    document.getElementById('activityDayId').value = '';
    document.getElementById('activityTime').value = '';
    document.getElementById('activityTitle').value = '';
    document.getElementById('activityDesc').value = '';
}

function addActivity(e) {
    e.preventDefault();
    
    const dayId = parseInt(document.getElementById('activityDayId').value);
    const day = tripData.days.find(d => d.id === dayId);
    
    if (day) {
        const activity = {
            id: Date.now(),
            time: document.getElementById('activityTime').value,
            title: document.getElementById('activityTitle').value,
            description: document.getElementById('activityDesc').value
        };
        
        if (!day.activities) day.activities = [];
        day.activities.push(activity);
        day.activities.sort((a, b) => a.time.localeCompare(b.time));
        
        saveData();
        renderDays();
        closeActivityModal();
    }
}

function deleteActivity(dayId, activityId) {
    const day = tripData.days.find(d => d.id === dayId);
    if (day) {
        day.activities = day.activities.filter(a => a.id !== activityId);
        saveData();
        renderDays();
    }
}

function renderActivities(day) {
    if (!day.activities || day.activities.length === 0) {
        return '<p class="text-secondary" style="padding: 1rem 0;">טרם הוספו פעילויות ליום זה</p>';
    }
    
    return day.activities.map(activity => `
        <div class="activity-item">
            <div class="activity-header">
                <div>
                    <div class="activity-time">⏰ ${activity.time}</div>
                    <div class="activity-title">${activity.title}</div>
                    ${activity.description ? `<div class="activity-desc">${activity.description}</div>` : ''}
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteActivity(${day.id}, ${activity.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ==== FLIGHT MANAGEMENT ====
function openFlightModal() {
    document.getElementById('flightModal').classList.add('active');
}

function closeFlightModal() {
    document.getElementById('flightModal').classList.remove('active');
    document.getElementById('flightFrom').value = '';
    document.getElementById('flightTo').value = '';
    document.getElementById('flightDate').value = '';
    document.getElementById('flightAirline').value = '';
    document.getElementById('flightPrice').value = '';
}

function addFlight(e) {
    e.preventDefault();
    
    const flight = {
        id: Date.now(),
        from: document.getElementById('flightFrom').value,
        to: document.getElementById('flightTo').value,
        date: document.getElementById('flightDate').value,
        airline: document.getElementById('flightAirline').value,
        price: parseFloat(document.getElementById('flightPrice').value) || 0
    };
    
    tripData.flights.push(flight);
    saveData();
    renderFlights();
    closeFlightModal();
}

function deleteFlight(flightId) {
    if (confirm('האם למחוק טיסה זו?')) {
        tripData.flights = tripData.flights.filter(f => f.id !== flightId);
        saveData();
        renderFlights();
    }
}

function renderFlights() {
    const container = document.getElementById('flights-container');
    
    if (tripData.flights.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✈️</div>
                <h3 class="empty-state-title">טרם הוספת טיסות</h3>
                <p class="empty-state-text">הוסף את פרטי הטיסות שלך - בינלאומיות ופנים</p>
                <button class="btn btn-primary" onclick="openFlightModal()">הוסף טיסה</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tripData.flights.map(flight => {
        const date = new Date(flight.date);
        const dateStr = date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        
        return `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">
                            ${flight.from} → ${flight.to}
                        </div>
                        <div class="text-secondary">${dateStr}</div>
                        ${flight.airline ? `<div class="text-secondary">חברה: ${flight.airline}</div>` : ''}
                        ${flight.price ? `<div style="color: var(--primary); font-weight: 600; margin-top: 0.5rem;">₪${flight.price.toLocaleString()}</div>` : ''}
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteFlight(${flight.id})">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

// ==== HOTEL MANAGEMENT ====
function openHotelModal() {
    document.getElementById('hotelModal').classList.add('active');
}

function closeHotelModal() {
    document.getElementById('hotelModal').classList.remove('active');
    document.getElementById('hotelName').value = '';
    document.getElementById('hotelLocation').value = '';
    document.getElementById('hotelCheckin').value = '';
    document.getElementById('hotelCheckout').value = '';
    document.getElementById('hotelPrice').value = '';
}

function addHotel(e) {
    e.preventDefault();
    
    const hotel = {
        id: Date.now(),
        name: document.getElementById('hotelName').value,
        location: document.getElementById('hotelLocation').value,
        checkin: document.getElementById('hotelCheckin').value,
        checkout: document.getElementById('hotelCheckout').value,
        price: parseFloat(document.getElementById('hotelPrice').value) || 0
    };
    
    tripData.hotels.push(hotel);
    saveData();
    renderHotels();
    closeHotelModal();
}

function deleteHotel(hotelId) {
    if (confirm('האם למחוק מלון זה?')) {
        tripData.hotels = tripData.hotels.filter(h => h.id !== hotelId);
        saveData();
        renderHotels();
    }
}

function renderHotels() {
    const container = document.getElementById('hotels-container');
    
    if (tripData.hotels.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🏨</div>
                <h3 class="empty-state-title">טרם הוספת מלונות</h3>
                <p class="empty-state-text">הוסף את פרטי המלונות שבהם תתארח</p>
                <button class="btn btn-primary" onclick="openHotelModal()">הוסף מלון</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tripData.hotels.map(hotel => {
        const checkin = new Date(hotel.checkin).toLocaleDateString('he-IL');
        const checkout = new Date(hotel.checkout).toLocaleDateString('he-IL');
        const nights = Math.ceil((new Date(hotel.checkout) - new Date(hotel.checkin)) / (1000 * 60 * 60 * 24));
        
        return `
            <div class="card">
                <div class="flex-between mb-1">
                    <div>
                        <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">${hotel.name}</h3>
                        <div class="text-secondary">📍 ${hotel.location}</div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteHotel(${hotel.id})">🗑️</button>
                </div>
                <div class="info-item">
                    <span class="info-label">צ'ק-אין</span>
                    <span class="info-value">${checkin}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">צ'ק-אאוט</span>
                    <span class="info-value">${checkout}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">לילות</span>
                    <span class="info-value">${nights}</span>
                </div>
                ${hotel.price ? `
                    <div class="info-item">
                        <span class="info-label">מחיר ללילה</span>
                        <span class="info-value" style="color: var(--primary); font-weight: 600;">₪${hotel.price.toLocaleString()}</span>
                    </div>
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--bg-tertiary);">
                        <div class="flex-between">
                            <span class="info-label">סה"כ</span>
                            <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">₪${(hotel.price * nights).toLocaleString()}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// ==== ATTRACTION MANAGEMENT ====
function openAttractionModal() {
    document.getElementById('attractionModal').classList.add('active');
}

function closeAttractionModal() {
    document.getElementById('attractionModal').classList.remove('active');
    document.getElementById('attractionName').value = '';
    document.getElementById('attractionCategory').value = 'מקדש';
    document.getElementById('attractionDesc').value = '';
    document.getElementById('attractionPrice').value = '';
}

function addAttraction(e) {
    e.preventDefault();
    
    const attraction = {
        id: Date.now(),
        name: document.getElementById('attractionName').value,
        category: document.getElementById('attractionCategory').value,
        description: document.getElementById('attractionDesc').value,
        price: document.getElementById('attractionPrice').value
    };
    
    tripData.attractions.push(attraction);
    saveData();
    renderAttractions();
    closeAttractionModal();
}

function deleteAttraction(attractionId) {
    if (confirm('האם למחוק אטרקציה זו?')) {
        tripData.attractions = tripData.attractions.filter(a => a.id !== attractionId);
        saveData();
        renderAttractions();
    }
}

function renderAttractions() {
    const container = document.getElementById('attractions-container');
    
    if (tripData.attractions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">🎯</div>
                <h3 class="empty-state-title">טרם הוספת אטרקציות</h3>
                <p class="empty-state-text">הוסף מקומות שתרצה לבקר בהם</p>
                <button class="btn btn-primary" onclick="openAttractionModal()">הוסף אטרקציה</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = tripData.attractions.map(attraction => `
        <div class="card">
            <div class="flex-between mb-1">
                <div>
                    <div style="display: inline-block; background: var(--primary); color: white; padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem;">
                        ${attraction.category}
                    </div>
                    <h3 style="font-weight: 700; margin-bottom: 0.5rem;">${attraction.name}</h3>
                    ${attraction.description ? `<p class="text-secondary" style="font-size: 0.9rem;">${attraction.description}</p>` : ''}
                    ${attraction.price ? `<div style="margin-top: 0.5rem; font-weight: 600; color: var(--primary);">💰 ${attraction.price}</div>` : ''}
                </div>
                <button class="btn btn-danger btn-sm" onclick="deleteAttraction(${attraction.id})">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ==== PACKING MANAGEMENT ====
function openPackingModal() {
    document.getElementById('packingModal').classList.add('active');
}

function closePackingModal() {
    document.getElementById('packingModal').classList.remove('active');
    document.getElementById('packingItem').value = '';
    document.getElementById('packingCategory').value = 'clothing';
}

function addPackingItem(e) {
    e.preventDefault();
    
    const item = {
        id: Date.now(),
        name: document.getElementById('packingItem').value,
        checked: false
    };
    
    const category = document.getElementById('packingCategory').value;
    if (!tripData.packing[category]) tripData.packing[category] = [];
    tripData.packing[category].push(item);
    
    saveData();
    renderPacking();
    closePackingModal();
}

function togglePackingItem(category, itemId) {
    const item = tripData.packing[category].find(i => i.id === itemId);
    if (item) {
        item.checked = !item.checked;
        saveData();
        renderPacking();
    }
}

function deletePackingItem(category, itemId) {
    tripData.packing[category] = tripData.packing[category].filter(i => i.id !== itemId);
    saveData();
    renderPacking();
}

function renderPacking() {
    const categories = {
        clothing: 'packing-clothing',
        health: 'packing-health',
        tech: 'packing-tech'
    };
    
    Object.entries(categories).forEach(([category, containerId]) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const items = tripData.packing[category] || [];
        
        if (items.length === 0) {
            container.innerHTML = '<p class="text-secondary">אין פריטים בקטגוריה זו</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="packing-item ${item.checked ? 'checked' : ''}" onclick="togglePackingItem('${category}', ${item.id})">
                <div class="packing-checkbox"></div>
                <span style="flex: 1;">${item.name}</span>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deletePackingItem('${category}', ${item.id})">🗑️</button>
            </div>
        `).join('');
    });
}

// ==== BUDGET MANAGEMENT ====
function openBudgetModal() {
    document.getElementById('budgetModal').classList.add('active');
}

function closeBudgetModal() {
    document.getElementById('budgetModal').classList.remove('active');
    document.getElementById('budgetName').value = '';
    document.getElementById('budgetAmount').value = '';
    document.getElementById('budgetNotes').value = '';
}

function addBudgetItem(e) {
    e.preventDefault();
    
    const item = {
        id: Date.now(),
        name: document.getElementById('budgetName').value,
        amount: parseFloat(document.getElementById('budgetAmount').value),
        notes: document.getElementById('budgetNotes').value
    };
    
    tripData.budget.push(item);
    saveData();
    renderBudget();
    closeBudgetModal();
}

function deleteBudgetItem(itemId) {
    if (confirm('האם למחוק הוצאה זו?')) {
        tripData.budget = tripData.budget.filter(i => i.id !== itemId);
        saveData();
        renderBudget();
    }
}

function renderBudget() {
    const container = document.getElementById('budget-container');
    const totalEl = document.getElementById('budget-total');
    
    const total = tripData.budget.reduce((sum, item) => sum + item.amount, 0);
    
    totalEl.innerHTML = `
        <div class="flex-between">
            <span class="info-label" style="font-size: 1.25rem;">סה"כ משוער:</span>
            <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">₪${total.toLocaleString()}</span>
        </div>
    `;
    
    if (tripData.budget.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    container.innerHTML = tripData.budget.map(item => `
        <div class="card">
            <div class="flex-between">
                <div style="flex: 1;">
                    <h3 style="font-weight: 700; margin-bottom: 0.5rem;">${item.name}</h3>
                    ${item.notes ? `<p class="text-secondary" style="font-size: 0.9rem;">${item.notes}</p>` : ''}
                </div>
                <div style="text-align: left; margin-left: 1rem;">
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">₪${item.amount.toLocaleString()}</div>
                    <button class="btn btn-danger btn-sm" style="margin-top: 0.5rem;" onclick="deleteBudgetItem(${item.id})">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==== RENDER ALL ====
function renderAll() {
    renderDays();
    renderFlights();
    renderHotels();
    renderAttractions();
    renderPacking();
    renderBudget();
    renderDashboard();
}

// ==== DASHBOARD (Stephen Few Methodology) ====
let budgetChart = null;
let dailyCostChart = null;
let tripMap = null;

function renderDashboard() {
    updateKPIs();
    renderBudgetChart();
    renderDailyCostChart();
    renderCategoryBars();
    renderTimeline();
    renderQuickStats();
    initMap();
}

function updateKPIs() {
    // Total Budget
    const totalBudget = tripData.budget.reduce((sum, item) => sum + item.amount, 0);
    document.getElementById('kpi-total-budget').textContent = '₪' + totalBudget.toLocaleString();
    
    // Total Days
    const totalDays = tripData.days.length;
    document.getElementById('kpi-total-days').textContent = totalDays;
    
    // Total Activities
    const totalActivities = tripData.days.reduce((sum, day) => {
        return sum + (day.activities ? day.activities.length : 0);
    }, 0);
    document.getElementById('kpi-total-activities').textContent = totalActivities;
    
    // Packing Progress
    const allPackingItems = [
        ...(tripData.packing.clothing || []),
        ...(tripData.packing.health || []),
        ...(tripData.packing.tech || [])
    ];
    const checkedItems = allPackingItems.filter(item => item.checked).length;
    const packingProgress = allPackingItems.length > 0 
        ? Math.round((checkedItems / allPackingItems.length) * 100) 
        : 0;
    document.getElementById('kpi-packing-progress').textContent = packingProgress + '%';
    document.getElementById('kpi-packing-bar').style.width = packingProgress + '%';
}

function renderBudgetChart() {
    const ctx = document.getElementById('budgetChart');
    if (!ctx) return;
    
    // Destroy existing chart
    if (budgetChart) {
        budgetChart.destroy();
    }
    
    // Calculate budget by category
    const categories = {};
    tripData.budget.forEach(item => {
        const category = getCategoryFromName(item.name);
        categories[category] = (categories[category] || 0) + item.amount;
    });
    
    // Add flights and hotels
    const flightsCost = tripData.flights.reduce((sum, f) => sum + (f.price || 0), 0);
    const hotelsCost = tripData.hotels.reduce((sum, h) => {
        const nights = Math.ceil((new Date(h.checkout) - new Date(h.checkin)) / (1000 * 60 * 60 * 24));
        return sum + (h.price || 0) * nights;
    }, 0);
    
    if (flightsCost > 0) categories['טיסות'] = flightsCost;
    if (hotelsCost > 0) categories['מלונות'] = hotelsCost;
    
    const labels = Object.keys(categories);
    const data = Object.values(categories);
    
    // Stephen Few color palette - muted, professional
    const colors = [
        '#4A90A4', // Muted blue
        '#5BA58B', // Muted green
        '#E6A957', // Muted orange
        '#A45A5A', // Muted red
        '#7B68A6', // Muted purple
        '#5A8A8A', // Muted teal
        '#B8860B', // Dark goldenrod
        '#708090'  // Slate gray
    ];
    
    if (labels.length === 0) {
        // Show empty state
        ctx.parentElement.innerHTML = '<div class="empty-state" style="padding: 2rem;"><p class="text-secondary">הוסף הוצאות לתקציב כדי לראות את הגרף</p></div>';
        return;
    }
    
    budgetChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `₪${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Render custom legend
    const legendContainer = document.getElementById('budget-legend');
    if (legendContainer) {
        legendContainer.innerHTML = labels.map((label, i) => `
            <div class="legend-item">
                <div class="legend-color" style="background: ${colors[i]}"></div>
                <span>${label}</span>
            </div>
        `).join('');
    }
}

function getCategoryFromName(name) {
    const lower = name.toLowerCase();
    if (lower.includes('טיסה') || lower.includes('flight')) return 'טיסות';
    if (lower.includes('מלון') || lower.includes('hotel') || lower.includes('לינה')) return 'מלונות';
    if (lower.includes('אוכל') || lower.includes('food') || lower.includes('מסעדה')) return 'אוכל';
    if (lower.includes('תחבורה') || lower.includes('transport') || lower.includes('מונית')) return 'תחבורה';
    if (lower.includes('אטרקציה') || lower.includes('כניסה') || lower.includes('attraction')) return 'אטרקציות';
    return 'אחר';
}

function renderDailyCostChart() {
    const ctx = document.getElementById('dailyCostChart');
    if (!ctx) return;
    
    if (dailyCostChart) {
        dailyCostChart.destroy();
    }
    
    const days = tripData.days.length || 7;
    const totalBudget = tripData.budget.reduce((sum, item) => sum + item.amount, 0);
    const avgDaily = days > 0 ? Math.round(totalBudget / days) : 0;
    
    // Generate sample daily data
    const labels = [];
    const data = [];
    for (let i = 1; i <= Math.min(days, 10); i++) {
        labels.push('יום ' + i);
        // Vary around average
        const variance = (Math.random() - 0.5) * avgDaily * 0.5;
        data.push(Math.max(0, Math.round(avgDaily + variance)));
    }
    
    if (data.length === 0 || totalBudget === 0) {
        ctx.parentElement.innerHTML = '<div class="empty-state" style="padding: 2rem;"><p class="text-secondary">הוסף ימים ותקציב כדי לראות את הגרף</p></div>';
        return;
    }
    
    dailyCostChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: '#4A90A4',
                borderRadius: 4,
                maxBarThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return '₪' + context.raw.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f0f0f0'
                    },
                    ticks: {
                        callback: function(value) {
                            return '₪' + value.toLocaleString();
                        }
                    }
                }
            }
        }
    });
}

function renderCategoryBars() {
    const container = document.getElementById('category-bars');
    if (!container) return;
    
    // Calculate totals by category
    const categories = {
        'טיסות': tripData.flights.reduce((sum, f) => sum + (f.price || 0), 0),
        'מלונות': tripData.hotels.reduce((sum, h) => {
            const nights = Math.ceil((new Date(h.checkout) - new Date(h.checkin)) / (1000 * 60 * 60 * 24)) || 0;
            return sum + (h.price || 0) * nights;
        }, 0),
        'אטרקציות': tripData.attractions.length * 150, // Estimate
        'אוכל': tripData.days.length * 500, // Estimate per day
        'תחבורה': tripData.days.length * 200 // Estimate
    };
    
    // Add from budget items
    tripData.budget.forEach(item => {
        const cat = getCategoryFromName(item.name);
        if (categories[cat] !== undefined && !['טיסות', 'מלונות'].includes(cat)) {
            categories[cat] = (categories[cat] || 0) + item.amount;
        }
    });
    
    const maxValue = Math.max(...Object.values(categories), 1);
    
    const colors = {
        'טיסות': '#4A90A4',
        'מלונות': '#5BA58B',
        'אטרקציות': '#E6A957',
        'אוכל': '#A45A5A',
        'תחבורה': '#7B68A6'
    };
    
    container.innerHTML = Object.entries(categories)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([category, value]) => {
            const percentage = (value / maxValue) * 100;
            return `
                <div class="category-bar-item">
                    <span class="category-bar-label">${category}</span>
                    <div class="category-bar-track">
                        <div class="category-bar-fill" style="width: ${percentage}%; background: ${colors[category] || '#708090'}">
                            <span class="category-bar-value">₪${value.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('') || '<p class="text-secondary">אין נתונים להצגה</p>';
}

function renderTimeline() {
    const container = document.getElementById('trip-timeline');
    if (!container) return;
    
    if (tripData.days.length === 0) {
        container.innerHTML = '<p class="text-secondary">הוסף ימים למסלול כדי לראות את ציר הזמן</p>';
        return;
    }
    
    container.innerHTML = tripData.days.map((day, index) => {
        const date = day.date ? new Date(day.date) : null;
        const dayName = date ? date.toLocaleDateString('he-IL', { weekday: 'short' }) : '';
        const dayNum = date ? date.getDate() : index + 1;
        
        return `
            <div class="timeline-item ${index === 0 ? 'active' : ''}">
                <div class="timeline-day">${dayName || 'יום ' + (index + 1)}</div>
                <div class="timeline-date">${dayNum}</div>
                <div class="timeline-location">${day.title || 'לא הוגדר'}</div>
            </div>
        `;
    }).join('');
}

function renderQuickStats() {
    // Flights count
    document.getElementById('stat-flights').textContent = tripData.flights.length;
    
    // Hotel nights
    const hotelNights = tripData.hotels.reduce((sum, h) => {
        const nights = Math.ceil((new Date(h.checkout) - new Date(h.checkin)) / (1000 * 60 * 60 * 24));
        return sum + (isNaN(nights) ? 0 : nights);
    }, 0);
    document.getElementById('stat-nights').textContent = hotelNights;
    
    // Attractions count
    document.getElementById('stat-attractions').textContent = tripData.attractions.length;
    
    // Packing items count
    const packingCount = (tripData.packing.clothing?.length || 0) + 
                         (tripData.packing.health?.length || 0) + 
                         (tripData.packing.tech?.length || 0);
    document.getElementById('stat-packing').textContent = packingCount;
    
    // Daily average
    const totalBudget = tripData.budget.reduce((sum, item) => sum + item.amount, 0);
    const days = tripData.days.length || 1;
    const dailyAvg = Math.round(totalBudget / days);
    document.getElementById('stat-daily-avg').textContent = '₪' + dailyAvg.toLocaleString();
    
    // Per person (assuming 5 people)
    const perPerson = Math.round(totalBudget / 5);
    document.getElementById('stat-per-person').textContent = '₪' + perPerson.toLocaleString();
    
    // Map stats
    const uniqueLocations = new Set();
    tripData.hotels.forEach(h => uniqueLocations.add(h.location));
    document.getElementById('map-cities').textContent = uniqueLocations.size || tripData.hotels.length;
    document.getElementById('map-flights').textContent = tripData.flights.length;
    
    // Estimate distance
    const estimatedDistance = tripData.flights.length > 0 ? (tripData.flights.length * 800) : 0;
    document.getElementById('map-distance').textContent = estimatedDistance.toLocaleString();
}

function initMap() {
    const mapContainer = document.getElementById('trip-map');
    if (!mapContainer) return;
    
    // Clear existing map
    if (tripMap) {
        tripMap.remove();
    }
    
    // Default Thailand coordinates
    const defaultCenter = [13.7563, 100.5018]; // Bangkok
    
    // Initialize map
    tripMap = L.map('trip-map', {
        zoomControl: false,
        attributionControl: false
    }).setView(defaultCenter, 6);
    
    // Add tile layer (simple, clean style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(tripMap);
    
    // Thailand locations
    const locations = {
        'בנגקוק': [13.7563, 100.5018],
        'bangkok': [13.7563, 100.5018],
        'פוקט': [7.8804, 98.3923],
        'phuket': [7.8804, 98.3923],
        'קאטה': [7.8186, 98.2984],
        'kata': [7.8186, 98.2984],
        'פאטונג': [7.8963, 98.3017],
        'patong': [7.8963, 98.3017],
        'צ\'יאנג מאי': [18.7883, 98.9853],
        'chiang mai': [18.7883, 98.9853],
        'קראבי': [8.0863, 98.9063],
        'krabi': [8.0863, 98.9063],
        'איוטאיה': [14.3692, 100.5876],
        'ayutthaya': [14.3692, 100.5876]
    };
    
    // Add markers for hotels
    const markers = [];
    tripData.hotels.forEach(hotel => {
        const locationLower = hotel.location?.toLowerCase() || '';
        let coords = null;
        
        Object.entries(locations).forEach(([name, coord]) => {
            if (locationLower.includes(name.toLowerCase())) {
                coords = coord;
            }
        });
        
        if (coords) {
            const marker = L.marker(coords).addTo(tripMap)
                .bindPopup(`<strong>${hotel.name}</strong><br>${hotel.location}`);
            markers.push(coords);
        }
    });
    
    // If no hotels, add default Bangkok marker
    if (markers.length === 0) {
        L.marker(defaultCenter).addTo(tripMap)
            .bindPopup('<strong>בנגקוק</strong><br>נקודת התחלה');
        markers.push(defaultCenter);
        
        // Add Phuket as example
        L.marker([7.8804, 98.3923]).addTo(tripMap)
            .bindPopup('<strong>פוקט</strong><br>חופים מדהימים');
        markers.push([7.8804, 98.3923]);
    }
    
    // Draw route line
    if (markers.length > 1) {
        L.polyline(markers, {
            color: '#4A90A4',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.7
        }).addTo(tripMap);
    }
    
    // Fit bounds if multiple markers
    if (markers.length > 1) {
        tripMap.fitBounds(markers, { padding: [30, 30] });
    }
}

// ==== INITIALIZE ====
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initFirebase();
    
    // Initialize dashboard after a short delay to ensure DOM is ready
    setTimeout(() => {
        renderDashboard();
    }, 100);
});
