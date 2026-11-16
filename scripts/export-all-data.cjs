const fs = require('fs');

async function exportAll() {
  const headers = { 'X-EcoDesk-User-Id': 'U_ADMIN' };
  const base = 'http://localhost:8080';

  console.log('Fetching all tables from local backend...');
  const [categories, products, campaigns, banners, orders, reviews, purchases, transactions, movements, payrolls] = await Promise.all([
    fetch(`${base}/api/categories`).then(r => r.json()),
    fetch(`${base}/api/products`).then(r => r.json()),
    fetch(`${base}/api/campaigns`).then(r => r.json()),
    fetch(`${base}/api/banners`).then(r => r.json()),
    fetch(`${base}/api/orders`).then(r => r.json()),
    fetch(`${base}/api/reviews`).then(r => r.json()),
    fetch(`${base}/api/finance/purchases`, { headers }).then(r => r.json()),
    fetch(`${base}/api/finance/transactions`, { headers }).then(r => r.json()),
    fetch(`${base}/api/finance/inventory/movements`, { headers }).then(r => r.json()),
    fetch(`${base}/api/finance/payrolls`, { headers }).then(r => r.json())
  ]);

  const fullDb = {
    categories,
    products,
    campaigns,
    banners,
    orders,
    reviews,
    purchases,
    transactions,
    movements,
    payrolls
  };

  fs.writeFileSync('db.json', JSON.stringify(fullDb, null, 2), 'utf8');
  fs.writeFileSync('backend/db.json', JSON.stringify(fullDb, null, 2), 'utf8');
  console.log('Successfully exported full data into db.json and backend/db.json:');
  console.log({
    categories: categories.length,
    products: products.length,
    campaigns: campaigns.length,
    banners: banners.length,
    orders: orders.length,
    reviews: reviews.length,
    purchases: purchases.length,
    transactions: transactions.length,
    movements: movements.length,
    payrolls: payrolls.length
  });
}

exportAll().catch(console.error);
