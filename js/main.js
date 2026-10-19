// ===============================
// 1. Избранное (кнопки с aria-pressed)
// ===============================
document.querySelectorAll('[data-favorite]').forEach((button) => {
  button.addEventListener('click', () => {
    const isPressed = button.getAttribute('aria-pressed') === 'true';
    button.setAttribute('aria-pressed', String(!isPressed));

    // Карточка получает модификатор состояния.
    const card = button.closest('.product-card');
    if (card) {
      card.classList.toggle('product-card--favorite', !isPressed);
    }
  });
});

// ===============================
// 2. Каталог: фильтры и сортировка
// ===============================
const productsGrid = document.querySelector('[data-sortable]');

if (productsGrid) {
  const cards = Array.from(productsGrid.querySelectorAll('.product-card'));
  const filtersForm = document.getElementById('filters-form');
  const sortSelect = document.getElementById('sort-select');
  const resultsCount = document.getElementById('results-count');
  const emptyMessage = document.getElementById('catalog-empty');

  const comparators = {
    default: (a, b) => a.dataset.order - b.dataset.order,
    'price-asc': (a, b) => a.dataset.price - b.dataset.price,
    'price-desc': (a, b) => b.dataset.price - a.dataset.price,
    name: (a, b) => a.dataset.name.localeCompare(b.dataset.name, 'ru', { numeric: true }),
  };

  // Склонение слова «товар».
  function declension(n) {
    const last = n % 10;
    const lastTwo = n % 100;
    if (last === 1 && lastTwo !== 11) return 'товар';
    if (last >= 2 && last <= 4 && (lastTwo < 10 || lastTwo >= 20)) return 'товара';
    return 'товаров';
  }

  // Проверяем, подходит ли карточка под выбранные фильтры.
  function matches(card, filter) {
    const tags = card.dataset.tags.split(' ');
    const price = Number(card.dataset.price);

    return (
      (!filter.categories.length || filter.categories.includes(card.dataset.category)) &&
      filter.statuses.every((status) => tags.includes(status)) &&
      (Number.isNaN(filter.min) || price >= filter.min) &&
      (Number.isNaN(filter.max) || price <= filter.max)
    );
  }

  function updateCatalog() {
    const data = filtersForm ? new FormData(filtersForm) : null;
    const filter = {
      categories: data ? data.getAll('category') : [],
      statuses: data ? data.getAll('status') : [],
      min: data ? parseFloat(data.get('price-from')) : NaN,
      max: data ? parseFloat(data.get('price-to')) : NaN,
    };

    // Сортируем карточки и переставляем их в сетке.
    const sorted = [...cards].sort(comparators[sortSelect ? sortSelect.value : 'default']);
    sorted.forEach((card) => productsGrid.append(card));

    // Скрываем карточки, которые не подошли под фильтры.
    let visible = 0;
    cards.forEach((card) => {
      const isVisible = matches(card, filter);
      card.hidden = !isVisible;
      if (isVisible) visible += 1;
    });

    // Счётчик объявляется скринридером через role="status".
    resultsCount.textContent = `Найдено: ${visible} ${declension(visible)}`;
    if (emptyMessage) emptyMessage.hidden = visible > 0;
  }

  if (filtersForm) {
    // Если пришли по ссылке catalog.html?category=..., сразу включаем фильтр.
    const initial = new URLSearchParams(window.location.search).get('category');
    const checkbox = initial && filtersForm.querySelector(`input[name="category"][value="${initial}"]`);
    if (checkbox) checkbox.checked = true;

    filtersForm.addEventListener('submit', (event) => {
      event.preventDefault();
      updateCatalog();
    });
    filtersForm.addEventListener('change', updateCatalog);
    filtersForm.addEventListener('reset', () => setTimeout(updateCatalog, 0));
  }

  if (sortSelect) sortSelect.addEventListener('change', updateCatalog);
  updateCatalog();
}

// ===============================
// 3. Модальное окно заявки
// ===============================
const orderDialog = document.getElementById('order-dialog');

if (orderDialog) {
  const orderForm = document.getElementById('order-form');
  const selectedProductInput = document.getElementById('selected-product');
  const dialogProduct = document.getElementById('order-dialog-product');
  const successMessage = document.getElementById('success-message');
  const summary = document.getElementById('order-form-summary');
  const summaryList = document.getElementById('order-summary-list');
  const submitButton = orderForm.querySelector('[type="submit"]');
  const fields = Array.from(orderForm.querySelectorAll('[required], [pattern]'));

  let lastTrigger = null;

  // Текст заказа: название товара + выбранные параметры (если есть).
  function getOrderLabel(button) {
    const name = button.dataset.product;
    const options = button.dataset.options ? document.getElementById(button.dataset.options) : null;
    if (!options) return name;

    const color = options.querySelector('input[name="color"]:checked');
    const quantity = Math.max(1, parseInt(options.querySelector('input[name="quantity"]').value, 10) || 1);
    return `${name} (${color ? color.value + ', ' : ''}${quantity} шт.)`;
  }

  // --- Открытие и закрытие ---
  document.querySelectorAll('[data-product]').forEach((button) => {
    button.addEventListener('click', () => {
      lastTrigger = button;
      const label = getOrderLabel(button);

      selectedProductInput.value = label;
      dialogProduct.textContent = label;
      successMessage.textContent = '';
      fields.forEach(clearError);
      summary.hidden = true;

      orderDialog.showModal();
      document.body.classList.add('is-scroll-locked');
      document.getElementById('order-name').focus();
    });
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => orderDialog.close());
  });

  // Закрытие по клику на затемнённый фон (не при выделении текста мышью).
  let pressStartedOnBackdrop = false;
  orderDialog.addEventListener('mousedown', (event) => {
    pressStartedOnBackdrop = event.target === orderDialog;
  });
  orderDialog.addEventListener('click', (event) => {
    if (event.target === orderDialog && pressStartedOnBackdrop) orderDialog.close();
  });

  // Срабатывает и при Esc: возвращаем прокрутку и фокус на кнопку, открывшую окно.
  orderDialog.addEventListener('close', () => {
    document.body.classList.remove('is-scroll-locked');
    if (lastTrigger) lastTrigger.focus();
  });

  // --- Валидация ---
  const messages = {
    name: { valueMissing: 'Введите имя', customError: 'Имя должно содержать не менее 2 символов' },
    email: { valueMissing: 'Введите e-mail', typeMismatch: 'Введите e-mail в формате example@mail.ru' },
    phone: { valueMissing: 'Введите телефон', patternMismatch: 'Введите телефон в формате +7 (900) 000-00-00' },
    topic: { valueMissing: 'Выберите тему заявки' },
    agreement: { valueMissing: 'Подтвердите согласие на обработку данных' },
  };

  function getMessage(field) {
    field.setCustomValidity('');
    if (field.name === 'name' && field.value.trim().length < 2) {
      field.setCustomValidity('Слишком короткое имя');
    }

    const validity = field.validity;
    if (validity.valid) return '';

    const key = ['valueMissing', 'typeMismatch', 'patternMismatch', 'customError'].find((k) => validity[k]);
    return (messages[field.name] && messages[field.name][key]) || 'Проверьте значение поля';
  }

  function clearError(field) {
    const error = document.getElementById(`${field.id}-error`);
    field.removeAttribute('aria-invalid');
    error.textContent = '';
    error.hidden = true;
  }

  // Проверяем одно поле: выставляем aria-invalid и текст ошибки рядом с полем.
  function validateField(field) {
    const message = getMessage(field);
    if (!message) {
      clearError(field);
      return;
    }
    const error = document.getElementById(`${field.id}-error`);
    field.setAttribute('aria-invalid', 'true');
    error.textContent = message;
    error.hidden = false;
  }

  // Список ошибок в начале формы со ссылками на поля.
  function refreshSummary(shouldFocus) {
    const invalid = fields.filter((field) => field.getAttribute('aria-invalid') === 'true');
    summaryList.innerHTML = '';

    invalid.forEach((field) => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = `#${field.id}`;
      link.textContent = document.getElementById(`${field.id}-error`).textContent;
      item.append(link);
      summaryList.append(item);
    });

    summary.hidden = invalid.length === 0;
    if (shouldFocus && invalid.length) summary.focus();
  }

  summaryList.addEventListener('click', (event) => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    document.querySelector(link.getAttribute('href')).focus();
  });

  function recheck(field) {
    validateField(field);
    if (!summary.hidden) refreshSummary(false);
  }

  fields.forEach((field) => {
    // Ошибка появляется после ухода с заполненного поля, а исчезает сразу после исправления.
    field.addEventListener('blur', () => {
      if (field.type !== 'checkbox' && (field.value || field.hasAttribute('aria-invalid'))) recheck(field);
    });
    ['input', 'change'].forEach((type) => {
      field.addEventListener(type, () => {
        if (field.hasAttribute('aria-invalid')) recheck(field);
      });
    });
  });

  // --- Отправка ---
  orderForm.addEventListener('submit', (event) => {
    // Backend пока не подключён, поэтому стандартную отправку отменяем.
    event.preventDefault();

    fields.forEach(validateField);
    refreshSummary(true);
    if (orderForm.querySelector('[aria-invalid="true"]')) return;

    // Имитируем отправку на сервер: показываем состояние загрузки.
    submitButton.disabled = true;
    submitButton.classList.add('button--loading');
    submitButton.textContent = 'Отправляем';

    setTimeout(() => {
      successMessage.textContent = `Форма успешно отправлена! Товар: ${selectedProductInput.value}.`;
      orderForm.reset();
      orderDialog.close();

      submitButton.disabled = false;
      submitButton.classList.remove('button--loading');
      submitButton.textContent = 'Отправить заявку';

      setTimeout(() => {
        successMessage.textContent = '';
      }, 10000);
    }, 700);
  });
}

// ===============================
// 4. Карточка товара (product.html?id=N)
// ===============================
const productPage = document.querySelector('.product-details');

if (productPage) {
  const CATEGORIES = { gadgets: 'Гаджеты', accessories: 'Аксессуары', home: 'Для дома' };
  const PREFIX = { gadgets: 'GD', accessories: 'AC', home: 'HM' };

  // Данные товаров (позже их заменит backend).
  const PRODUCTS = {
    1: { cat: 'gadgets', price: 1000, tag: '', rating: '4,2', reviews: 14, material: 'Пластик', size: '110 × 55 × 22 мм', weight: '150 г', warranty: '6 месяцев', power: 'Аккумулятор, 1500 мА·ч' },
    2: { cat: 'gadgets', price: 1500, tag: 'hit', rating: '4,6', reviews: 28, material: 'Пластик ABS', size: '120 × 60 × 25 мм', weight: '180 г', warranty: '12 месяцев', power: 'Аккумулятор, 2000 мА·ч' },
    3: { cat: 'accessories', price: 2000, old: 2500, tag: 'discount', rating: '4,4', reviews: 19, material: 'Кожа', size: '90 × 60 × 10 мм', weight: '80 г', warranty: '12 месяцев' },
    4: { cat: 'home', price: 1200, tag: 'new', rating: '4,0', reviews: 5, material: 'Керамика', size: '100 × 100 × 90 мм', weight: '350 г', warranty: '12 месяцев' },
    5: { cat: 'accessories', price: 800, tag: '', rating: '4,1', reviews: 22, material: 'Силикон', size: '70 × 50 × 12 мм', weight: '40 г', warranty: '6 месяцев' },
    6: { cat: 'gadgets', price: 3200, tag: 'out', rating: '4,8', reviews: 41, material: 'Алюминий', size: '130 × 65 × 28 мм', weight: '240 г', warranty: '24 месяца', power: 'Аккумулятор, 3000 мА·ч' },
    7: { cat: 'home', price: 2700, old: 3000, tag: 'discount', rating: '4,5', reviews: 17, material: 'Стекло', size: '200 × 200 × 150 мм', weight: '900 г', warranty: '12 месяцев' },
    8: { cat: 'accessories', price: 450, tag: 'new', rating: '4,3', reviews: 8, material: 'Ткань', size: '150 × 100 × 5 мм', weight: '30 г', warranty: '3 месяца' },
    9: { cat: 'home', price: 4900, tag: 'hit', rating: '4,7', reviews: 33, material: 'Дерево', size: '400 × 300 × 250 мм', weight: '2300 г', warranty: '24 месяца' },
  };

  const byId = (id) => document.getElementById(id);

  // Номер товара берём из адреса: product.html?id=8. Если он неверный — показываем товар 2.
  const requested = new URLSearchParams(window.location.search).get('id');
  const id = PRODUCTS[requested] ? requested : '2';
  const p = PRODUCTS[id];
  const name = `Товар ${id}`;
  const categoryName = CATEGORIES[p.cat];
  const isOut = p.tag === 'out';
  const discount = p.old ? Math.round(((p.old - p.price) / p.old) * 100) : 0;

  document.title = `${name} — Учебный интернет-магазин`;
  byId('product-title').textContent = name;
  byId('crumb-current').textContent = name;

  const image = byId('product-image');
  image.src = `images/product-${id}.svg`;
  image.alt = name;

  const crumb = byId('crumb-category');
  crumb.textContent = categoryName;
  crumb.href = p.cat === 'gadgets' ? 'category.html' : `catalog.html?category=${p.cat}`;

  // Бейдж.
  const badge = byId('product-badge');
  const badges = { hit: ['Хит', ''], new: ['Новинка', 'badge--new'], discount: [`−${discount}%`, 'badge--discount'] };
  if (badges[p.tag]) {
    badge.textContent = badges[p.tag][0];
    badge.className = `badge ${badges[p.tag][1]}`.trim();
  } else {
    badge.hidden = true;
  }

  byId('product-rating').textContent = `Рейтинг: ${p.rating} из 5 (${p.reviews} отзывов)`;
  byId('product-price').innerHTML = p.old
    ? `<s class="product-card__price-old"><span class="visually-hidden">Старая цена: </span>${p.old} руб.</s> <span class="visually-hidden">Новая цена: </span>${p.price} руб.`
    : `${p.price} руб.`;

  const stock = byId('product-stock');
  stock.className = isOut ? 'stock stock--out' : 'stock stock--in';
  stock.textContent = isOut ? 'Нет в наличии' : 'В наличии, отправим завтра';

  byId('product-short').textContent = `${name} — учебный товар категории «${categoryName}».`;
  byId('product-long').textContent = `${name} изготовлен из материала «${p.material.toLowerCase()}» и весит ${p.weight}. Подходит для повседневного использования, на него действует гарантия ${p.warranty}.`;
  byId('product-features').innerHTML = `<li>Материал: ${p.material.toLowerCase()};</li><li>вес: ${p.weight};</li><li>гарантия: ${p.warranty}.</li>`;

  // Кнопка заказа: название товара берётся из data-product в момент клика.
  const orderButton = byId('product-order-button');
  orderButton.dataset.product = name;
  orderButton.disabled = isOut;

  // Таблица характеристик.
  const groups = [
    ['Основное', [['Артикул', `${PREFIX[p.cat]}-${String(id).padStart(3, '0')}`], ['Категория', categoryName], ['Цвета', 'Серый, синий, чёрный']]],
    ['Технические характеристики', [['Материал', p.material], ['Габариты', p.size], ['Вес', p.weight], ...(p.power ? [['Питание', p.power]] : [])]],
    ['Гарантия и сервис', [['Гарантия', p.warranty], ['Страна производства', 'Россия'], ['Возврат', 'В течение 14 дней']]],
  ];
  byId('specs-table').innerHTML =
    `<caption>Характеристики: ${name}</caption>` +
    groups.map(([title, rows]) =>
      `<tbody><tr class="data-table__group"><th scope="rowgroup" colspan="2">${title}</th></tr>` +
      rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('') + '</tbody>'
    ).join('');

  // Таблица сравнения: все товары этой же категории, текущий выделен.
  const peers = Object.keys(PRODUCTS).filter((key) => PRODUCTS[key].cat === p.cat);
  const compareRows = [
    ['Цена', (q) => `${q.price} руб.`],
    ['Вес', (q) => q.weight],
    ['Материал', (q) => q.material],
    ['Гарантия', (q) => q.warranty],
    ['Рейтинг', (q) => `${q.rating} из 5`],
    ['Наличие', (q) => (q.tag === 'out' ? 'Нет в наличии' : 'В наличии')],
  ];
  const current = (key) => (key === id ? ' class="data-table__cell--current"' : '');
  byId('compare-table').innerHTML =
    `<caption>Сравнение товаров категории «${categoryName}»</caption>` +
    `<thead><tr><td></td>${peers.map((key) => `<th scope="col"${current(key)}>Товар ${key}${key === id ? ' <span class="data-table__note">(этот товар)</span>' : ''}</th>`).join('')}</tr></thead>` +
    `<tbody>${compareRows.map(([label, get]) => `<tr><th scope="row">${label}</th>${peers.map((key) => `<td${current(key)}>${get(PRODUCTS[key])}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
