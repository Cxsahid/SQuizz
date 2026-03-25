// SQuizz Phase 1, 2 & 3 Logic
const State = {
    user: null, // Track logged-in username
    view: 'hero',
    categories: [],
    currentCategory: null,
    questions: [],
    currentQuestionIndex: 0,
    answers: [], // User selected answers (-1 for skipped)
    
    // Phase 2 State
    questionTimeRemaining: 15,
    questionTimerInterval: null,
    totalSeconds: 0,
    totalTimeInterval: null,

    // Phase 7 Filters
    currentTag: 'all',
    currentSort: 'popular',
    searchQuery: ''
};

const UI = {
    views: {
        login: document.getElementById('view-login'),
        register: document.getElementById('view-register'),
        hero: document.getElementById('view-hero'),
        multiplayer: document.getElementById('view-multiplayer'),
        categories: document.getElementById('view-categories'),
        quiz: document.getElementById('view-quiz'),
        result: document.getElementById('view-result'),
        leaderboard: document.getElementById('view-leaderboard'),
        profile: document.getElementById('view-profile')
    },
    userNavDisplay: document.getElementById('userNavDisplay'),
    usernameInput: document.getElementById('usernameInput'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    leaderboardContent: document.getElementById('leaderboardContent'),
    liveMultiplayerLeaderboard: document.getElementById('liveMultiplayerLeaderboard'),
    liveLBPillContainer: document.getElementById('liveLBPillContainer'),
    navHomeBtn: document.getElementById('navHomeBtn'),
    navCategoriesBtn: document.getElementById('navCategoriesBtn'),
    navLeaderboardBtn: document.getElementById('navLeaderboardBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    // Phase 7 Elements
    topicSearchInput: document.getElementById('topicSearchInput'),
    instantResults: document.getElementById('instantResults'),
    tagBar: document.getElementById('tagBar'),
    sortTopics: document.getElementById('sortTopics'),
    exploreTitle: document.getElementById('exploreTitle'),
    exploreSearchContainer: document.getElementById('exploreSearchContainer'),
    btnStart: document.getElementById('startBtn'),
    btnExplore: document.getElementById('exploreBtn'),
    categoryGrid: document.getElementById('categoryGrid'),
    // Quiz Elements
    quizCategoryBadge: document.getElementById('quizCategoryBadge'),
    quizTimer: document.getElementById('quizTimer'),
    qCurrent: document.getElementById('qCurrent'),
    qTotal: document.getElementById('qTotal'),
    questionText: document.getElementById('questionText'),
    optionsGrid: document.getElementById('optionsGrid'),
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    // Result Elements
    finalScoreText: document.getElementById('finalScoreText'),
    totalTimeText: document.getElementById('totalTimeText'),
    accuracyText: document.getElementById('accuracyText'),
    resultMessage: document.getElementById('resultMessage'),
    homeBtn: document.getElementById('homeBtn'),

};

async function init() {
    initSpaceBg();
    bindEvents();
    checkUser();
    await loadData();
}

// Interactive Canvas Background
const canvas = document.getElementById('spaceBg');
const ctx = canvas?.getContext('2d');
let particles = [];

function initSpaceBg() {
    if(!canvas || !ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particles = [];
    for(let i=0; i<150; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2,
            speed: Math.random() * 0.5 + 0.1
        });
    }
    animateSpace();
}

function animateSpace() {
    if(!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isLight = document.body.classList.contains('light-mode');
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(6,182,212,0.3)';
    
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        p.y -= p.speed; 
        if(p.y < 0) {
            p.y = canvas.height;
            p.x = Math.random() * canvas.width;
        }
    });
    requestAnimationFrame(animateSpace);
}

window.addEventListener('resize', () => {
    if(canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
});

function checkUser() {
    const storedUser = localStorage.getItem('squizz_active_user');
    if (storedUser) {
        State.user = storedUser;
        updateNavUser();
    } else {
        renderLoggedOutNav();
    }
}

function renderLoggedOutNav() {
    if(UI.userNavDisplay) {
        UI.userNavDisplay.innerHTML = `<button class="btn btn-glass" id="navLoginBtn">Log In</button><button class="btn btn-primary" id="navRegisterBtn" style="margin-left:1rem;">Register</button>`;
        document.getElementById('navLoginBtn').addEventListener('click', () => switchView('login'));
        document.getElementById('navRegisterBtn').addEventListener('click', () => switchView('register'));
    }
}

function updateNavUser() {
    if (State.user && UI.userNavDisplay) {
        UI.userNavDisplay.innerHTML = `<span class="user-badge" id="userBadge" style="margin-right: 15px; cursor: pointer;">👾 ${State.user}</span> <button class="btn btn-outline" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;" id="logoutBtn">Logout</button>`;
        // NEW API Hook to check Daily Streak
        fetchUserStreak();

        document.getElementById('logoutBtn').addEventListener('click', () => {
            localStorage.removeItem('squizz_active_user');
            State.user = null;
            
            // Defeat browser cache on inputs upon logout
            const loginId = document.getElementById('loginIdentifier');
            const loginPw = document.getElementById('loginPassword');
            const regU = document.getElementById('regUsername');
            const regE = document.getElementById('regEmail');
            const regP = document.getElementById('regPassword');
            if(loginId) loginId.value = '';
            if(loginPw) loginPw.value = '';
            if(regU) regU.value = '';
            if(regE) regE.value = '';
            if(regP) regP.value = '';
            
            renderLoggedOutNav();
            switchView('hero');
        });
    }
}

// --- Backend API Integration (Flask/SQLite) ---
async function fetchUserStreak() {
    if(!State.user) return;
    try {
        const res = await fetch(`/api/user/${State.user}`);
        if(res.ok) {
            const data = await res.json();
            const streakText = document.getElementById('streakCountText');
            const badgeText = document.getElementById('warriorBadge');
            
            if(streakText) streakText.textContent = `${data.streak} Days`;
            if(badgeText) {
                badgeText.textContent = data.badges.includes('7-Day Warrior') ? ' | 🛡️ Warrior' : '';
                badgeText.style.color = data.badges.includes('7-Day Warrior') ? '#fbbf24' : 'inherit';
            }
        }
    } catch(e) { console.log('Streak API offline. Running in Local-Only mode.'); }
}

async function logActivity() {
    if(!State.user) return;
    try {
        await fetch('/api/activity', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: State.user})
        });
        fetchUserStreak(); // Trigger visual update of the fire badge
    } catch(e) { console.log('Streak API offline. Running in Local-Only mode.'); }
}

async function loadProfile() {
    if(!State.user) return;

    try {
        const res = await fetch(`/api/profile/${State.user}`);
        if(!res.ok) throw new Error('Profile fetch failed');

        const data = await res.json();
        
        // Populate new profile elements
        const avatar = document.getElementById('profileAvatarImg');
        if (avatar) {
            if (data.avatar_url) {
                avatar.src = data.avatar_url;
            } else {
                avatar.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${data.username || State.user}&backgroundColor=020617&baseColor=06b6d4`;
            }
        }
        
        const usernameElem = document.getElementById('profileUsername');
        if (usernameElem) usernameElem.textContent = data.username || State.user;
        
        const totalQuizzesElem = document.getElementById('profileTotalQuizzes');
        if (totalQuizzesElem) totalQuizzesElem.textContent = data.total_quizzes_played ?? 0;

        const accuracyElem = document.getElementById('profileAccuracy');
        if (accuracyElem) accuracyElem.textContent = `${data.accuracy_percentage ?? 0}%`;

        const streakElem = document.getElementById('profileStreak');
        if (streakElem) streakElem.textContent = data.current_streak ?? 0;

        // NEW: Load Level and XP Progress
        const levelDisplay = document.getElementById('profileLevelDisplay');
        const levelTitle = document.getElementById('profileLevelTitle');
        const levelPercentage = document.getElementById('profileLevelPercentage');
        const progressBar = document.getElementById('profileProgressBar');
        
        if(levelDisplay) {
            const level = data.level || 1;
            levelDisplay.textContent = `Level ${level}`;
            
            const titles = ["Novice Explorer", "Beginner Learner", "Tech Enthusiast", "Code Artisan", "Senior Full-Stack Engineer", "Principal Architect", "System Lord", "AI Overlord"];
            const titleIndex = Math.min(Math.floor((level - 1) / 5), titles.length - 1);
            if(levelTitle) levelTitle.textContent = titles[titleIndex];
            
            const xpInCurrentLevel = (data.xp || 0) % 500;
            const progressPercent = Math.round((xpInCurrentLevel / 500) * 100);
            
            if(levelPercentage) levelPercentage.textContent = `${progressPercent}% to Lv. ${level + 1}`;
            if(progressBar) progressBar.style.width = `${progressPercent}%`;
        }

        const profileTotalTime = document.getElementById('profileTotalTime');
        if (profileTotalTime) {
            const totalSecs = data.total_time_spent || 0;
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            
            let parts = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0 || h > 0) parts.push(`${m}m`);
            parts.push(`${s}s`);
            
            profileTotalTime.innerHTML = `⏱️ Total Focus: <span style="color:var(--primary);">${parts.join(' ')}</span>`;
        }

        // Render Quiz History (My Attempts)
        renderHistory(data.quiz_history);
        
        // Render Contribution Heatmap
        renderHeatmap(data.quiz_history);
        
        // Render Timeline
        renderTimeline(data.quiz_history);

        // Render Performance Chart
        renderPerformanceChart(data.quiz_history);

    } catch (e) {
        console.error("Failed to load profile data", e);
        // Display error state in UI
    }
}

function renderHistory(history) {
    // Only used conceptually now if needed, but timeline replaced it visually.
    // We keep empty state if no history.
}

function renderHeatmap(history) {
    const heatmapContainer = document.getElementById('profileHeatmap');
    if(!heatmapContainer) return;

    if (!history || history.length === 0) {
        heatmapContainer.innerHTML = '<p class="profile-empty" style="color:var(--text-secondary)">No activity yet. Start a quiz to light up the map!</p>';
        return;
    }

    const contributions = {};
    const today = new Date();
    const days = 140; // 20 weeks 

    history.forEach(item => {
        const date = new Date(item.completed_at).toISOString().split('T')[0];
        contributions[date] = (contributions[date] || 0) + 1;
    });

    let heatmapHTML = '';
    for (let i = days; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        const count = contributions[dateString] || 0;
        
        let level = 0;
        if (count > 0) level = 1;
        if (count > 2) level = 2;
        if (count >= 5) level = 3;
        
        heatmapHTML += `
            <div class="heatmap-cube" data-level="${level}">
                <div class="tooltip">${count} quizzes on ${dateString}</div>
            </div>`;
    }
    heatmapContainer.innerHTML = heatmapHTML;
}

function renderTimeline(history) {
    const timelineContainer = document.getElementById('profileTimeline');
    if(!timelineContainer) return;
    
    history = Array.isArray(history) ? history.slice(0, 5) : [];

    if (history.length === 0) {
        timelineContainer.innerHTML = '<div class="profile-empty" style="color:var(--text-secondary)">Timeline is completely clear.</div>';
        return;
    }

    timelineContainer.innerHTML = history.map((item, index) => {
        const dateObj = new Date(item.completed_at);
        const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
        
        let durationStr = "0s";
        if (item.time_spent > 0) {
            const h = Math.floor(item.time_spent / 3600);
            const m = Math.floor((item.time_spent % 3600) / 60);
            const s = item.time_spent % 60;
            
            let parts = [];
            if (h > 0) parts.push(`${h}h`);
            if (m > 0) parts.push(`${m}m`);
            parts.push(`${s}s`);
            durationStr = parts.join(' ');
        }

        return `
        <div class="tle-item" style="animation-delay: ${index * 0.1}s">
            <div class="tle-content">
                <div class="tle-title">Completed ${item.quiz_name}</div>
                <div class="tle-desc">Achieved a score of ${item.score} <br> <span style="font-size:0.75rem; color:var(--primary);">⏱️ Focus Time: ${durationStr}</span></div>
                <span class="tle-time">${dateStr} • ${timeStr}</span>
            </div>
        </div>
    `}).join('');
}

function renderPerformanceChart(history) {
    const chartContainer = document.getElementById('performanceChart');
    if (!chartContainer) return;

    history = Array.isArray(history) ? history.reverse() : []; // infinite

    if (history.length < 2) {
        chartContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--text-secondary); text-align:center;">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:1rem; opacity:0.5;"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                <p>Play at least 2 quizzes to generate your performance chart.</p>
            </div>
        `;
        return;
    }

    const scores = history.map(item => {
        const parts = item.score.split('/');
        return (parseInt(parts[0]) / parseInt(parts[1])) * 100;
    });

    const maxScore = 100;
    const paddingX = 40;
    const paddingY = 60;
    const pointSpacing = 120; // 120px per point for wide graph
    const width = Math.max(chartContainer.clientWidth || 600, paddingX * 2 + (history.length - 1) * pointSpacing);
    const height = chartContainer.clientHeight || 280; // slightly taller to fit tooltips

    // Apply scroll style
    chartContainer.style.overflowX = 'auto';
    chartContainer.style.overflowY = 'hidden';
    chartContainer.style.scrollbarWidth = 'thin';
    chartContainer.style.scrollbarColor = 'var(--primary) rgba(255,255,255,0.05)';

    let pathD = `M ${paddingX} ${height}`; // Start for area fill
    let lineD = '';
    
    const pointsData = scores.map((score, index) => {
        const x = ((width - paddingX * 2) / (scores.length - 1)) * index + paddingX;
        const y = height - paddingY - (score / maxScore) * (height - paddingY * 2);
        
        if(index === 0) {
            pathD += ` L ${x} ${y}`;
            lineD += `M ${x} ${y}`;
        } else {
            const prevX = ((width - paddingX * 2) / (scores.length - 1)) * (index - 1) + paddingX;
            const prevY = height - paddingY - (scores[index-1] / maxScore) * (height - paddingY * 2);
            const cpX1 = prevX + (x - prevX) / 2;
            pathD += ` C ${cpX1} ${prevY}, ${cpX1} ${y}, ${x} ${y}`;
            lineD += ` C ${cpX1} ${prevY}, ${cpX1} ${y}, ${x} ${y}`;
        }
        
        const dateObj = new Date(history[index].completed_at);
        const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        const dateStr = dateObj.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
        
        let diff = 0;
        if (index > 0) {
            diff = score - scores[index-1];
        }
        
        return { x, y, score, name: history[index].quiz_name, dateStr, timeStr, datetime: `${dateStr} @ ${timeStr}`, diff, isFirst: index === 0 };
    });

    pathD += ` L ${pointsData[pointsData.length-1].x} ${height} Z`;

    const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="chart-svg">
            <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.6"/>
                    <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path class="chart-area" d="${pathD}" />
            <path class="chart-line" d="${lineD}" />
            ${pointsData.map((p) => {
                let trendText = '';
                let trendColor = 'var(--text-secondary)';
                if (!p.isFirst) {
                    if (p.diff > 0) { trendText = '▲ +' + p.diff.toFixed(0) + '%'; trendColor = '#22c55e'; }
                    else if (p.diff < 0) { trendText = '▼ ' + p.diff.toFixed(0) + '%'; trendColor = '#ef4444'; }
                    else { trendText = '➖ 0%'; }
                } else {
                    trendText = '🚀 Start';
                }

                return `
                <text x="${p.x}" y="${p.y - 20}" fill="${trendColor}" font-size="13" font-weight="bold" text-anchor="middle" style="pointer-events:none; text-shadow: 0 0 5px rgba(0,0,0,0.8);">${trendText}</text>
                <text x="${p.x}" y="${height - 25}" fill="var(--text-secondary)" font-size="11" text-anchor="middle" font-family="monospace" style="pointer-events:none;">${p.dateStr}</text>
                <text x="${p.x}" y="${height - 10}" fill="var(--text-secondary)" font-size="9" text-anchor="middle" opacity="0.6" style="pointer-events:none;">${p.timeStr}</text>

                <g class="chart-point" transform="translate(${p.x},${p.y})" style="cursor:pointer;">
                    <circle r="6" fill="var(--bg-dark)" stroke="var(--primary)" stroke-width="2" class="chart-circle" style="transition:all 0.2s;" onmouseover="this.setAttribute('r', '9'); this.setAttribute('fill', 'var(--primary)')" onmouseout="this.setAttribute('r', '6'); this.setAttribute('fill', 'var(--bg-dark)')" />
                    <foreignObject x="-95" y="-80" width="190" height="60" style="overflow:visible; z-index: 100;">
                        <div class="tooltip" style="position:static; transform:none; opacity:0; margin:0 auto; width:max-content; pointer-events:none; padding:0.5rem 0.8rem; text-align:center; background:rgba(2,6,23,0.9); border:1px solid var(--primary); border-radius:6px; box-shadow:0 5px 15px rgba(0,0,0,0.5), inset 0 0 10px rgba(6,182,212,0.2);">
                            <span style="font-weight:bold; color:var(--text-primary);">${p.score.toFixed(0)}%</span> <span style="color:var(--text-secondary);">on ${p.name}</span><br>
                            <span style="color:var(--primary); font-size: 0.70rem; font-family:monospace; letter-spacing:1px;">🗓️ ${p.datetime}</span>
                        </div>
                    </foreignObject>
                </g>
            `}).join('')}
        </svg>
    `;

    chartContainer.innerHTML = svg;
    
    // Automatically scroll chart to the end natively to show latest data
    setTimeout(() => {
        chartContainer.scrollLeft = chartContainer.scrollWidth;
    }, 100);

    // Small animation effect for stat counters
    document.querySelectorAll('.counter-anim').forEach(el => {
        el.style.opacity = '0';
        setTimeout(() => {
            el.style.transition = 'opacity 0.8s ease';
            el.style.opacity = '1';
        }, 100);
    });
}

async function loadData() {
    try {
        const res = await fetch('./data/questions.json');
        const data = await res.json();
        State.categories = data.categories;
        renderCategories();
    } catch (e) {
        console.error("Failed to load questions", e);
    }
}

function bindEvents() {
    // Search & Filter Features (Phase 7)
    if(UI.topicSearchInput) {
        UI.topicSearchInput.addEventListener('input', (e) => {
            State.searchQuery = e.target.value.trim();
            
            // Instant Results logic
            if(State.searchQuery.length > 0) {
                const matches = State.categories.filter(c => c.name.toLowerCase().includes(State.searchQuery.toLowerCase()));
                UI.instantResults.style.display = 'block';
                if(matches.length > 0) {
                    UI.instantResults.innerHTML = matches.map(m => {
                        const regex = new RegExp(`(${State.searchQuery})`, "gi");
                        const highlighted = m.name.replace(regex, "<span class='highlight'>$1</span>");
                        return `<div class="instant-result-item" data-id="${m.id}"><span>${m.icon} &nbsp;${highlighted}</span><span style="font-size:0.8rem; color:var(--primary); font-weight:bold;">Play 🚀</span></div>`;
                    }).join('');
                    
                    document.querySelectorAll('.instant-result-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const cat = State.categories.find(c => c.id === item.dataset.id);
                            if(cat) startQuiz(cat);
                            UI.instantResults.style.display = 'none';
                            UI.topicSearchInput.value = '';
                            State.searchQuery = '';
                        });
                    });
                } else {
                    UI.instantResults.innerHTML = '<div class="instant-result-item" style="justify-content:center;">No matches found.</div>';
                }
            } else {
                UI.instantResults.style.display = 'none';
            }
            renderCategories();
        });
        
        // Hide dropdown on clicking outside
        document.addEventListener('click', (e) => {
            if(!e.target.closest('.search-container')) {
                UI.instantResults.style.display = 'none';
            }
        });
    }

    if(UI.tagBar) {
        UI.tagBar.addEventListener('click', (e) => {
            if(e.target.classList.contains('tag')) {
                document.querySelectorAll('.tag').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                State.currentTag = e.target.dataset.tag;
                renderCategories();
            }
        });
    }

    if(UI.sortTopics) {
        UI.sortTopics.addEventListener('change', (e) => {
            State.currentSort = e.target.value;
            renderCategories();
        });
    }

    // Login Form Logic
    const loginIdentifier = document.getElementById('loginIdentifier');
    const loginPassword = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');
    if(UI.loginSubmitBtn) {
        UI.loginSubmitBtn.addEventListener('click', async () => {
            const id = loginIdentifier.value.trim();
            const pw = loginPassword.value.trim();
            if(!id || !pw) {
                loginError.textContent = "All fields are required.";
                loginError.style.display = 'block';
                return;
            }
            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({identifier: id, password: pw})
                });
                const data = await res.json();
                if(res.ok && data.success) {
                    localStorage.setItem('squizz_active_user', data.username);
                    State.user = data.username;
                    updateNavUser();
                    switchView('hero');
                    loginError.style.display = 'none';
                    loginIdentifier.value = ''; loginPassword.value = '';
                } else {
                    loginError.textContent = data.error || "Invalid credentials.";
                    loginError.style.display = 'block';
                }
            } catch (e) {
                loginError.textContent = "Server connection failed.";
                loginError.style.display = 'block';
            }
        });
    }
    
    // Register Form Logic
    const regUsername = document.getElementById('regUsername');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');
    const regError = document.getElementById('regError');
    const regSubmitBtn = document.getElementById('regSubmitBtn');
    if(regSubmitBtn) {
        regSubmitBtn.addEventListener('click', async () => {
            const u = regUsername.value.trim();
            const e = regEmail.value.trim();
            const p = regPassword.value.trim();
            if(!u || !e || !p) {
                regError.textContent = "All fields are required.";
                regError.style.display = 'block';
                return;
            }
            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({username: u, email: e, password: p})
                });
                const data = await res.json();
                
                if(res.ok && data.success) {
                    localStorage.setItem('squizz_active_user', data.username);
                    State.user = data.username;
                    updateNavUser();
                    switchView('hero');
                    regError.style.display = 'none';
                    regUsername.value = ''; regEmail.value = ''; regPassword.value = '';
                } else {
                    regError.textContent = data.error || "Registration failed.";
                    regError.style.display = 'block';
                }
            } catch (err) {
                regError.textContent = "Server connection failed.";
                regError.style.display = 'block';
            }
        });
    }
    
    // Auth View Swappers
    const l2r = document.getElementById('linkToRegister');
    const r2l = document.getElementById('linkToLogin');
    if(l2r) l2r.addEventListener('click', (e) => { e.preventDefault(); switchView('register'); });
    if(r2l) r2l.addEventListener('click', (e) => { e.preventDefault(); switchView('login'); });

    if(UI.navHomeBtn) UI.navHomeBtn.addEventListener('click', () => switchView('hero'));
    if(UI.navCategoriesBtn) {
        UI.navCategoriesBtn.addEventListener('click', () => {
            if(!State.user) {
                switchView('login');
            } else {
                if(UI.exploreTitle) UI.exploreTitle.style.display = 'none';
                if(UI.exploreSearchContainer) UI.exploreSearchContainer.style.display = 'none';
                switchView('categories');
            }
        });
    }
    if(UI.navLeaderboardBtn) {
        UI.navLeaderboardBtn.addEventListener('click', () => {
            if(!State.user) switchView('login');
            else showLeaderboard();
        });
    }

    if (UI.userNavDisplay) {
        UI.userNavDisplay.addEventListener('click', async (e) => {
            if (e.target.closest('#userBadge')) {
                if (State.user) {
                    await loadProfile();
                    switchView('profile');
                }
            }
        });
    }

    if(UI.themeToggleBtn) {
        UI.themeToggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            if(document.body.classList.contains('light-mode')) {
                UI.themeToggleBtn.textContent = '🌙 Dark';
            } else {
                UI.themeToggleBtn.textContent = '☀️ Light';
            }
        });
    }

    if(UI.btnStart) {
        UI.btnStart.addEventListener('click', () => {
            if(!State.user) {
                switchView('login');
            } else {
                if(UI.exploreTitle) UI.exploreTitle.style.display = 'block';
                if(UI.exploreSearchContainer) UI.exploreSearchContainer.style.display = 'block';
                switchView('categories');
            }
        });
    }

    if(UI.btnExplore) {
        UI.btnExplore.addEventListener('click', () => {
            if(!State.user) {
                switchView('login');
            } else {
                if(UI.exploreTitle) UI.exploreTitle.style.display = 'block';
                if(UI.exploreSearchContainer) UI.exploreSearchContainer.style.display = 'block';
                switchView('categories');
            }
        });
    }

    if(UI.prevBtn) UI.prevBtn.addEventListener('click', handlePrev);
    if(UI.nextBtn) UI.nextBtn.addEventListener('click', handleNext);
    if(UI.homeBtn) UI.homeBtn.addEventListener('click', () => {
        resetQuiz();
        switchView('hero');
    });
}

function switchView(viewName) {
    Object.values(UI.views).forEach(v => { 
        if(v) {
            v.style.display = 'none';
            v.classList.remove('active');
        }
    });
    
    if(UI.views[viewName]) {
        const target = UI.views[viewName];
        target.style.display = 'block';
        // Force reflow to reset CSS transition arrays
        void target.offsetWidth;
        target.classList.add('active');
    }
    
    State.view = viewName;

    if(viewName === 'hero') {
        typeWriterSubtitle();
    }
}

// Phase 11 Typewriter Effect
let typewriterTimeout;
function typeWriterSubtitle() {
    clearTimeout(typewriterTimeout);
    const subtitle = document.getElementById('heroSubtitle');
    if(!subtitle) return;
    
    const originalText = "Engage in interactive, premium quizzes across tech, science, pop culture, and more. Test your knowledge and climb the global ranks.";
    subtitle.innerHTML = '';
    let i = 0;
    
    function type() {
        if(i < originalText.length) {
            subtitle.innerHTML = originalText.substring(0, i+1) + '<span class="blinking-cursor"></span>';
            i++;
            typewriterTimeout = setTimeout(type, 15);
        } else {
            subtitle.innerHTML = originalText + '<span class="blinking-cursor"></span>';
        }
    }
    typewriterTimeout = setTimeout(type, 300);
}

function renderCategories() {
    if(!UI.categoryGrid) return;
    
    // Apply Tag & Search Filters
    let filtered = State.categories.filter(cat => {
        const matchesTag = State.currentTag === 'all' || (cat.tags && cat.tags.includes(State.currentTag));
        const matchesSearch = cat.name.toLowerCase().includes(State.searchQuery.toLowerCase());
        return matchesTag && matchesSearch;
    });

    // Apply Sorting
    if (State.currentSort === 'newest') {
        filtered.sort((a,b) => b.addedAt.localeCompare(a.addedAt));
    } else if (State.currentSort === 'easiest') {
        filtered.sort((a,b) => a.difficultyValue - b.difficultyValue);
    } else {
        // Default popular
        filtered = [...State.categories].filter(c => filtered.includes(c)); 
    }

    UI.categoryGrid.innerHTML = '';
    
    if(filtered.length === 0) {
        UI.categoryGrid.innerHTML = '<p class="text-center" style="grid-column: 1/-1; color: var(--text-secondary); padding: 2rem;">No topics match your request.</p>';
        return;
    }

    // Grouping by Subject concept
    const grouped = {};
    filtered.forEach(cat => {
        const subj = cat.subject || "Other Subjects";
        if(!grouped[subj]) grouped[subj] = [];
        grouped[subj].push(cat);
    });

    // Render group blocks
    for(const [subject, cats] of Object.entries(grouped)) {
        const subjHeader = document.createElement('h3');
        subjHeader.style.gridColumn = '1 / -1'; 
        subjHeader.style.marginTop = '2.5rem';
        subjHeader.style.marginBottom = '0.5rem';
        subjHeader.style.borderBottom = '1px solid rgba(6, 182, 212, 0.3)';
        subjHeader.style.paddingBottom = '0.5rem';
        subjHeader.style.color = 'var(--text-primary)';
        subjHeader.style.fontSize = '1.4rem';
        subjHeader.style.textShadow = 'var(--glow-cyan)';
        subjHeader.textContent = subject;
        UI.categoryGrid.appendChild(subjHeader);

        cats.forEach(cat => {
            const btn = document.createElement('div');
            btn.className = 'glass-card category-card';
            btn.innerHTML = `<span class="cat-icon">${cat.icon}</span><h3>${cat.name}</h3>`;
            btn.onclick = () => startQuiz(cat);
            UI.categoryGrid.appendChild(btn);
        });
    }
}

// Phase 2: Adaptive Difficulty & Shuffling
function generateAdaptiveQuestionSet(category) {
    // Separate by difficulty
    const easy = category.questions.filter(q => q.difficulty === 'easy').sort(() => Math.random() - 0.5);
    const medium = category.questions.filter(q => q.difficulty === 'medium').sort(() => Math.random() - 0.5);
    const hard = category.questions.filter(q => q.difficulty === 'hard').sort(() => Math.random() - 0.5);
    
    const path = [];
    if (easy.length) path.push(easy.pop());
    if (medium.length) path.push(medium.pop());
    if (hard.length) path.push(hard.pop());
    
    // Fill remaining to get all questions 
    const remaining = [...easy, ...medium, ...hard].sort(() => Math.random() - 0.5);
    // Return max 10 questions per quiz
    return [...path, ...remaining].slice(0, 10);
}

function startQuiz(category) {
    State.currentCategory = category;
    State.questions = generateAdaptiveQuestionSet(category);
    State.currentQuestionIndex = 0;
    State.answers = new Array(State.questions.length).fill(null);
    
    // Phase 2: Total Time Tracker
    State.totalSeconds = 0;
    clearInterval(State.totalTimeInterval);
    State.totalTimeInterval = setInterval(() => State.totalSeconds++, 1000);

    switchView('quiz');
    renderQuestion();
}

// Phase 2: Question Timer
function startQuestionTimer() {
    clearInterval(State.questionTimerInterval);
    // Dynamically pull from JSON configuration, fallback to 15s
    State.questionTimeRemaining = State.currentCategory.timeLimit || 15;
    updateTimerUI();
    
    State.questionTimerInterval = setInterval(() => {
        State.questionTimeRemaining--;
        updateTimerUI();
        
        if (State.questionTimeRemaining <= 0) {
            clearInterval(State.questionTimerInterval);
            // Auto skip / mark wrong
            if (State.answers[State.currentQuestionIndex] === null) {
                selectOption(-1); 
            }
        }
    }, 1000);
}

function updateTimerUI() {
    let t = State.questionTimeRemaining;
    UI.quizTimer.textContent = `00:${t < 10 ? '0'+t : t}`;
    if (t <= 5) {
        UI.quizTimer.classList.add('timer-warning');
    } else {
        UI.quizTimer.classList.remove('timer-warning');
    }
}

function renderQuestion() {
    const q = State.questions[State.currentQuestionIndex];
    UI.quizCategoryBadge.textContent = State.currentCategory.name;
    UI.qCurrent.textContent = State.currentQuestionIndex + 1;
    UI.qTotal.textContent = State.questions.length;
    UI.questionText.textContent = q.q;

    // Phase 13: Web Speech API Output for Accessibility Voice Mode
    if(State.voiceMode && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(q.q);
        window.speechSynthesis.speak(utterance);
    }
    
    startQuestionTimer(); // Phase 2 setup
    
    UI.optionsGrid.innerHTML = '';
    q.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline option-btn';
        if (State.answers[State.currentQuestionIndex] === idx) {
            btn.classList.add('selected');
        } else if (State.answers[State.currentQuestionIndex] === -1) {
            btn.disabled = true; // Disabled state if skipped
        }
        btn.textContent = opt;
        btn.onclick = () => selectOption(idx);
        UI.optionsGrid.appendChild(btn);
    });

    UI.prevBtn.disabled = State.currentQuestionIndex === 0;
    UI.nextBtn.textContent = (State.currentQuestionIndex === State.questions.length - 1) ? 'Finish' : 'Next';
    
    // Next is enabled if they answered OR time ran out (answered as -1)
    UI.nextBtn.disabled = State.answers[State.currentQuestionIndex] === null;
}

// Phase 4 Audio Context
let audioCtx = null;
function initAudio() {
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}
function playSound(type) {
    if(!audioCtx) return;
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    }
}

function selectOption(idx) {
    if (State.answers[State.currentQuestionIndex] !== null) return; 
    
    initAudio(); // init audio context on first meaningful interaction
    State.answers[State.currentQuestionIndex] = idx;
    clearInterval(State.questionTimerInterval); 
    
    const q = State.questions[State.currentQuestionIndex];
    if (idx === q.answer || idx === q.answer.toString()) {
        playSound('correct');
    } else {
        playSound('wrong');
    }
    
    renderQuestion(); 
    
    setTimeout(() => {
        handleNext();
    }, 1000);
}

function handlePrev() {
    if (State.currentQuestionIndex > 0) {
        State.currentQuestionIndex--;
        renderQuestion();
    }
}

function handleNext() {
    if (State.currentQuestionIndex < State.questions.length - 1) {
        State.currentQuestionIndex++;
        renderQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    clearInterval(State.questionTimerInterval);
    clearInterval(State.totalTimeInterval);
    
    // Log play instance to Python backend tracker
    logActivity();
    
    let score = 0;
    State.questions.forEach((q, idx) => {
        if (State.answers[idx] === q.answer || State.answers[idx] === q.answer.toString()) score++;
    });

    const quizName = State.currentCategory ? State.currentCategory.name : "Custom Quiz";
    const totalQ = State.questions.length;

    // Phase 15: Save quiz run to DB to update profile graphs and xp
    if (State.user) {
        fetch('/api/quiz-result', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                username: State.user,
                quiz_name: quizName,
                score: score,
                total_questions: totalQ,
                time_spent: State.totalSeconds
            })
        }).catch(err => console.error("Failed to save quiz result", err));
    }
    
    // Points logic
    let points = score * 100;
    if(score > 0) points += Math.max(0, (State.questions.length * 15 - State.totalSeconds) * 2);

    UI.finalScoreText.textContent = `${score}/${State.questions.length}`;
    if(UI.accuracyText) {
        UI.accuracyText.textContent = `${Math.round((score/State.questions.length)*100)}%`;
    }
    
    // Format total time
    let min = Math.floor(State.totalSeconds / 60);
    let sec = State.totalSeconds % 60;
    UI.totalTimeText.textContent = `${min < 10 ? '0'+min : min}:${sec < 10 ? '0'+sec : sec}`;
    
    if(score === State.questions.length) {
         UI.resultMessage.textContent = "Perfect Score! You're a master 🏆";
    } else if (score > State.questions.length / 2) {
         UI.resultMessage.textContent = "Great job! Keep practicing 💡";
    } else {
         UI.resultMessage.textContent = "Good effort. Try again to improve! 📈";
    }
    
    switchView('result');
}

function resetQuiz() {
    State.currentCategory = null;
    State.questions = [];
    State.currentQuestionIndex = 0;
    State.answers = [];
    clearInterval(State.questionTimerInterval);
    clearInterval(State.totalTimeInterval);
}

function showLeaderboard() {
    switchView('leaderboard');
    if(!UI.leaderboardContent) return;
    
    fetch('/api/leaderboard')
        .then(res => res.json())
        .then(lbData => {
            if(lbData.length === 0) {
                UI.leaderboardContent.innerHTML = "<p class='text-center'>No rankings yet. Be the first!</p>";
                return;
            }
            
            let html = `<div class="lb-row lb-header"><span>Rank</span><span>Player</span><span>Score</span><span>Focus Time</span></div>`;
            lbData.forEach((entry) => {
                let badge = entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `${entry.rank}`;
                let level = entry.xp > 1000 ? "Master 🌟" : entry.xp > 500 ? "Expert 💎" : entry.xp > 200 ? "Intermediate 🔥" : "Beginner";
                
                let timeStr = "0s";
                if(entry.time > 0) {
                    const h = Math.floor(entry.time / 3600);
                    const m = Math.floor((entry.time % 3600) / 60);
                    const s = entry.time % 60;
                    let parts = [];
                    if (h > 0) parts.push(`${h}h`);
                    if (m > 0 || h > 0) parts.push(`${m}m`);
                    parts.push(`${s}s`);
                    timeStr = parts.join(' ');
                }
                
                html += `<div class="lb-row">
                            <span class="rank-badge">${badge}</span>
                            <span class="lb-name">${entry.username} <small style="color:var(--primary); font-size:0.75rem;">${level}</small></span>
                            <span class="lb-score">${entry.xp} XP</span>
                            <span>${timeStr}</span>
                         </div>`;
            });
            UI.leaderboardContent.innerHTML = html;
        })
        .catch(err => {
            UI.leaderboardContent.innerHTML = "<p class='text-center text-danger'>Global rankings temporarily unavailable.</p>";
            console.error(err);
        });
}

// Phase 13 Feature Activation
function showToast(msg) {
    const t = document.getElementById('toast');
    if(!t) return;
    t.innerHTML = msg;
    t.classList.add('show');
    setTimeout(() => {
        t.classList.remove('show');
    }, 4000);
}

window.activateFeature = function(type) {
    switch(type) {
        case 'leaderboard':
            if(!State.user) return switchView('login');
            showLeaderboard();
            break;
        case 'streak':
            window.scrollTo({ top: 0, behavior: 'smooth' });
            const sc = document.getElementById('streakCardContainer');
            if(sc) {
                sc.style.transform = 'scale(1.1)';
                sc.style.boxShadow = '0 0 30px #f97316';
                setTimeout(() => {
                    sc.style.transform = '';
                    sc.style.boxShadow = '';
                }, 1000);
            }
            break;
        case 'voice':
            State.voiceMode = !State.voiceMode;
            showToast(State.voiceMode ? '🎙️ Voice Mode Activated!<br><small>Questions will be read aloud.</small>' : '🔇 Voice Mode Deactivated.');
            break;
        case 'multiplayer':
            if(!State.user) {
                showToast("Please Log In to play Multiplayer!");
                return switchView('login');
            }
            const sel = document.getElementById('mpHostCategory');
            if(sel && sel.options.length === 0) {
                State.categories.forEach(c => {
                    const opt = document.createElement('option');
                    opt.value = c.id;
                    opt.textContent = c.name;
                    sel.appendChild(opt);
                });
            }
            switchView('multiplayer');
            break;
        case 'ai':
            const topic = prompt("Enter a topic for the AI to generate a quiz about:");
            if(topic) {
                showToast(`🤖 AI Generator Processing "${topic}"...`);
                setTimeout(() => {
                    State.searchQuery = topic;
                    if(document.getElementById('topicSearchInput')) {
                        document.getElementById('topicSearchInput').value = topic;
                        document.getElementById('topicSearchInput').dispatchEvent(new Event('input'));
                    }
                    switchView('categories');
                }, 1500);
            }
            break;
        case 'smart':
            if(!State.user) return switchView('login');
            const hardQs = State.categories.flatMap(c => c.questions.filter(q => q.difficulty === 'hard'));
            if(hardQs.length > 0) {
                const mixedCategory = {
                    name: "Smart Learning (Challenge)",
                    icon: "🧠",
                    timeLimit: 12,
                    questions: hardQs.sort(() => Math.random() - 0.5).slice(0, 10)
                };
                startQuiz(mixedCategory);
            }
            break;
    }
}

// Phase 14 Backend Multiplayer Sync Engine
let socket = null;
let mpRoomId = null;
let mpIsHost = false;

function initSocket() {
    if(typeof io !== 'undefined') {
        socket = io('http://127.0.0.1:8082');
        
        socket.on('error', (err) => showToast('❌ ' + err.msg));
        
        socket.on('room_created', (data) => {
            mpRoomId = data.roomId;
            mpIsHost = true;
            document.getElementById('multiplayerSelection').style.display = 'none';
            document.getElementById('multiplayerLobby').style.display = 'block';
            document.getElementById('lobbyRoomCodeDisplay').textContent = data.roomId;
            document.getElementById('btnStartGame').style.display = 'inline-flex';
        });
        
        socket.on('player_joined', (data) => {
            if(!mpRoomId) {
                mpRoomId = document.getElementById('mpJoinCode').value.trim().toUpperCase();
            }
            document.getElementById('lobbyRoomCodeDisplay').textContent = mpRoomId;
            document.getElementById('multiplayerSelection').style.display = 'none';
            document.getElementById('multiplayerLobby').style.display = 'block';
            
            const list = document.getElementById('mpPlayerList');
            if(list) {
                list.innerHTML = '';
                data.players.forEach(p => {
                    const el = document.createElement('div');
                    el.style.background = 'rgba(6, 182, 212, 0.1)';
                    el.style.border = '1px solid rgba(6, 182, 212, 0.3)';
                    el.style.padding = '0.8rem 1.2rem';
                    el.style.borderRadius = '8px';
                    el.style.color = '#fff';
                    el.innerHTML = `👤 ${p.username} <span style="float:right; color:var(--primary);">${p.score}</span>`;
                    list.appendChild(el);
                });
                document.getElementById('mpPlayerCount').textContent = data.players.length;
            }
        });
        
        socket.on('game_started', (data) => {
            State.currentCategory = State.categories.find(c => c.id === data.categoryId) || State.categories[0];
            switchView('quiz');
            UI.questionText.innerHTML = "<h3>Syncing secure data from server...</h3>";
            UI.optionsGrid.innerHTML = '';
            if (UI.liveMultiplayerLeaderboard) {
                UI.liveMultiplayerLeaderboard.style.display = 'block';
            }
        });
        
        socket.on('next_question', (data) => {
            State.currentQuestionIndex = data.question.index;
            State.questions = new Array(data.question.total).fill({});
            State.questions[data.question.index] = data.question;
            State.answers = new Array(data.question.total).fill(null);
            
            renderQuestion(); 
            updateLiveLeaderboard(data.leaderboard);
        });
        
        socket.on('update_leaderboard', (data) => {
            updateLiveLeaderboard(data.leaderboard);
        });

        socket.on('round_ended', (data) => {
            clearInterval(State.questionTimerInterval);
            const buttons = document.querySelectorAll('.option-btn');
            buttons.forEach((btn, idx) => {
                btn.disabled = true;
                if(idx === data.correctAnswer) {
                    btn.style.background = 'rgba(34, 197, 94, 0.2)';
                    btn.style.borderColor = '#22c55e';
                }
            });
        });
        
        socket.on('game_over', (data) => {
            if (UI.liveMultiplayerLeaderboard) {
                UI.liveMultiplayerLeaderboard.style.display = 'none';
            }
            UI.resultMessage.innerHTML = `Multiplayer Match Finished!<br><h3 style="color:var(--primary); margin-top:0.5rem; text-shadow:0 0 10px rgba(6,182,212,0.5);">Winner: ${data.leaderboard[0].username} 👑</h3>`;
            UI.finalScoreText.textContent = `${data.leaderboard[0].score} pts`;
            UI.totalTimeText.textContent = 'Live Match';
            UI.accuracyText.textContent = '--';
            switchView('result');
            mpRoomId = null;
            mpIsHost = false;
        });

        const btnCreate = document.getElementById('btnCreateRoom');
        const btnJoin = document.getElementById('btnJoinRoom');
        const btnStart = document.getElementById('btnStartGame');
        
        if(btnCreate) {
            btnCreate.addEventListener('click', () => {
                const catId = document.getElementById('mpHostCategory').value;
                socket.emit('create_room', {username: State.user, categoryId: catId});
            });
        }
        if(btnJoin) {
            btnJoin.addEventListener('click', () => {
                const code = document.getElementById('mpJoinCode').value.trim();
                if(code.length === 6) socket.emit('join_room', {username: State.user, roomId: code});
            });
        }
        if(btnStart) {
            btnStart.addEventListener('click', () => {
                socket.emit('start_game', {roomId: mpRoomId});
                btnStart.style.display = 'none';
            });
        }
    }
}

function updateLiveLeaderboard(leaderboard) {
    const list = UI.liveLBPillContainer;
    if (!list) return;
    list.innerHTML = '';
    leaderboard.forEach((p, idx) => {
        list.innerHTML += `<div style="display:flex; justify-content:space-between; padding:0.6rem 0.8rem; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.05); border-radius:8px; font-size:0.95rem;">
            <span>${idx===0?'👑':''} ${p.username}</span>
            <span style="color:var(--primary); font-weight:bold; text-shadow:var(--glow-cyan);">${p.score}</span>
        </div>`;
    });
}

// Intercept Phase 1 selectOption for secure Socket emit
const oldSelectOption = selectOption;
selectOption = function(idx) {
    if(mpRoomId) {
        if(State.answers[State.currentQuestionIndex] !== null) return; 
        State.answers[State.currentQuestionIndex] = idx;
        
        const btn = document.querySelectorAll('.option-btn')[idx];
        if(btn && idx !== -1) btn.classList.add('selected');
        document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
        
        clearInterval(State.questionTimerInterval);
        socket.emit('submit_answer', {
            roomId: mpRoomId,
            username: State.user,
            answerIdx: idx,
            timeLeft: State.questionTimeRemaining
        });
    } else {
        oldSelectOption(idx);
    }
};

// Password Visibility Toggle Logic
function setupPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if(input && toggle) {
        toggle.addEventListener('click', () => {
            if(input.type === 'password') {
                input.type = 'text';
                toggle.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
                toggle.style.color = "var(--primary)";
            } else {
                input.type = 'password';
                toggle.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
                toggle.style.color = "var(--text-secondary)";
            }
        });
    }
}

function initAvatarUpload() {
    const editBtn = document.getElementById('editProfileBtn');
    const fileInput = document.getElementById('avatarUploadInput');
    const avatarModal = document.getElementById('avatarEditModal');
    const closeAvatarModalBtn = document.getElementById('closeAvatarModalBtn');
    const triggerUploadBtn = document.getElementById('triggerUploadBtn');
    const avatarPreview = document.getElementById('avatarModalImagePreview');
    
    if(editBtn && fileInput && avatarModal) {
        editBtn.addEventListener('click', () => {
            const currentImgSrc = document.getElementById('profileAvatarImg').src;
            avatarPreview.src = currentImgSrc;
            avatarModal.style.display = 'flex';
        });
        
        closeAvatarModalBtn.addEventListener('click', () => {
            avatarModal.style.display = 'none';
        });
        
        triggerUploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', async (e) => {
            if(e.target.files.length === 0) return;
            const file = e.target.files[0];
            
            const reader = new FileReader();
            reader.onload = (ev) => { avatarPreview.src = ev.target.result; };
            reader.readAsDataURL(file);
            
            const formData = new FormData();
            formData.append('username', State.user);
            formData.append('avatar', file);
            
            const originalBtnHtml = triggerUploadBtn.innerHTML;
            triggerUploadBtn.disabled = true;
            triggerUploadBtn.textContent = 'Uploading...';
            
            try {
                const res = await fetch('/api/update-avatar', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                if(res.ok) {
                    showToast('Profile photo updated! 📸');
                    loadProfile(); 
                    setTimeout(() => { avatarModal.style.display = 'none'; }, 800);
                } else {
                    showToast('Error: ' + data.error);
                }
            } catch(err) {
                showToast('Upload failed.');
            }
            triggerUploadBtn.disabled = false;
            triggerUploadBtn.innerHTML = originalBtnHtml;
            fileInput.value = '';
        });
    }
}

let heroCycleInterval = null;

async function initDynamicHeroCard() {
    const mainCard = document.getElementById('heroMainCard');
    if(!mainCard) return;

    try {
        const [trendRes, progRes, profileRes] = await Promise.all([
            fetch('/api/quiz/trending'),
            State.user ? fetch(`/api/user/progress/${State.user}`) : Promise.resolve({json: ()=>({})}),
            State.user ? fetch(`/api/profile/${State.user}`) : Promise.resolve({json: ()=>({xp: 0, current_streak: 0})})
        ]);

        const trendingQuizzes = await trendRes.json();
        const userProgress = await progRes.json();
        const userProfile = await profileRes.json();

        const rankTitle = document.getElementById('heroRankTitle');
        const rankGlobal = document.getElementById('heroRankGlobal');
        const rankXp = document.getElementById('heroRankXp');
        const streakCount = document.getElementById('streakCountText');

        if(userProfile.xp > 0) {
            if(streakCount) streakCount.textContent = `${userProfile.current_streak || 0} Days`;
            if(rankXp) rankXp.textContent = `XP: ${(userProfile.xp || 0).toLocaleString()}`;
            if(userProfile.xp > 5000) { if(rankTitle) rankTitle.textContent = 'Top 1%'; if(rankGlobal) rankGlobal.textContent = 'Rank #245'; }
            else if(userProfile.xp > 2000) { if(rankTitle) rankTitle.textContent = 'Top 5%'; if(rankGlobal) rankGlobal.textContent = 'Rank #1,402'; }
            else if(userProfile.xp > 500) { if(rankTitle) rankTitle.textContent = 'Top 15%'; if(rankGlobal) rankGlobal.textContent = 'Rank #8,940'; }
            else { if(rankTitle) rankTitle.textContent = 'Top 50%'; if(rankGlobal) rankGlobal.textContent = 'Rank #45,000+';}
        } else {
            if(streakCount) streakCount.textContent = `0 Days`;
            if(rankXp) rankXp.textContent = `XP: 0`;
            if(rankTitle) rankTitle.textContent = 'Unranked';
            if(rankGlobal) rankGlobal.textContent = 'Play to Rank';
        }

        let cycleIdx = 0;
        
        const updateHeroUI = () => {
            if(!trendingQuizzes || trendingQuizzes.length === 0) return;
            const q = trendingQuizzes[cycleIdx];
            const p = userProgress[q.title] || { completedQuestions: 0, percentage: 0, accuracy: 0, avgTime: "0s", xp: 0 };
            
            mainCard.style.opacity = '0';
            mainCard.style.transform = 'perspective(1500px) rotateY(90deg) scale(0.95)';
            
            setTimeout(() => {
                document.getElementById('heroQuizTitle').textContent = q.title;
                document.getElementById('heroQuizDesc').textContent = q.description;
                document.getElementById('heroStatAccuracy').textContent = `${p.accuracy}%`;
                document.getElementById('heroStatTime').textContent = p.avgTime;
                document.getElementById('heroStatDiff').textContent = q.difficulty;
                
                document.getElementById('heroQuizLevel').textContent = `Level ${q.level}`;
                document.getElementById('heroQuizProgressPct').textContent = `${p.percentage}%`;
                document.getElementById('heroQuizProgressBar').style.width = `${p.percentage}%`;
                document.getElementById('heroQuizCompletedText').textContent = `${p.completedQuestions}/${q.totalQuestions} Questions Completed`;
                document.getElementById('heroQuizXpText').textContent = `+${p.xp} XP earned`;
                
                mainCard.onclick = () => {
                    if(!State.user) return showToast('Please login to play trending quizzes.');
                    const matchedCat = window.categoriesData && window.categoriesData.find(c => c.name.toLowerCase() === q.title.toLowerCase());
                    if(matchedCat) {
                        startQuiz(matchedCat);
                        switchView('quiz');
                    } else {
                        showToast(`Preparing ${q.title} module directly...`);
                    }
                };

                mainCard.style.opacity = '1';
                mainCard.style.transform = 'perspective(1500px) rotateY(0deg) scale(1)';
            }, 300);

            cycleIdx = (cycleIdx + 1) % trendingQuizzes.length;
        };

        updateHeroUI();
        if(heroCycleInterval) clearInterval(heroCycleInterval);
        heroCycleInterval = setInterval(updateHeroUI, 5000);
        
    } catch(e) { console.log('Error initializing dynamic hero card', e); }
}

const oldInit = init;
init = function() {
    oldInit();
    initSocket();
    setupPasswordToggle('loginPassword', 'toggleLoginPassword');
    setupPasswordToggle('regPassword', 'toggleRegPassword');
    initAvatarUpload();
    initDynamicHeroCard();
};

// Also listen to post-login to reload the hero card seamlessly
const originalShowLogout = showToast;
showToast = function(msg) {
    originalShowLogout(msg);
    if(msg.includes('Login successful') || msg.includes('Welcome')) {
        setTimeout(initDynamicHeroCard, 1000);
    }
};

document.addEventListener('DOMContentLoaded', init);
