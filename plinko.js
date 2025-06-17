// JavaScript for Plinko game logic

// --- Constants and Variables ---
const PEG_ROWS = 14;
const PEG_SIZE = 10;
const PEG_SPACING_HORIZONTAL = 48;
const PEG_SPACING_VERTICAL = 38;
const BALL_SIZE = 16;
const BALL_START_OFFSET_Y = 15;

const GRAVITY = 0.30;
const HORIZONTAL_FRICTION = 0.99;
const PEG_BOUNCE_HORIZONTAL_SPEED = 2;
const PEG_BOUNCE_VERTICAL_DAMPING = 0.7;

// --- HTML Element References ---
let boardElement, pegAreaElement, ballTemplateElement, balanceDisplay, messageDisplay, betSelector, betAmountDisplay;
let betModal, modalOverlay, predefinedBetsContainer, customBetInput, confirmBetButton, closeModalButton;
let riskButtons;

// --- Game State ---
let playerBalance = 300; // Start balance van de screenshot
let betAmount = 300;     // Bet amount van de screenshot
let pegs = [];

// --- NIEUW: Systeem voor meerdere ballen ---
let activeBalls = [];      // Array om alle actieve ballen bij te houden
let animationFrameId = null;
let canDrop = true;        // Cooldown om spam-klikken te voorkomen
const DROP_COOLDOWN = 100; // 100ms tussen elke drop

let currentRiskLevel = 'high'; // 'high' is geselecteerd in de screenshot
const PRIZE_DATA = {
    low: [18, 3.2, 1.6, 1.3, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.3, 1.6, 3.2, 18],
    medium: [55, 12, 5.6, 3.2, 1.6, 1, 0.7, 0.2, 0.7, 1, 1.6, 3.2, 5.6, 12, 55],
    high: [353, 49, 14, 5.3, 2.1, 0.5, 0.2, 0, 0.2, 0.5, 2.1, 5.3, 14, 49, 353]
};
const PRIZE_SLOT_COUNT = 15;

// --- Sound Effect Placeholders ---
function playSound_ballDrop() { console.log("DEBUG: Play ball drop sound"); }
function playSound_pegHit() { console.log("DEBUG: Play peg hit sound"); }
function playSound_winPrize() { console.log("DEBUG: Play win prize sound"); }
function playSound_losePrize() { console.log("DEBUG: Play lose prize / neutral sound"); }

// --- NIEUW: Helper-functie voor valuta-opmaak ---
function formatCurrency(amount) {
    return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount);
}

// --- Core Logic Functions ---

function initializeDomReferences() {
    boardElement = document.getElementById('plinko-board');
    pegAreaElement = document.getElementById('peg-area');
    // AANGEPAST: We gebruiken de bal als een template
    ballTemplateElement = document.getElementById('ball-template');
    riskButtons = document.querySelectorAll('.bet-risk-button');
    balanceDisplay = document.getElementById('balance-display');
    messageDisplay = document.getElementById('message-display');
    betSelector = document.getElementById('bet-selector');
    betAmountDisplay = document.getElementById('bet-amount-display');
    betModal = document.getElementById('bet-modal');
    modalOverlay = document.getElementById('modal-overlay');
    predefinedBetsContainer = document.getElementById('predefined-bets');
    customBetInput = document.getElementById('custom-bet-input');
    confirmBetButton = document.getElementById('confirm-bet-button');
    closeModalButton = document.getElementById('close-modal-button');
}

function createPrizeSlots() {
    for (const risk in PRIZE_DATA) {
        const rowElement = document.getElementById(`prize-row-${risk}`);
        rowElement.innerHTML = '';
        PRIZE_DATA[risk].forEach(multiplier => {
            const slot = document.createElement('div');
            slot.classList.add('prize-slot', `${risk}-risk`);
            slot.textContent = multiplier;
            rowElement.appendChild(slot);
        });
    }
}

function createPegsInternal() {
    if (!pegAreaElement) return;
    pegAreaElement.innerHTML = ''; // Maakt alles leeg behalve de template
    pegAreaElement.appendChild(ballTemplateElement);
    pegs = [];
    const boardWidth = pegAreaElement.clientWidth;

    for (let row = 0; row < PEG_ROWS; row++) {
        const pegsInThisRow = 2 + row;
        const totalRowWidth = (pegsInThisRow - 1) * PEG_SPACING_HORIZONTAL;
        const startX = (boardWidth - totalRowWidth) / 2;
        for (let col = 0; col < pegsInThisRow; col++) {
            const pegElement = document.createElement('div');
            pegElement.classList.add('peg');
            pegElement.style.cssText = `width:${PEG_SIZE}px; height:${PEG_SIZE}px; border-radius:50%; position:absolute;`;
            const pegCenterX = startX + col * PEG_SPACING_HORIZONTAL;
            const pegCenterY = (row + 2) * PEG_SPACING_VERTICAL;
            pegElement.style.left = `${pegCenterX - PEG_SIZE / 2}px`;
            pegElement.style.top = `${pegCenterY - PEG_SIZE / 2}px`;
            pegAreaElement.appendChild(pegElement);
            pegs.push({ element: pegElement, x: pegCenterX, y: pegCenterY, radius: PEG_SIZE / 2 });
        }
    }
}

// AANGEPAST: Deze functie start het spel door een NIEUWE bal te laten vallen
function dropNewBall() {
    if (!canDrop) return false; // Check de cooldown

    if (playerBalance < betAmount) {
        messageDisplay.textContent = `Onvoldoende saldo! Nodig: ${formatCurrency(betAmount)}.`;
        messageDisplay.style.color = "var(--accent-red)";
        return false;
    }

    canDrop = false;
    setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);

    playerBalance -= betAmount;
    updateBalanceDisplayInternal();
    playSound_ballDrop();

    const boardWidth = pegAreaElement.clientWidth;
    const newBallElement = ballTemplateElement.cloneNode(true);
    newBallElement.id = ''; // Verwijder de ID van de kloon
    newBallElement.style.display = 'block'; // Maak het zichtbaar

    pegAreaElement.appendChild(newBallElement);

    // Creëer een nieuw bal object
    const newBall = {
        element: newBallElement,
        x: boardWidth / 2 + (Math.random() - 0.5) * 10,
        y: BALL_START_OFFSET_Y,
        vx: (Math.random() - 0.5) * 2,
        vy: 1.0,
    };

    activeBalls.push(newBall);

    // Start de game loop als deze nog niet draait
    if (!animationFrameId) {
        messageDisplay.textContent = "Veel geluk!";
        messageDisplay.style.color = "var(--primary-teal)";
        animationFrameId = requestAnimationFrame(updateGameInternal);
    }

    return true;
}

// AANGEPAST: De game loop updatet nu ALLE ballen
function updateGameInternal() {
    const boardWidth = pegAreaElement.clientWidth;
    const boardHeight = pegAreaElement.clientHeight;
    const ballRadius = BALL_SIZE / 2;

    // Loop achterstevoren, omdat we items uit de array kunnen verwijderen
    for (let i = activeBalls.length - 1; i >= 0; i--) {
        const ball = activeBalls[i];

        // Pas fysica toe op de bal
        ball.vy += GRAVITY;
        ball.y += ball.vy;
        ball.vx *= HORIZONTAL_FRICTION;
        ball.x += ball.vx;

        // Muur-botsingen
        if (ball.x - ballRadius < 0) {
            ball.x = ballRadius;
            ball.vx *= -0.8;
        } else if (ball.x + ballRadius > boardWidth) {
            ball.x = boardWidth - ballRadius;
            ball.vx *= -0.8;
        }

        // Pin-botsingen
        for (const peg of pegs) {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const combinedRadii = ballRadius + peg.radius;

            if (distance < combinedRadii) {
                playSound_pegHit();
                const normDX = dx / distance;
                const normDY = dy / distance;
                const overlap = combinedRadii - distance;
                ball.x += normDX * overlap * 0.6;
                ball.y += normDY * overlap * 0.6;
                ball.vy *= -PEG_BOUNCE_VERTICAL_DAMPING;
                ball.vx = normDX * PEG_BOUNCE_HORIZONTAL_SPEED + (Math.random() - 0.5) * 0.5;
                if (Math.abs(ball.vy) < 1.0 && dy < 0) ball.vy = -1.5;
                break; // Ga verder met de volgende bal na een botsing
            }
        }

        // Update de positie van het HTML element
        ball.element.style.left = `${ball.x - ballRadius}px`;
        ball.element.style.top = `${ball.y - ballRadius}px`;

        // Check of de bal de onderkant heeft bereikt
        if (ball.y - ballRadius > boardHeight) {
            determinePrizeInternal(ball.x);
            // Ruim de bal op
            ball.element.remove();
            activeBalls.splice(i, 1);
        }
    }

    // Ga door met de animatie als er nog ballen in het spel zijn
    if (activeBalls.length > 0) {
        animationFrameId = requestAnimationFrame(updateGameInternal);
    } else {
        // Stop de animatie als alle ballen weg zijn
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        messageDisplay.textContent = "No prize this time. Better luck next time!"; // Van screenshot
        messageDisplay.style.color = "var(--accent-red)"; // Van screenshot
    }
}


function determinePrizeInternal(finalBallX) {
    const currentBoardWidth = pegAreaElement.clientWidth;
    const slotWidth = currentBoardWidth / PRIZE_SLOT_COUNT;
    // Gebruik de risk level van de KNOP die is ingedrukt, niet de globale.
    // Voor nu gebruiken we de globale, dit kan later verfijnd worden.
    const slotIndex = Math.max(0, Math.min(Math.floor(finalBallX / slotWidth), PRIZE_SLOT_COUNT - 1));
    const prizeMultiplier = PRIZE_DATA[currentRiskLevel][slotIndex];
    const wonAmount = betAmount * prizeMultiplier; // Gebruik geen round, valuta kan decimalen hebben

    playerBalance += wonAmount;
    updateBalanceDisplayInternal();

    // Toon winstbericht (dit wordt snel overschreven als er meerdere ballen vallen,
    // een betere aanpak is een lijst van recente winsten)
    if (messageDisplay) {
        if (wonAmount > betAmount) {
            messageDisplay.textContent = `Gewonnen: ${formatCurrency(wonAmount)}! (x${prizeMultiplier})`;
            messageDisplay.style.color = "var(--accent-green)";
            playSound_winPrize();
        } else if (wonAmount > 0) {
            messageDisplay.textContent = `${formatCurrency(wonAmount)} terug. (x${prizeMultiplier})`;
            messageDisplay.style.color = "var(--accent-orange)";
            playSound_losePrize();
        } else {
            // Dit bericht wordt al getoond als alle ballen weg zijn.
            // playSound_losePrize();
        }
    }
}

// AANGEPAST: Gebruik de valuta-opmaakfunctie
function updateBalanceDisplayInternal() {
    if (balanceDisplay) balanceDisplay.textContent = `Balans: ${formatCurrency(playerBalance)}`;
}

function updateActiveRiskDisplay(risk) {
    document.querySelectorAll('.prize-row').forEach(row => row.classList.remove('active'));
    document.getElementById(`prize-row-${risk}`).classList.add('active');
}

function setupControls() {
    betSelector.addEventListener('click', () => {
        betModal.classList.remove('hidden');
        modalOverlay.classList.remove('hidden');
        customBetInput.value = betAmount;
    });
    const closeModal = () => {
        betModal.classList.add('hidden');
        modalOverlay.classList.add('hidden');
    };
    closeModalButton.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    predefinedBetsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('bet-option')) {
            customBetInput.value = parseInt(e.target.dataset.amount, 10);
        }
    });
    confirmBetButton.addEventListener('click', () => {
        const customAmount = parseInt(customBetInput.value, 10);
        if (!isNaN(customAmount) && customAmount > 0) {
            betAmount = customAmount;
            betAmountDisplay.textContent = formatCurrency(betAmount); // AANGEPAST
            closeModal();
        } else {
            alert("Voer een geldig, positief getal in voor je inzet.");
        }
    });
    riskButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            currentRiskLevel = e.target.dataset.risk; // Stel het risico in voor de volgende ballen
            updateActiveRiskDisplay(currentRiskLevel);
            dropNewBall(); // AANGEPAST: roept de nieuwe functie aan
        });
        button.addEventListener('mouseover', (e) => updateActiveRiskDisplay(e.target.dataset.risk));
        button.addEventListener('mouseout', () => updateActiveRiskDisplay(currentRiskLevel));
    });
}

function clearAllBalls() {
    activeBalls.forEach(ball => ball.element.remove());
    activeBalls = [];
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
}

function initGame() {
    initializeDomReferences();
    if (!boardElement) return;
    createPrizeSlots();
    setupControls();
    createPegsInternal();
    updateBalanceDisplayInternal();
    betAmountDisplay.textContent = formatCurrency(betAmount); // AANGEPAST
    updateActiveRiskDisplay(currentRiskLevel);

    // Update de message display met de tekst van de screenshot
    messageDisplay.textContent = "No prize this time. Better luck next time!";
    messageDisplay.style.color = "var(--accent-red)";


    window.addEventListener('resize', () => {
        clearAllBalls();
        createPegsInternal();
    });
}

document.addEventListener('DOMContentLoaded', initGame);