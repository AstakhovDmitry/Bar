// ─────────────────────────────────────────────────────────────────────
// THE PARLOUR · комора бару (лише власник)
// Клієнтський гейт — лише UX; реальний захист запису дає RLS Supabase.
// Наявність зберігається одразу (optimistic UI + відкат при помилці).
// «+N до карти» — скільки коктейлів стануть доступними, якщо
// поставити цей інгредієнт на полицю.
// ─────────────────────────────────────────────────────────────────────

// SUBTYPE_ORDER / SUBTYPE_OTHER — спільні константи з js/ui.js

const inv = {
  ingredients: [],
  ingredientById: {},   // ingredient_id -> рядок ingredients
  map: {},              // ingredient_id -> is_available
  usage: {},            // ingredient_id -> у скількох коктейлях
  slotsByCocktail: {},  // cocktail_id -> { position: [{ingredient_id, measure_uk}...] }
  byIngredient: {},     // ingredient_id -> [cocktail_id...]
  cocktailById: {},     // cocktail_id -> повний рядок cocktails (для оверлея)
  statusByCocktail: {}, // cocktail_id -> ready | almost | unavailable
  unlock: {},           // ingredient_id -> +N коктейлів, якщо додати
  readyCount: 0,
  almostCount: 0,
  totalCocktails: 0,
  search: '',
  avail: 'all',         // all | have | missing
  spy: null,
};

const invAvail = (id) => !!inv.map[id];

// ── Ініціалізація ────────────────────────────────────────────────────

async function init() {
  syncHeaderHeight();
  renderAuthArea();
  setupSignInModal();

  const session = await getSession();
  const gate = document.getElementById('gate');
  const wrap = document.getElementById('inventory-wrap');

  if (!session) {
    gate.hidden = false;
    wrap.hidden = true;
    document.getElementById('gate-signin-btn').addEventListener('click', openSignInModal);
    return;
  }

  gate.hidden = true;
  wrap.hidden = false;

  setupControls();
  renderSkeleton();
  await loadData();
}

async function loadData() {
  const [ingRes, invRes, linkRes, cockRes] = await Promise.all([
    supabaseClient.from('ingredients').select('id, name, name_uk, category, subtype, abv'),
    supabaseClient.from('inventory').select('ingredient_id, is_available'),
    supabaseClient.from('cocktail_ingredients').select('cocktail_id, ingredient_id, position, measure, measure_uk, measure_ml'),
    supabaseClient.from('cocktails').select('id, name, name_uk, category, iba_category, is_iba, instructions_uk, garnish_uk, image_url, video_url, glass_uk, glass_type, glass_variant_uk, glass_variant_type, glass_variant_condition_uk'),
  ]);

  const error = ingRes.error || invRes.error || linkRes.error || cockRes.error;
  if (error) {
    console.error(error);
    document.getElementById('inventory-groups').innerHTML = `
      <div class="state-panel" style="display:flex">
        ${uiIcon('retry', 'state-ico')}
        <h3 class="state-title">Не вдалося завантажити комору</h3>
        <p class="state-text">Перевірте з’єднання з мережею.</p>
        <div class="state-actions"><button class="btn" onclick="loadData()" type="button">Спробувати ще раз</button></div>
      </div>`;
    return;
  }

  inv.ingredients = ingRes.data;
  inv.ingredientById = {};
  inv.ingredients.forEach((i) => { inv.ingredientById[i.id] = i; });
  inv.map = {};
  invRes.data.forEach((r) => { inv.map[r.ingredient_id] = r.is_available; });

  inv.cocktailById = {};
  cockRes.data.forEach((c) => { inv.cocktailById[c.id] = c; });

  inv.usage = {};
  inv.slotsByCocktail = {};
  inv.byIngredient = {};
  linkRes.data.forEach((l) => {
    inv.usage[l.ingredient_id] = (inv.usage[l.ingredient_id] || 0) + 1;
    (inv.byIngredient[l.ingredient_id] = inv.byIngredient[l.ingredient_id] || []).push(l.cocktail_id);
    const slots = (inv.slotsByCocktail[l.cocktail_id] = inv.slotsByCocktail[l.cocktail_id] || {});
    (slots[l.position || 0] = slots[l.position || 0] || []).push({
      ingredient_id: l.ingredient_id,
      measure_uk: l.measure_uk || l.measure || '',
      measure_raw: l.measure || '',
      measure_ml: l.measure_ml,
    });
  });
  inv.totalCocktails = Object.keys(inv.slotsByCocktail).length;

  computeDerived();
  renderStats();
  renderGroups();
}

/** Перерахунок готовності коктейлів, статусів і «+N до карти». */
function computeDerived() {
  inv.readyCount = 0;
  inv.almostCount = 0;
  inv.unlock = {};
  inv.statusByCocktail = {};

  Object.entries(inv.slotsByCocktail).forEach(([cid, slots]) => {
    const missing = Object.values(slots).filter(
      (items) => !items.some((o) => inv.map[o.ingredient_id]));
    if (missing.length === 0) {
      inv.readyCount += 1;
      inv.statusByCocktail[cid] = 'ready';
    } else if (missing.length <= 2) {
      inv.almostCount += 1;
      inv.statusByCocktail[cid] = 'almost';
    } else {
      inv.statusByCocktail[cid] = 'unavailable';
    }
    if (missing.length === 1) {
      missing[0].forEach((o) => { inv.unlock[o.ingredient_id] = (inv.unlock[o.ingredient_id] || 0) + 1; });
    }
  });
}

/** Коктейлі, які стануть доступними, якщо додати інгредієнт */
function unlockList(ingredientId) {
  const list = [];
  Object.entries(inv.slotsByCocktail).forEach(([cid, slots]) => {
    const missing = Object.values(slots).filter(
      (items) => !items.some((o) => inv.map[o.ingredient_id]));
    if (missing.length === 1 && missing[0].some((o) => o.ingredient_id === ingredientId)) {
      list.push(cid);
    }
  });
  return list;
}

/** Збирає повний об'єкт коктейлю для рецептурного оверлея */
function buildSheetCocktail(cid) {
  const raw = inv.cocktailById[cid];
  const slotsMap = inv.slotsByCocktail[cid];
  if (!raw || !slotsMap) return null;

  const slots = Object.keys(slotsMap)
    .sort((a, b) => Number(a) - Number(b))
    .map((pos) => slotsMap[pos].map((o) => {
      const ing = inv.ingredientById[o.ingredient_id] || {};
      return {
        ingredient_id: o.ingredient_id,
        name: ing.name,
        name_uk: ing.name_uk,
        abv: ing.abv,
        measure_uk: o.measure_uk,
        measure_raw: o.measure_raw,
        measure_ml: o.measure_ml,
      };
    }));

  const missingSlots = slots.filter((slot) => !slot.some((i) => inv.map[i.ingredient_id]));
  let status;
  if (missingSlots.length === 0) status = 'ready';
  else if (missingSlots.length <= 2) status = 'almost';
  else status = 'unavailable';

  return { ...raw, slots, missingSlots, missingCount: missingSlots.length, status };
}

function openInvSheet(cid) {
  const c = buildSheetCocktail(cid);
  if (!c) return;
  hideUsagePop();
  openCocktailSheet(c, { avail: invAvail });
}

// ── Зведення ─────────────────────────────────────────────────────────

function statCard(id, num, den, label, extra) {
  const pct = den ? Math.round((num / den) * 100) : 0;
  return `
    <div class="stat-card" id="${id}">
      <span class="stat-num">${num}<i>/${den}</i></span>
      <span class="stat-lbl">${label}</span>
      <div class="stat-bar"><i style="width:${pct}%"></i></div>
      ${extra ? `<span class="stat-extra">${extra}</span>` : ''}
    </div>`;
}

function renderStats() {
  const total = inv.ingredients.length;
  const have = inv.ingredients.filter((i) => inv.map[i.id]).length;
  const alc = inv.ingredients.filter((i) => i.category === 'alcoholic');
  const non = inv.ingredients.filter((i) => i.category !== 'alcoholic');
  const alcHave = alc.filter((i) => inv.map[i.id]).length;
  const nonHave = non.filter((i) => inv.map[i.id]).length;

  document.getElementById('inv-stats').innerHTML =
    statCard('st-all', have, total, 'У наявності') +
    statCard('st-alc', alcHave, alc.length, 'Алкоголь') +
    statCard('st-non', nonHave, non.length, 'Без алкоголю') +
    statCard('st-ready', inv.readyCount, inv.totalCocktails, 'Коктейлів готово',
      inv.almostCount ? `ще ${inv.almostCount} майже` : '');
}

// ── Групи та рядки ───────────────────────────────────────────────────

function groupedData() {
  const order = [...SUBTYPE_ORDER, SUBTYPE_OTHER];
  const q = inv.search;

  return order.map((label, idx) => {
    let items = inv.ingredients.filter(
      (i) => (i.subtype || SUBTYPE_OTHER) === label);
    const totalInGroup = items.length;
    const haveInGroup = items.filter((i) => inv.map[i.id]).length;

    if (q) {
      items = items.filter((i) =>
        (i.name_uk && i.name_uk.toLowerCase().includes(q)) ||
        (i.name && i.name.toLowerCase().includes(q)));
    }
    if (inv.avail === 'have') items = items.filter((i) => !!inv.map[i.id]);
    if (inv.avail === 'missing') items = items.filter((i) => !inv.map[i.id]);

    items.sort((a, b) => (a.name_uk || a.name).localeCompare(b.name_uk || b.name, 'uk'));

    return { id: `inv-g-${idx}`, label, items, totalInGroup, haveInGroup };
  }).filter((g) => g.totalInGroup > 0);
}

function rowHtml(i) {
  const have = !!inv.map[i.id];
  const usage = inv.usage[i.id] || 0;
  const unlockN = inv.unlock[i.id] || 0;

  return `
  <div class="inv-row ${have ? 'have' : 'miss'}" data-row="${i.id}">
    <span class="inv-dot" aria-hidden="true"></span>
    <div class="inv-names">
      <span class="nm">${escapeHtml(i.name_uk || i.name)}</span>
      ${i.name_uk ? `<span class="en">${escapeHtml(i.name)}</span>` : ''}
    </div>
    <button class="inv-unlock" type="button" data-unlock="${i.id}"
          title="Показати коктейлі, які додадуться до карти"
          aria-haspopup="true" aria-expanded="false"
          ${have || !unlockN ? 'hidden' : ''}>+${unlockN} до карти</button>
    <button class="inv-usage" type="button" data-usage="${i.id}"
            title="Показати рецепти з цим інгредієнтом"
            aria-haspopup="true" aria-expanded="false">${usage} ${cocktailsWord(usage)}</button>
    <label class="switch" title="${have ? 'Є в наявності' : 'Немає в наявності'}">
      <input type="checkbox" data-id="${i.id}" ${have ? 'checked' : ''}
             aria-label="${escapeHtml(i.name_uk || i.name)}: є в наявності">
      <span class="knob"></span>
    </label>
  </div>`;
}

function renderGroups() {
  hideUsagePop();
  const groups = groupedData();
  const container = document.getElementById('inventory-groups');
  const visible = groups.filter((g) => g.items.length > 0);

  if (!visible.length) {
    container.innerHTML = `
      <div class="state-panel" style="display:flex">
        ${uiIcon('search', 'state-ico')}
        <h3 class="state-title">Нічого не знайдено</h3>
        <p class="state-text">Змініть пошук або фільтр наявності.</p>
      </div>`;
    renderNav([]);
    return;
  }

  container.innerHTML = visible.map((g) => `
    <section class="inv-group" id="${g.id}" data-label="${escapeHtml(g.label)}">
      <header class="inv-group-head">
        <h3>${escapeHtml(g.label)}</h3>
        <span class="frac" data-frac="${g.id}"><b>${g.haveInGroup}</b>/${g.totalInGroup}</span>
      </header>
      <div class="inv-group-bar"><i data-bar="${g.id}" style="width:${g.totalInGroup ? Math.round((g.haveInGroup / g.totalInGroup) * 100) : 0}%"></i></div>
      <div class="inv-rows">${g.items.map(rowHtml).join('')}</div>
    </section>`).join('');

  container.querySelectorAll('input[type="checkbox"][data-id]').forEach((box) => {
    box.addEventListener('change', () => onToggle(box));
  });

  renderNav(visible);
  setupScrollSpy(visible.map((g) => g.id));
}

// ── Навігація: бічна панель + мобільні чипси ─────────────────────────

function renderNav(groups) {
  const rail = document.getElementById('inv-rail');
  const chips = document.getElementById('inv-chips');

  rail.innerHTML = groups.map((g) => `
    <button class="rail-item" data-target="${g.id}" type="button">
      <span class="rail-label">${escapeHtml(g.label)}</span>
      <span class="rail-count" data-navcount="${g.id}"><b>${g.haveInGroup}</b>/${g.totalInGroup}</span>
    </button>`).join('');

  chips.innerHTML = groups.map((g) => `
    <button class="inv-chip" data-target="${g.id}" type="button">
      ${escapeHtml(g.label)} <span class="chip-count" data-chipcount="${g.id}">${g.haveInGroup}/${g.totalInGroup}</span>
    </button>`).join('');

  [rail, chips].forEach((box) => {
    box.querySelectorAll('[data-target]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.target);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });
}

function setupScrollSpy(ids) {
  if (inv.spy) inv.spy.disconnect();
  if (!ids.length || !('IntersectionObserver' in window)) return;

  inv.spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      document.querySelectorAll('.rail-item.active, .inv-chip.active')
        .forEach((el) => el.classList.remove('active'));
      const rail = document.querySelector(`.rail-item[data-target="${e.target.id}"]`);
      const chip = document.querySelector(`.inv-chip[data-target="${e.target.id}"]`);
      if (rail) rail.classList.add('active');
      if (chip) {
        chip.classList.add('active');
        chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    });
  }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) inv.spy.observe(el);
  });
}

// ── Перемикання наявності ────────────────────────────────────────────

async function onToggle(box) {
  hideUsagePop();
  const id = box.dataset.id;
  const newVal = box.checked;

  // optimistic
  inv.map[id] = newVal;
  computeDerived();
  patchRow(id);
  patchAggregates();

  const { error } = await supabaseClient
    .from('inventory')
    .update({ is_available: newVal, updated_at: new Date().toISOString() })
    .eq('ingredient_id', id);

  if (error) {
    console.error(error);
    inv.map[id] = !newVal;
    computeDerived();
    box.checked = !newVal;
    patchRow(id);
    patchAggregates();
    showToast('Не вдалося зберегти. Перевірте, чи ви увійшли як власник.', true);
    return;
  }

  // якщо активний фільтр наявності — рядок міг випасти з вибірки
  if (inv.avail !== 'all') {
    const y = window.scrollY;
    renderGroups();
    window.scrollTo(0, y);
  }
}

function patchRow(id) {
  const row = document.querySelector(`[data-row="${id}"]`);
  if (!row) return;
  const have = !!inv.map[id];
  row.classList.toggle('have', have);
  row.classList.toggle('miss', !have);
  const sw = row.querySelector('.switch');
  if (sw) sw.title = have ? 'Є в наявності' : 'Немає в наявності';
}

/** Оновлює зведення, бічні лічильники, прогрес груп і всі «+N до карти». */
function patchAggregates() {
  renderStats();

  document.querySelectorAll('.inv-group').forEach((section) => {
    const label = section.dataset.label;
    const items = inv.ingredients.filter((i) => (i.subtype || SUBTYPE_OTHER) === label);
    const total = items.length;
    const have = items.filter((i) => inv.map[i.id]).length;
    const pct = total ? Math.round((have / total) * 100) : 0;

    const frac = section.querySelector(`[data-frac="${section.id}"]`);
    if (frac) frac.innerHTML = `<b>${have}</b>/${total}`;
    const bar = section.querySelector(`[data-bar="${section.id}"]`);
    if (bar) bar.style.width = `${pct}%`;

    const navCount = document.querySelector(`[data-navcount="${section.id}"]`);
    if (navCount) navCount.innerHTML = `<b>${have}</b>/${total}`;
    const chipCount = document.querySelector(`[data-chipcount="${section.id}"]`);
    if (chipCount) chipCount.textContent = `${have}/${total}`;
  });

  document.querySelectorAll('[data-unlock]').forEach((el) => {
    const id = el.dataset.unlock;
    const n = inv.unlock[id] || 0;
    const have = !!inv.map[id];
    el.hidden = have || !n;
    el.textContent = `+${n} до карти`;
  });
}

// ── Поповери: «У рецептах» та «Додасться до карти» ───────────────────
// Наведення показує список, клік «пришпилює» (для тачскрінів).
// Між кнопкою і поповером є проміжок — тому ховання відкладене
// таймером і скасовується, щойно курсор заходить у поповер.
// Клік по коктейлю в списку відкриває рецептурний оверлей.

let popAnchor = null;
let popHideTimer = null;

function ensureUsagePop() {
  let pop = document.getElementById('usage-pop');
  if (!pop) {
    pop = document.createElement('div');
    pop.id = 'usage-pop';
    pop.className = 'usage-pop';
    pop.hidden = true;
    document.body.appendChild(pop);

    pop.addEventListener('mouseenter', () => clearTimeout(popHideTimer));
    pop.addEventListener('mouseleave', () => {
      if (pop.dataset.pinned !== '1') scheduleHidePop(160);
    });
    // клік по коктейлю → деталі
    pop.addEventListener('click', (e) => {
      const item = e.target.closest('[data-cid]');
      if (item) openInvSheet(item.dataset.cid);
    });
  }
  return pop;
}

function scheduleHidePop(delay) {
  clearTimeout(popHideTimer);
  popHideTimer = setTimeout(hideUsagePop, delay);
}

const POP_RANK = { ready: 0, almost: 1, unavailable: 2 };

/** items: [{cid, name, st}] */
function showListPop(anchor, title, items) {
  const pop = ensureUsagePop();
  clearTimeout(popHideTimer);

  const rows = items
    .sort((a, b) => (POP_RANK[a.st] - POP_RANK[b.st]) || a.name.localeCompare(b.name, 'uk'))
    .map((c) => `
      <li class="${c.st}">
        <button class="pop-item" type="button" data-cid="${c.cid}" title="Відкрити рецепт">
          <span class="pop-dot" aria-hidden="true"></span>${escapeHtml(c.name)}
        </button>
      </li>`).join('');

  pop.innerHTML = `
    <div class="usage-pop-head">${title}</div>
    <ul>${rows || '<li class="unavailable"><span class="pop-empty">Порожньо</span></li>'}</ul>`;

  pop.hidden = false;

  // позиціювання: під якорем, праві краї разом; вгору — якщо не влазить
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  const left = Math.min(Math.max(12, r.right - pw), window.innerWidth - pw - 12);
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 12) top = Math.max(12, r.top - ph - 8);
  pop.style.left = `${left + window.scrollX}px`;
  pop.style.top = `${top + window.scrollY}px`;

  if (popAnchor && popAnchor !== anchor) popAnchor.setAttribute('aria-expanded', 'false');
  popAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  pop.dataset.for = anchor.dataset.usage || anchor.dataset.unlock || '';
  pop.dataset.kind = anchor.dataset.usage ? 'usage' : 'unlock';
}

function popForAnchor(anchor) {
  if (anchor.dataset.usage !== undefined) {
    const id = anchor.dataset.usage;
    const ing = inv.ingredientById[id];
    const items = (inv.byIngredient[id] || []).map((cid) => ({
      cid,
      name: (inv.cocktailById[cid] && (inv.cocktailById[cid].name_uk || inv.cocktailById[cid].name)) || cid,
      st: inv.statusByCocktail[cid] || 'unavailable',
    }));
    showListPop(anchor, `У рецептах · ${escapeHtml(ing ? (ing.name_uk || ing.name) : '')}`, items);
  } else {
    const id = anchor.dataset.unlock;
    const items = unlockList(id).map((cid) => ({
      cid,
      name: (inv.cocktailById[cid] && (inv.cocktailById[cid].name_uk || inv.cocktailById[cid].name)) || cid,
      st: 'ready',
    }));
    showListPop(anchor, 'Додадуться до карти', items);
  }
}

function hideUsagePop() {
  clearTimeout(popHideTimer);
  const pop = document.getElementById('usage-pop');
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  pop.dataset.pinned = '0';
  if (popAnchor) {
    popAnchor.setAttribute('aria-expanded', 'false');
    popAnchor = null;
  }
}

function setupUsagePop() {
  const groupsEl = document.getElementById('inventory-groups');
  const anchorSel = '[data-usage], [data-unlock]';

  groupsEl.addEventListener('click', (e) => {
    const btn = e.target.closest(anchorSel);
    if (!btn) return;
    e.stopPropagation();
    const pop = ensureUsagePop();
    const key = btn.dataset.usage || btn.dataset.unlock;
    const kind = btn.dataset.usage ? 'usage' : 'unlock';
    if (!pop.hidden && pop.dataset.pinned === '1'
        && pop.dataset.for === key && pop.dataset.kind === kind) {
      hideUsagePop();
      return;
    }
    popForAnchor(btn);
    pop.dataset.pinned = '1';
  });

  groupsEl.addEventListener('mouseover', (e) => {
    const btn = e.target.closest(anchorSel);
    if (!btn) return;
    const pop = ensureUsagePop();
    if (pop.dataset.pinned === '1') return;
    popForAnchor(btn);
  });

  groupsEl.addEventListener('mouseout', (e) => {
    const btn = e.target.closest(anchorSel);
    if (!btn) return;
    const pop = document.getElementById('usage-pop');
    if (!pop || pop.hidden || pop.dataset.pinned === '1') return;
    if (e.relatedTarget && pop.contains(e.relatedTarget)) return;
    scheduleHidePop(260);
  });

  document.addEventListener('click', (e) => {
    const pop = document.getElementById('usage-pop');
    if (!pop || pop.hidden || pop.contains(e.target)) return;
    hideUsagePop();
  });

  window.addEventListener('scroll', () => {
    const pop = document.getElementById('usage-pop');
    if (pop && !pop.hidden && pop.dataset.pinned !== '1') hideUsagePop();
  }, { passive: true });
}

// ── Контролі ─────────────────────────────────────────────────────────

function setupControls() {
  setupUsagePop();
  setupCocktailSheet();
  document.getElementById('search-input').addEventListener('input', (e) => {
    inv.search = e.target.value.trim().toLowerCase();
    renderGroups();
  });

  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      inv.avail = btn.dataset.avail;
      renderGroups();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideUsagePop();
      closeCocktailSheet();
      closeSignInModal();
    }
  });
}

function renderSkeleton() {
  document.getElementById('inv-stats').innerHTML = Array.from({ length: 4 }, () =>
    `<div class="stat-card"><div class="skel line w40"></div><div class="skel line w70 mt"></div></div>`).join('');
  document.getElementById('inventory-groups').innerHTML = Array.from({ length: 8 }, () =>
    `<div class="inv-row skel-row"><div class="skel line w50"></div></div>`).join('');
}

init();
