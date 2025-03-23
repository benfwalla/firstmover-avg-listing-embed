document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const form = document.getElementById('listing-form');
    const neighborhoodSearch = document.getElementById('neighborhood-search');
    const neighborhoodDropdown = document.getElementById('neighborhood-dropdown');
    const neighborhoodList = document.querySelector('.neighborhood-list');
    const selectedNeighborhoods = document.querySelector('.selected-neighborhoods');
    const selectedNeighborhoodsInput = document.getElementById('selected-neighborhoods-input');
    const resultSection = document.getElementById('result');
    const avgListingsElement = document.getElementById('avg-listings');
    const loadingSection = document.getElementById('loading');
    const errorSection = document.getElementById('error');
    
    // State
    let allNeighborhoods = [];
    let selectedNeighborhoodsList = [];
    
    // API endpoint
    const API_URL = 'https://firstmover-fast-api.vercel.app/getAvgListingsLast14Days';
    
    // Initialize bedrooms and bathrooms buttons
    initializeOptionButtons();
    
    // Load neighborhoods data
    fetch('neighborhoods.json')
        .then(response => response.json())
        .then(data => {
            allNeighborhoods = data;
            buildNeighborhoodTree(data);
            
            // Pre-select default neighborhoods
            const defaultNeighborhoods = ["Tribeca", "Kips Bay", "Gramercy Park"];
            defaultNeighborhoods.forEach(name => {
                const neighborhood = data.find(n => n.name === name);
                if (neighborhood) {
                    addSelectedNeighborhood(neighborhood);
                }
            });
        })
        .catch(error => {
            console.error('Error loading neighborhoods:', error);
        });
    
    // Handle neighborhood dropdown toggle
    document.getElementById('show-neighborhood-dropdown').addEventListener('click', function() {
        neighborhoodDropdown.classList.toggle('open');
        if (neighborhoodDropdown.classList.contains('open')) {
            neighborhoodSearch.focus();
        }
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.neighborhood-selector')) {
            neighborhoodDropdown.classList.remove('open');
        }
    });
    
    // Handle neighborhood search
    neighborhoodSearch.addEventListener('input', function() {
        const searchTerm = this.value;
        filterNeighborhoods(searchTerm);
    });
    
    // Focus on search input opens dropdown
    neighborhoodSearch.addEventListener('focus', function() {
        neighborhoodDropdown.classList.add('open');
    });
    
    // Build neighborhood tree from JSON data
    function buildNeighborhoodTree(data) {
        // Clear existing content
        neighborhoodList.innerHTML = '';
        
        // Get top-level categories (boroughs)
        const topLevelItems = data.filter(item => item.parent_id === 0 || item.parent_id === 1);
        
        // Build the tree
        topLevelItems.forEach(item => {
            if (item.name === 'NYC and NJ') return; // Skip the root item
            
            const categoryElement = createCategoryElement(item);
            neighborhoodList.appendChild(categoryElement);
            
            // Add children recursively
            addChildrenRecursively(item, categoryElement, data);
        });
    }
    
    // Add children recursively to build the tree
    function addChildrenRecursively(parent, parentElement, data) {
        const children = data.filter(item => item.parent_id === parent.id);
        
        if (children.length > 0) {
            parentElement.classList.add('has-children');
            
            const subcategoryContainer = document.createElement('div');
            subcategoryContainer.className = 'neighborhood-subcategory';
            parentElement.insertAdjacentElement('afterend', subcategoryContainer);
            
            children.forEach(child => {
                const childElement = createCategoryElement(child);
                subcategoryContainer.appendChild(childElement);
                
                // Recursively add children of this child
                addChildrenRecursively(child, childElement, data);
            });
            
            // Toggle children visibility when parent is clicked
            parentElement.addEventListener('click', function(e) {
                e.stopPropagation();
                this.classList.toggle('expanded');
                subcategoryContainer.classList.toggle('visible');
            });
        } else {
            // If it's a leaf node (actual neighborhood), add click handler to select it
            parentElement.addEventListener('click', function(e) {
                e.stopPropagation();
                addSelectedNeighborhood(parent);
                neighborhoodDropdown.classList.remove('open');
            });
        }
    }
    
    // Create a category element for the neighborhood tree
    function createCategoryElement(item) {
        const element = document.createElement('div');
        element.className = 'neighborhood-category';
        element.textContent = item.name;
        element.dataset.id = item.id;
        return element;
    }
    
    // Filter neighborhoods based on search term
    function filterNeighborhoods(searchTerm) {
        const categories = document.querySelectorAll('.neighborhood-category');
        const subcategories = document.querySelectorAll('.neighborhood-subcategory');
        
        // Reset visibility
        categories.forEach(cat => cat.style.display = '');
        subcategories.forEach(subcat => subcat.classList.remove('visible'));
        
        if (!searchTerm) {
            return;
        }
        
        // Hide all categories initially
        categories.forEach(cat => cat.style.display = 'none');
        
        // Find matching neighborhoods
        const matches = allNeighborhoods.filter(n => 
            n.name.toLowerCase().includes(searchTerm.toLowerCase()));
        
        // Show matching neighborhoods and their parents
        matches.forEach(match => {
            const matchElement = document.querySelector(`.neighborhood-category[data-id="${match.id}"]`);
            if (matchElement) {
                // Show this element
                matchElement.style.display = '';
                
                // Show parent chain
                showParentChain(match.parent_id);
                
                // Expand parent categories to show matches
                const parentElement = matchElement.closest('.neighborhood-subcategory');
                if (parentElement) {
                    parentElement.classList.add('visible');
                }
            }
        });
        
        // Open the dropdown if we have matches
        if (matches.length > 0) {
            neighborhoodDropdown.classList.add('open');
        }
    }
    
    // Recursively show parent chain for a neighborhood
    function showParentChain(parentId) {
        if (!parentId) return;
        
        const parent = allNeighborhoods.find(n => n.id === parentId);
        if (!parent) return;
        
        const parentElement = document.querySelector(`.neighborhood-category[data-id="${parent.id}"]`);
        if (parentElement) {
            parentElement.style.display = '';
            
            // Show subcategory container
            const nextElement = parentElement.nextElementSibling;
            if (nextElement && nextElement.classList.contains('neighborhood-subcategory')) {
                nextElement.classList.add('visible');
            }
            
            // Continue up the chain
            showParentChain(parent.parent_id);
        }
    }
    
    // Add a neighborhood to the selected list
    function addSelectedNeighborhood(neighborhood) {
        // Check if already selected
        if (selectedNeighborhoodsList.some(n => n.id === neighborhood.id)) {
            return;
        }
        
        // Add to the selected list
        selectedNeighborhoodsList.push(neighborhood);
        updateSelectedNeighborhoodsInput();
        
        // Create UI element
        const item = document.createElement('div');
        item.className = 'selected-item';
        item.innerHTML = `
            ${neighborhood.name}
            <span class="remove" data-id="${neighborhood.id}">×</span>
        `;
        selectedNeighborhoods.appendChild(item);
        
        // Add remove event
        item.querySelector('.remove').addEventListener('click', function() {
            const idToRemove = parseInt(this.getAttribute('data-id'));
            removeSelectedNeighborhood(idToRemove);
        });
    }
    
    // Remove a neighborhood from the selected list
    function removeSelectedNeighborhood(id) {
        selectedNeighborhoodsList = selectedNeighborhoodsList.filter(n => n.id !== id);
        updateSelectedNeighborhoodsInput();
        
        const item = selectedNeighborhoods.querySelector(`.selected-item .remove[data-id="${id}"]`).parentNode;
        item.remove();
    }
    
    // Update the hidden input with selected neighborhoods
    function updateSelectedNeighborhoodsInput() {
        selectedNeighborhoodsInput.value = JSON.stringify(
            selectedNeighborhoodsList.map(n => n.name)
        );
    }
    
    // Initialize the buttons for bedrooms and bathrooms
    function initializeOptionButtons() {
        // Bedrooms buttons
        const bedroomButtons = document.querySelectorAll('.bedrooms-group .option-button');
        const bedroomsMinInput = document.getElementById('bedrooms-min');
        const bedroomsMaxInput = document.getElementById('bedrooms-max');
        let selectedBedrooms = ['any']; // Start with 'any' selected
        
        bedroomButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Handle selection
                const value = this.dataset.value;
                
                if (value === 'any') {
                    // If 'Any' is clicked, deselect all other options
                    bedroomButtons.forEach(btn => btn.classList.remove('selected'));
                    this.classList.add('selected');
                    selectedBedrooms = ['any'];
                } else {
                    // If a specific bedroom option is clicked
                    const anyButton = document.querySelector('.bedrooms-group .option-button[data-value="any"]');
                    
                    // Remove 'any' from selection if it's currently selected
                    if (selectedBedrooms.includes('any')) {
                        selectedBedrooms = [];
                        anyButton.classList.remove('selected');
                    }
                    
                    // Toggle the clicked option
                    if (this.classList.contains('selected')) {
                        // If already selected, deselect it
                        this.classList.remove('selected');
                        selectedBedrooms = selectedBedrooms.filter(b => b !== value);
                    } else {
                        // If not selected, select it
                        this.classList.add('selected');
                        selectedBedrooms.push(value);
                    }
                    
                    // If all options are selected or none are selected, switch to 'Any'
                    if (selectedBedrooms.length === 0 || selectedBedrooms.length === 5) {
                        bedroomButtons.forEach(btn => btn.classList.remove('selected'));
                        anyButton.classList.add('selected');
                        selectedBedrooms = ['any'];
                    }
                }
                
                // Update hidden inputs based on selected bedrooms
                if (selectedBedrooms.includes('any')) {
                    bedroomsMinInput.value = 'any';
                    bedroomsMaxInput.value = 'any';
                } else {
                    // Convert to numbers and sort
                    const numericBedrooms = selectedBedrooms.map(b => parseInt(b)).sort((a, b) => a - b);
                    bedroomsMinInput.value = numericBedrooms[0];
                    bedroomsMaxInput.value = numericBedrooms[numericBedrooms.length - 1];
                }
            });
        });
        
        // Bathrooms buttons
        const bathroomButtons = document.querySelectorAll('.bathrooms-group .option-button');
        const minBathroomInput = document.getElementById('min-bathroom');
        
        bathroomButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Handle selection
                const value = this.dataset.value;
                
                // Remove selection from all buttons
                bathroomButtons.forEach(btn => btn.classList.remove('selected'));
                
                // Add selection to clicked button
                this.classList.add('selected');
                
                // Update hidden input
                minBathroomInput.value = value;
            });
        });
        
        // Broker fees custom select
        const brokerFeesDisplay = document.getElementById('broker-fees-display');
        const brokerFeesDropdown = document.getElementById('broker-fees-dropdown');
        const brokerFeesInput = document.getElementById('broker-fees');
        const brokerFeesContainer = brokerFeesDisplay.closest('.custom-select');
        const brokerFeesOptions = brokerFeesDropdown.querySelectorAll('.option');
        
        // Toggle dropdown
        brokerFeesDisplay.addEventListener('click', function() {
            brokerFeesContainer.classList.toggle('open');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.custom-select')) {
                brokerFeesContainer.classList.remove('open');
            }
        });
        
        // Handle option selection
        brokerFeesOptions.forEach(option => {
            option.addEventListener('click', function() {
                const value = this.dataset.value;
                const text = this.textContent;
                
                // Update display and hidden input
                brokerFeesDisplay.textContent = text;
                brokerFeesInput.value = value;
                
                // Update selected class
                brokerFeesOptions.forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
                
                // Close dropdown
                brokerFeesContainer.classList.remove('open');
            });
        });
    }
    
    // Handle form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Show loading
        loadingSection.classList.remove('loading-hidden');
        resultSection.classList.add('result-hidden');
        errorSection.classList.add('error-hidden');
        
        // Get form values
        const neighborhoods = selectedNeighborhoodsList.map(n => n.name);
        const minPrice = document.getElementById('min-price').value;
        const maxPrice = document.getElementById('max-price').value;
        const bedroomsMin = document.getElementById('bedrooms-min').value;
        const bedroomsMax = document.getElementById('bedrooms-max').value;
        const minBathroom = document.getElementById('min-bathroom').value;
        const brokerFees = document.getElementById('broker-fees').value;
        
        // Convert bedroom values for API
        let bedrooms = [];
        if (bedroomsMin === 'any') {
            // Include all bedrooms (0-4+)
            bedrooms = [0, 1, 2, 3, 4];
        } else {
            // Get all selected bedroom buttons
            const selectedButtons = document.querySelectorAll('.bedrooms-group .option-button.selected');
            
            // If only one button is selected and it's not 'any'
            if (selectedButtons.length === 1 && selectedButtons[0].dataset.value !== 'any') {
                // Single bedroom selection
                bedrooms = [parseInt(selectedButtons[0].dataset.value)];
            } else if (parseInt(bedroomsMin) === parseInt(bedroomsMax)) {
                // Single bedroom selection from range
                bedrooms = [parseInt(bedroomsMin)];
            } else {
                // Range of bedrooms
                for (let i = parseInt(bedroomsMin); i <= parseInt(bedroomsMax); i++) {
                    bedrooms.push(i);
                }
            }
        }
        
        // Convert bathroom value for API
        const minBathroomValue = minBathroom === 'any' ? 0 : parseFloat(minBathroom);
        
        // Check if at least one neighborhood is selected
        if (neighborhoods.length === 0) {
            showError('Please select at least one neighborhood');
            return;
        }
        
        // Prepare data for API
        const data = {
            neighborhood_names: neighborhoods,
            min_price: parseInt(minPrice),
            max_price: parseInt(maxPrice),
            bedrooms: bedrooms,
            min_bathroom: minBathroomValue,
            broker_fees: brokerFees
        };
        
        // Log request data for debugging
        console.log('Sending request with data:', data);
        
        // Use mock data for local testing due to CORS restrictions
        const useMockData = false;
        
        if (useMockData) {
            // Simulate API call with mock data based on selected neighborhoods
            setTimeout(() => {
                // Always use 4.2 for the memes
                const mockResult = 4.2;
                
                // Display result
                loadingSection.classList.add('loading-hidden');
                resultSection.classList.remove('result-hidden');
                avgListingsElement.textContent = mockResult.toFixed(1); // Always show with 1 decimal place
                
                // Add a note about mock data (only if it doesn't exist already)
                const existingNote = document.querySelector('.mock-data-note');
                if (!existingNote) {
                    const mockDataNote = document.createElement('small');
                    mockDataNote.className = 'mock-data-note';
                    mockDataNote.textContent = '(Using sample data for demonstration)';
                    mockDataNote.style.fontSize = '11px';
                    mockDataNote.style.color = '#888';
                    mockDataNote.style.display = 'block';
                    mockDataNote.style.marginTop = '5px';
                    mockDataNote.style.textAlign = 'center';
                    resultSection.querySelector('.result-content').appendChild(mockDataNote);
                }
                
                console.log('Using mock data. To use real API, set useMockData = false');
            }, 800);
        } else {
            // Make real API request
            fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data),
                mode: 'cors'
            })
            .then(response => {
                // Log full response for debugging
                console.log('API Response status:', response.status);
                
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`API error (${response.status}): ${text}`);
                    });
                }
                return response.json();
            })
            .then(result => {
                console.log('API result:', result);
                
                // The API returns a number directly or might return it in a property
                let avgListings;
                if (typeof result === 'number') {
                    avgListings = result;
                } else if (result && typeof result.avg_listings_per_day === 'number') {
                    avgListings = result.avg_listings_per_day;
                } else if (result && typeof result.result === 'number') {
                    avgListings = result.result;
                } else {
                    // Try to find a number in the response
                    const firstNumericValue = Object.values(result).find(val => typeof val === 'number');
                    if (firstNumericValue !== undefined) {
                        avgListings = firstNumericValue;
                    } else {
                        throw new Error('Could not find a numeric value in the API response');
                    }
                }
                
                // Display result
                loadingSection.classList.add('loading-hidden');
                resultSection.classList.remove('result-hidden');
                avgListingsElement.textContent = avgListings.toFixed(1); // Always show with 1 decimal place
            })
            .catch(error => {
                console.error('Error fetching data:', error);
                console.log('Request data was:', data);
                
                showError('API connection issue. Please try again later or contact support.');
            });
        }
    });
    
    function showError(message) {
        loadingSection.classList.add('loading-hidden');
        errorSection.classList.remove('error-hidden');
        errorSection.querySelector('p').textContent = message;
    }
});
