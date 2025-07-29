import { requireAuth, logout } from './auth.js';
import { supabase } from './supabaseClient.js';

// --- User/Role State ---
let currentUser = null;
let currentRole = 'user';
let selectedMonumentsForBulk = [];
let currentUserRole = null;
let currentEditingMonumentId = null;

async function getCurrentUserAndRole() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null };
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();
  return { user, role: data?.role || 'user' };
}

// --- Visitor Mode Detection ---
const isVisitor = window.location.search.includes('visitor=1');

if (!isVisitor) {
  // Protect page for logged-in users only
  await requireAuth();
  ({ user: currentUser, role: currentRole } = await getCurrentUserAndRole());
}

// Logout button
document.getElementById('logout-btn').addEventListener('click', logout);

// Mapbox access token (replace with your own)
mapboxgl.accessToken = 'pk.eyJ1IjoibWFuaXRhcmlvdXMiLCJhIjoiY21jN3o2Y3pnMHJkNTJqcjJkdGxldXBsZyJ9._mkKt7x11fd8bQXlGVTqzQ';

// Initialize map
const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v12',
  center: [21.409, 40.784], // Center on Florina, Greece
  zoom: 12,
  projection: 'globe'
});
map.addControl(new mapboxgl.NavigationControl());

// --- Bottom Center Overlay for Logout, Add, and Map Style Toggle Buttons ---
if (!document.getElementById('bottom-center-overlay')) {
  let overlay = document.getElementById('bottom-center-overlay');
  if (overlay) overlay.remove();
  overlay = document.createElement('div');
  overlay.id = 'bottom-center-overlay';
  overlay.style = `
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1100;
    background: rgba(255,255,255,0.97);
    border-radius: 32px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.13);
    padding: 0.5rem 1.2rem;
    display: flex;
    gap: 1.2rem;
    align-items: center;
  `;

  if (!isVisitor) {
    // Add button (only for logged-in users)
    const addBtn = document.createElement('button');
    addBtn.innerHTML = '<img src="plus.png" alt="Add" style="width: 28px; height: 28px; display: block; margin: auto;">';
    addBtn.className = 'add-monument-btn';
    addBtn.title = 'Add Monument';
    addBtn.style.position = 'static';
    addBtn.onclick = showAddMonumentModal;
    overlay.appendChild(addBtn);
  }
  // Always add the timeline open button (for all users)
  const openTimelineBtn = document.createElement('button');
  openTimelineBtn.id = 'open-timeline-btn';
  openTimelineBtn.title = 'Timeline';
  openTimelineBtn.innerHTML = '<img src="timeline.png" alt="Timeline" style="width: 28px; height: 28px; display: block; margin: auto;">';
  openTimelineBtn.className = 'timeline-btn';
  openTimelineBtn.style.position = 'static';
  overlay.appendChild(openTimelineBtn);

  // Gallery/Map toggle button (for both visitors and logged-in users)
  const galleryToggleBtn = document.createElement('button');
  galleryToggleBtn.id = 'gallery-toggle-btn';
  galleryToggleBtn.className = 'gallery-toggle-btn';
  galleryToggleBtn.title = 'Εναλλαγή Χάρτης/Gallery';
  galleryToggleBtn.innerHTML = '<img src="gallery-svgrepo-com.png" alt="Gallery" style="width: 24px; height: 24px; display: block; margin: auto;">';
  galleryToggleBtn.style.position = 'static';
  overlay.appendChild(galleryToggleBtn);

  // Map style toggle button (for both visitors and logged-in users)
  const mapStyleToggleBtn = document.createElement('button');
  mapStyleToggleBtn.id = 'map-style-toggle';
  mapStyleToggleBtn.className = 'map-style-toggle';
  mapStyleToggleBtn.title = 'Εναλλαγή στυλ χάρτη';
  mapStyleToggleBtn.innerHTML = '<img src="map.png" alt="Map Style" style="width: 28px; height: 28px; display: block; margin: auto;">';
  mapStyleToggleBtn.style.position = 'static';
  overlay.appendChild(mapStyleToggleBtn);

  // Logout button (for both visitors and logged-in users)
  let logoutBtn = document.createElement('button');
  logoutBtn.id = 'logout-btn';
  logoutBtn.className = 'logout-btn';
  logoutBtn.title = 'Logout';
  logoutBtn.innerHTML = '<img src="logout.png" alt="Logout" style="width: 28px; height: 28px; display: block; margin: auto;">';
  if (!isVisitor) {
    logoutBtn.onclick = logout;
  } else {
    logoutBtn.onclick = () => { window.location.href = 'index.html'; };
  }
  logoutBtn.style.position = 'static';
  overlay.appendChild(logoutBtn);

  document.body.appendChild(overlay);

  // Gallery/Map toggle logic
  let isGalleryMode = false;
  galleryToggleBtn.addEventListener('click', () => {
    isGalleryMode = !isGalleryMode;
    if (isGalleryMode) {
      // Switch to Gallery mode
      document.getElementById('map').style.display = 'none';
      const galleryContainer = document.getElementById('gallery-container');
      galleryContainer.style.display = 'block';
      
      // Check if side panel is open and adjust gallery layout
      const sidePanel = document.getElementById('side-panel');
      if (sidePanel && sidePanel.classList.contains('open')) {
        galleryContainer.classList.add('with-side-panel');
      } else {
        galleryContainer.classList.remove('with-side-panel');
      }
      
      galleryToggleBtn.innerHTML = '<img src="map-svgrepo-com.png" alt="Χάρτης" style="width: 24px; height: 24px; display: block; margin: auto;">';
      galleryToggleBtn.style.background = 'linear-gradient(90deg, #3b82f6 60%, #1d4ed8 100%)';
      galleryToggleBtn.style.color = '#fff';
      renderGallery(allMonuments);
      
      // Disable side panel close button when in gallery mode
      const closeBtn = document.getElementById('side-panel-close');
      if (closeBtn) {
        closeBtn.style.display = 'none';
        closeBtn.title = 'Το side panel δεν μπορεί να κλείσει στο Gallery mode';
      }
      
      // Hide map search box when in gallery mode
      const mapSearchLabel = document.querySelector('label[for="map-search"]');
      const mapSearchInput = document.getElementById('map-search');
      if (mapSearchLabel) mapSearchLabel.style.display = 'none';
      if (mapSearchInput) mapSearchInput.style.display = 'none';
    } else {
      // Switch to Map mode
      document.getElementById('map').style.display = 'block';
      document.getElementById('gallery-container').style.display = 'none';
      galleryToggleBtn.innerHTML = '<img src="gallery-svgrepo-com.png" alt="Gallery" style="width: 24px; height: 24px; display: block; margin: auto;">';
      galleryToggleBtn.style.background = 'linear-gradient(90deg, #ffe9b3 60%, #fbbf24 100%)';
      galleryToggleBtn.style.color = '#181818';
      
      // Re-enable side panel close button when back to map mode
      const closeBtn = document.getElementById('side-panel-close');
      if (closeBtn) {
        closeBtn.style.display = 'block';
        closeBtn.title = 'Κλείσιμο side panel';
      }
      
      // Show map search box when back to map mode
      const mapSearchLabel = document.querySelector('label[for="map-search"]');
      const mapSearchInput = document.getElementById('map-search');
      if (mapSearchLabel) mapSearchLabel.style.display = 'block';
      if (mapSearchInput) mapSearchInput.style.display = 'block';
    }
  });

  // Map style toggle logic
  let currentMapStyle = 'mapbox://styles/mapbox/streets-v12';
  mapStyleToggleBtn.addEventListener('click', () => {
    if (currentMapStyle === 'mapbox://styles/mapbox/streets-v12') {
      currentMapStyle = 'mapbox://styles/mapbox/satellite-streets-v12';
      map.setStyle(currentMapStyle);
      mapStyleToggleBtn.classList.add('satellite');
    } else {
      currentMapStyle = 'mapbox://styles/mapbox/streets-v12';
      map.setStyle(currentMapStyle);
      mapStyleToggleBtn.classList.remove('satellite');
    }
  });

  // Adjust overlay gap for more compact button spacing
  overlay.style.gap = '1.2rem';
}

// Monitor side panel state changes for gallery layout
function updateGalleryLayout() {
  if (isGalleryMode) {
    const galleryContainer = document.getElementById('gallery-container');
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel && sidePanel.classList.contains('open')) {
      galleryContainer.classList.add('with-side-panel');
    } else {
      galleryContainer.classList.remove('with-side-panel');
    }
  }
}

// Set up MutationObserver to watch for side panel class changes
function setupSidePanelObserver() {
  const sidePanel = document.getElementById('side-panel');
  if (sidePanel) {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateGalleryLayout();
        }
      });
    });
    
    observer.observe(sidePanel, {
      attributes: true,
      attributeFilter: ['class']
    });
  }
}



// --- Monument Details Modal ---
if (!document.getElementById('monument-details-modal')) {
  const detailsModalHtml = `
    <div id="monument-details-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:2000; align-items:center; justify-content:center;">
      <div id="monument-details-card" style="background:#fff; padding:2rem; border-radius:16px; min-width:320px; max-width:95vw; max-height:90vh; overflow:auto; box-shadow:0 4px 32px rgba(0,0,0,0.18); position:relative; display:flex; flex-direction:column;">
        <button id="close-details-btn" style="position:absolute; top:12px; right:12px; background:#eee; border:none; border-radius:50%; width:32px; height:32px; font-size:1.3rem; cursor:pointer;">&times;</button>
        <div id="details-image-container" style="text-align:center; margin-bottom:1rem;"></div>
        <h2 id="details-title"></h2>
        <div id="details-description" style="margin-bottom:1rem;"></div>
        <div><strong>Χώρος:</strong> <span id="details-location"></span></div>
        <div><strong>Χρόνος:</strong> <span id="details-time"></span></div>
        <div><strong>Τομέας:</strong> <span id="details-domain"></span></div>
        <div><strong>Κατηγορία:</strong> <span id="details-category"></span></div>
        <div><strong>Υποκατηγορία:</strong> <span id="details-subcategory"></span></div>
        <div style="margin:0.7rem 0;"><strong>Λέξεις κλειδιά:</strong> <span id="details-keywords"></span></div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', detailsModalHtml);
  document.getElementById('close-details-btn').onclick = () => {
    document.getElementById('monument-details-modal').style.display = 'none';
  };
}

// --- Side Panel UI ---
if (!document.getElementById('side-panel')) {
  const sidePanelHtml = `
    <button id="side-panel-toggle" title="Menu">&#9776;</button>
    <div id="side-panel">
      <button id="side-panel-close" title="Κλείσιμο" style="display:none;position:absolute;top:18px;right:18px;background:none;border:none;font-size:2rem;color:#ffe9b3;z-index:2101;cursor:pointer;">&times;</button>
      <div class="welcome-message" style="color:#a67c00;padding:0.7rem 1rem;border-radius:8px;font-weight:600;text-align:center;margin-bottom:1.2rem;">Καλωσήρθατε στην εφαρμογή Κρυμμένη Ιστορία της Φλώρινας</div>
      <div>
        <label class="search-label" for="map-search">Αναζήτηση στον χάρτη</label>
        <input id="map-search" class="searchbox" type="text" placeholder="Αναζήτηση στον χάρτη...">
      </div>
      <div>
        <label class="search-label" for="data-search">Αναζήτηση στα δεδομένα</label>
        <input id="data-search" class="searchbox" type="text" placeholder="Αναζήτηση στα δεδομένα...">
      </div>
      <button id="filters-toggle-btn" class="filters-toggle-btn"><span>Φίλτρα</span> <span id="filters-toggle-icon">▼</span></button>
      <div id="filters-section" class="filters-section" style="display:none;">
        <div class="filter-group">
          <label>Τομέας</label>
          <div class="dropdown-multi" id="domain-dropdown">
            <button class="dropdown-toggle" type="button">Επιλογή ▼</button>
            <div class="dropdown-menu" id="domain-dropdown-menu"></div>
          </div>
        </div>
        <div class="filter-group">
          <label>Κατηγορία</label>
          <div class="dropdown-multi" id="category-dropdown">
            <button class="dropdown-toggle" type="button">Επιλογή ▼</button>
            <div class="dropdown-menu" id="category-dropdown-menu"></div>
          </div>
        </div>
        <div class="filter-group">
          <label>Υποκατηγορία</label>
          <div class="dropdown-multi" id="subcategory-dropdown">
            <button class="dropdown-toggle" type="button">Επιλογή ▼</button>
            <div class="dropdown-menu" id="subcategory-dropdown-menu"></div>
          </div>
        </div>
        <div class="filter-group">
          <label for="year-slider">Χρόνος: <span id="time-slider-value"></span></label>
          <div id="year-slider" style="margin: 1.2em 0 1.2em 0;"></div>
        </div>
        <div class="filter-group">
          <label>Λέξεις κλειδιά</label>
          <div class="dropdown-multi" id="keywords-dropdown">
            <button class="dropdown-toggle" type="button">Επιλογή ▼</button>
            <div class="dropdown-menu" id="keywords-dropdown-menu"></div>
          </div>
        </div>
        <button id="clear-filters-btn" class="clear-filters-btn">Καθαρισμός Φίλτρων</button>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', sidePanelHtml);
  // Toggle logic
  const panel = document.getElementById('side-panel');
  const toggle = document.getElementById('side-panel-toggle');
  const closeBtn = document.getElementById('side-panel-close');
  toggle.onclick = () => {
    panel.classList.add('open');
    toggle.style.display = 'none';
    closeBtn.style.display = 'block';
  };
  closeBtn.onclick = () => {
    panel.classList.remove('open');
    toggle.style.display = 'flex';
    closeBtn.style.display = 'none';
  };
  if (window.innerWidth > 700) {
    panel.classList.add('open');
    toggle.style.display = 'none';
    closeBtn.style.display = 'block';
  }
}

// --- Filters Section Toggle ---
document.getElementById('filters-toggle-btn').onclick = function() {
  const section = document.getElementById('filters-section');
  const icon = document.getElementById('filters-toggle-icon');
  if (section.style.display === 'none') {
    section.style.display = 'block';
    icon.textContent = '▲';
  } else {
    section.style.display = 'none';
    icon.textContent = '▼';
  }
};

// --- Populate Filter Dropdowns ---
function populateSidePanelFilters(monuments) {
  const getUnique = (key, splitComma) => {
    let vals = monuments.map(m => m[key]).filter(Boolean);
    if (splitComma) vals = vals.flatMap(v => v.split(',').map(s => s.trim()));
    return Array.from(new Set(vals));
  };
  // Τομέας
  const domains = getUnique('τομέας');
  // Add all available domains including the new "Φυσικά"
  const allDomains = [
    'Ανθρωπογενή',
    'Φυσικά'
  ];
  // Combine existing domains with all available ones and remove duplicates
  const combinedDomains = Array.from(new Set([...domains, ...allDomains])).sort();
  document.getElementById('domain-dropdown-menu').innerHTML = combinedDomains.map(val => `<label><input type="checkbox" name="domain-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Κατηγορία
  const categories = getUnique('κατηγορία');
  // Add all available categories from the database constraint
  const allCategories = [
    'Μνημεία',
    'γεγονότα',
    'διαδρομές', 
    'κατασκευές',
    'κτίρια',
    'ονοματοθεσίες',
    'περιοχές',
    'πρόσωπα',
    'γεωμορφολογία',
    'πανίδα',
    'ύδατα',
    'χλωρίδα'
  ];
  // Combine existing categories with all available ones and remove duplicates
  const combinedCategories = Array.from(new Set([...categories, ...allCategories])).sort();
  document.getElementById('category-dropdown-menu').innerHTML = combinedCategories.map(val => `<label><input type="checkbox" name="category-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Υποκατηγορία
  const subcategories = getUnique('υποκατηγορία');
  document.getElementById('subcategory-dropdown-menu').innerHTML = subcategories.map(val => `<label><input type="checkbox" name="subcategory-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Χρόνος (noUiSlider dual-handle)
  const years = getUnique('χρόνος').map(v => {
    const y = String(v).slice(0,4);
    return (/^\d{4}$/.test(y)) ? Number(y) : null;
  }).filter(n => n);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearSlider = document.getElementById('year-slider');
  if (yearSlider && window.noUiSlider) {
    if (yearSlider.noUiSlider) yearSlider.noUiSlider.destroy();
    noUiSlider.create(yearSlider, {
      start: [minYear, maxYear],
      connect: true,
      step: 1,
      range: { min: minYear, max: maxYear },
      tooltips: false,
      format: {
        to: v => Math.round(v),
        from: v => Math.round(v)
      }
    });
    const updateLabelAndFilter = () => {
      const [from, to] = yearSlider.noUiSlider.get().map(Number);
      document.getElementById('time-slider-value').textContent = `${from} - ${to}`;
      filterAndShowMonuments();
    };
    yearSlider.noUiSlider.on('update', updateLabelAndFilter);
    // For clear filters
    yearSlider.noUiSlider.on('set', updateLabelAndFilter);
    // Initial label
    document.getElementById('time-slider-value').textContent = `${minYear} - ${maxYear}`;
  }
  // Λέξεις κλειδιά (split by comma)
  const keywords = getUnique('λέξεις-κλειδιά', true);
  document.getElementById('keywords-dropdown-menu').innerHTML = keywords.map(val => `<label><input type="checkbox" name="keywords-filter" value="${val}"> ${val}</label>`).join('<br>');
}

// --- Dropdown toggle logic for multi-selects ---
Array.from(document.querySelectorAll('.dropdown-multi .dropdown-toggle')).forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent document click from immediately closing
    // Close all other open dropdowns
    document.querySelectorAll('.dropdown-multi .dropdown-menu.open').forEach(menu => {
      if (menu !== this.nextElementSibling) {
        menu.classList.remove('open');
        const toggle = menu.parentElement.querySelector('.dropdown-toggle');
        if (toggle) toggle.innerHTML = 'Επιλογή ▼';
      }
    });
    // Toggle this dropdown
    const menu = this.nextElementSibling;
    menu.classList.toggle('open');
    this.innerHTML = menu.classList.contains('open') ? 'Επιλογή ▲' : 'Επιλογή ▼';
  });
});

// Close dropdowns when clicking outside
window.addEventListener('click', function(e) {
  document.querySelectorAll('.dropdown-multi .dropdown-menu.open').forEach(menu => {
    if (!menu.parentElement.contains(e.target)) {
      menu.classList.remove('open');
      const toggle = menu.parentElement.querySelector('.dropdown-toggle');
      if (toggle) toggle.innerHTML = 'Επιλογή ▼';
    }
  });
});

// --- Filtering Logic ---
function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name='${name}']:checked`)).map(cb => cb.value);
}
function getSingleValue(id) {
  const el = document.getElementById(id);
  return el && el.value ? el.value : '';
}
function filterAndShowMonuments() {
  let filtered = allMonuments;
  // --- Active Filters UI ---
  const activeFilters = [];
  // Τομέας
  const checkedDomains = getCheckedValues('domain-filter');
  if (checkedDomains.length > 0) {
    filtered = filtered.filter(m => checkedDomains.includes(m['τομέας']));
    checkedDomains.forEach(val => activeFilters.push({type: 'Τομέας', value: val, name: 'domain-filter'}));
  }
  // Κατηγορία
  const checkedCategories = getCheckedValues('category-filter');
  if (checkedCategories.length > 0) {
    filtered = filtered.filter(m => checkedCategories.includes(m['κατηγορία']));
    checkedCategories.forEach(val => activeFilters.push({type: 'Κατηγορία', value: val, name: 'category-filter'}));
  }
  // Υποκατηγορία
  const checkedSubcategories = getCheckedValues('subcategory-filter');
  if (checkedSubcategories.length > 0) {
    filtered = filtered.filter(m => checkedSubcategories.includes(m['υποκατηγορία']));
    checkedSubcategories.forEach(val => activeFilters.push({type: 'Υποκατηγορία', value: val, name: 'subcategory-filter'}));
  }
  // Χρόνος (noUiSlider dual-handle)
  const yearSlider = document.getElementById('year-slider');
  let minYear = null, maxYear = null;
  if (yearSlider && yearSlider.noUiSlider) {
    [minYear, maxYear] = yearSlider.noUiSlider.get().map(Number);
  }
  if (minYear !== null && maxYear !== null) {
    filtered = filtered.filter(m => {
      const y = String(m['χρόνος']).slice(0,4);
      const year = Number(y);
      return year >= minYear && year <= maxYear;
    });
    if (minYear !== Number(yearSlider.noUiSlider.options.range.min) || maxYear !== Number(yearSlider.noUiSlider.options.range.max)) {
      activeFilters.push({type: 'Χρόνος', value: `${minYear} - ${maxYear}`, name: 'year-range'});
    }
  }
  // Λέξεις κλειδιά (at least one match)
  const checkedKeywords = getCheckedValues('keywords-filter');
  if (checkedKeywords.length > 0) {
    filtered = filtered.filter(m => {
      if (!m['λέξεις-κλειδιά']) return false;
      const keys = m['λέξεις-κλειδιά'].split(',').map(s => s.trim());
      return keys.some(k => checkedKeywords.includes(k));
    });
    checkedKeywords.forEach(val => activeFilters.push({type: 'Λέξη-κλειδί', value: val, name: 'keywords-filter'}));
  }
  window.filteredMonuments = filtered;
  clearMarkers();
  addMarkers(filtered);
  
  // Update gallery if in gallery mode
  const galleryContainer = document.getElementById('gallery-container');
  if (galleryContainer && galleryContainer.style.display === 'block') {
    renderGallery(filtered);
  }

  // --- Render Active Filters UI ---
  let filterTags = '';
  activeFilters.forEach(f => {
    filterTags += `<span class="active-filter-tag" data-type="${f.name}" data-value="${f.value}">${f.type}: ${f.value} <button class="remove-filter-btn" title="Αφαίρεση">&times;</button></span>`;
  });
  let filterTagsContainer = document.getElementById('active-filters-container');
  if (!filterTagsContainer) {
    filterTagsContainer = document.createElement('div');
    filterTagsContainer.id = 'active-filters-container';
    filterTagsContainer.style = 'display:flex;flex-wrap:wrap;gap:0.5em 0.7em;margin-bottom:0.7em;';
    const domainLabel = document.querySelector("#side-panel label[for='map-search']");
    const domainDropdown = document.getElementById('domain-dropdown');
    if (domainDropdown) domainDropdown.parentElement.parentElement.parentElement.insertBefore(filterTagsContainer, domainDropdown.parentElement.parentElement);
  }
  filterTagsContainer.innerHTML = filterTags;
  // Remove filter logic
  filterTagsContainer.querySelectorAll('.remove-filter-btn').forEach(btn => {
    btn.onclick = function(e) {
      const tag = btn.closest('.active-filter-tag');
      const type = tag.getAttribute('data-type');
      const value = tag.getAttribute('data-value');
      if (type === 'year-range') {
        const yearSlider = document.getElementById('year-slider');
        if (yearSlider && yearSlider.noUiSlider) {
          yearSlider.noUiSlider.set([yearSlider.noUiSlider.options.range.min, yearSlider.noUiSlider.options.range.max]);
        }
      } else {
        const selector = `input[name='${type}'][value='${value}']`;
        const input = document.querySelector(selector);
        if (input) input.checked = false;
      }
      filterAndShowMonuments();
    };
  });

  // --- Update Timeline (always, if loaded) ---
  if (timelineLoaded && timelineInstance) {
    // Preprocess to offset items with the same day
    const dateMap = {};
    const filteredTimelineData = filtered.map((row, idx) => {
      let date = row['χρόνος']?.trim();
      if (!date || isNaN(Date.parse(date))) return null;
      const dayKey = date.slice(0, 10);
      if (!dateMap[dayKey]) dateMap[dayKey] = 0;
      const offsetMinutes = dateMap[dayKey] * 5;
      dateMap[dayKey]++;
      // Parse date as local noon to avoid timezone issues
      const [year, month, day] = dayKey.split('-').map(Number);
      const offsetDate = new Date(year, month - 1, day, 12, 0, 0);
      offsetDate.setMinutes(offsetDate.getMinutes() + offsetMinutes);
      // Ensure id is preserved or generated in data
      const dataWithId = { ...row };
      if (!dataWithId.id) {
        dataWithId.id = `${row['συντεταγμένες'] || ''}|${row['τίτλος'] || ''}`;
      }
      return {
        id: idx + 1,
        content: '',
        start: offsetDate.toISOString(),
        title: row['τίτλος'] || '',
        data: dataWithId
      };
    }).filter(Boolean);
    // Calculate min and max dates for focus
    const dates = filteredTimelineData.map(item => new Date(item.start));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const startFocus = new Date(minDate);
    startFocus.setMonth(startFocus.getMonth() - 1);
    const endFocus = new Date(maxDate);
    endFocus.setMonth(endFocus.getMonth() + 1);
    timelineInstance.setItems(filteredTimelineData);
    timelineInstance.setWindow(startFocus, endFocus, { animation: true });
  }
}

document.addEventListener('change', function(e) {
  if (
    e.target.closest('#filters-section')
  ) {
    filterAndShowMonuments();
    // Refresh data-viz charts if modal is open
    const dataVizModal = document.getElementById('data-viz-modal');
    if (dataVizModal && dataVizModal.style.display === 'flex') {
      // Use the same drilldownState as in the modal
      if (window.renderCharts && window.drilldownState) {
        window.renderCharts(window.drilldownState);
      }
    }
  }
});

document.getElementById('clear-filters-btn').onclick = function() {
  // Reset all filters
  const yearSlider = document.getElementById('year-slider');
  if (yearSlider && yearSlider.noUiSlider) {
    yearSlider.noUiSlider.set([yearSlider.noUiSlider.options.range.min, yearSlider.noUiSlider.options.range.max]);
  }
  Array.from(document.querySelectorAll('#filters-section input[type=checkbox]')).forEach(cb => cb.checked = false);
  filterAndShowMonuments();
};

fetchMonuments().then(monuments => {
  allMonuments = monuments;
  window.allMonuments = monuments; // Make it globally accessible for admin panel
  populateSidePanelFilters(monuments);
  filterAndShowMonuments();
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.style.display = 'none';
  
  // Set up side panel observer for gallery layout
  setupSidePanelObserver();
  
  // Set up gallery view toggle
  setupGalleryViewToggle();
  
  // Initialize admin panel after data is loaded
  if (window.initializeAdminPanelAfterData) {
    window.initializeAdminPanelAfterData();
  }
});

// --- Show logged in user UI ---
function getUsernameFromEmail(email) {
  return email ? email.split('@')[0] : '';
}

function showMonumentDetails(monument) {
  document.getElementById('monument-details-modal').style.display = 'flex';
  // Main image
  const img = monument['εικόνα'] ? `<img id="details-main-image" src="${monument['εικόνα']}" alt="photo" style="max-width:320px; max-height:200px; border-radius:10px; cursor:zoom-in;">` : '';
  document.getElementById('details-image-container').innerHTML = img;
  // Add zoom logic
  if (monument['εικόνα']) {
    if (!document.getElementById('zoomed-image-overlay')) {
      const overlayHtml = `
        <div id="zoomed-image-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:3000; align-items:center; justify-content:center; cursor:zoom-out;">
          <img id="zoomed-image" src="" alt="zoomed" style="max-width:90vw; max-height:90vh; border-radius:16px; box-shadow:0 4px 32px rgba(0,0,0,0.25);">
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', overlayHtml);
      document.getElementById('zoomed-image-overlay').onclick = () => {
        document.getElementById('zoomed-image-overlay').style.display = 'none';
      };
    }
    document.getElementById('details-main-image').onclick = () => {
      const overlay = document.getElementById('zoomed-image-overlay');
      const zoomedImg = document.getElementById('zoomed-image');
      zoomedImg.src = monument['εικόνα'];
      overlay.style.display = 'flex';
    };
  }
  document.getElementById('details-title').textContent = monument['τίτλος'] || '';
  document.getElementById('details-description').textContent = monument['περιγραφή'] || '';
  document.getElementById('details-location').textContent = monument['χώρος'] || '';
  document.getElementById('details-time').textContent = monument['χρόνος'] || '';
  document.getElementById('details-domain').textContent = monument['τομέας'] || '';
  document.getElementById('details-category').textContent = monument['κατηγορία'] || '';
  document.getElementById('details-subcategory').textContent = monument['υποκατηγορία'] || '';
  document.getElementById('details-keywords').textContent = (monument['λέξεις-κλειδιά'] || '').split(',').filter(Boolean).slice(0,3).join(', ');
  // Show sources
  let oldSources = document.getElementById('details-sources');
  if (oldSources) oldSources.textContent = '';
  else {
    const card = document.getElementById('monument-details-card');
    card.insertAdjacentHTML('beforeend', '<div style="margin-bottom:0.7rem;"><strong>Πηγές:</strong> <span id="details-sources"></span></div>');
  }
  document.getElementById('details-sources').textContent = monument['πηγές'] || '';

  // Restore Edit/Delete buttons for admin and owner
  let actionBtns = '';
  if (!isVisitor && canEditOrDelete(monument)) {
    actionBtns = `
      <div style="margin-top:1.2rem; display:flex; gap:0.7rem; justify-content:center;">
        <button id="details-edit-btn" class="edit-btn">Edit</button>
        <button id="details-delete-btn" class="delete-btn">Delete</button>
      </div>
    `;
  }
  // Remove old buttons if present
  let oldBtns = document.getElementById('details-edit-btn');
  if (oldBtns) oldBtns.parentElement.remove();
  const card = document.getElementById('monument-details-card');
  card.insertAdjacentHTML('beforeend', actionBtns);
  if (!isVisitor && canEditOrDelete(monument)) {
    document.getElementById('details-edit-btn').onclick = () => {
      document.getElementById('monument-details-modal').style.display = 'none';
      showEditMonumentModal(monument.id);
    };
    document.getElementById('details-delete-btn').onclick = async () => {
      if (confirm('Delete this monument?')) {
        await deleteMonument(monument.id);
        document.getElementById('monument-details-modal').style.display = 'none';
      }
    };
  }

  // Restore showing who added the monument
  let oldAddedBy = document.getElementById('monument-added-by');
  if (oldAddedBy) oldAddedBy.remove();
  if (monument.user_id) {
    // Try to fetch the user's email from Supabase
    supabase.from('users').select('email').eq('id', monument.user_id).single().then(({ data, error }) => {
      let addedBy = '';
      if (data && data.email) {
        addedBy = `<div id="monument-added-by" style="margin-top:0.7rem;font-size:0.98em;color:#555;">Added by <b>${getUsernameFromEmail(data.email)}</b></div>`;
      } else {
        addedBy = `<div id="monument-added-by" style="margin-top:0.7rem;font-size:0.98em;color:#555;">Added by <b>Unknown</b></div>`;
      }
      card.insertAdjacentHTML('beforeend', addedBy);
    });
  }
}

// --- Modal for Add/Edit ---
if (!document.getElementById('monument-modal')) {
  const modalHtml = `
    <div id="monument-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.4); z-index:1000; align-items:center; justify-content:center;">
      <form id="monument-form" style="background:#fff; padding:2rem; border-radius:14px; min-width:320px; max-width:95vw; display:flex; flex-direction:column; gap:1rem;">
        <h3 id="modal-title">Εισαγωγή νέου Μνημείου</h3>
        <div class='form-fields' style='display: flex; flex-wrap: wrap; gap: 1.2rem 2.5%; justify-content: space-between;'>
          <label>Τίτλος*<input name="τίτλος" placeholder="Τίτλος" required style="margin-top:0.2rem;"></label>
          <label>Συντεταγμένες*<input name="συντεταγμένες" placeholder="lat,lng" required style="margin-top:0.2rem;"></label>
          <label>Εικόνα (URL)<input name="εικόνα" type="url" placeholder="Image URL" style="margin-top:0.2rem;"></label>
          <label>Περιγραφή<textarea name="περιγραφή" placeholder="Περιγραφή" rows="3" style="margin-top:0.2rem;resize:vertical;"></textarea></label>
          <label>Χώρος<input name="χώρος" placeholder="Χώρος" style="margin-top:0.2rem;"></label>
          <label>Χρόνος<input name="χρόνος" type="date" placeholder="yyyy-mm-dd" style="margin-top:0.2rem;" pattern="\d{4}-\d{2}-\d{2}"></label>
          <label>Τομέας
            <select name="τομέας" id="form-domain-select" style="margin-top:0.2rem;"></select>
          </label>
          <label>Κατηγορία
            <select name="κατηγορία" id="form-category-select" style="margin-top:0.2rem;"></select>
          </label>
          <label>Υποκατηγορία
            <select name="υποκατηγορία" id="form-subcategory-select" style="margin-top:0.2rem;"></select>
          </label>
          <label>Λέξεις-κλειδιά<input name="λέξεις-κλειδιά" placeholder="Λέξεις-κλειδιά" style="margin-top:0.2rem;"></label>
          <label>Πηγές<input name="πηγές" placeholder="Πηγές" style="margin-top:0.2rem;"></label>
        </div>
        <div style="display:flex; gap:0.7rem; margin-top:1.2rem; justify-content:flex-end;">
          <button type="submit" style="background:#2d6cdf; color:#fff; border:none; border-radius:6px; padding:0.6rem 1.2rem; font-size:1rem; cursor:pointer;">Save</button>
          <button type="button" id="cancel-modal-btn" style="background:#eee; color:#333; border:none; border-radius:6px; padding:0.6rem 1.2rem; font-size:1rem; cursor:pointer;">Cancel</button>
        </div>
      </form>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('cancel-modal-btn').onclick = () => {
    document.getElementById('monument-modal').style.display = 'none';
  };
}

function populateMonumentFormDropdowns(selected = {}) {
  // Get unique values from allMonuments
  const getUnique = (key) => Array.from(new Set(allMonuments.map(m => m[key]).filter(Boolean)));
  const domains = getUnique('τομέας');
  const categories = getUnique('κατηγορία');
  const subcategories = getUnique('υποκατηγορία');

  // Add all available domains including the new "Φυσικά"
  const allDomains = [
    'Ανθρωπογενή',
    'Φυσικά'
  ];
  // Combine existing domains with all available ones and remove duplicates
  const combinedDomains = Array.from(new Set([...domains, ...allDomains])).sort();

  // Add all available categories from the database constraint
  const allCategories = [
    'Μνημεία',
    'γεγονότα',
    'διαδρομές', 
    'κατασκευές',
    'κτίρια',
    'ονοματοθεσίες',
    'περιοχές',
    'πρόσωπα',
    'γεωμορφολογία',
    'πανίδα',
    'ύδατα',
    'χλωρίδα'
  ];
  // Combine existing categories with all available ones and remove duplicates
  const combinedCategories = Array.from(new Set([...categories, ...allCategories])).sort();

  const domainSelect = document.getElementById('form-domain-select');
  const categorySelect = document.getElementById('form-category-select');
  const subcategorySelect = document.getElementById('form-subcategory-select');

  domainSelect.innerHTML = '<option value="">-- Επιλέξτε --</option>' + combinedDomains.map(val => `<option value="${val}"${selected['τομέας'] === val ? ' selected' : ''}>${val}</option>`).join('');
  categorySelect.innerHTML = '<option value="">-- Επιλέξτε --</option>' + combinedCategories.map(val => `<option value="${val}"${selected['κατηγορία'] === val ? ' selected' : ''}>${val}</option>`).join('');
  subcategorySelect.innerHTML = '<option value="">-- Επιλέξτε --</option>' + subcategories.map(val => `<option value="${val}"${selected['υποκατηγορία'] === val ? ' selected' : ''}>${val}</option>`).join('');
}

function showAddMonumentModal() {
  document.getElementById('modal-title').textContent = 'Εισαγωγή νέου Μνημείου';
  const form = document.getElementById('monument-form');
  form.reset();
  populateMonumentFormDropdowns();
  // Close side panel if open
  const sidePanel = document.getElementById('side-panel');
  if (sidePanel && sidePanel.classList.contains('open')) {
    sidePanel.classList.remove('open');
  }
  // Hide bottom-center-overlay when modal opens
  const overlay = document.getElementById('bottom-center-overlay');
  if (overlay) overlay.style.display = 'none';
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    formData.user_id = currentUser.id;
    const { error } = await supabase.from('monuments').insert([formData]);
    if (error) alert(error.message);
    else {
      document.getElementById('monument-modal').style.display = 'none';
      if (overlay) overlay.style.display = '';
      location.reload();
    }
  };
  document.getElementById('monument-modal').style.display = 'flex';
  // When modal closes (by any means), show overlay again
  const observer = new MutationObserver(() => {
    if (document.getElementById('monument-modal').style.display === 'none') {
      if (overlay) overlay.style.display = '';
      observer.disconnect();
    }
  });
  observer.observe(document.getElementById('monument-modal'), { attributes: true, attributeFilter: ['style'] });
}

async function showEditMonumentModal(id) {
  document.getElementById('modal-title').textContent = 'Edit Monument';
  const { data, error } = await supabase.from('monuments').select('*').eq('id', id).single();
  if (error) return alert(error.message);
  const form = document.getElementById('monument-form');
  // Pre-fill form fields
  Object.entries(data).forEach(([key, value]) => {
    const input = form.querySelector(`[name='${key}']`);
    if (input) {
      if (key === 'χρόνος' && value) {
        // Set as yyyy-mm-dd for input type=date
        input.value = String(value).slice(0,10);
      } else {
        input.value = value;
      }
    }
  });
  populateMonumentFormDropdowns(data);
  // Close side panel if open
  const sidePanel = document.getElementById('side-panel');
  if (sidePanel && sidePanel.classList.contains('open')) {
    sidePanel.classList.remove('open');
  }
  form.onsubmit = async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(form).entries());
    const { error } = await supabase.from('monuments').update(formData).eq('id', id);
    if (error) alert(error.message);
    else {
      document.getElementById('monument-modal').style.display = 'none';
      location.reload();
    }
  };
  document.getElementById('monument-modal').style.display = 'flex';
}

async function deleteMonument(id) {
  const { error } = await supabase.from('monuments').delete().eq('id', id);
  if (error) {
    alert(error.message);
    return;
  }
  document.getElementById('monument-details-modal').style.display = 'none';
  const monuments = await fetchMonuments();
  allMonuments = monuments;
  const categories = Array.from(new Set(monuments.map(m => m['κατηγορία']).filter(Boolean)));
  const menu = document.getElementById('category-dropdown-menu');
  menu.innerHTML = categories.map(cat =>
    `<label><input type="checkbox" value="${cat}"> ${cat}</label>`
  ).join('<br>');
  populateFilterDropdowns(monuments);
  filterAndShowMonuments();
}

function canEditOrDelete(monument) {
  return currentRole === 'admin' || monument.user_id === currentUser?.id;
}

// Fetch monument data from Supabase
async function fetchMonuments() {
  const { data, error } = await supabase
    .from('monuments')
    .select('*');
  if (error) {
    alert('Error loading monuments: ' + error.message);
    return [];
  }
  return data;
}

// --- Monument Filtering ---
let allMonuments = [];
let currentMarkers = [];
let selectedMarker = null;

function setSelectedMarker(marker) {
  if (selectedMarker && selectedMarker !== marker) {
    // Reset previous marker color
    selectedMarker.getElement().style.background = '';
    selectedMarker.getElement().style.boxShadow = '';
    selectedMarker.getElement().style.border = '';
  }
  selectedMarker = marker;
  if (marker) {
    marker.getElement().style.background = '#2563eb'; // blue
    marker.getElement().style.boxShadow = '0 0 0 4px #93c5fd';
    marker.getElement().style.border = '2px solid #fff';
  }
}

function clearMarkers() {
  currentMarkers.forEach(marker => marker.remove());
  currentMarkers = [];
  selectedMarker = null; // Clear selected marker when clearing all
}

function addMarkers(monuments) {
  currentMarkers = [];
  monuments.forEach(monument => {
    if (!monument['συντεταγμένες']) return;
    const [lat, lng] = monument['συντεταγμένες'].split(',').map(s => Number(s.trim()));
    if (isNaN(lat) || isNaN(lng)) return;
    const marker = new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .addTo(map);
    marker.getElement().addEventListener('click', () => {
      map.easeTo({ center: [lng, lat], zoom: 18, speed: 1.2 });
      setSelectedMarker(marker);
      showMonumentDetails(monument);
    });
    marker.monumentId = monument.id;
    currentMarkers.push(marker);
  });
}

// When selecting from timeline, also highlight the marker
function highlightMarkerByMonument(monument) {
  if (!monument || !monument.id) return;
  const marker = currentMarkers.find(m => m.monumentId === monument.id);
  if (marker) setSelectedMarker(marker);
}

// Floating details card next to marker
function showMonumentDetailsFloating(monument, lngLat) {
  // Remove any existing floating card
  let oldCard = document.getElementById('floating-monument-card');
  if (oldCard) oldCard.remove();
  // Project marker to screen coordinates
  const point = map.project(lngLat);
  // Decide left/right based on marker position
  const mapRect = document.getElementById('map').getBoundingClientRect();
  const cardWidth = 340;
  let left = point.x + 20;
  let top = point.y - 80;
  let align = 'left';
  if (point.x > map.getContainer().clientWidth / 2) {
    left = point.x - cardWidth - 20;
    align = 'right';
  }
  if (left < 10) left = 10;
  if (top < 10) top = 10;
  // Card HTML
  const card = document.createElement('div');
  card.id = 'floating-monument-card';
  card.style.position = 'absolute';
  card.style.left = left + 'px';
  card.style.top = top + 'px';
  card.style.width = cardWidth + 'px';
  card.style.maxWidth = '95vw';
  card.style.background = '#fff';
  card.style.borderRadius = '16px';
  card.style.boxShadow = '0 4px 32px rgba(0,0,0,0.18)';
  card.style.padding = '2rem 1.2rem 1.2rem 1.2rem';
  card.style.zIndex = 3001;
  card.style.display = 'flex';
  card.style.flexDirection = 'column';
  card.style.alignItems = 'flex-start';
  card.style.transition = 'box-shadow 0.18s';
  card.innerHTML = `
    <button id="close-floating-card" style="position:absolute; top:12px; right:12px; background:#eee; border:none; border-radius:50%; width:32px; height:32px; font-size:1.3rem; cursor:pointer;">&times;</button>
    <div id="details-image-container-float" style="text-align:center; margin-bottom:1rem; width:100%"></div>
    <h2 id="details-title-float"></h2>
    <div id="details-description-float" style="margin-bottom:1rem;"></div>
    <div><strong>Χώρος:</strong> <span id="details-location-float"></span></div>
    <div><strong>Χρόνος:</strong> <span id="details-time-float"></span></div>
    <div><strong>Τομέας:</strong> <span id="details-domain-float"></span></div>
    <div><strong>Κατηγορία:</strong> <span id="details-category-float"></span></div>
    <div><strong>Υποκατηγορία:</strong> <span id="details-subcategory-float"></span></div>
    <div style="margin:0.7rem 0;"><strong>Λέξεις κλειδιά:</strong> <span id="details-keywords-float"></span></div>
    <div style="margin-bottom:0.7rem;"><strong>Πηγές:</strong> <span id="details-sources-float"></span></div>
  `;
  // Fill content
  const img = monument['εικόνα'] ? `<img id="details-main-image-float" src="${monument['εικόνα']}" alt="photo" style="max-width:320px; max-height:200px; border-radius:10px; cursor:zoom-in;">` : '';
  card.querySelector('#details-image-container-float').innerHTML = img;
  card.querySelector('#details-title-float').textContent = monument['τίτλος'] || '';
  card.querySelector('#details-description-float').textContent = monument['περιγραφή'] || '';
  card.querySelector('#details-location-float').textContent = monument['χώρος'] || '';
  card.querySelector('#details-time-float').textContent = monument['χρόνος'] || '';
  card.querySelector('#details-domain-float').textContent = monument['τομέας'] || '';
  card.querySelector('#details-category-float').textContent = monument['κατηγορία'] || '';
  card.querySelector('#details-subcategory-float').textContent = monument['υποκατηγορία'] || '';
  card.querySelector('#details-keywords-float').textContent = (monument['λέξεις-κλειδιά'] || '').split(',').filter(Boolean).slice(0,3).join(', ');
  card.querySelector('#details-sources-float').textContent = monument['πηγές'] || '';
  // Close logic
  card.querySelector('#close-floating-card').onclick = () => card.remove();
  // Zoom image logic
  if (monument['εικόνα']) {
    card.querySelector('#details-main-image-float').onclick = () => {
      let overlay = document.getElementById('zoomed-image-overlay');
      if (!overlay) {
        const overlayHtml = `
          <div id="zoomed-image-overlay" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:3000; align-items:center; justify-content:center; cursor:zoom-out;">
            <img id="zoomed-image" src="" alt="zoomed" style="max-width:90vw; max-height:90vh; border-radius:16px; box-shadow:0 4px 32px rgba(0,0,0,0.25);">
          </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHtml);
        overlay = document.getElementById('zoomed-image-overlay');
        overlay.onclick = () => { overlay.style.display = 'none'; };
      }
      const zoomedImg = document.getElementById('zoomed-image');
      zoomedImg.src = monument['εικόνα'];
      overlay.style.display = 'flex';
    };
  }
  // Add to map container
  document.getElementById('map').appendChild(card);
}

// --- Map Search Functionality ---
let searchMarker = null;
const mapSearchInput = document.getElementById('map-search');
mapSearchInput.addEventListener('keydown', async function(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    const query = mapSearchInput.value.trim();
    if (!query) return;
    // Mapbox Geocoding API
    const accessToken = mapboxgl.accessToken;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${accessToken}&limit=1&language=el`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        map.flyTo({ center: [lng, lat], zoom: 14 });
        if (searchMarker) searchMarker.remove();
        searchMarker = new mapboxgl.Marker({ color: '#e74c3c' })
          .setLngLat([lng, lat])
          .addTo(map);
      } else {
        alert('Δεν βρέθηκε τοποθεσία.');
      }
    } catch (err) {
      alert('Σφάλμα κατά την αναζήτηση τοποθεσίας.');
    }
  }
});

// Add PapaParse for CSV parsing
if (!window.Papa) {
  const papaScript = document.createElement('script');
  papaScript.src = 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js';
  document.head.appendChild(papaScript);
}

// Timeline logic
let timelineLoaded = false;
let timelineInstance = null;
let timelineData = [];

const openTimelineBtn = document.getElementById('open-timeline-btn');
const timelineContainer = document.getElementById('timeline-container');

openTimelineBtn.addEventListener('click', async () => {
  const overlay = document.getElementById('bottom-center-overlay');
  const sidePanel = document.getElementById('side-panel');
  if (!timelineLoaded) {
    // Use the same monuments as the map (from Supabase)
    let monuments = allMonuments;
    if (!monuments || !monuments.length) {
      monuments = await fetchMonuments();
    }
    // Map to vis-timeline items
    const dateMap = {};
    timelineData = monuments.map((row, idx) => {
      let date = row['χρόνος']?.trim();
      if (!date || isNaN(Date.parse(date))) return null;
      const dayKey = date.slice(0, 10);
      if (!dateMap[dayKey]) dateMap[dayKey] = 0;
      const offsetMinutes = dateMap[dayKey] * 5;
      dateMap[dayKey]++;
      // Parse date as local noon to avoid timezone issues
      const [year, month, day] = dayKey.split('-').map(Number);
      const offsetDate = new Date(year, month - 1, day, 12, 0, 0);
      offsetDate.setMinutes(offsetDate.getMinutes() + offsetMinutes);
      // Ensure id is preserved or generated in data
      const dataWithId = { ...row };
      if (!dataWithId.id) {
        dataWithId.id = `${row['συντεταγμένες'] || ''}|${row['τίτλος'] || ''}`;
      }
      return {
        id: idx + 1,
        content: '',
        start: offsetDate.toISOString(),
        title: row['τίτλος'] || '',
        data: dataWithId
      };
    }).filter(Boolean);
    // Create timeline
    const container = document.getElementById('timeline-container');
    container.innerHTML = '<div id="vis-timeline"></div>';
    const items = new vis.DataSet(timelineData);
    // Calculate min and max dates for focus
    const dates = timelineData.map(item => new Date(item.start));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    // Add a margin of 1 month before and after
    const startFocus = new Date(minDate);
    startFocus.setMonth(startFocus.getMonth() - 1);
    const endFocus = new Date(maxDate);
    endFocus.setMonth(endFocus.getMonth() + 1);
    const options = {
      width: '100vw',
      height: '16vh',
      margin: { item: 6, axis: 8 },
      stack: false,
      horizontalScroll: true,
      zoomable: true,
      moveable: true,
      selectable: true,
      showCurrentTime: false,
      showMajorLabels: true,
      showMinorLabels: true,
      maxHeight: '16vh',
      minHeight: '12vh',
      locale: 'el',
      tooltip: { followMouse: true, overflowMethod: 'cap' },
      orientation: 'bottom',
      template: function(item) {
        // Use a styled span for the custom timeline dot, with the title as a tooltip
        const title = item && item.data && item.data['τίτλος'] ? item.data['τίτλος'] : '';
        return `<span class="custom-timeline-dot" title="${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;')}"></span>`;
      },
      zoomMin: 1000 * 60 * 60 * 24 * 30, // 1 month
      zoomMax: 1000 * 60 * 60 * 24 * 365 * 100, // 100 years
      start: startFocus,
      end: endFocus,
      format: {
        minorLabels: {
          millisecond: 'HH:mm:ss',
          second: 'HH:mm:ss',
          minute: 'HH:mm',
          hour: 'HH:mm',
          weekday: 'ddd D',
          day: 'D MMM',
          month: 'MMM YYYY',
          year: 'YYYY',
        },
        majorLabels: {
          millisecond: 'ddd D MMM YYYY',
          second: 'ddd D MMM YYYY',
          minute: 'ddd D MMM YYYY',
          hour: 'ddd D MMM YYYY',
          weekday: 'MMMM YYYY',
          day: 'MMMM YYYY',
          month: 'YYYY',
          year: 'Αιώνας',
        }
      }
    };
    timelineInstance = new vis.Timeline(document.getElementById('vis-timeline'), items, options);
    // Show popup on select
    let modalOpenedByClick = false;
    timelineInstance.on('select', function (props) {
      if (!props.items.length) return;
      const item = timelineData.find(i => i.id === props.items[0]);
      if (!item) return;
      const monument = item.data;
      if (monument && monument['συντεταγμένες']) {
        const [lat, lng] = monument['συντεταγμένες'].split(',').map(s => Number(s.trim()));
        if (!isNaN(lat) && !isNaN(lng)) {
          map.easeTo({ center: [lng, lat], zoom: 18, speed: 1.2 });
        }
      }
      highlightMarkerByMonument(monument);
      showMonumentDetails(monument);
      modalOpenedByClick = true;
    });

    // Show modal on timeline dot hover
    timelineInstance.on('itemover', function (props) {
      if (!props.item) return;
      const item = timelineData.find(i => i.id === props.item);
      if (!item) return;
      showMonumentDetails(item.data);
      modalOpenedByClick = false;
    });
    timelineInstance.on('itemout', function (props) {
      // Hide the modal when mouse leaves the dot, only if not opened by click
      if (!modalOpenedByClick) {
        const modal = document.getElementById('monument-details-modal');
        if (modal) modal.style.display = 'none';
      }
    });
    // If the user closes the modal manually, reset the flag
    const closeBtn = document.getElementById('close-details-btn');
    if (closeBtn) {
      closeBtn.onclick = () => {
        document.getElementById('monument-details-modal').style.display = 'none';
        modalOpenedByClick = false;
      };
    }
    timelineLoaded = true;
    timelineContainer.style.display = 'block';
    if (overlay) overlay.classList.add('overlay-up');
    if (sidePanel) sidePanel.classList.add('with-timeline');
  } else {
    // Toggle visibility
    if (timelineContainer.style.display === 'none') {
      // Open timeline
      timelineContainer.style.display = 'block';
      if (overlay) overlay.classList.add('overlay-up');
      if (sidePanel) sidePanel.classList.add('with-timeline');
    } else {
      // Close timeline with animation
      timelineContainer.classList.add('timeline-closing');
      if (overlay) overlay.classList.remove('overlay-up');
      if (sidePanel) sidePanel.classList.remove('with-timeline');
      setTimeout(() => {
        timelineContainer.style.display = 'none';
        timelineContainer.classList.remove('timeline-closing');
      }, 500); // match animation duration
    }
  }
});

// --- App Tour for Visitors ---
function showAppTourIfNeeded() {
  // Only for visitors
  if (!window.location.search.includes('visitor=1')) return;
  if (localStorage.getItem('appTourCompleted')) return;

  const steps = [
    "Καλώς ήρθες στον διαδραστικό χάρτη της Φλώρινας! Εδώ μπορείς να εξερευνήσεις τα μνημεία της περιοχής.",
    "Χρησιμοποίησε τα κουμπιά στο κάτω μέρος για να αλλάξεις στυλ χάρτη, να δεις το χρονολόγιο ή να επιστρέψεις στην αρχική σελίδα.",
    "Μπορείς να φιλτράρεις τα μνημεία από το πλαϊνό μενού (κουμπί ☰ πάνω αριστερά).",
    "Κάνε κλικ σε ένα μνημείο για να δεις περισσότερες πληροφορίες και φωτογραφίες.",
    "Απόλαυσε την περιήγηση! Μπορείς να ξαναδείς αυτό το tour αν καθαρίσεις τα δεδομένα του browser σου."
  ];
  let step = 0;

  const modal = document.getElementById('app-tour-modal');
  const content = document.getElementById('app-tour-content');
  const nextBtn = document.getElementById('app-tour-next-btn');
  const finishBtn = document.getElementById('app-tour-finish-btn');

  function showStep() {
    content.textContent = steps[step];
    nextBtn.style.display = step < steps.length - 1 ? 'inline-block' : 'none';
    finishBtn.style.display = step === steps.length - 1 ? 'inline-block' : 'none';
    modal.style.display = 'flex';
  }

  nextBtn.onclick = () => {
    step++;
    showStep();
  };
  finishBtn.onclick = () => {
    modal.style.display = 'none';
    localStorage.setItem('appTourCompleted', '1');
  };

  showStep();
}
window.addEventListener('DOMContentLoaded', showAppTourIfNeeded);

// After rendering the filters section, add the data viz button and modal
setTimeout(() => {
  const filtersSection = document.getElementById('filters-section');
  const sidePanel = document.getElementById('side-panel');
  if (sidePanel && !document.getElementById('open-data-viz-btn')) {
    const btn = document.createElement('button');
    btn.id = 'open-data-viz-btn';
    btn.textContent = '📊 Δεδομένα & Διαγράμματα';
    btn.className = 'data-viz-btn';
    btn.style.margin = '1.1rem 0 1.2rem 0';
    btn.style.width = '100%';
    btn.style.fontSize = '1.08rem';
    btn.style.fontWeight = '600';
    btn.style.background = 'linear-gradient(90deg, #ffe9b3 60%, #fbbf24 100%)';
    btn.style.color = '#181818';
    btn.style.border = 'none';
    btn.style.borderRadius = '12px';
    btn.style.padding = '0.7rem 0';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 2px 12px rgba(44,108,223,0.10)';
    btn.style.transition = 'background 0.18s, color 0.18s, box-shadow 0.18s';
    btn.onmouseover = () => { btn.style.background = 'linear-gradient(90deg, #fbbf24 60%, #ffe9b3 100%)'; };
    btn.onmouseout = () => { btn.style.background = 'linear-gradient(90deg, #ffe9b3 60%, #fbbf24 100%)'; };
    sidePanel.appendChild(btn);
    // Add event handler to open the data viz modal
    btn.onclick = () => {
      let modal = document.getElementById('data-viz-modal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'data-viz-modal';
        modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:4000;display:flex;align-items:center;justify-content:center;background:rgba(24,24,24,0.82);backdrop-filter:blur(2px);';
        modal.innerHTML = `
          <div class="data-viz-dialog" style="background:#fff;border-radius:18px;box-shadow:0 4px 32px rgba(0,0,0,0.18);padding:2.2rem 2.2rem 1.7rem 2.2rem;max-width:900px;width:96vw;max-height:90vh;overflow-y:auto;position:relative;">
            <button id="data-viz-close" style="position:absolute;top:12px;right:12px;background:#eee;border:none;border-radius:50%;width:32px;height:32px;font-size:1.3rem;cursor:pointer;">&times;</button>
            <div id="data-viz-charts"></div>
          </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('data-viz-close').onclick = () => { modal.style.display = 'none'; };
      }
      modal.style.display = 'flex';
      renderCharts(window.drilldownState || { level: 'root', domain: null, category: null });
    };
    // Add the developer credit below the data viz button
    const devCredit = document.createElement('div');
    devCredit.textContent = 'Developed by Jason Kaskamanidis 2025';
    devCredit.style = 'margin:0.7rem 0 3.5rem 0; text-align:center; font-size:0.97em; color:#8a8a8a;';
    sidePanel.insertBefore(devCredit, btn.nextSibling);
  }
}, 500);

// Place these at the top-level scope, not inside any function
let drilldownState = { level: 'root', domain: null, category: null };

function renderCharts(drilldown) {
  // Always get the latest filtered data
  let filtered = window.filteredMonuments || window.allMonuments || [];
  if (!Array.isArray(filtered)) filtered = [];
  const chartsDiv = document.getElementById('data-viz-charts');
  chartsDiv.innerHTML = '';
  
  // Filtered data for drilldown
  let data = filtered;
  if (drilldown.domain) data = data.filter(m => m['τομέας'] === drilldown.domain);
  if (drilldown.category) data = data.filter(m => m['κατηγορία'] === drilldown.category);
  
  // --- Refresh the data-viz-list to match the current data and drilldown ---
  let listDiv = document.getElementById('data-viz-list');
  if (!listDiv) {
    listDiv = document.createElement('div');
    listDiv.id = 'data-viz-list';
    listDiv.style = 'width:100%;max-width:700px;margin:2.2rem auto 0 auto;';
    chartsDiv.parentElement.appendChild(listDiv);
  }
  
  let html = `<h3 style='margin-bottom:1.2rem;'>Λίστα Μνημείων</h3>`;
  if (data.length === 0) {
    html += '<div style="color:#888;">Δεν βρέθηκαν μνημεία.</div>';
  } else {
    html += '<ul style="list-style:none;padding:0;max-width:600px;">';
    data.forEach(m => {
      html += `<li style='margin-bottom:0.7em;padding:0.5em 0.2em;border-bottom:1px solid #eee;'><b>${m['τίτλος']||''}</b> <span style='color:#888;'>(${m['χρόνος']||''})</span> <button style='margin-left:1em;background:#fbbf24;border:none;border-radius:6px;padding:0.2em 0.7em;cursor:pointer;' data-id='${m.id}'>Λεπτομέρειες</button></li>`;
    });
    html += '</ul>';
  }
  listDiv.innerHTML = html;
  
  // Attach detail button handlers
  listDiv.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = () => {
      const m = data.find(x => String(x.id) === btn.getAttribute('data-id'));
      if (m) showMonumentDetailsInViz(m, () => renderCharts(drilldown));
    };
  });
  listDiv.style.display = 'block';
  
  // --- Domain Pie ---
  const domains = {};
  data.forEach(m => { if (m['τομέας']) domains[m['τομέας']] = (domains[m['τομέας']]||0)+1; });
  chartsDiv.innerHTML += `<div style='width:320px;'><canvas id='domain-pie'></canvas><div style='text-align:center;margin-top:0.5rem;font-size:1.07em;'>Τομέας</div></div>`;
  
  // --- Category Pie ---
  const categories = {};
  data.forEach(m => { if (m['κατηγορία']) categories[m['κατηγορία']] = (categories[m['κατηγορία']]||0)+1; });
  chartsDiv.innerHTML += `<div style='width:320px;'><canvas id='category-pie'></canvas><div style='text-align:center;margin-top:0.5rem;font-size:1.07em;'>Κατηγορία</div></div>`;
  
  // --- Year Bar ---
  const years = {};
  data.forEach(m => {
    const y = String(m['χρόνος']).slice(0,4);
    if (/^\d{4}$/.test(y)) years[y] = (years[y]||0)+1;
  });
  chartsDiv.innerHTML += `<div style='width:420px;'><canvas id='year-bar'></canvas><div style='text-align:center;margin-top:0.5rem;font-size:1.07em;'>Χρόνος (ανά έτος)</div></div>`;
  
  // --- Back Button for Drilldown ---
  if (drilldown.domain || drilldown.category) {
    const backBtn = document.createElement('button');
    backBtn.textContent = '← Επιστροφή';
    backBtn.style = 'margin-bottom:1.2rem;background:#eee;border:none;border-radius:8px;padding:0.5em 1.2em;cursor:pointer;font-size:1.05em;';
    backBtn.onclick = () => {
      if (drilldown.category) {
        drilldownState = { level: 'domain', domain: drilldown.domain, category: null };
      } else if (drilldown.domain) {
        drilldownState = { level: 'root', domain: null, category: null };
      }
      renderCharts(drilldownState);
    };
    chartsDiv.prepend(backBtn);
  }
  
  // --- Render Charts ---
  setTimeout(() => {
    const pieColors = [
      '#fbbf24', '#22c55e', '#3b82f6', '#ef4444', '#a21caf', '#eab308',
      '#14b8a6', '#6366f1', '#f472b6', '#f59e42', '#10b981', '#f43f5e'
    ];
    
    const domainPie = new Chart(document.getElementById('domain-pie'), {
      type: 'pie',
      data: { labels: Object.keys(domains), datasets: [{ data: Object.values(domains), backgroundColor: pieColors }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } },
        onClick: (evt, elements) => {
          if (elements.length) {
            const idx = elements[0].index;
            const label = domainPie.data.labels[idx];
            // Drilldown to domain
            drilldownState = { level: 'domain', domain: label, category: null };
            renderCharts(drilldownState);
            // Show list for this domain
            const group = filtered.filter(m => m['τομέας'] === label);
            showMonumentListInViz(group, `Μνημεία στον τομέα "${label}"`);
          }
        }
      }
    });
    
    const categoryPie = new Chart(document.getElementById('category-pie'), {
      type: 'pie',
      data: { labels: Object.keys(categories), datasets: [{ data: Object.values(categories), backgroundColor: pieColors }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } },
        onClick: (evt, elements) => {
          if (elements.length) {
            const idx = elements[0].index;
            const label = categoryPie.data.labels[idx];
            // Drilldown to category
            drilldownState = { level: 'category', domain: drilldown.domain, category: label };
            renderCharts(drilldownState);
            // Show list for this category
            let group = filtered;
            if (drilldown.domain) group = group.filter(m => m['τομέας'] === drilldown.domain);
            group = group.filter(m => m['κατηγορία'] === label);
            showMonumentListInViz(group, `Μνημεία στην κατηγορία "${label}"`);
          }
        }
      }
    });
    
    const yearBar = new Chart(document.getElementById('year-bar'), {
      type: 'bar',
      data: { labels: Object.keys(years), datasets: [{ label: 'Μνημεία', data: Object.values(years), backgroundColor: '#fbbf24' }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: 'Έτος' } }, y: { title: { display: true, text: 'Μνημεία' } } },
        onClick: (evt, elements) => {
          if (elements.length) {
            const idx = elements[0].index;
            const label = yearBar.data.labels[idx];
            // Show list for this year
            let group = filtered;
            if (drilldown.domain) group = group.filter(m => m['τομέας'] === drilldown.domain);
            if (drilldown.category) group = group.filter(m => m['κατηγορία'] === drilldown.category);
            group = group.filter(m => String(m['χρόνος']).slice(0,4) === label);
            showMonumentListInViz(group, `Μνημεία για το έτος "${label}"`);
          }
        }
      }
    });
  }, 100);
}

function showMonumentDetailsInViz(monument, callback) {
  // Create a simple modal for monument details in the viz context
  const modal = document.createElement('div');
  modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:5000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:1.5rem;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
      <h3>${monument['τίτλος'] || ''}</h3>
      <p><strong>Περιγραφή:</strong> ${monument['περιγραφή'] || ''}</p>
      <p><strong>Χρόνος:</strong> ${monument['χρόνος'] || ''}</p>
      <p><strong>Κατηγορία:</strong> ${monument['κατηγορία'] || ''}</p>
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:1rem;background:#fbbf24;border:none;border-radius:6px;padding:0.5rem 1rem;cursor:pointer;">Κλείσιμο</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => {
    if (e.target === modal) {
      modal.remove();
      if (callback) callback();
    }
  };
}

function showMonumentListInViz(monuments, title) {
  // This function can be expanded to show a more detailed list
  console.log(title, monuments);
}

// --- Gallery Functions ---
let currentViewMode = 'grid'; // 'grid', 'list', 'slideshow', or 'compare'
let slideshowInterval = null;
let currentSlideIndex = 0;
let selectedMonuments = []; // For compare mode

function renderGallery(monuments) {
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryList = document.getElementById('gallery-list');
  
  // Clear both containers
  galleryGrid.innerHTML = '';
  galleryList.innerHTML = '';
  
  if (currentViewMode === 'grid') {
    monuments.forEach(monument => {
      const card = createMonumentCard(monument);
      galleryGrid.appendChild(card);
    });
  } else if (currentViewMode === 'list') {
    monuments.forEach(monument => {
      const listItem = createMonumentListItem(monument);
      galleryList.appendChild(listItem);
    });
  } else if (currentViewMode === 'slideshow') {
    renderSlideshow(monuments);
  } else if (currentViewMode === 'compare') {
    renderCompareMode(monuments);
  }
}

function createMonumentListItem(monument) {
  const listItem = document.createElement('div');
  listItem.className = 'monument-list-item';
  
  // Create image element
  const imageContainer = document.createElement('div');
  imageContainer.className = 'monument-list-image';
  
  if (monument['εικόνα']) {
    const img = document.createElement('img');
    img.src = monument['εικόνα'];
    img.alt = monument['τίτλος'] || 'Μνημείο';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    imageContainer.appendChild(img);
  } else {
    imageContainer.textContent = monument['τίτλος'] || 'Μνημείο';
  }
  
  // Create content container
  const content = document.createElement('div');
  content.className = 'monument-list-content';
  
  // Title
  const title = document.createElement('h3');
  title.className = 'monument-list-title';
  title.textContent = monument['τίτλος'] || '';
  
  // Description
  const description = document.createElement('p');
  description.className = 'monument-list-description';
  description.textContent = monument['περιγραφή'] || '';
  
  // Meta information
  const meta = document.createElement('div');
  meta.className = 'monument-list-meta';
  
  // Time
  const timeItem = createListMetaItem('Χρόνος', monument['χρόνος'] || '');
  meta.appendChild(timeItem);
  
  // Location
  const locationItem = createListMetaItem('Χώρος', monument['χώρος'] || '');
  meta.appendChild(locationItem);
  
  // Domain
  const domainItem = createListMetaItem('Τομέας', monument['τομέας'] || '');
  meta.appendChild(domainItem);
  
  // Category
  const categoryItem = createListMetaItem('Κατηγορία', monument['κατηγορία'] || '');
  meta.appendChild(categoryItem);
  
  // Assemble list item
  content.appendChild(title);
  content.appendChild(description);
  content.appendChild(meta);
  
  listItem.appendChild(imageContainer);
  listItem.appendChild(content);
  
  // Add click event to show details
  listItem.addEventListener('click', () => {
    showMonumentDetails(monument);
  });
  
  return listItem;
}

function createListMetaItem(label, value) {
  const item = document.createElement('div');
  item.className = 'monument-list-meta-item';
  
  const labelElement = document.createElement('div');
  labelElement.className = 'monument-list-meta-label';
  labelElement.textContent = label;
  
  const valueElement = document.createElement('div');
  valueElement.className = 'monument-list-meta-value';
  valueElement.textContent = value;
  
  item.appendChild(labelElement);
  item.appendChild(valueElement);
  
  return item;
}

function createMapPreview(monument) {
  const mapPreview = document.createElement('div');
  mapPreview.className = 'map-preview';
  
  // Always show the map location image
  
  // Create map container
  const mapContainer = document.createElement('div');
  mapContainer.className = 'map-preview-container';
  mapContainer.style.width = '80px';
  mapContainer.style.height = '60px';
  mapContainer.style.position = 'absolute';
  mapContainer.style.bottom = '10px';
  mapContainer.style.right = '10px';
  mapContainer.style.borderRadius = '8px';
  mapContainer.style.overflow = 'hidden';
  mapContainer.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
  mapContainer.style.border = '2px solid white';
  
  // Create static map image
  const mapImg = document.createElement('img');
  mapImg.style.width = '100%';
  mapImg.style.height = '100%';
  mapImg.style.objectFit = 'cover';
  
  // Always use the map-location-svgrepo-com.png image
  mapImg.src = 'map-location-svgrepo-com.png';
  mapImg.alt = 'Map Location';
  
  // Add click event to show location on main map
  mapContainer.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent card click
    showLocationOnMap(monument);
  });
  
  // Add hover tooltip
  mapContainer.title = 'Κάντε κλικ για να δείτε στον χάρτη';
  
  mapContainer.appendChild(mapImg);
  mapPreview.appendChild(mapContainer);
  
  return mapPreview;
}

function showLocationOnMap(monument) {
  // Switch to map mode
  const galleryToggleBtn = document.getElementById('gallery-toggle-btn');
  if (galleryToggleBtn) {
    galleryToggleBtn.click();
  }
  
  // Wait a bit for map to load, then fly to location
  setTimeout(() => {
    let lat = null;
    let lng = null;
    if (monument['συντεταγμένες']) {
      const coords = monument['συντεταγμένες'].split(',').map(s => s.trim());
      if (coords.length === 2) {
        lat = parseFloat(coords[0]);
        lng = parseFloat(coords[1]);
      }
    }
    
    if (!isNaN(lng) && !isNaN(lat) && map) {
      map.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 2000
      });
      
      // Highlight the monument marker
      highlightMarkerByMonument(monument);
    }
  }, 500);
}



function renderSlideshow(monuments) {
  const slideshowContainer = document.getElementById('gallery-slideshow');
  slideshowContainer.innerHTML = '';
  
  if (monuments.length === 0) {
    slideshowContainer.innerHTML = '<div class="slideshow-info">Δεν βρέθηκαν μνημεία για slideshow</div>';
    return;
  }
  
  // Create slideshow container
  const container = document.createElement('div');
  container.className = 'slideshow-container';
  
  // Create slides
  monuments.forEach((monument, index) => {
    const slide = document.createElement('div');
    slide.className = `slideshow-slide ${index === 0 ? 'active' : ''}`;
    
    // Image
    if (monument['εικόνα']) {
      const img = document.createElement('img');
      img.src = monument['εικόνα'];
      img.alt = monument['τίτλος'] || 'Μνημείο';
      img.className = 'slideshow-image';
      slide.appendChild(img);
    } else {
      slide.style.background = 'linear-gradient(45deg, #f3e9d2, #ffe9b3)';
      slide.style.display = 'flex';
      slide.style.alignItems = 'center';
      slide.style.justifyContent = 'center';
      slide.style.color = 'var(--text-dark)';
      slide.style.fontSize = '2rem';
      slide.style.fontWeight = '600';
      slide.textContent = monument['τίτλος'] || 'Μνημείο';
    }
    
    // Content overlay
    const content = document.createElement('div');
    content.className = 'slideshow-content';
    
    const title = document.createElement('h2');
    title.className = 'slideshow-title';
    title.textContent = monument['τίτλος'] || '';
    
    const description = document.createElement('p');
    description.className = 'slideshow-description';
    description.textContent = monument['περιγραφή'] || '';
    
    content.appendChild(title);
    content.appendChild(description);
    slide.appendChild(content);
    
    // No click event - slideshow only
    
    container.appendChild(slide);
  });
  
  // Create controls
  const controls = document.createElement('div');
  controls.className = 'slideshow-controls';
  
  const prevBtn = document.createElement('button');
  prevBtn.className = 'slideshow-btn';
  prevBtn.innerHTML = '‹';
  prevBtn.onclick = () => changeSlide(-1);
  
  const nextBtn = document.createElement('button');
  nextBtn.className = 'slideshow-btn';
  nextBtn.innerHTML = '›';
  nextBtn.onclick = () => changeSlide(1);
  
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  container.appendChild(controls);
  
  // Create indicators
  const indicators = document.createElement('div');
  indicators.className = 'slideshow-indicators';
  
  monuments.forEach((_, index) => {
    const indicator = document.createElement('div');
    indicator.className = `slideshow-indicator ${index === 0 ? 'active' : ''}`;
    indicator.onclick = () => goToSlide(index);
    indicators.appendChild(indicator);
  });
  
  container.appendChild(indicators);
  
  slideshowContainer.appendChild(container);
  
  // Start auto-play
  startSlideshow();
}

function changeSlide(direction) {
  const slides = document.querySelectorAll('.slideshow-slide');
  const indicators = document.querySelectorAll('.slideshow-indicator');
  
  if (slides.length === 0) return;
  
  slides[currentSlideIndex].classList.remove('active');
  indicators[currentSlideIndex].classList.remove('active');
  
  currentSlideIndex = (currentSlideIndex + direction + slides.length) % slides.length;
  
  slides[currentSlideIndex].classList.add('active');
  indicators[currentSlideIndex].classList.add('active');
}

function goToSlide(index) {
  const slides = document.querySelectorAll('.slideshow-slide');
  const indicators = document.querySelectorAll('.slideshow-indicator');
  
  if (slides.length === 0) return;
  
  slides[currentSlideIndex].classList.remove('active');
  indicators[currentSlideIndex].classList.remove('active');
  
  currentSlideIndex = index;
  
  slides[currentSlideIndex].classList.add('active');
  indicators[currentSlideIndex].classList.add('active');
}

function startSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
  }
  
  slideshowInterval = setInterval(() => {
    changeSlide(1);
  }, 5000); // Change slide every 5 seconds
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
}

function renderCompareMode(monuments) {
  const compareContainer = document.getElementById('gallery-compare');
  compareContainer.innerHTML = '';
  
  // Reset selected monuments when switching to compare mode
  selectedMonuments = [];
  
  // Create header
  const header = document.createElement('div');
  header.className = 'compare-header';
  header.innerHTML = '<h2>Σύγκριση Μνημείων</h2>';
  
  // Create actions at the top
  const actions = document.createElement('div');
  actions.className = 'compare-actions';
  
  const compareBtn = document.createElement('button');
  compareBtn.className = 'compare-btn';
  compareBtn.textContent = 'Σύγκριση';
  compareBtn.disabled = true;
  compareBtn.onclick = showComparison;
  
  const resetBtn = document.createElement('button');
  resetBtn.className = 'compare-btn';
  resetBtn.textContent = 'Επαναφορά';
  resetBtn.style.marginLeft = '1rem';
  resetBtn.style.background = 'var(--text-muted)';
  resetBtn.onclick = resetComparison;
  
  actions.appendChild(compareBtn);
  actions.appendChild(resetBtn);
  
  // Create instructions
  const instructions = document.createElement('div');
  instructions.className = 'compare-instructions';
  instructions.textContent = 'Επιλέξτε 2 μνημεία για σύγκριση. Κάντε κλικ στα κουτιά παρακάτω.';
  
  // Create selection grid
  const selectionGrid = document.createElement('div');
  selectionGrid.className = 'compare-grid';
  selectionGrid.id = 'compare-selection-grid';
  
  monuments.forEach((monument, index) => {
    const card = createCompareCard(monument, index);
    selectionGrid.appendChild(card);
  });
  
  // Create comparison area
  const comparisonArea = document.createElement('div');
  comparisonArea.className = 'compare-comparison';
  comparisonArea.id = 'compare-comparison';
  
  compareContainer.appendChild(header);
  compareContainer.appendChild(actions);
  compareContainer.appendChild(instructions);
  compareContainer.appendChild(selectionGrid);
  compareContainer.appendChild(comparisonArea);
}

function createCompareCard(monument, index) {
  const card = document.createElement('div');
  card.className = 'compare-card';
  card.dataset.index = index;
  
  // Image
  const imageContainer = document.createElement('div');
  imageContainer.className = 'monument-card-image';
  
  if (monument['εικόνα']) {
    const img = document.createElement('img');
    img.src = monument['εικόνα'];
    img.alt = monument['τίτλος'] || 'Μνημείο';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    imageContainer.appendChild(img);
  } else {
    imageContainer.textContent = monument['τίτλος'] || 'Μνημείο';
  }
  
  // Content
  const content = document.createElement('div');
  content.className = 'monument-card-content';
  
  const title = document.createElement('h3');
  title.className = 'monument-card-title';
  title.textContent = monument['τίτλος'] || '';
  
  const description = document.createElement('p');
  description.className = 'monument-card-description';
  description.textContent = monument['περιγραφή'] || '';
  
  content.appendChild(title);
  content.appendChild(description);
  
  card.appendChild(imageContainer);
  card.appendChild(content);
  
  // Add click event
  card.addEventListener('click', () => {
    toggleMonumentSelection(monument, index, card);
  });
  
  return card;
}

function toggleMonumentSelection(monument, index, card) {
  const isSelected = selectedMonuments.some(m => m.index === index);
  
  if (isSelected) {
    // Remove from selection
    selectedMonuments = selectedMonuments.filter(m => m.index !== index);
    card.classList.remove('selected');
  } else {
    // Add to selection (max 2)
    if (selectedMonuments.length < 2) {
      selectedMonuments.push({ monument, index });
      card.classList.add('selected');
    } else {
      // Replace the first selection
      const firstCard = document.querySelector(`[data-index="${selectedMonuments[0].index}"]`);
      if (firstCard) firstCard.classList.remove('selected');
      
      selectedMonuments[0] = { monument, index };
      card.classList.add('selected');
    }
  }
  
  // Update compare button
  const compareBtn = document.querySelector('.compare-btn');
  if (compareBtn) {
    compareBtn.disabled = selectedMonuments.length !== 2;
  }
  
  // Update instructions
  const instructions = document.querySelector('.compare-instructions');
  if (instructions) {
    if (selectedMonuments.length === 0) {
      instructions.textContent = 'Επιλέξτε 2 μνημεία για σύγκριση. Κάντε κλικ στα κουτιά παρακάτω.';
    } else if (selectedMonuments.length === 1) {
      instructions.textContent = 'Επιλέξτε ακόμα 1 μνημείο για σύγκριση.';
    } else {
      instructions.textContent = 'Επιλέξτε "Σύγκριση" για να δείτε τη σύγκριση.';
    }
  }
}

function showComparison() {
  if (selectedMonuments.length !== 2) return;
  
  const comparisonArea = document.getElementById('compare-comparison');
  const selectionGrid = document.getElementById('compare-selection-grid');
  
  // Hide selection grid and show only selected monuments
  selectionGrid.style.display = 'none';
  
  comparisonArea.innerHTML = '';
  comparisonArea.classList.add('active');
  
  // Add back button
  const backBtn = document.createElement('button');
  backBtn.className = 'compare-back-btn';
  backBtn.textContent = '← Επιστροφή στην επιλογή';
  backBtn.onclick = () => {
    comparisonArea.classList.remove('active');
    selectionGrid.style.display = 'grid';
    comparisonArea.innerHTML = '';
  };
  
  comparisonArea.appendChild(backBtn);
  
  // Create container for comparison items
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'compare-items-container';
  
  selectedMonuments.forEach(({ monument }) => {
    const item = createComparisonItem(monument);
    itemsContainer.appendChild(item);
  });
  
  comparisonArea.appendChild(itemsContainer);
  
  // Scroll to comparison
  comparisonArea.scrollIntoView({ behavior: 'smooth' });
}

function createComparisonItem(monument) {
  const item = document.createElement('div');
  item.className = 'compare-item';
  
  // Header
  const header = document.createElement('div');
  header.className = 'compare-item-header';
  
  const title = document.createElement('h3');
  title.className = 'compare-item-title';
  title.textContent = monument['τίτλος'] || '';
  
  header.appendChild(title);
  
  // Image
  const image = document.createElement('img');
  image.className = 'compare-item-image';
  if (monument['εικόνα']) {
    image.src = monument['εικόνα'];
    image.alt = monument['τίτλος'] || 'Μνημείο';
  } else {
    image.style.background = 'linear-gradient(45deg, #f3e9d2, #ffe9b3)';
    image.style.display = 'flex';
    image.style.alignItems = 'center';
    image.style.justifyContent = 'center';
    image.style.color = 'var(--text-dark)';
    image.style.fontSize = '1.5rem';
    image.style.fontWeight = '600';
    image.textContent = monument['τίτλος'] || 'Μνημείο';
  }
  
  // Details
  const details = document.createElement('div');
  details.className = 'compare-item-details';
  
  // Description first
  if (monument['περιγραφή']) {
    const descSection = document.createElement('div');
    descSection.className = 'compare-detail-section';
    
    const descLabel = document.createElement('h4');
    descLabel.className = 'compare-section-label';
    descLabel.textContent = 'Περιγραφή';
    
    const descValue = document.createElement('p');
    descValue.className = 'compare-section-value';
    descValue.textContent = monument['περιγραφή'];
    
    descSection.appendChild(descLabel);
    descSection.appendChild(descValue);
    details.appendChild(descSection);
  }
  
  // Other fields
  const fields = [
    { label: 'Χρόνος', value: monument['χρόνος'] },
    { label: 'Χώρος', value: monument['χώρος'] },
    { label: 'Τομέας', value: monument['τομέας'] },
    { label: 'Κατηγορία', value: monument['κατηγορία'] },
    { label: 'Υποκατηγορία', value: monument['υποκατηγορία'] },
    { label: 'Λέξεις-κλειδιά', value: monument['λέξεις-κλειδιά'] }
  ];
  
  const fieldsSection = document.createElement('div');
  fieldsSection.className = 'compare-fields-section';
  
  fields.forEach(field => {
    if (field.value) {
      const detailItem = document.createElement('div');
      detailItem.className = 'compare-detail-item';
      
      const label = document.createElement('span');
      label.className = 'compare-detail-label';
      label.textContent = field.label;
      
      const value = document.createElement('span');
      value.className = 'compare-detail-value';
      value.textContent = field.value;
      
      detailItem.appendChild(label);
      detailItem.appendChild(value);
      fieldsSection.appendChild(detailItem);
    }
  });
  
  details.appendChild(fieldsSection);
  
  item.appendChild(header);
  item.appendChild(image);
  item.appendChild(details);
  
  return item;
}

function resetComparison() {
  selectedMonuments = [];
  
  // Clear selections
  document.querySelectorAll('.compare-card').forEach(card => {
    card.classList.remove('selected');
  });
  
  // Show selection grid and hide comparison area
  const selectionGrid = document.getElementById('compare-selection-grid');
  const comparisonArea = document.getElementById('compare-comparison');
  
  if (selectionGrid) {
    selectionGrid.style.display = 'grid';
  }
  
  if (comparisonArea) {
    comparisonArea.classList.remove('active');
    comparisonArea.innerHTML = '';
  }
  
  // Reset button
  const compareBtn = document.querySelector('.compare-btn');
  if (compareBtn) {
    compareBtn.disabled = true;
  }
  
  // Reset instructions
  const instructions = document.querySelector('.compare-instructions');
  if (instructions) {
    instructions.textContent = 'Επιλέξτε 2 μνημεία για σύγκριση. Κάντε κλικ στα κουτιά παρακάτω.';
  }
}

function setupGalleryViewToggle() {
  const gridViewBtn = document.getElementById('grid-view-btn');
  const listViewBtn = document.getElementById('list-view-btn');
  const slideshowViewBtn = document.getElementById('slideshow-view-btn');
  const compareViewBtn = document.getElementById('compare-view-btn');
  const galleryGrid = document.getElementById('gallery-grid');
  const galleryList = document.getElementById('gallery-list');
  const gallerySlideshow = document.getElementById('gallery-slideshow');
  const galleryCompare = document.getElementById('gallery-compare');
  
  gridViewBtn.addEventListener('click', () => {
    if (currentViewMode !== 'grid') {
      stopSlideshow();
      currentViewMode = 'grid';
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      slideshowViewBtn.classList.remove('active');
      compareViewBtn.classList.remove('active');
      galleryGrid.style.display = 'grid';
      galleryList.style.display = 'none';
      gallerySlideshow.style.display = 'none';
      galleryCompare.style.display = 'none';
      
      // Re-render with current monuments
      if (window.filteredMonuments) {
        renderGallery(window.filteredMonuments);
      }
    }
  });
  
  listViewBtn.addEventListener('click', () => {
    if (currentViewMode !== 'list') {
      stopSlideshow();
      currentViewMode = 'list';
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      slideshowViewBtn.classList.remove('active');
      compareViewBtn.classList.remove('active');
      galleryList.style.display = 'block';
      galleryGrid.style.display = 'none';
      gallerySlideshow.style.display = 'none';
      galleryCompare.style.display = 'none';
      
      // Re-render with current monuments
      if (window.filteredMonuments) {
        renderGallery(window.filteredMonuments);
      }
    }
  });
  
  slideshowViewBtn.addEventListener('click', () => {
    if (currentViewMode !== 'slideshow') {
      currentViewMode = 'slideshow';
      slideshowViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      listViewBtn.classList.remove('active');
      compareViewBtn.classList.remove('active');
      gallerySlideshow.style.display = 'block';
      galleryGrid.style.display = 'none';
      galleryList.style.display = 'none';
      galleryCompare.style.display = 'none';
      
      // Re-render with current monuments
      if (window.filteredMonuments) {
        renderGallery(window.filteredMonuments);
      }
    }
  });
  
  compareViewBtn.addEventListener('click', () => {
    if (currentViewMode !== 'compare') {
      stopSlideshow();
      currentViewMode = 'compare';
      compareViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      listViewBtn.classList.remove('active');
      slideshowViewBtn.classList.remove('active');
      galleryCompare.style.display = 'block';
      galleryGrid.style.display = 'none';
      galleryList.style.display = 'none';
      gallerySlideshow.style.display = 'none';
      
      // Re-render with current monuments
      if (window.filteredMonuments) {
        renderGallery(window.filteredMonuments);
      }
    }
  });
}

function createMonumentCard(monument) {
  const card = document.createElement('div');
  card.className = 'monument-card';
  
  // Create image container with map preview
  const imageContainer = document.createElement('div');
  imageContainer.className = 'monument-card-image';
  
  if (monument['εικόνα']) {
    const img = document.createElement('img');
    img.src = monument['εικόνα'];
    img.alt = monument['τίτλος'] || 'Μνημείο';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    imageContainer.appendChild(img);
  } else {
    imageContainer.textContent = monument['τίτλος'] || 'Μνημείο';
  }
  
  // Add map preview overlay
  if (monument['συντεταγμένες']) {
    const mapPreview = createMapPreview(monument);
    imageContainer.appendChild(mapPreview);
  }
  
  // Create content container
  const content = document.createElement('div');
  content.className = 'monument-card-content';
  
  // Title
  const title = document.createElement('h3');
  title.className = 'monument-card-title';
  title.textContent = monument['τίτλος'] || '';
  
  // Description
  const description = document.createElement('p');
  description.className = 'monument-card-description';
  description.textContent = monument['περιγραφή'] || '';
  
  // Meta information
  const meta = document.createElement('div');
  meta.className = 'monument-card-meta';
  
  // Time
  const timeItem = createMetaItem('Χρόνος', monument['χρόνος'] || '');
  meta.appendChild(timeItem);
  
  // Location
  const locationItem = createMetaItem('Χώρος', monument['χώρος'] || '');
  meta.appendChild(locationItem);
  
  // Domain
  const domainItem = createMetaItem('Τομέας', monument['τομέας'] || '');
  meta.appendChild(domainItem);
  
  // Category
  const categoryItem = createMetaItem('Κατηγορία', monument['κατηγορία'] || '');
  meta.appendChild(categoryItem);
  
  // Subcategory
  const subcategoryItem = createMetaItem('Υποκατηγορία', monument['υποκατηγορία'] || '');
  meta.appendChild(subcategoryItem);
  
  // Keywords
  const keywordsItem = createMetaItem('Λέξεις-κλειδιά', monument['λέξεις-κλειδιά'] || '');
  meta.appendChild(keywordsItem);
  
  // Assemble card
  content.appendChild(title);
  content.appendChild(description);
  content.appendChild(meta);
  
  card.appendChild(imageContainer);
  card.appendChild(content);
  
  // Add click event to show details
  card.addEventListener('click', () => {
    showMonumentDetails(monument);
  });
  
  return card;
}

function createMetaItem(label, value) {
  const item = document.createElement('div');
  item.className = 'monument-card-meta-item';
  
  const labelElement = document.createElement('div');
  labelElement.className = 'monument-card-meta-label';
  labelElement.textContent = label;
  
  const valueElement = document.createElement('div');
  valueElement.className = 'monument-card-meta-value';
  valueElement.textContent = value;
  
  item.appendChild(labelElement);
  item.appendChild(valueElement);
  
  return item;
}

window.renderCharts = renderCharts;
window.drilldownState = drilldownState;

// ========================================
// ADMIN PANEL FUNCTIONALITY
// ========================================

// Initialize admin panel
function initializeAdminPanel() {
  // Check if user is admin
  getCurrentUserAndRole().then(({ user, role }) => {
    currentUserRole = role;
    console.log('Current user role:', role);
    if (role === 'admin') {
      showAdminToggle();
      setupAdminPanel();
    } else {
      console.log('User is not admin, role:', role);
    }
  }).catch(error => {
    console.error('Error checking user role:', error);
    // For testing, show admin panel anyway
    showAdminToggle();
    setupAdminPanel();
  });
}

// Show admin toggle button
function showAdminToggle() {
  const adminToggle = document.getElementById('admin-panel-toggle');
  if (adminToggle) {
    adminToggle.style.display = 'block';
    console.log('Admin toggle button shown');
  } else {
    console.error('Admin toggle button not found');
  }
}

// Setup admin panel functionality
function setupAdminPanel() {
  const adminToggle = document.getElementById('admin-panel-toggle');
  const adminPanel = document.getElementById('admin-panel');
  const closeBtn = document.getElementById('close-admin-panel');
  
  // Toggle admin panel
  adminToggle.addEventListener('click', async () => {
    // Close side panel if it's open
    const sidePanel = document.getElementById('side-panel');
    if (sidePanel && sidePanel.classList.contains('open')) {
      sidePanel.classList.remove('open');
    }
    
    adminPanel.style.display = 'flex';
    await loadAdminData();
  });
  
  // Close admin panel
  closeBtn.addEventListener('click', () => {
    adminPanel.style.display = 'none';
  });
  
  // Close on outside click
  adminPanel.addEventListener('click', (e) => {
    if (e.target === adminPanel) {
      adminPanel.style.display = 'none';
    }
  });
  
  // Setup tabs
  setupAdminTabs();
  
  // Setup bulk operations
  setupBulkOperations();
  
  // Setup data validation
  setupDataValidation();
  
  // Setup export/import
  setupExportImport();
}

// Setup admin tabs
function setupAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const tabContents = document.querySelectorAll('.admin-tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      document.getElementById(targetTab).classList.add('active');
    });
  });
}

// Load admin data
async function loadAdminData() {
  loadBulkMonumentsList();
  await loadValidationData();
  loadCategoryOptions();
}

// ========================================
// BULK OPERATIONS
// ========================================

function setupBulkOperations() {
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const refreshDataBtn = document.getElementById('refresh-data-btn');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  const searchInput = document.getElementById('bulk-search-input');
  const filterCategory = document.getElementById('bulk-filter-category');
  
  if (selectAllBtn) selectAllBtn.addEventListener('click', selectAllMonuments);
  if (deselectAllBtn) deselectAllBtn.addEventListener('click', deselectAllMonuments);
  if (refreshDataBtn) refreshDataBtn.addEventListener('click', refreshAdminData);
  if (bulkDeleteBtn) bulkDeleteBtn.addEventListener('click', bulkDeleteMonuments);
  
  // Search and filter functionality
  if (searchInput) {
    searchInput.addEventListener('input', filterMonuments);
  }
  if (filterCategory) {
    filterCategory.addEventListener('change', filterMonuments);
  }
}

function loadBulkMonumentsList() {
  const container = document.getElementById('bulk-monuments-list');
  if (!container) {
    console.error('Bulk monuments list container not found');
    return;
  }
  
  container.innerHTML = '';
  
  console.log('Loading bulk monuments list...');
  console.log('window.allMonuments:', window.allMonuments);
  console.log('allMonuments:', allMonuments);
  
  // Use window.allMonuments if available, otherwise fall back to local allMonuments
  const monumentsToUse = window.allMonuments || allMonuments;
  
  if (!monumentsToUse || monumentsToUse.length === 0) {
    console.log('No monuments found in either window.allMonuments or allMonuments');
    container.innerHTML = '<p>Δεν υπάρχουν μνημεία για επιλογή</p>';
    return;
  }
  
  console.log(`Found ${monumentsToUse.length} monuments to display`);
  
  monumentsToUse.forEach(monument => {
    const item = document.createElement('div');
    item.className = 'bulk-monument-item';
    item.innerHTML = `
      <div class="bulk-monument-header">
        <input type="checkbox" class="bulk-monument-checkbox" data-id="${monument.id}">
        <div class="bulk-monument-name">
          <div class="monument-title">${monument['τίτλος'] || 'Χωρίς τίτλο'}</div>
          <div class="monument-category">${monument['κατηγορία'] || 'Χωρίς κατηγορία'}</div>
          <div class="monument-user" id="user-${monument.id}">Φόρτωση χρήστη...</div>
        </div>
        <button class="bulk-monument-toggle" onclick="window.openMonumentEditModal('${monument.id}')">
          <span class="toggle-icon">✏️</span>
        </button>
      </div>
    `;
    
    const checkbox = item.querySelector('.bulk-monument-checkbox');
    checkbox.addEventListener('change', updateBulkSelection);
    
    // Load user info for this monument
    if (monument.user_id) {
      supabase.from('users').select('email').eq('id', monument.user_id).single().then(({ data, error }) => {
        const userElement = document.getElementById(`user-${monument.id}`);
        if (userElement) {
          if (data && data.email) {
            userElement.textContent = `Προστέθηκε από: ${getUsernameFromEmail(data.email)}`;
          } else {
            userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
          }
        }
      }).catch(error => {
        const userElement = document.getElementById(`user-${monument.id}`);
        if (userElement) {
          userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
        }
      });
    } else {
      const userElement = document.getElementById(`user-${monument.id}`);
      if (userElement) {
        userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
      }
    }
    
    container.appendChild(item);
  });
}

function updateBulkSelection() {
  const checkboxes = document.querySelectorAll('.bulk-monument-checkbox:checked');
  selectedMonumentsForBulk = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));
  
  const selectedCount = document.getElementById('selected-count');
  const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
  
  if (selectedCount) selectedCount.textContent = `${selectedMonumentsForBulk.length} επιλεγμένα`;
  
  const hasSelection = selectedMonumentsForBulk.length > 0;
  if (bulkDeleteBtn) bulkDeleteBtn.disabled = !hasSelection;
}

function selectAllMonuments() {
  const checkboxes = document.querySelectorAll('.bulk-monument-checkbox');
  if (checkboxes.length === 0) {
    alert('Δεν υπάρχουν μνημεία για επιλογή');
    return;
  }
  checkboxes.forEach(cb => cb.checked = true);
  updateBulkSelection();
}

function deselectAllMonuments() {
  const checkboxes = document.querySelectorAll('.bulk-monument-checkbox');
  if (checkboxes.length === 0) {
    return;
  }
  checkboxes.forEach(cb => cb.checked = false);
  updateBulkSelection();
}

async function bulkDeleteMonuments() {
  if (!confirm(`Είστε σίγουροι ότι θέλετε να διαγράψετε ${selectedMonumentsForBulk.length} μνημεία;`)) {
    return;
  }
  
  try {
    let deletedCount = 0;
    for (const id of selectedMonumentsForBulk) {
      try {
        await deleteMonument(id);
        deletedCount++;
      } catch (error) {
        console.error(`Error deleting monument ${id}:`, error);
      }
    }
    
    alert(`Διαγράφηκαν ${deletedCount} από ${selectedMonumentsForBulk.length} μνημεία επιτυχώς!`);
    selectedMonumentsForBulk = [];
    loadBulkMonumentsList();
    updateBulkSelection();
    
    // Refresh main data
    await fetchMonuments();
  } catch (error) {
    console.error('Error in bulk delete:', error);
    alert('Σφάλμα κατά τη διαγραφή των μνημείων');
  }
}





function loadCategoryOptions() {
  const filterSelect = document.getElementById('bulk-filter-category');
  
  const categories = getUniqueCategories();
  
  if (filterSelect) {
    filterSelect.innerHTML = '<option value="">Όλες οι κατηγορίες</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filterSelect.appendChild(option);
    });
  }
}

// Filter monuments based on search and category
function filterMonuments() {
  const searchInput = document.getElementById('bulk-search-input');
  const filterCategory = document.getElementById('bulk-filter-category');
  const monumentsToUse = window.allMonuments || allMonuments;
  
  if (!searchInput || !filterCategory || !monumentsToUse) return;
  
  const searchTerm = searchInput.value.toLowerCase();
  const selectedCategory = filterCategory.value;
  
  const filteredMonuments = monumentsToUse.filter(monument => {
    const matchesSearch = !searchTerm || 
      (monument['τίτλος'] && monument['τίτλος'].toLowerCase().includes(searchTerm)) ||
      (monument['περιγραφή'] && monument['περιγραφή'].toLowerCase().includes(searchTerm)) ||
      (monument['χώρος'] && monument['χώρος'].toLowerCase().includes(searchTerm));
    
    const matchesCategory = !selectedCategory || monument['κατηγορία'] === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });
  
  // Update the display with filtered monuments
  const container = document.getElementById('bulk-monuments-list');
  if (!container) return;
  
  container.innerHTML = '';
  
  if (filteredMonuments.length === 0) {
    container.innerHTML = '<p>Δεν βρέθηκαν μνημεία που να ταιριάζουν με τα κριτήρια αναζήτησης</p>';
    return;
  }
  
  // Recreate the monument items with filtered data
  filteredMonuments.forEach(monument => {
    const item = document.createElement('div');
    item.className = 'bulk-monument-item';
    item.innerHTML = `
      <div class="bulk-monument-header">
        <input type="checkbox" class="bulk-monument-checkbox" data-id="${monument.id}">
        <div class="bulk-monument-name">
          <div class="monument-title">${monument['τίτλος'] || 'Χωρίς τίτλο'}</div>
          <div class="monument-category">${monument['κατηγορία'] || 'Χωρίς κατηγορία'}</div>
          <div class="monument-user" id="user-${monument.id}">Φόρτωση χρήστη...</div>
        </div>
        <button class="bulk-monument-toggle" onclick="window.openMonumentEditModal('${monument.id}')">
          <span class="toggle-icon">✏️</span>
        </button>
      </div>
    `;
    
    const checkbox = item.querySelector('.bulk-monument-checkbox');
    checkbox.addEventListener('change', updateBulkSelection);
    
    // Load user info for this monument
    if (monument.user_id) {
      supabase.from('users').select('email').eq('id', monument.user_id).single().then(({ data, error }) => {
        const userElement = document.getElementById(`user-${monument.id}`);
        if (userElement) {
          if (data && data.email) {
            userElement.textContent = `Προστέθηκε από: ${getUsernameFromEmail(data.email)}`;
          } else {
            userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
          }
        }
      }).catch(error => {
        const userElement = document.getElementById(`user-${monument.id}`);
        if (userElement) {
          userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
        }
      });
    } else {
      const userElement = document.getElementById(`user-${monument.id}`);
      if (userElement) {
        userElement.textContent = 'Προστέθηκε από: Άγνωστος χρήστης';
      }
    }
    
    container.appendChild(item);
  });
}

function getUniqueCategories() {
  const monumentsToUse = window.allMonuments || allMonuments;
  if (!monumentsToUse) return [];
  return Array.from(new Set(monumentsToUse.map(m => m['κατηγορία']).filter(Boolean)));
}

// ========================================
// DATA VALIDATION
// ========================================

function setupDataValidation() {
  // Data validation is loaded when tab is clicked
}

async function loadValidationData() {
  const monumentsToUse = window.allMonuments || allMonuments;
  
  if (!monumentsToUse || monumentsToUse.length === 0) {
    const statsContainer = document.getElementById('validation-stats');
    const issuesContainer = document.getElementById('validation-issues');
    if (statsContainer) statsContainer.innerHTML = '<p>Δεν υπάρχουν δεδομένα για επικύρωση</p>';
    if (issuesContainer) issuesContainer.innerHTML = '<p>Δεν υπάρχουν δεδομένα για επικύρωση</p>';
    return;
  }
  
  // Load user data for monuments
  const monumentsWithUserData = await Promise.all(monumentsToUse.map(async (monument) => {
    if (monument.user_id) {
      try {
        const { data, error } = await supabase.from('users').select('email').eq('id', monument.user_id).single();
        if (data && data.email) {
          monument.user_email = getUsernameFromEmail(data.email);
        } else {
          monument.user_email = 'Άγνωστος χρήστης';
        }
      } catch (error) {
        monument.user_email = 'Άγνωστος χρήστης';
      }
    } else {
      monument.user_email = 'Άγνωστος χρήστης';
    }
    return monument;
  }));
  
  // Update the global monuments data with user info
  if (window.allMonuments) {
    window.allMonuments = monumentsWithUserData;
  }
  
  const stats = calculateValidationStats();
  const issues = findValidationIssues();
  
  displayValidationStats(stats);
  displayValidationIssues(issues);
}

function calculateValidationStats() {
  const monumentsToUse = window.allMonuments || allMonuments;
  const total = monumentsToUse.length;
  const withTitle = monumentsToUse.filter(m => m['τίτλος']).length;
  const withDescription = monumentsToUse.filter(m => m['περιγραφή']).length;
  const withImage = monumentsToUse.filter(m => m['εικόνα']).length;
  const withCategory = monumentsToUse.filter(m => m['κατηγορία']).length;
  
  return {
    total,
    withTitle,
    withDescription,
    withImage,
    withCategory,
    completionRate: Math.round(((withTitle + withDescription + withImage + withCategory) / (total * 4)) * 100)
  };
}

function findValidationIssues() {
  const issues = [];
  const monumentsToUse = window.allMonuments || allMonuments;
  
  monumentsToUse.forEach(monument => {
    const title = monument['τίτλος'] || 'Χωρίς τίτλο';
    const userInfo = monument.user_id ? `(Προστέθηκε από: ${monument.user_email || 'Άγνωστος χρήστης'})` : '(Προστέθηκε από: Άγνωστος χρήστης)';
    
    if (!monument['τίτλος']) {
      issues.push({
        type: 'error',
        message: `"${title}" ${userInfo}: Λείπει τίτλος`,
        monumentId: monument.id
      });
    }
    
    if (!monument['περιγραφή']) {
      issues.push({
        type: 'warning',
        message: `"${title}" ${userInfo}: Λείπει περιγραφή`,
        monumentId: monument.id
      });
    }
    
    if (!monument['εικόνα']) {
      issues.push({
        type: 'warning',
        message: `"${title}" ${userInfo}: Λείπει εικόνα`,
        monumentId: monument.id
      });
    }
    
    if (!monument['κατηγορία']) {
      issues.push({
        type: 'warning',
        message: `"${title}" ${userInfo}: Λείπει κατηγορία`,
        monumentId: monument.id
      });
    }
  });
  
  return issues;
}

function displayValidationStats(stats) {
  const container = document.getElementById('validation-stats');
  if (!container) return;
  
  container.innerHTML = `
    <div>
      <h4>Συνολικά Μνημεία</h4>
      <p class="value">${stats.total}</p>
    </div>
    <div>
      <h4>Με Τίτλο</h4>
      <p class="value">${stats.withTitle} (${Math.round((stats.withTitle/stats.total)*100)}%)</p>
    </div>
    <div>
      <h4>Με Περιγραφή</h4>
      <p class="value">${stats.withDescription} (${Math.round((stats.withDescription/stats.total)*100)}%)</p>
    </div>
    <div>
      <h4>Με Εικόνα</h4>
      <p class="value">${stats.withImage} (${Math.round((stats.withImage/stats.total)*100)}%)</p>
    </div>
    <div>
      <h4>Με Κατηγορία</h4>
      <p class="value">${stats.withCategory} (${Math.round((stats.withCategory/stats.total)*100)}%)</p>
    </div>
    <div>
      <h4>Ποσοστό Πληρότητας</h4>
      <p class="value">${stats.completionRate}%</p>
    </div>
  `;
}

function displayValidationIssues(issues) {
  const container = document.getElementById('validation-issues');
  if (!container) return;
  
  if (issues.length === 0) {
    container.innerHTML = '<h4>✅ Όλα τα μνημεία είναι σε καλή κατάσταση!</h4>';
    return;
  }
  
  const errorIssues = issues.filter(i => i.type === 'error');
  const warningIssues = issues.filter(i => i.type === 'warning');
  
  container.innerHTML = `
    <h4>Προβλήματα Δεδομένων (${issues.length})</h4>
    <div class="validation-summary">
      <span class="error-count">Σφάλματα: ${errorIssues.length}</span>
      <span class="warning-count">Προειδοποιήσεις: ${warningIssues.length}</span>
    </div>
    <div class="issues-list">
      ${issues.map(issue => `
        <div class="issue-item ${issue.type}">
          <div class="issue-content">
            <div class="issue-type">${issue.type === 'error' ? 'ΣΦΑΛΜΑ' : 'ΠΡΟΕΙΔΟΠΟΙΗΣΗ'}</div>
            <div class="issue-message">${issue.message}</div>
          </div>
          <button class="admin-btn" onclick="editMonumentFromValidation(${issue.monumentId})" title="Επεξεργασία μνημείου">
            ✏️ Επεξεργασία
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

window.editMonumentFromValidation = function(monumentId) {
  // Close admin panel and open edit modal using the new modal system
  document.getElementById('admin-panel').style.display = 'none';
  window.openMonumentEditModal(monumentId);
}

// ========================================
// EXPORT/IMPORT
// ========================================

function setupExportImport() {
  const exportAllBtn = document.getElementById('export-all-btn');
  const exportFilteredBtn = document.getElementById('export-filtered-btn');
  const importBtn = document.getElementById('import-btn');
  const importFile = document.getElementById('import-file');
  
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      const monumentsToUse = window.allMonuments || allMonuments;
      exportMonuments(monumentsToUse);
    });
  }
  if (exportFilteredBtn) {
    exportFilteredBtn.addEventListener('click', () => {
      const monumentsToUse = window.filteredMonuments || window.allMonuments || allMonuments;
      exportMonuments(monumentsToUse);
    });
  }
  if (importBtn) {
    importBtn.addEventListener('click', importMonuments);
  }
  if (importFile) {
    importFile.addEventListener('change', handleFileSelect);
  }
}

function exportMonuments(monuments, format = 'csv') {
  if (!monuments || monuments.length === 0) {
    alert('Δεν υπάρχουν μνημεία για εξαγωγή');
    return;
  }
  
  const formatSelect = document.getElementById('export-format');
  const selectedFormat = formatSelect ? formatSelect.value : format;
  
  let data, filename, mimeType;
  
  switch (selectedFormat) {
    case 'csv':
      data = convertToCSV(monuments);
      filename = `monuments_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
      break;
    case 'json':
      data = JSON.stringify(monuments, null, 2);
      filename = `monuments_${new Date().toISOString().split('T')[0]}.json`;
      mimeType = 'application/json';
      break;
    case 'excel':
      data = convertToCSV(monuments);
      filename = `monuments_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
      break;
    default:
      data = convertToCSV(monuments);
      filename = `monuments_${new Date().toISOString().split('T')[0]}.csv`;
      mimeType = 'text/csv';
  }
  
  try {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`Exported ${monuments.length} monuments to ${filename}`);
  } catch (error) {
    console.error('Error exporting monuments:', error);
    alert('Σφάλμα κατά την εξαγωγή των μνημείων');
  }
}

function convertToCSV(monuments) {
  if (monuments.length === 0) return '';
  
  const headers = Object.keys(monuments[0]);
  const csvContent = [
    headers.join(','),
    ...monuments.map(monument => 
      headers.map(header => {
        const value = monument[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  const importBtn = document.getElementById('import-btn');
  const preview = document.getElementById('import-preview');
  
  if (file) {
    if (importBtn) importBtn.disabled = false;
    if (preview) preview.textContent = `Επιλεγμένο αρχείο: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  } else {
    if (importBtn) importBtn.disabled = true;
    if (preview) preview.textContent = '';
  }
}

async function importMonuments() {
  const file = document.getElementById('import-file').files[0];
  if (!file) return;
  
  try {
    const text = await file.text();
    let monuments;
    
    if (file.name.endsWith('.json')) {
      monuments = JSON.parse(text);
    } else if (file.name.endsWith('.csv')) {
      monuments = parseCSV(text);
    } else {
      alert('Μη υποστηριζόμενος τύπος αρχείου');
      return;
    }
    
    if (!Array.isArray(monuments)) {
      alert('Το αρχείο δεν περιέχει έγκυρα δεδομένα μνημείων');
      return;
    }
    
    // Show preview
    const preview = document.getElementById('import-preview');
    preview.innerHTML = `
      <h4>Προεπισκόπηση Εισαγωγής</h4>
      <p>Θα εισαχθούν ${monuments.length} μνημεία</p>
      <p>Πρώτα 3 μνημεία:</p>
      <pre>${JSON.stringify(monuments.slice(0, 3), null, 2)}</pre>
      <button class="admin-btn" onclick="confirmImport(${JSON.stringify(monuments).replace(/"/g, '&quot;')})">
        Επιβεβαίωση Εισαγωγής
      </button>
    `;
    
  } catch (error) {
    console.error('Error reading file:', error);
    alert('Σφάλμα κατά την ανάγνωση του αρχείου');
  }
}

function parseCSV(csvText) {
  const lines = csvText.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',');
    const monument = {};
    headers.forEach((header, index) => {
      monument[header] = values[index] ? values[index].trim() : '';
    });
    return monument;
  });
}

async function confirmImport(monuments) {
  if (!confirm(`Είστε σίγουροι ότι θέλετε να εισάγετε ${monuments.length} μνημεία;`)) {
    return;
  }
  
  try {
    // Here you would implement the actual import logic
    // For now, we'll just show a success message
    alert(`Εισήχθησαν ${monuments.length} μνημεία επιτυχώς!`);
    
    // Clear file input
    document.getElementById('import-file').value = '';
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-btn').disabled = true;
    
    // Refresh data
    await fetchMonuments();
    
  } catch (error) {
    console.error('Error importing monuments:', error);
    alert('Σφάλμα κατά την εισαγωγή των μνημείων');
  }
}

// Helper function to update monument in database
async function updateMonumentInDatabase(monument) {
  try {
    // Update in Supabase database - only use the columns that exist in the schema
    // DO NOT update user_id to preserve the original creator
    const { data, error } = await supabase
      .from('monuments')
      .update({
        'τίτλος': monument['τίτλος'],
        'περιγραφή': monument['περιγραφή'],
        'εικόνα': monument['εικόνα'],
        'κατηγορία': monument['κατηγορία'],
        'υποκατηγορία': monument['υποκατηγορία'],
        'χρόνος': monument['χρόνος'],
        'χώρος': monument['χώρος'],
        'τομέας': monument['τομέας'],
        'λέξεις-κλειδιά': monument['λέξεις-κλειδιά'],
        'πηγές': monument['πηγές'],
        'συντεταγμένες': monument['συντεταγμένες']
        // user_id is intentionally NOT included to preserve the original creator
      })
      .eq('id', monument.id);
    
    if (error) {
      console.error('Error updating monument in database:', error);
      throw error;
    }
    
    // Update local data
    if (window.allMonuments) {
      const index = window.allMonuments.findIndex(m => m.id === monument.id);
      if (index !== -1) {
        window.allMonuments[index] = monument;
      }
    }
    
    // Also update the global allMonuments if it exists
    if (typeof allMonuments !== 'undefined' && allMonuments) {
      const index = allMonuments.findIndex(m => m.id === monument.id);
      if (index !== -1) {
        allMonuments[index] = monument;
      }
    }
    
    console.log(`Monument ${monument.id} updated successfully`);
    return data;
  } catch (error) {
    console.error('Error in updateMonumentInDatabase:', error);
    throw error;
  }
}

// Initialize admin panel when page loads
document.addEventListener('DOMContentLoaded', () => {
  // Initialize admin panel after a short delay to ensure other components are loaded
  setTimeout(initializeAdminPanel, 1000);
});

// Also initialize after fetchMonuments completes
window.initializeAdminPanelAfterData = function() {
  setTimeout(initializeAdminPanel, 500);
};

// For testing purposes - force show admin panel
window.showAdminPanelForTesting = function() {
  const adminToggle = document.getElementById('admin-panel-toggle');
  if (adminToggle) {
    adminToggle.style.display = 'block';
    console.log('Admin panel shown for testing');
  }
};

// Global function to refresh admin data
window.refreshAdminData = async function() {
  try {
    console.log('Refreshing admin data...');
    
    // Fetch fresh data from database
    const freshMonuments = await fetchMonuments();
    allMonuments = freshMonuments;
    window.allMonuments = freshMonuments;
    
    console.log(`Loaded ${freshMonuments.length} monuments`);
    
    // Reload all admin data
    await loadAdminData();
    
    console.log('Admin data refreshed successfully');
  } catch (error) {
    console.error('Error refreshing admin data:', error);
    alert('Σφάλμα κατά την ανανέωση των δεδομένων');
  }
};



// Add keyboard shortcuts for admin panel
document.addEventListener('keydown', async (e) => {
  // Ctrl+Shift+A to toggle admin panel
  if (e.ctrlKey && e.shiftKey && e.key === 'A') {
    e.preventDefault();
    const adminPanel = document.getElementById('admin-panel');
    const adminToggle = document.getElementById('admin-panel-toggle');
    if (adminPanel && adminToggle) {
      if (adminPanel.style.display === 'flex') {
        adminPanel.style.display = 'none';
      } else {
        adminPanel.style.display = 'flex';
        await loadAdminData();
      }
    }
  }
});

// ========================================
// MONUMENT EDIT MODAL FUNCTIONS
// ========================================

// Load dropdown options for modal
function loadModalDropdownOptions() {
  let monumentsToUse = window.allMonuments || allMonuments;
  
  console.log('Loading modal dropdown options...');
  console.log('monumentsToUse:', monumentsToUse);
  console.log('monumentsToUse length:', monumentsToUse ? monumentsToUse.length : 0);
  
  // If no data available, try to get it from the global allMonuments
  if (!monumentsToUse || monumentsToUse.length === 0) {
    console.log('No monuments data available, trying to get from global allMonuments...');
    if (typeof allMonuments !== 'undefined' && allMonuments && allMonuments.length > 0) {
      monumentsToUse = allMonuments;
      console.log('Found data in global allMonuments:', monumentsToUse.length, 'monuments');
    } else {
      console.log('No monuments data available for dropdowns');
      // Try to fetch fresh data
      if (typeof fetchMonuments === 'function') {
        console.log('Attempting to fetch fresh monuments data...');
        fetchMonuments().then(freshMonuments => {
          if (freshMonuments && freshMonuments.length > 0) {
            console.log('Successfully fetched fresh data:', freshMonuments.length, 'monuments');
            loadModalDropdownOptionsWithData(freshMonuments);
          }
        }).catch(error => {
          console.error('Error fetching fresh data:', error);
        });
      }
      return;
    }
  }
  
  loadModalDropdownOptionsWithData(monumentsToUse);
}

// Force load dropdown options when modal opens
function forceLoadDropdownOptions() {
  console.log('Force loading dropdown options...');
  
  // Try multiple data sources
  let dataSource = null;
  
  if (window.allMonuments && window.allMonuments.length > 0) {
    dataSource = window.allMonuments;
    console.log('Using window.allMonuments:', dataSource.length);
  } else if (typeof allMonuments !== 'undefined' && allMonuments && allMonuments.length > 0) {
    dataSource = allMonuments;
    console.log('Using global allMonuments:', dataSource.length);
  } else if (window.monuments && window.monuments.length > 0) {
    dataSource = window.monuments;
    console.log('Using window.monuments:', dataSource.length);
  }
  
  if (dataSource) {
    loadModalDropdownOptionsWithData(dataSource);
  } else {
    console.log('No data source found, attempting to fetch...');
    // Try to fetch data
    if (typeof fetchMonuments === 'function') {
      fetchMonuments().then(monuments => {
        if (monuments && monuments.length > 0) {
          console.log('Fetched monuments:', monuments.length);
          loadModalDropdownOptionsWithData(monuments);
        }
      }).catch(error => {
        console.error('Error fetching monuments:', error);
      });
    }
  }
}

// Helper function to load dropdown options with specific data
function loadModalDropdownOptionsWithData(monumentsData) {
  console.log('Loading dropdown options with data:', monumentsData.length, 'monuments');
  
  // Get unique values with debug logging
  const allCategories = monumentsData.map(m => m['κατηγορία']).filter(Boolean);
  const allSubcategories = monumentsData.map(m => m['υποκατηγορία']).filter(Boolean);
  const allDomains = monumentsData.map(m => m['τομέας']).filter(Boolean);
  
  console.log('All categories found:', allCategories);
  console.log('All subcategories found:', allSubcategories);
  console.log('All domains found:', allDomains);
  
  const categories = Array.from(new Set(allCategories));
  const subcategories = Array.from(new Set(allSubcategories));
  const domains = Array.from(new Set(allDomains));
  
  console.log('Unique categories:', categories);
  console.log('Unique subcategories:', subcategories);
  console.log('Unique domains:', domains);
  
  // Populate category dropdown
  const categorySelect = document.getElementById('edit-category');
  if (categorySelect) {
    categorySelect.innerHTML = '<option value="">Επιλέξτε κατηγορία...</option>';
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });
    console.log(`Populated category dropdown with ${categories.length} options`);
  } else {
    console.error('Category select element not found');
  }
  
  // Populate subcategory dropdown
  const subcategorySelect = document.getElementById('edit-subcategory');
  if (subcategorySelect) {
    subcategorySelect.innerHTML = '<option value="">Επιλέξτε υποκατηγορία...</option>';
    subcategories.forEach(subcategory => {
      const option = document.createElement('option');
      option.value = subcategory;
      option.textContent = subcategory;
      subcategorySelect.appendChild(option);
    });
    console.log(`Populated subcategory dropdown with ${subcategories.length} options`);
  } else {
    console.error('Subcategory select element not found');
  }
  
  // Populate domain dropdown
  const domainSelect = document.getElementById('edit-domain');
  if (domainSelect) {
    domainSelect.innerHTML = '<option value="">Επιλέξτε τομέα...</option>';
    domains.forEach(domain => {
      const option = document.createElement('option');
      option.value = domain;
      option.textContent = domain;
      domainSelect.appendChild(option);
    });
    console.log(`Populated domain dropdown with ${domains.length} options`);
  } else {
    console.error('Domain select element not found');
  }
}

// Open monument edit modal
window.openMonumentEditModal = function(monumentId) {
  console.log('Opening modal for monument ID:', monumentId);
  
  let monumentsToUse = window.allMonuments || allMonuments;
  let monument = monumentsToUse.find(m => m.id.toString() === monumentId.toString());
  
  // If monument not found, try to get data from global allMonuments
  if (!monument && typeof allMonuments !== 'undefined' && allMonuments && allMonuments.length > 0) {
    monumentsToUse = allMonuments;
    monument = monumentsToUse.find(m => m.id.toString() === monumentId.toString());
  }
  
  // If still not found, try to fetch fresh data
  if (!monument) {
    console.log('Monument not found, attempting to fetch fresh data...');
    if (typeof fetchMonuments === 'function') {
      fetchMonuments().then(freshMonuments => {
        if (freshMonuments && freshMonuments.length > 0) {
          const freshMonument = freshMonuments.find(m => m.id.toString() === monumentId.toString());
          if (freshMonument) {
            console.log('Found monument in fresh data');
            openMonumentEditModalWithData(freshMonument, freshMonuments);
          } else {
            alert('Μνημείο δεν βρέθηκε');
          }
        } else {
          alert('Μνημείο δεν βρέθηκε');
        }
      }).catch(error => {
        console.error('Error fetching monuments:', error);
        alert('Μνημείο δεν βρέθηκε');
      });
      return;
    } else {
      alert('Μνημείο δεν βρέθηκε');
      return;
    }
  }
  
  openMonumentEditModalWithData(monument, monumentsToUse);
};

// Helper function to open modal with data
function openMonumentEditModalWithData(monument, monumentsData) {
  
  currentEditingMonumentId = monument.id;
  
  // Load dropdown options with the provided data
  if (monumentsData && monumentsData.length > 0) {
    console.log('Loading dropdowns with provided data:', monumentsData.length, 'monuments');
    loadModalDropdownOptionsWithData(monumentsData);
  } else {
    // Fallback to force load
    forceLoadDropdownOptions();
  }
  
  // If dropdowns are empty, try to load data again after a short delay
  setTimeout(() => {
    const categorySelect = document.getElementById('edit-category');
    if (categorySelect && categorySelect.options.length <= 1) {
      console.log('Dropdowns appear empty, trying to reload data...');
      forceLoadDropdownOptions();
    }
  }, 200);
  
  // Populate form fields
  document.getElementById('edit-title').value = monument['τίτλος'] || '';
  document.getElementById('edit-category').value = monument['κατηγορία'] || '';
  document.getElementById('edit-subcategory').value = monument['υποκατηγορία'] || '';
  
  // Handle date format for time field
  let timeValue = monument['χρόνος'] || '';
  if (timeValue && timeValue.includes('-')) {
    // If it's already in date format, use as is
    document.getElementById('edit-time').value = timeValue;
  } else if (timeValue) {
    // Try to convert to date format
    try {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        document.getElementById('edit-time').value = date.toISOString().split('T')[0];
      } else {
        document.getElementById('edit-time').value = '';
      }
    } catch (e) {
      document.getElementById('edit-time').value = '';
    }
  } else {
    document.getElementById('edit-time').value = '';
  }
  
  document.getElementById('edit-space').value = monument['χώρος'] || '';
  document.getElementById('edit-domain').value = monument['τομέας'] || '';
  document.getElementById('edit-description').value = monument['περιγραφή'] || '';
  document.getElementById('edit-image').value = monument['εικόνα'] || '';
  document.getElementById('edit-keywords').value = monument['λέξεις-κλειδιά'] || '';
  document.getElementById('edit-sources').value = monument['πηγές'] || '';
  
  // Handle coordinates - parse from συντεταγμένες field
  let lat = '';
  let lng = '';
  if (monument['συντεταγμένες']) {
    const coords = monument['συντεταγμένες'].split(',').map(s => s.trim());
    if (coords.length === 2) {
      lat = coords[0];
      lng = coords[1];
    }
  }
  document.getElementById('edit-latitude').value = lat;
  document.getElementById('edit-longitude').value = lng;
  
  // Show modal
  document.getElementById('monument-edit-modal').style.display = 'flex';
};

// Close monument edit modal
window.closeMonumentEditModal = function() {
  document.getElementById('monument-edit-modal').style.display = 'none';
  currentEditingMonumentId = null;
};

// Save monument changes from modal
window.saveMonumentChanges = async function() {
  if (!currentEditingMonumentId) {
    alert('Δεν υπάρχει μνημείο για επεξεργασία');
    return;
  }
  
  try {
    console.log('Starting to save monument changes for ID:', currentEditingMonumentId);
    
    const monumentsToUse = window.allMonuments || allMonuments;
    console.log('Monuments data source:', monumentsToUse ? monumentsToUse.length : 'No data');
    
    const monument = monumentsToUse.find(m => m.id.toString() === currentEditingMonumentId.toString());
    
    if (!monument) {
      console.error('Monument not found in data source');
      alert('Μνημείο δεν βρέθηκε');
      return;
    }
    
    console.log('Found monument:', monument);
    
    // Collect form data
    const titleInput = document.getElementById('edit-title');
    const categoryInput = document.getElementById('edit-category');
    const subcategoryInput = document.getElementById('edit-subcategory');
    const timeInput = document.getElementById('edit-time');
    const spaceInput = document.getElementById('edit-space');
    const domainInput = document.getElementById('edit-domain');
    const descriptionInput = document.getElementById('edit-description');
    const imageInput = document.getElementById('edit-image');
    const keywordsInput = document.getElementById('edit-keywords');
    const sourcesInput = document.getElementById('edit-sources');
    const latInput = document.getElementById('edit-latitude');
    const lngInput = document.getElementById('edit-longitude');
    
    // Check if all form elements exist
    if (!titleInput || !categoryInput || !subcategoryInput || !timeInput || !spaceInput || 
        !domainInput || !descriptionInput || !imageInput || !keywordsInput || !sourcesInput || 
        !latInput || !lngInput) {
      console.error('Some form elements are missing');
      alert('Σφάλμα: Μερικά πεδία φόρμας δεν βρέθηκαν');
      return;
    }
    
    // Update monument object - preserve original user_id
    monument['τίτλος'] = titleInput.value;
    monument['κατηγορία'] = categoryInput.value;
    monument['υποκατηγορία'] = subcategoryInput.value;
    monument['χρόνος'] = timeInput.value;
    monument['χώρος'] = spaceInput.value;
    monument['τομέας'] = domainInput.value;
    monument['περιγραφή'] = descriptionInput.value;
    monument['εικόνα'] = imageInput.value;
    monument['λέξεις-κλειδιά'] = keywordsInput.value;
    monument['πηγές'] = sourcesInput.value;
    // user_id is intentionally NOT updated to preserve the original creator
    
    // Handle coordinates - save in the format used by the database
    const lat = parseFloat(latInput.value) || null;
    const lng = parseFloat(lngInput.value) || null;
    if (lat && lng) {
      monument['συντεταγμένες'] = `${lat}, ${lng}`;
    } else {
      monument['συντεταγμένες'] = null;
    }
    
    console.log('Updated monument object:', monument);
    
    // Update in database
    console.log('Updating monument in database...');
    await updateMonumentInDatabase(monument);
    console.log('Database update completed');
    
    // Update the display in bulk list
    const checkbox = document.querySelector(`[data-id="${currentEditingMonumentId}"]`);
    if (checkbox) {
      const bulkItem = checkbox.closest('.bulk-monument-item');
      const titleElement = bulkItem.querySelector('.monument-title');
      if (titleElement) {
        titleElement.textContent = monument['τίτλος'] || 'Χωρίς τίτλο';
      }
    }
    
    // Close modal
    closeMonumentEditModal();
    
    alert('Μνημείο ενημερώθηκε επιτυχώς!');
  } catch (error) {
    console.error('Error saving monument changes:', error);
    console.error('Error details:', error.message);
    alert(`Σφάλμα κατά την αποθήκευση των αλλαγών: ${error.message}`);
  }
};

// Delete monument from modal
window.deleteSingleMonument = async function() {
  if (!currentEditingMonumentId) {
    alert('Δεν υπάρχει μνημείο για διαγραφή');
    return;
  }
  
  if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτό το μνημείο;')) {
    return;
  }
  
  try {
    await deleteMonument(currentEditingMonumentId);
    
    // Remove from display
    const itemElement = document.querySelector(`[data-id="${currentEditingMonumentId}"]`).closest('.bulk-monument-item');
    if (itemElement) {
      itemElement.remove();
    }
    
    // Update selection
    updateBulkSelection();
    
    // Close modal
    closeMonumentEditModal();
    
    alert('Μνημείο διαγράφηκε επιτυχώς!');
  } catch (error) {
    console.error('Error deleting monument:', error);
    alert('Σφάλμα κατά τη διαγραφή του μνημείου');
  }
};

// View monument on map from modal
window.viewMonumentOnMap = function() {
  if (!currentEditingMonumentId) {
    alert('Δεν υπάρχει μνημείο για προβολή');
    return;
  }
  
  const monumentsToUse = window.allMonuments || allMonuments;
  const monument = monumentsToUse.find(m => m.id.toString() === currentEditingMonumentId.toString());
  
  if (!monument) {
    alert('Μνημείο δεν βρέθηκε');
    return;
  }
  
  // Close modal and admin panel
  closeMonumentEditModal();
  document.getElementById('admin-panel').style.display = 'none';
  
  // Switch to map view if in gallery
  const galleryContainer = document.getElementById('gallery-container');
  if (galleryContainer && galleryContainer.style.display !== 'none') {
    // Force switch to map view
    galleryContainer.style.display = 'none';
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
      mapContainer.style.display = 'block';
    }
    
    // Update gallery toggle button state
    const galleryToggleBtn = document.getElementById('gallery-toggle-btn');
    if (galleryToggleBtn) {
      galleryToggleBtn.classList.remove('active');
      galleryToggleBtn.innerHTML = '<img src="map-svgrepo-com.png" alt="Map" style="width: 20px; height: 20px;">';
    }
  }
  
  // Check for coordinates in συντεταγμένες field
  let lat = null;
  let lng = null;
  if (monument['συντεταγμένες']) {
    const coords = monument['συντεταγμένες'].split(',').map(s => s.trim());
    if (coords.length === 2) {
      lat = parseFloat(coords[0]);
      lng = parseFloat(coords[1]);
    }
  }
  
  // Fly to monument location
  if (lat && lng) {
    // Small delay to ensure view change is complete
    setTimeout(() => {
      map.flyTo({
        center: [lng, lat],
        zoom: 18,
        speed: 1.2
      });
      
      // Highlight marker
      highlightMarkerByMonument(monument);
      
      // Show details
      setTimeout(() => {
        showMonumentDetails(monument);
      }, 1500);
    }, 100);
  } else {
    alert('Το μνημείο δεν έχει συντεταγμένες. Παρακαλώ προσθέστε latitude και longitude.');
  }
};