// Game State
let currentLevel = 1;
let customerData = [];
let customerChart = null;
let clusterChart = null;
let elbowChart = null;
const apiBase = "";

// Initialize Lucide icons
lucide.createIcons();

// --- Navigation Logic ---

function showLevel(level) {
    document.querySelectorAll('.level-card').forEach(card => card.classList.remove('active'));
    document.getElementById(`level-${level}`).classList.add('active');
    
    // Update stepper
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.level);
        step.classList.remove('active', 'completed');
        if (stepNum === level) step.classList.add('active');
        if (stepNum < level) step.classList.add('completed');
    });

    document.getElementById('current-level-badge').innerText = level;

    // Trigger level-specific logic
    onLevelEnter(level);
}

function nextLevel() {
    if (currentLevel < 6) {
        currentLevel++;
        showLevel(currentLevel);
    }
}

function resetGame() {
    currentLevel = 1;
    showLevel(1);
}

async function onLevelEnter(level) {
    if (level === 2 && customerData.length === 0) {
        await fetchDataset();
    }
    if (level === 3) {
        renderCustomerChart();
    }
    if (level === 4) {
        await fetchElbowData();
    }
}

// --- API Calls ---

async function fetchDataset() {
    showLoader(true);
    try {
        const response = await fetch(`${apiBase}/dataset`);
        customerData = await response.json();
        populateTable();
    } catch (error) {
        console.error("Failed to fetch dataset:", error);
    } finally {
        showLoader(false);
    }
}

async function fetchElbowData() {
    try {
        const response = await fetch(`${apiBase}/elbow`);
        const data = await response.json();
        renderElbowChart(data.wcss);
    } catch (error) {
        console.error("Elbow data fetch failed:", error);
    }
}

async function runClustering() {
    const k = document.getElementById('k-slider').value;
    showLoader(true);
    try {
        const response = await fetch(`${apiBase}/cluster`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ k: parseInt(k) })
        });
        const result = await response.json();
        
        renderClusterChart(result.labels, result.centers);
        generateSegmentInsights(result.labels, result.centers);
        calculateGameScore(parseInt(k), result.inertia);
        nextLevel();
    } catch (error) {
        console.error("Clustering failed:", error);
    } finally {
        showLoader(false);
    }
}

// --- UI Helpers ---

function showLoader(show) {
    document.getElementById('global-loader').classList.toggle('hidden', !show);
}

function populateTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    customerData.slice(0, 8).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${String(row.CustomerID).padStart(3, '0')}</td>
            <td>${row.Age}</td>
            <td>$${row['Annual Income (k$)']}k</td>
            <td>${row['Spending Score (1-100)']}/100</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Charts Logic ---

Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Outfit', sans-serif";

function renderCustomerChart() {
    const ctx = document.getElementById('customerChart').getContext('2d');
    if (customerChart) customerChart.destroy();

    const dataPoints = customerData.map(d => ({
        x: d['Annual Income (k$)'],
        y: d['Spending Score (1-100)']
    }));

    customerChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Customers',
                data: dataPoints,
                backgroundColor: 'rgba(79, 70, 229, 0.4)',
                borderColor: '#4f46e5',
                borderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 10,
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Annual Income ($k)', font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Spending Score (1-100)', font: { weight: 'bold' } } }
            },
            plugins: {
                legend: { labels: { font: { weight: 'bold' } } }
            }
        }
    });
}

function renderElbowChart(wcss) {
    const ctx = document.getElementById('elbowChart').getContext('2d');
    if (elbowChart) elbowChart.destroy();

    elbowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [1,2,3,4,5,6,7,8,9,10],
            datasets: [{
                label: 'WCSS (Inertia)',
                data: wcss,
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.05)',
                fill: true,
                tension: 0.4,
                borderWidth: 4,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#7c3aed',
                pointBorderWidth: 2,
                pointRadius: 6,
                pointHoverRadius: 9
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    backgroundColor: '#1e293b',
                    padding: 12,
                    titleFont: { size: 14 }
                }
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: 'Number of Clusters (K)', font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Inertia Score', font: { weight: 'bold' } } }
            }
        }
    });
}

function renderClusterChart(labels, centers) {
    const ctx = document.getElementById('clusterChart').getContext('2d');
    if (clusterChart) clusterChart.destroy();

    const colors = ['#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

    const datasets = [];
    centers.forEach((center, i) => {
        const clusterPoints = customerData.filter((_, idx) => labels[idx] === i).map(d => ({
            x: d['Annual Income (k$)'],
            y: d['Spending Score (1-100)']
        }));

        datasets.push({
            label: `Segment ${i + 1}`,
            data: clusterPoints,
            backgroundColor: `${colors[i % colors.length]}aa`,
            borderColor: colors[i % colors.length],
            borderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 9,
            pointBackgroundColor: '#fff'
        });
    });

    datasets.push({
        label: 'Centroids',
        data: centers.map(c => ({ x: c[0], y: c[1] })),
        backgroundColor: '#1e293b',
        borderColor: '#fff',
        pointStyle: 'rectRot',
        pointRadius: 14,
        borderWidth: 3,
        showLine: false
    });

    clusterChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Income ($k)', font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Spending Score', font: { weight: 'bold' } } }
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, font: { weight: 'bold' } } }
            }
        }
    });
}

// --- Dynamic Business Logic ---

function generateSegmentInsights(labels, centers) {
    const container = document.getElementById('segment-descriptions');
    container.innerHTML = '';

    centers.forEach((center, idx) => {
        const income = center[0];
        const score = center[1];
        
        let profile = "Steady Shoppers";
        let recommendation = "Loyalty benefits & standard offers";
        let icon = "users";

        if (income > 80 && score > 80) {
            profile = "Luxury Enthusiasts";
            recommendation = "White-glove service & VIP exclusivity";
            icon = "crown";
        } else if (income > 80 && score < 40) {
            profile = "Frugal High-Earners";
            recommendation = "Investment-quality marketing & value-per-dollar messaging";
            icon = "wallet";
        } else if (income < 40 && score > 70) {
            profile = "Deal Chasers";
            recommendation = "Flash sales, BOGO offers, and psychological pricing";
            icon = "zap";
        } else if (income < 40 && score < 40) {
            profile = "Budget Minimalists";
            recommendation = "Essential product bundles and low-price entry points";
            icon = "shopping-bag";
        }

        const box = document.createElement('div');
        box.className = 'insight-card';
        box.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:15px">
                <i data-lucide="${icon}" style="color:var(--primary)"></i>
                <h3 style="font-size:1.25rem">${profile}</h3>
            </div>
            <p style="color:var(--text-dim); margin-bottom:10px">The average profile in this segment earns roughly $${Math.round(income)}k with a spending score of ${Math.round(score)}.</p>
            <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px">
                <strong>Strategy:</strong> ${recommendation}
            </div>
        `;
        container.appendChild(box);
    });
    lucide.createIcons();
}

function calculateGameScore(k, inertia) {
    // Scoring logic: Balance of precision (low inertia) and cost (low K)
    // Higher K decreases inertia but increases operational cost.
    // The "Sweet Spot" is usually K=5 for this specific synthetic dataset.
    
    let precision = Math.max(0, 100 - (inertia / 1000));
    let cost = (k-1) * 20; // Each additional cluster adds $20k in ops cost
    let roi = Math.round(precision - (cost / 4));
    
    document.getElementById('precision-score').innerText = `${Math.round(precision)}%`;
    document.getElementById('cost-score').innerText = `$${cost}k`;
    document.getElementById('roi-score').innerText = `${roi}%`;

    const gradeEl = document.getElementById('final-grade');
    const commentEl = document.getElementById('grade-comment');
    
    gradeEl.className = 'grading-badge';
    
    if (k === 5) {
        gradeEl.innerText = "A+";
        gradeEl.classList.add('grade-a');
        commentEl.innerText = "Perfect Segmentation! You've captured every natural demographic cluster without over-complicating operations.";
    } else if (k === 4 || k === 6) {
        gradeEl.innerText = "B";
        gradeEl.classList.add('grade-b');
        commentEl.innerText = k === 4 ? "Good job, but you missed some nuances in customer behavior." : "Effective, but your operational overhead is starting to cut into profits.";
    } else {
        gradeEl.innerText = "C-";
        gradeEl.classList.add('grade-c');
        commentEl.innerText = "Sub-optimal strategy. Your segments are either too broad to be personal, or too fragmented to be profitable.";
    }
}

// Slider handling
document.getElementById('k-slider').addEventListener('input', (e) => {
    document.getElementById('k-value').innerText = e.target.value;
});
