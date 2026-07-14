/* ==========================================================================
   Napster-Voyage on Point - Core Application Logic
   ========================================================================== */

// State Management
function getLogoUrl(url) {
    if (!url) return 'logos/li.png';
    if (url.startsWith('logos/')) return url;
    if (url.startsWith('http')) return url;
    let filename = url.substring(url.lastIndexOf('/') + 1);
    return 'logos/' + filename;
}

let selectedFromId = null;
let selectedToId = null;
let transferValue = 10000;
let activeCategory = 'ALL'; // 'ALL', 'AIRLINE', 'HOTEL'
let sortOrder = 'VALUE_DESC'; // 'VALUE_DESC', 'RATIO_ASC', 'NAME_ASC'
let bonusOffers = [];

// DOM Elements
let fromBtn, toBtn, fromDropdown, toDropdown;
let fromSearch, toSearch;
let fromList, toList;
let pointsInput, pointsSlider;
let resultsGrid, resultsCountLabel;
let bonusDropdownBtn, bonusDropdownPanel, bonusOffersList;


document.addEventListener('DOMContentLoaded', () => {
    // Initialize DOM Elements
    fromBtn = document.getElementById('from-program-btn');
    toBtn = document.getElementById('to-program-btn');
    fromDropdown = document.getElementById('from-program-dropdown');
    toDropdown = document.getElementById('to-program-dropdown');
    fromSearch = document.getElementById('from-search-input');
    toSearch = document.getElementById('to-search-input');
    fromList = document.getElementById('from-options-list');
    toList = document.getElementById('to-options-list');
    pointsInput = document.getElementById('points-input-val');
    pointsSlider = document.getElementById('points-slider');
    resultsGrid = document.getElementById('results-grid');
    resultsCountLabel = document.getElementById('results-count-label');
    bonusDropdownBtn = document.getElementById('bonus-dropdown-btn');
    bonusDropdownPanel = document.getElementById('bonus-dropdown-panel');
    bonusOffersList = document.getElementById('bonus-offers-list');
    

    // Parse and register active bonus offers
    extractBonusOffers();

    // Populate dropdowns initially
    populateDropdownLists();
    populateFlightAirports();

    // Set default flight date to 7 days from today
    const dateInput = document.getElementById('flight-date-input');
    if (dateInput) {
        dateInput.valueAsDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }

    // Attach scroll listener for sticky summary bar
    

    // Initial render
    refreshCalculator();

    // Twemoji rendering
    if (window.twemoji) {
        window.twemoji.parse(document.body);
    }
});

/* ==========================================================================
   Data Extraction & Helper Functions
   ========================================================================== */

function getProgramById(id) {
    return window.TRANSFER_DATA[id];
}

function extractBonusOffers() {
    bonusOffers = [];
    Object.values(window.TRANSFER_DATA).forEach(source => {
        source.partners.forEach(partner => {
            if (partner.additional_info && partner.additional_info.bonus) {
                bonusOffers.push({
                    sourceId: source.id,
                    sourceName: source.short_name || source.name,
                    sourceLogo: source.logo_url,
                    partnerId: partner.id,
                    partnerName: partner.short_name || partner.name,
                    partnerLogo: partner.logo_url,
                    percentage: partner.additional_info.bonus.percentage,
                    text: partner.additional_info.bonus_text || `${partner.additional_info.bonus.percentage}% bonus`
                });
            }
        });
    });

    // Update bonus offers badges
    const totalCount = bonusOffers.length;
    document.getElementById('bonus-count-badge').innerText = `${totalCount} Bonus Offers`;
    document.getElementById('mobile-bonus-badge-text').innerText = `${totalCount} Active Promo Offers`;

    // Populate bonus panel lists
    if (bonusOffersList) {
        bonusOffersList.innerHTML = '';
        if (totalCount === 0) {
            bonusOffersList.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); font-size: 0.875rem;">No active bonus offers right now.</div>';
            return;
        }

        bonusOffers.forEach(offer => {
            const btn = document.createElement('button');
            btn.className = 'bonus-offer-item';
            btn.onclick = () => {
                quickSelectRoute(offer.sourceId, offer.partnerId);
                toggleBonusDropdown(false);
            };

            // Safeguard logo urls
            const sLogo = getLogoUrl(offer.sourceLogo);
            const pLogo = getLogoUrl(offer.partnerLogo);

            btn.innerHTML = `
                <div class="bonus-offer-logo-container">
                    <img class="bonus-offer-logo" src="${sLogo}" alt="${offer.sourceName}">
                    <span style="font-size: 0.875rem; color: var(--text-secondary); padding: 0 0.25rem;">→</span>
                    <img class="bonus-offer-logo" src="${pLogo}" alt="${offer.partnerName}">
                </div>
                <div class="bonus-offer-details">
                    <div class="bonus-offer-title">${offer.sourceName} to ${offer.partnerName}</div>
                    <div class="bonus-offer-desc">Apply conversion path</div>
                </div>
                <div class="bonus-offer-badge">${offer.text}</div>
            `;
            bonusOffersList.appendChild(btn);
        });
    }
}

function populateDropdownLists() {
    if (!fromList || !toList) return;

    fromList.innerHTML = '';
    toList.innerHTML = '';

    const allPrograms = Object.values(window.TRANSFER_DATA);

    // Populate "From" list - cards and programs that CAN transfer points
    // Sort credit cards first, then others
    allPrograms.sort((a, b) => {
        if (a.category === 'CREDIT_CARD' && b.category !== 'CREDIT_CARD') return -1;
        if (a.category !== 'CREDIT_CARD' && b.category === 'CREDIT_CARD') return 1;
        return a.name.localeCompare(b.name);
    });

    allPrograms.forEach(program => {
        const logoUrl = getLogoUrl(program.logo_url);
        
        const option = document.createElement('button');
        option.className = 'dropdown-option-item';
        option.dataset.id = program.id;
        option.dataset.name = program.name.toLowerCase();
        option.dataset.short = (program.short_name || '').toLowerCase();
        option.onclick = () => selectOption('from', program.id);
        
        option.innerHTML = `
            <img class="dropdown-option-logo" src="${logoUrl}" alt="${program.name}" onerror="this.src='logos/li.png'">
            <span class="dropdown-option-name">${program.name}</span>
        `;
        fromList.appendChild(option);
    });

    // Populate "To" list - destinations that CAN receive points
    // Get unique partners from all programs
    const uniqueDestinations = {};
    allPrograms.forEach(program => {
        program.partners.forEach(partner => {
            uniqueDestinations[partner.id] = partner;
        });
    });

    const destinationsList = Object.values(uniqueDestinations).sort((a, b) => a.name.localeCompare(b.name));

    destinationsList.forEach(partner => {
        const logoUrl = getLogoUrl(partner.logo_url);

        const option = document.createElement('button');
        option.className = 'dropdown-option-item';
        option.dataset.id = partner.id;
        option.dataset.name = partner.name.toLowerCase();
        option.dataset.short = (partner.short_name || '').toLowerCase();
        option.onclick = () => selectOption('to', partner.id);

        option.innerHTML = `
            <img class="dropdown-option-logo" src="${logoUrl}" alt="${partner.name}" onerror="this.src='logos/li.png'">
            <span class="dropdown-option-name">${partner.name}</span>
        `;
        toList.appendChild(option);
    });
}

/* ==========================================================================
   Dropdown Control UI
   ========================================================================== */

function toggleDropdown(type) {
    if (type === 'from') {
        fromDropdown.classList.toggle('show');
        fromBtn.classList.toggle('active');
        toDropdown.classList.remove('show');
        toBtn.classList.remove('active');
        if (fromDropdown.classList.contains('show')) {
            fromSearch.focus();
        }
    } else {
        toDropdown.classList.toggle('show');
        toBtn.classList.toggle('active');
        fromDropdown.classList.remove('show');
        fromBtn.classList.remove('active');
        if (toDropdown.classList.contains('show')) {
            toSearch.focus();
        }
    }
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#from-program-btn') && !e.target.closest('#from-program-dropdown')) {
        fromDropdown.classList.remove('show');
        fromBtn.classList.remove('active');
    }
    if (!e.target.closest('#to-program-btn') && !e.target.closest('#to-program-dropdown')) {
        toDropdown.classList.remove('show');
        toBtn.classList.remove('active');
    }
    if (!e.target.closest('#bonus-dropdown-btn') && !e.target.closest('#bonus-dropdown-panel')) {
        bonusDropdownPanel.classList.remove('show');
        bonusDropdownBtn.classList.remove('active');
    }
});

function filterDropdown(type) {
    const searchVal = (type === 'from' ? fromSearch.value : toSearch.value).toLowerCase();
    const list = type === 'from' ? fromList : toList;
    const items = list.getElementsByClassName('dropdown-option-item');

    for (let item of items) {
        const name = item.dataset.name;
        const short = item.dataset.short;
        if (name.includes(searchVal) || short.includes(searchVal)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    }
}

function selectOption(type, id) {
    const program = getProgramById(id) || findPartnerById(id);
    if (!program) return;

    const logoUrl = getLogoUrl(program.logo_url);

    if (type === 'from') {
        selectedFromId = id;
        document.getElementById('selected-from-display').innerHTML = `
            <img class="selected-logo" src="${logoUrl}" alt="${program.name}">
            <span>${program.short_name || program.name}</span>
        `;
        document.getElementById('clear-from-btn').style.display = 'flex';
        fromDropdown.classList.remove('show');
        fromBtn.classList.remove('active');
        fromSearch.value = '';

        // If target partner selected is NOT a partner of this source program, reset target partner
        if (selectedToId) {
            const hasPartner = program.partners.some(p => p.id === selectedToId);
            if (!hasPartner) {
                clearToSelection();
            }
        }
    } else {
        selectedToId = id;
        document.getElementById('selected-to-display').innerHTML = `
            <img class="selected-logo" src="${logoUrl}" alt="${program.name}">
            <span>${program.short_name || program.name}</span>
        `;
        document.getElementById('clear-to-btn').style.display = 'flex';
        toDropdown.classList.remove('show');
        toBtn.classList.remove('active');
        toSearch.value = '';

        // If source program selected is NOT able to transfer to this partner, reset source program
        if (selectedFromId) {
            const source = getProgramById(selectedFromId);
            const canTransfer = source.partners.some(p => p.id === id);
            if (!canTransfer) {
                clearFromSelection();
            }
        }
    }

    refreshCalculator();
}

function findPartnerById(id) {
    let found = null;
    Object.values(window.TRANSFER_DATA).forEach(source => {
        source.partners.forEach(partner => {
            if (partner.id === id) {
                found = partner;
            }
        });
    });
    return found;
}

function clearFromSelection() {
    selectedFromId = null;
    document.getElementById('selected-from-display').innerHTML = `
        <span class="selected-placeholder">📋 Select card or program...</span>
    `;
    document.getElementById('clear-from-btn').style.display = 'none';
    refreshCalculator();
}

function clearToSelection() {
    selectedToId = null;
    document.getElementById('selected-to-display').innerHTML = `
        <span class="selected-placeholder">✈️ Select airline or hotel...</span>
    `;
    document.getElementById('clear-to-btn').style.display = 'none';
    refreshCalculator();
}

/* ==========================================================================
   Points Input controls
   ========================================================================== */

function updatePointsVal(val) {
    let parsed = parseInt(val);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    
    transferValue = parsed;
    pointsInput.value = transferValue;
    pointsSlider.value = transferValue;
    
    // Update summary bar points badge
    document.getElementById('summary-points-badge').innerText = `${transferValue.toLocaleString()} pts`;
    
    refreshCalculator();
}

function adjustPoints(amount) {
    updatePointsVal(transferValue + amount);
}

function setPoints(val) {
    updatePointsVal(val);
}

function toggleBonusDropdown(forceOpen) {
    if (forceOpen === true) {
        bonusDropdownPanel.classList.add('show');
        bonusDropdownBtn.classList.add('active');
    } else {
        bonusDropdownPanel.classList.toggle('show');
        bonusDropdownBtn.classList.toggle('active');
    }
}

function quickSelectRoute(sourceId, targetId) {
    selectOption('from', sourceId);
    selectOption('to', targetId);
    scrollToCalculator();
}

function scrollToCalculator() {
    const el = document.getElementById('calculator-section');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
    }
}




/* ==========================================================================
   Calculations & Rendering Engine
   ========================================================================== */

function setCategoryFilter(cat) {
    activeCategory = cat;
    
    // Toggle active classes on tab buttons
    document.getElementById('filter-all-btn').classList.toggle('active', cat === 'ALL');
    document.getElementById('filter-airline-btn').classList.toggle('active', cat === 'AIRLINE');
    document.getElementById('filter-hotel-btn').classList.toggle('active', cat === 'HOTEL');
    
    refreshCalculator();
}

function setSortOrder(order) {
    sortOrder = order;
    refreshCalculator();
}

function refreshCalculator() {
    if (!resultsGrid) return;
    resultsGrid.innerHTML = '';

    let matches = [];

    // CASE 1: Transfer FROM is selected
    if (selectedFromId) {
        const source = getProgramById(selectedFromId);
        if (source) {
            source.partners.forEach(partner => {
                // If Target filter is selected, check it
                if (selectedToId && partner.id !== selectedToId) return;

                // Category filter check
                if (activeCategory !== 'ALL' && partner.category !== activeCategory) return;

                matches.push({
                    sourceId: source.id,
                    sourceName: source.short_name || source.name,
                    sourceLogo: source.logo_url,
                    sourceVal: source.value_inr,
                    
                    partnerId: partner.id,
                    partnerName: partner.short_name || partner.name,
                    partnerLogo: partner.logo_url,
                    partnerCategory: partner.category,
                    partnerVal: partner.value_inr,
                    
                    ratio: partner.transfer_ratio,
                    ratioFloat: partner.transfer_ratio_float,
                    time: partner.transfer_time,
                    notes: partner.notes,
                    bonus: partner.additional_info && partner.additional_info.bonus ? partner.additional_info.bonus : null,
                    bonusText: partner.additional_info && partner.additional_info.bonus_text ? partner.additional_info.bonus_text : ''
                });
            });
        }
    }
    // CASE 2: Transfer FROM is NOT selected, but Transfer TO IS selected
    else if (selectedToId) {
        // Find all programs that can transfer to selectedToId
        Object.values(window.TRANSFER_DATA).forEach(source => {
            source.partners.forEach(partner => {
                if (partner.id !== selectedToId) return;

                // Category filter check
                if (activeCategory !== 'ALL' && partner.category !== activeCategory) return;

                matches.push({
                    sourceId: source.id,
                    sourceName: source.short_name || source.name,
                    sourceLogo: source.logo_url,
                    sourceVal: source.value_inr,

                    partnerId: partner.id,
                    partnerName: partner.short_name || partner.name,
                    partnerLogo: partner.logo_url,
                    partnerCategory: partner.category,
                    partnerVal: partner.value_inr,

                    ratio: partner.transfer_ratio,
                    ratioFloat: partner.transfer_ratio_float,
                    time: partner.transfer_time,
                    notes: partner.notes,
                    bonus: partner.additional_info && partner.additional_info.bonus ? partner.additional_info.bonus : null,
                    bonusText: partner.additional_info && partner.additional_info.bonus_text ? partner.additional_info.bonus_text : ''
                });
            });
        });
    }
    // CASE 3: Neither are selected - render all possible connections (limit to 36 popular routes to keep screen responsive)
    else {
        Object.values(window.TRANSFER_DATA).forEach(source => {
            source.partners.forEach(partner => {
                if (activeCategory !== 'ALL' && partner.category !== activeCategory) return;

                matches.push({
                    sourceId: source.id,
                    sourceName: source.short_name || source.name,
                    sourceLogo: source.logo_url,
                    sourceVal: source.value_inr,

                    partnerId: partner.id,
                    partnerName: partner.short_name || partner.name,
                    partnerLogo: partner.logo_url,
                    partnerCategory: partner.category,
                    partnerVal: partner.value_inr,

                    ratio: partner.transfer_ratio,
                    ratioFloat: partner.transfer_ratio_float,
                    time: partner.transfer_time,
                    notes: partner.notes,
                    bonus: partner.additional_info && partner.additional_info.bonus ? partner.additional_info.bonus : null,
                    bonusText: partner.additional_info && partner.additional_info.bonus_text ? partner.additional_info.bonus_text : ''
                });
            });
        });
    }

    // Perform Calculations on each match
    matches.forEach(item => {
        // Output Points before promos
        let outputPoints = transferValue / item.ratioFloat;

        // Apply bonus percent multiplier
        let bonusAmount = 0;
        if (item.bonus && item.bonus.percentage) {
            bonusAmount = outputPoints * (item.bonus.percentage / 100);
            outputPoints += bonusAmount;
        }

        item.outputPoints = Math.round(outputPoints);
        item.bonusAmount = Math.round(bonusAmount);
        
        // Total yield value in INR
        item.valueInr = item.outputPoints * (item.partnerVal || 1.0);
        
        // Yield efficiency multiplier
        const sourceCostInr = transferValue * (item.sourceVal || 1.0);
        item.yieldPercentage = sourceCostInr > 0 ? (item.valueInr / sourceCostInr) * 100 : 100;
    });

    // Update Instant Result Container
    const instantResultContainer = document.getElementById('instant-result-container');
    if (instantResultContainer) {
        if (selectedFromId && selectedToId && matches.length > 0) {
            const item = matches[0];
            document.getElementById('instant-result-from').innerText = `${transferValue.toLocaleString()} ${item.sourceName} points`;
            document.getElementById('instant-result-to').innerText = `${item.outputPoints.toLocaleString()} ${item.partnerName} points/miles`;
            document.getElementById('instant-result-worth').innerText = `Equivalent to ₹${Math.round(item.valueInr).toLocaleString()} in travel value (Yield: ₹${(item.partnerVal || 1.0).toFixed(2)} / mile)`;
            instantResultContainer.style.display = 'block';
        } else {
            instantResultContainer.style.display = 'none';
        }
    }

    // Apply Sorting
    if (sortOrder === 'VALUE_DESC') {
        matches.sort((a, b) => b.valueInr - a.valueInr);
    } else if (sortOrder === 'RATIO_ASC') {
        matches.sort((a, b) => a.ratioFloat - b.ratioFloat);
    } else if (sortOrder === 'NAME_ASC') {
        matches.sort((a, b) => a.partnerName.localeCompare(b.partnerName));
    }

    // Limit to 36 cards if both selections are empty (prevents rendering lag)
    const isSearchEmpty = !selectedFromId && !selectedToId;
    const itemsToDisplay = isSearchEmpty ? matches.slice(0, 36) : matches;

    // Render count
    resultsCountLabel.innerText = `Showing ${itemsToDisplay.length} conversion paths` + (isSearchEmpty ? ' (popular)' : '');

    // Render Empty State
    if (itemsToDisplay.length === 0) {
        resultsGrid.innerHTML = `
            <div class="calculator-empty-state" style="grid-column: 1 / -1;">
                <span class="empty-state-icon">🛸</span>
                <h3>No transfer matches found</h3>
                <p>Try resetting filters or changing categories.</p>
            </div>
        `;
        return;
    }

    // Render Card Grid
    itemsToDisplay.forEach((item, index) => {
        const sLogo = getLogoUrl(item.sourceLogo);
        const pLogo = getLogoUrl(item.partnerLogo);

        const card = document.createElement('div');
        card.className = 'partner-result-card';

        // Highlight top 3 yields as "Optimal Use"
        const isOptimal = index < 3 && item.yieldPercentage > 100 && !isSearchEmpty;
        if (isOptimal) {
            const borderBar = document.createElement('div');
            borderBar.className = 'optimal-highlight-bar';
            card.appendChild(borderBar);
        }

        // Render card content HTML
        card.innerHTML += `
            <div class="card-header">
                <div class="partner-info">
                    <img class="partner-logo" src="${pLogo}" alt="${item.partnerName}">
                    <div class="partner-names">
                        <div class="partner-name">${item.partnerName}</div>
                        <div class="partner-cat">${item.partnerCategory}</div>
                    </div>
                </div>
                ${isOptimal ? '<span class="value-badge">Optimal Use</span>' : ''}
            </div>

            <div class="card-calculation-row">
                <div class="points-result-col">
                    <span class="points-label">You Get</span>
                    <span class="points-amount">${item.outputPoints.toLocaleString()} <span style="font-size: 0.875rem; font-weight: 500;">pts</span></span>
                    <span class="inr-worth-label">≈ ₹${Math.round(item.valueInr).toLocaleString()} value</span>
                </div>
            </div>

            <div class="card-details-row">
                <div class="card-detail-item">
                    <span class="card-detail-title">Transfer Speed</span>
                    <span class="card-detail-val">${item.time}</span>
                </div>
                <div class="card-detail-item" style="text-align: right;">
                    <span class="card-detail-title">Ratio (From:To)</span>
                    <span class="card-detail-val">${item.ratio}</span>
                </div>
            </div>

            <div class="card-details-row" style="border-top: none; padding-top: 0;">
                <div class="card-detail-item">
                    <span class="card-detail-title">From Program</span>
                    <span class="card-detail-val" style="display: flex; align-items: center; gap: 0.25rem;">
                        <img src="${sLogo}" alt="${item.sourceName}" style="width: 1rem; height: 1rem; object-fit: contain; border-radius: 2px;">
                        ${item.sourceName}
                    </span>
                </div>
                ${item.bonus ? `
                    <div class="card-detail-item" style="align-items: flex-end;">
                        <span class="card-bonus-ribbon">⚡ ${item.bonusText}</span>
                    </div>
                ` : ''}
            </div>
        `;
        resultsGrid.appendChild(card);
    });

    // Re-trigger twemoji parsing
    if (window.twemoji) {
        window.twemoji.parse(resultsGrid);
    }
}

/* ==========================================================================
   Program Detail View Modal logic
   ========================================================================== */

function openProgramDetail(id) {
    const program = getProgramById(id) || findPartnerById(id);
    if (!program) return;

    const overlay = document.getElementById('detail-modal');
    const modalBody = document.getElementById('modal-body-content');

    const logoUrl = getLogoUrl(program.logo_url);

    // Populate modal body
    let modalHTML = `
        <div class="modal-logo-header">
            <img class="modal-logo" src="${logoUrl}" alt="${program.name}">
            <div>
                <h3 class="modal-meta-name">${program.name}</h3>
                <span class="modal-meta-cat">${program.category}</span>
            </div>
        </div>
        
        <div>
            <div style="font-size: 0.8125rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 1rem;">
                Estimated point value: <strong style="color: var(--accent-emerald);">₹${program.value_inr || '1.00'}</strong> per point/mile.
            </div>
        </div>
    `;

    // Connections List
    // If it's a credit card program, show its transfer partners
    if (program.partners && program.partners.length > 0) {
        modalHTML += `
            <div class="modal-content-list">
                <span class="modal-list-header">Transfer Partners (${program.partners.length})</span>
        `;
        program.partners.forEach(partner => {
            const pLogo = getLogoUrl(partner.logo_url);
            modalHTML += `
                <div class="modal-transfer-row" onclick="quickSelectRoute(${program.id}, ${partner.id}); closeDetailModal();">
                    <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                        <img src="${pLogo}" alt="${partner.name}" style="width: 1.5rem; height: 1.5rem; object-fit: contain;">
                        <span style="font-size: 0.875rem; font-weight: 600;">${partner.name}</span>
                    </div>
                    <div style="text-align: right; font-size: 0.8125rem; font-weight: 700; color: var(--text-secondary);">
                        Ratio: ${partner.transfer_ratio}
                    </div>
                </div>
            `;
        });
        modalHTML += `</div>`;
    } 
    // If it's a partner program, show which credit cards can transfer to it
    else {
        const sources = [];
        Object.values(window.TRANSFER_DATA).forEach(src => {
            src.partners.forEach(partner => {
                if (partner.id === program.id) {
                    sources.push({
                        id: src.id,
                        name: src.name,
                        logo: src.logo_url,
                        ratio: partner.transfer_ratio
                    });
                }
            });
        });

        modalHTML += `
            <div class="modal-content-list">
                <span class="modal-list-header">Can receive transfers from (${sources.length})</span>
        `;
        sources.forEach(src => {
            const sLogo = getLogoUrl(src.logo);
            modalHTML += `
                <div class="modal-transfer-row" onclick="quickSelectRoute(${src.id}, ${program.id}); closeDetailModal();">
                    <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;">
                        <img src="${sLogo}" alt="${src.name}" style="width: 1.5rem; height: 1.5rem; object-fit: contain;">
                        <span style="font-size: 0.875rem; font-weight: 600;">${src.name}</span>
                    </div>
                    <div style="text-align: right; font-size: 0.8125rem; font-weight: 700; color: var(--text-secondary);">
                        Ratio: ${src.ratio}
                    </div>
                </div>
            `;
        });
        modalHTML += `</div>`;
    }

    modalBody.innerHTML = modalHTML;
    overlay.classList.add('show');
    
    if (window.twemoji) {
        window.twemoji.parse(modalBody);
    }
}

function closeDetailModal(event) {
    if (!event || event.target.id === 'detail-modal' || event.target.closest('.modal-close-btn')) {
        document.getElementById('detail-modal').classList.remove('show');
    }
}


/* ==========================================================================
   Flight Search & Award Pricing Engine Logic
   ========================================================================== */

let selectedFlightOrigin = 'DEL';
let selectedFlightDest = 'LHR';
let selectedTripType = 'ONEWAY';
let selectedPassengers = 1;
let flightSortMode = 'POINTS';
let flightStopsFilter = 'ALL';
let flightSelectedAirlines = new Set();
let currentRawFlights = [];

const FLIGHT_AIRPORTS = {
    origin: [
        { code: 'DEL', name: 'DEL - New Delhi', fullName: "Indira Gandhi Int'l, Delhi" },
        { code: 'BOM', name: 'BOM - Mumbai', fullName: "Chhatrapati Shivaji, Mumbai" },
        { code: 'BLR', name: 'BLR - Bengaluru', fullName: "Kempegowda Int'l, Bengaluru" },
        { code: 'MAA', name: 'MAA - Chennai', fullName: "Chennai Int'l, Chennai" },
        { code: 'HYD', name: 'HYD - Hyderabad', fullName: "Rajiv Gandhi Int'l, Hyderabad" }
    ],
    dest: [
        { code: 'LHR', name: 'LHR - London', fullName: "Heathrow, London" },
        { code: 'SIN', name: 'SIN - Singapore', fullName: "Changi, Singapore" },
        { code: 'DXB', name: 'DXB - Dubai', fullName: "Dubai Int'l, Dubai" },
        { code: 'JFK', name: 'JFK - New York', fullName: "John F. Kennedy, New York" },
        { code: 'HND', name: 'HND - Tokyo', fullName: "Haneda, Tokyo" },
        { code: 'BKK', name: 'BKK - Bangkok', fullName: "Suvarnabhumi, Bangkok" }
    ]
};

const FLIGHT_ROUTES = {
    'DEL-LHR-ECONOMY': [
        { airline: 'Air India', number: 'AI 111', duration: '9h 15m', stops: 'Direct', miles: 35000, taxes: 5200, cash: 45000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'Virgin Atlantic', number: 'VS 303', duration: '9h 30m', stops: 'Direct', miles: 20000, taxes: 18900, cash: 42000, partnerId: 94, logo: 'logos/virgin_atlantic_flying_club.webp' },
        { airline: 'British Airways', number: 'BA 142', duration: '9h 20m', stops: 'Direct', miles: 30000, taxes: 12500, cash: 48000, partnerId: 47, logo: 'logos/british_airways_executive_club.webp' },
        { airline: 'Qatar Airways', number: 'QR 571', duration: '11h 45m', stops: '1 Stop', miles: 30000, taxes: 8900, cash: 52000, partnerId: 48, logo: 'logos/qatar_privilege_club.webp' }
    ],
    'DEL-LHR-BUSINESS': [
        { airline: 'Air India', number: 'AI 111', duration: '9h 15m', stops: 'Direct', miles: 90000, taxes: 12500, cash: 155000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'Virgin Atlantic', number: 'VS 303', duration: '9h 30m', stops: 'Direct', miles: 67500, taxes: 32000, cash: 165000, partnerId: 94, logo: 'logos/virgin_atlantic_flying_club.webp' },
        { airline: 'British Airways', number: 'BA 142', duration: '9h 20m', stops: 'Direct', miles: 80000, taxes: 25000, cash: 180000, partnerId: 47, logo: 'logos/british_airways_executive_club.webp' },
        { airline: 'Qatar Airways', number: 'QR 571', duration: '11h 45m', stops: '1 Stop', miles: 75000, taxes: 18900, cash: 210000, partnerId: 48, logo: 'logos/qatar_privilege_club.webp' }
    ],
    'BOM-SIN-ECONOMY': [
        { airline: 'Singapore Airlines', number: 'SQ 421', duration: '5h 45m', stops: 'Direct', miles: 22000, taxes: 3800, cash: 28000, partnerId: 82, logo: 'logos/krisflyer.webp' },
        { airline: 'Air India', number: 'AI 380', duration: '6h 00m', stops: 'Direct', miles: 20000, taxes: 3200, cash: 24000, partnerId: 85, logo: 'logos/maharaja_club.webp' }
    ],
    'BOM-SIN-BUSINESS': [
        { airline: 'Singapore Airlines', number: 'SQ 421', duration: '5h 45m', stops: 'Direct', miles: 43000, taxes: 6800, cash: 95000, partnerId: 82, logo: 'logos/krisflyer.webp' },
        { airline: 'Air India', number: 'AI 380', duration: '6h 00m', stops: 'Direct', miles: 45000, taxes: 6500, cash: 80000, partnerId: 85, logo: 'logos/maharaja_club.webp' }
    ],
    'DEL-DXB-ECONOMY': [
        { airline: 'Emirates', number: 'EK 511', duration: '4h 00m', stops: 'Direct', miles: 17500, taxes: 4200, cash: 22000, partnerId: 74, logo: 'logos/emirates_skywards.webp' },
        { airline: 'Air India', number: 'AI 995', duration: '4h 15m', stops: 'Direct', miles: 15000, taxes: 2800, cash: 19500, partnerId: 85, logo: 'logos/maharaja_club.webp' }
    ],
    'DEL-DXB-BUSINESS': [
        { airline: 'Emirates', number: 'EK 511', duration: '4h 00m', stops: 'Direct', miles: 36000, taxes: 8500, cash: 75000, partnerId: 74, logo: 'logos/emirates_skywards.webp' },
        { airline: 'Air India', number: 'AI 995', duration: '4h 15m', stops: 'Direct', miles: 30000, taxes: 5200, cash: 60000, partnerId: 85, logo: 'logos/maharaja_club.webp' }
    ],
    'BOM-LHR-ECONOMY': [
        { airline: 'Air India', number: 'AI 131', duration: '9h 30m', stops: 'Direct', miles: 35000, taxes: 5500, cash: 47000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'British Airways', number: 'BA 198', duration: '9h 45m', stops: 'Direct', miles: 30000, taxes: 12800, cash: 49000, partnerId: 47, logo: 'logos/british_airways_executive_club.webp' }
    ],
    'BOM-LHR-BUSINESS': [
        { airline: 'Air India', number: 'AI 131', duration: '9h 30m', stops: 'Direct', miles: 90000, taxes: 13000, cash: 160000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'British Airways', number: 'BA 198', duration: '9h 45m', stops: 'Direct', miles: 80000, taxes: 26000, cash: 175000, partnerId: 47, logo: 'logos/british_airways_executive_club.webp' }
    ],
    'BLR-SIN-ECONOMY': [
        { airline: 'Singapore Airlines', number: 'SQ 511', duration: '4h 30m', stops: 'Direct', miles: 22000, taxes: 3700, cash: 26000, partnerId: 82, logo: 'logos/krisflyer.webp' }
    ],
    'BLR-SIN-BUSINESS': [
        { airline: 'Singapore Airlines', number: 'SQ 511', duration: '4h 30m', stops: 'Direct', miles: 43000, taxes: 6500, cash: 90000, partnerId: 82, logo: 'logos/krisflyer.webp' }
    ],
    'DEL-JFK-ECONOMY': [
        { airline: 'Air India', number: 'AI 101', duration: '15h 45m', stops: 'Direct', miles: 45000, taxes: 7800, cash: 75000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'Qatar Airways', number: 'QR 571', duration: '19h 30m', stops: '1 Stop', miles: 47500, taxes: 12000, cash: 82000, partnerId: 48, logo: 'logos/qatar_privilege_club.webp' }
    ],
    'DEL-JFK-BUSINESS': [
        { airline: 'Air India', number: 'AI 101', duration: '15h 45m', stops: 'Direct', miles: 120000, taxes: 18000, cash: 290000, partnerId: 85, logo: 'logos/maharaja_club.webp' },
        { airline: 'Qatar Airways', number: 'QR 571', duration: '19h 30m', stops: '1 Stop', miles: 95000, taxes: 22000, cash: 340000, partnerId: 48, logo: 'logos/qatar_privilege_club.webp' }
    ]
};

function populateFlightAirports() {
    const originList = document.getElementById('flight-origin-list');
    const destList = document.getElementById('flight-dest-list');
    if (!originList || !destList) return;

    originList.innerHTML = '';
    FLIGHT_AIRPORTS.origin.forEach(ap => {
        const btn = document.createElement('button');
        btn.className = 'dropdown-option-item';
        btn.onclick = () => selectFlightAirport('origin', ap.code);
        btn.innerHTML = `<span class="dropdown-option-name" style="font-weight: 700;">${ap.name}</span><span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.5rem;">${ap.fullName}</span>`;
        originList.appendChild(btn);
    });

    destList.innerHTML = '';
    FLIGHT_AIRPORTS.dest.forEach(ap => {
        const btn = document.createElement('button');
        btn.className = 'dropdown-option-item';
        btn.onclick = () => selectFlightAirport('dest', ap.code);
        btn.innerHTML = `<span class="dropdown-option-name" style="font-weight: 700;">${ap.name}</span><span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.5rem;">${ap.fullName}</span>`;
        destList.appendChild(btn);
    });
}

function toggleFlightDropdown(type) {
    const dropdown = document.getElementById(`flight-${type}-dropdown`);
    if (!dropdown) return;
    
    document.getElementById('flight-origin-dropdown').classList.remove('show');
    document.getElementById('flight-dest-dropdown').classList.remove('show');
    fromDropdown.classList.remove('show');
    toDropdown.classList.remove('show');
    
    dropdown.classList.toggle('show');
}

function selectFlightAirport(type, code) {
    const apList = FLIGHT_AIRPORTS[type];
    const ap = apList.find(a => a.code === code);

    if (type === 'origin') {
        selectedFlightOrigin = code.toUpperCase();
        const displayName = ap ? ap.name : code.toUpperCase();
        document.getElementById('selected-origin-display').innerHTML = `<span>🛫 ${displayName}</span>`;
    } else {
        selectedFlightDest = code.toUpperCase();
        const displayName = ap ? ap.name : code.toUpperCase();
        document.getElementById('selected-dest-display').innerHTML = `<span>🛬 ${displayName}</span>`;
    }

    document.getElementById(`flight-${type}-dropdown`).classList.remove('show');
}

function filterFlightDropdown(type) {
    const queryInput = document.getElementById(`flight-${type}-search`);
    const query = queryInput.value.trim();
    const list = document.getElementById(`flight-${type}-list`);
    const options = list.getElementsByClassName('dropdown-option-item');

    // Remove any existing "custom-option" button
    const existingCustom = list.querySelector('.custom-option-item');
    if (existingCustom) {
        existingCustom.remove();
    }

    let matchCount = 0;
    const cleanQuery = query.toLowerCase();

    for (let option of options) {
        if (option.classList.contains('custom-option-item')) continue;
        const text = option.innerText.toLowerCase();
        if (text.includes(cleanQuery)) {
            option.style.display = 'flex';
            matchCount++;
        } else {
            option.style.display = 'none';
        }
    }

    // If query is not empty, show the "Use custom" option at the top
    if (query.length > 0) {
        const customBtn = document.createElement('button');
        customBtn.className = 'dropdown-option-item custom-option-item';
        customBtn.style.borderBottom = '1px dashed var(--border-light)';
        customBtn.style.fontWeight = '700';
        customBtn.style.color = 'var(--accent-emerald)';
        
        const displayCode = query.toUpperCase();
        customBtn.onclick = () => {
            selectFlightAirport(type, displayCode);
            queryInput.value = ''; // clear search input
        };
        customBtn.innerHTML = `<span> must type custom: "${displayCode}"</span>`;
        // Use a standard label
        customBtn.innerHTML = `<span>➕ Use "${displayCode}"</span>`;
        list.insertBefore(customBtn, list.firstChild);
    }
}

function switchDashboardTab(tabName) {
    const btnFlights = document.getElementById('tab-btn-flights');
    const btnCalc = document.getElementById('tab-btn-calc');
    const panelFlights = document.getElementById('panel-flights');
    const panelCalc = document.getElementById('panel-calc');
    
    if (tabName === 'flights') {
        btnFlights.classList.add('active');
        btnCalc.classList.remove('active');
        panelFlights.classList.add('active');
        panelCalc.classList.remove('active');
    } else {
        btnFlights.classList.remove('active');
        btnCalc.classList.add('active');
        panelFlights.classList.remove('active');
        panelCalc.classList.add('active');
    }
}

function generateMockFlights(origin, dest, cabinClass) {
    const key = `${origin}-${dest}-${cabinClass}`;
    if (FLIGHT_ROUTES[key]) {
        return FLIGHT_ROUTES[key];
    }
    
    const carriers = [
        { name: 'Qatar Airways', partnerId: 48, logo: 'logos/qatar_privilege_club.webp' },
        { name: 'Singapore Airlines', partnerId: 82, logo: 'logos/krisflyer.webp' },
        { name: 'Air India', partnerId: 85, logo: 'logos/maharaja_club.webp' }
    ];
    
    const isBiz = cabinClass === 'BUSINESS';
    const baseMiles = isBiz ? 70000 : 25000;
    const baseCash = isBiz ? 120000 : 38000;
    const baseTaxes = isBiz ? 15000 : 6000;
    
    return carriers.map((c, i) => {
        const factor = 1.0 + (i * 0.15) - 0.1;
        const milesVal = Math.round(baseMiles * factor / 500) * 500;
        const cashVal = Math.round(baseCash * factor / 1000) * 1000;
        const taxVal = Math.round(baseTaxes * factor / 100) * 100;
        return {
            airline: c.name,
            number: `QR ${500 + i * 23}`,
            duration: '12h 45m',
            stops: '1 Stop',
            miles: milesVal,
            taxes: taxVal,
            cash: cashVal,
            partnerId: c.partnerId,
            logo: c.logo
        };
    });
}

function findBestCardTransfers(partnerId, requiredMiles) {
    const options = [];
    for (const [progId, program] of Object.entries(window.TRANSFER_DATA)) {
        if (program.category !== 'CREDIT_CARD') continue;
        
        const partnerInfo = program.partners.find(p => p.id == partnerId);
        if (partnerInfo) {
            const ratio = partnerInfo.ratio_float || 1.0;
            const cardPointsNeeded = Math.round(requiredMiles / ratio);
            options.push({
                cardId: program.id,
                cardName: program.name,
                cardLogo: getLogoUrl(program.logo_url),
                pointsNeeded: cardPointsNeeded,
                ratioText: partnerInfo.ratio || '1:1'
            });
        }
    }
    return options.sort((a, b) => a.pointsNeeded - b.pointsNeeded);
}

function setTripType(type) {
    selectedTripType = type;
    document.getElementById('trip-oneway-btn').classList.toggle('active', type === 'ONEWAY');
    document.getElementById('trip-roundtrip-btn').classList.toggle('active', type === 'ROUNDTRIP');
}

function adjustPassengers(amount) {
    const nextVal = selectedPassengers + amount;
    if (nextVal >= 1 && nextVal <= 9) {
        selectedPassengers = nextVal;
        document.getElementById('pax-count').innerText = selectedPassengers;
    }
}

function setFlightSort(mode) {
    flightSortMode = mode;
    document.getElementById('sort-tab-points').classList.toggle('active', mode === 'POINTS');
    document.getElementById('sort-tab-cash').classList.toggle('active', mode === 'CASH');
    document.getElementById('sort-tab-fastest').classList.toggle('active', mode === 'FASTEST');
    document.getElementById('sort-tab-yield').classList.toggle('active', mode === 'YIELD');
    renderFlightResults();
}

function setStopsFilter(stops) {
    flightStopsFilter = stops;
    document.getElementById('stops-all-btn').classList.toggle('active', stops === 'ALL');
    document.getElementById('stops-direct-btn').classList.toggle('active', stops === 'DIRECT');
    renderFlightResults();
}

function toggleAirlineFilter(cb) {
    const airline = cb.value;
    if (cb.checked) {
        flightSelectedAirlines.add(airline);
    } else {
        flightSelectedAirlines.delete(airline);
    }
    renderFlightResults();
}

const CARRIER_MAP = {
    'QR': { name: 'Qatar Airways', partnerId: 48, logo: 'logos/qatar_privilege_club.webp' },
    'SQ': { name: 'Singapore Airlines', partnerId: 82, logo: 'logos/krisflyer.webp' },
    'AI': { name: 'Air India', partnerId: 85, logo: 'logos/maharaja_club.webp' },
    'BA': { name: 'British Airways', partnerId: 47, logo: 'logos/british_airways_executive_club.webp' },
    'VS': { name: 'Virgin Atlantic', partnerId: 94, logo: 'logos/virgin_atlantic_flying_club.webp' },
    'EK': { name: 'Emirates', partnerId: 74, logo: 'logos/emirates_skywards.webp' }
};

function parseDuration(iso) {
    if (!iso) return '12h 45m';
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return '12h 45m';
    const h = match[1] ? match[1] + 'h' : '';
    const m = match[2] ? match[2] + 'm' : '';
    return `${h} ${m}`.trim() || 'Direct';
}

function generateOfflineSimulatedFlights(origin, dest, cabinClass) {
    const carriers = [
        { name: 'Qatar Airways', partnerId: 48, logo: 'logos/qatar_privilege_club.webp', stops: '1 Stop', duration: '12h 45m', code: 'QR' },
        { name: 'Singapore Airlines', partnerId: 82, logo: 'logos/krisflyer.webp', stops: 'Direct', duration: '5h 45m', code: 'SQ' },
        { name: 'Air India', partnerId: 85, logo: 'logos/maharaja_club.webp', stops: 'Direct', duration: '9h 15m', code: 'AI' }
    ];
    
    const isBiz = cabinClass === 'BUSINESS';
    const baseMiles = isBiz ? 70000 : 25000;
    const baseCash = isBiz ? 120000 : 38000;
    const baseTaxes = isBiz ? 15000 : 6000;
    
    const paxMultiplier = selectedPassengers;
    const tripMultiplier = selectedTripType === 'ROUNDTRIP' ? 2 : 1;
    const cashMultiplier = selectedTripType === 'ROUNDTRIP' ? 1.85 : 1;
    
    return carriers.map((c, i) => {
        const factor = 1.0 + (i * 0.15) - 0.1;
        const milesVal = Math.round(baseMiles * factor * paxMultiplier * tripMultiplier / 500) * 500;
        const cashVal = Math.round(baseCash * factor * paxMultiplier * cashMultiplier / 1000) * 1000;
        const taxVal = Math.round(baseTaxes * factor * paxMultiplier * tripMultiplier / 100) * 100;
        return {
            airline: c.name,
            carrierCode: c.code,
            number: `${c.code} ${500 + i * 23}`,
            duration: c.duration,
            stops: c.stops,
            miles: milesVal,
            taxes: taxVal,
            cash: cashVal,
            partnerId: c.partnerId,
            logo: c.logo
        };
    });
}

function buildAirlineFilter(flights) {
    const filterBar = document.getElementById('flight-airline-filter-bar');
    if (!filterBar) return;

    const airlines = Array.from(new Set(flights.map(f => f.airline)));
    
    if (airlines.length <= 1) {
        filterBar.style.display = 'none';
        return;
    }

    filterBar.innerHTML = `<span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-right: 1rem;">Filter Airlines:</span>`;
    
    airlines.forEach(airline => {
        const label = document.createElement('label');
        label.className = 'airline-checkbox-label';
        label.innerHTML = `
            <input type="checkbox" value="${airline}" onchange="toggleAirlineFilter(this)">
            <span>${airline}</span>
        `;
        filterBar.appendChild(label);
    });
    
    filterBar.style.display = 'flex';
}

async function executeFlightSearch() {
    const resultsContainer = document.getElementById('flight-search-results');
    const loadingEl = document.getElementById('flight-search-loading');
    const cardsEl = document.getElementById('flight-results-cards');
    const sortFilterBar = document.getElementById('flight-sort-filter-bar');
    const airlineFilterBar = document.getElementById('flight-airline-filter-bar');
    
    if (!resultsContainer || !loadingEl || !cardsEl) return;
    
    resultsContainer.style.display = 'block';
    loadingEl.style.display = 'block';
    cardsEl.style.display = 'none';
    if (sortFilterBar) sortFilterBar.style.display = 'none';
    if (airlineFilterBar) airlineFilterBar.style.display = 'none';
    cardsEl.innerHTML = '';
    
    const cabinClass = document.getElementById('flight-class-select').value;
    let flights = [];

    try {
        const dateInput = document.getElementById('flight-date-input').value || new Date().toISOString().split('T')[0];
        let url = `http://localhost:3001/api/flights?origin=${selectedFlightOrigin}&dest=${selectedFlightDest}&date=${dateInput}&adults=${selectedPassengers}&cabinClass=${cabinClass}`;
        if (selectedTripType === 'ROUNDTRIP') {
            const d = new Date(dateInput);
            d.setDate(d.getDate() + 7);
            const returnDateStr = d.toISOString().split('T')[0];
            url += `&returnDate=${returnDateStr}`;
        }

        const res = await fetch(url);
        if (!res.ok) throw new Error("API call failed");
        const body = await res.json();
        
        if (body.simulated) {
            flights = body.data;
        } else {
            flights = (body.data || []).map((f, idx) => {
                const valCode = f.validatingAirlineCodes ? f.validatingAirlineCodes[0] : 'AI';
                const carrier = CARRIER_MAP[valCode] || { name: valCode, partnerId: null, logo: 'logos/li.png' };
                const segments = f.itineraries[0].segments;
                const segmentsCount = segments ? segments.length : 1;
                const stopsText = segmentsCount === 1 ? 'Direct' : `${segmentsCount - 1} Stop${segmentsCount - 1 > 1 ? 's' : ''}`;
                const durationText = parseDuration(f.itineraries[0].duration);
                
                const cashVal = Math.round(parseFloat(f.price.grandTotal));
                const basePrice = parseFloat(f.price.base || f.price.total);
                const taxVal = Math.round(cashVal - basePrice) || 5400;
                
                const isBiz = cabinClass === 'BUSINESS';
                const baseMiles = isBiz ? 70000 : 25000;
                const tripMultiplier = selectedTripType === 'ROUNDTRIP' ? 2 : 1;
                const milesVal = Math.round(baseMiles * selectedPassengers * tripMultiplier);

                return {
                    airline: carrier.name,
                    carrierCode: valCode,
                    number: `${valCode} ${500 + idx * 23}`,
                    duration: durationText,
                    stops: stopsText,
                    miles: milesVal,
                    taxes: taxVal,
                    cash: cashVal,
                    partnerId: carrier.partnerId,
                    logo: carrier.logo
                };
            });
        }
    } catch (err) {
        console.log("Amadeus API not reachable. Using offline simulated flights.");
        flights = generateOfflineSimulatedFlights(selectedFlightOrigin, selectedFlightDest, cabinClass);
    }

    setTimeout(() => {
        loadingEl.style.display = 'none';
        cardsEl.style.display = 'grid';
        
        currentRawFlights = flights;
        flightSelectedAirlines.clear();
        
        if (flights.length === 0) {
            cardsEl.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 2rem; color: var(--text-secondary);">No flights found for this route.</p>';
            return;
        }
        
        buildAirlineFilter(flights);
        if (sortFilterBar) sortFilterBar.style.display = 'flex';
        renderFlightResults();
    }, 1000);
}

function renderFlightResults() {
    const cardsEl = document.getElementById('flight-results-cards');
    if (!cardsEl) return;
    cardsEl.innerHTML = '';

    let filtered = currentRawFlights.filter(f => {
        if (flightStopsFilter === 'DIRECT') {
            return f.stops === 'Direct';
        }
        return true;
    });

    if (flightSelectedAirlines.size > 0) {
        filtered = filtered.filter(f => flightSelectedAirlines.has(f.airline));
    }

    if (flightSortMode === 'POINTS') {
        filtered.sort((a, b) => a.miles - b.miles);
    } else if (flightSortMode === 'CASH') {
        filtered.sort((a, b) => a.cash - b.cash);
    } else if (flightSortMode === 'FASTEST') {
        const getMinutes = (dur) => {
            const match = dur.match(/(?:(\d+)h)?\s*(?:(\d+)m)?/);
            const h = match && match[1] ? parseInt(match[1]) * 60 : 0;
            const m = match && match[2] ? parseInt(match[2]) : 0;
            return h + m || 9999;
        };
        filtered.sort((a, b) => getMinutes(a.duration) - getMinutes(b.duration));
    } else if (flightSortMode === 'YIELD') {
        const getYield = (f) => (f.cash - f.taxes) / f.miles;
        filtered.sort((a, b) => getYield(b) - getYield(a));
    }

    if (filtered.length === 0) {
        cardsEl.innerHTML = '<p style="text-align: center; grid-column: 1/-1; padding: 2rem; color: var(--text-secondary);">No flights match your filters.</p>';
        return;
    }

    const cabinClass = document.getElementById('flight-class-select').value;

    filtered.forEach(f => {
        const cashYield = (f.cash - f.taxes) / f.miles;
        const yieldText = cashYield.toFixed(2);
        const transfers = findBestCardTransfers(f.partnerId, f.miles);
        
        let transferSectionHtml = '';
        let actionHtml = '';
        
        if (transfers.length > 0) {
            const best = transfers[0];
            transferSectionHtml = `
                <div class="flight-transfer-instruction">
                    💡 Transfer <strong>${best.pointsNeeded.toLocaleString()}</strong> ${best.cardName} points (${best.ratioText} ratio) to ${f.airline}
                </div>
            `;
            actionHtml = `
                <button class="flight-action-btn" onclick="viewTransferPath(${best.cardId}, ${f.partnerId}, ${best.pointsNeeded})">
                    🔗 View Transfer Path
                </button>
            `;
        } else {
            transferSectionHtml = `
                <div class="flight-transfer-instruction" style="border-left-color: var(--text-muted);">
                    ℹ️ No credit card points transfer pathway found in our loyalty database. Use cash or direct miles.
                </div>
            `;
            actionHtml = `
                <button class="flight-action-btn" disabled style="opacity: 0.5; cursor: not-allowed;">
                    No Path Available
                </button>
            `;
        }
        
        const card = document.createElement('div');
        card.className = 'flight-card';
        card.innerHTML = `
            <div class="flight-yield-badge">Value: ₹${yieldText} / mile</div>
            
            <div class="flight-card-header">
                <div class="flight-airline-info">
                    <img class="flight-airline-logo" src="${getLogoUrl(f.logo)}" alt="${f.airline}" onerror="this.src='logos/li.png'">
                    <div style="display: flex; flex-direction: column;">
                        <span class="flight-airline-name">${f.airline}</span>
                        <span class="flight-number">${f.number}</span>
                    </div>
                </div>
                <span class="flight-cabin-badge ${cabinClass === 'BUSINESS' ? 'business' : ''}">${cabinClass}</span>
            </div>
            
            <div class="flight-card-body">
                <div class="flight-route-time-block">
                    <div class="flight-time">08:15</div>
                    <div class="flight-airport">${selectedFlightOrigin}</div>
                </div>
                
                <div class="flight-duration-block">
                    <span class="flight-duration">${f.duration}</span>
                    <div class="flight-line-indicator"></div>
                    <span class="flight-stops">${f.stops}</span>
                </div>
                
                <div class="flight-route-time-block" style="text-align: right;">
                    <div class="flight-time">17:45</div>
                    <div class="flight-airport">${selectedFlightDest}</div>
                </div>
            </div>
            
            <div class="flight-pricing-compare">
                <div class="pricing-box cash-price">
                    <span class="pricing-box-label">Cash Price</span>
                    <span class="pricing-box-value">₹${f.cash.toLocaleString()}</span>
                    <span class="pricing-box-subtext">All-inclusive cash ticket</span>
                </div>
                <div class="pricing-box points-price">
                    <span class="pricing-box-label">Points Price</span>
                    <span class="pricing-box-value">${f.miles.toLocaleString()} miles</span>
                    <span class="pricing-box-subtext">+ ₹${f.taxes.toLocaleString()} taxes</span>
                </div>
            </div>
            
            <div class="flight-card-footer">
                ${transferSectionHtml}
                ${actionHtml}
            </div>
        `;
        cardsEl.appendChild(card);
    });

    if (window.twemoji) {
        window.twemoji.parse(cardsEl);
    }
}

function viewTransferPath(cardId, partnerId, pointsNeeded) {
    switchDashboardTab('calc');
    selectOption('from', cardId);
    selectOption('to', partnerId);
    updatePointsVal(pointsNeeded);
    scrollToCalculator();
}

window.switchDashboardTab = switchDashboardTab;
window.toggleFlightDropdown = toggleFlightDropdown;
window.filterFlightDropdown = filterFlightDropdown;
window.executeFlightSearch = executeFlightSearch;
window.viewTransferPath = viewTransferPath;
window.setTripType = setTripType;
window.adjustPassengers = adjustPassengers;
window.setFlightSort = setFlightSort;
window.setStopsFilter = setStopsFilter;
window.toggleAirlineFilter = toggleAirlineFilter;

