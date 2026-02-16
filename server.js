const express = require('express');
const path = require('path');
const axios = require('axios');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// HubMSG API Config
const HUBMSG_CONFIG = {
 API_KEY: 'API-KEY-XXXX', // User should replace this
 URL: 'https://hubmsgpanel.octotech.az/api/message'
};

async function sendSMS(phone, message) {
 if (!phone) return false;
 try {
 await axios.post(HUBMSG_CONFIG.URL, {
 recipient: phone,
 message: message
 }, {
 headers: {
 'x-api-key': HUBMSG_CONFIG.API_KEY,
 'Content-Type': 'application/json'
 }
 });
 return true;
 } catch (e) {
 console.error('HubMSG Error:', e.message);
 return false;
 }
}

// Multer Config
// Multer setup for receipts
const receiptStorage = multer.diskStorage({
 destination: (req, file, cb) => {
 const dir = path.join(__dirname, 'public/uploads/receipts');
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }
 cb(null, dir);
 },
 filename: (req, file, cb) => cb(null, 'receipt-' + Date.now() + path.extname(file.originalname))
});
const uploadReceipt = multer({
 storage: receiptStorage,
 limits: { fileSize: Infinity, files: Infinity }
});

// Multer setup for product images
const productStorage = multer.diskStorage({
 destination: (req, file, cb) => {
 const dir = path.join(__dirname, 'public/uploads/products');
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }
 cb(null, dir);
 },
 filename: (req, file, cb) => cb(null, 'product-' + Date.now() + path.extname(file.originalname))
});
const uploadProduct = multer({
 storage: productStorage,
 limits: { fileSize: Infinity, files: Infinity }
});

// Multer setup for category images
const categoryStorage = multer.diskStorage({
 destination: (req, file, cb) => {
 const dir = path.join(__dirname, 'public/uploads/categories');
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }
 cb(null, dir);
 },
 filename: (req, file, cb) => cb(null, 'category-' + Date.now() + path.extname(file.originalname))
});
const uploadCategory = multer({
 storage: categoryStorage,
 limits: { fileSize: Infinity, files: Infinity }
});

// Multer setup for sliders/banners
const sliderStorage = multer.diskStorage({
 destination: (req, file, cb) => {
 const dir = path.join(__dirname, 'public/uploads/sliders');
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }
 cb(null, dir);
 },
 filename: (req, file, cb) => cb(null, 'slider-' + Date.now() + path.extname(file.originalname))
});
const uploadSlider = multer({
 storage: sliderStorage,
 limits: { fileSize: Infinity, files: Infinity }
});


// API Config
const API_CONFIG = {
 BASE_URL: 'https://bayi.lisansofisi.com/api',
 API_KEY: 'ak_803b789e6aed8a50f21fb6b6a9bddaa5_1769965145'
};

const PUBG_CHECKER_CONFIG = {
 BASE_URL: (process.env.PUBG_CHECKER_URL || 'http://azpinx-pubg-checker:3000').replace(/\/$/, ''),
 TIMEOUT: Number(process.env.PUBG_CHECKER_TIMEOUT_MS || 10000)
};

// Database Connection
let db;
(async () => {
 try {
 db = await mysql.createConnection({
 host: process.env.DB_HOST || 'localhost',
 user: process.env.DB_USER || 'root',
 password: process.env.DB_PASSWORD || '',
 database: process.env.DB_NAME || 'azpinx_db'
 });
 console.log("MySQL Connected!");

 // --- Database Initialization ---
 const tables = [
 `CREATE TABLE IF NOT EXISTS users (
 id INT AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(100) NOT NULL,
 email VARCHAR(100) UNIQUE NOT NULL,
 password VARCHAR(255) NOT NULL,
 role ENUM('user', 'admin', 'reseller') DEFAULT 'user',
 balance DECIMAL(10, 2) DEFAULT 0.00,
 phone VARCHAR(20),
 two_factor_enabled TINYINT(1) DEFAULT 0,
 otp_code VARCHAR(10) NULL,
 otp_expiry DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS categories (
 id INT AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 icon VARCHAR(50) DEFAULT 'ri-stack-line',
 description TEXT,
 image_path VARCHAR(255),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS products (
 id INT AUTO_INCREMENT PRIMARY KEY,
 api_id VARCHAR(50) UNIQUE NULL,
 name VARCHAR(255) NOT NULL,
 category VARCHAR(100),
 category_id INT NULL,
 price DECIMAL(10, 2) NOT NULL,
 description TEXT,
 image_path VARCHAR(255),
 status ENUM('sale', 'draft') DEFAULT 'sale',
 is_active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS wishlist (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 product_id INT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY unique_wish (user_id, product_id)
 )`,
 `CREATE TABLE IF NOT EXISTS tickets (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT,
 order_id INT NULL,
 subject VARCHAR(255) NOT NULL,
 status ENUM('open', 'closed') DEFAULT 'open',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS ticket_messages (
 id INT AUTO_INCREMENT PRIMARY KEY,
 ticket_id INT,
 sender_id INT,
 message TEXT NOT NULL,
 is_admin TINYINT(1) DEFAULT 0,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS orders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT,
 product_name VARCHAR(255) NOT NULL,
 amount DECIMAL(10, 2) NOT NULL,
 sender_name VARCHAR(100) NOT NULL,
 receipt_path VARCHAR(255),
 status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
 payment_method VARCHAR(50) DEFAULT 'C2C Card Transfer',
 player_id VARCHAR(100),
 player_nickname VARCHAR(255),
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS home_sections (
 id INT AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 category_id INT NULL,
 type ENUM('featured', 'popular', 'new') DEFAULT 'featured',
 product_ids TEXT,
 order_index INT DEFAULT 0,
 is_active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS sliders (
 id INT AUTO_INCREMENT PRIMARY KEY,
 image_path VARCHAR(255) NOT NULL,
 title VARCHAR(255),
 description TEXT,
 link VARCHAR(255),
 order_index INT DEFAULT 0,
 is_active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS announcements (
 id INT AUTO_INCREMENT PRIMARY KEY,
 title VARCHAR(255) NOT NULL,
 message TEXT NOT NULL,
 type VARCHAR(50) DEFAULT 'info',
 is_active TINYINT(1) DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS settings (
 id INT AUTO_INCREMENT PRIMARY KEY,
 setting_key VARCHAR(100) UNIQUE NOT NULL,
 setting_value TEXT,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 )`
 ];

 for (const sql of tables) {
 await db.execute(sql);
 }
 console.log("Database Schema Verified/Created.");

 const migrations = [
 { table: 'home_sections', column: 'category_id', definition: 'INT NULL AFTER title' },
 { table: 'home_sections', column: 'order_index', definition: 'INT DEFAULT 0 AFTER product_ids', oldColumn: 'sort_order' },
 { table: 'sliders', column: 'description', definition: 'TEXT AFTER title' },
 { table: 'sliders', column: 'order_index', definition: 'INT DEFAULT 0 AFTER link', oldColumn: 'sort_order' },
 { table: 'products', column: 'category_id', definition: 'INT NULL AFTER category' },
 { table: 'orders', column: 'player_id', definition: 'VARCHAR(100) AFTER payment_method' },
 { table: 'orders', column: 'player_nickname', definition: 'VARCHAR(255) AFTER player_id' },
 { table: 'users', column: 'two_factor_enabled', definition: 'TINYINT(1) DEFAULT 0 AFTER phone', oldColumn: 'two_fa_enabled' },
 { table: 'users', column: 'otp_code', definition: 'VARCHAR(10) NULL AFTER two_factor_enabled' },
 { table: 'users', column: 'otp_expiry', definition: 'DATETIME NULL AFTER otp_code' }
 ];

 for (const m of migrations) {
 try {
 // Use information_schema for better compatibility with prepared statements
 const [cols] = await db.execute(
"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
 [m.table, m.column]
 );

 if (cols.length === 0) {
 if (m.oldColumn) {
 const [oldCols] = await db.execute(
"SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
 [m.table, m.oldColumn]
 );
 if (oldCols.length > 0) {
 console.log(`Migrating ${m.table}: Renaming ${m.oldColumn} to ${m.column}`);
 await db.execute(`ALTER TABLE ${m.table} CHANGE ${m.oldColumn} ${m.column} ${m.definition}`);
 continue;
 }
 }
 console.log(`Migrating ${m.table}: Adding column ${m.column}`);
 await db.execute(`ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.definition}`);
 }
 } catch (err) {
 console.warn(`Migration Warning for ${m.table}.${m.column}:`, err.message);
 }
 }
 console.log("Database Migration Complete.");

 // --- Seed Default Settings ---
 const defaultSettings = [
 { key: 'bank_card', value: '4127 0000 1111 2222' },
 { key: 'bank_name', value: 'ABB BANK' },
 { key: 'bank_holder', value: 'AZPINX ADMIN' },
 { key: 'reseller_discount_percent', value: '8' }
 ];

 for (const s of defaultSettings) {
 const [exists] = await db.execute("SELECT id FROM settings WHERE setting_key = ?", [s.key]);
 if (exists.length === 0) {
 console.log(`Seeding setting: ${s.key}`);
 await db.execute("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)", [s.key, s.value]);
 }
 }


 // Check if admin user exists, if not create default
 const [admins] = await db.execute("SELECT * FROM users WHERE role = 'admin'");
 if (admins.length === 0) {
 const hashedPw = await bcrypt.hash('admin123', 10);
 await db.execute("INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)",
 ['Admin User', 'admin@azpinx.com', hashedPw, 'admin']);
 console.log("Default Admin user created: admin@azpinx.com / admin123");
 }

 } catch (err) {
 console.error("Database Error:", err.message);
 }
})();

// Helper to fetch products with local overrides
async function getMappedProducts() {
 try {
 const response = await axios.get(`${API_CONFIG.BASE_URL}/products`, {
 headers: { 'X-API-Key': API_CONFIG.API_KEY }
 });

 const apiProducts = response.data.data.products; // Access the 'data.products' array
 const [localProducts] = await db.execute('SELECT * FROM products');

 // Merge API products with local products
 // Local products with api_id should override or supplement API data
 // Any product in MySQL without api_id is a"Custom Product"

 let finalProducts = [];

 // 1. Process API products
	 apiProducts.forEach(apiProd => {
	 const localOverride = localProducts.find(lp => lp.api_id == apiProd.id);
	 if (localOverride) {
	 finalProducts.push({
	 id: apiProd.id,
	 db_id: localOverride.id,
	 name: localOverride.name || apiProd.name,
	 category: localOverride.category || apiProd.category_name,
	 category_id: localOverride.category_id || null,
	 price: parseFloat(localOverride.price || apiProd.price),
	 description: localOverride.description || apiProd.description,
	 image: localOverride.image_path ? localOverride.image_path : apiProd.image,
	 status: localOverride.status || 'sale',
	 is_active: Number(localOverride.is_active ?? 1) === 1,
	 is_local: true,
	 api_id: apiProd.id,
	 badge: apiProd.in_stock ?"Stokda" :"Bitib"
	 });
	 } else {
	 finalProducts.push({
	 id: apiProd.id,
	 name: apiProd.name,
	 category: apiProd.category_name,
	 category_id: null,
	 price: parseFloat(apiProd.price),
	 description: apiProd.description,
	 image: apiProd.image ||"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80",
	 status: 'sale',
	 is_active: true,
	 is_local: false,
	 api_id: apiProd.id,
	 badge: apiProd.in_stock ?"Stokda" :"Bitib"
	 });
 }
 });

 // 2. Add local-only products (without api_id)
 localProducts.filter(lp => !lp.api_id).forEach(lp => {
	 finalProducts.push({
	 id: 'local_' + lp.id,
	 db_id: lp.id,
	 name: lp.name,
	 category: lp.category,
	 category_id: lp.category_id || null,
	 price: parseFloat(lp.price),
	 description: lp.description,
	 image: lp.image_path ||"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80",
	 status: lp.status || 'sale',
	 is_active: Number(lp.is_active ?? 1) === 1,
	 is_local: true,
	 api_id: null,
	 badge:"Lokal"
	 });
 });

 return finalProducts;
 } catch (error) {
 console.error("API Fetch Error:", error.message);
 // If API fails, return whatever we have in DB
 const [local] = await db.execute('SELECT * FROM products');
	 return local.map(lp => ({
	 id: lp.api_id || 'local_' + lp.id,
	 db_id: lp.id,
	 name: lp.name,
	 category: lp.category,
	 category_id: lp.category_id || null,
	 price: parseFloat(lp.price),
	 description: lp.description,
	 image: lp.image_path ? '/uploads/products/' + lp.image_path : '/images/default-product.png',
	 status: lp.status || 'sale',
	 is_active: Number(lp.is_active ?? 1) === 1,
	 is_local: true,
	 api_id: lp.api_id,
	 badge:"Stokda"
	 }));
	 }
}

function normalizeOptionalString(value) {
 if (value === undefined || value === null) return null;
 if (typeof value !== 'string') return value;
 const trimmed = value.trim();
 return trimmed === '' ? null : trimmed;
}

function clampPercent(value, min = 0, max = 90) {
 const n = Number(value);
 if (Number.isNaN(n)) return min;
 return Math.min(max, Math.max(min, n));
}

async function getResellerDiscountPercent() {
 try {
 const [rows] = await db.execute('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', ['reseller_discount_percent']);
 if (!rows.length) return 0;
 return clampPercent(rows[0].setting_value, 0, 90);
 } catch (e) {
 console.error('Reseller discount fetch error:', e.message);
 return 0;
 }
}

function applyResellerPricing(products, user, discountPercent) {
 if (!user || user.role !== 'reseller') return products;
 const percent = clampPercent(discountPercent, 0, 90);
 if (!percent) return products;
 return products.map((p) => {
 const basePrice = Number(p.price || 0);
 const discounted = Number((basePrice * (1 - percent / 100)).toFixed(2));
 return {
 ...p,
 oldPrice: basePrice,
 price: discounted
 };
 });
}

// Middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true, limit: '100mb' }));
app.use(bodyParser.json({ limit: '100mb' }));
app.use(express.json({ limit: '100mb' }));
app.set('trust proxy', 1);
app.use(session({
 secret: process.env.SESSION_SECRET || 'azpinx_secret_key',
 resave: false,
 saveUninitialized: false,
 cookie: {
 secure: false,
 httpOnly: true,
 sameSite: 'lax',
 maxAge: 24 * 60 * 60 * 1000 // 24 hours
 }
}));

// Global Context Middleware
app.use(async (req, res, next) => {
 try {
 res.locals.user = req.session.user || null;
 res.locals.error = req.session.error || null;
 res.locals.success = req.session.success || null;

 // Fetch user balance if logged in
 if (req.session.user && db) {
 const [userData] = await db.execute('SELECT balance FROM users WHERE id = ?', [req.session.user.id]);
 if (userData.length > 0) {
 req.session.user.balance = userData[0].balance; // Update session
 res.locals.user.balance = userData[0].balance;
 }
 }

 // Fetch active announcements (HubMsg)
 if (db) {
 const [announcements] = await db.execute('SELECT * FROM announcements WHERE is_active = 1 ORDER BY created_at DESC').catch(() => [[]]);
 res.locals.announcements = announcements;

 // Fetch Bank Settings
 const [settings] = await db.execute('SELECT * FROM settings');
 const settingsMap = {};
 settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);
 res.locals.settings = settingsMap;
 } else {
 res.locals.announcements = [];
 res.locals.settings = {};
 }

 delete req.session.error;
 delete req.session.success;
 } catch (err) {
 console.error("Middleware Error:", err.message);
 res.locals.announcements = [];
 }
 next();
});

// Admin Middleware
const isAdmin = (req, res, next) => {
 if (!req.body) req.body = {}; // Defensive check
 if (req.session.user && req.session.user.role === 'admin') {
 return next();
 }
 req.session.error = 'Bu səhifəyə daxil olmaq üçün icazəniz yoxdur.';
 res.redirect('/');
};

const isReseller = (req, res, next) => {
 if (!req.body) req.body = {};
 if (req.session.user && req.session.user.role === 'reseller') {
 return next();
 }
 req.session.error = 'Bu səhifə yalnız bayilər üçündür.';
 res.redirect('/');
};

// --- Page Routes ---

app.get('/', async (req, res) => {
 try {
 const [dbCategories] = await db.execute('SELECT * FROM categories');

 // Manual Icon Mapping
 const CATEGORY_ICONS = {
 'PUBG ID': 'ri-id-card-line',
 'PUBG UC': 'ri-focus-3-line',
 'Free Fire': 'ri-fire-line',
 'Valorant': 'ri-shield-star-line',
 'Mobile Legends': 'ri-smartphone-line',
 'Steam': 'ri-steam-fill',
 'Google Play': 'ri-google-play-fill',
 'iTunes': 'ri-apple-fill',
 'PlayStation': 'ri-playstation-fill',
 'Xbox': 'ri-xbox-fill',
 'Roblox': 'ri-shapes-line',
 'Razer Gold': 'ri-coins-line'
 };

 const categories = dbCategories.map(c => ({
 id: c.id,
 name: c.name,
 filter: c.name,
 icon: CATEGORY_ICONS[c.name] || c.icon || 'ri-gamepad-line',
 image_path: c.image_path
 }));

 let allProducts = await getMappedProducts();
 const resellerDiscountPercent = await getResellerDiscountPercent();
 allProducts = applyResellerPricing(allProducts, req.session.user, resellerDiscountPercent);

 // Filter by Status (Only Sale)
 allProducts = allProducts.filter(p => p.status === 'sale' && p.is_active);
 const saleProductCount = allProducts.length;

 // Filter by Category if provided
 const selectedCategory = req.query.category;
 if (selectedCategory) {
 allProducts = allProducts.filter(p => p.category === selectedCategory);
 }

 // Fetch Home Sections
 const [sections] = await db.execute('SELECT * FROM home_sections WHERE is_active = TRUE ORDER BY order_index ASC');

 const sectionsWithProducts = await Promise.all(sections.map(async (section) => {
 let products = [];
 if (section.category_id) {
 // Fetch products for this category
 const allCatProducts = allProducts.filter(p => p.category_id === section.category_id);
 products = allCatProducts.slice(0, 8); // Limit to 8 products per section
 } else {
 // If no category, maybe fetch random or latest? For now empty.
 // Or if it's"Featured" (no category but title exists), maybe manual selection later?
 // For now, let's just use the section title as a separator if no products.
 }
 return { ...section, products };
 }));

 // Keep"Featured" logic if no sections exist, or as a fallback/top section?
 // The user wants admin to sort categories.
 // Let's pass sectionsWithProducts to view.

 // Search if provided
 const searchQuery = req.query.search || req.query.q;
 if (searchQuery) {
 allProducts = allProducts.filter(p =>
 p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.description.toLowerCase().includes(searchQuery.toLowerCase())
 );
 }

 // Sort: Games first
 const gamePriority = [
 'PUBG ID', 'PUBG UC', 'Free Fire', 'Valorant',
 'Mobile Legends', 'Steam', 'Roblox', 'Razer Gold',
 'PlayStation', 'Xbox', 'Google Play', 'iTunes'
 ];

 allProducts.sort((a, b) => {
 const aPriority = gamePriority.indexOf(a.category);
 const bPriority = gamePriority.indexOf(b.category);

 if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
 if (aPriority !== -1) return -1;
 if (bPriority !== -1) return 1;
 return 0;
 });

 // Pagination Logic
 const page = parseInt(req.query.page) || 1;
 const limit = 12;
 const startIndex = (page - 1) * limit;
 const endIndex = page * limit;
 const totalPages = Math.ceil(allProducts.length / limit);
 const products = allProducts.slice(startIndex, endIndex);

 const [dbSliders] = await db.execute('SELECT * FROM sliders ORDER BY created_at DESC');
 const sliders = dbSliders.map(s => ({
 image: s.image_path,
 title: s.title || '',
 description: s.description || '',
 link: s.link || '#'
 }));

 if (sliders.length === 0) {
 sliders.push(
 { image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80', title: 'Ən Yeni Oyunlar', description: 'Bütün rəqəmsal kodlar ən ucuz qiymətə!', link: '#' },
 { image: 'https://images.unsplash.com/photo-1552824236-07779189d995?w=1200&q=80', title: 'PUBG Mobile UC', description: 'Anında çatdırılma və sərfəli paketlər.', link: '#' }
 );
 }

 const [userCountResult] = await db.execute('SELECT COUNT(*) as total FROM users');
 const userCount = Number(userCountResult[0].total || 0);

 const [orderStatsResult] = await db.execute(`
 SELECT
 COUNT(*) as total_orders,
 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_orders
 FROM orders
 `);
 const totalOrders = Number(orderStatsResult[0].total_orders || 0);
 const completedOrders = Number(orderStatsResult[0].completed_orders || 0);

 let deliveryTime = '5-10 dakika';
 try {
 const [updatedAtColumn] = await db.execute(`
 SELECT COUNT(*) as cnt
 FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_SCHEMA = DATABASE()
 AND TABLE_NAME = 'orders'
 AND COLUMN_NAME = 'updated_at'
 `);

 if (Number(updatedAtColumn[0].cnt || 0) > 0) {
 const [avgDeliveryResult] = await db.execute(`
 SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) as avg_seconds
 FROM orders
 WHERE status = 'completed'
 AND updated_at IS NOT NULL
 AND updated_at >= created_at
 `);

 const avgSeconds = Number(avgDeliveryResult[0].avg_seconds || 0);
 if (avgSeconds > 0) {
 if (avgSeconds < 60) {
 deliveryTime = `${Math.round(avgSeconds)} Saniyə`;
 } else if (avgSeconds < 3600) {
 deliveryTime = `${Math.round(avgSeconds / 60)} Dəqiqə`;
 } else {
 deliveryTime = `${Math.round(avgSeconds / 3600)} Saat`;
 }
 }
 }
 } catch (statsErr) {
 console.error('Stats deliveryTime error:', statsErr.message);
 }

 const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) : 0;
 const rating = totalOrders > 0 ? `${(3 + (completionRate * 2)).toFixed(1)}/5` : '0.0/5';

 // Statistics data (real backend data)
 const siteStats = {
 users: userCount,
 products: saleProductCount,
 deliveryTime,
 rating
 };

 res.render('index', {
 title: 'Ana Səhifə',
 categories,
 sliders,
 quickActions: categories, // Using dynamic categories here
 featuredProducts: products,
 homeSections: sectionsWithProducts, // Pass dynamic sections to view
 currentPage: page,
 totalPages,
 selectedCategory,
 searchQuery: searchQuery || '',
 stats: siteStats
 });
 } catch (e) {
 console.error("Home Route Error:", e);
 res.status(500).send("Server Error");
 }
});

app.get(['/all-products', '/allproducts'], async (req, res) => {
 try {
 const [dbCategories] = await db.execute('SELECT * FROM categories');

 const CATEGORY_ICONS = {
 'PUBG ID': 'ri-id-card-line',
 'PUBG UC': 'ri-focus-3-line',
 'Free Fire': 'ri-fire-line',
 'Valorant': 'ri-shield-star-line',
 'Mobile Legends': 'ri-smartphone-line',
 'Steam': 'ri-steam-fill',
 'Google Play': 'ri-google-play-fill',
 'iTunes': 'ri-apple-fill',
 'PlayStation': 'ri-playstation-fill',
 'Xbox': 'ri-xbox-fill',
 'Roblox': 'ri-shapes-line',
 'Razer Gold': 'ri-coins-line'
 };

 const categories = dbCategories.map(c => ({
 id: c.id,
 name: c.name,
 filter: c.name,
 icon: CATEGORY_ICONS[c.name] || c.icon || 'ri-gamepad-line',
 image_path: c.image_path
 }));

 let allProducts = await getMappedProducts();
 const resellerDiscountPercent = await getResellerDiscountPercent();
 allProducts = applyResellerPricing(allProducts, req.session.user, resellerDiscountPercent);
 allProducts = allProducts.filter(p => p.status === 'sale' && p.is_active);

 const selectedCategory = req.query.category;
 if (selectedCategory) {
 allProducts = allProducts.filter(p => p.category === selectedCategory);
 }

 const searchQuery = req.query.search || req.query.q;
 if (searchQuery) {
 allProducts = allProducts.filter(p =>
 p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
 p.description.toLowerCase().includes(searchQuery.toLowerCase())
 );
 }

 const gamePriority = [
 'PUBG ID', 'PUBG UC', 'Free Fire', 'Valorant',
 'Mobile Legends', 'Steam', 'Roblox', 'Razer Gold',
 'PlayStation', 'Xbox', 'Google Play', 'iTunes'
 ];

 allProducts.sort((a, b) => {
 const aPriority = gamePriority.indexOf(a.category);
 const bPriority = gamePriority.indexOf(b.category);

 if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
 if (aPriority !== -1) return -1;
 if (bPriority !== -1) return 1;
 return 0;
 });

 const page = parseInt(req.query.page) || 1;
 const limit = 20;
 const startIndex = (page - 1) * limit;
 const totalPages = Math.ceil(allProducts.length / limit);
 const products = allProducts.slice(startIndex, startIndex + limit);

 res.render('allproducts', {
 title: 'Bütün Məhsullar',
 categories,
 featuredProducts: products,
 currentPage: page,
 totalPages,
 selectedCategory: selectedCategory || '',
 searchQuery: searchQuery || '',
 totalItems: allProducts.length
 });
 } catch (e) {
 console.error('All Products Route Error:', e);
 res.status(500).send('Server Error');
 }
});

app.get('/faq', (req, res) => {
 res.render('faq', { title: 'Tez-tez Verilən Suallar (FAQ)' });
});

app.get('/terms', (req, res) => {
 res.render('terms', { title: 'İstifadə Şərtləri və Qaydalar' });
});

app.get('/api/pubg-check', async (req, res) => {
 const playerIdRaw = normalizeOptionalString(req.query.player_id);
 if (!playerIdRaw) return res.json({ success: false, error: 'ID daxil edin.' });
 const playerId = String(playerIdRaw);

 try {
 const response = await axios.get(`${PUBG_CHECKER_CONFIG.BASE_URL}/check-player`, {
 params: { id: playerId },
 timeout: PUBG_CHECKER_CONFIG.TIMEOUT
 });

 if (response.data && response.data.success) {
 res.json({ success: true, nickname: response.data.player_name });
 } else {
 res.json({ success: false, error: 'Oyunçu tapılmadı.' });
 }
 } catch (e) {
 console.error('PUBG Checker Error:', e.message);
 res.json({ success: false, error: 'PUBG checker servisi ilə bağlantı xətası baş verdi.' });
 }
});

app.get('/product/:id', async (req, res) => {
 let products = await getMappedProducts();
 const resellerDiscountPercent = await getResellerDiscountPercent();
 products = applyResellerPricing(products, req.session.user, resellerDiscountPercent);
 const product = products.find(p => p.id == req.params.id);
 if (!product || product.status !== 'sale' || !product.is_active) {
 req.session.error = 'Məhsul tapılmadı.';
 return res.redirect('/');
 }
 const similarProducts = products
 .filter(p => p.category === product.category && p.id != product.id && p.status === 'sale' && p.is_active)
 .slice(0, 4);
 res.render('product', { title: product.name, product, similarProducts });
});

// --- Auth Routes ---

app.get('/register', (req, res) => res.render('register', { title: 'Qeydiyyat' }));

app.post('/register/send-otp', async (req, res) => {
 const { phone } = req.body;
 if (!phone) return res.json({ success: false, error: 'Telefon nömrəsi lazımdır.' });

 const otp = Math.floor(100000 + Math.random() * 900000).toString();
 const expiry = new Date(Date.now() + 10 * 60000); // 10 mins for registration

 // Check if phone or email already exists
 const [existing] = await db.execute('SELECT * FROM users WHERE phone = ?', [phone]);
 if (existing.length) return res.json({ success: false, error: 'Bu nömrə artıq qeydiyyatdan keçib.' });

 // Store temporary OTP in session or a temp table. Session is easiest for registration.
 req.session.reg_otp = otp;
 req.session.reg_phone = phone;
 req.session.reg_expiry = expiry;

 const sent = await sendSMS(phone, `AZPINX Qeydiyyat Kodunuz: ${otp}`);
 if (sent) res.json({ success: true });
 else res.json({ success: false, error: 'Kod göndərilərkən xəta baş verdi.' });
});

app.post('/register', async (req, res) => {
 const { full_name, email, password, phone, otp } = req.body;

 // Verify OTP
 if (!req.session.reg_otp || req.session.reg_otp !== otp || new Date(req.session.reg_expiry) < new Date() || req.session.reg_phone !== phone) {
 return res.render('register', { title: 'Qeydiyyat', error: 'Yanlış və ya vaxtı keçmiş təsdiq kodu.' });
 }

 const hashed = await bcrypt.hash(password, 10);
 try {
 const [usersCount] = await db.execute('SELECT count(*) as count FROM users');
 const role = usersCount[0].count === 0 ? 'admin' : 'user';

 await db.execute('INSERT INTO users (full_name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)',
 [full_name, email, hashed, role, phone]);

 // Clear registration session
 delete req.session.reg_otp;
 delete req.session.reg_phone;
 delete req.session.reg_expiry;

 req.session.success = 'Uğurla qeydiyyatdan keçdiniz! İndi giriş edin.';
 res.redirect('/login');
 } catch (e) {
 res.render('register', { title: 'Qeydiyyat', error: 'Xəta: Bu email artıq istifadə olunub.' });
 }
});

app.get('/login', (req, res) => res.render('login', { title: 'Daxil ol' }));
app.post('/login', async (req, res) => {
 const { email, password } = req.body;
 const [users] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
 if (users.length && await bcrypt.compare(password, users[0].password)) {
 const user = users[0];

 if (user.two_factor_enabled && user.phone) {
 const otp = Math.floor(100000 + Math.random() * 900000).toString();
 const expiry = new Date(Date.now() + 5 * 60000); // 5 mins

 await db.execute('UPDATE users SET otp_code = ?, otp_expiry = ? WHERE id = ?', [otp, expiry, user.id]);
 const sent = await sendSMS(user.phone, `AZPINX Giriş Kodunuz: ${otp}`);

 if (sent) {
 req.session.temp_user_id = user.id;
 return res.render('otp_verify', { title: 'OTP Doğrulama', phone: user.phone });
 } else {
 return res.render('login', { title: 'Daxil ol', error: 'OTP göndərilərkən xəta baş verdi. Zəhmət olmasa bir az sonra yenidən cəhd edin.' });
 }
 }

 req.session.user = user;
 req.session.success = `Xoş gəldin, ${user.full_name}!`;
 if (user.role === 'admin') res.redirect('/admin');
 else if (user.role === 'reseller') res.redirect('/reseller');
 else res.redirect('/');
 } else {
 res.render('login', { title: 'Daxil ol', error: 'Yanlış email və ya şifrə.' });
 }
});

app.post('/verify-otp', async (req, res) => {
 const { otp } = req.body;
 const userId = req.session.temp_user_id;
 if (!userId) return res.redirect('/login');

 const [users] = await db.execute('SELECT * FROM users WHERE id = ?', [userId]);
 const user = users[0];

 if (user.otp_code === otp && new Date(user.otp_expiry) > new Date()) {
 await db.execute('UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE id = ?', [userId]);
 delete req.session.temp_user_id;
 req.session.user = user;
 req.session.success = `Xoş gəldin, ${user.full_name}!`;
 if (user.role === 'admin') res.redirect('/admin');
 else if (user.role === 'reseller') res.redirect('/reseller');
 else res.redirect('/');
 } else {
 res.render('otp_verify', { title: 'OTP Doğrulama', phone: user.phone, error: 'Yanlış və ya vaxtı keçmiş OTP kodu.' });
 }
});

app.get('/logout', (req, res) => {
 req.session.destroy();
 res.redirect('/');
});

// --- Checkout & User Dashboard ---

app.get('/cart', (req, res) => {
 res.render('cart', { title: 'Səbət' });
});

app.get('/checkout', (req, res) => {
 if (!req.session.user) {
 req.session.error = 'Ödəniş etmək üçün daxil olmalısınız.';
 return res.redirect('/login');
 }
 res.render('checkout', { title: 'Ödəniş' });
});

app.post('/process-order', uploadReceipt.single('receipt'), async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false });

 try {
 if (!req.body.cart) throw new Error("Səbət boşdur.");
 const cartRaw = typeof req.body.cart === 'string' ? JSON.parse(req.body.cart) : req.body.cart;
 if (!Array.isArray(cartRaw) || cartRaw.length === 0) throw new Error("Səbət boşdur.");
 const payment_method = req.body.payment_method || 'C2C Card Transfer';
 const sender_name = req.body.sender_name || (payment_method === 'Balance' ? req.session.user.full_name : '');
 const receipt_path = req.file ? '/uploads/receipts/' + req.file.filename : null;

 let productCatalog = await getMappedProducts();
 const resellerDiscountPercent = await getResellerDiscountPercent();
 productCatalog = applyResellerPricing(productCatalog, req.session.user, resellerDiscountPercent)
 .filter(p => p.status === 'sale' && p.is_active);

 const cart = cartRaw.map((item) => {
 const matched = productCatalog.find(p => String(p.id) === String(item.id));
 if (!matched) {
 throw new Error(`Məhsul tapılmadı və ya satışda deyil: ${item.id}`);
 }
 return {
 id: item.id,
 name: matched.name,
 price: Number(matched.price || 0),
 player_id: normalizeOptionalString(item.player_id),
 player_nickname: normalizeOptionalString(item.player_nickname)
 };
 });

 let totalAmount = 0;
 cart.forEach(item => totalAmount += Number(item.price || 0));
 totalAmount = Number(totalAmount.toFixed(2));

 if (payment_method === 'Balance') {
 const [users] = await db.execute('SELECT balance FROM users WHERE id = ?', [req.session.user.id]);
 if (users[0].balance < totalAmount) {
 return res.status(400).json({ success: false, error: 'Kifayət qədər balansınız yoxdur.' });
 }
 // Deduct balance
 await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [totalAmount, req.session.user.id]);
 }

 for (const item of cart) {
 await db.execute('INSERT INTO orders (user_id, product_name, amount, sender_name, receipt_path, status, payment_method, player_id, player_nickname) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
 [req.session.user.id, item.name, item.price, sender_name, receipt_path, payment_method === 'Balance' ? 'completed' : 'pending', payment_method, item.player_id || null, item.player_nickname || null]);
 }

 // Send Notifications
 const productList = cart.map(i => i.name).join(', ');
 const timeNow = new Date().toLocaleString('az-AZ', { hour: '2-digit', minute: '2-digit' });

 // Notify Buyer
 if (req.session.user.phone) {
 const buyerMsg = `AZPINX: Yeni sifariş! ${productList}. Ümumi: ${totalAmount} AZN.`;
 sendSMS(req.session.user.phone, buyerMsg);
 }

 // Notify Admins
 const adminMsg = `AZPINX: Yeni Sifariş!\nİstifadəçi: ${req.session.user.full_name}\nNömrə: ${req.session.user.phone || 'Yoxdur'}\nMəhsul: ${productList}\nMəbləğ: ${totalAmount} AZN\nSaat: ${timeNow}`;

 const [admins] = await db.execute('SELECT phone FROM users WHERE role ="admin" AND phone IS NOT NULL');
 admins.forEach(admin => {
 sendSMS(admin.phone, adminMsg);
 });

 res.json({ success: true });
 } catch (e) {
 console.error("Process Order Error:", e.message);
 res.status(500).json({ success: false, error: e.message });
 }
});

// --- Wishlist Routes ---
app.get('/wishlist', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [wishlistItems] = await db.execute(`
 SELECT p.* FROM products p  JOIN wishlist w ON p.id = w.product_id  WHERE w.user_id = ?`, [req.session.user.id]);
 const resellerDiscountPercent = await getResellerDiscountPercent();
 const pricedWishlist = applyResellerPricing(wishlistItems, req.session.user, resellerDiscountPercent);
 res.render('wishlist', { title: 'İstək Listəm', wishlist: pricedWishlist });
});

app.post('/wishlist/toggle', async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false, error: 'Login olun' });
 const { product_id } = req.body;
 try {
 const [existing] = await db.execute('SELECT * FROM wishlist WHERE user_id = ? AND product_id = ?', [req.session.user.id, product_id]);
 if (existing.length > 0) {
 await db.execute('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.session.user.id, product_id]);
 res.json({ success: true, action: 'removed' });
 } else {
 await db.execute('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)', [req.session.user.id, product_id]);
 res.json({ success: true, action: 'added' });
 }
 } catch (e) {
 res.status(500).json({ success: false, error: e.message });
 }
});

app.get('/profile', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [orders] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
 const [userData] = await db.execute('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
 res.render('profile', { title: 'Profilim', orders, user: userData[0] });
});

app.post('/profile/update-2fa', async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false });
 const { phone, two_factor_enabled } = req.body;

 try {
 await db.execute('UPDATE users SET phone = ?, two_factor_enabled = ? WHERE id = ?',
 [phone, two_factor_enabled === 'on' ? 1 : 0, req.session.user.id]);

 req.session.success = '2FA ayarları yeniləndi.';
 res.redirect('/profile');
 } catch (e) {
 req.session.error = 'Xəta: ' + e.message;
 res.redirect('/profile');
 }
});

// --- Ticket System Routes ---

app.get('/tickets', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [tickets] = await db.execute('SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC', [req.session.user.id]);
 const [orders] = await db.execute('SELECT id, product_name, created_at FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
 res.render('tickets', { title: 'Dəstək Biletləri', tickets, orders });
});

app.post('/tickets/create', async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false });
 const { subject, order_id } = req.body;

 try {
 const [result] = await db.execute('INSERT INTO tickets (user_id, order_id, subject) VALUES (?, ?, ?)',
 [req.session.user.id, order_id || null, subject]);

 const ticketId = result.insertId;

 // Notify Admins
 const [admins] = await db.execute('SELECT phone FROM users WHERE role ="admin" AND phone IS NOT NULL');
 const notifyMsg = `AZPINX: Yeni Dəstək Bileti!\nİstifadəçi: ${req.session.user.full_name}\nMövzu: ${subject}`;
 admins.forEach(admin => sendSMS(admin.phone, notifyMsg));

 res.json({ success: true, ticketId });
 } catch (e) {
 res.status(500).json({ success: false, error: e.message });
 }
});

app.get('/ticket/:id', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [tickets] = await db.execute('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [req.params.id, req.session.user.id]);
 if (!tickets.length) return res.redirect('/tickets');

 const [messages] = await db.execute('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
 res.render('ticket_detail', { title: 'Ticket: ' + tickets[0].subject, ticket: tickets[0], messages });
});

app.post('/ticket/:id/message', async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false });
 const { message } = req.body;
 const ticketId = req.params.id;

 try {
 const [tickets] = await db.execute('SELECT * FROM tickets WHERE id = ? AND user_id = ?', [ticketId, req.session.user.id]);
 if (!tickets.length || tickets[0].status === 'closed') throw new Error("Ticket bağlıdır və ya tapılmadı.");

 await db.execute('INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin) VALUES (?, ?, ?, 0)',
 [ticketId, req.session.user.id, message]);

 await db.execute('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

 // Notify Admins
 const [admins] = await db.execute('SELECT phone FROM users WHERE role ="admin" AND phone IS NOT NULL');
 const notifyMsg = `AZPINX: Yeni Ticket Mesajı!\nİstifadəçi: ${req.session.user.full_name}\nBilet: ${tickets[0].subject}`;
 admins.forEach(admin => sendSMS(admin.phone, notifyMsg));

 res.json({ success: true });
 } catch (e) {
 res.status(500).json({ success: false, error: e.message });
 }
});

// --- Reseller Panel Routes ---
app.get('/reseller', isReseller, async (req, res) => {
 try {
 const resellerId = req.session.user.id;
 const discountPercent = await getResellerDiscountPercent();

 let products = await getMappedProducts();
 products = applyResellerPricing(products, req.session.user, discountPercent)
 .filter(p => p.status === 'sale' && p.is_active)
 .slice(0, 8);

 const [orders] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 8', [resellerId]);
 const [ticketRows] = await db.execute('SELECT status, COUNT(*) as total FROM tickets WHERE user_id = ? GROUP BY status', [resellerId]);

 const totalOrders = orders.length;
 const completedOrders = orders.filter(o => o.status === 'completed').length;
 const pendingOrders = orders.filter(o => o.status === 'pending').length;
 const totalRevenue = orders.reduce((sum, o) => sum + Number(o.amount || 0), 0);

 const ticketStats = { open: 0, closed: 0 };
 ticketRows.forEach((row) => { ticketStats[row.status] = Number(row.total || 0); });

 res.render('reseller/dashboard', {
 title: 'Bayi Paneli',
 discountPercent,
 products,
 orders,
 stats: {
 totalOrders,
 completedOrders,
 pendingOrders,
 totalRevenue: Number(totalRevenue.toFixed(2)),
 openTickets: ticketStats.open || 0,
 closedTickets: ticketStats.closed || 0
 }
 });
 } catch (e) {
 console.error('Reseller dashboard error:', e);
 res.redirect('/?error=' + encodeURIComponent(e.message));
 }
});

app.get('/reseller/products', isReseller, async (req, res) => {
 try {
 const discountPercent = await getResellerDiscountPercent();
 const q = normalizeOptionalString(req.query.q) || '';
 const category = normalizeOptionalString(req.query.category) || '';
 const page = Math.max(1, parseInt(req.query.page, 10) || 1);
 const perPage = 24;

 let products = await getMappedProducts();
 products = applyResellerPricing(products, req.session.user, discountPercent)
 .filter(p => p.status === 'sale' && p.is_active);

 if (q) {
 const qLower = q.toLowerCase();
 products = products.filter((p) =>
 String(p.name || '').toLowerCase().includes(qLower) ||
 String(p.category || '').toLowerCase().includes(qLower) ||
 String(p.description || '').toLowerCase().includes(qLower)
 );
 }
 if (category) {
 products = products.filter(p => String(p.category || '') === category);
 }

 const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
 const totalItems = products.length;
 const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
 const currentPage = Math.min(page, totalPages);
 const start = (currentPage - 1) * perPage;
 const pagedProducts = products.slice(start, start + perPage);

 res.render('reseller/products', {
 title: 'Bayi Məhsul Siyahısı',
 discountPercent,
 products: pagedProducts,
 categories,
 filters: { q, category, page: currentPage, totalPages, totalItems }
 });
 } catch (e) {
 console.error('Reseller products error:', e);
 res.redirect('/reseller?error=' + encodeURIComponent(e.message));
 }
});

app.get('/reseller/orders', isReseller, async (req, res) => {
 try {
 const [orders] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
 res.render('reseller/orders', { title: 'Bayi Sifarişləri', orders });
 } catch (e) {
 console.error('Reseller orders error:', e);
 res.redirect('/reseller?error=' + encodeURIComponent(e.message));
 }
});

// --- Admin Panel Routes ---

app.get('/admin/tickets', isAdmin, async (req, res) => {
 const q = normalizeOptionalString(req.query.q) || '';
 const status = normalizeOptionalString(req.query.status) || 'all';
 const page = Math.max(1, parseInt(req.query.page, 10) || 1);
 const perPage = 20;

 const [rows] = await db.execute(`
 SELECT t.*, u.full_name as user_name
 FROM tickets t
 JOIN users u ON t.user_id = u.id
 ORDER BY t.status ASC, t.updated_at DESC
 `);

 let tickets = rows;

 if (q) {
 const query = q.toLowerCase();
 tickets = tickets.filter((t) =>
 String(t.id).includes(query) ||
 String(t.user_name || '').toLowerCase().includes(query) ||
 String(t.subject || '').toLowerCase().includes(query) ||
 String(t.order_id || '').toLowerCase().includes(query)
 );
 }

 if (status === 'open' || status === 'closed') {
 tickets = tickets.filter(t => t.status === status);
 }

 const totalItems = tickets.length;
 const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
 const currentPage = Math.min(page, totalPages);
 const startIndex = (currentPage - 1) * perPage;
 const paginatedTickets = tickets.slice(startIndex, startIndex + perPage);

 const params = new URLSearchParams();
 if (q) params.set('q', q);
 if (status !== 'all') params.set('status', status);
 const baseQuery = params.toString();

 res.render('admin/tickets', {
 title: 'Dəstək İdarəetməsi',
 tickets: paginatedTickets,
 filters: { q, status },
 pagination: { currentPage, totalPages, totalItems, baseQuery }
 });
});

app.get('/admin/ticket/:id', isAdmin, async (req, res) => {
 const [tickets] = await db.execute(`
 SELECT t.*, u.full_name as user_name, u.phone as user_phone  FROM tickets t  JOIN users u ON t.user_id = u.id  WHERE t.id = ?
 `, [req.params.id]);

 if (!tickets.length) return res.redirect('/admin/tickets');

 const [messages] = await db.execute('SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id]);
 res.render('admin/ticket_detail', { title: 'Ticket: ' + tickets[0].subject, ticket: tickets[0], messages });
});

app.post('/admin/ticket/:id/reply', isAdmin, async (req, res) => {
 const { message } = req.body;
 const ticketId = req.params.id;
 console.log(`Admin reply to ticket ${ticketId}: ${message}`);

 try {
 const [result] = await db.execute('INSERT INTO ticket_messages (ticket_id, sender_id, message, is_admin) VALUES (?, ?, ?, 1)',
 [ticketId, req.session.user.id, message]);

 await db.execute('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);

 // Notify User via WhatsApp if they have a phone
 const [ticketData] = await db.execute(`
 SELECT t.subject, u.phone  FROM tickets t  JOIN users u ON t.user_id = u.id  WHERE t.id = ?
 `, [ticketId]);

 if (ticketData && ticketData.length > 0 && ticketData[0].phone) {
 console.log(`Sending SMS notification to ${ticketData[0].phone}`);
 sendSMS(ticketData[0].phone, `AZPINX: Dəstək biletinizə cavab verildi!\nMövzu: ${ticketData[0].subject}\nMətn: ${message}`);
 }

 res.json({ success: true });
 } catch (e) {
 console.error("Admin Reply Error:", e.message);
 res.status(500).json({ success: false, error: e.message });
 }
});

app.post('/admin/ticket/:id/close', isAdmin, async (req, res) => {
 const ticketId = req.params.id;
 try {
 await db.execute('UPDATE tickets SET status ="closed" WHERE id = ?', [ticketId]);
 res.json({ success: true });
 } catch (e) {
 res.status(500).json({ success: false, error: e.message });
 }
});

app.get('/admin', isAdmin, async (req, res) => {
 const [orders] = await db.execute('SELECT count(*) as count FROM orders');
 const [pending] = await db.execute("SELECT count(*) as count FROM orders WHERE status = 'pending'");
 const [users] = await db.execute('SELECT count(*) as count FROM users');
 res.render('admin/dashboard', {
 title: 'Dashboard',
 stats: { totalOrders: orders[0].count, pendingOrders: pending[0].count, totalUsers: users[0].count }
 });
});

app.get('/admin/orders', isAdmin, async (req, res) => {
 const [orders] = await db.execute(`
 SELECT orders.*, users.email
 FROM orders
 JOIN users ON orders.user_id = users.id
 ORDER BY created_at DESC
 `);
 res.render('admin/orders', { title: 'Sifariş İdarəetməsi', orders });
});

app.post('/admin/orders/:id/update', isAdmin, async (req, res) => {
 const { status } = req.body;
 await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
 req.session.success ="Sifariş statusu yeniləndi.";
 res.redirect('/admin/orders');
});

app.get('/admin/users', isAdmin, async (req, res) => {
 const [users] = await db.execute('SELECT * FROM users ORDER BY created_at DESC');
 res.render('admin/users', { title: 'İstifadəçi İdarəetməsi', users });
});

app.post('/admin/users/create', isAdmin, async (req, res) => {
 const { full_name, email, password, role } = req.body;
 const hashed = await bcrypt.hash(password, 10);
 try {
 await db.execute('INSERT INTO users (full_name, email, password, role) VALUES (?, ?, ?, ?)', [full_name, email, hashed, role]);
 req.session.success = 'İstifadəçi uğurla yaradıldı.';
 } catch (e) {
 req.session.error = 'Xəta: Bu email artıq mövcuddur.';
 }
 res.redirect('/admin/users');
});

app.post('/admin/users/delete', isAdmin, async (req, res) => {
 const { user_id } = req.body;
 // Prevent deleting self
 if (parseInt(user_id) === req.session.user.id) {
 req.session.error = 'Öz hesabınızı silə bilməzsiniz.';
 } else {
 await db.execute('DELETE FROM users WHERE id = ?', [user_id]);
 req.session.success = 'İstifadəçi silindi.';
 }
 res.redirect('/admin/users');
});

// Admin Categories (List)
app.get('/admin/categories', isAdmin, async (req, res) => {
 const [categories] = await db.execute('SELECT * FROM categories ORDER BY created_at DESC');
 res.render('admin/categories', { title: 'Kateqoriya İdarəetməsi', categories });
});

// Admin Category Create
app.post('/admin/categories/create', isAdmin, (req, res, next) => {
 uploadCategory.single('image')(req, res, (err) => {
 if (err instanceof multer.MulterError) {
 console.error('Multer Error during category upload:', err);
 return res.redirect('/admin/categories?error=Yükləmə xətası (Multer): ' + err.message);
 } else if (err) {
 console.error('Unknown Error during category upload:', err);
 return res.redirect('/admin/categories?error=Bilinməyən xəta: ' + err.message);
 }
 next();
 });
}, async (req, res) => {
 const { name, description } = req.body;
 try {
 const image_path = req.file ? '/uploads/categories/' + req.file.filename : null;
 await db.execute('INSERT INTO categories (name, description, image_path) VALUES (?, ?, ?)', [name, description, image_path]);
 res.redirect('/admin/categories?success=Kateqoriya yaradıldı');
 } catch (e) {
 console.error('Database Error during category creation:', e);
 res.redirect('/admin/categories?error=' + encodeURIComponent(e.message));
 }
});

// Admin Category Edit Page
app.get('/admin/categories/:id/edit', isAdmin, async (req, res) => {
 const [categories] = await db.execute('SELECT * FROM categories WHERE id = ?', [req.params.id]);
 if (!categories.length) return res.redirect('/admin/categories');
 res.render('admin/category_edit', { title: 'Kateqoriya Redaktə', category: categories[0] });
});

// Admin Category Update
app.post('/admin/categories/update', isAdmin, uploadCategory.single('image'), async (req, res) => {
 const { category_id, name, icon, description } = req.body;
 const image_path = req.file ? '/uploads/categories/' + req.file.filename : null;

 try {
 let query = 'UPDATE categories SET name=?, icon=?, description=?';
 let params = [name, icon, description];

 if (image_path) {
 query += ', image_path=?';
 params.push(image_path);
 }

 query += ' WHERE id=?';
 params.push(category_id);

 await db.execute(query, params);
 res.redirect('/admin/categories?success=Kateqoriya yeniləndi');
 } catch (e) {
 res.redirect('/admin/categories?error=' + encodeURIComponent(e.message));
 }
});

// Admin Category Delete
app.post('/admin/categories/delete', isAdmin, async (req, res) => {
 const { category_id } = req.body;
 try {
 await db.execute('DELETE FROM categories WHERE id = ?', [category_id]);
 res.redirect('/admin/categories?success=Kateqoriya silindi');
 } catch (e) {
 res.redirect('/admin/categories?error=' + encodeURIComponent(e.message));
 }
});

// Admin Sliders (List)
app.get('/admin/sliders', isAdmin, async (req, res) => {
 const [sliders] = await db.execute('SELECT * FROM sliders ORDER BY created_at DESC');
 res.render('admin/sliders', { title: 'Slayder (Banner) İdarəetməsi', sliders });
});

// Admin Slider Create
app.post('/admin/sliders/create', isAdmin, (req, res, next) => {
 uploadSlider.single('image')(req, res, (err) => {
 if (err instanceof multer.MulterError) {
 console.error('Multer Error during slider upload:', err);
 return res.redirect('/admin/sliders?error=Yükləmə xətası (Multer): ' + err.message);
 } else if (err) {
 console.error('Unknown Error during slider upload:', err);
 return res.redirect('/admin/sliders?error=Bilinməyən xəta: ' + err.message);
 }
 next();
 });
}, async (req, res) => {
 try {
 const { title, description, link } = req.body;
 console.log('Slider Create Request Body:', { title, description, link });
 console.log('Uploaded File Information:', req.file);

 if (!req.file) {
 console.warn('Slider upload attempt without file.');
 return res.redirect('/admin/sliders?error=Şəkil seçilməyib və ya yüklənmədi');
 }

 const image_path = '/uploads/sliders/' + req.file.filename;
 console.log('Storing slider with image_path:', image_path);

 await db.execute('INSERT INTO sliders (image_path, title, description, link) VALUES (?, ?, ?, ?)',
 [image_path, title || '', description || '', link || '#']);

 console.log('Slider successfully inserted into database.');
 res.redirect('/admin/sliders?success=Slayder əlavə edildi');
 } catch (e) {
 console.error('Database Error during slider creation:', e);
 res.redirect('/admin/sliders?error=Bazaya yazılma xətası: ' + encodeURIComponent(e.message));
 }
});

// Admin Slider Delete
app.post('/admin/sliders/delete', isAdmin, async (req, res) => {
 const { id } = req.body;
 try {
 await db.execute('DELETE FROM sliders WHERE id = ?', [id]);
 res.redirect('/admin/sliders?success=Slayder silindi');
 } catch (e) {
 res.redirect('/admin/sliders?error=' + encodeURIComponent(e.message));
 }
});

// Admin Home Sections (List)
app.get('/admin/home-sections', isAdmin, async (req, res) => {
 try {
 const [sections] = await db.execute(`
 SELECT hs.*, c.name as category_name  FROM home_sections hs  LEFT JOIN categories c ON hs.category_id = c.id  ORDER BY hs.order_index ASC
 `);
 const [categories] = await db.execute('SELECT * FROM categories');
 res.render('admin/home_sections', { title: 'Ana Səhifə Bölmələri', sections, categories });
 } catch (e) {
 res.redirect('/admin?error=' + encodeURIComponent(e.message));
 }
});

// Admin Bank Settings
app.get('/admin/settings', isAdmin, async (req, res) => {
 const [settings] = await db.execute('SELECT * FROM settings');
 const settingsMap = {};
 settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);
 res.render('admin/settings', { title: 'Banka Məlumatları', settings: settingsMap });
});

app.post('/admin/settings', isAdmin, async (req, res) => {
 const { bank_card, bank_name, bank_holder, reseller_discount_percent } = req.body;
 try {
 const updates = [
 { key: 'bank_card', value: bank_card },
 { key: 'bank_name', value: bank_name },
 { key: 'bank_holder', value: bank_holder },
 { key: 'reseller_discount_percent', value: String(clampPercent(reseller_discount_percent, 0, 90)) }
 ];

 for (const s of updates) {
 await db.execute('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [s.value, s.key]);
 }
 res.redirect('/admin/settings?success=Məlumatlar yeniləndi');
 } catch (e) {
 res.redirect('/admin/settings?error=' + encodeURIComponent(e.message));
 }
});

// Admin Home Section Create
app.post('/admin/home-sections/create', isAdmin, async (req, res) => {
 const { title, category_id, order_index } = req.body;
 try {
 await db.execute('INSERT INTO home_sections (title, category_id, order_index) VALUES (?, ?, ?)',
 [title, category_id || null, order_index || 0]);
 res.redirect('/admin/home-sections?success=Bölmə yaradıldı');
 } catch (e) {
 res.redirect('/admin/home-sections?error=' + encodeURIComponent(e.message));
 }
});

// Admin Home Section Delete
app.post('/admin/home-sections/delete', isAdmin, async (req, res) => {
 const { id } = req.body;
 try {
 await db.execute('DELETE FROM home_sections WHERE id = ?', [id]);
 res.redirect('/admin/home-sections?success=Bölmə silindi');
 } catch (e) {
 res.redirect('/admin/home-sections?error=' + encodeURIComponent(e.message));
 }
});

// Admin Product Add Page
app.get('/admin/products/add', isAdmin, async (req, res) => {
 const [categories] = await db.execute('SELECT * FROM categories');
 res.render('admin/product_add', { title: 'Yeni Məhsul', categories });
});

// Admin Product Add
app.post('/admin/products/add', isAdmin, (req, res, next) => {
 uploadProduct.single('image')(req, res, (err) => {
 if (err instanceof multer.MulterError) {
 console.error('Multer Error during product add:', err);
 return res.redirect('/admin/products?error=Yükləmə xətası (Multer): ' + err.message);
 } else if (err) {
 console.error('Unknown Error during product add:', err);
 return res.redirect('/admin/products?error=Bilinməyən xəta: ' + err.message);
 }
 next();
 });
}, async (req, res) => {
 const { name, category, price, description, api_id, status } = req.body;
 try {
	 const image_path = req.file ? '/uploads/products/' + req.file.filename : null;
	 const normalizedApiId = normalizeOptionalString(api_id);
	 const params = [
	 normalizeOptionalString(name),
	 normalizeOptionalString(category),
	 price ?? null,
	 normalizeOptionalString(description),
	 image_path ?? null,
	 status ?? 'sale',
	 normalizedApiId
	 ];
	 await db.execute(
	 'INSERT INTO products (name, category, price, description, image_path, status, api_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
	 params
 );
 res.redirect('/admin/products?success=Məhsul əlavə edildi');
 } catch (e) {
 console.error('Database Error during product creation:', e);
 res.redirect('/admin/products?error=' + encodeURIComponent(e.message));
 }
});

// Admin Products (List)
app.get('/admin/products', isAdmin, async (req, res) => {
 const q = normalizeOptionalString(req.query.q) || '';
 const status = normalizeOptionalString(req.query.status) || 'all';
 const active = normalizeOptionalString(req.query.active) || 'all';
 const source = normalizeOptionalString(req.query.source) || 'all';
 const page = Math.max(1, parseInt(req.query.page, 10) || 1);
 const perPage = 20;

 let products = await getMappedProducts();

 if (q) {
 const query = q.toLowerCase();
 products = products.filter((p) =>
 String(p.name || '').toLowerCase().includes(query) ||
 String(p.category || '').toLowerCase().includes(query) ||
 String(p.description || '').toLowerCase().includes(query) ||
 String(p.api_id || '').toLowerCase().includes(query)
 );
 }

 if (status === 'sale' || status === 'draft') {
 products = products.filter(p => p.status === status);
 }

 if (active === 'active') {
 products = products.filter(p => p.is_active);
 } else if (active === 'inactive') {
 products = products.filter(p => !p.is_active);
 }

 if (source === 'api') {
 products = products.filter(p => p.api_id && !p.is_local);
 } else if (source === 'api_local') {
 products = products.filter(p => p.api_id && p.is_local);
 } else if (source === 'local') {
 products = products.filter(p => !p.api_id);
 }

 const totalItems = products.length;
 const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
 const currentPage = Math.min(page, totalPages);
 const startIndex = (currentPage - 1) * perPage;
 const paginatedProducts = products.slice(startIndex, startIndex + perPage);

 const params = new URLSearchParams();
 if (q) params.set('q', q);
 if (status !== 'all') params.set('status', status);
 if (active !== 'all') params.set('active', active);
 if (source !== 'all') params.set('source', source);
 const baseQuery = params.toString();

 res.render('admin/products', {
 title: 'Məhsul Kataloqu',
 products: paginatedProducts,
 filters: { q, status, active, source },
 pagination: { currentPage, totalPages, totalItems, perPage, baseQuery }
 });
});

// Admin Product Edit Page
app.get('/admin/products/:id/edit', isAdmin, async (req, res) => {
 const products = await getMappedProducts();
 const product = products.find(p => p.id == req.params.id);
 if (!product) return res.redirect('/admin/products');
 res.render('admin/product_edit', { title: 'Məhsul Redaktə - ' + product.name, product });
});

// Admin Product Update
app.post('/admin/products/update', isAdmin, uploadProduct.single('image'), async (req, res) => {
 const { product_id, api_id, name, category, price, description } = req.body;
 const image_path = req.file ? '/uploads/products/' + req.file.filename : null;
 const normalizedApiId = normalizeOptionalString(api_id);
 const normalizedProductId = normalizeOptionalString(product_id);
 const normalizedName = normalizeOptionalString(name);
 const normalizedCategory = normalizeOptionalString(category);
 const normalizedDescription = normalizeOptionalString(description);

 try {
 // Check if local entry exists
 const [existing] = await db.execute('SELECT id FROM products WHERE api_id = ? OR id = ?', [normalizedApiId, normalizedProductId]);

 if (existing.length > 0) {
 // Update
 let query = 'UPDATE products SET name=?, category=?, price=?, description=?';
 let params = [normalizedName, normalizedCategory, price, normalizedDescription];

 if (image_path) {
 query += ', image_path=?';
 params.push(image_path);
 }

 query += ' WHERE id=?';
 params.push(existing[0].id);

 await db.execute(query, params);
 } else {
 // Create New Local Override or Custom Product
 const query = 'INSERT INTO products (api_id, name, category, price, description, image_path) VALUES (?, ?, ?, ?, ?, ?)';
 const params = [normalizedApiId, normalizedName, normalizedCategory, price, normalizedDescription, image_path];
 await db.execute(query, params);
 }

 res.redirect('/admin/products?success=Məhsul yeniləndi');
 } catch (e) {
 console.error(e);
 res.redirect('/admin/products?error=' + encodeURIComponent(e.message));
 }
});

app.post('/admin/products/:id/toggle-active', isAdmin, async (req, res) => {
 try {
 const productIdentifier = req.params.id;
 const products = await getMappedProducts();
 const product = products.find(p => String(p.id) === String(productIdentifier));
 if (!product) {
 return res.redirect('/admin/products?error=Məhsul tapılmadı');
 }

 const nextActive = product.is_active ? 0 : 1;

 if (product.db_id) {
 await db.execute('UPDATE products SET is_active = ? WHERE id = ?', [nextActive, product.db_id]);
 } else {
 const normalizedApiId = normalizeOptionalString(product.api_id ?? product.id);
 const [existing] = await db.execute('SELECT id FROM products WHERE api_id = ? LIMIT 1', [normalizedApiId]);
 if (existing.length > 0) {
 await db.execute('UPDATE products SET is_active = ? WHERE id = ?', [nextActive, existing[0].id]);
 } else {
 await db.execute(
 'INSERT INTO products (api_id, name, category, price, description, image_path, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
 [
 normalizedApiId,
 normalizeOptionalString(product.name),
 normalizeOptionalString(product.category),
 product.price || 0,
 normalizeOptionalString(product.description),
 normalizeOptionalString(product.image),
 product.status || 'sale',
 nextActive
 ]
 );
 }
 }

 const msg = nextActive ? 'Məhsul aktiv edildi' : 'Məhsul deaktiv edildi';
 return res.redirect('/admin/products?success=' + encodeURIComponent(msg));
 } catch (e) {
 console.error('Product active toggle error:', e);
 return res.redirect('/admin/products?error=' + encodeURIComponent(e.message));
 }
});

// Admin User Balance Update
app.post('/admin/users/balance', isAdmin, async (req, res) => {
 const { user_id, amount, action } = req.body;
 const numericAmount = parseFloat(amount);

 if (isNaN(numericAmount)) {
 return res.redirect('/admin/users?error=Düzgün məbləğ daxil edin');
 }

 try {
 if (action === 'add') {
 await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [numericAmount, user_id]);
 } else if (action === 'subtract') {
 await db.execute('UPDATE users SET balance = balance - ? WHERE id = ?', [numericAmount, user_id]);
 } else {
 await db.execute('UPDATE users SET balance = ? WHERE id = ?', [numericAmount, user_id]);
 }
 res.redirect('/admin/users?success=Bakiye yeniləndi');
 } catch (e) {
 res.redirect('/admin/users?error=' + encodeURIComponent(e.message));
 }
});

// Admin HubMsg (Announcements)
app.get('/admin/hubmsg', isAdmin, async (req, res) => {
 const [messages] = await db.execute('SELECT * FROM announcements ORDER BY created_at DESC');
 res.render('admin/hubmsg', { title: 'HubMsg Bildirişlər', messages });
});

app.post('/admin/hubmsg/create', isAdmin, async (req, res) => {
 const { title, message, type } = req.body;
 await db.execute('INSERT INTO announcements (title, message, type) VALUES (?, ?, ?)', [title, message, type]);
 res.redirect('/admin/hubmsg?success=Bildiriş yaradıldı');
});

app.post('/admin/hubmsg/delete', isAdmin, async (req, res) => {
 const { id } = req.body;
 await db.execute('DELETE FROM announcements WHERE id = ?', [id]);
 res.redirect('/admin/hubmsg?success=Bildiriş silindi');
});

const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => console.log(`AZPINX Server on http://${HOST}:${PORT}`));
