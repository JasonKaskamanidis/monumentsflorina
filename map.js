import { requireAuth, logout } from './auth.js';
import { supabase } from './supabaseClient.js';

// --- User/Role State ---
let currentUser = null;
let currentRole = 'user';

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
      ${isVisitor ? `<div class="visitor-message" style="background:#ffe9b3;color:#a67c00;padding:0.7rem 1rem;border-radius:8px;font-weight:600;text-align:center;margin-bottom:1.2rem;">Επισκέπτης: Μόνο προβολή</div>` : ''}
      <div id="user-info-container"></div>
      <div style="margin:0.7rem 0 1.1rem 0; text-align:center; font-size:0.97em; color:#8a8a8a;">Developed by Jason Kaskamanidis 2025</div>
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
          <label for="filter-time-min">Χρόνος: <span id="time-slider-value"></span></label>
          <div style="display:flex;align-items:center;gap:0.7em;">
            <input type="range" id="filter-time-min" class="filter-slider" min="0" max="100" value="0">
            <span style="font-size:0.97em;">έως</span>
            <input type="range" id="filter-time-max" class="filter-slider" min="0" max="100" value="100">
          </div>
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
  document.getElementById('domain-dropdown-menu').innerHTML = domains.map(val => `<label><input type="checkbox" name="domain-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Κατηγορία
  const categories = getUnique('κατηγορία');
  document.getElementById('category-dropdown-menu').innerHTML = categories.map(val => `<label><input type="checkbox" name="category-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Υποκατηγορία
  const subcategories = getUnique('υποκατηγορία');
  document.getElementById('subcategory-dropdown-menu').innerHTML = subcategories.map(val => `<label><input type="checkbox" name="subcategory-filter" value="${val}"> ${val}</label>`).join('<br>');
  // Χρόνος (two-way slider by year)
  const years = getUnique('χρόνος').map(v => {
    const y = String(v).slice(0,4);
    return (/^\d{4}$/.test(y)) ? Number(y) : null;
  }).filter(n => n);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const minSlider = document.getElementById('filter-time-min');
  const maxSlider = document.getElementById('filter-time-max');
  minSlider.min = minYear;
  minSlider.max = maxYear;
  maxSlider.min = minYear;
  maxSlider.max = maxYear;
  minSlider.value = minYear;
  maxSlider.value = maxYear;
  function updateSliderLabel() {
    document.getElementById('time-slider-value').textContent = `${minSlider.value} - ${maxSlider.value}`;
  }
  minSlider.oninput = function() {
    if (Number(minSlider.value) > Number(maxSlider.value)) minSlider.value = maxSlider.value;
    updateSliderLabel();
    filterAndShowMonuments();
  };
  maxSlider.oninput = function() {
    if (Number(maxSlider.value) < Number(minSlider.value)) maxSlider.value = minSlider.value;
    updateSliderLabel();
    filterAndShowMonuments();
  };
  updateSliderLabel();
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
  // Χρόνος (two-way slider by year)
  const minYear = Number(document.getElementById('filter-time-min').value);
  const maxYear = Number(document.getElementById('filter-time-max').value);
  filtered = filtered.filter(m => {
    const y = String(m['χρόνος']).slice(0,4);
    const year = Number(y);
    return year >= minYear && year <= maxYear;
  });
  if (minYear !== Number(document.getElementById('filter-time-min').min) || maxYear !== Number(document.getElementById('filter-time-max').max)) {
    activeFilters.push({type: 'Χρόνος', value: `${minYear} - ${maxYear}`, name: 'year-range'});
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
        document.getElementById('filter-time-min').value = document.getElementById('filter-time-min').min;
        document.getElementById('filter-time-max').value = document.getElementById('filter-time-max').max;
      } else {
        const selector = `input[name='${type}'][value='${value}']`;
        const input = document.querySelector(selector);
        if (input) input.checked = false;
      }
      filterAndShowMonuments();
    };
  });

  // --- Update Timeline ---
  if (timelineLoaded && timelineContainer.style.display !== 'none') {
    // Preprocess to offset items with the same day
    const dateMap = {};
    const filteredTimelineData = filtered.map((row, idx) => {
      let date = row['χρόνος']?.trim();
      if (!date || isNaN(Date.parse(date))) return null;
      const dayKey = date.slice(0, 10);
      if (!dateMap[dayKey]) dateMap[dayKey] = 0;
      const offsetMinutes = dateMap[dayKey] * 5;
      dateMap[dayKey]++;
      const offsetDate = new Date(date);
      offsetDate.setMinutes(offsetDate.getMinutes() + offsetMinutes);
      return {
        id: idx + 1,
        content: `<span style='font-size:0.95em;font-family:sans-serif;font-weight:500;'>${row['τίτλος'] || ''}</span>`,
        start: offsetDate.toISOString(),
        title: row['περιγραφή'] || '',
        data: row
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
    // Update timeline
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
  document.getElementById('filter-time-min').value = '';
  document.getElementById('filter-time-max').value = '';
  Array.from(document.querySelectorAll('#filters-section input[type=checkbox]')).forEach(cb => cb.checked = false);
  filterAndShowMonuments();
};

fetchMonuments().then(monuments => {
  allMonuments = monuments;
  populateSidePanelFilters(monuments);
  filterAndShowMonuments();
});

// --- Show logged in user UI ---
function getUsernameFromEmail(email) {
  return email ? email.split('@')[0] : '';
}

function showLoggedInUserUI(email) {
  let container = document.getElementById('user-info-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'user-info-container';
    document.getElementById('side-panel').prepend(container);
  }
  let userDiv = document.getElementById('logged-in-user');
  if (!userDiv) {
    userDiv = document.createElement('div');
    userDiv.id = 'logged-in-user';
    container.appendChild(userDiv);
  }
  userDiv.textContent = `Γεια σας, ${getUsernameFromEmail(email)} 👋`;
}

showLoggedInUserUI(currentUser?.email);

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

  const domainSelect = document.getElementById('form-domain-select');
  const categorySelect = document.getElementById('form-category-select');
  const subcategorySelect = document.getElementById('form-subcategory-select');

  domainSelect.innerHTML = '<option value="">-- Επιλέξτε --</option>' + domains.map(val => `<option value="${val}"${selected['τομέας'] === val ? ' selected' : ''}>${val}</option>`).join('');
  categorySelect.innerHTML = '<option value="">-- Επιλέξτε --</option>' + categories.map(val => `<option value="${val}"${selected['κατηγορία'] === val ? ' selected' : ''}>${val}</option>`).join('');
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

function clearMarkers() {
  currentMarkers.forEach(marker => marker.remove());
  currentMarkers = [];
}

function addMarkers(monuments) {
  monuments.forEach(monument => {
    if (!monument['συντεταγμένες']) return;
    const [lat, lng] = monument['συντεταγμένες'].split(',').map(s => Number(s.trim()));
    if (isNaN(lat) || isNaN(lng)) return;
    const marker = new mapboxgl.Marker()
      .setLngLat([lng, lat])
      .addTo(map);
    marker.getElement().addEventListener('click', () => showMonumentDetails(monument));
    currentMarkers.push(marker);
  });
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
    // Wait for PapaParse to load
    while (!window.Papa) { await new Promise(r => setTimeout(r, 50)); }
    // Fetch and parse CSV
    const response = await fetch('data.csv');
    const csvText = await response.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    // Map to vis-timeline items
    const dateMap = {};
    timelineData = parsed.data.map((row, idx) => {
      let date = row['χρόνος']?.trim();
      // If date is missing or invalid, skip
      if (!date || isNaN(Date.parse(date))) return null;
      // Only use YYYY-MM-DD for grouping
      const dayKey = date.slice(0, 10);
      if (!dateMap[dayKey]) dateMap[dayKey] = 0;
      // Offset by minutes for same-day events
      const offsetMinutes = dateMap[dayKey] * 5;
      dateMap[dayKey]++;
      const offsetDate = new Date(date);
      offsetDate.setMinutes(offsetDate.getMinutes() + offsetMinutes);
      return {
        id: idx + 1,
        content: `<span style='font-size:0.95em;font-family:sans-serif;font-weight:500;'>${row['τίτλος'] || ''}</span>`,
        start: offsetDate.toISOString(),
        title: row['περιγραφή'] || '',
        data: row
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
        return `<div style='background:none;border:none;box-shadow:none;padding:2px 0;'>${item.content}</div>`;
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
    timelineInstance.on('select', function (props) {
      if (!props.items.length) return;
      const item = timelineData.find(i => i.id === props.items[0]);
      if (!item) return;
      // Use existing modal for details
      showMonumentDetails(item.data);
    });
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
  if (filtersSection && !document.getElementById('open-data-viz-btn')) {
    // Find the Λέξεις κλειδιά filter-group
    const filterGroups = filtersSection.querySelectorAll('.filter-group');
    let keywordsGroup = null;
    filterGroups.forEach(g => {
      if (g.textContent.includes('Λέξεις κλειδιά')) keywordsGroup = g;
    });
    if (keywordsGroup) {
      const btn = document.createElement('button');
      btn.id = 'open-data-viz-btn';
      btn.textContent = '📊 Δεδομένα & Διαγράμματα';
      btn.className = 'data-viz-btn';
      btn.style.margin = '1.1rem 0 0.2rem 0';
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
      keywordsGroup.appendChild(btn);
    }
    // Add the modal HTML if not present
    if (!document.getElementById('data-viz-modal')) {
      const modal = document.createElement('div');
      modal.id = 'data-viz-modal';
      modal.style.display = 'none';
      modal.innerHTML = `
        <div class="data-viz-backdrop"></div>
        <div class="data-viz-dialog">
          <button id="close-data-viz-btn" class="data-viz-close">&times;</button>
          <h2 style="margin-bottom:1.2rem;">Διαδραστικά Διαγράμματα Δεδομένων</h2>
          <div id="data-viz-charts" style="width:100%;max-width:900px;margin:auto;display:flex;flex-wrap:wrap;gap:2.2rem;justify-content:center;"></div>
        </div>
      `;
      modal.className = 'data-viz-modal';
      document.body.appendChild(modal);
      // Close logic
      const closeBtn = document.getElementById('close-data-viz-btn');
      if (closeBtn) closeBtn.onclick = () => {
        modal.style.display = 'none';
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) sidePanel.classList.remove('data-viz-open');
      };
      const backdrop = modal.querySelector('.data-viz-backdrop');
      if (backdrop) backdrop.onclick = () => {
        modal.style.display = 'none';
        const sidePanel = document.getElementById('side-panel');
        if (sidePanel) sidePanel.classList.remove('data-viz-open');
      };
    }
    // Button click logic
    document.getElementById('open-data-viz-btn').onclick = async () => {
      // Load Chart.js if not loaded
      if (!window.Chart) {
        const chartScript = document.createElement('script');
        chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(chartScript);
        await new Promise(r => { chartScript.onload = r; });
      }
      // Prepare data
      let filtered = window.filteredMonuments || window.allMonuments || [];
      if (!Array.isArray(filtered)) filtered = [];
      // Prepare chart data
      const chartsDiv = document.getElementById('data-viz-charts');
      chartsDiv.innerHTML = '';
      // --- Drilldown and List in Same Modal ---
      let drilldownState = { level: 'root', domain: null, category: null };
      function showMonumentDetailsInViz(monument, backToListFn) {
        let listDiv = document.getElementById('data-viz-list');
        if (!listDiv) return;
        let html = `<button id='back-to-list-btn' style='margin-bottom:1.2rem;background:#eee;border:none;border-radius:8px;padding:0.5em 1.2em;cursor:pointer;font-size:1.05em;'>← Επιστροφή στη λίστα</button>`;
        html += `<div style='background:#fff;padding:1.5rem 1.2rem;border-radius:16px;max-width:600px;margin:auto;box-shadow:0 4px 32px rgba(0,0,0,0.10);'>`;
        if (monument['εικόνα']) {
          html += `<div style='text-align:center;margin-bottom:1rem;'><img src='${monument['εικόνα']}' alt='Εικόνα' style='max-width:100%;max-height:220px;border-radius:10px;'></div>`;
        }
        html += `<h2 style='margin-bottom:0.7rem;'>${monument['τίτλος']||''}</h2>`;
        html += `<div style='margin-bottom:1rem;'>${monument['περιγραφή']||''}</div>`;
        html += `<div><strong>Χώρος:</strong> ${monument['χώρος']||''}</div>`;
        html += `<div><strong>Χρόνος:</strong> ${monument['χρόνος']||''}</div>`;
        html += `<div><strong>Τομέας:</strong> ${monument['τομέας']||''}</div>`;
        html += `<div><strong>Κατηγορία:</strong> ${monument['κατηγορία']||''}</div>`;
        html += `<div style='margin:0.7rem 0;'><strong>Λέξεις κλειδιά:</strong> ${(monument['λέξεις-κλειδιά']||'').split(',').filter(Boolean).slice(0,3).join(', ')}</div>`;
        if (monument['πηγές']) html += `<div style='margin-bottom:0.7rem;'><strong>Πηγές:</strong> ${monument['πηγές']}</div>`;
        html += `</div>`;
        listDiv.innerHTML = html;
        document.getElementById('back-to-list-btn').onclick = backToListFn;
      }
      function showMonumentListInViz(monuments, title) {
        let listDiv = document.getElementById('data-viz-list');
        if (!listDiv) {
          listDiv = document.createElement('div');
          listDiv.id = 'data-viz-list';
          listDiv.style = 'width:100%;max-width:700px;margin:2.2rem auto 0 auto;';
          chartsDiv.parentElement.appendChild(listDiv);
        }
        let html = `<h3 style='margin-bottom:1.2rem;'>${title}</h3>`;
        if (monuments.length === 0) {
          html += '<div style="color:#888;">Δεν βρέθηκαν μνημεία.</div>';
        } else {
          html += '<ul style="list-style:none;padding:0;max-width:600px;">';
          monuments.forEach(m => {
            html += `<li style='margin-bottom:0.7em;padding:0.5em 0.2em;border-bottom:1px solid #eee;'><b>${m['τίτλος']||''}</b> <span style='color:#888;'>(${m['χρόνος']||''})</span> <button style='margin-left:1em;background:#fbbf24;border:none;border-radius:6px;padding:0.2em 0.7em;cursor:pointer;' data-id='${m.id}'>Λεπτομέρειες</button></li>`;
          });
          html += '</ul>';
        }
        listDiv.innerHTML = html;
        // Attach detail button handlers
        listDiv.querySelectorAll('button[data-id]').forEach(btn => {
          btn.onclick = () => {
            const m = monuments.find(x => String(x.id) === btn.getAttribute('data-id'));
            if (m) showMonumentDetailsInViz(m, () => showMonumentListInViz(monuments, title));
          };
        });
        listDiv.style.display = 'block';
      }
      function renderCharts(drilldown) {
        chartsDiv.innerHTML = '';
        // Always get the latest filtered data
        let filtered = window.filteredMonuments || window.allMonuments || [];
        if (!Array.isArray(filtered)) filtered = [];
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
      // Initial render
      renderCharts(drilldownState);
      document.getElementById('data-viz-modal').style.display = 'flex';
      // Hide the backdrop
      const backdrop = document.querySelector('#data-viz-modal .data-viz-backdrop');
      if (backdrop) backdrop.style.display = 'none';
      // Make side panel usable
      const sidePanel = document.getElementById('side-panel');
      if (sidePanel) sidePanel.classList.add('data-viz-open');
    };
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
window.renderCharts = renderCharts;
window.drilldownState = drilldownState;
