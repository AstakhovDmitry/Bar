// ─────────────────────────────────────────────────────────────────────
// THE PARLOUR · спільна бібліотека UI
// Іконки (inline SVG, 24×24, лінія 1.5) + дрібні допоміжні функції.
// Підключається ПІСЛЯ supabaseClient.js (там живе escapeHtml)
// і ПЕРЕД catalog.js / inventory.js.
// ─────────────────────────────────────────────────────────────────────

const IBA_LABELS = {
  Unforgettable: 'Незабутні',
  ContemporaryClassic: 'Сучасна класика',
  NewEra: 'Нова ера',
};

// Порядок смакових категорій (за розміром колекції)
const CATEGORY_ORDER = [
  'Кисло-солодкі',
  'Тропічні й фруктові',
  'Освіжаючі',
  'Дух-форвард',
  'Гіркуваті',
  'Вершкові й десертні',
  'Пряні й пікантні',
  'Гарячі',
];

// Порядок підтипів інгредієнтів (від міцного до спецій) —
// спільний для сторінки «Комора» і селекта інгредієнтів на карті
const SUBTYPE_ORDER = [
  'Джин', 'Водка', 'Ром та тростинні спирти', 'Віскі', 'Текіла та мескаль',
  'Бренді', 'Абсент', 'Апельсинові лікери', 'Фруктово-ягідні лікери',
  'Горіхові й кремові лікери', "М'ятні лікери", "Трав'яні лікери",
  'Особливі й квіткові лікери', 'Аперитиви й амаро', 'Вермути, портвейн і херес',
  'Вина та ігристе', 'Біттери', 'Базові цукрові сиропи', 'Ароматизовані сиропи',
  'Квіткові кордіали', 'Ванільні складники', 'Цитрусові соки',
  'Тропічні соки та пюре', 'Ягідний і овочевий сік', 'Газовані напої й міксери',
  'Молочне, яйця й кава', 'Свіжі фрукти', 'Трави', 'Спеції та приправи',
  'Соуси й вода',
];
const SUBTYPE_OTHER = 'Інше';

// ── Посуд для подачі (13 канонічних типів + fallback) ────────────────
const GLASS_ICON_PATHS = {
  cocktail:      '<path d="M4.5 5h15l-7.5 8.2L4.5 5Z"/><path d="M12 13.2V19M8.5 21h7"/><path d="M9.3 7.6h5.4" opacity=".55"/>',
  coupe:         '<path d="M4.5 5.5h15c0 3.9-3.2 6.3-7.5 6.3S4.5 9.4 4.5 5.5Z"/><path d="M12 11.8V19M8.5 21h7"/>',
  cobbler:       '<path d="M7 3.5h10c.3 4.9-1.7 8.2-5 8.2s-5.3-3.3-5-8.2Z"/><path d="M12 11.7V19M9 21h6"/>',
  old_fashioned: '<path d="M6 5h12l-.7 12.6a2.2 2.2 0 0 1-2.2 2.1H8.9a2.2 2.2 0 0 1-2.2-2.1L6 5Z"/><path d="M6.5 15.2h11" opacity=".55"/>',
  collins:       '<path d="M8 3h8l-.5 16.6A1.6 1.6 0 0 1 13.9 21h-3.8a1.6 1.6 0 0 1-1.6-1.4L8 3Z"/>',
  highball:      '<path d="M7 5h10l-.6 13.7a2 2 0 0 1-2 1.9H9.6a2 2 0 0 1-2-1.9L7 5Z"/>',
  flute:         '<path d="M9.5 3h5l-.5 6.6c-.2 2.1-1.1 3.2-2 3.2s-1.8-1.1-2-3.2L9.5 3Z"/><path d="M12 12.8V19M9 21h6"/>',
  wine:          '<path d="M6.5 3.5h11c.4 5.4-1.9 8.8-5.5 8.8S6.1 8.9 6.5 3.5Z"/><path d="M12 12.3V19M8.5 21h7"/>',
  shot:          '<path d="M8.5 10h7l-.8 8.5a1.7 1.7 0 0 1-1.7 1.5h-2a1.7 1.7 0 0 1-1.7-1.5L8.5 10Z"/>',
  copper_mug:    '<path d="M5.5 6.5h10V18a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V6.5Z"/><path d="M15.5 9.2h1.7a2.3 2.3 0 0 1 0 4.6h-1.7"/><path d="M5.9 9.5h9.2" opacity=".55"/>',
  hurricane:     '<path d="M8.6 3h6.8c0 3.3-1.5 4.5-1.5 6.8 0 2.1 2 3.3 2 5.7a3.9 3.9 0 0 1-7.8 0c0-2.4 2-3.6 2-5.7 0-2.3-1.5-3.5-1.5-6.8Z"/><path d="M12 19.5V21M9.5 21h5"/>',
  snifter:       '<path d="M5.5 7.3c0 3.6 2.9 6.5 6.5 6.5s6.5-2.9 6.5-6.5c0-2-2.9-3.4-6.5-3.4S5.5 5.3 5.5 7.3Z"/><path d="M12 13.8V18M9 20.5h6"/>',
  julep:         '<path d="M7 5h10l-.8 13.6a1.9 1.9 0 0 1-1.9 1.4H9.7a1.9 1.9 0 0 1-1.9-1.4L7 5Z"/><path d="M6.6 8.4h10.8" opacity=".55"/>',
  mug:           '<path d="M6 8h9v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z"/><path d="M15 10h1.7a2.3 2.3 0 0 1 0 4.6H15"/><path d="M9 5.2c0-1 .8-1.1.8-2.2M12.2 5.2c0-1 .8-1.1.8-2.2"/>',
  jar:           '<path d="M8.5 3h7v2.4h-7V3Z"/><path d="M7.5 5.4h9l-.7 13.2a2 2 0 0 1-2 1.9h-3.6a2 2 0 0 1-2-1.9L7.5 5.4Z"/>',
  other:         '<path d="M7 4h10l-.8 14.9a2 2 0 0 1-2 1.9H9.8a2 2 0 0 1-2-1.9L7 4Z"/>',
};

// ── Смакові категорії (8) ─────────────────────────────────────────────
const CATEGORY_ICON_PATHS = {
  'Кисло-солодкі':        '<circle cx="12" cy="12" r="7.6"/><circle cx="12" cy="12" r="5" opacity=".6"/><path d="M12 7v10M7 12h10M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
  'Тропічні й фруктові':  '<ellipse cx="12" cy="14.6" rx="4.7" ry="5.9"/><path d="M8.7 11.6l6.6 6.2M15.3 11.6l-6.6 6.2M12 8.7v11.8" opacity=".7"/><path d="M12 8.7C11.6 6.6 10 5.6 8.3 5.6M12 8.7c.4-2.1 2-3.1 3.7-3.1M12 8.7V4.6"/>',
  'Освіжаючі':            '<path d="M5.5 18.5C5.5 10.2 11.4 4.7 19.5 4.5c.2 8.1-5.3 14-13.9 14Z"/><path d="M7.6 16.4c2.8-4.3 6.3-7.8 9.4-9.4" opacity=".7"/>',
  'Дух-форвард':          '<path d="M10.1 3h3.8v3.5l1.7 2.7c.3.5.4 1 .4 1.5V19a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-8.3c0-.5.1-1 .4-1.5l1.7-2.7V3Z"/><path d="M8 13.6h8" opacity=".55"/>',
  'Гіркуваті':            '<ellipse cx="12" cy="4.3" rx="2.3" ry="1.5"/><path d="M11 5.7v2.8M13 5.7v2.8"/><path d="M10.4 8.5h3.2l.9 8.9a2.5 2.5 0 0 1-5 0l.9-8.9Z"/><path d="M12 13.4v2.2" opacity=".7"/>',
  'Вершкові й десертні':  '<path d="M5.5 8c0 3.7 2.9 5.7 6.5 5.7s6.5-2 6.5-5.7h-13Z"/><path d="M12 13.7V18M9 20h6"/><circle cx="15.8" cy="4.6" r="1.5"/><path d="M15.6 3.1c-1.1-.6-2.5-.3-3.6.9" opacity=".7"/>',
  'Пряні й пікантні':     '<path d="M15 5.6c2.7.3 4.1 2.5 3.1 5.1-2 5.3-6.9 8.3-11.7 8.3-1.9 0-3-1.2-2.7-2.6C4.6 12 9 6.7 15 5.6Z"/><path d="M15 5.6c.8-1 .9-2 .3-3.1"/>',
  'Гарячі':               '<path d="M5 10h11v5.4a4.1 4.1 0 0 1-4.1 4.1H9.1A4.1 4.1 0 0 1 5 15.4V10Z"/><path d="M16 11.6h1.5a2.4 2.4 0 0 1 0 4.8H16"/><path d="M8.3 3.4c0 1.6-1.4 1.9-1.4 3.4M12.4 3.4c0 1.6-1.4 1.9-1.4 3.4"/>',
};

// ── Службові іконки ───────────────────────────────────────────────────
const UI_ICON_PATHS = {
  key:      '<circle cx="8" cy="15.8" r="3.6"/><path d="M10.8 13 19.3 4.5M15.7 8.1l2.9 2.9M13 10.8l2 2"/>',
  exit:     '<path d="M13 4H7.5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2H13"/><path d="M16.5 8.5 20 12l-3.5 3.5M20 12H9.5"/>',
  sliders:  '<path d="M4 7.5h8M17.5 7.5H20M4 16.5h2.5M12 16.5h8"/><circle cx="14.5" cy="7.5" r="2.3"/><circle cx="9.5" cy="16.5" r="2.3"/>',
  close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  check:    '<path d="M5 12.8l4.6 4.7L19 7.2"/>',
  minus:    '<path d="M6 12h12"/>',
  play:     '<path d="M8.5 5.8v12.4L18.5 12 8.5 5.8Z"/>',
  search:   '<circle cx="11" cy="11" r="6.3"/><path d="M15.7 15.7 21 21"/>',
  lock:     '<rect x="6" y="10.6" width="12" height="9" rx="2"/><path d="M8.6 10.6V8.2a3.4 3.4 0 0 1 6.8 0v2.4"/>',
  arrowDown:'<path d="M12 4.5v13M6.2 12.2 12 18l5.8-5.8"/>',
  retry:    '<path d="M4.6 12a7.4 7.4 0 0 1 12.7-5.2L19.5 9M19.5 4.5V9H15"/><path d="M19.4 12a7.4 7.4 0 0 1-12.7 5.2L4.5 15M4.5 19.5V15H9"/>',
  gem:      '<path d="M12 4.5 18 12l-6 7.5L6 12l6-7.5Z"/>',
  book:     '<path d="M4.5 5A2.5 2.5 0 0 1 7 2.5h12.5V18H7A2.5 2.5 0 0 0 4.5 20.5V5Z"/><path d="M4.5 20.5A2.5 2.5 0 0 1 7 18h12.5v3.5H7a2.5 2.5 0 0 1-2.5-1Z"/><path d="M9 7h7M9 10.5h5" opacity=".6"/>',
};

function svgIcon(paths, cls) {
  return `<svg class="${cls || 'ico'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function glassIcon(type, cls) {
  return svgIcon(GLASS_ICON_PATHS[type] || GLASS_ICON_PATHS.other, cls || 'glass-ico');
}

function categoryIcon(category, cls) {
  const p = CATEGORY_ICON_PATHS[category];
  return p ? svgIcon(p, cls || 'cat-ico') : '';
}

function uiIcon(name, cls) {
  const p = UI_ICON_PATHS[name];
  return p ? svgIcon(p, cls || 'ico') : '';
}

// ── Дрібні допоміжні ─────────────────────────────────────────────────

/** «5 коктейлів» / «1 коктейль» / «3 коктейлі» */
function cocktailsWord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'коктейль';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'коктейлі';
  return 'коктейлів';
}

/** «2 інгредієнти» / «5 інгредієнтів» */
function ingredientsWord(n) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'інгредієнта';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'інгредієнтів';
  return 'інгредієнтів';
}

/** Показ короткого тосту (успіх/помилка) */
let _toastTimer = null;
function showToast(message, isError) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.toggle('error', !!isError);
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/** Плавна поява елементів під час скролу */
function observeReveals(container) {
  const items = container.querySelectorAll('.reveal:not(.in)');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
  items.forEach((el) => io.observe(el));
}

/** Вимірює висоту шапки → CSS-змінна --header-h (для sticky-елементів) */
function syncHeaderHeight() {
  const header = document.querySelector('header.site-header');
  if (!header) return;
  const apply = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
  apply();
  window.addEventListener('resize', apply);
}

/** Блокування прокрутки сторінки, коли відкритий оверлей */
function lockScroll(lock) {
  document.documentElement.style.overflow = lock ? 'hidden' : '';
}

// ── Оцінка міцності коктейлю ─────────────────────────────────────────
// ABV ≈ чистий спирт / (об'єм інгредієнтів × коефіцієнт розведення льодом).
// Слоти-альтернативи: береться перший варіант (різниця в межах похибки).

const TOPUP_ML = {
  highball: 100, collins: 110, jar: 100, hurricane: 90,
  copper_mug: 100, mug: 90, flute: 75, wine: 90,
};

function estimateAbv(c) {
  let alcohol = 0;
  let volume = 0;

  (c.slots || []).forEach((slot) => {
    const i = slot[0];
    const raw = `${i.measure_raw || ''} ${i.measure_uk || ''}`.toLowerCase();
    let ml = (i.measure_ml === null || i.measure_ml === undefined) ? null : Number(i.measure_ml);

    if (ml === null || Number.isNaN(ml)) {
      if (/top|долит|доповн/.test(raw)) ml = TOPUP_ML[c.glass_type] || 80;      // «долити»
      else if (/dash|деш|крапл/.test(raw)) ml = (parseFloat(raw) || 1) * 0.9;   // деші
      else if (/spoon|ложк/.test(raw)) ml = (parseFloat(raw) || 1) * 5;         // барні ложки
      else ml = 0; // «до смаку», гарніроподібне — не рахуємо
    }

    volume += ml;
    alcohol += ml * ((Number(i.abv) || 0) / 100);
  });

  if (volume <= 0) return null;

  let dilution = 1.25; // build у бокалі з льодом
  const instr = (c.instructions_uk || '').toLowerCase();
  if (c.category === 'Гарячі') dilution = 1.0;
  else if (/блендер/.test(instr)) dilution = 1.45;
  else if (/збий|збит|збовт|шейк|струс/.test(instr)) dilution = 1.4;
  else if (/розміш|переміш|зміша/.test(instr)) dilution = 1.28;

  return Math.round((alcohol / (volume * dilution)) * 100);
}

/** Тег «≈ N%» для мета-рядків картки та оверлея */
function abvTagHtml(c) {
  const pct = estimateAbv(c);
  if (pct === null) return '';
  return `<span class="meta-abv" title="Приблизна міцність з урахуванням розведення льодом">≈ ${pct}%</span>`;
}

// ═════════════════════════════════════════════════════════════════════
// Спільний рецептурний оверлей (карта + комора).
// Очікує на сторінці розмітку: #cocktail-sheet > #sheet-media,
// #sheet-content, #sheet-close-btn.
// Коктейль: { name, name_uk, category, iba_category, is_iba, image_url,
//   video_url, instructions_uk, garnish_uk, glass_*, slots, missingSlots,
//   missingCount, status }
// opts: { avail: (ingredient_id) => bool, onIngredientClick?: (id) => void }
// ═════════════════════════════════════════════════════════════════════

let _sheetLastFocused = null;

/** Рядок слота рецепта (compact — для картки, повний — для оверлея) */
function slotRowHtml(slot, opts) {
  const avail = opts.avail;
  const have = slot.some((i) => avail(i.ingredient_id));
  const measure = slot[0].measure_uk || '';
  const clickable = !!opts.clickable;

  const nameSpan = (i) => `<span class="v ${avail(i.ingredient_id) ? 'v-have' : 'v-miss'}"
    ${clickable ? `data-ingredient-id="${i.ingredient_id}" role="button" tabindex="0" title="Всі коктейлі з цим інгредієнтом"` : ''}>${escapeHtml(i.name_uk || i.name)}</span>`;

  const names = slot.map(nameSpan).join('<em class="or">або</em>');

  return `<li class="${have ? 'have' : 'miss'}">
    <span class="dot" aria-hidden="true"></span>
    <span class="ing-name">${names}</span>
    <span class="leader" aria-hidden="true"></span>
    <span class="amount">${escapeHtml(measure)}</span>
  </li>`;
}

/** Прив'язка закриття (хрестик + бекдроп). Викликати раз на сторінку. */
function setupCocktailSheet() {
  const overlay = document.getElementById('cocktail-sheet');
  const closeBtn = document.getElementById('sheet-close-btn');
  if (!overlay || !closeBtn) return;
  closeBtn.addEventListener('click', closeCocktailSheet);
  overlay.addEventListener('click', (e) => {
    if (e.target.id === 'cocktail-sheet') closeCocktailSheet();
  });
}

function openCocktailSheet(c, opts) {
  const overlay = document.getElementById('cocktail-sheet');
  const media = document.getElementById('sheet-media');
  const content = document.getElementById('sheet-content');
  if (!overlay || !media || !content || !c) return;

  const avail = opts.avail;
  const nameUk = c.name_uk || c.name;

  media.innerHTML = c.image_url
    ? `<img src="${c.image_url}" alt="${escapeHtml(nameUk)}">`
    : `<div class="media-ph">${glassIcon(c.glass_type, 'ph-ico')}</div>`;

  const missingNames = (c.missingSlots || []).map((slot) => slot[0].name_uk || slot[0].name);
  let statusLine;
  if (c.status === 'ready') {
    statusLine = `<p class="sheet-status ok"><span class="dot"></span>Можна приготувати — все є в барі</p>`;
  } else {
    const shown = missingNames.slice(0, 3).map(escapeHtml).join(', ');
    const rest = missingNames.length > 3 ? ` та ще ${missingNames.length - 3}` : '';
    statusLine = `<p class="sheet-status ${c.status === 'almost' ? 'warn' : 'bad'}">
      <span class="dot"></span>Не вистачає: ${shown}${rest}</p>`;
  }

  const rows = (c.slots || [])
    .map((s) => slotRowHtml(s, { avail, clickable: !!opts.onIngredientClick }))
    .join('');
  const instructions = c.instructions_uk || '';
  const garnish = c.garnish_uk || '';

  const videoMini = c.video_url ? `
    <a class="video-mini" href="${c.video_url}" target="_blank" rel="noopener"
       title="Відео приготування (YouTube)" aria-label="Відео приготування">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8.5 5.8v12.4L18.5 12 8.5 5.8Z"/></svg>
    </a>` : '';

  const glassBlock = c.glass_uk ? `
    <section class="sheet-section">
      <h4 class="sheet-eyebrow">Подача</h4>
      <div class="glass-row">${glassIcon(c.glass_type)}<span>${escapeHtml(c.glass_uk)}</span></div>
      ${c.glass_variant_uk ? `
        <div class="glass-variant">
          ${c.glass_variant_condition_uk ? `<span class="glass-cond">${escapeHtml(c.glass_variant_condition_uk)}</span>` : ''}
          <div class="glass-row">${glassIcon(c.glass_variant_type)}<span>${escapeHtml(c.glass_variant_uk)}</span></div>
        </div>` : ''}
    </section>` : '';

  content.innerHTML = `
    <div class="sheet-tags">
      ${c.category ? `<span class="meta-cat">${categoryIcon(c.category)}${escapeHtml(c.category)}</span>` : ''}
      ${c.is_iba ? `<span class="meta-iba">IBA&thinsp;·&thinsp;${IBA_LABELS[c.iba_category] || ''}</span>` : ''}
      ${abvTagHtml(c)}
    </div>
    <h2 class="sheet-title">${escapeHtml(nameUk)}</h2>
    ${c.name_uk ? `<p class="sheet-title-en">${escapeHtml(c.name)}</p>` : ''}
    ${statusLine}

    <section class="sheet-section">
      <h4 class="sheet-eyebrow">Інгредієнти</h4>
      <ul class="sheet-ingredients">${rows || '<li>Немає даних</li>'}</ul>
    </section>

    ${(instructions || videoMini) ? `
    <section class="sheet-section">
      <h4 class="sheet-eyebrow">Приготування${videoMini}</h4>
      ${instructions ? `<p class="sheet-prose">${escapeHtml(instructions)}</p>` : ''}
    </section>` : ''}

    ${glassBlock}

    ${garnish ? `
    <section class="sheet-section">
      <h4 class="sheet-eyebrow">Гарнір</h4>
      <p class="sheet-prose">${escapeHtml(garnish)}</p>
    </section>` : ''}
  `;

  if (opts.onIngredientClick) {
    content.querySelectorAll('[data-ingredient-id]').forEach((el) => {
      const go = () => opts.onIngredientClick(el.dataset.ingredientId);
      el.addEventListener('click', go);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
      });
    });
  }

  _sheetLastFocused = document.activeElement;
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  content.scrollTop = 0;
  lockScroll(true);
  const closeBtn = document.getElementById('sheet-close-btn');
  if (closeBtn) closeBtn.focus({ preventScroll: true });
}

function closeCocktailSheet() {
  const overlay = document.getElementById('cocktail-sheet');
  if (!overlay || !overlay.classList.contains('open')) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  lockScroll(false);
  if (_sheetLastFocused && _sheetLastFocused.focus) {
    _sheetLastFocused.focus({ preventScroll: true });
  }
  _sheetLastFocused = null;
}
