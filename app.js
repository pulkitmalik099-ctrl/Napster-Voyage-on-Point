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
