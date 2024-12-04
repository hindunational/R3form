// Cache configuration
const CACHE_KEYS = {
    CHATA_DATA: 'chataData_cache',
    CACHE_TIMESTAMP: 'chataData_timestamp',
    CACHE_DURATION: 1000 * 60 * 5  // 5 minutes cache for development
};

// Sheety API configuration
const SHEETY_API_ID = 'd9da852d0370030da19c227582af6f3a';
const SHEETY_PROJECT = 'chata';
const SHEETY_BASE_URL = `https://api.sheety.co/${SHEETY_API_ID}/${SHEETY_PROJECT}`;
const ALL_URL_API = `${SHEETY_BASE_URL}/allUrl`;
const R3_FORM_API = `${SHEETY_BASE_URL}/r3Form`;
const STORAGE_KEY = 'formR3_fieldContents';
let chataData = [];
let isLoadingData = false;

// Field configuration
const fieldConfig = {
    'clinical-observations': {
        title: 'Key Clinical Observations',
        defaultText: `• Social engagement patterns
• Communication style
• Response to activities
• Behavioral patterns
• Notable strengths/challenges`,
        charLimit: 2000
    },
    'strengths-abilities': {
        title: 'Strengths & Abilities',
        defaultText: `• Memory (e.g., Strong recall of sequences)
• Visual (e.g., Pattern recognition)
• Physical (e.g., Fine motor skills)
• Creative (e.g., Problem-solving abilities)
• Focus (e.g., Sustained attention)
• Problem-solving (e.g., Logical approach)`,
        charLimit: 2000
    },
    'priority-support': {
        title: 'Priority Support Areas',
        defaultText: `• Assessment data patterns
• Family priorities
• School observations
• Clinical judgment`,
        charLimit: 2000
    },
    'support-recommendations': {
        title: 'Support Recommendations',
        defaultText: `• Strength-based strategies
• Practical implementation
• Home/school alignment
• Family resources`,
        charLimit: 2000
    }
};

// Initialize window.fieldContents
window.fieldContents = window.fieldContents || {
    referrals: {
        checked: [],
        remarks: ''
    }
};

// Function to check if cache is valid
function isCacheValid() {
    const timestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
    if (!timestamp) return false;
    
    const now = new Date().getTime();
    const cacheTime = parseInt(timestamp);
    return (now - cacheTime) < CACHE_KEYS.CACHE_DURATION;
}

// Function to get cached data
function getCachedData() {
    try {
        const cachedData = localStorage.getItem(CACHE_KEYS.CHATA_DATA);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error('Error reading from cache:', error);
        return null;
    }
}

// Function to set cache data
function setCacheData(data) {
    try {
        localStorage.setItem(CACHE_KEYS.CHATA_DATA, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, new Date().getTime().toString());
    } catch (error) {
        console.error('Error setting cache:', error);
    }
}

// Function to clear cache
function clearCache() {
    try {
        localStorage.removeItem(CACHE_KEYS.CHATA_DATA);
        localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP);
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
}

// Function to show loading state in dropdown
function setDropdownLoadingState(loading) {
    const dropdown = document.getElementById('chata-id-select');
    const refreshButton = document.getElementById('refresh-data');
    
    if (dropdown) {
        if (loading) {
            dropdown.innerHTML = '<option value="">Loading CHATA IDs...</option>';
            dropdown.disabled = true;
            if (refreshButton) {
                refreshButton.classList.add('loading');
            }
        } else {
            dropdown.disabled = false;
            if (refreshButton) {
                refreshButton.classList.remove('loading');
            }
        }
    }
}

async function loadChataData(forceRefresh = false) {
    if (isLoadingData) {
        console.log('Already loading data, skipping request');
        return;
    }

    try {
        isLoadingData = true;
        setDropdownLoadingState(true);

        // Check cache first unless force refresh is requested
        if (!forceRefresh && isCacheValid()) {
            const cachedData = getCachedData();
            if (cachedData && cachedData.length > 0) {
                console.log('Loading data from cache (expires in:', 
                    Math.round((CACHE_KEYS.CACHE_DURATION - (new Date().getTime() - parseInt(localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP)))) / 1000), 
                    'seconds)');
                chataData = cachedData;
                updateChataDropdown();
                return;
            }
        }

        console.log('Fetching fresh data from API:', ALL_URL_API);
        
        const response = await fetch(ALL_URL_API);
        const json = await response.json();
        console.log('Raw CHATA data:', json);
        
        if (!json || !json.allUrl) {
            throw new Error('Invalid data format received from API');
        }

        chataData = json.allUrl
            .filter(row => row.chataId && row.chataId !== "CHATA_ID")
            .map(row => ({
                id: row.chataId,
                name: row.childName,
                r1Url: row['r1Generated (pdf)'],
                r2Url: row['r2Generated (pdf)']
            }));

        console.log('Processed CHATA data:', chataData);
        
        if (chataData.length === 0) {
            throw new Error('No valid data received from API');
        }

        setCacheData(chataData);
        updateChataDropdown();

    } catch (error) {
        console.error('Error loading CHATA data:', error);
        const cachedData = getCachedData();
        if (cachedData && cachedData.length > 0) {
            console.log('Using cached data as fallback');
            chataData = cachedData;
            updateChataDropdown();
        } else {
            updateChataDropdown(); // Will show error state
        }
    } finally {
        isLoadingData = false;
        setDropdownLoadingState(false);
    }
}

// Function to update the dropdown with CHATA data
function updateChataDropdown() {
    const dropdown = document.getElementById('chata-id-select');
    if (dropdown) {
        if (!chataData || chataData.length === 0) {
            dropdown.innerHTML = '<option value="">No CHATA IDs available</option>';
            return;
        }

        dropdown.innerHTML = '<option value="">Select CHATA ID</option>' +
            chataData
                .filter(item => item.id)
                .map(item => {
                    const displayText = item.name ? 
                        `${item.id} - ${item.name}` : 
                        item.id;
                    return `<option value="${item.id}">${displayText}</option>`;
                })
                .join('');
        console.log('Populated dropdown with', chataData.length, 'options');
    }
}

// Function to handle CHATA ID selection change
function handleChataIdChange(event) {
    const selectedId = event.target.value;
    const selectedData = chataData.find(item => item.id === selectedId);
    
    if (selectedData) {
        // Update PDF iframes if they exist and have URLs
        if (selectedData.r1Url || selectedData.r2Url) {
            const frame1 = document.getElementById('pdf-frame-1');
            const frame2 = document.getElementById('pdf-frame-2');
            const placeholder1 = document.getElementById('pdf-placeholder-1');
            const placeholder2 = document.getElementById('pdf-placeholder-2');
            
            if (frame1 && selectedData.r1Url) {
                console.log('Setting R1 PDF URL:', selectedData.r1Url);
                frame1.src = selectedData.r1Url;
                frame1.style.display = 'block';
                if (placeholder1) placeholder1.style.display = 'none';
            }
            if (frame2 && selectedData.r2Url) {
                console.log('Setting R2 PDF URL:', selectedData.r2Url);
                frame2.src = selectedData.r2Url;
                frame2.style.display = 'block';
                if (placeholder2) placeholder2.style.display = 'none';
            }
        } else {
            console.log('No PDF URLs available for:', selectedId);
        }
    } else {
        // Reset PDFs to placeholder state
        const frames = [
            document.getElementById('pdf-frame-1'),
            document.getElementById('pdf-frame-2')
        ];
        const placeholders = [
            document.getElementById('pdf-placeholder-1'),
            document.getElementById('pdf-placeholder-2')
        ];
        
        frames.forEach(frame => {
            if (frame) {
                frame.src = 'about:blank';
                frame.style.display = 'none';
            }
        });
        
        placeholders.forEach(placeholder => {
            if (placeholder) placeholder.style.display = 'flex';
        });
    }
}

// Initialize event listeners and load data
document.addEventListener('DOMContentLoaded', () => {
    const chataIdSelect = document.getElementById('chata-id-select');
    if (chataIdSelect) {
        // Lazy load data on first interaction
        chataIdSelect.addEventListener('mousedown', async (event) => {
            if (!chataData.length) {
                event.preventDefault(); // Prevent dropdown from opening
                await loadChataData();
                chataIdSelect.click(); // Re-open dropdown after data is loaded
            }
        });

        chataIdSelect.addEventListener('change', handleChataIdChange);
    }

    // Add refresh button handler
    const refreshButton = document.getElementById('refresh-data');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            clearCache();
            await loadChataData(true);
        });
    }

    // Add submit button handler
    const submitButton = document.querySelector('.submit-button');
    if (submitButton) {
        submitButton.addEventListener('click', handleSubmit);
    }

    // Add clear button handler
    const clearButton = document.querySelector('.clear-button');
    if (clearButton) {
        clearButton.addEventListener('click', clearForm);
    }

    // Initialize other components
    initializeModal();
    loadSavedData();
    initializeExpandableFields();
    initializeReferrals();
});

async function handleSubmit() {
    try {
        const chataIdSelect = document.getElementById('chata-id-select');
        const selectedChataId = chataIdSelect?.value;
        const selectedData = chataData.find(item => item.id === selectedChataId);
        
        if (!selectedChataId || !selectedData) {
            alert('Please select a CHATA ID');
            return;
        }

        const ascStatus = document.querySelector('select[name="asc_status"]')?.value;
        const adhdStatus = document.querySelector('select[name="adhd_status"]')?.value;

        if (!ascStatus || !adhdStatus) {
            alert('Please select both ASC and ADHD status');
            return;
        }

        // Get referrals data
        const professionalReferrals = window.fieldContents.referrals ? 
            `Selected referrals: ${window.fieldContents.referrals.checked.join(', ')}${window.fieldContents.referrals.remarks ? `\nRemarks: ${window.fieldContents.referrals.remarks}` : ''}` : 
            'No referrals selected';

        // Check for existing entries using filter
        const existingEntriesResponse = await fetch(`${R3_FORM_API}?filter[chataId]=${selectedChataId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!existingEntriesResponse.ok) {
            throw new Error('Failed to check existing entries');
        }

        const existingEntries = await existingEntriesResponse.json();
        console.log('Matching entries:', existingEntries);

        // Delete existing entries if found
        if (existingEntries.r3Form && existingEntries.r3Form.length > 0) {
            const userChoice = confirm(
                `An assessment for ${selectedChataId} already exists.\n\n` +
                'Click OK to update the existing assessment, or Cancel to abort submission.'
            );
            
            if (!userChoice) {
                return; // User chose to cancel
            }

            // Delete existing entries
            for (const entry of existingEntries.r3Form) {
                const deleteUrl = `${R3_FORM_API}/${entry.id}`;
                console.log('Deleting entry at:', deleteUrl);

                const deleteResponse = await fetch(deleteUrl, {
                    method: 'DELETE',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (!deleteResponse.ok) {
                    throw new Error(`Failed to delete entry ${entry.id}`);
                }

                console.log(`Deleted entry ${entry.id}`);
            }
        }

        // Create new entry using Sheety's expected format
        const formData = {
            r3Form: {
                chataId: selectedChataId,
                name: selectedData.name,
                timestamp: new Date().toISOString(),
                ascStatus: ascStatus,
                adhdStatus: adhdStatus,
                keyClinicalObservations: window.fieldContents['clinical-observations'] || '',
                strengthsAndAbilities: window.fieldContents['strengths-abilities'] || '',
                prioritySupportAreas: window.fieldContents['priority-support'] || '',
                supportRecommendations: window.fieldContents['support-recommendations'] || '',
                professionalReferrals: professionalReferrals
            }
        };

        const createResponse = await fetch(R3_FORM_API, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        if (!createResponse.ok) {
            const errorText = await createResponse.text();
            console.error('Create response:', errorText);
            throw new Error(`Failed to create new entry. Status: ${createResponse.status}`);
        }

        const result = await createResponse.json();
        console.log('Create result:', result);

        alert('Assessment submitted successfully!');

        if (confirm('Would you like to clear the form?')) {
            clearForm();
        }

    } catch (error) {
        console.error('Submission error:', error);
        alert(`Error submitting form: ${error.message}`);
    }
}

// Initialize modal functionality
function initializeModal() {
    const modal = document.querySelector('.modal-container');
    const backdrop = document.querySelector('.modal-backdrop');
    
    if (!modal || !backdrop) {
        console.log('Modal elements not found, skipping modal initialization');
        return;
    }

    backdrop.addEventListener('click', () => {
        const content = modal.querySelector('.expandable-text')?.value;
        const fieldId = modal.dataset.currentField;
        if (fieldId && content) {
            window.fieldContents[fieldId] = content;
            const preview = document.querySelector(`[data-field-id="${fieldId}"] .field-preview`);
            if (preview) {
                preview.textContent = content;
            }
            saveToLocalStorage();
        }
        modal.classList.remove('active');
        backdrop.classList.remove('active');
    });
}

// Initialize expandable fields
function initializeExpandableFields() {
    document.querySelectorAll('.expandable-field').forEach(field => {
        const preview = field.querySelector('.field-preview');
        const fieldId = field.dataset.fieldId;
        
        if (preview) {
            preview.addEventListener('click', () => {
                openFieldEditor(fieldId, preview.textContent);
            });
        }
    });
}

// Open field editor
function openFieldEditor(fieldId, currentContent) {
    const modal = document.querySelector('.modal-container');
    const backdrop = document.querySelector('.modal-backdrop');
    const modalHeader = modal.querySelector('.modal-header h4');
    const textarea = modal.querySelector('.expandable-text');
    
    if (!modal || !backdrop || !modalHeader || !textarea) {
        console.error('Required modal elements not found');
        return;
    }

    modalHeader.textContent = fieldConfig[fieldId]?.title || 'Edit Field';
    textarea.value = window.fieldContents[fieldId] || fieldConfig[fieldId]?.defaultText || '';
    textarea.maxLength = fieldConfig[fieldId]?.charLimit || 2000;
    modal.dataset.currentField = fieldId;

    modal.classList.add('active');
    backdrop.classList.add('active');
    textarea.focus();
}

// Initialize referrals section
function initializeReferrals() {
    const checkboxes = document.querySelectorAll('.referrals-grid input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', saveReferrals);
    });

    const remarksInput = document.querySelector('input[name="other_referrals"]');
    if (remarksInput) {
        remarksInput.addEventListener('input', debounce(saveReferrals, 500));
    }
}

// Save referrals state
function saveReferrals() {
    const checkboxes = document.querySelectorAll('.referrals-grid input[type="checkbox"]');
    const checkedValues = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    const remarksInput = document.querySelector('input[name="other_referrals"]');
    const remarks = remarksInput ? remarksInput.value : '';

    window.fieldContents.referrals = {
        checked: checkedValues,
        remarks: remarks
    };

    saveToLocalStorage();
}

// Function to clear form
function clearForm() {
    // Reset all expandable fields to their default text
    Object.keys(fieldConfig).forEach(fieldId => {
        const preview = document.querySelector(`[data-field-id="${fieldId}"] .field-preview`);
        if (preview) {
            preview.textContent = fieldConfig[fieldId].defaultText;
        }
        delete window.fieldContents[fieldId];
    });

    // Reset dropdowns
    document.querySelector('select[name="asc_status"]').value = '';
    document.querySelector('select[name="adhd_status"]').value = '';

    // Reset checkboxes
    document.querySelectorAll('.referrals-grid input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    // Reset other referrals input
    document.querySelector('input[name="other_referrals"]').value = '';

    // Reset referrals in fieldContents
    window.fieldContents.referrals = {
        checked: [],
        remarks: ''
    };

    // Reset PDFs
    const frames = [
        document.getElementById('pdf-frame-1'),
        document.getElementById('pdf-frame-2')
    ];
    const placeholders = [
        document.getElementById('pdf-placeholder-1'),
        document.getElementById('pdf-placeholder-2')
    ];
    
    frames.forEach(frame => {
        if (frame) {
            frame.src = 'about:blank';
            frame.style.display = 'none';
        }
    });
    
    placeholders.forEach(placeholder => {
        if (placeholder) {
            placeholder.style.display = 'flex';
        }
    });

    // Reset CHATA ID select
    const chataIdSelect = document.getElementById('chata-id-select');
    if (chataIdSelect) {
        chataIdSelect.value = '';
    }

    // Save cleared state
    saveToLocalStorage();
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Function to load saved form data
function loadSavedData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            window.fieldContents = JSON.parse(saved);
            
            // Load expandable field contents
            Object.keys(window.fieldContents).forEach(fieldId => {
                if (fieldId !== 'referrals') {  // Skip referrals object
                    const preview = document.querySelector(`[data-field-id="${fieldId}"] .field-preview`);
                    if (preview) {
                        const content = window.fieldContents[fieldId];
                        preview.textContent = content || fieldConfig[fieldId].defaultText;
                    }
                }
            });

            // Load referral checkboxes
            if (window.fieldContents.referrals) {
                const checkboxes = document.querySelectorAll('.referrals-grid input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = window.fieldContents.referrals.checked.includes(checkbox.value);
                });
                
                // Load remarks
                const remarksInput = document.querySelector('input[name="other_referrals"]');
                if (remarksInput && window.fieldContents.referrals.remarks) {
                    remarksInput.value = window.fieldContents.referrals.remarks;
                }
            }
        } catch (e) {
            console.error('Error loading saved data:', e);
        }
    }
}

// Function to save to localStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.fieldContents));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
} 