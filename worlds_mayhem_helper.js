/* ============================================================
   Loldle - Worlds Mayhem yardimcisi
   Kullanim: loldle.net/worldsMayhem sayfasinda F12 -> Console
             bu dosyanin tamamini yapistir, Enter.
   Sonra:    wm.go()    -> o anki 3 takim icin oneri
             wm.auto()  -> her tur otomatik oneri
             wm.stop()  -> otomatigi kapat
   ============================================================ */
(() => {
  const ROLES = ["TOP", "JUNGLE", "MID", "ADC", "SUPPORT"];
  const W = { TOP: 0.17, JUNGLE: 0.20, MID: 0.24, ADC: 0.23, SUPPORT: 0.16 };
  const TH = { quarter: 77.8, semi: 81.9, final: 84.1, winner: 88.2 };
  const IMP = 86;        // bos rollere varsayilan rating (ic politika)
  const REROLL_MIN = 89; // simulasyonda bu ratingin altinda kalinca reroll varsayimi

  // ---- oyunun kendi guc formulu (birebir) ----
  function power(roster) {
    const list = [];
    let sum = 0, wsum = 0;
    for (const R of ROLES) {
      if (!roster[R]) continue;
      sum += roster[R].rating * W[R];
      wsum += W[R];
      list.push(roster[R].rating);
    }
    if (!wsum) return null;
    const base = sum / wsum;
    const desc = [...list].sort((a, b) => b - a);
    const avg = list.reduce((a, b) => a + b, 0) / list.length;
    const carry = Math.min(2.5,
      0.20 * Math.max(0, desc[0] - avg) +
      (desc.length > 1 ? 0.12 * Math.max(0, desc[1] - avg) : 0) +
      (desc.length > 2 ? 0.04 * Math.max(0, desc[2] - avg) : 0));
    const weak = Math.min(2,
      0.20 * Math.max(0, avg - desc[desc.length - 1]) +
      (desc.length > 1 ? 0.10 * Math.max(0, avg - desc[desc.length - 2]) : 0));
    return base + carry - weak;
  }

  function tier(p) {
    if (p >= TH.winner) return "SAMPIYON";
    if (p >= TH.final) return "FINALIST";
    if (p >= TH.semi) return "YARI FINAL";
    if (p >= TH.quarter) return "CEYREK FINAL";
    return "GRUPTA ELENIR";
  }

  // ---- veri ----
  let DATA = null, POOL = null, VM = null;

  function findVM() {
    const seen = new Set();
    const queue = [];
    document.querySelectorAll("*").forEach(el => { if (el.__vue__) queue.push(el.__vue__); });
    while (queue.length) {
      const c = queue.shift();
      if (!c || seen.has(c)) continue;
      seen.add(c);
      if (c.gameData && c.roster && Array.isArray(c.displayedTeams)) return c;
      if (c.$children) queue.push(...c.$children);
      if (c.$root && !seen.has(c.$root)) queue.push(c.$root);
    }
    return null;
  }

  async function fetchData() {
    const src = [...document.scripts].map(s => s.src)
      .find(s => /\/js\/index\.[^/]*\.js$/.test(s));
    if (!src) throw new Error("index.js bulunamadi");
    const txt = await (await fetch(src)).text();
    const start = txt.indexOf('{"version":1,"roles"');
    if (start < 0) throw new Error("veri bloku bulunamadi");
    let j = start;
    for (;;) {
      j = txt.indexOf("')", j + 1);
      if (j < 0) throw new Error("veri sonu bulunamadi");
      try { return JSON.parse(txt.slice(start, j).replace(/\\'/g, "'")); } catch (e) { /* devam */ }
    }
  }

  async function ensureData() {
    if (DATA) return;
    VM = findVM();
    DATA = (VM && VM.gameData && VM.gameData.teams) ? VM.gameData : await fetchData();
    POOL = DATA.teams.filter(t => Number(t.year) >= 2011);
    console.log(`%c[wm] veri yuklendi: ${POOL.length} takim, ` +
      `${POOL.reduce((n, t) => n + t.players.length, 0)} oyuncu`, "color:#4caf50");
  }

  // ---- simulasyon ----
  // Seedli rastgelelik: her secenek ayni rastgele dunyada denenir (adil karsilastirma)
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  let RNG = Math.random;
  const rnd = n => Math.floor(RNG() * n);

  function draw3() {
    const idx = [];
    while (idx.length < 3) { const k = rnd(POOL.length); if (!idx.includes(k)) idx.push(k); }
    return idx.map(k => POOL[k]);
  }

  function heur(roster) {
    const c = { ...roster };
    for (const R of ROLES) if (!c[R]) c[R] = { rating: IMP };
    return power(c);
  }

  function listOptions(teams, roster, used) {
    const out = [];
    for (const t of teams) for (const p of t.players) {
      if (used.has(p.playerId)) continue;
      for (const R of (p.roles || [])) if (!roster[R]) out.push({ team: t, player: p, role: R });
    }
    return out;
  }

  // roster doldurulana kadar greedy oyna, biten kadronun gucunu dondur
  function rollout(roster, used, rerolls) {
    const r = { ...roster };
    const u = new Set(used);
    let rr = rerolls, guard = 0;
    while (ROLES.some(R => !r[R]) && guard++ < 60) {
      const opts = listOptions(draw3(), r, u);
      let best = null, bv = -1e9;
      for (const o of opts) {
        const c = { ...r }; c[o.role] = o.player;
        const v = heur(c);
        if (v > bv) { bv = v; best = o; }
      }
      if (!best) continue;
      if (rr > 0 && best.player.rating < REROLL_MIN) { rr--; continue; }
      r[best.role] = best.player;
      u.add(best.player.playerId);
    }
    return power(r);
  }

  function evaluate(roster, used, rerolls, sims, seed = 1337) {
    let sum = 0, win = 0, fin = 0, semi = 0, qf = 0;
    for (let i = 0; i < sims; i++) {
      RNG = mulberry32(seed + i * 2654435761);
      const p = rollout(roster, used, rerolls);
      sum += p;
      if (p >= TH.winner) win++;
      if (p >= TH.final) fin++;
      if (p >= TH.semi) semi++;
      if (p >= TH.quarter) qf++;
    }
    RNG = Math.random;
    return { avg: sum / sims, win: win / sims, fin: fin / sims, semi: semi / sims, qf: qf / sims };
  }

  // ---- ekrandaki durumu oku ----
  function readState() {
    if (!VM) VM = findVM();
    if (!VM) return null;
    const roster = {};
    for (const R of ROLES) roster[R] = VM.roster ? VM.roster[R] || null : null;
    const used = new Set(VM.placedPlayerIds || []);
    return {
      roster, used,
      teams: (VM.displayedTeams || []).filter(Boolean),
      rerolls: typeof VM.rerollsLeft === "number" ? VM.rerollsLeft : 0,
      revealing: !!VM.revealingTeams,
      awaitingSpin: !!VM.awaitingSpin
    };
  }

  // ---- ana oneri ----
  async function go(opts = {}) {
    await ensureData();
    const sims = opts.sims || 400;
    const seed = opts.seed || 1337;
    let st = opts.state || readState();

    if (!st) { console.warn("[wm] Oyun bulunamadi. Sayfa acik mi? wm.manual(...) kullanabilirsin."); return; }
    if (st.awaitingSpin) { console.log("%c[wm] Once SPIN'e bas, sonra wm.go()", "color:#ff9800"); return; }
    if (!st.teams.length) { console.log("[wm] Ekranda takim yok."); return; }

    const options = listOptions(st.teams, st.roster, st.used);
    if (!options.length) { console.log("[wm] Uygun oyuncu yok, reroll at."); return; }

    const filled = ROLES.filter(R => st.roster[R]);
    const rows = [];
    for (const o of options) {
      const r2 = { ...st.roster }; r2[o.role] = o.player;
      const u2 = new Set(st.used); u2.add(o.player.playerId);
      const ev = evaluate(r2, u2, st.rerolls, sims, seed);
      rows.push({
        Takim: o.team.label || `${o.team.name} ${o.team.year}`,
        Oyuncu: o.player.name,
        Rol: o.role,
        Rating: o.player.rating,
        "Beklenen guc": +ev.avg.toFixed(2),
        "Sampiyon %": +(ev.win * 100).toFixed(1),
        "Final+ %": +(ev.fin * 100).toFixed(1),
        _ev: ev
      });
    }
    rows.sort((a, b) => (b["Sampiyon %"] - a["Sampiyon %"]) ||
      (b["Final+ %"] - a["Final+ %"]) || (b["Beklenen guc"] - a["Beklenen guc"]));

    const rerollEv = st.rerolls > 0
      ? evaluate(st.roster, st.used, st.rerolls - 1, sims * 3, seed)
      : null;

    // ekran
    console.log(`%c—— Worlds Mayhem oneri  (dolu rol: ${filled.length}/5, reroll: ${st.rerolls}) ——`,
      "color:#2196f3;font-weight:bold");
    if (filled.length) {
      console.log("Mevcut kadro: " + filled.map(R =>
        `${R}=${st.roster[R].name}(${st.roster[R].rating})`).join("  ") +
        `   |  simdiki guc: ${power(st.roster).toFixed(2)}`);
    }
    console.table(rows.slice(0, 12).map(({ _ev, ...r }) => r));

    const best = rows[0];
    console.log(`%cSEC:  ${best.Takim}  ->  ${best.Oyuncu}  (${best.Rol}, rating ${best.Rating})`,
      "color:#4caf50;font-size:14px;font-weight:bold");
    console.log(`Bu secimle beklenen bitis: ${best["Beklenen guc"].toFixed(2)} guc ` +
      `(${tier(best["Beklenen guc"])}), sampiyonluk ihtimali %${best["Sampiyon %"]}`);

    if (rerollEv) {
      const diff = rerollEv.win - best._ev.win;
      if (diff > 0.02) {
        console.log(`%cREROLL AT: yeniden cekmenin sampiyonluk ihtimali %${(rerollEv.win * 100).toFixed(1)} ` +
          `(su anki en iyi secim %${best["Sampiyon %"]})`, "color:#ff5722;font-weight:bold");
      } else {
        console.log(`Reroll gerekmez (reroll ile %${(rerollEv.win * 100).toFixed(1)}).`);
      }
    }
    return rows;
  }

  // ---- otomatik mod ----
  let timer = null, lastKey = "";
  function auto(ms = 1200) {
    stop();
    timer = setInterval(async () => {
      const st = readState();
      if (!st || st.revealing || st.awaitingSpin || !st.teams.length) return;
      const key = st.teams.map(t => t.id).join("|") + "#" + [...st.used].join(",");
      if (key === lastKey) return;
      lastKey = key;
      await go({ state: st, sims: 300 });
    }, ms);
    console.log("%c[wm] otomatik mod acik (wm.stop() ile kapat)", "color:#4caf50");
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  // ---- elle kullanim: wm.manual(["T1 2023","G2 2019","JDG 2023"], {MID:"Faker"}) ----
  async function manual(teamLabels, filled = {}) {
    await ensureData();
    const find = s => POOL.find(t =>
      (t.label || "").toLowerCase() === String(s).toLowerCase()) ||
      POOL.find(t => (t.label || "").toLowerCase().includes(String(s).toLowerCase()));
    const teams = teamLabels.map(find);
    if (teams.some(t => !t)) { console.warn("[wm] Bu takimlar bulunamadi:", teamLabels.filter((s, i) => !teams[i])); return; }
    const roster = {}; const used = new Set();
    for (const R of ROLES) roster[R] = null;
    for (const R of Object.keys(filled)) {
      const name = String(filled[R]).toLowerCase();
      const p = POOL.flatMap(t => t.players).find(p => p.name.toLowerCase() === name);
      if (!p) { console.warn("[wm] oyuncu bulunamadi:", filled[R]); continue; }
      roster[R.toUpperCase()] = p; used.add(p.playerId);
    }
    return go({ state: { roster, used, teams, rerolls: 3, revealing: false, awaitingSpin: false } });
  }

  // ---- teorik en iyi kadro (hedef belirlemek icin) ----
  async function dream() {
    await ensureData();
    const roster = {};
    for (const R of ROLES) {
      const cands = POOL.flatMap(t => t.players.filter(p => (p.roles || []).includes(R)))
        .sort((a, b) => b.rating - a.rating);
      const used = Object.values(roster).map(p => p && p.playerId);
      roster[R] = cands.find(p => !used.includes(p.playerId));
    }
    console.log("Teorik tavan kadro:");
    console.table(ROLES.map(R => ({ Rol: R, Oyuncu: roster[R].name, Rating: roster[R].rating })));
    console.log("Guc:", power(roster).toFixed(2), "->", tier(power(roster)));
    console.log("Esikler -> Ceyrek 77.8 | Yari 81.9 | Final 84.1 | Sampiyon 88.2");
  }

  window.wm = { go, auto, stop, manual, dream, power, tier, TH, ROLES, W,
                get data() { return DATA; }, get vm() { return VM || (VM = findVM()); } };
  console.log("%c[wm] hazir. wm.go() | wm.auto() | wm.dream()", "color:#2196f3;font-weight:bold");
})();
