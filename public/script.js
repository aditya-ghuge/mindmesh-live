document.addEventListener("DOMContentLoaded", () => {

    const aiAvatarSrc = "https://api.dicebear.com/9.x/bottts/svg?seed=CuteRobot&backgroundColor=7b61ff";
    const userAvatarSrc = "https://api.dicebear.com/9.x/fun-emoji/svg?seed=Smiley&backgroundColor=e2e8f0";

    // --- 1. VIEW TRANSITIONS ---
    const launchAppBtn = document.getElementById('launchAppBtn');
    const exitAppBtn = document.getElementById('exitAppBtn');
    const dashboardHomeBtn = document.getElementById('dashboardHomeBtn');
    const landingPortfolio = document.getElementById('landing-portfolio');
    const appDashboard = document.getElementById('app-dashboard');
    const root = document.documentElement;

    document.querySelectorAll('.nav-links a').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({ behavior: 'smooth' });
        });
    });

    launchAppBtn.addEventListener('click', () => {
        landingPortfolio.style.opacity = '0';
        setTimeout(() => {
            landingPortfolio.classList.remove('view-active');
            landingPortfolio.classList.add('view-hidden');
            appDashboard.classList.remove('view-hidden');
            appDashboard.classList.add('view-active');
            setTimeout(() => { appDashboard.style.opacity = '1'; }, 50);
            window.scrollTo(0, 0);
        }, 600);
    });

    function returnToHome() {
        appDashboard.style.opacity = '0';
        setTimeout(() => {
            appDashboard.classList.remove('view-active');
            appDashboard.classList.add('view-hidden');
            landingPortfolio.classList.remove('view-hidden');
            landingPortfolio.classList.add('view-active');
            window.scrollTo(0, 0);
            setTimeout(() => { landingPortfolio.style.opacity = '1'; }, 50);
        }, 600);
    }
    exitAppBtn.addEventListener('click', returnToHome);
    dashboardHomeBtn.addEventListener('click', returnToHome);

    // --- 2. DASHBOARD LOGIC & STATE ---
    const moodBoxes = document.querySelectorAll('.mood-box');
    let selectedMood = "Executive"; // Default mood

    const contextThem = document.getElementById('contextThem');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const sendDirectBtn = document.getElementById('sendDirectBtn');
    const suggestionCards = document.getElementById('suggestionCards');
    const emotionText = document.getElementById('emotionText');
    const emotionEmoji = document.getElementById('emotionEmoji');
    const incomingMessage = document.getElementById('incomingMessage');
    const chatHistory = document.getElementById('chatHistory');
    const langSelect = document.getElementById('langSelect');

    let conversationHistory = [];

    // This handles the Mood Selection (Including RageOff!)
    moodBoxes.forEach(box => {
        box.addEventListener('click', () => {
            moodBoxes.forEach(b => b.classList.remove('active'));
            box.classList.add('active');

            // Grabs the exact text from the box
            selectedMood = box.querySelector('span').innerText;

            const themeColor = box.getAttribute('data-theme');
            root.style.setProperty('--accent-dynamic', themeColor);
        });
    });

    function addToHistory(text, role) {
        conversationHistory.push({ role: role, text: text });
        if (conversationHistory.length > 6) conversationHistory.shift();

        const wrapper = document.createElement('div');
        wrapper.className = `history-bubble-wrapper ${role === 'them' ? 'received' : 'sent'}`;

        const bubble = document.createElement('div');
        bubble.className = `history-bubble ${role === 'them' ? 'received' : 'sent'}`;
        bubble.innerText = text;

        const avatar = document.createElement('img');
        avatar.className = 'history-avatar';
        avatar.src = (role === 'them') ? aiAvatarSrc : userAvatarSrc;

        wrapper.appendChild(avatar);
        wrapper.appendChild(bubble);

        chatHistory.appendChild(wrapper);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    sendDirectBtn.addEventListener('click', () => {
        const text = incomingMessage.value.trim();
        if (text) {
            const role = contextThem.checked ? 'received' : 'sent';
            addToHistory(text, role === 'received' ? 'them' : 'me');
            incomingMessage.value = '';
            emotionText.innerText = "Idle";
            emotionEmoji.innerText = "📡";
        }
    });

    // --- 3. MAIN PROCESS & ENHANCE ---
    analyzeBtn.addEventListener('click', async () => {
        const text = incomingMessage.value.trim();
        if (!text) {
            alert("Please input some text to process.");
            return;
        }

        const isThem = contextThem.checked;
        const finalLang = langSelect.value;

        if (isThem) addToHistory(text, 'them');

        // Loading State
        analyzeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Meshing...';
        analyzeBtn.disabled = true;
        emotionText.innerText = "Analyzing...";
        emotionEmoji.innerText = "⏳";
        suggestionCards.innerHTML = '<div class="empty-state-text">Consulting the Intent Engine...</div>';

        try {
            const response = await fetch('/api/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text,
                    mood: selectedMood,
                    context: isThem ? 'Them' : 'Me',
                    lang: finalLang,
                    history: conversationHistory
                })
            });

            const data = await response.json();

            // Reset Button
            analyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Process & Enhance';
            analyzeBtn.disabled = false;
            suggestionCards.innerHTML = '';

            if (data.success) {
                // Update the Vibe Check UI perfectly from the JSON
                emotionText.innerText = data.vibe;
                emotionEmoji.innerText = data.emoji;

                // Render Replies
                data.replies.forEach((reply, index) => {
                    const card = document.createElement('div');
                    card.className = 'reply-card';
                    card.style.cursor = 'pointer'; // Makes the mouse turn into a hand
                    card.style.transition = 'transform 0.1s ease'; // Smooth press animation

                    card.innerHTML = `
                        <div class="card-header">
                            <span class="reply-badge">Option ${index + 1}</span>
                            <button class="copy-btn" title="Copy to clipboard"><i class="fa-regular fa-copy"></i></button>
                        </div>
                        <div class="card-body">${reply}</div>
                    `;

                    const copyBtn = card.querySelector('.copy-btn');
                    copyBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Stops the card from being clicked when you hit copy
                        navigator.clipboard.writeText(reply);
                        copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--accent-dynamic);"></i>';
                        setTimeout(() => { copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 2000);
                    });

                    // FIX: Attach click to the ENTIRE CARD, not just the text body
                    card.addEventListener('click', () => {
                        // Create a quick "button press" visual effect
                        card.style.transform = 'scale(0.97)';

                        // Wait a split second so you can see the animation, then execute
                        setTimeout(() => {
                            addToHistory(reply, 'me');
                            incomingMessage.value = '';
                            emotionText.innerText = "Idle";
                            emotionEmoji.innerText = "📡";
                            suggestionCards.innerHTML = '<div class="empty-state-text"><i class="fa-solid fa-check"></i> Sent to history.</div>';
                        }, 120);
                    });

                    suggestionCards.appendChild(card);
                });
            } else {
                throw new Error("Backend reported failure.");
            }

        } catch (error) {
            console.error(error);
            suggestionCards.innerHTML = '<div class="empty-state-text" style="color:#ff4757;">Failed to connect to backend. Make sure your server is running!</div>';
            analyzeBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Process & Enhance';
            analyzeBtn.disabled = false;
            emotionText.innerText = "Error";
            emotionEmoji.innerText = "🚨";
        }
    });
});