// JavaScript for Plinko game logic

// --- Constants and Variables ---
const PEG_ROWS = 14;
const PEG_SIZE = 10;
const PEG_SPACING_HORIZONTAL = 48;
const PEG_SPACING_VERTICAL = 38;
const BALL_SIZE = 18;
const BALL_START_OFFSET_Y = 15;

const GRAVITY = 0.15;
const HORIZONTAL_FRICTION = 0.99;
const PEG_BOUNCE_HORIZONTAL_SPEED = 3;
const PEG_BOUNCE_VERTICAL_DAMPING = 0.7;

// --- HTML Element References ---
let boardElement, pegAreaElement, ballElement, balanceDisplay, messageDisplay, betSelector, betAmountDisplay;
let betModal, modalOverlay, predefinedBetsContainer, customBetInput, confirmBetButton, closeModalButton;
let riskButtons;

// --- Game State ---
let playerBalance = 300;
let betAmount = 10;
let pegs = [];
let ballX, ballY, ballVX, ballVY;
let isDropping = false;
let animationFrameId = null;
let currentRiskLevel = 'low';
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

// --- Core Logic Functions ---

function initializeDomReferences() {
    boardElement = document.getElementById('plinko-board');
    pegAreaElement = document.getElementById('peg-area');
    ballElement = document.getElementById('ball');
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
    pegAreaElement.innerHTML = '';
    pegAreaElement.appendChild(ballElement);
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
            // <<< THIS IS THE CORRECTED LINE >>>
            const pegCenterY = (row + 2) * PEG_SPACING_VERTICAL; // Changed from (row + 3) back to (row + 2)
            pegElement.style.left = `${pegCenterX - PEG_SIZE / 2}px`;
            pegElement.style.top = `${pegCenterY - PEG_SIZE / 2}px`;
            pegAreaElement.appendChild(pegElement);
            pegs.push({ element: pegElement, x: pegCenterX, y: pegCenterY, radius: PEG_SIZE / 2 });
        }
    }
}

function resetBallInternal(wasDropped = false) {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
    isDropping = false;
    if (!pegAreaElement || !ballElement) return;
    const boardWidth = pegAreaElement.clientWidth;
    ballX = boardWidth / 2;
    ballY = BALL_START_OFFSET_Y;
    ballElement.style.left = `${ballX - BALL_SIZE / 2}px`;
    ballElement.style.top = `${ballY - BALL_SIZE / 2}px`;
    if (messageDisplay && !wasDropped) {
        messageDisplay.textContent = "Choose your risk and bet!";
        messageDisplay.style.color = "var(--text-light)";
    }
    riskButtons.forEach(button => button.disabled = false);
}

function dropBallInternal() {
    if (isDropping) return false;
    if (playerBalance < betAmount) {
        messageDisplay.textContent = `Not enough balance! Need ${betAmount}.`;
        messageDisplay.style.color = "var(--accent-red)";
        return false;
    }
    messageDisplay.textContent = "Good luck!";
    messageDisplay.style.color = "var(--primary-teal)";
    playerBalance -= betAmount;
    updateBalanceDisplayInternal();
    playSound_ballDrop();
    isDropping = true;
    riskButtons.forEach(button => button.disabled = true);
    const boardWidth = pegAreaElement.clientWidth;
    ballX = boardWidth / 2 + (Math.random() - 0.5) * 10;
    ballY = BALL_START_OFFSET_Y;
    ballVY = 1.0;
    ballVX = (Math.random() - 0.5) * 2;
    updateGameInternal();
    return true;
}

function updateGameInternal() {
    if (!isDropping) return;
    ballVY += GRAVITY;
    ballY += ballVY;
    ballVX *= HORIZONTAL_FRICTION;
    ballX += ballVX;
    const boardWidth = pegAreaElement.clientWidth;
    const ballRadius = BALL_SIZE / 2;
    if (ballX - ballRadius < 0) {
        ballX = ballRadius;
        ballVX *= -0.8;
    } else if (ballX + ballRadius > boardWidth) {
        ballX = boardWidth - ballRadius;
        ballVX *= -0.8;
    }
    for (const peg of pegs) {
        const dx = ballX - peg.x;
        const dy = ballY - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const combinedRadii = ballRadius + peg.radius;
        if (distance < combinedRadii) {
            playSound_pegHit();
            const normDX = dx / distance;
            const normDY = dy / distance;
            const overlap = combinedRadii - distance;
            ballX += normDX * overlap * 0.6;
            ballY += normDY * overlap * 0.6;
            ballVY *= -PEG_BOUNCE_VERTICAL_DAMPING;
            ballVX = normDX * PEG_BOUNCE_HORIZONTAL_SPEED + (Math.random() - 0.5) * 0.5;
            if (Math.abs(ballVY) < 1.0 && dy < 0) ballVY = -1.5;
            break;
        }
    }
    ballElement.style.left = `${ballX - ballRadius}px`;
    ballElement.style.top = `${ballY - ballRadius}px`;

    const boardHeight = pegAreaElement.clientHeight;
    if (ballY - ballRadius > boardHeight) {
        isDropping = false;
        determinePrizeInternal(ballX);
        resetBallInternal(true);
        return;
    }
    animationFrameId = requestAnimationFrame(updateGameInternal);
}

function determinePrizeInternal(finalBallX) {
    const currentBoardWidth = pegAreaElement.clientWidth;
    const slotWidth = currentBoardWidth / PRIZE_SLOT_COUNT;
    const slotIndex = Math.max(0, Math.min(Math.floor(finalBallX / slotWidth), PRIZE_SLOT_COUNT - 1));
    const prizeMultiplier = PRIZE_DATA[currentRiskLevel][slotIndex];
    const wonAmount = Math.round(betAmount * prizeMultiplier);

    playerBalance += wonAmount;
    updateBalanceDisplayInternal();

    if (messageDisplay) {
        if (wonAmount > betAmount) {
            messageDisplay.textContent = `You won ${wonAmount}! (x${prizeMultiplier})`;
            messageDisplay.style.color = "var(--accent-green)";
            playSound_winPrize();
        } else if (wonAmount > 0) {
            messageDisplay.textContent = `You got ${wonAmount} back. (x${prizeMultiplier})`;
            messageDisplay.style.color = "var(--accent-orange)";
            playSound_losePrize();
        } else {
            messageDisplay.textContent = "No prize this time. Better luck next time!";
            messageDisplay.style.color = "var(--accent-red)";
            playSound_losePrize();
        }
    }
}

function updateBalanceDisplayInternal() {
    if (balanceDisplay) balanceDisplay.textContent = `Balance: ${playerBalance}`;
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
            betAmountDisplay.textContent = betAmount;
            closeModal();
        } else {
            alert("Please enter a valid, positive number for your bet.");
        }
    });
    riskButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            currentRiskLevel = e.target.dataset.risk;
            updateActiveRiskDisplay(currentRiskLevel);
            dropBallInternal();
        });
        button.addEventListener('mouseover', (e) => { if (!isDropping) updateActiveRiskDisplay(e.target.dataset.risk); });
        button.addEventListener('mouseout', () => { if (!isDropping) updateActiveRiskDisplay(currentRiskLevel); });
    });
}

function initGame() {
    initializeDomReferences();
    if (!boardElement) return;
    createPrizeSlots();
    setupControls();
    createPegsInternal();
    resetBallInternal();
    updateBalanceDisplayInternal();
    betAmountDisplay.textContent = betAmount;
    updateActiveRiskDisplay(currentRiskLevel);

    window.addEventListener('resize', () => {
        if (isDropping) {
            cancelAnimationFrame(animationFrameId);
            isDropping = false;
        }
        createPegsInternal();
        resetBallInternal();
    });
}

document.addEventListener('DOMContentLoaded', initGame);