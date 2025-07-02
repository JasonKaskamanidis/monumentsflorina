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
      ${isVisitor ? `<div style="background:#ffe9b3;color:#a67c00;padding:0.7rem 1rem;border-radius:8px;font-weight:600;text-align:center;margin-bottom:1.2rem;">Επισκέπτης: Μόνο προβολή</div>` : ''}
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
  toggle.onclick = () => {
    panel.classList.toggle('open');
  };
  if (window.innerWidth > 700) panel.classList.add('open');
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
  // Τομέας
  const checkedDomains = getCheckedValues('domain-filter');
  if (checkedDomains.length > 0) filtered = filtered.filter(m => checkedDomains.includes(m['τομέας']));
  // Κατηγορία
  const checkedCategories = getCheckedValues('category-filter');
  if (checkedCategories.length > 0) filtered = filtered.filter(m => checkedCategories.includes(m['κατηγορία']));
  // Υποκατηγορία
  const checkedSubcategories = getCheckedValues('subcategory-filter');
  if (checkedSubcategories.length > 0) filtered = filtered.filter(m => checkedSubcategories.includes(m['υποκατηγορία']));
  // Χρόνος (two-way slider by year)
  const minYear = Number(document.getElementById('filter-time-min').value);
  const maxYear = Number(document.getElementById('filter-time-max').value);
  filtered = filtered.filter(m => {
    const y = String(m['χρόνος']).slice(0,4);
    const year = Number(y);
    return year >= minYear && year <= maxYear;
  });
  // Λέξεις κλειδιά (at least one match)
  const checkedKeywords = getCheckedValues('keywords-filter');
  if (checkedKeywords.length > 0) {
    filtered = filtered.filter(m => {
      if (!m['λέξεις-κλειδιά']) return false;
      const keys = m['λέξεις-κλειδιά'].split(',').map(s => s.trim());
      return keys.some(k => checkedKeywords.includes(k));
    });
  }
  clearMarkers();
  addMarkers(filtered);

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
  } else {
    // Toggle visibility
    if (timelineContainer.style.display === 'none') {
      // Open timeline
      timelineContainer.style.display = 'block';
      if (overlay) overlay.classList.add('overlay-up');
    } else {
      // Close timeline with animation
      timelineContainer.classList.add('timeline-closing');
      if (overlay) overlay.classList.remove('overlay-up');
      setTimeout(() => {
        timelineContainer.style.display = 'none';
        timelineContainer.classList.remove('timeline-closing');
      }, 500); // match animation duration
    }
  }
});
