'use strict';
const state = { users: [], products: [], orders: [], pending: false, loading: false, ready: false };
const byId = id => document.getElementById(id);
const money = value => `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
const drawings = {
  mouse: '<g transform="rotate(-18 110 79)"><ellipse cx="110" cy="79" rx="40" ry="59" fill="#dde0d1"/><path d="M110 20c24 0 40 25 40 58H70c0-33 16-58 40-58" fill="#fafbf3"/><path d="M110 21v57" stroke="#c3c9b5" stroke-width="1.5"/><rect x="107" y="40" width="6" height="15" rx="3" fill="#8e9d7e"/></g>',
  keyboard: '<g transform="translate(13 31) rotate(-12 100 45)"><rect y="5" width="194" height="83" rx="8" fill="#bdc7a9"/><rect width="194" height="79" rx="7" fill="#f7f8ed"/><g fill="#dce2cc">' + Array.from({length:40}, (_, i) => `<rect x="${9 + (i % 10) * 18}" y="${9 + Math.floor(i / 10) * 14}" width="14" height="10" rx="2"/>`).join('') + '<rect x="45" y="65" width="88" height="7" rx="2"/></g><rect x="171" y="9" width="14" height="10" rx="2" fill="#839c60"/></g>',
  monitor: '<path d="M102 102h17l4 27h-25z" fill="#a9b2a1"/><ellipse cx="111" cy="132" rx="39" ry="5" fill="#b7c0ac"/><rect x="21" y="12" width="180" height="100" rx="6" fill="#344437"/><rect x="28" y="19" width="166" height="84" rx="2" fill="#d9e5bd"/><circle cx="112" cy="61" r="27" fill="#c4d59e"/><path d="m87 79 24-36 25 36z" fill="#879e64"/><circle cx="155" cy="39" r="9" fill="#f3f4da"/>',
  generic: '<path d="m110 20 65 34v65l-65 33-65-33V54z" fill="#d3dfbe"/><path d="m45 54 65 34 65-34M110 88v64" fill="none" stroke="#90a575" stroke-width="3"/><path d="m78 37 65 34" stroke="#90a575" stroke-width="12"/>'
};
function meta(product) {
  const name = String(product.nom).toLocaleLowerCase('fr');
  if (/souris|mouse/.test(name)) return ['mouse', 'PRÉCISION', 'Chaque mouvement compte.'];
  if (/clavier|keyboard/.test(name)) return ['keyboard', 'CRÉATIVITÉ', 'À chaque touche, une nouvelle idée.'];
  if (/écran|ecran|monitor/.test(name)) return ['monitor', 'PERSPECTIVE', 'Voyez vos projets en plus grand.'];
  return ['generic', 'ESSENTIEL', 'Une place de choix sur votre bureau.'];
}
function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
function message(id, text = '', error = false) {
  const element = byId(id);
  element.textContent = text;
  element.classList.toggle('error', error);
  element.hidden = !text;
}
async function api(path, options) {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(15000) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('La boutique est momentanément indisponible. Réessayez dans un instant.'); }
  if (!response.ok) throw new Error(data.erreur || 'La demande a échoué. Veuillez réessayer.');
  return data;
}
function renderProducts() {
  const query = byId('search').value.trim().toLocaleLowerCase('fr');
  const products = state.products.filter(product => String(product.nom).toLocaleLowerCase('fr').includes(query));
  byId('products').replaceChildren();
  byId('product-count').textContent = `${products.length} produit${products.length > 1 ? 's' : ''}`;
  for (const product of products) {
    const [illustration, category, description] = meta(product);
    const selected = String(product.id) === byId('product').value;
    const card = node('article', `product-card${selected ? ' selected' : ''}`);
    const picture = node('div', 'product-picture');
    // This template contains static illustrations only, never API data.
    picture.innerHTML = `<svg viewBox="0 0 220 165" aria-hidden="true">${drawings[illustration]}</svg>`;
    picture.append(node('span', 'product-tag', 'L’ESSENTIEL'));
    const info = node('div', 'product-info');
    info.append(node('p', 'product-category', category), node('h3', '', product.nom), node('p', 'product-description', description));
    const action = node('div', 'product-action');
    const price = node('span', 'price', new Intl.NumberFormat('fr-FR').format(product.prix) + ' ');
    price.append(node('small', '', 'FCFA'));
    const button = node('button', 'add-product', selected ? '✓' : '+');
    button.type = 'button';
    button.setAttribute('aria-label', `Sélectionner ${product.nom}`);
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = state.pending || state.loading || !state.ready;
    button.addEventListener('click', () => {
      byId('product').value = String(product.id);
      updateTotal();
      renderProducts();
      byId('products').querySelector('.selected button')?.focus({ preventScroll: true });
      message('order-message');
    });
    action.append(price, button);
    info.append(action);
    card.append(picture, info);
    byId('products').append(card);
  }
  if (!products.length) byId('products').append(node('p', 'empty', query ? 'Aucun produit ne correspond à votre recherche.' : 'Le catalogue est vide pour le moment.'));
}
function renderUsers() {
  byId('client-count').textContent = `${state.users.length} client${state.users.length > 1 ? 's' : ''}`;
  byId('users').replaceChildren();
  for (const user of state.users) {
    const card = node('div', 'client-card');
    const initials = String(user.nom).trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toLocaleUpperCase('fr');
    const details = node('div', 'client-details');
    details.append(node('strong', '', user.nom), node('p', '', user.email || 'Aucune adresse e-mail'));
    card.append(node('span', 'avatar', initials), details, node('span', 'client-number', `#${user.id}`));
    byId('users').append(card);
  }
  if (!state.users.length) byId('users').append(node('p', 'empty', 'Aucun client enregistré pour le moment.'));
}
function renderOrders() {
  byId('orders').replaceChildren();
  for (const order of [...state.orders].reverse()) {
    const row = node('tr');
    [`#${String(order.id).padStart(3, '0')}`, order.client, order.produit, order.quantite, money(order.total)].forEach(value => row.append(node('td', '', value)));
    byId('orders').append(row);
  }
  if (!state.orders.length) {
    const row = node('tr');
    const cell = node('td', 'empty', 'Votre prochaine bonne idée commence ici. Choisissez un produit pour passer votre première commande.');
    cell.colSpan = 5;
    row.append(cell);
    byId('orders').append(row);
  }
  byId('order-count').textContent = state.orders.length;
  byId('nav-count').textContent = state.orders.length;
  byId('item-count').textContent = state.orders.reduce((sum, order) => sum + Number(order.quantite), 0);
  byId('revenue').textContent = money(state.orders.reduce((sum, order) => sum + Number(order.total), 0));
}
function fillSelect(id, items, emptyLabel) {
  const select = byId(id);
  const previous = select.value;
  select.replaceChildren();
  for (const item of items) select.append(new Option(item.nom, item.id));
  if (items.some(item => String(item.id) === previous)) select.value = previous;
  if (!items.length) select.append(new Option(emptyLabel, ''));
}
function updateTotal() {
  const product = state.products.find(item => String(item.id) === byId('product').value);
  const quantity = Number(byId('qty').value);
  byId('unit-price').textContent = product ? money(product.prix) : '—';
  byId('total-price').textContent = product && Number.isInteger(quantity) && quantity > 0 && quantity <= 999 ? money(product.prix * quantity) : '—';
}
function updateControls() {
  const busy = state.pending || state.loading;
  byId('user').disabled = busy || !state.ready || !state.users.length;
  byId('product').disabled = busy || !state.ready || !state.products.length;
  for (const id of ['qty', 'decrease', 'increase']) byId(id).disabled = busy;
  byId('submit-order').disabled = busy || !state.ready || !state.products.length || !state.users.length;
  byId('refresh').disabled = busy;
  byId('submit-label').textContent = state.pending ? 'Enregistrement…' : 'Confirmer la commande';
}
async function load() {
  if (state.loading || state.pending) return;
  state.loading = true;
  updateControls();
  renderProducts();
  message('global-message');
  const results = await Promise.allSettled([api('/api/users'), api('/api/products'), api('/api/orders')]);
  const keys = ['users', 'products', 'orders'];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) state[keys[index]] = result.value;
  });
  state.ready = results.slice(0, 2).every(result => result.status === 'fulfilled' && Array.isArray(result.value));
  state.loading = false;
  fillSelect('user', state.users, 'Aucun client disponible');
  fillSelect('product', state.products, 'Aucun produit disponible');
  renderUsers(); renderProducts(); renderOrders(); updateTotal(); updateControls();
  if (results.some(result => result.status === 'rejected' || !Array.isArray(result.value))) {
    message('global-message', 'Certaines données n’ont pas pu être chargées. Vérifiez que les services sont démarrés, puis cliquez sur « Actualiser ». Les données affichées peuvent être incomplètes ou anciennes.', true);
  }
}
byId('search').addEventListener('input', renderProducts);
byId('product').addEventListener('change', () => { updateTotal(); renderProducts(); message('order-message'); });
byId('qty').addEventListener('input', updateTotal);
for (const [id, step] of [['decrease', -1], ['increase', 1]]) {
  byId(id).addEventListener('click', () => {
    const current = Number(byId('qty').value);
    byId('qty').value = Math.min(999, Math.max(1, (Number.isFinite(current) ? Math.trunc(current) : 1) + step));
    updateTotal();
  });
}
byId('refresh').addEventListener('click', load);
byId('order-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (state.pending || state.loading || !state.ready || !event.currentTarget.reportValidity()) return;
  const body = { user_id: Number(byId('user').value), product_id: Number(byId('product').value), quantite: Number(byId('qty').value) };
  if (!Number.isInteger(body.quantite) || body.quantite < 1 || body.quantite > 999) return;
  state.pending = true;
  updateControls(); renderProducts(); message('order-message');
  try {
    const order = await api('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    state.orders = state.orders.filter(existing => existing.id !== order.id);
    state.orders.push(order);
    renderOrders();
    message('order-message', `Merci ${order.client} ! Votre commande n°${order.id} est enregistrée : ${order.quantite} × ${order.produit}, pour ${money(order.total)}.`);
  } catch (error) {
    message('order-message', error.name === 'TimeoutError' || error.name === 'TypeError' ? 'La confirmation n’a pas été reçue. Actualisez l’historique pour vérifier si la commande a été enregistrée avant de réessayer.' : error.message, true);
  } finally {
    state.pending = false;
    updateControls(); renderProducts();
  }
});
load();
