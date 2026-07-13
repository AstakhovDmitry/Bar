// ─────────────────────────────────────────────────────────────────────
// THE PARLOUR · коктейльна карта
// Завантаження даних, доступність за «слотами» (position = взаємозамінні
// варіанти), фільтри, презентаційні картки, рецептурний оверлей.
// Бізнес-логіка збігається з попередньою версією сайту.
// ─────────────────────────────────────────────────────────────────────

const ALMOST_THRESHOLD = 2; // скільки слотів може бракувати для «майже»

const state = {
  cocktails: [],
  ingredients: [],
  inventory: {},        // ingredient_id -> is_available
  search: '',
  iba: '',
  category: '',
  ingredientFilter: '',
  statusTab: 'ready',
  loaded: false,
};

// ── Ініціалізація ────────────────────────────────────────────────────

async function init() {
  syncHeaderHeight();
  renderAuthArea();
  setupSignInModal();
  setupStaticHandlers();
  renderSkeleton();
  await loadData();
}

async function loadData() {
  hideStatePanel();
  renderSkeleton();

  const [ingRes, invRes, cockRes, linkRes] = await Promise.all([
    supabaseClient.from('ingredients').select('id, name, name_uk, category, subtype'),
    supabaseClient.from('inventory').select('ingredient_id, is_available'),
    supabaseClient.from('cocktails').select('id, name, name_uk, category, iba_category, is_iba, instructions_uk, garnish_uk, image_url, video_url, glass_uk, glass_type, glass_variant_uk, glass_variant_type, glass_variant_condition_uk'),
    supabaseClient.from('cocktail_ingredients').select('cocktail_id, ingredient_id, measure, measure_uk, position'),
  ]);

  const error = ingRes.error || invRes.error || cockRes.error || linkRes.error;
  if (error) {
    console.error(error);
    renderErrorState();
    return;
  }

  const ingredients = ingRes.data, inventory = invRes.data,
        cocktails = cockRes.data, links = linkRes.data;

  const ingredientById = {};
  ingredients.forEach((i) => { ingredientById[i.id] = i; });

  state.inventory = {};
  inventory.forEach((r) => { state.inventory[r.ingredient_id] = r.is_available; });

  const byCocktail = {};
  links
    .sort((a, b) => (a.position || 0) - (b.position || 0))
    .forEach((l) => {
      const ing = ingredientById[l.ingredient_id];
      if (!ing) return;
      (byCocktail[l.cocktail_id] = byCocktail[l.cocktail_id] || []).push({
        ingredient_id: l.ingredient_id,
        name: ing.name,
        name_uk: ing.name_uk,
        measure_uk: l.measure_uk || l.measure || '',
        position: l.position || 0,
      });
    });

  state.cocktails = cocktails.map((c) => {
    const ing = byCocktail[c.id] || [];
    // Рядки з однаковим position — взаємозамінні варіанти одного слота
    const slotsMap = {};
    ing.forEach((i) => { (slotsMap[i.position] = slotsMap[i.position] || []).push(i); });
    const slots = Object.keys(slotsMap)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => slotsMap[k]);

    const missingSlots = slots.filter((slot) => !slot.some((i) => state.inventory[i.ingredient_id]));
    let status;
    if (missingSlots.length === 0) status = 'ready';
    else if (missingSlots.length <= ALMOST_THRESHOLD) status = 'almost';
    else status = 'unavailable';

    return { ...c, slots, missingSlots, missingCount: missingSlots.length, status };
  });

  state.ingredients = ingredients;
  state.loaded = true;

  populateIngredientSelect();
  renderAll();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── Фільтри ──────────────────────────────────────────────────────────

function populateIngredientSelect() {
  const select = document.getElementById('filter-ingredient');
  // Ті самі групи-підтипи, що й на сторінці «Комора» (js/ui.js)
  [...SUBTYPE_ORDER, SUBTYPE_OTHER].forEach((subtype) => {
    const items = state.ingredients
      .filter((i) => (i.subtype || SUBTYPE_OTHER) === subtype)
      .sort((a, b) => (a.name_uk || a.name).localeCompare(b.name_uk || b.name, 'uk'));
    if (!items.length) return;
    const og = document.createElement('optgroup');
    og.label = subtype;
    items.forEach((i) => {
      const opt = document.createElement('option');
      opt.value = i.id;
      opt.textContent = i.name_uk || i.name;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
}

/** Базовий список: усі фільтри, КРІМ статусу і категорії */
function baseFiltered() {
  let list = state.cocktails;
  if (state.search) {
    const q = state.search;
    list = list.filter((c) =>
      (c.name_uk && c.name_uk.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)));
  }
  if (state.iba) list = list.filter((c) => c.iba_category === state.iba);
  if (state.ingredientFilter) {
    list = list.filter((c) => c.slots.some((slot) =>
      slot.some((i) => i.ingredient_id === state.ingredientFilter)));
  }
  return list;
}

function byStatusTab(list, tab) {
  if (tab === 'ready') return list.filter((c) => c.status === 'ready');
  if (tab === 'almost') return list.filter((c) => c.status === 'almost');
  return list;
}

const STATUS_RANK = { ready: 0, almost: 1, unavailable: 2 };

function sortForTab(list, tab) {
  const alpha = (a, b) => (a.name_uk || a.name).localeCompare(b.name_uk || b.name, 'uk');
  if (tab === 'almost') {
    return [...list].sort((a, b) => (a.missingCount - b.missingCount) || alpha(a, b));
  }
  if (tab === 'all') {
    return [...list].sort((a, b) =>
      (STATUS_RANK[a.status] - STATUS_RANK[b.status]) || alpha(a, b));
  }
  return [...list].sort(alpha);
}

function hasAdvFilters() {
  return !!(state.search || state.iba || state.ingredientFilter);
}

// ── Головний рендер ──────────────────────────────────────────────────

function renderAll() {
  if (!state.loaded) return;
  const base = baseFiltered();

  // лічильники в табах
  setText('count-ready', base.filter((c) => c.status === 'ready').length);
  setText('count-almost', base.filter((c) => c.status === 'almost').length);
  setText('count-all', base.length);

  renderCategoryRow(base);

  let list = byStatusTab(base, state.statusTab);
  if (state.category) list = list.filter((c) => c.category === state.category);
  list = sortForTab(list, state.statusTab);

  renderResultLine(list.length);
  renderDeck(list);

  const dot = document.getElementById('adv-dot');
  if (dot) dot.hidden = !hasAdvFilters();
}

function renderCategoryRow(base) {
  const row = document.getElementById('category-row');
  const inView = byStatusTab(base, state.statusTab);

  const counts = {};
  inView.forEach((c) => { if (c.category) counts[c.category] = (counts[c.category] || 0) + 1; });

  const chips = [`
    <button class="cat-chip ${state.category === '' ? 'active' : ''}" data-cat="" type="button">
      Всі смаки <span class="chip-count">${inView.length}</span>
    </button>`];

  CATEGORY_ORDER.forEach((cat) => {
    const n = counts[cat] || 0;
    const active = state.category === cat;
    chips.push(`
      <button class="cat-chip ${active ? 'active' : ''} ${n === 0 && !active ? 'is-empty' : ''}"
              data-cat="${cat}" type="button" ${n === 0 && !active ? 'disabled' : ''}>
        ${categoryIcon(cat)}${cat} <span class="chip-count">${n}</span>
      </button>`);
  });

  row.innerHTML = chips.join('');
  row.querySelectorAll('.cat-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = (state.category === btn.dataset.cat) ? '' : btn.dataset.cat;
      renderAll();
    });
  });
}

function renderResultLine(n) {
  const el = document.getElementById('result-count');
  const word = (n % 10 === 1 && n % 100 !== 11) ? 'рецепт'
    : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) ? 'рецепти' : 'рецептів';
  el.textContent = `${n} ${word}`;

  const clearBtn = document.getElementById('clear-filters-btn');
  clearBtn.hidden = !(hasAdvFilters() || state.category);
}

// ── Картки ───────────────────────────────────────────────────────────

function renderDeck(list) {
  const deck = document.getElementById('cocktail-grid');

  if (!list.length) {
    deck.innerHTML = '';
    renderEmptyState();
    return;
  }
  hideStatePanel();

  deck.innerHTML = list.map(cardHtml).join('');

  deck.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => openSheet(card.dataset.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSheet(card.dataset.id); }
    });
  });

  observeReveals(deck);
}

function sealHtml(c) {
  if (c.status === 'ready') {
    return `<div class="card-seal seal-ready" title="Можна приготувати — все є в барі">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.8l4.6 4.7L19 7.2"/></svg></div>`;
  }
  if (c.status === 'almost') {
    return `<div class="card-seal seal-almost" title="Не вистачає ${c.missingCount} ${ingredientsWord(c.missingCount)}"><span>−${c.missingCount}</span></div>`;
  }
  return `<div class="card-seal seal-off" title="Бракує ${c.missingCount} ${ingredientsWord(c.missingCount)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></div>`;
}

const availLookup = (id) => !!state.inventory[id];

function cardHtml(c) {
  const nameUk = c.name_uk || c.name;
  const rows = c.slots.map((s) => slotRowHtml(s, { avail: availLookup })).join('');

  return `
  <article class="card reveal" data-id="${c.id}" tabindex="0" role="button"
           aria-label="${escapeHtml(nameUk)} — відкрити рецепт">
    ${sealHtml(c)}
    <div class="card-media">
      ${c.image_url
        ? `<img src="${c.image_url}" alt="${escapeHtml(nameUk)}" loading="lazy" decoding="async">`
        : `<div class="media-ph">${glassIcon(c.glass_type, 'ph-ico')}</div>`}
    </div>
    <div class="card-body">
      <header class="card-names">
        <h3>${escapeHtml(nameUk)}</h3>
        ${c.name_uk ? `<p class="en">${escapeHtml(c.name)}</p>` : ''}
      </header>
      <div class="card-rule" aria-hidden="true"><span class="gem"></span></div>
      <ul class="card-ingredients">${rows}</ul>
      <footer class="card-meta">
        ${c.category ? `<span class="meta-cat">${categoryIcon(c.category)}${escapeHtml(c.category)}</span>` : ''}
        ${c.is_iba ? `<span class="meta-iba">IBA&thinsp;·&thinsp;${IBA_LABELS[c.iba_category] || ''}</span>` : ''}
      </footer>
    </div>
  </article>`;
}

// ── Рецептурний оверлей (спільний, js/ui.js) ─────────────────────────

function openSheet(id) {
  const c = state.cocktails.find((x) => x.id === id);
  if (!c) return;
  openCocktailSheet(c, { avail: availLookup, onIngredientClick: filterByIngredient });
}

/** Клік по інгредієнту в оверлеї → фільтр карти за ним */
function filterByIngredient(ingredientId) {
  closeCocktailSheet();
  state.ingredientFilter = ingredientId;
  document.getElementById('filter-ingredient').value = ingredientId;
  setStatusTab('all');
  setAdvPanel(true);
  renderAll();
  document.getElementById('collection').scrollIntoView({ behavior: 'smooth' });
}

// ── Стани: skeleton / порожньо / помилка ─────────────────────────────

function renderSkeleton() {
  const deck = document.getElementById('cocktail-grid');
  deck.innerHTML = Array.from({ length: 4 }, () => `
    <div class="card skel-card" aria-hidden="true">
      <div class="skel media"></div>
      <div class="card-body">
        <div class="skel line w60"></div>
        <div class="skel line w35"></div>
        <div class="skel line w90 mt"></div>
        <div class="skel line w80"></div>
        <div class="skel line w70"></div>
      </div>
    </div>`).join('');
}

function renderEmptyState() {
  const panel = document.getElementById('empty-state');
  const pureReadyEmpty = state.statusTab === 'ready' && !hasAdvFilters() && !state.category;

  if (pureReadyEmpty) {
    panel.innerHTML = `
      ${glassIcon('coupe', 'state-ico')}
      <h3 class="state-title">Сьогодні бар відпочиває</h3>
      <p class="state-text">Жодного рецепта не зібрати повністю — загляньте, чого не вистачає.</p>
      <div class="state-actions">
        <button class="btn" data-goto-tab="almost" type="button">Майже готові</button>
        <button class="btn btn-quiet" data-goto-tab="all" type="button">Вся колекція</button>
      </div>`;
  } else {
    panel.innerHTML = `
      ${glassIcon('cocktail', 'state-ico')}
      <h3 class="state-title">Нічого не знайдено</h3>
      <p class="state-text">Спробуйте змінити пошук або зняти фільтри.</p>
      <div class="state-actions">
        <button class="btn" data-clear-filters type="button">Скинути фільтри</button>
      </div>`;
  }
  panel.hidden = false;

  panel.querySelectorAll('[data-goto-tab]').forEach((b) =>
    b.addEventListener('click', () => { setStatusTab(b.dataset.gotoTab); renderAll(); }));
  panel.querySelectorAll('[data-clear-filters]').forEach((b) =>
    b.addEventListener('click', clearAllFilters));
}

function renderErrorState() {
  document.getElementById('cocktail-grid').innerHTML = '';
  const panel = document.getElementById('empty-state');
  panel.innerHTML = `
    ${uiIcon('retry', 'state-ico')}
    <h3 class="state-title">Зала тимчасово зачинена</h3>
    <p class="state-text">Не вдалося завантажити дані. Перевірте з’єднання з мережею.</p>
    <div class="state-actions">
      <button class="btn" id="retry-btn" type="button">Спробувати ще раз</button>
    </div>`;
  panel.hidden = false;
  document.getElementById('retry-btn').addEventListener('click', loadData);
}

function hideStatePanel() {
  const panel = document.getElementById('empty-state');
  panel.hidden = true;
  panel.innerHTML = '';
}

// ── Обробники ────────────────────────────────────────────────────────

function setStatusTab(tab) {
  state.statusTab = tab;
  document.querySelectorAll('.status-tab').forEach((t) => {
    const active = t.dataset.status === tab;
    t.classList.toggle('active', active);
    t.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function setAdvPanel(open) {
  const panel = document.getElementById('adv-panel');
  const btn = document.getElementById('adv-toggle');
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  btn.classList.toggle('open', open);
}

function clearAllFilters() {
  state.search = '';
  state.iba = '';
  state.ingredientFilter = '';
  state.category = '';
  document.getElementById('search-input').value = '';
  document.getElementById('filter-iba').value = '';
  document.getElementById('filter-ingredient').value = '';
  renderAll();
}

function setupStaticHandlers() {
  document.querySelectorAll('.status-tab').forEach((tab) => {
    tab.addEventListener('click', () => { setStatusTab(tab.dataset.status); renderAll(); });
  });

  document.getElementById('adv-toggle').addEventListener('click', () => {
    setAdvPanel(document.getElementById('adv-panel').hidden);
  });

  document.getElementById('search-input').addEventListener('input', (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderAll();
  });
  document.getElementById('filter-iba').addEventListener('change', (e) => {
    state.iba = e.target.value;
    renderAll();
  });
  document.getElementById('filter-ingredient').addEventListener('change', (e) => {
    state.ingredientFilter = e.target.value;
    renderAll();
  });
  document.getElementById('adv-reset').addEventListener('click', clearAllFilters);
  document.getElementById('clear-filters-btn').addEventListener('click', clearAllFilters);

  // оверлей
  setupCocktailSheet();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCocktailSheet();
      closeSignInModal();
    }
  });
}

init();
