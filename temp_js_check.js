let leafletMap = null;
let mapMarkers = [];
let clickLat = null;
let clickLng = null;
let zones = [];
let depots = [];
let supplies = [];
let lastAllocations = null;

const STORAGE_KEYS = {
  zones: 'disaster_optimizer_zones',
  depots: 'disaster_optimizer_depots',
  supplies: 'disaster_optimizer_supplies'
};

const FIELD_UNITS = {
  food: 'kg',
  water: 'liters',
  medicines: 'units'
};

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadStatus();
  loadAll();
});

function initMap() {
  leafletMap = L.map('leafletMap').setView([13.08, 80.27], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    className: 'map-tiles'
  }).addTo(leafletMap);

  leafletMap.on('click', e => {
    clickLat = e.latlng.lat.toFixed(6);
    clickLng = e.latlng.lng.toFixed(6);
    const activeTab = document.querySelector('.tab-btn.active').id;
    if (activeTab === 'tabZoneBtn') {
      document.getElementById('z_lat').value = clickLat;
      document.getElementById('z_lng').value = clickLng;
    }
    if (activeTab === 'tabDepotBtn') {
      document.getElementById('d_lat').value = clickLat;
      document.getElementById('d_lng').value = clickLng;
    }
    showToast(`📍 Lat ${clickLat}, Lng ${clickLng} captured`, 'info');
  });
}

function refreshMap(zonesToShow, depotsToShow, allocations) {
  mapMarkers.forEach(m => leafletMap.removeLayer(m));
  mapMarkers = [];

  const riskColor = { CRITICAL:'#ef4444', HIGH:'#f97316', MEDIUM:'#eab308', LOW:'#22c55e' };

  zonesToShow.forEach(z => {
    const alloc = allocations ? allocations.find(a => a.zone === z.name) : null;
    const color = alloc ? (riskColor[alloc.risk_level] || '#94a3b8') : '#3b82f6';
    const lat = parseFloat(z.latitude);
    const lng = parseFloat(z.longitude);
    if (isNaN(lat) || isNaN(lng)) return;

    const icon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:${color};border:2px solid rgba(255,255,255,.6);border-radius:50%;box-shadow:0 0 8px ${color}aa"></div>`,
      iconSize: [14,14], iconAnchor: [7,7]
    });

    const marker = L.marker([lat, lng], { icon })
      .addTo(leafletMap)
      .bindPopup(`<b>${z.name}</b><br>Pop: ${Number(z.population).toLocaleString()}<br>Severity: ${z.severity}` +
        (alloc ? `<br><b style="color:${color}">Risk: ${alloc.risk_level}</b>` : ''));
    mapMarkers.push(marker);
  });

  (depotsToShow || []).forEach(dp => {
    const lat = parseFloat(dp.latitude);
    const lng = parseFloat(dp.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    const icon = L.divIcon({
      className: '',
      html: `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid rgba(255,255,255,.7);border-radius:3px;box-shadow:0 0 8px #3b82f6aa"></div>`,
      iconSize: [16,16], iconAnchor: [8,8]
    });
    const marker = L.marker([lat, lng], { icon })
      .addTo(leafletMap)
      .bindPopup(`<b>🏭 ${dp.name}</b><br>${dp.location || ''}`);
    mapMarkers.push(marker);
  });

  if (mapMarkers.length) {
    const group = L.featureGroup(mapMarkers);
    leafletMap.fitBounds(group.getBounds().pad(0.15));
  }
}

function loadStatus() {
  fetch('/api/status')
    .then(response => response.json())
    .then(data => {
      document.getElementById('dbBadge').className = 'db-badge db-on';
      document.getElementById('dbBadge').innerHTML = `<span class="pulse pulse-green"></span>Backend connected`;
      document.getElementById('aiLabel').textContent = data.huggingface?.configured ? 'Hugging Face placeholder' : 'Rule-Based';
      showToast(`Backend available (${data.backend})`, 'ok');
    })
    .catch(() => {
      document.getElementById('dbBadge').className = 'db-badge db-on';
      document.getElementById('dbBadge').innerHTML = `<span class="pulse pulse-green"></span>Local Storage`;
      document.getElementById('aiLabel').textContent = 'Rule-Based';
    });
}

function loadAll() {
  loadState();
  loadDashboard();
  loadZones();
  loadDepots();
  loadSupplies();
}

function loadState() {
  zones = JSON.parse(localStorage.getItem(STORAGE_KEYS.zones) || '[]');
  depots = JSON.parse(localStorage.getItem(STORAGE_KEYS.depots) || '[]');
  supplies = JSON.parse(localStorage.getItem(STORAGE_KEYS.supplies) || '[]');
}

function saveState() {
  localStorage.setItem(STORAGE_KEYS.zones, JSON.stringify(zones));
  localStorage.setItem(STORAGE_KEYS.depots, JSON.stringify(depots));
  localStorage.setItem(STORAGE_KEYS.supplies, JSON.stringify(supplies));
}

function nextId(list) {
  return list.reduce((max, item) => Math.max(max, item.id || 0), 0) + 1;
}

function getDepotById(id) {
  return depots.find(dp => Number(dp.id) === Number(id));
}

function loadDashboard() {
  const totalPopulation = zones.reduce((sum, z) => sum + Number(z.population || 0), 0);
  const supplyRecords = supplies.length;
  document.getElementById('statZones').textContent = zones.length;
  document.getElementById('statPop').textContent = fmtNum(totalPopulation);
  document.getElementById('statSup').textContent = supplyRecords;
  document.getElementById('statDepots').textContent = depots.length;
}

function loadZones() {
  const tb = document.getElementById('zoneTableBody');
  if (!zones.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="icon">🗺</div>No zones yet — add one using the form.</td></tr>`;
    refreshMap(zones, depots, lastAllocations);
    return;
  }

  tb.innerHTML = zones.map(z => `
      <tr>
        <td><div class="font-semibold">${z.name}</div></td>
        <td>${Number(z.population).toLocaleString()}</td>
        <td>
          <div class="flex items-center gap-2">
            <span class="font-bold" style="color:${sevColor(z.severity)}">${z.severity}/10</span>
            <div class="prog-bar" style="width:60px"><div class="prog-fill" style="width:${z.severity * 10}%;background:${sevColor(z.severity)}"></div></div>
          </div>
        </td>
        <td class="text-xs" style="color:var(--muted)">${parseFloat(z.latitude).toFixed(4)}, ${parseFloat(z.longitude).toFixed(4)}</td>
        <td><button class="btn-danger" onclick="deleteZone(${z.id})">✕ Delete</button></td>
      </tr>`).join('');
  refreshMap(zones, depots, lastAllocations);
}

function loadDepots() {
  const tb = document.getElementById('depotTableBody');
  const sel = document.getElementById('s_depot');
  if (!depots.length) {
    tb.innerHTML = `<tr><td colspan="5" class="empty-state"><div class="icon">🏭</div>No depots yet.</td></tr>`;
    sel.innerHTML = `<option value="">— No depots available —</option>`;
    return;
  }

  tb.innerHTML = depots.map(dp => `
      <tr>
        <td><div class="font-semibold">${dp.name}</div></td>
        <td style="color:var(--muted)">${dp.location || '—'}</td>
        <td>${Number(dp.capacity).toLocaleString()}</td>
        <td class="text-xs" style="color:var(--muted)">${parseFloat(dp.latitude).toFixed(4)}, ${parseFloat(dp.longitude).toFixed(4)}</td>
        <td><button class="btn-danger" onclick="deleteDepot(${dp.id})">✕ Delete</button></td>
      </tr>`).join('');

  sel.innerHTML = `<option value="">— Unassigned —</option>` + depots.map(dp => `<option value="${dp.id}">${dp.name}</option>`).join('');
}

function loadSupplies() {
  const tb = document.getElementById('supplyTableBody');
  if (!supplies.length) {
    tb.innerHTML = `<tr><td colspan="6" class="empty-state"><div class="icon">📦</div>No supplies yet</td></tr>`;
    return;
  }

  tb.innerHTML = supplies.map(s => {
    const depot = s.depot_id ? getDepotById(s.depot_id) : null;
    return `
      <tr>
        <td><span class="risk-badge" style="background:rgba(249,115,22,.12);color:#fb923c;border:1px solid rgba(249,115,22,.25)">${s.supply_type}</span></td>
        <td class="font-semibold">${Number(s.quantity).toLocaleString()}</td>
        <td style="color:var(--muted)">${s.unit}</td>
        <td style="color:var(--muted)">${depot ? depot.name : '—'}</td>
        <td style="color:var(--muted);font-size:12px">${(s.notes || '').slice(0, 40)}</td>
        <td><button class="btn-danger" onclick="deleteSupply(${s.id})">✕ Delete</button></td>
      </tr>`;
  }).join('');
}

function addZone() {
  const name = val('z_name');
  const population = Number(val('z_pop'));
  const severity = Number(val('z_sev'));
  const latitude = Number(val('z_lat'));
  const longitude = Number(val('z_lng'));

  if (!name || !population || !severity || !latitude || !longitude) {
    return showToast('Please fill all zone fields', 'err');
  }

  zones.push({
    id: nextId(zones),
    name,
    population,
    severity,
    latitude,
    longitude
  });
  saveState();
  showToast(`Zone "${name}" added ✓`, 'ok');
  clearInputs(['z_name','z_pop','z_sev','z_lat','z_lng']);
  loadAll();
}

function addDepot() {
  const name = val('d_name');
  const location = val('d_loc');
  const latitude = Number(val('d_lat'));
  const longitude = Number(val('d_lng'));
  const capacity = Number(val('d_cap')) || 100000;

  if (!name || !latitude || !longitude) return showToast('Fill depot name and coordinates', 'err');

  depots.push({
    id: nextId(depots),
    name,
    location,
    latitude,
    longitude,
    capacity
  });
  saveState();
  showToast(`Depot "${name}" added ✓`, 'ok');
  clearInputs(['d_name','d_loc','d_lat','d_lng','d_cap']);
  loadAll();
}

function addSupply() {
  const supply_type = document.getElementById('s_type').value;
  const quantity = Number(val('s_qty'));
  const unit = document.getElementById('s_unit').value;
  const depot_id = document.getElementById('s_depot').value || null;
  const notes = val('s_notes');

  if (!quantity) return showToast('Enter a quantity', 'err');

  supplies.push({
    id: nextId(supplies),
    supply_type,
    quantity,
    unit,
    depot_id: depot_id ? Number(depot_id) : null,
    notes
  });
  saveState();
  showToast(`${supply_type} × ${Number(quantity).toLocaleString()} ${unit} added ✓`, 'ok');
  clearInputs(['s_qty','s_notes']);
  loadAll();
}

function deleteZone(id) {
  if (!confirm('Delete this zone?')) return;
  zones = zones.filter(z => z.id !== id);
  saveState();
  showToast('Zone deleted', 'ok');
  loadAll();
}

function deleteDepot(id) {
  if (!confirm('Delete this depot?')) return;
  depots = depots.filter(dp => dp.id !== id);
  supplies = supplies.map(s => s.depot_id === id ? { ...s, depot_id: null } : s);
  saveState();
  showToast('Depot deleted', 'ok');
  loadAll();
}

function deleteSupply(id) {
  if (!confirm('Delete this supply?')) return;
  supplies = supplies.filter(s => s.id !== id);
  saveState();
  showToast('Supply deleted', 'ok');
  loadAll();
}

function runOptimize() {
  if (!zones.length) {
    return showToast('Add at least one zone before optimizing.', 'err');
  }
  showToast('Running optimization…', 'info');
  const result = calculateOptimization();
  lastAllocations = result.allocations;
  renderResults(result);
  refreshMap(zones, depots, lastAllocations);
  showToast('Optimization complete ✓', 'ok');
}

function calculateOptimization() {
  const demands = calculateDemand(zones);
  const supplyPool = buildSupplyPool(supplies);
  const allocations = allocateSupplies(demands, supplyPool);
  const routes = buildRoutes(zones, depots);
  const suggestions = getAISuggestions(allocations, supplyPool);
  const summary = {
    total_zones: zones.length,
    critical_zones: allocations.filter(a => a.risk_level === 'CRITICAL').length,
    high_risk_zones: allocations.filter(a => a.risk_level === 'HIGH').length,
    total_supply_gap: allocations.reduce((sum, a) => sum + a.food_gap + a.water_gap + a.meds_gap, 0)
  };
  return { allocations, routes, suggestions, summary };
}

function calculateDemand(zones) {
  const demands = zones.map(z => {
    const base = Number(z.population) * Number(z.severity);
    return {
      zone: z.name,
      zone_id: z.id,
      severity: Number(z.severity),
      population: Number(z.population),
      demand_score: base,
      food_needed: Math.round(base * 0.004),
      water_needed: Math.round(base * 0.0025),
      medicine_needed: Math.round(base * 0.0004)
    };
  });
  return demands.sort((a, b) => b.demand_score - a.demand_score);
}

function buildSupplyPool(sourceSupplies) {
  const pool = {};
  sourceSupplies.forEach(s => {
    const key = String(s.supply_type || 'other').toLowerCase();
    if (!pool[key]) pool[key] = { quantity: 0, unit: s.unit || FIELD_UNITS[key] || 'units' };
    pool[key].quantity += Number(s.quantity || 0);
  });
  Object.entries(FIELD_UNITS).forEach(([k, unit]) => {
    if (!pool[k]) pool[k] = { quantity: 0, unit };
  });
  return pool;
}

function allocateSupplies(demands, suppliesPool) {
  const avail_food = suppliesPool.food?.quantity || 0;
  const avail_water = suppliesPool.water?.quantity || 0;
  const avail_meds = suppliesPool.medicines?.quantity || 0;
  const total_demand = demands.reduce((sum, d) => sum + d.demand_score, 0) || 1;

  return demands.map(d => {
    const share = d.demand_score / total_demand;
    const alloc_food = Math.min(Math.round(avail_food * share), d.food_needed);
    const alloc_water = Math.min(Math.round(avail_water * share), d.water_needed);
    const alloc_meds = Math.min(Math.round(avail_meds * share), d.medicine_needed);
    const food_gap = Math.max(0, d.food_needed - alloc_food);
    const water_gap = Math.max(0, d.water_needed - alloc_water);
    const meds_gap = Math.max(0, d.medicine_needed - alloc_meds);
    const total_needed = Math.max(d.food_needed + d.water_needed + d.medicine_needed, 1);
    const gap_ratio = (food_gap + water_gap + meds_gap) / total_needed;
    const risk = gap_ratio > 0.5 ? 'CRITICAL' : gap_ratio > 0.2 ? 'HIGH' : gap_ratio > 0 ? 'MEDIUM' : 'LOW';
    const alerts = [];
    if (food_gap > 0) alerts.push(`Food shortage: ${fmtNum(food_gap)} kg`);
    if (water_gap > 0) alerts.push(`Water shortage: ${fmtNum(water_gap)} L`);
    if (meds_gap > 0) alerts.push(`Medicine shortage: ${fmtNum(meds_gap)} units`);

    return {
      zone: d.zone,
      zone_id: d.zone_id,
      severity: d.severity,
      population: d.population,
      food_alloc: alloc_food,
      water_alloc: alloc_water,
      meds_alloc: alloc_meds,
      food_gap,
      water_gap,
      meds_gap,
      risk_level: risk,
      alerts
    };
  });
}

function buildRoutes(zonesData, depotsData) {
  return zonesData.map(z => {
    let closest = 'No depot';
    let bestDist = Number.POSITIVE_INFINITY;

    depotsData.forEach(dp => {
      const dist = haversineKm(Number(z.latitude), Number(z.longitude), Number(dp.latitude), Number(dp.longitude));
      if (dist < bestDist) {
        bestDist = dist;
        closest = dp.name;
      }
    });

    return {
      zone: z.name,
      depot: closest,
      distance_km: depotsData.length ? Number(bestDist.toFixed(1)) : 0,
      estimated_hours: depotsData.length ? Number((bestDist / 50).toFixed(1)) : 0
    };
  });
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function toRad(value) { return value * Math.PI / 180; }

function getAISuggestions(allocations, pool) {
  const totalGap = allocations.reduce((sum, a) => sum + a.food_gap + a.water_gap + a.meds_gap, 0);
  const critical = allocations.filter(a => a.risk_level === 'CRITICAL').map(a => a.zone);
  const high = allocations.filter(a => a.risk_level === 'HIGH').map(a => a.zone);
  const lines = [];

  if (!totalGap) {
    lines.push('All zones are covered with the current supply mix. Continue monitoring and replenish reserve stocks.');
  } else {
    if (critical.length) {
      lines.push(`Critical gaps detected in: ${critical.join(', ')}.`);
    }
    if (high.length) {
      lines.push(`High-risk zones need extra attention: ${high.join(', ')}.`);
    }
    lines.push(`Total estimated supply gap: ${fmtNum(totalGap)} units.`);
    const shortageTypes = [];
    if ((pool.food?.quantity || 0) < allocations.reduce((sum, a) => sum + a.food_alloc + a.food_gap, 0)) shortageTypes.push('food');
    if ((pool.water?.quantity || 0) < allocations.reduce((sum, a) => sum + a.water_alloc + a.water_gap, 0)) shortageTypes.push('water');
    if ((pool.medicines?.quantity || 0) < allocations.reduce((sum, a) => sum + a.meds_alloc + a.meds_gap, 0)) shortageTypes.push('medicines');
    if (shortageTypes.length) {
      lines.push(`Focus new shipments on: ${shortageTypes.join(', ')}.`);
    }
    lines.push('Consider moving supplies to the nearest depots and use smaller convoys for high-risk zones.');
  }

  return { source: 'Rule-Based Suggestions', text: lines.join('\n') };
}

function renderResults(data) {
  const { allocations, routes, suggestions, summary } = data;

  document.getElementById('resultSummary').innerHTML = `
    <div class="stat-card stat-c1"><div class="text-xs font-semibold" style="color:var(--muted)">TOTAL ZONES</div><div class="text-2xl font-bold mt-1">${summary.total_zones}</div></div>
    <div class="stat-card stat-c2"><div class="text-xs font-semibold" style="color:var(--muted)">CRITICAL ZONES</div><div class="text-2xl font-bold mt-1" style="color:#ef4444">${summary.critical_zones}</div></div>
    <div class="stat-card stat-c3"><div class="text-xs font-semibold" style="color:var(--muted)">HIGH-RISK ZONES</div><div class="text-2xl font-bold mt-1" style="color:#f97316">${summary.high_risk_zones}</div></div>
    <div class="stat-card stat-c4"><div class="text-xs font-semibold" style="color:var(--muted)">TOTAL SUPPLY GAP</div><div class="text-2xl font-bold mt-1">${fmtNum(summary.total_supply_gap)}</div></div>`;

  document.getElementById('allocTableBody').innerHTML = allocations.map(a => `
    <tr>
      <td><div class="font-semibold text-sm">${a.zone}</div><div class="text-xs" style="color:var(--muted)">Sev ${a.severity}</div></td>
      <td>${Number(a.population).toLocaleString()}</td>
      <td>
        <div class="font-semibold text-sm">${fmtNum(a.food_alloc)}</div>
        ${a.food_gap ? `<div class="text-xs" style="color:#f87171">−${fmtNum(a.food_gap)} gap</div>` : ''}
      </td>
      <td>
        <div class="font-semibold text-sm">${fmtNum(a.water_alloc)}</div>
        ${a.water_gap ? `<div class="text-xs" style="color:#f87171">−${fmtNum(a.water_gap)} gap</div>` : ''}
      </td>
      <td>
        <div class="font-semibold text-sm">${fmtNum(a.meds_alloc)}</div>
        ${a.meds_gap ? `<div class="text-xs" style="color:#f87171">−${fmtNum(a.meds_gap)} gap</div>` : ''}
      </td>
      <td><span class="risk-badge risk-${a.risk_level}">${a.risk_level}</span></td>
      <td class="text-xs" style="color:#f87171">${a.alerts.join('<br>')}</td>
    </tr>`).join('');

  document.getElementById('routeTableBody').innerHTML = routes.map(r => {
    const pct = Math.min(100, r.estimated_hours / 8 * 100);
    return `
    <tr>
      <td class="font-semibold text-sm">${r.zone}</td>
      <td style="color:var(--accent2)">${r.depot}</td>
      <td>${r.distance_km} km</td>
      <td>${r.estimated_hours} hrs</td>
      <td><div class="prog-bar" style="width:120px"><div class="prog-fill" style="width:${pct}%;background:${pct>75?'#ef4444':pct>40?'#f97316':'#22c55e'}"></div></div></td>
    </tr>`;
  }).join('');

  const lines = suggestions.text.split('\n').filter(Boolean);
  document.getElementById('aiBox').innerHTML =
    `<div class="text-xs font-semibold mb-3" style="color:var(--muted)">${suggestions.source}</div>` +
    lines.map(l => `<div class="ai-line text-sm">${l}</div>`).join('');

  document.getElementById('resultsSection').classList.remove('hidden');
  document.getElementById('resultsSection').scrollIntoView({ behavior:'smooth', block:'start' });
}

function exportData() {
  const data = {
    zones,
    depots,
    supplies,
    exported_at: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `disaster_optimizer_export_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export downloaded ✓', 'ok');
}

function switchTab(tab) {
  ['zone','depot','supply'].forEach(t => {
    document.getElementById(`panel${t.charAt(0).toUpperCase()+t.slice(1)}`).classList.toggle('hidden', t !== tab);
    document.getElementById(`tab${t.charAt(0).toUpperCase()+t.slice(1)}Btn`).classList.toggle('active', t === tab);
  });
}

function switchRecordTab(tab) {
  ['Zones','Depots','Supplies'].forEach(t => {
    const key = t.toLowerCase();
    document.getElementById(`rec${t}`).classList.toggle('hidden', key !== tab);
    document.getElementById(`rtab${t}`).classList.toggle('active', key === tab);
  });
}

const val = id => document.getElementById(id).value.trim();
const fmtNum = n => Number(n || 0).toLocaleString();
const sevColor = s => s >= 8 ? '#ef4444' : s >= 6 ? '#f97316' : s >= 4 ? '#eab308' : '#22c55e';

function clearInputs(ids) { ids.forEach(id => document.getElementById(id).value = ''); }

let toastTimer;
function showToast(msg, type='ok') {
  const toast = document.getElementById('toast');
  const inner = document.getElementById('toastInner');
  const icons = { ok:'✅', err:'❌', info:'ℹ️' };
  inner.className = `toast-inner toast-${type}`;
  inner.textContent = `${icons[type] || ''} ${msg}`;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}