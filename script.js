document.addEventListener('DOMContentLoaded', function() {
    // Global variables
    const titrationData = {
        standard: {
            type: 'acid',
            solution: 'hydrochloric',
            concentration: 0.1,
            isStrong: true
        },
        analyte: {
            type: 'base',
            solution: 'sodium-hydroxide',
            concentration: null, // Will be calculated
            isStrong: true
        },
        indicator: 'auto',
        analyteVolume: 25, // mL
        buretteVolume: 50, // mL
        currentBuretteReading: 50, // mL
        pHValues: [],
        volumeAdded: [],
        endpointVolume: null,
        endpointDetected: false,
        reactionEquation: '',
        activeIndicatorRange: {}
    };

    // Chemistry Constants
    const ACID_PROPERTIES = {
        'hydrochloric': { formula: 'HCl', isStrong: true, pKa: -7, equivalents: 1 },
        'sulfuric': { formula: 'H₂SO₄', isStrong: true, pKa: -3, equivalents: 2 },
        'ethanoic': { formula: 'CH₃COOH', isStrong: false, pKa: 4.76, equivalents: 1 },
        'ascorbic': { formula: 'C₆H₈O₆', isStrong: false, pKa: 4.10, equivalents: 1 }
    };

    const BASE_PROPERTIES = {
        'sodium-hydroxide': { formula: 'NaOH', isStrong: true, pKb: -0.8, equivalents: 1 },
        'ammonia': { formula: 'NH₃', isStrong: false, pKb: 4.75, equivalents: 1 }
    };

    const INDICATOR_PROPERTIES = {
        'phenolphthalein': { range: [8.2, 10.0], colors: ['colorless', '#ff80ea'] },
        'methyl-orange': { range: [3.1, 4.4], colors: ['#ff4d4d', '#ffd24d'] },
        'bromothymol-blue': { range: [6.0, 7.6], colors: ['#ffeb3b', '#4169e1'] }
    };

    // DOM Elements
    const setupPanel = document.querySelector('.setup-panel');
    const titrationLab = document.querySelector('.titration-lab');
    const standardTypeSelect = document.getElementById('standard-type');
    const acidOptions = document.getElementById('acid-options');
    const baseOptions = document.getElementById('base-options');
    const acidTypeSelect = document.getElementById('acid-type');
    const baseTypeSelect = document.getElementById('base-type');
    const acidConcentrationInput = document.getElementById('acid-concentration');
    const baseConcentrationInput = document.getElementById('base-concentration');
    const analyteVolumeInput = document.getElementById('analyte-volume');
    const indicatorSelect = document.getElementById('indicator');
    const setupTitrationBtn = document.getElementById('setup-titration');
    const buretteLiquid = document.querySelector('.burette-liquid');
    const buretteReading = document.querySelector('.burette-reading');
    const buretteStopcock = document.querySelector('.burette-stopcock');
    const flaskLiquid = document.querySelector('.flask-liquid');
    const magneticStirrer = document.querySelector('.magnetic-stirrer');
    const swirlAnimation = document.querySelector('.swirl-animation');
    const phValueDisplay = document.getElementById('ph-value');
    const indicatorColor = document.getElementById('indicator-color');
    const currentVolumeDisplay = document.getElementById('current-volume');
    const recordReadingBtn = document.getElementById('record-reading');
    const readingsTable = document.getElementById('readings-table').querySelector('tbody');
    const clearTableBtn = document.getElementById('clear-table');
    const exportCsvBtn = document.getElementById('export-csv');
    const resetTitrationBtn = document.getElementById('reset-titration');
    const newExperimentBtn = document.getElementById('new-experiment');
    const addDropBtn = document.getElementById('add-drop');
    const slowAddBtn = document.getElementById('slow-add');
    const fastAddBtn = document.getElementById('fast-add');
    const stopAddBtn = document.getElementById('stop-add');
    const toggleStirrerBtn = document.getElementById('toggle-stirrer');
    const endpointVolumeDisplay = document.getElementById('endpoint-volume');
    const analyteConcentrationDisplay = document.getElementById('analyte-concentration');
    const calculationStepsContent = document.getElementById('calculation-steps-content');
    const calculationDetails = document.getElementById('calculation-details');
    
    // Initialize titration curve
    let titrationCurve = null;
    // Flags for continuous adding
    let isAddingContinuously = false;
    let addingInterval = null;
    // Counter for readings
    let readingCounter = 0;
    
    // Setup event listeners
    function initializeEventListeners() {
        // Setup panel events
        standardTypeSelect.addEventListener('change', updateSolutionOptions);
        setupTitrationBtn.addEventListener('click', setupTitration);
        
        // Lab controls events
        addDropBtn.addEventListener('click', () => addTitrant(0.05));
        slowAddBtn.addEventListener('click', () => startContinuousAddition(0.1));
        fastAddBtn.addEventListener('click', () => startContinuousAddition(0.5));
        stopAddBtn.addEventListener('click', stopContinuousAddition);
        toggleStirrerBtn.addEventListener('click', toggleStirrer);
        recordReadingBtn.addEventListener('click', recordReading);
        clearTableBtn.addEventListener('click', clearReadingsTable);
        exportCsvBtn.addEventListener('click', exportToCsv);
        resetTitrationBtn.addEventListener('click', resetTitration);
        newExperimentBtn.addEventListener('click', startNewExperiment);
        
        // Collapsible sections
        document.querySelectorAll('.collapsible').forEach(collapsible => {
            collapsible.addEventListener('click', function() {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                if (content.style.display === 'block') {
                    content.style.display = 'none';
                } else {
                    content.style.display = 'block';
                }
            });
            
            // Initialize calculations section as expanded
            if (collapsible.textContent.includes('Calculations')) {
                collapsible.classList.add('active');
                const content = collapsible.nextElementSibling;
                content.style.display = 'block';
            }
        });
    }
    
    // Update solution options based on selected standard type
    function updateSolutionOptions() {
        const isAcidStandard = standardTypeSelect.value === 'acid';
        
        // Update visibility of options
        if (isAcidStandard) {
            acidOptions.style.display = 'block';
            baseOptions.style.display = 'block';
            acidConcentrationInput.disabled = false;
            baseConcentrationInput.disabled = true;
            
            // Set default values
            titrationData.standard.type = 'acid';
            titrationData.analyte.type = 'base';
        } else {
            acidOptions.style.display = 'block';
            baseOptions.style.display = 'block';
            acidConcentrationInput.disabled = true;
            baseConcentrationInput.disabled = false;
            
            // Set default values
            titrationData.standard.type = 'base';
            titrationData.analyte.type = 'acid';
        }
        
        // Update indicator recommendation based on acid-base combination
        updateIndicatorRecommendation();
    }
    
    // Update indicator recommendation
    function updateIndicatorRecommendation() {
        const acidType = acidTypeSelect.value;
        const baseType = baseTypeSelect.value;
        const isAcidStrong = ACID_PROPERTIES[acidType].isStrong;
        const isBaseStrong = BASE_PROPERTIES[baseType].isStrong;
        
        if (indicatorSelect.value === 'auto') {
            let recommendedIndicator;
            
            if (isAcidStrong && isBaseStrong) {
                // Strong acid + Strong base: Can use either
                recommendedIndicator = 'phenolphthalein';
            } else if (isAcidStrong && !isBaseStrong) {
                // Strong acid + Weak base: Use methyl orange
                recommendedIndicator = 'methyl-orange';
            } else if (!isAcidStrong && isBaseStrong) {
                // Weak acid + Strong base: Use phenolphthalein
                recommendedIndicator = 'phenolphthalein';
            } else {
                // Weak acid + Weak base: Use bromothymol blue
                recommendedIndicator = 'bromothymol-blue';
            }
            
            titrationData.indicator = recommendedIndicator;
        } else {
            titrationData.indicator = indicatorSelect.value;
        }
        
        // Set active indicator range
        titrationData.activeIndicatorRange = INDICATOR_PROPERTIES[titrationData.indicator].range;
    }
    
    // Setup titration experiment
    function setupTitration() {
        // Get values from form
        const isAcidStandard = standardTypeSelect.value === 'acid';
        const acidType = acidTypeSelect.value;
        const baseType = baseTypeSelect.value;
        
        // Setup standard and analyte
        if (isAcidStandard) {
            // Acid is in burette (standard)
            titrationData.standard = {
                type: 'acid',
                solution: acidType,
                concentration: parseFloat(acidConcentrationInput.value),
                isStrong: ACID_PROPERTIES[acidType].isStrong,
                formula: ACID_PROPERTIES[acidType].formula,
                equivalents: ACID_PROPERTIES[acidType].equivalents,
                pKa: ACID_PROPERTIES[acidType].pKa
            };
            
            titrationData.analyte = {
                type: 'base',
                solution: baseType,
                concentration: null, // Will be calculated
                isStrong: BASE_PROPERTIES[baseType].isStrong,
                formula: BASE_PROPERTIES[baseType].formula,
                equivalents: BASE_PROPERTIES[baseType].equivalents,
                pKb: BASE_PROPERTIES[baseType].pKb
            };
            
            // Set burette liquid color (blue for acid)
            buretteLiquid.style.backgroundColor = 'rgba(52, 152, 219, 0.7)';
            // Flask liquid color (pink/red for base)
            flaskLiquid.style.backgroundColor = 'rgba(231, 76, 60, 0.5)';
        } else {
            // Base is in burette (standard)
            titrationData.standard = {
                type: 'base',
                solution: baseType,
                concentration: parseFloat(baseConcentrationInput.value),
                isStrong: BASE_PROPERTIES[baseType].isStrong,
                formula: BASE_PROPERTIES[baseType].formula,
                equivalents: BASE_PROPERTIES[baseType].equivalents,
                pKb: BASE_PROPERTIES[baseType].pKb
            };
            
            titrationData.analyte = {
                type: 'acid',
                solution: acidType,
                concentration: null, // Will be calculated
                isStrong: ACID_PROPERTIES[acidType].isStrong,
                formula: ACID_PROPERTIES[acidType].formula,
                equivalents: ACID_PROPERTIES[acidType].equivalents,
                pKa: ACID_PROPERTIES[acidType].pKa
            };
            
            // Set burette liquid color (pink/red for base)
            buretteLiquid.style.backgroundColor = 'rgba(231, 76, 60, 0.7)';
            // Flask liquid color (blue for acid)
            flaskLiquid.style.backgroundColor = 'rgba(52, 152, 219, 0.5)';
        }
        
        // Set analyte volume
        titrationData.analyteVolume = parseFloat(analyteVolumeInput.value);
        
        // Set indicator
        updateIndicatorRecommendation();
        
        // Generate reaction equation
        generateReactionEquation();
        
        // Clear previous data
        clearTitrationData();
        
        // Show titration lab
        setupPanel.style.display = 'none';
        titrationLab.style.display = 'block';
        
        // Initialize lab visuals
        resetLabVisuals();
        
        // Calculate initial pH and ensure it's properly displayed
    // Force a small volume addition to trigger proper pH calculation
    calculateAndUpdatePH(0.00001);
    // Then reset to 0 for display purposes
    titrationData.volumeAdded = [0];
    titrationData.pHValues = [parseFloat(phValueDisplay.textContent)];
    currentVolumeDisplay.textContent = '0.00 mL';
        
        // Initialize titration curve
        initializeTitrationCurve();
    }
    
    // Generate chemical equation for the reaction
    function generateReactionEquation() {
        const acid = titrationData.standard.type === 'acid' ? titrationData.standard : titrationData.analyte;
        const base = titrationData.standard.type === 'base' ? titrationData.standard : titrationData.analyte;
        
        titrationData.reactionEquation = `${acid.formula} + ${base.formula} → `;
        
        // Different products based on the acid and base
        if (acid.solution === 'hydrochloric' && base.solution === 'sodium-hydroxide') {
            titrationData.reactionEquation += 'NaCl + H₂O';
        } else if (acid.solution === 'sulfuric' && base.solution === 'sodium-hydroxide') {
            titrationData.reactionEquation += 'Na₂SO₄ + 2H₂O';
        } else if (acid.solution === 'ethanoic' && base.solution === 'sodium-hydroxide') {
            titrationData.reactionEquation += 'CH₃COONa + H₂O';
        } else if (acid.solution === 'ascorbic' && base.solution === 'sodium-hydroxide') {
            titrationData.reactionEquation += 'C₆H₇O₆Na + H₂O';
        } else if (acid.solution === 'hydrochloric' && base.solution === 'ammonia') {
            titrationData.reactionEquation += 'NH₄Cl';
        } else if (acid.solution === 'sulfuric' && base.solution === 'ammonia') {
            titrationData.reactionEquation += '(NH₄)₂SO₄';
        } else if (acid.solution === 'ethanoic' && base.solution === 'ammonia') {
            titrationData.reactionEquation += 'CH₃COONH₄';
        } else if (acid.solution === 'ascorbic' && base.solution === 'ammonia') {
            titrationData.reactionEquation += 'C₆H₇O₆NH₄';
        } else {
            titrationData.reactionEquation += 'salt + H₂O';
        }
    }
    
    // Reset lab visuals
    function resetLabVisuals() {
        // Reset burette
        titrationData.currentBuretteReading = titrationData.buretteVolume;
        buretteReading.textContent = titrationData.currentBuretteReading.toFixed(2) + ' mL';
        buretteLiquid.style.height = '100%';
        buretteStopcock.classList.remove('open');
        
        // Reset flask
        swirlAnimation.style.opacity = '0';
        magneticStirrer.classList.remove('active');
        
        // Reset displays
        currentVolumeDisplay.textContent = '0.00 mL';
        
        // Enable/disable buttons
        addDropBtn.disabled = false;
        slowAddBtn.disabled = false;
        fastAddBtn.disabled = false;
        stopAddBtn.disabled = true;
        recordReadingBtn.disabled = false;
        
        // Reset endpoint detection
        titrationData.endpointDetected = false;
    }
    
    // Initialize titration curve chart
    function initializeTitrationCurve() {
        const ctx = document.getElementById('titration-curve').getContext('2d');
        
        // Destroy previous chart if exists
        if (titrationCurve) {
            titrationCurve.destroy();
        }
        
        titrationCurve = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'pH',
                    data: [],
                    borderColor: 'rgb(52, 152, 219)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    tension: 0.1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Volume Added (mL)'
                        },
                        beginAtZero: true
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'pH'
                        },
                        min: 0,
                        max: 14,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `pH: ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Add titrant (from burette)
    function addTitrant(volume) {
        if (titrationData.currentBuretteReading <= 0 || titrationData.endpointDetected) {
            return;
        }
        
        // Calculate new burette reading
        const newReading = Math.max(0, titrationData.currentBuretteReading - volume);
        const actualVolumeAdded = titrationData.currentBuretteReading - newReading;
        titrationData.currentBuretteReading = newReading;
        
        // Calculate total volume added
        const totalVolumeAdded = titrationData.buretteVolume - titrationData.currentBuretteReading;
        
        // Update lab visuals
        updateBurette();
        
        // Calculate pH at new volume
        calculateAndUpdatePH(totalVolumeAdded);
        
        // Check for endpoint
        checkEndpoint(totalVolumeAdded);
        
        // Update the titration curve
        updateTitrationCurve(totalVolumeAdded);
    }
    
    // Start continuous addition of titrant
    function startContinuousAddition(rate) {
        if (isAddingContinuously) {
            stopContinuousAddition();
        }
        
        // Open the stopcock visually
        buretteStopcock.classList.add('open');
        
        // Disable add buttons, enable stop button
        addDropBtn.disabled = true;
        slowAddBtn.disabled = true;
        fastAddBtn.disabled = true;
        stopAddBtn.disabled = false;
        
        // Start interval for continuous addition
        isAddingContinuously = true;
        addingInterval = setInterval(() => {
            // Add a small volume each interval
            addTitrant(rate / 10);
            
            // Stop if burette is empty or endpoint detected
            if (titrationData.currentBuretteReading <= 0 || titrationData.endpointDetected) {
                stopContinuousAddition();
            }
        }, 100);
    }
    
    // Stop continuous addition
    function stopContinuousAddition() {
        clearInterval(addingInterval);
        isAddingContinuously = false;
        
        // Close the stopcock visually
        buretteStopcock.classList.remove('open');
        
        // Enable add buttons, disable stop button
        addDropBtn.disabled = false;
        slowAddBtn.disabled = false;
        fastAddBtn.disabled = false;
        stopAddBtn.disabled = true;
    }
    
    // Toggle magnetic stirrer
    function toggleStirrer() {
        const isActive = magneticStirrer.classList.toggle('active');
        swirlAnimation.style.opacity = isActive ? '1' : '0';
    }
    
    // Update burette visuals
    function updateBurette() {
        // Update reading display
        buretteReading.textContent = titrationData.currentBuretteReading.toFixed(2) + ' mL';
        
        // Update liquid height as percentage
        const heightPercentage = (titrationData.currentBuretteReading / titrationData.buretteVolume) * 100;
        buretteLiquid.style.height = heightPercentage + '%';
        
        // Update current volume added display
        const volumeAdded = titrationData.buretteVolume - titrationData.currentBuretteReading;
        currentVolumeDisplay.textContent = volumeAdded.toFixed(2) + ' mL';
    }
    
    // Calculate pH based on titration progress
    function calculateAndUpdatePH(volumeAdded) {
        // Get volumes and concentrations in liters/mol for calculations
        const volumeAnalyte = titrationData.analyteVolume / 1000; // L
        const volumeTitrant = volumeAdded / 1000; // L
        const concTitrant = titrationData.standard.concentration; // mol/L
        
        // Moles of titrant added
        const molesTitrant = volumeTitrant * concTitrant * titrationData.standard.equivalents;
        
        // Estimate equivalence point volume
        const estimatedEndpointVolume = calculateEndpointVolume();
        
        // For simulation purposes, we'll use a fixed initial concentration
        // In a real lab, we wouldn't know this until after the titration
        let initialConcAnalyte;
        if (titrationData.analyte.concentration) {
            initialConcAnalyte = titrationData.analyte.concentration;
        } else {
            // Reasonable concentration for demonstration
            initialConcAnalyte = concTitrant;
            titrationData.analyte.concentration = initialConcAnalyte;
        }
        
        // Initial moles of analyte
        const initialMolesAnalyte = volumeAnalyte * initialConcAnalyte * titrationData.analyte.equivalents;
        
        // Calculate the pH based on titration conditions
        let pH = 7; // Default neutral pH
        
        if (titrationData.standard.type === 'acid') {
            // ACID INTO BASE TITRATION
            const isStrongAcid = titrationData.standard.isStrong;
            const isStrongBase = titrationData.analyte.isStrong;
            
            if (volumeAdded === 0) {
                // Initial solution - just the base
                if (isStrongBase) {
                    // Strong base initial pH
                    pH = 14 - (-Math.log10(initialConcAnalyte));
                } else {
                    // Weak base initial pH
                    const pOH = titrationData.analyte.pKb / 2 - Math.log10(Math.sqrt(initialConcAnalyte));
                    pH = 14 - pOH;
                }
            } else if (volumeAdded < estimatedEndpointVolume) {
                // Before endpoint - excess base being neutralized
                
                // Calculate remaining base concentration
                const excessBaseMoles = initialMolesAnalyte - molesTitrant;
                const totalVolume = volumeAnalyte + volumeTitrant;
                const excessBaseConc = excessBaseMoles / totalVolume;
                
                if (isStrongAcid && isStrongBase) {
                    // Strong acid + Strong base
                    // pH drops as base is consumed
                    const pOH = -Math.log10(excessBaseConc);
                    pH = 14 - pOH;
                } else if (isStrongAcid && !isStrongBase) {
                    // Strong acid + Weak base
                    // Buffer region forms with salt
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = excessBaseConc / saltConc;
                    pH = titrationData.analyte.pKb + Math.log10(ratio);
                    pH = 14 - pH; // Convert pOH to pH
                } else if (!isStrongAcid && isStrongBase) {
                    // Weak acid + Strong base
                    // Buffer region
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = saltConc / excessBaseConc;
                    pH = titrationData.standard.pKa + Math.log10(ratio);
                } else {
                    // Weak acid + Weak base
                    // Complex buffer behavior
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = saltConc / excessBaseConc;
                    pH = (titrationData.standard.pKa + 14 - titrationData.analyte.pKb) / 2 + Math.log10(ratio);
                }
                
                // Progress factor for visibility in simulation
                const progress = volumeAdded / estimatedEndpointVolume;
                if (progress > 0.9) {
                    // Near endpoint, pH changes more rapidly
                    pH = pH * (1 - progress) + 7 * progress;
                }
            } else if (Math.abs(volumeAdded - estimatedEndpointVolume) < 0.1) {
                // At endpoint
                if (isStrongAcid && isStrongBase) {
                    pH = 7; // Neutral at equivalence for strong acid/base
                } else if (isStrongAcid && !isStrongBase) {
                    pH = 5; // Acidic at equivalence for strong acid/weak base
                } else if (!isStrongAcid && isStrongBase) {
                    pH = 9; // Basic at equivalence for weak acid/strong base
                } else {
                    pH = 7; // Approximately neutral for weak/weak
                }
            } else {
                // After endpoint - excess acid
                const excessAcidMoles = molesTitrant - initialMolesAnalyte;
                const totalVolume = volumeAnalyte + volumeTitrant;
                const excessAcidConc = excessAcidMoles / totalVolume;
                
                if (isStrongAcid) {
                    // Strong acid excess
                    pH = -Math.log10(excessAcidConc);
                } else {
                    // Weak acid excess
                    pH = titrationData.standard.pKa + Math.log10(excessAcidConc);
                }
            }
        } else {
            // BASE INTO ACID TITRATION
            const isStrongBase = titrationData.standard.isStrong;
            const isStrongAcid = titrationData.analyte.isStrong;
            
            if (volumeAdded === 0) {
                // Initial solution - just the acid
                if (isStrongAcid) {
                    // Strong acid initial pH
                    pH = -Math.log10(initialConcAnalyte);
                } else {
                    // Weak acid initial pH
                    pH = titrationData.analyte.pKa / 2 - Math.log10(Math.sqrt(initialConcAnalyte));
                }
            } else if (volumeAdded < estimatedEndpointVolume) {
                // Before endpoint - excess acid being neutralized
                
                // Calculate remaining acid concentration
                const excessAcidMoles = initialMolesAnalyte - molesTitrant;
                const totalVolume = volumeAnalyte + volumeTitrant;
                const excessAcidConc = excessAcidMoles / totalVolume;
                
                if (isStrongBase && isStrongAcid) {
                    // Strong base + Strong acid
                    // pH rises as acid is consumed
                    pH = -Math.log10(excessAcidConc);
                } else if (isStrongBase && !isStrongAcid) {
                    // Strong base + Weak acid
                    // Buffer region forms with salt
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = saltConc / excessAcidConc;
                    pH = titrationData.analyte.pKa + Math.log10(ratio);
                } else if (!isStrongBase && isStrongAcid) {
                    // Weak base + Strong acid
                    // Buffer region
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = excessAcidConc / saltConc;
                    pH = 14 - titrationData.standard.pKb - Math.log10(ratio);
                } else {
                    // Weak base + Weak acid
                    // Complex buffer behavior
                    const saltConc = molesTitrant / totalVolume;
                    const ratio = excessAcidConc / saltConc;
                    pH = (titrationData.analyte.pKa + 14 - titrationData.standard.pKb) / 2 - Math.log10(ratio);
                }
                
                // Progress factor for visibility in simulation
                const progress = volumeAdded / estimatedEndpointVolume;
                if (progress > 0.9) {
                    // Near endpoint, pH changes more rapidly
                    pH = pH * (1 - progress) + 7 * progress;
                }
            } else if (Math.abs(volumeAdded - estimatedEndpointVolume) < 0.1) {
                // At endpoint
                if (isStrongBase && isStrongAcid) {
                    pH = 7; // Neutral at equivalence for strong acid/base
                } else if (isStrongBase && !isStrongAcid) {
                    pH = 9; // Basic at equivalence for strong base/weak acid
                } else if (!isStrongBase && isStrongAcid) {
                    pH = 5; // Acidic at equivalence for weak base/strong acid
                } else {
                    pH = 7; // Approximately neutral for weak/weak
                }
            } else {
                // After endpoint - excess base
                const excessBaseMoles = molesTitrant - initialMolesAnalyte;
                const totalVolume = volumeAnalyte + volumeTitrant;
                const excessBaseConc = excessBaseMoles / totalVolume;
                
                if (isStrongBase) {
                    // Strong base excess
                    const pOH = -Math.log10(excessBaseConc);
                    pH = 14 - pOH;
                } else {
                    // Weak base excess
                    const pOH = titrationData.standard.pKb - Math.log10(Math.sqrt(excessBaseConc));
                    pH = 14 - pOH;
                }
            }
        }
        
        // Ensure pH is in valid range and round to 2 decimal places
        pH = Math.max(0, Math.min(14, pH));
        pH = Math.round(pH * 100) / 100;
        
        // Update pH display
        phValueDisplay.textContent = pH.toFixed(2);
        
        // Update indicator color based on pH
        updateIndicatorColor(pH);
        
        // Store pH value and volume for the titration curve
        titrationData.pHValues.push(pH);
        titrationData.volumeAdded.push(volumeAdded);
        
        return pH;
    }
    
    // Update indicator color based on pH
    function updateIndicatorColor(pH) {
        const indicatorProps = INDICATOR_PROPERTIES[titrationData.indicator];
        const [pHLow, pHHigh] = indicatorProps.range;
        const [colorLow, colorHigh] = indicatorProps.colors;
        
        let color;
        if (pH < pHLow) {
            color = colorLow;
        } else if (pH > pHHigh) {
            color = colorHigh;
        } else {
            // In transition range, blend colors
            const percentage = (pH - pHLow) / (pHHigh - pHLow);
            color = blendColors(colorLow, colorHigh, percentage);
        }
        
        // Update indicator display and flask color
        if (color === 'colorless') {
            indicatorColor.style.backgroundColor = '#f0f0f0';
            flaskLiquid.style.backgroundColor = flaskLiquid.style.backgroundColor.replace(/[^,]+(?=\))/, '0.2');
        } else {
            indicatorColor.style.backgroundColor = color;
            
            // Adjust flask color slightly based on indicator
            const flaskBaseColor = titrationData.analyte.type === 'acid' 
                ? 'rgba(52, 152, 219, ' 
                : 'rgba(231, 76, 60, ';
            
            // Blend with indicator color for visual effect
            let indicatorInfluence = '0.5)';
            if (color !== 'colorless') {
                // Extract RGB from color and blend with base
                if (color.startsWith('#')) {
                    const r = parseInt(color.slice(1, 3), 16);
                    const g = parseInt(color.slice(3, 5), 16);
                    const b = parseInt(color.slice(5, 7), 16);
                    indicatorInfluence = `0.5)`;
                    flaskLiquid.style.backgroundColor = flaskBaseColor + indicatorInfluence;
                }
            }
        }
    }
    
    // Blend two colors based on percentage
    function blendColors(color1, color2, percentage) {
        // Handle 'colorless' special case
        if (color1 === 'colorless') color1 = '#f0f0f0';
        if (color2 === 'colorless') color2 = '#f0f0f0';
        
        // Convert hex to RGB
        const parseColor = (color) => {
            if (color.startsWith('#')) {
                const r = parseInt(color.slice(1, 3), 16);
                const g = parseInt(color.slice(3, 5), 16);
                const b = parseInt(color.slice(5, 7), 16);
                return [r, g, b];
            } else {
                return [240, 240, 240]; // Default light gray
            }
        };
        
        const [r1, g1, b1] = parseColor(color1);
        const [r2, g2, b2] = parseColor(color2);
        
        // Blend the colors
        const r = Math.round(r1 + (r2 - r1) * percentage);
        const g = Math.round(g1 + (g2 - g1) * percentage);
        const b = Math.round(b1 + (b2 - b1) * percentage);
        
        // Convert back to hex
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Check if endpoint has been reached
    function checkEndpoint(volumeAdded) {
        const [pHLow, pHHigh] = titrationData.activeIndicatorRange;
        const pH = parseFloat(phValueDisplay.textContent);
        
        // Get estimated endpoint volume
        const estimatedEndpoint = calculateEndpointVolume();
        
        // Check if we're near the estimated endpoint and within indicator range
        if (Math.abs(volumeAdded - estimatedEndpoint) < 0.5 && pH >= pHLow && pH <= pHHigh) {
            // If pH is changing rapidly (derivative of curve is high)
            if (titrationData.pHValues.length >= 3) {
                const n = titrationData.pHValues.length;
                const pH1 = titrationData.pHValues[n - 3];
                const pH2 = titrationData.pHValues[n - 1];
                const vol1 = titrationData.volumeAdded[n - 3];
                const vol2 = titrationData.volumeAdded[n - 1];
                
                // Calculate rate of pH change
                const rate = Math.abs((pH2 - pH1) / (vol2 - vol1));
                
                // If rate is high enough, we've reached the endpoint
                if (rate > 0.5 && !titrationData.endpointDetected) {
                    titrationData.endpointDetected = true;
                    titrationData.endpointVolume = volumeAdded;
                    
                    // Update endpoint display
                    endpointVolumeDisplay.textContent = volumeAdded.toFixed(2) + ' mL';
                    
                    // Calculate analyte concentration
                    calculateAnalyteConcentration(volumeAdded);
                    
                    // Show calculation details
                    calculationDetails.style.display = 'block';
                    
                    // Visual feedback
                    indicatorColor.style.border = '2px solid #2ecc71';
                    
                    // Record this reading automatically with endpoint note
                    recordReading('Endpoint detected');
                }
            }
        }
    }
    
    // Update titration curve
    function updateTitrationCurve(volumeAdded) {
        const pH = parseFloat(phValueDisplay.textContent);
        
        // Add data to the chart
        titrationCurve.data.labels.push(volumeAdded.toFixed(2));
        titrationCurve.data.datasets[0].data.push(pH);
        
        // Mark endpoint if detected
        if (titrationData.endpointDetected && titrationData.endpointVolume === volumeAdded) {
            // Add a vertical line or point highlighting the endpoint
            titrationCurve.data.datasets.push({
                label: 'Endpoint',
                data: [{x: volumeAdded, y: pH}],
                pointBackgroundColor: 'red',
                pointRadius: 6,
                pointHoverRadius: 8,
                showLine: false
            });
        }
        
        // Update chart
        titrationCurve.update();
    }
    
    // Record current reading in the table
    function recordReading(note = '') {
        const volumeAdded = titrationData.buretteVolume - titrationData.currentBuretteReading;
        const pH = parseFloat(phValueDisplay.textContent);
        
        // Create a new row
        const newRow = document.createElement('tr');
        readingCounter++;
        
        // Add cells
        newRow.innerHTML = `
            <td>${readingCounter}</td>
            <td>${volumeAdded.toFixed(2)}</td>
            <td>${pH.toFixed(2)}</td>
            <td>${note}</td>
        `;
        
        // Add to table
        readingsTable.appendChild(newRow);
    }
    
    // Clear readings table
    function clearReadingsTable() {
        readingsTable.innerHTML = '';
        readingCounter = 0;
    }
    
    // Export readings to CSV
    function exportToCsv() {
        // Prepare CSV content
        let csvContent = 'Reading,Volume (mL),pH,Notes\n';
        
        // Get all rows from the table
        const rows = readingsTable.querySelectorAll('tr');
        
        // Convert each row to CSV line
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowData = Array.from(cells).map(cell => `"${cell.textContent}"`).join(',');
            csvContent += rowData + '\n';
        });
        
        // Create a Blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'titration_data.csv');
        link.style.display = 'none';
        
        // Add to document, click and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    // Calculate estimated endpoint volume
    function calculateEndpointVolume() {
        // Get analyte volume in L
        const volumeAnalyte = titrationData.analyteVolume / 1000;
        
        // Calculate volume based on stoichiometry
        // M₁V₁/n₁ = M₂V₂/n₂ => V₂ = M₁V₁n₂/(M₂n₁)
        
        let estimatedVolume;
        if (titrationData.standard.type === 'acid') {
            // Acid titrating base
            estimatedVolume = (titrationData.analyte.concentration * volumeAnalyte * 
                             titrationData.standard.equivalents) / 
                             (titrationData.standard.concentration * titrationData.analyte.equivalents);
        } else {
            // Base titrating acid
            estimatedVolume = (titrationData.analyte.concentration * volumeAnalyte * 
                             titrationData.standard.equivalents) / 
                             (titrationData.standard.concentration * titrationData.analyte.equivalents);
        }
        
        // For simulation purposes, we'll simulate an estimated endpoint
        // This is actually circular since we don't know the analyte concentration yet
        // In a real lab, you would determine this after the titration
        
        // For strong acid/base we can use a simple ratio based on equivalents
        const standardEquivalents = titrationData.standard.equivalents;
        const analyteEquivalents = titrationData.analyte.equivalents;
        
        // Rough estimate assuming equal concentrations
        if (!titrationData.analyte.concentration) {
            // Just for simulator initialization, we'll use the standard concentration
            // This creates a reasonable titration curve for demonstration
            titrationData.analyte.concentration = titrationData.standard.concentration;
            estimatedVolume = (titrationData.analyteVolume * titrationData.analyte.equivalents) / 
                              (standardEquivalents * 1); // Assuming equal concentrations
        }
        
        return estimatedVolume * 1000; // Convert back to mL
    }
    
    // Calculate the analyte concentration from endpoint volume
    function calculateAnalyteConcentration(endpointVolume) {
        // Get volumes and concentrations
        const volumeAnalyte = titrationData.analyteVolume / 1000; // L
        const volumeTitrant = endpointVolume / 1000; // L
        const concTitrant = titrationData.standard.concentration; // mol/L
        
        // Calculate moles of titrant at endpoint
        const molesTitrant = volumeTitrant * concTitrant * titrationData.standard.equivalents;
        
        // Calculate analyte concentration based on stoichiometry
        const analyteConcentration = (molesTitrant) / 
                                   (volumeAnalyte * titrationData.analyte.equivalents);
        
        // Update data and display
        titrationData.analyte.concentration = analyteConcentration;
        analyteConcentrationDisplay.textContent = analyteConcentration.toFixed(3) + ' mol/L';
        
        // Generate calculation steps
        generateCalculationSteps(endpointVolume, analyteConcentration);
    }
    
    // Generate calculation steps for display
    function generateCalculationSteps(endpointVolume, analyteConcentration) {
        const steps = [];
        
        // Step 1: Identify the reaction
        steps.push(`<p><strong>Step 1:</strong> Identify the reaction:</p>`);
        steps.push(`<p>${titrationData.reactionEquation}</p>`);
        
        // Step 2: Calculate moles of standard solution
        steps.push(`<p><strong>Step 2:</strong> Calculate moles of standard solution used:</p>`);
        const volumeTitrant = endpointVolume / 1000; // L
        const molesTitrant = volumeTitrant * titrationData.standard.concentration * titrationData.standard.equivalents;
        steps.push(`<p>n<sub>${titrationData.standard.type}</sub> = C × V = ${titrationData.standard.concentration.toFixed(3)} mol/L × ${volumeTitrant.toFixed(5)} L = ${molesTitrant.toFixed(5)} mol</p>`);
        
        // Step 3: Use stoichiometry to find moles of analyte
        steps.push(`<p><strong>Step 3:</strong> Use stoichiometry to find moles of analyte:</p>`);
        const moleRatio = titrationData.analyte.equivalents / titrationData.standard.equivalents;
        const molesAnalyte = molesTitrant * moleRatio;
        steps.push(`<p>n<sub>${titrationData.analyte.type}</sub> = n<sub>${titrationData.standard.type}</sub> × (${titrationData.analyte.equivalents}/${titrationData.standard.equivalents}) = ${molesTitrant.toFixed(5)} mol × ${moleRatio} = ${molesAnalyte.toFixed(5)} mol</p>`);
        
        // Step 4: Calculate concentration of analyte
        steps.push(`<p><strong>Step 4:</strong> Calculate concentration of analyte:</p>`);
        const volumeAnalyte = titrationData.analyteVolume / 1000; // L
        steps.push(`<p>C<sub>${titrationData.analyte.type}</sub> = n / V = ${molesAnalyte.toFixed(5)} mol / ${volumeAnalyte.toFixed(5)} L = ${analyteConcentration.toFixed(3)} mol/L</p>`);
        
        // Add explanation of endpoint detection
        const indicatorUsed = titrationData.indicator;
        steps.push(`<p><strong>Note:</strong> The endpoint was detected using ${indicatorUsed} indicator at pH ${phValueDisplay.textContent}.</p>`);
        
        // Update the calculation steps display
        calculationStepsContent.innerHTML = steps.join('');
    }
    
    // Reset titration to initial state
    function resetTitration() {
        // Stop any continuous addition
        stopContinuousAddition();
        
        // Clear data
        clearTitrationData();
        
        // Reset lab visuals
        resetLabVisuals();
        
        // Reset displays
        calculateAndUpdatePH(0);
        
        // Clear calculation details
        calculationDetails.style.display = 'none';
        
        // Initialize titration curve
        initializeTitrationCurve();
    }
    
    // Clear titration data
    function clearTitrationData() {
        titrationData.pHValues = [];
        titrationData.volumeAdded = [];
        titrationData.endpointVolume = null;
        titrationData.endpointDetected = false;
        
        // Clear table
        clearReadingsTable();
    }
    
    // Start a new experiment
    function startNewExperiment() {
        // Reset titration
        resetTitration();
        
        // Go back to setup panel
        titrationLab.style.display = 'none';
        setupPanel.style.display = 'block';
    }
    
    // Initialize the app
    function init() {
        // Update solution options based on initial selection
        updateSolutionOptions();
        
        // Initialize event listeners
        initializeEventListeners();
        
        // Open the first collapsible by default
        document.querySelector('.collapsible').click();
    }
    
    // Start the app
    init();
});