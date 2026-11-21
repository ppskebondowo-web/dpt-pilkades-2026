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
                <span>Total: <strong>${vList.length}</strong></span>
                <span class="badge-l">L: ${lCount}</span>
                <span class="badge-p">P: ${pCount}</span>
            </div>
        `;
        tpsListEl.appendChild(card);
    });
}
