document.addEventListener('DOMContentLoaded', function() {
    // Default values
    const DEFAULT_NEIGHBORHOODS = ["Tribeca", "Kips Bay", "Gramercy Park"];
    const DEFAULT_MIN_PRICE = 2500;
    const DEFAULT_MAX_PRICE = 5000;
    const DEFAULT_BEDROOMS = 'any';
    const DEFAULT_BATHROOMS = 'any';
    const DEFAULT_BROKER_FEES = 'fees_ok_if_10pct_cheaper';
    
    // Track if form has been modified from default state
    let formModified = false;
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
    
    // Handle price inputs
    document.getElementById('min-price').addEventListener('input', function() {
        // Ensure min price doesn't exceed max price
        const minPrice = parseInt(this.value);
        const maxPrice = parseInt(document.getElementById('max-price').value);
        
        if (minPrice > maxPrice) {
            document.getElementById('max-price').value = minPrice;
        }
        
        // Check if form has been modified
        updateResetButtonVisibility();
    });
    
    document.getElementById('max-price').addEventListener('input', function() {
        // Ensure max price isn't less than min price
        const maxPrice = parseInt(this.value);
        const minPrice = parseInt(document.getElementById('min-price').value);
        
        if (maxPrice < minPrice) {
            document.getElementById('min-price').value = maxPrice;
        }
        
        // Check if form has been modified
        updateResetButtonVisibility();
    });
    
    // Load neighborhoods data
    fetch('neighborhoods.json')
        .then(response => response.json())
        .then(data => {
            allNeighborhoods = data;
            buildNeighborhoodTree(data);
            
                    // Pre-select default neighborhoods
            DEFAULT_NEIGHBORHOODS.forEach(name => {
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
        // Check if this neighborhood has any children
        const children = data.filter(item => item.parent_id === parent.id);
        
        // Make all neighborhoods selectable for consistency
        parentElement.classList.add('selectable');
        
        if (children.length > 0) {
            // Only add has-children class if it has at least one child
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
            
            // Add expand/collapse functionality for neighborhoods with children
            parentElement.addEventListener('click', function(e) {
                e.stopPropagation();
                
                // Check if we're clicking the selection part or the expand/collapse indicator
                const isExpandClick = e.offsetX > (this.offsetWidth - 20); // Roughly where the triangle is
                
                if (isExpandClick) {
                    // Expand/collapse children
                    this.classList.toggle('expanded');
                    subcategoryContainer.classList.toggle('visible');
                } else {
                    // Select this neighborhood (and implicitly all its children)
                    addSelectedNeighborhood(parent);
                    neighborhoodDropdown.classList.remove('open');
                }
            });
        } else {
            // If it's a leaf node (actual neighborhood), add simple click handler
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
        
        // Create a set to track IDs of neighborhoods to display
        const neighborhoodsToShow = new Set();
        
        // Function to recursively collect all child IDs for a given neighborhood
        function collectAllChildren(neighborhoodId) {
            // Find direct children
            const children = allNeighborhoods.filter(n => n.parent_id === neighborhoodId);
            
            // Add each child and its descendants
            children.forEach(child => {
                neighborhoodsToShow.add(child.id);
                collectAllChildren(child.id); // Recursively find grandchildren, etc.
            });
        }
        
        // For each match, add it and all its children to our display set
        matches.forEach(match => {
            neighborhoodsToShow.add(match.id);
            collectAllChildren(match.id);
        });
        
        // Show all matched neighborhoods, their children, and parent chains
        neighborhoodsToShow.forEach(id => {
            const element = document.querySelector(`.neighborhood-category[data-id="${id}"]`);
            if (element) {
                // Show this element
                element.style.display = '';
                element.classList.add('expanded');
                
                // Show parent chain
                const neighborhood = allNeighborhoods.find(n => n.id === id);
                if (neighborhood) {
                    showParentChain(neighborhood.parent_id);
                }
                
                // Find any subcategories immediately after this element
                const nextElement = element.nextElementSibling;
                if (nextElement && nextElement.classList.contains('neighborhood-subcategory')) {
                    nextElement.classList.add('visible');
                }
            }
        });
        
        // Expand parent categories for all matches
        document.querySelectorAll('.neighborhood-category.expanded').forEach(el => {
            const parentElement = el.closest('.neighborhood-subcategory');
            if (parentElement) {
                parentElement.classList.add('visible');
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
            // Show this parent element
            parentElement.style.display = '';
            parentElement.classList.add('expanded');
            
            // Show subcategory container for this parent
            const nextElement = parentElement.nextElementSibling;
            if (nextElement && nextElement.classList.contains('neighborhood-subcategory')) {
                nextElement.classList.add('visible');
            }
            
            // Make sure this parent element is visible in its container
            const parentContainer = parentElement.closest('.neighborhood-subcategory');
            if (parentContainer) {
                parentContainer.classList.add('visible');
            }
            
            // Continue up the chain
            showParentChain(parent.parent_id);
        }
    }
    
    // Get all child neighborhoods (recursive)
    function getAllChildNeighborhoods(neighborhoodId) {
        const result = [];
        
        // Find direct children
        const directChildren = allNeighborhoods.filter(n => n.parent_id === neighborhoodId);
        
        // Add each child and recursively get its children
        directChildren.forEach(child => {
            result.push(child);
            const childrenOfChild = getAllChildNeighborhoods(child.id);
            result.push(...childrenOfChild);
        });
        
        return result;
    }
    
    // Add a neighborhood to the selected list
    function addSelectedNeighborhood(neighborhood) {
        // Check if already selected (either directly or as part of a parent)
        if (selectedNeighborhoodsList.some(n => n.id === neighborhood.id)) {
            return;
        }
        
        // Get all child neighborhoods
        const childNeighborhoods = getAllChildNeighborhoods(neighborhood.id);
        
        // Create a virtual selection that includes this neighborhood and all its children
        const virtualSelection = [neighborhood, ...childNeighborhoods];
        
        // Get currently selected neighborhood IDs for quick lookup
        const currentlySelectedIds = new Set(selectedNeighborhoodsList.map(n => n.id));
        
        // Filter out any neighborhoods that are already selected
        const newSelections = virtualSelection.filter(n => !currentlySelectedIds.has(n.id));
        
        // Add to the selected list (will be sent to API)
        selectedNeighborhoodsList.push(...newSelections);
        updateSelectedNeighborhoodsInput();
        
        // Check if form has been modified
        updateResetButtonVisibility();
        
        // Create UI element (only show the parent in the UI)
        const item = document.createElement('div');
        item.className = 'selected-item';
        
        // If it has children, indicate this is a group selection
        const childCount = childNeighborhoods.length;
        const childLabel = childCount > 0 ? 
            `<span class="child-indicator" title="Includes ${childCount} sub-neighborhoods">+${childCount}</span>` : '';
            
        item.innerHTML = `
            ${neighborhood.name} ${childLabel}
            <span class="remove" data-id="${neighborhood.id}" data-is-parent="${childCount > 0}">×</span>
        `;
        selectedNeighborhoods.appendChild(item);
        
        // Add remove event
        item.querySelector('.remove').addEventListener('click', function() {
            const idToRemove = parseInt(this.getAttribute('data-id'));
            const isParent = this.getAttribute('data-is-parent') === 'true';
            removeSelectedNeighborhood(idToRemove, isParent);
        });
    }
    
    // Remove a neighborhood from the selected list
    function removeSelectedNeighborhood(id, isParent = false) {
        if (isParent) {
            // If removing a parent, also remove all its children
            const childrenToRemove = getAllChildNeighborhoods(id);
            const idsToRemove = new Set([id, ...childrenToRemove.map(child => child.id)]);
            
            // Filter out this neighborhood and all its children
            selectedNeighborhoodsList = selectedNeighborhoodsList.filter(n => !idsToRemove.has(n.id));
        } else {
            // Just remove the single neighborhood
            selectedNeighborhoodsList = selectedNeighborhoodsList.filter(n => n.id !== id);
        }
        
        updateSelectedNeighborhoodsInput();
        
        // Remove the UI element
        const item = selectedNeighborhoods.querySelector(`.selected-item .remove[data-value="${id}"]`) || 
                    selectedNeighborhoods.querySelector(`.selected-item .remove[data-id="${id}"]`);
        if (item && item.parentNode) {
            item.parentNode.remove();
        }
        
        // Check if form has been modified
        updateResetButtonVisibility();
    }
    
    // Update the hidden input with selected neighborhoods
    function updateSelectedNeighborhoodsInput() {
        selectedNeighborhoodsInput.value = JSON.stringify(
            selectedNeighborhoodsList.map(n => n.name)
        );
    }
    
    // Function to check if form has been modified from defaults
    function checkFormModified() {
        // Check neighborhoods
        if (selectedNeighborhoodsList.length !== DEFAULT_NEIGHBORHOODS.length) {
            return true;
        }
        
        // Check if all default neighborhoods are selected
        const selectedNames = selectedNeighborhoodsList.map(n => n.name);
        for (const name of DEFAULT_NEIGHBORHOODS) {
            if (!selectedNames.includes(name)) {
                return true;
            }
        }
        
        // Check price inputs
        if (parseInt(document.getElementById('min-price').value) !== DEFAULT_MIN_PRICE ||
            parseInt(document.getElementById('max-price').value) !== DEFAULT_MAX_PRICE) {
            return true;
        }
        
        // Check bedrooms
        if (document.getElementById('bedrooms-min').value !== DEFAULT_BEDROOMS ||
            document.getElementById('bedrooms-max').value !== DEFAULT_BEDROOMS) {
            return true;
        }
        
        // Check bathrooms
        if (document.getElementById('min-bathroom').value !== DEFAULT_BATHROOMS) {
            return true;
        }
        
        // Check broker fees
        if (document.getElementById('broker-fees').value !== DEFAULT_BROKER_FEES) {
            return true;
        }
        
        return false;
    }
    
    // Function to update reset button visibility
    function updateResetButtonVisibility() {
        if (checkFormModified()) {
            resetBtn.classList.remove('reset-hidden');
            formModified = true;
        } else {
            resetBtn.classList.add('reset-hidden');
            formModified = false;
        }
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
                // Check if form was already in default state before this change
                const wasDefault = !formModified;
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
                
                // If form was in default state, check if it's been modified
                if (wasDefault) {
                    updateResetButtonVisibility();
                } else {
                    // Form was already modified, keep reset button visible
                    resetBtn.classList.remove('reset-hidden');
                }
            });
        });
        
        // Bathrooms buttons
        const bathroomButtons = document.querySelectorAll('.bathrooms-group .option-button');
        const minBathroomInput = document.getElementById('min-bathroom');
        
        bathroomButtons.forEach(button => {
            button.addEventListener('click', function() {
                // Check if form was already in default state before this change
                const wasDefault = !formModified;
                // Handle selection
                const value = this.dataset.value;
                
                // Remove selection from all buttons
                bathroomButtons.forEach(btn => btn.classList.remove('selected'));
                
                // Add selection to clicked button
                this.classList.add('selected');
                
                // Update hidden input
                minBathroomInput.value = value;
                
                // If form was in default state, check if it's been modified
                if (wasDefault) {
                    updateResetButtonVisibility();
                } else {
                    // Form was already modified, keep reset button visible
                    resetBtn.classList.remove('reset-hidden');
                }
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
                // Check if form was already in default state before this change
                const wasDefault = !formModified;
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
                
                // If form was in default state, check if it's been modified
                if (wasDefault) {
                    updateResetButtonVisibility();
                } else {
                    // Form was already modified, keep reset button visible
                    resetBtn.classList.remove('reset-hidden');
                }
            });
        });
    }
    
    // Get reset button element
    const resetBtn = document.getElementById('reset-btn');
    
    // Initially hide the reset button
    resetBtn.classList.add('reset-hidden');
    
    // Handle Reset button click
    resetBtn.addEventListener('click', function() {
        resetToDefaults();
    });
    
    // Function to reset form to default values
    function resetToDefaults() {
        // Temporarily disable update checks while resetting
        const originalAddSelectedNeighborhood = addSelectedNeighborhood;
        
        // Override the function to prevent visibility updates during reset
        addSelectedNeighborhood = function(neighborhood) {
            // Add to the selected list
            selectedNeighborhoodsList.push(neighborhood);
            updateSelectedNeighborhoodsInput();
            
            // Create UI element
            const item = document.createElement('div');
            item.className = 'selected-item';
            
            const text = document.createElement('span');
            text.textContent = neighborhood.name;
            
            const remove = document.createElement('span');
            remove.className = 'remove';
            remove.setAttribute('data-id', neighborhood.id);
            remove.textContent = '×';
            remove.addEventListener('click', function() {
                removeSelectedNeighborhood(neighborhood.id);
            });
            
            item.appendChild(text);
            item.appendChild(remove);
            selectedNeighborhoods.appendChild(item);
        };
        
        // Reset neighborhoods
        selectedNeighborhoodsList = [];
        selectedNeighborhoods.innerHTML = '';
        
        // Re-add default neighborhoods
        DEFAULT_NEIGHBORHOODS.forEach(name => {
            const neighborhood = allNeighborhoods.find(n => n.name === name);
            if (neighborhood) {
                addSelectedNeighborhood(neighborhood);
            }
        });
        
        // Reset price inputs
        document.getElementById('min-price').value = DEFAULT_MIN_PRICE;
        document.getElementById('max-price').value = DEFAULT_MAX_PRICE;
        
        // Reset bedrooms
        const bedroomButtons = document.querySelectorAll('.bedrooms-group .option-button');
        bedroomButtons.forEach(btn => btn.classList.remove('selected'));
        document.querySelector('.bedrooms-group .option-button[data-value="any"]').classList.add('selected');
        document.getElementById('bedrooms-min').value = DEFAULT_BEDROOMS;
        document.getElementById('bedrooms-max').value = DEFAULT_BEDROOMS;
        
        // Reset bathrooms
        const bathroomButtons = document.querySelectorAll('.bathrooms-group .option-button');
        bathroomButtons.forEach(btn => btn.classList.remove('selected'));
        document.querySelector('.bathrooms-group .option-button[data-value="any"]').classList.add('selected');
        document.getElementById('min-bathroom').value = DEFAULT_BATHROOMS;
        
        // Reset broker fees
        const brokerFeesOptions = document.querySelectorAll('#broker-fees-dropdown .option');
        brokerFeesOptions.forEach(opt => opt.classList.remove('selected'));
        document.querySelector('#broker-fees-dropdown .option[data-value="' + DEFAULT_BROKER_FEES + '"]').classList.add('selected');
        document.getElementById('broker-fees').value = DEFAULT_BROKER_FEES;
        document.getElementById('broker-fees-display').textContent = document.querySelector('#broker-fees-dropdown .option[data-value="' + DEFAULT_BROKER_FEES + '"]').textContent;
        
        // Hide results
        resultSection.classList.add('result-hidden');
        errorSection.classList.add('error-hidden');
        
        // Hide reset button
        resetBtn.classList.add('reset-hidden');
        formModified = false;
        
        // Restore original function
        addSelectedNeighborhood = originalAddSelectedNeighborhood;
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
            // Include all bedrooms (1 through 10 for "Any" option)
            bedrooms = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        } else {
            // Get all selected bedroom buttons
            const selectedButtons = document.querySelectorAll('.bedrooms-group .option-button.selected');
            
            // If only one button is selected and it's not 'any'
            if (selectedButtons.length === 1) {
                const btnValue = selectedButtons[0].dataset.value;
                // Handle 4+ option specially
                if (btnValue === '4') {
                    // For 4+ bedrooms, include 4 through 10
                    bedrooms = [4, 5, 6, 7, 8, 9, 10];
                } else {
                    // Single bedroom selection (Studio=0, or 1,2,3)
                    bedrooms = [parseInt(btnValue)];
                }
            } else if (parseInt(bedroomsMin) === parseInt(bedroomsMax)) {
                // Single bedroom selection from range
                const bedroomValue = parseInt(bedroomsMin);
                // Handle 4+ option specially
                if (bedroomValue === 4) {
                    // For 4+ bedrooms, include 4 through 10
                    bedrooms = [4, 5, 6, 7, 8, 9, 10];
                } else {
                    bedrooms = [bedroomValue];
                }
            } else {
                // Range of bedrooms
                for (let i = parseInt(bedroomsMin); i <= parseInt(bedroomsMax); i++) {
                    bedrooms.push(i);
                }
                // If range ends with 4+, add 5 through 10
                if (parseInt(bedroomsMax) === 4) {
                    bedrooms.push(5, 6, 7, 8, 9, 10);
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
        
        // Use the API implementation
            // Use the user's provided fetch implementation
            const myHeaders = new Headers();
            myHeaders.append("Content-Type", "application/json");
            
            const requestOptions = {
              method: "POST",
              headers: myHeaders,
              body: JSON.stringify(data),
              redirect: "follow"
            };
            
            fetch(API_URL, requestOptions)
              .then(response => {
                  console.log('API Response status:', response.status);
                  
                  if (!response.ok) {
                      throw new Error(`API error (${response.status})`);
                  }
                  return response.text();
              })
              .then(result => {
                  console.log('API result:', result);
                  
                  // Try to parse the result as JSON
                  let parsedResult;
                  try {
                      parsedResult = JSON.parse(result);
                  } catch (e) {
                      // If it's not JSON, try to extract a number directly
                      const numberMatch = result.match(/[\d\.]+/);
                      if (numberMatch) {
                          parsedResult = parseFloat(numberMatch[0]);
                      } else {
                          throw new Error('Could not parse API response');
                      }
                  }
                  
                  // The API returns a number directly or might return it in a property
                  // Check if the API response is null (no listings met the search criteria)
                  if (parsedResult === null) {
                      loadingSection.classList.add('loading-hidden');
                      showError('No listings found that match your search criteria. Please try different parameters.');
                      return;
                  }
                  
                  let avgListings;
                  if (typeof parsedResult === 'number') {
                      avgListings = parsedResult;
                  } else if (parsedResult && typeof parsedResult.avg_listings_per_day === 'number') {
                      avgListings = parsedResult.avg_listings_per_day;
                  } else if (parsedResult && typeof parsedResult.result === 'number') {
                      avgListings = parsedResult.result;
                  } else {
                      // Try to find a number in the response
                      const firstNumericValue = Object.values(parsedResult).find(val => typeof val === 'number');
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
                  showError('Error connecting to API. Please try again later.');
              });
    });
    
    function showError(message) {
        loadingSection.classList.add('loading-hidden');
        errorSection.classList.remove('error-hidden');
        errorSection.querySelector('p').textContent = message;
    }
});
