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
    updateDynamicText();
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
    const textMap = {
        'marketing': {
            story1: "Welcome, Director. Our operation is scaling, but we need actionable data targeting. <strong>300 customer profiles</strong> are waiting for a more strategic approach.",
            tip1: "We are using 'Clustering' to group customers based on their <strong>Income</strong> and <strong>Spending habits</strong>. This helps us create tailored advertisements instead of sending the same email to everyone.",
            f1: "Find hidden spending groups in our database.",
            f2: "Make sure our ad budget isn't wasted on the wrong people.",
            tip3: "Look for the 'crowds.' You'll notice some dots are close together. These are people with similar bank balances and similar habits. These 'clusters' are where the profit is hidden.",
            tip4: "If you choose <strong>1 group</strong>, it's cheap to manage but too generic. If you choose <strong>8 groups</strong>, it's very precise but too expensive to organize marketing campaigns. We need the 'Sweet Spot.'",
            elbow: "Look for the 'elbow' or corner in the chart — that's the point where adding more groups stops giving us a huge 'accuracy boost.' <strong>(Usually around K=5 for Marketing data)</strong>.",
            tip5: "Each color is a unique 'Persona.' We can now write different advertisements for each color, making our marketing feel personal to every customer."
        },
        'hr': {
            story1: "Welcome, HR Director. Employee turnover is accelerating. We have <strong>300 employee records</strong> to analyze to understand burnout and retention.",
            tip1: "We are using 'Clustering' based on <strong>Monthly Hours</strong> vs <strong>Satisfaction Score</strong> to find distinct groups of employees requiring different retention strategies.",
            f1: "Identify flight-risk departments naturally.",
            f2: "Ensure wellness initiatives target the right staff.",
            tip3: "Look for the 'crowds.' Notice the separation between highly overworked staff versus underutilized unhappy staff. These groups require totally different HR interventions.",
            tip4: "1 global HR policy will anger everyone. 10 separate HR policies is an administrative nightmare. We need the perfect middle ground to group our workforce.",
            elbow: "Look for the 'elbow' or corner in the chart. Adding infinite HR policies doesn't help materially. <strong>(Usually around K=3 for this HR data)</strong>.",
            tip5: "Each color is a different employee risk profile (e.g., At-Risk Workaholics, Core Happy Staff). We can now design targeted HR interventions."
        },
        'product': {
            story1: "Welcome, Product Lead. We have <strong>300 distinct SKUs</strong> in our catalog, and pricing strategy is becoming chaotic.",
            tip1: "We are clustering our products based on <strong>Price Point</strong> vs <strong>Sales Volume</strong> to restructure our catalog into distinct strategic portfolios (like 'Luxury' vs 'Cash Cows').",
            f1: "Discover hidden product portfolios.",
            f2: "Prevent under-pricing of premium volume goods.",
            tip3: "Look for the 'crowds.' You'll see distinct groupings—high volume/low price goods separated from exclusive luxury low-volume items.",
            tip4: "Too few pricing tiers leaves money on the table. Too many creates extreme supply chain complexity. What is the optimal number of catalog groups?",
            elbow: "Look for the 'elbow' in the chart. Beyond this point, splitting up product categories gives diminishing returns. <strong>(Usually around K=4 for this SKU data)</strong>.",
            tip5: "Each color represents a distinct product portfolio. We can now assign dedicated category managers to handle the sourcing for each group."
        }
    };

    const c = textMap[currentScenario];
    if(c) {
        document.getElementById('story-text-1').innerHTML = c.story1;
        document.getElementById('manager-tip-1').innerHTML = c.tip1;
        document.getElementById('feature-1-desc').innerHTML = c.f1;
        document.getElementById('feature-2-desc').innerHTML = c.f2;
        document.getElementById('manager-tip-3').innerHTML = c.tip3;
        document.getElementById('manager-tip-4').innerHTML = c.tip4;
        document.getElementById('elbow-hint').innerHTML = c.elbow;
        document.getElementById('manager-tip-5').innerHTML = c.tip5;
    }

    if(simulationData.length > 0) {
        const f1Name = simulationData[0].Feature1Name;
        const f2Name = simulationData[0].Feature2Name;
        
        // Update table headers
        document.getElementById('th-feature1').innerText = f1Name;
        document.getElementById('th-feature2').innerText = f2Name;
    }
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
    let optimalK = 5; 
    let explanation = "The AI selected 5 groups because it hits the perfect 'elbow' point: any fewer, and you arbitrarily mix distinct customer demographics. Any more, and the extra ad spend isn't worth the minor precision gain.";
    
    if (currentScenario === 'hr') {
        optimalK = 3;
        explanation = "The AI selected 3 groups because it identified exactly three clear employee personas: overworked/burnt out, happy/core, and underutilized. More groups would just cause HR policy confusion.";
    }
    if (currentScenario === 'product') {
        optimalK = 4;
        explanation = "The AI selected 4 portfolios. Adding a 5th pricing tier requires massive supply chain reorganization that doesn't significantly lower the mathematical variance of the groups.";
    }
    
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
        
        // Target modal injection
        document.getElementById('ai-modal-content').innerText = explanation;
        document.getElementById('ai-modal').classList.remove('hidden');
        
    }, 1500); // 1.5s delay to let the user see the slider changed automatically
}

function closeAiModal() {
    document.getElementById('ai-modal').classList.add('hidden');
}

// Slider handling
document.getElementById('k-slider').addEventListener('input', (e) => {
    document.getElementById('k-value').innerText = e.target.value;
});
