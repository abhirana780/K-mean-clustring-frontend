// Game State
let currentLevel = 1;
let currentScenario = 'marketing';
let simulationData = [];
let customerChart = null;
let clusterChart = null;
let elbowChart = null;
const apiBase = "";

// Initialize Lucide icons
lucide.createIcons();

// --- Scenario Management ---
function updateScenario() {
    currentScenario = document.getElementById('scenario-select').value;
    resetGame();
}

// --- Navigation Logic ---

function showLevel(level) {
    document.querySelectorAll('.level-card').forEach(card => card.classList.remove('active'));
    document.getElementById(`level-${level}`).classList.add('active');
    
    document.querySelectorAll('.step').forEach(step => {
        const stepNum = parseInt(step.dataset.level);
        step.classList.remove('active', 'completed');
        if (stepNum === level) step.classList.add('active');
        if (stepNum < level) step.classList.add('completed');
    });

    document.getElementById('current-level-badge').innerText = level;
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
    simulationData = [];
    showLevel(1);
}

async function onLevelEnter(level) {
    if (level === 2 && simulationData.length === 0) {
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
        const response = await fetch(`${apiBase}/dataset?scenario=${currentScenario}`);
        simulationData = await response.json();
        updateDynamicText();
        populateTable();
    } catch (error) {
        console.error("Failed to fetch dataset:", error);
    } finally {
        showLoader(false);
    }
}

async function fetchElbowData() {
    try {
        const response = await fetch(`${apiBase}/elbow?scenario=${currentScenario}`);
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
            body: JSON.stringify({ k: parseInt(k), scenario: currentScenario })
        });
        const result = await response.json();
        
        renderClusterChart(result.labels, result.centers);
        generateSegmentInsights();
        calculateGameScore(parseInt(k), result.inertia);
        nextLevel();
    } catch (error) {
        console.error("Clustering failed:", error);
    } finally {
        showLoader(false);
    }
}

// --- Dynamic UI Updaters ---

function updateDynamicText() {
    if(simulationData.length === 0) return;
    const f1Name = simulationData[0].Feature1Name;
    const f2Name = simulationData[0].Feature2Name;
    
    // Update table headers
    document.getElementById('th-feature1').innerText = f1Name;
    document.getElementById('th-feature2').innerText = f2Name;
}

function populateTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    simulationData.slice(0, 8).forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.ID}</td>
            <td>${row.Feature1}</td>
            <td>${row.Feature2}</td>
        `;
        tbody.appendChild(tr);
    });
}

function showLoader(show) {
    document.getElementById('global-loader').classList.toggle('hidden', !show);
}

// --- Charts Logic ---
Chart.defaults.color = '#64748b';
Chart.defaults.font.family = "'Outfit', sans-serif";

function renderCustomerChart() {
    const ctx = document.getElementById('customerChart').getContext('2d');
    if (customerChart) customerChart.destroy();

    const f1Name = simulationData[0].Feature1Name;
    const f2Name = simulationData[0].Feature2Name;

    const dataPoints = simulationData.map(d => ({ x: d.Feature1, y: d.Feature2 }));

    customerChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Data Points',
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
                x: { grid: { color: '#f1f5f9' }, title: { display: true, text: f1Name, font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: f2Name, font: { weight: 'bold' } } }
            },
            plugins: {
                legend: { display: false }
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
                label: 'Efficiency Score',
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
                tooltip: { backgroundColor: '#1e293b', padding: 12, titleFont: { size: 14 } }
            },
            scales: {
                x: { grid: { display: false }, title: { display: true, text: 'Number of Groups', font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: 'Score', font: { weight: 'bold' } } }
            }
        }
    });
}

function renderClusterChart(labels, centers) {
    const ctx = document.getElementById('clusterChart').getContext('2d');
    if (clusterChart) clusterChart.destroy();

    const f1Name = simulationData[0].Feature1Name;
    const f2Name = simulationData[0].Feature2Name;
    const colors = ['#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

    const datasets = [];
    centers.forEach((center, i) => {
        const clusterPoints = simulationData.filter((_, idx) => labels[idx] === i).map(d => ({
            x: d.Feature1,
            y: d.Feature2
        }));

        datasets.push({
            label: `Group ${i + 1}`,
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
        label: 'Averages',
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
                x: { grid: { color: '#f1f5f9' }, title: { display: true, text: f1Name, font: { weight: 'bold' } } },
                y: { grid: { color: '#f1f5f9' }, title: { display: true, text: f2Name, font: { weight: 'bold' } } }
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, font: { weight: 'bold' } } }
            }
        }
    });
}

// --- Dynamic Business Logic ---

function generateSegmentInsights() {
    const container = document.getElementById('segment-descriptions');
    container.innerHTML = `
        <div class="manager-tip" style="grid-column: 1 / -1; margin-top: 0;">
            <h4><i data-lucide="check-circle"></i> Insight Generated</h4>
            <p>Your groups are formed. Each is defined by its average (the dark square). Review how these groups differ on your chart to assign strategy!</p>
        </div>
    `;
    lucide.createIcons();
}

function calculateGameScore(k, inertia) {
    let optimalK = 5; // default marketing
    if (currentScenario === 'hr') optimalK = 3;
    if (currentScenario === 'product') optimalK = 4;

    let precisionRaw = Math.max(0, 100 - (inertia / 1000));
    let precision = Math.min(100, precisionRaw + (k > optimalK ? 10 : 0)); // Bonus for overfitting raw inertia
    let cost = (k-1) * 20;
    
    // Mock ROI calculation based on hitting optimal K
    let distance = Math.abs(k - optimalK);
    let roi = 100 - (distance * 25);
    
    document.getElementById('precision-score').innerText = `${Math.round(precision)}%`;
    document.getElementById('cost-score').innerText = `$${cost}k`;
    document.getElementById('roi-score').innerText = `${roi}%`;

    const gradeEl = document.getElementById('final-grade');
    const commentEl = document.getElementById('grade-comment');
    const feedbackPanel = document.getElementById('feedback-panel');
    
    gradeEl.className = 'grading-badge';
    feedbackPanel.style.display = 'block';
    
    if (k === optimalK) {
        gradeEl.innerText = "A+";
        gradeEl.classList.add('grade-a');
        commentEl.innerText = "Perfect Strategy! You captured every natural trend perfectly.";
        feedbackPanel.innerHTML = `
            <h4><i data-lucide="award"></i> Excellent Leadership</h4>
            <p>You correctly interpreted the "Efficiency Guide". ${k} is the optimal number of groups needed to maximize profit while minimizing cost.</p>
        `;
    } else if (distance === 1) {
        gradeEl.innerText = "B";
        gradeEl.classList.add('grade-b');
        commentEl.innerText = "Effective, but your strategy has minor flaws.";
        feedbackPanel.innerHTML = `
            <h4><i data-lucide="alert-circle"></i> How to get an A+</h4>
            <p style="margin-bottom: 1rem;">Look back at the <strong>Efficiency Curve</strong> in Step 4. You are very close to the "Elbow" (the sharpest turn in the line), but you missed the exact peak. Try adjusting your groups by 1.</p>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-primary" onclick="retryPhase4()" style="padding: 0.5rem 1rem; font-size: 0.9rem;"><i data-lucide="rotate-ccw"></i> Retry Strategy</button>
                <button class="btn btn-outline" onclick="aiAutoFix()" style="padding: 0.5rem 1rem; font-size: 0.9rem;"><i data-lucide="cpu"></i> AI Auto-Fix</button>
            </div>
        `;
    } else {
        gradeEl.innerText = "C-";
        gradeEl.classList.add('grade-c');
        commentEl.innerText = "Sub-optimal strategy. Your plans are poorly targeted.";
        
        let mistake = k < optimalK ? "You have too few groups. You are treating completely different cases exactly the same." : "You have too many groups. It's too complex and expensive.";
        
        feedbackPanel.innerHTML = `
            <h4><i data-lucide="trending-down"></i> How to fix this</h4>
            <p style="margin-bottom: 1rem;">${mistake} When you restart, pay close attention to the <strong>Efficiency Guide chart in Step 4</strong>. Look for the sharpest bend.</p>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                <button class="btn btn-primary" onclick="retryPhase4()" style="padding: 0.5rem 1rem; font-size: 0.9rem;"><i data-lucide="rotate-ccw"></i> Retry Strategy</button>
                <button class="btn btn-outline" onclick="aiAutoFix()" style="padding: 0.5rem 1rem; font-size: 0.9rem;"><i data-lucide="cpu"></i> AI Auto-Fix</button>
            </div>
        `;
    }
    lucide.createIcons();
}

// Action Handlers for Feedback Panel
function retryPhase4() {
    currentLevel = 4;
    showLevel(4);
}

async function aiAutoFix() {
    let optimalK = 5; // default marketing
    if (currentScenario === 'hr') optimalK = 3;
    if (currentScenario === 'product') optimalK = 4;
    
    // Animate slider moving to optimal K automatically
    document.getElementById('k-slider').value = optimalK;
    document.getElementById('k-value').innerText = optimalK;
    
    // Visually jump back to Phase 4 for a moment to show the 'AI' working
    currentLevel = 4;
    showLevel(4);
    document.getElementById('run-clustering-btn').innerHTML = 'AI Executing... <i class="lucide-cpu"></i>';
    
    setTimeout(async () => {
        await runClustering();
        document.getElementById('run-clustering-btn').innerHTML = 'Execute Strategy Audit <i data-lucide="chevron-right"></i>';
    }, 1500); // 1.5s delay to let the user see the slider changed automatically
}

// Slider handling
document.getElementById('k-slider').addEventListener('input', (e) => {
    document.getElementById('k-value').innerText = e.target.value;
});
