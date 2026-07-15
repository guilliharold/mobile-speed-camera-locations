fetch('data.json')
  .then(r => r.json())
  .then(PAYLOAD => init(PAYLOAD))
  .catch(err => {
    document.getElementById('list').innerHTML =
      '<div class="empty">Could not load data.json. Make sure index.html, style.css, script.js and data.json are all kept together in the same folder, then open index.html.</div>';
    console.error(err);
  });

function init(PAYLOAD){
  const SITES = PAYLOAD.sites; // [location, suburb, reasonCode, auditDate, lat, lon]
  const UNMATCHED = PAYLOAD.unmatched;

  document.getElementById('unmatchedCount').textContent = UNMATCHED.length;
  const ul = document.getElementById('unmatchedList');
  UNMATCHED.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u[0] + ' — ' + u[1];
    ul.appendChild(li);
  });
  document.getElementById('showUnmatched').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('show');
  });
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if(e.target.id === 'modal-overlay') e.target.classList.remove('show');
  });

  const map = L.map('map', { zoomControl:false, preferCanvas:true }).setView([-37.05, 144.9], 7);
  L.control.zoom({ position:'bottomright' }).addTo(map);

  // Standard OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: 'abc',
    maxZoom: 19
  }).addTo(map);

  const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 45,
    iconCreateFunction: function(cluster){
      const count = cluster.getChildCount();
      const size = count < 20 ? 30 : count < 100 ? 38 : 46;
      return L.divIcon({
        html: '<span>'+count+'</span>',
        className: 'marker-cluster-custom',
        iconSize: [size, size]
      });
    }
  });

  const camIcon = L.divIcon({ className: 'cam-icon', iconSize:[14,14] });

  const ALL_CODES = ['A','B','C','D'];
  let activeCodes = new Set();
  let searchTerm = '';

  const codeRow = document.getElementById('codeRow');
  ALL_CODES.forEach(code => {
    const btn = document.createElement('button');
    btn.className = 'code-btn';
    btn.textContent = code;
    btn.addEventListener('click', () => {
      if(activeCodes.has(code)){ activeCodes.delete(code); btn.classList.remove('active'); }
      else { activeCodes.add(code); btn.classList.add('active'); }
      render();
    });
    codeRow.appendChild(btn);
  });

  function escapeHtml(str){
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  const markerIndex = SITES.map(s => {
    const m = L.marker([s[4], s[5]], { icon: camIcon });
    m.bindPopup(
      '<div class="popup-loc">'+escapeHtml(s[0])+'</div>' +
      '<div class="popup-sub">'+escapeHtml(s[1])+'</div>' +
      '<div class="popup-row"><b>CODE</b><span>'+escapeHtml(s[2]||'—')+'</span></div>' +
      '<div class="popup-row"><b>AUDIT</b><span>'+escapeHtml(s[3]||'—')+'</span></div>'
    );
    return { site: s, marker: m };
  });

  function matches(site){
    const [loc, suburb, code] = site;
    if(activeCodes.size > 0){
      let ok = false;
      for(const c of activeCodes){ if((code||'').includes(c)) ok = true; }
      if(!ok) return false;
    }
    if(searchTerm){
      const hay = (loc + ' ' + suburb).toLowerCase();
      if(!hay.includes(searchTerm)) return false;
    }
    return true;
  }

  const listEl = document.getElementById('list');
  const countLabel = document.getElementById('countLabel');

  function render(){
    clusterGroup.clearLayers();
    listEl.innerHTML = '';
    let shown = 0;
    const frag = document.createDocumentFragment();
    markerIndex.forEach(entry => {
      if(matches(entry.site)){
        clusterGroup.addLayer(entry.marker);
        shown++;
        if(shown <= 400){
          const [loc, suburb, code, audit] = entry.site;
          const item = document.createElement('div');
          item.className = 'item';
          item.innerHTML = '<div class="loc">'+escapeHtml(loc)+'</div>' +
            '<div class="meta"><span>'+escapeHtml(suburb)+'</span><span class="rc">'+escapeHtml(code||'—')+'</span><span>'+escapeHtml(audit||'—')+'</span></div>';
          item.addEventListener('click', () => {
            map.setView(entry.marker.getLatLng(), 14, { animate:true });
            setTimeout(() => entry.marker.openPopup(), 300);
          });
          frag.appendChild(item);
        }
      }
    });
    if(shown === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No sites match your filters.';
      frag.appendChild(empty);
    } else if(shown > 400){
      const more = document.createElement('div');
      more.className = 'empty';
      more.textContent = '+ ' + (shown - 400) + ' more shown on map (list capped at 400)';
      frag.appendChild(more);
    }
    listEl.appendChild(frag);
    countLabel.textContent = shown + ' / ' + SITES.length;
    if(!map.hasLayer(clusterGroup)) map.addLayer(clusterGroup);
  }

  document.getElementById('search').addEventListener('input', (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });

  render();
}
