const MASTER_TPS_URL = 'data/LOKASI.csv';

let tpsData = [];
let allVoters = [];
let currentTpsVoters = [];

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(';').map(h => h.trim().toUpperCase());
    
    return lines.slice(1).map(line => {
        const values = line.split(';');
        let obj = {};
        headers.forEach((h, i) => {
            obj[h] = values[i] ? values[i].trim() : '';
        });
        return obj;
    });
}

function formatAlamat(v) {
    const rawDusun = (v.DUSUN || '').trim();
    const dusunTitleCase = rawDusun
        ? rawDusun.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        : '';
    
    const rt = (v.RT || '').padStart(3, '0');
    const rw = (v.RW || '').padStart(3, '0');
    
    return `${dusunTitleCase} RT ${rt} RW ${rw}`.trim();
}

async function initApp() {
    try {
        const res = await fetch(MASTER_TPS_URL);
        if (!res.ok) throw new Error('Gagal memuat data/LOKASI.csv');
        const csvText = await res.text();
        tpsData = parseCSV(csvText);

        const fetchPromises = tpsData.map(async (tps) => {
            const fileName = `${tps.TPS.trim()}.csv`;
            try {
                const vRes = await fetch(`data/${encodeURIComponent(fileName)}`);
                if (!vRes.ok) return { tps, voters: [] };
                const vText = await vRes.text();
                const voters = parseCSV(vText).map(v => ({
                    ...v,
                    TPS_NAMA: tps.TPS,
                    TPS_TEMPAT: tps.TEMPAT
                }));
                return { tps, voters };
            } catch {
                return { tps, voters: [] };
            }
        });

        const results = await Promise.all(fetchPromises);
        
        results.forEach(item => {
            item.tps.voters = item.voters;
            allVoters.push(...item.voters);
        });

        document.getElementById('loading-indicator').classList.add('hidden');
        renderDashboard();
    } catch (err) {
        document.getElementById('loading-indicator').innerHTML = 
            `<span style="color:#f87171;">Error: ${err.message}. Pastikan dijalankan melalui GitHub Pages.</span>`;
    }
}

function renderDashboard() {
    const totalTps = tpsData.length;
    const totalVoters = allVoters.length;
    const totalMale = allVoters.filter(v => v['L/P'] === 'L').length;
    const totalFemale = allVoters.filter(v => v['L/P'] === 'P').length;

    document.getElementById('total-tps').textContent = totalTps;
    document.getElementById('total-voters').textContent = totalVoters.toLocaleString('id-ID');
    document.getElementById('total-male').textContent = totalMale.toLocaleString('id-ID');
    document.getElementById('total-female').textContent = totalFemale.toLocaleString('id-ID');

    if (totalVoters > 0) {
        document.getElementById('pct-male').textContent = `${((totalMale / totalVoters) * 100).toFixed(1)}% dari total`;
        document.getElementById('pct-female').textContent = `${((totalFemale / totalVoters) * 100).toFixed(1)}% dari total`;
    }

    const tpsListEl = document.getElementById('tps-list');
    tpsListEl.innerHTML = '';

    tpsData.forEach((tps, index) => {
        const vList = tps.voters || [];
        const lCount = vList.filter(v => v['L/P'] === 'L').length;
        const pCount = vList.filter(v => v['L/P'] === 'P').length;

        const card = document.createElement('div');
        card.className = 'tps-card';
        card.onclick = () => openTpsDetail(index);
        card.innerHTML = `
            <div>
                <div class="tps-header">
                    <span class="tps-badge">${tps.TPS}</span>
                    <span style="font-size: 0.85rem; color: var(--accent-cyan);">Lihat Detail →</span>
                </div>
                <div class="tps-location">${tps.TEMPAT}</div>
            </div>
            <div class="tps-meta">
                <span>Total: <strong style="color:#fff">${vList.length}</strong></span>
                <span class="badge-l">L: ${lCount}</span>
                <span class="badge-p">P: ${pCount}</span>
            </div>
        `;
        tpsListEl.appendChild(card);
    });
}
function openTpsDetail(index) {
    const tps = tpsData[index];
    currentTpsVoters = tps.voters || [];

    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('tps-detail-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('detail-tps-code').textContent = tps.TPS;
    document.getElementById('detail-tps-location').textContent = tps.TEMPAT;

    const lCount = currentTpsVoters.filter(v => v['L/P'] === 'L').length;
    const pCount = currentTpsVoters.filter(v => v['L/P'] === 'P').length;

    document.getElementById('detail-total').textContent = currentTpsVoters.length;
    document.getElementById('detail-male').textContent = lCount;
    document.getElementById('detail-female').textContent = pCount;

    const rtStats = {};
    currentTpsVoters.forEach(v => {
        const rtKey = `RT ${v.RT} / RW ${v.RW}`;
        if (!rtStats[rtKey]) rtStats[rtKey] = { total: 0, L: 0, P: 0 };
        rtStats[rtKey].total++;
        if (v['L/P'] === 'L') rtStats[rtKey].L++;
        if (v['L/P'] === 'P') rtStats[rtKey].P++;
    });

    const rtGrid = document.getElementById('detail-rt-grid');
    rtGrid.innerHTML = '';
    Object.keys(rtStats).sort().forEach(rt => {
        const s = rtStats[rt];
        rtGrid.innerHTML += `
            <div class="rt-card">
                <h4>${rt}</h4>
                <div style="font-size: 1.3rem; font-weight: 700; margin: 0.25rem 0;">${s.total} Pemilih</div>
                <div style="font-size: 0.8rem; color: var(--text-muted);">
                    <span class="badge-l">L: ${s.L}</span> • <span class="badge-p">P: ${s.P}</span>
                </div>
            </div>
        `;
    });

    document.getElementById('tps-search').value = '';
    renderTpsTable(currentTpsVoters);
}

function renderTpsTable(data) {
    const tbody = document.getElementById('detail-tbody');
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Data pemilih tidak ditemukan.</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map((v, i) => {
        const dusunTampil = (v.DUSUN || '').trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        return `
        <tr style="cursor:pointer;" onclick='showVoterModal(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
            <td>${v.NO || i + 1}</td>
            <td><strong>${v.NAMA}</strong></td>
            <td>${v.USIA} Thn</td>
            <td><span class="${v['L/P'] === 'L' ? 'badge-l' : 'badge-p'}">${v['L/P']}</span></td>
            <td>${dusunTampil}</td>
            <td>RT ${v.RT} / RW ${v.RW}</td>
            <td><span class="badge-aktif">${v.KET}</span></td>
        </tr>
    `}).join('');
}

document.getElementById('tps-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = currentTpsVoters.filter(v => 
        v.NAMA.toLowerCase().includes(q) || 
        v.RT.includes(q) || 
        v.DUSUN.toLowerCase().includes(q)
    );
    renderTpsTable(filtered);
});

document.getElementById('global-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    const resultBox = document.getElementById('global-search-results');
    const tbody = document.getElementById('global-search-tbody');

    if (q.length < 3) {
        resultBox.classList.add('hidden');
        return;
    }

    const matches = allVoters.filter(v => v.NAMA.toLowerCase().includes(q)).slice(0, 50);
    resultBox.classList.remove('hidden');

    if (matches.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">Nama pemilih "${e.target.value}" tidak ditemukan.</td></tr>`;
        return;
    }

    tbody.innerHTML = matches.map(v => `
        <tr>
            <td><strong>${v.NAMA}</strong></td>
            <td><span class="tps-badge" style="font-size:0.75rem;">${v.TPS_NAMA}</span></td>
            <td>${formatAlamat(v)}</td>
            <td><span class="${v['L/P'] === 'L' ? 'badge-l' : 'badge-p'}">${v['L/P']}</span></td>
            <td>${v.USIA} Thn</td>
            <td>
                <button class="btn-back" style="margin:0; padding:0.3rem 0.7rem; font-size:0.8rem;" 
                    onclick='showVoterModal(${JSON.stringify(v).replace(/'/g, "&#39;")})'>
                    Detail
                </button>
            </td>
        </tr>
    `).join('');
});

function showVoterModal(v) {
    const modal = document.getElementById('voter-modal');
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="detail-row">
            <span>TPS</span>
            <span style="color:var(--accent-cyan);">${v.TPS_NAMA} - ${v.TPS_TEMPAT}</span>
        </div>
        <div class="detail-row">
            <span>Nama Lengkap</span>
            <span>${v.NAMA}</span>
        </div>
        <div class="detail-row">
            <span>Jenis Kelamin</span>
            <span>${v['L/P'] === 'L' ? 'Laki-Laki' : 'Perempuan'}</span>
        </div>
        <div class="detail-row">
            <span>Usia</span>
            <span>${v.USIA} Tahun</span>
        </div>
        <div class="detail-row">
            <span>Alamat</span>
            <span>${formatAlamat(v)}</span>
        </div>
        <div class="detail-row">
            <span>Nomor DPT</span>
            <span>${v.NO}</span>
        </div>
        <div class="detail-row">
            <span>Status DPT</span>
            <span><span class="badge-aktif">${v.KET}</span></span>
        </div>
    `;
    modal.classList.remove('hidden');
}

function closeModal(e) {
    if (e.target.id === 'voter-modal') {
        document.getElementById('voter-modal').classList.add('hidden');
    }
}

function showHome() {
    document.getElementById('tps-detail-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
}

initApp();
