const express = require('express');
const path = require('path');
const axios = require('axios');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// HubMSG API Config
const HUBMSG_CONFIG = {
 API_KEY: process.env.HUBMSG_API_KEY || process.env.HUBMSG_API_TOKEN || 'API-KEY-XXXX',
 URL: process.env.HUBMSG_URL || 'https://hubmsgpanel.octotech.az/api/message',
 TIMEOUT: Number(process.env.HUBMSG_TIMEOUT_MS || 10000)
};

function normalizePhoneNumber(phone) {
 const raw = String(phone || '').trim();
 if (!raw) return '';
 return raw.replace(/[^\d+]/g, '');
}

async function sendSMS(phone, message) {
 const recipient = normalizePhoneNumber(phone);
 if (!recipient) return false;
 try {
 const apiKey = String(HUBMSG_CONFIG.API_KEY || '').trim();
 const payload = { recipient, message: String(message || '') };

 const headerVariants = [];
 if (apiKey) {
 headerVariants.push({ 'Content-Type': 'application/json', 'x-api-key': apiKey });
 headerVariants.push({ 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` });
 headerVariants.push({ 'Content-Type': 'application/json', 'api-key': apiKey });
 headerVariants.push({ 'Content-Type': 'application/json', 'x-api-token': apiKey });
}
 headerVariants.push({ 'Content-Type': 'application/json' });

 let lastError = null;
 for (const headers of headerVariants) {
 try {
 await axios.post(HUBMSG_CONFIG.URL, payload, {
 headers,
 timeout: HUBMSG_CONFIG.TIMEOUT
 });
 return true;
 } catch (e) {
 lastError = e;
 const status = Number(e?.response?.status || 0);
 if (status && status !== 401 && status !== 403) break;
 }
 }

 if (!apiKey) {
 console.error('HubMSG Error: HUBMSG_API_KEY təyin edilməyib.');
} else {
 console.error('HubMSG Error:', lastError?.message || 'Bilinməyən xəta');
 }
 return false;
 } catch (e) {
 console.error('HubMSG Error:', e.message);
 return false;
 }
}

async function sendWhatsApp(phone, message) {
 return sendSMS(phone, message);
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
 URLS: (process.env.PUBG_CHECKER_URLS || process.env.PUBG_CHECKER_URL || 'http://38.180.208.188:5599,http://azpinx-pubg-checker:3000')
 .split(',')
 .map((u) => u.trim().replace(/\/$/, ''))
 .filter(Boolean),
 TIMEOUT: Number(process.env.PUBG_CHECKER_TIMEOUT_MS || 7000),
 CACHE_TTL_MS: Number(process.env.PUBG_CHECKER_CACHE_TTL_MS || 60000)
};
const pubgCheckCache = new Map();
const pubgCheckInflight = new Map();

const LICENSE_CONFIG = {
 CODES_PATH: process.env.LICENSE_CODES_PATH || path.join(__dirname, 'data', 'license_codes.json'),
 KEY_PATH: process.env.LICENSE_KEY_PATH || path.join(__dirname, 'data', 'license_key.txt'),
 KEY: process.env.LICENSE_KEY || '',
 SECRET: process.env.LICENSE_SECRET || '',
 REMOTE_URL: process.env.LICENSE_REMOTE_URL || 'https://raw.githubusercontent.com/aliyabuz25/licenses/main/license_codes.json',
 REMOTE_TIMEOUT_MS: Number(process.env.LICENSE_REMOTE_TIMEOUT_MS || 5000),
 MACHINE_ID: process.env.LICENSE_MACHINE_ID || '',
 ENFORCE: process.env.LICENSE_ENFORCE !== '0'
};

let APP_LICENSE_STATE = { valid: false, reason: 'license_check_pending' };

function normalizeLicenseCode(value) {
 return String(value || '')
 .trim()
 .toUpperCase()
 .replace(/\s+/g, '')
 .replace(/[^A-Z0-9-_]/g, '');
}

function getMachineFingerprint() {
 const raw = LICENSE_CONFIG.MACHINE_ID || `${os.hostname()}|${os.platform()}|${os.arch()}`;
 return crypto.createHash('sha256').update(String(raw)).digest('hex');
}

function hashLicenseCode(code, machineFingerprint, secret = '') {
 const normalizedCode = normalizeLicenseCode(code);
 const seed = `${normalizedCode}|${machineFingerprint}|${String(secret || '').trim()}`;
 return crypto.createHash('sha256').update(seed).digest('hex');
}

function readLicenseKey() {
 const envKey = normalizeLicenseCode(LICENSE_CONFIG.KEY);
 if (envKey) return envKey;
 try {
 if (fs.existsSync(LICENSE_CONFIG.KEY_PATH)) {
 const raw = fs.readFileSync(LICENSE_CONFIG.KEY_PATH, 'utf8');
 return normalizeLicenseCode(raw);
 }
 } catch (e) {
 console.error('License key read error:', e.message);
 }
 return '';
}

async function readLicenseStore() {
 const remoteUrl = String(LICENSE_CONFIG.REMOTE_URL || '').trim();
 if (remoteUrl) {
 try {
 const response = await axios.get(remoteUrl, { timeout: LICENSE_CONFIG.REMOTE_TIMEOUT_MS });
 const data = response?.data;
 if (data && typeof data === 'object') return data;
 if (typeof data === 'string' && data.trim()) {
 const parsed = JSON.parse(data);
 if (parsed && typeof parsed === 'object') return parsed;
 }
 } catch (e) {
 console.error('License remote store read error:', e.message);
 }
 }

 try {
 if (!fs.existsSync(LICENSE_CONFIG.CODES_PATH)) return null;
 const raw = fs.readFileSync(LICENSE_CONFIG.CODES_PATH, 'utf8');
 const parsed = JSON.parse(raw);
 if (!parsed || typeof parsed !== 'object') return null;
 return parsed;
 } catch (e) {
 console.error('License store read error:', e.message);
 return null;
 }
}

async function validateLicense() {
 if (!LICENSE_CONFIG.ENFORCE) return { valid: true, reason: 'disabled' };

 const licenseKey = readLicenseKey();
 if (!licenseKey) return { valid: false, reason: 'license_key_missing' };

 const store = await readLicenseStore();
 if (!store) return { valid: false, reason: 'license_store_missing' };

 const now = Date.now();
 if (store.expires_at) {
 const exp = new Date(store.expires_at).getTime();
 if (Number.isFinite(exp) && now > exp) return { valid: false, reason: 'license_store_expired' };
 }

 const machineFingerprint = getMachineFingerprint();
 const normalizedCodes = Array.isArray(store.codes)
 ? store.codes.map((c) => normalizeLicenseCode(c)).filter(Boolean)
 : [];
 const normalizedHashes = Array.isArray(store.hashes)
 ? store.hashes.map((h) => String(h || '').trim().toLowerCase()).filter(Boolean)
 : [];

 if (normalizedCodes.includes(licenseKey)) return { valid: true, reason: 'code_match' };

 const checkHashes = [
 hashLicenseCode(licenseKey, machineFingerprint, ''),
 hashLicenseCode(licenseKey, machineFingerprint, LICENSE_CONFIG.SECRET)
 ];
 if (checkHashes.some((h) => normalizedHashes.includes(h.toLowerCase()))) {
 return { valid: true, reason: 'hash_match' };
 }

 return { valid: false, reason: 'license_mismatch' };
}

(async () => {
 APP_LICENSE_STATE = await validateLicense();
 if (!APP_LICENSE_STATE.valid) {
 console.error(`License validation failed: ${APP_LICENSE_STATE.reason}`);
 }
})();

const TRANSLATE_CONFIG = {
 URLS: (process.env.TRANSLATE_URLS || 'https://libretranslate.com/translate,https://libretranslate.de/translate')
 .split(',')
 .map((u) => u.trim())
 .filter(Boolean),
 TIMEOUT: Number(process.env.TRANSLATE_TIMEOUT_MS || 9000),
 SUPPORTED: ['az', 'tr', 'ru']
};

const SECURITY_CONFIG = {
 RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000),
 RATE_LIMIT_MAX_AUTH: Number(process.env.RATE_LIMIT_MAX_AUTH || 25),
 RATE_LIMIT_MAX_API: Number(process.env.RATE_LIMIT_MAX_API || 80),
 RATE_LIMIT_MAX_DEFAULT: Number(process.env.RATE_LIMIT_MAX_DEFAULT || 220)
};
const requestGuardStore = new Map();

const REFERRAL_TARGET = 5;
const REFERRAL_REWARD_LABEL = '60 UC';
const VPN_BLOCK_ENABLED = process.env.VPN_BLOCK_ENABLED !== '0';
const VPN_CHECK_TIMEOUT_MS = Number(process.env.VPN_CHECK_TIMEOUT_MS || 3500);
const VPN_CACHE_TTL_MS = Number(process.env.VPN_CACHE_TTL_MS || 10 * 60 * 1000);
const vpnCheckCache = new Map();

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
 referral_code VARCHAR(32) UNIQUE NULL,
 referred_by INT NULL,
 registration_ip VARCHAR(64) NULL,
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
 `CREATE TABLE IF NOT EXISTS balance_topups (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 amount DECIMAL(10, 2) NOT NULL,
 sender_name VARCHAR(100) NOT NULL,
 receipt_path VARCHAR(255) NOT NULL,
 payment_method VARCHAR(50) DEFAULT 'C2C Card Transfer',
 status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
 refund_status ENUM('none', 'pending', 'processed', 'rejected') DEFAULT 'none',
 refund_requested_at DATETIME NULL,
 admin_note TEXT NULL,
 reviewed_by INT NULL,
 reviewed_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS site_access_logs (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NULL,
 visitor_key VARCHAR(255) NOT NULL,
 request_path VARCHAR(255) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS settings (
 id INT AUTO_INCREMENT PRIMARY KEY,
 setting_key VARCHAR(100) UNIQUE NOT NULL,
 setting_value TEXT,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
 )`,
 `CREATE TABLE IF NOT EXISTS referral_reward_requests (
 id INT AUTO_INCREMENT PRIMARY KEY,
 user_id INT NOT NULL,
 required_count INT DEFAULT 5,
 reward_label VARCHAR(100) DEFAULT '60 UC',
 status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
 { table: 'users', column: 'otp_expiry', definition: 'DATETIME NULL AFTER otp_code' },
 { table: 'users', column: 'referral_code', definition: 'VARCHAR(32) UNIQUE NULL AFTER otp_expiry' },
 { table: 'users', column: 'referred_by', definition: 'INT NULL AFTER referral_code' },
 { table: 'users', column: 'registration_ip', definition: 'VARCHAR(64) NULL AFTER referred_by' },
 { table: 'users', column: 'last_seen_at', definition: 'DATETIME NULL AFTER registration_ip' },
 { table: 'balance_topups', column: 'refund_status', definition: "ENUM('none', 'pending', 'processed', 'rejected') DEFAULT 'none' AFTER status" },
 { table: 'balance_topups', column: 'refund_requested_at', definition: 'DATETIME NULL AFTER refund_status' },
 { table: 'wishlist', column: 'product_ref', definition: 'VARCHAR(80) NULL AFTER product_id' }
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

 try {
 await db.execute('CREATE INDEX idx_users_referred_by ON users (referred_by)');
 } catch (idxErr) {
 if (!String(idxErr.message || '').includes('Duplicate key name')) {
 console.warn('Index Warning idx_users_referred_by:', idxErr.message);
 }
 }

 try {
 await db.execute('CREATE INDEX idx_referral_reward_requests_user_status ON referral_reward_requests (user_id, status)');
 } catch (idxErr) {
 if (!String(idxErr.message || '').includes('Duplicate key name')) {
 console.warn('Index Warning idx_referral_reward_requests_user_status:', idxErr.message);
 }

 try {
 await db.execute('CREATE INDEX idx_site_access_logs_created_at ON site_access_logs (created_at)');
 } catch (idxErr) {
 if (!String(idxErr.message || '').includes('Duplicate key name')) {
 console.warn('Index Warning idx_site_access_logs_created_at:', idxErr.message);
 }
 }

 try {
 await db.execute('CREATE INDEX idx_site_access_logs_visitor_created ON site_access_logs (visitor_key, created_at)');
 } catch (idxErr) {
 if (!String(idxErr.message || '').includes('Duplicate key name')) {
 console.warn('Index Warning idx_site_access_logs_visitor_created:', idxErr.message);
 }
 }

 try {
 await db.execute('CREATE INDEX idx_balance_topups_status_created ON balance_topups (status, created_at)');
 } catch (idxErr) {
 if (!String(idxErr.message || '').includes('Duplicate key name')) {
 console.warn('Index Warning idx_balance_topups_status_created:', idxErr.message);
 }
 }

 try {
 await db.execute('ALTER TABLE wishlist MODIFY product_id INT NULL');
 } catch (err) {
 if (!String(err.message || '').toLowerCase().includes('duplicate')) {
 console.warn('Wishlist migration warning (product_id nullable):', err.message);
 }
 }

 try {
 await db.execute('UPDATE wishlist SET product_ref = CONCAT("db:", product_id) WHERE (product_ref IS NULL OR product_ref = "") AND product_id IS NOT NULL');
 } catch (err) {
 console.warn('Wishlist migration warning (product_ref backfill):', err.message);
 }

 try {
 await db.execute('ALTER TABLE wishlist DROP INDEX unique_wish');
 } catch (err) {
 if (!String(err.message || '').includes("check that column/key exists")) {
 console.warn('Wishlist migration warning (drop unique_wish):', err.message);
 }
 }

 try {
 await db.execute('CREATE UNIQUE INDEX unique_wish_ref ON wishlist (user_id, product_ref)');
 } catch (err) {
 if (!String(err.message || '').includes('Duplicate key name')) {
 console.warn('Wishlist migration warning (unique_wish_ref):', err.message);
 }
 }
 }

 try {
 const [usersWithoutCode] = await db.execute('SELECT id FROM users WHERE referral_code IS NULL OR referral_code = ""');
 for (const userRow of usersWithoutCode) {
 const code = await generateUniqueReferralCode();
 await db.execute('UPDATE users SET referral_code = ? WHERE id = ?', [code, userRow.id]);
 }
 } catch (seedErr) {
 console.warn('Referral code backfill warning:', seedErr.message);
 }

 // --- Seed Default Settings ---
 const defaultSettings = [
 { key: 'bank_card', value: '4127 0000 1111 2222' },
 { key: 'bank_name', value: 'ABB BANK' },
 { key: 'bank_holder', value: 'AZPINX ADMIN' },
 { key: 'reseller_discount_percent', value: '8' },
 { key: 'seo_meta_title', value: 'AZPINX - Oyun İçi Məhsullar və Pin Satışı' },
 { key: 'seo_meta_description', value: 'AZPINX üzərindən oyun içi məhsullar, UC, VP, pin və rəqəmsal kodları təhlükəsiz və sürətli alın.' },
 { key: 'seo_meta_keywords', value: 'azpinx, pubg uc, valorant vp, oyun içi məhsullar, pin satışı, rəqəmsal kod' },
 { key: 'seo_robots', value: 'index,follow' },
 { key: 'footer_about_text', value: 'AZPINX - Azərbaycanda bütün oyunlar üçün ən ucuz e-pinlərin rəsmi satış platformasıdır. Biz 7/24 xidmətinizdəyik.' },
 { key: 'footer_trust_1', value: 'SSL Təhlükəsiz' },
 { key: 'footer_trust_2', value: 'Lisenziyalı' },
 { key: 'footer_quick_title', value: 'Sürətli Keçidlər' },
 { key: 'footer_quick_1_label', value: 'Ana Səhifə' },
 { key: 'footer_quick_1_url', value: '/' },
 { key: 'footer_quick_2_label', value: 'FAQ' },
 { key: 'footer_quick_2_url', value: '/faq' },
 { key: 'footer_quick_3_label', value: 'Qaydalar və Şərtlər' },
 { key: 'footer_quick_3_url', value: '/terms' },
 { key: 'footer_account_title', value: 'Hesabım' },
 { key: 'footer_account_1_label', value: 'Profil' },
 { key: 'footer_account_1_url', value: '/profile' },
 { key: 'footer_account_2_label', value: 'Texniki Dəstək' },
 { key: 'footer_account_2_url', value: '/tickets' },
 { key: 'footer_account_3_label', value: 'İstək Siyahısı' },
 { key: 'footer_account_3_url', value: '/wishlist' },
 { key: 'footer_contact_title', value: 'Bizimlə Əlaqə' },
 { key: 'footer_whatsapp_label', value: 'WhatsApp' },
 { key: 'footer_whatsapp_value', value: '0107292236' },
 { key: 'footer_email_label', value: 'E-poçt' },
 { key: 'footer_email_value', value: 'destek@azpinx.com' },
 { key: 'footer_bottom_text', value: '© 2026 AZPINX - Bütün hüquqlar qorunur.' },
 { key: 'footer_payment_text', value: 'M10 / MilliÖN / eManat' },
 { key: 'admin_whatsapp_enabled', value: '1' },
 { key: 'admin_whatsapp_admin_ids', value: '' },
 { key: 'admin_whatsapp_events', value: 'order,ticket,refund,topup' }
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

function normalizeFooterLink(value, fallback = '#') {
 const normalized = normalizeOptionalString(value);
 if (!normalized) return fallback;
 const raw = String(normalized).trim();
 if (raw.startsWith('/')) return raw;
 if (/^https?:\/\//i.test(raw)) return raw;
 return fallback;
}

function parseSectionProductRefs(input) {
 const raw = Array.isArray(input) ? input : String(input || '').split(',');
 return [...new Set(raw.map((item) => String(item || '').trim()).filter(Boolean))];
}

function normalizeWishlistProductRef(value) {
 const normalized = normalizeOptionalString(value);
 if (!normalized) return null;
 const ref = String(normalized).trim();
 if (!ref) return null;
 return ref;
}

async function findUserByLoginIdentifier(identifier) {
 const normalized = normalizeOptionalString(identifier);
 if (!normalized) return null;
 const [rows] = await db.execute(
 'SELECT id, full_name, email, phone FROM users WHERE email = ? OR full_name = ? LIMIT 1',
 [normalized, normalized]
 );
 return rows.length ? rows[0] : null;
}

function resolveSliderLink(body = {}) {
 const type = normalizeOptionalString(body.destination_type) || 'custom';
 const value = normalizeOptionalString(body.destination_value);
 const custom = normalizeOptionalString(body.link) || '#';

 if (type === 'home') return '/';
 if (type === 'all_products') return '/all-products';
 if (type === 'faq') return '/faq';
 if (type === 'terms') return '/terms';
 if (type === 'tickets') return '/tickets';
 if (type === 'profile') return '/profile';
 if (type === 'wishlist') return '/wishlist';
 if (type === 'checkout') return '/checkout';
 if (type === 'cart') return '/cart';
 if (type === 'category' && value) return `/all-products?category=${encodeURIComponent(value)}`;
 if (type === 'custom') return custom;
 return custom;
}

function sanitizeReferralCode(value) {
 const normalized = normalizeOptionalString(value);
 if (!normalized) return null;
 const cleaned = String(normalized).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
 return cleaned || null;
}

function randomReferralCode() {
 return `AZP${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function getClientIp(req) {
 const forwarded = req.headers['x-forwarded-for'];
 let rawIp = '';
 if (forwarded && typeof forwarded === 'string') {
 rawIp = forwarded.split(',')[0].trim();
 } else {
 rawIp = req.ip || req.connection?.remoteAddress || '';
 }
 if (!rawIp) return null;
 return String(rawIp).replace('::ffff:', '').trim() || null;
}

function isPrivateOrLocalIp(ip) {
 const normalized = String(ip || '').trim().toLowerCase();
 if (!normalized) return true;
 if (normalized === '::1' || normalized === '127.0.0.1' || normalized === 'localhost') return true;
 if (normalized.startsWith('10.')) return true;
 if (normalized.startsWith('192.168.')) return true;
 if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) return true;
 if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
 return false;
}

async function checkVpnProxyStatus(ip) {
 const now = Date.now();
 const cached = vpnCheckCache.get(ip);
 if (cached && now - cached.createdAt < VPN_CACHE_TTL_MS) {
 return cached.payload;
 }

 const fallback = { blocked: false, isp: 'Unknown', reason: 'clean', source: 'ipapi.is' };
 try {
 const response = await axios.get('https://api.ipapi.is/', {
 params: { q: ip },
 timeout: VPN_CHECK_TIMEOUT_MS
 });
 const data = response.data || {};
 const isVpn = Boolean(data.is_vpn);
 const isProxy = Boolean(data.is_proxy);
 const isTor = Boolean(data.is_tor);
 const isDatacenter = Boolean(data.is_datacenter);
 const blocked = isVpn || isProxy || isTor || isDatacenter;

 let reason = 'clean';
 if (isVpn) reason = 'vpn';
 else if (isProxy) reason = 'proxy';
 else if (isTor) reason = 'tor';
 else if (isDatacenter) reason = 'datacenter';

 const isp = normalizeOptionalString(data?.asn?.org) ||
 normalizeOptionalString(data?.company?.name) ||
 normalizeOptionalString(data?.connection?.isp) ||
 'Unknown';

 const payload = { blocked, isp, reason, source: 'ipapi.is' };
 vpnCheckCache.set(ip, { createdAt: now, payload });
 return payload;
 } catch (e) {
 console.error('VPN check error:', e.message);
 vpnCheckCache.set(ip, { createdAt: now, payload: fallback });
 return fallback;
 }
}

async function generateUniqueReferralCode() {
 for (let i = 0; i < 20; i += 1) {
 const code = randomReferralCode();
 const [exists] = await db.execute('SELECT id FROM users WHERE referral_code = ? LIMIT 1', [code]);
 if (!exists.length) return code;
 }
 return `AZP${Date.now().toString(36).toUpperCase()}`;
}

async function ensureUserReferralCode(userId) {
 const [rows] = await db.execute('SELECT referral_code FROM users WHERE id = ? LIMIT 1', [userId]);
 if (!rows.length) return null;
 if (rows[0].referral_code) return rows[0].referral_code;
 const newCode = await generateUniqueReferralCode();
 await db.execute('UPDATE users SET referral_code = ? WHERE id = ? AND (referral_code IS NULL OR referral_code = "")', [newCode, userId]);
 const [updated] = await db.execute('SELECT referral_code FROM users WHERE id = ? LIMIT 1', [userId]);
 return updated.length ? updated[0].referral_code : newCode;
}

async function getReferralCountForUser(userId) {
 const [rows] = await db.execute(`
 SELECT COUNT(DISTINCT child.registration_ip) AS total
 FROM users child
 JOIN users referrer ON referrer.id = child.referred_by
 WHERE child.referred_by = ?
 AND child.registration_ip IS NOT NULL
 AND child.registration_ip <> ''
 AND (
 referrer.registration_ip IS NULL
 OR referrer.registration_ip = ''
 OR child.registration_ip <> referrer.registration_ip
 )
 `, [userId]);
 return Number(rows[0]?.total || 0);
}

async function notifyAllAdmins(message, eventType = '') {
 try {
 const [settingsRows] = await db.execute(
 'SELECT setting_key, setting_value FROM settings WHERE setting_key IN (?, ?, ?)',
 ['admin_whatsapp_enabled', 'admin_whatsapp_admin_ids', 'admin_whatsapp_events']
 );
 const settingsMap = {};
 settingsRows.forEach((row) => { settingsMap[row.setting_key] = row.setting_value; });

 const enabled = String(settingsMap.admin_whatsapp_enabled ?? '1') !== '0';
 if (!enabled) return;

 const selectedIds = String(settingsMap.admin_whatsapp_admin_ids || '')
 .split(',')
 .map((v) => Number(String(v || '').trim()))
 .filter((v) => Number.isInteger(v) && v > 0);

 const events = String(settingsMap.admin_whatsapp_events || 'order,ticket,refund,topup')
 .split(',')
 .map((v) => String(v || '').trim().toLowerCase())
 .filter(Boolean);

 const eventTypeRaw = String(eventType || '').trim().toLowerCase();
 if (eventTypeRaw && !events.includes(eventTypeRaw) && !events.includes('all')) return;

 const [admins] = await db.execute('SELECT id, phone FROM users WHERE role = "admin" AND phone IS NOT NULL AND phone <> ""');
 const recipients = selectedIds.length
 ? admins.filter((admin) => selectedIds.includes(Number(admin.id)))
 : admins;

 recipients.forEach((admin) => sendWhatsApp(admin.phone, message));
 } catch (e) {
 console.error('Admin notification error:', e.message);
 }
}

function extractPayloadStrings(value, maxDepth = 4, depth = 0, bucket = []) {
 if (depth > maxDepth || value === null || value === undefined) return bucket;
 if (typeof value === 'string') {
 bucket.push(value);
 return bucket;
 }
 if (typeof value === 'number' || typeof value === 'boolean') {
 bucket.push(String(value));
 return bucket;
 }
 if (Array.isArray(value)) {
 value.forEach((item) => extractPayloadStrings(item, maxDepth, depth + 1, bucket));
 return bucket;
 }
 if (typeof value === 'object') {
 Object.values(value).forEach((v) => extractPayloadStrings(v, maxDepth, depth + 1, bucket));
 }
 return bucket;
}

function hasSuspiciousSqlPattern(payload = {}) {
 const joined = extractPayloadStrings(payload).join(' ').toLowerCase();
 if (!joined) return false;
 const patterns = [
 /\bunion\s+select\b/i,
 /\bunion\s+all\s+select\b/i,
 /\binformation_schema\b/i,
 /\b(?:sleep|benchmark)\s*\(/i,
 /\b(?:load_file|into\s+outfile)\b/i,
 /(?:;|\s)\s*(?:drop|truncate|alter|create)\s+(?:table|database)\b/i,
 /(?:')\s*(?:or|and)\s*(?:'[^']*'|\d+)/i,
 /\bor\s+1\s*=\s*1\b/i,
 /\band\s+1\s*=\s*1\b/i,
 /\/\*![0-9]{0,5}/i,
 /(?:--|#)\s*[^\r\n]*/
 ];
 return patterns.some((pattern) => pattern.test(joined));
}

function getRateLimitBucket(pathname) {
 if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/verify-otp') || pathname.startsWith('/forgot-password')) return 'auth';
 if (pathname.startsWith('/api/')) return 'api';
 return 'default';
}

async function translateText(text, targetLang) {
 const raw = String(text || '').trim();
 if (!raw) return '';
 if (!TRANSLATE_CONFIG.SUPPORTED.includes(targetLang)) return raw;
 if (targetLang === 'az') return raw;

 for (const url of TRANSLATE_CONFIG.URLS) {
 try {
 const response = await axios.post(url, {
 q: raw,
 source: 'az',
 target: targetLang,
 format: 'text'
 }, {
 timeout: TRANSLATE_CONFIG.TIMEOUT,
 headers: { 'Content-Type': 'application/json' }
 });
 const translated = response?.data?.translatedText;
 if (typeof translated === 'string' && translated.trim()) {
 return translated.trim();
 }
 } catch (e) {
 console.warn(`Translate provider failed (${url}):`, e.message);
 }
 }

 try {
 const fallbackResponse = await axios.get('https://api.mymemory.translated.net/get', {
 params: { q: raw, langpair: `az|${targetLang}` },
 timeout: TRANSLATE_CONFIG.TIMEOUT
 });
 const translated = fallbackResponse?.data?.responseData?.translatedText;
 if (typeof translated === 'string' && translated.trim()) {
 return translated.trim();
 }
 } catch (e) {
 console.warn('Translate fallback failed:', e.message);
 }

 return raw;
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

app.get('/license-status', (req, res) => {
 const code = APP_LICENSE_STATE.valid ? 200 : 403;
 return res.status(code).json({
  success: APP_LICENSE_STATE.valid,
  reason: APP_LICENSE_STATE.reason
 });
});

app.get('/license-invalid', (req, res) => {
 if (APP_LICENSE_STATE.valid) {
  return res.redirect('/');
 }
 const reason = APP_LICENSE_STATE.reason || 'unknown';
 return res.status(403).type('html').send(`<!doctype html>
<html lang="az">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lisenziya Xətası</title>
  <style>
    body { margin:0; background:#0b1020; color:#e2e8f0; font-family:Arial,sans-serif; display:grid; place-items:center; min-height:100vh; padding:24px; }
    .box { max-width:640px; width:100%; background:#111a33; border:1px solid #233156; border-radius:12px; padding:28px; }
    h1 { margin:0 0 10px; font-size:22px; }
    p { margin:0 0 8px; color:#cbd5e1; line-height:1.5; }
    code { background:#0f172a; padding:2px 6px; border-radius:6px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Proqram bloklandı</h1>
    <p>Lisenziya doğrulaması uğursuz oldu. Sistem işləməyə davam etmir.</p>
    <p>Səbəb: <code>${reason}</code></p>
    <p>Administrator lisenziya kodunu və store faylını yoxlamalıdır.</p>
  </div>
</body>
</html>`);
});

app.use((req, res, next) => {
 if (APP_LICENSE_STATE.valid) return next();

 const pathValue = String(req.path || '');
 const allowList = ['/license-invalid', '/license-status'];
 if (allowList.includes(pathValue)) return next();

 if (pathValue.startsWith('/api/')) {
  return res.status(403).json({
   success: false,
   error: 'Lisenziya doğrulaması uğursuz oldu.',
   reason: APP_LICENSE_STATE.reason
  });
 }

 return res.redirect('/license-invalid');
});

app.use((req, res, next) => {
 res.setHeader('X-Content-Type-Options', 'nosniff');
 res.setHeader('X-Frame-Options', 'SAMEORIGIN');
 res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
 res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
 res.setHeader('X-XSS-Protection', '1; mode=block');
 const noindexPaths = /^\/(admin|login|register|verify-otp|forgot-password|profile|checkout|cart|tickets|wishlist|api|balance)/i;
 if (noindexPaths.test(String(req.path || ''))) {
 res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
 }
 next();
});

app.use((req, res, next) => {
 const pathValue = String(req.path || '');
 const skipPrefixes = ['/css/', '/js/', '/images/', '/uploads/', '/favicon'];
 if (skipPrefixes.some((prefix) => pathValue.startsWith(prefix))) return next();

 const ip = getClientIp(req) || 'unknown';
 const bucket = getRateLimitBucket(pathValue);
 const now = Date.now();
 const key = `${ip}:${bucket}`;
 const current = requestGuardStore.get(key) || { startAt: now, hits: 0 };
 if (now - current.startAt > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
 current.startAt = now;
 current.hits = 0;
 }
 current.hits += 1;
 requestGuardStore.set(key, current);

 const maxHits = bucket === 'auth'
 ? SECURITY_CONFIG.RATE_LIMIT_MAX_AUTH
 : (bucket === 'api' ? SECURITY_CONFIG.RATE_LIMIT_MAX_API : SECURITY_CONFIG.RATE_LIMIT_MAX_DEFAULT);
 if (current.hits > maxHits) {
 return res.status(429).json({ success: false, error: 'Çox sayda sorğu göndərildi. Zəhmət olmasa bir az sonra yenidən cəhd edin.' });
 }
 next();
});

app.use((req, res, next) => {
 const userAgent = String(req.headers['user-agent'] || '').toLowerCase();
 const suspiciousBot = /(sqlmap|nmap|nikto|acunetix|masscan|crawler|scrapy|python-requests|headlesschrome)/i.test(userAgent);
 const sensitivePath = /^\/(admin|login|register|verify-otp|forgot-password|api|checkout|process-order|balance)/i.test(String(req.path || ''));
 if (suspiciousBot && sensitivePath) {
 return res.status(403).json({ success: false, error: 'Robot trafik bloklandı.' });
 }
 next();
});

app.use((req, res, next) => {
 const scanPayload = { query: req.query, params: req.params };
 if (hasSuspiciousSqlPattern(scanPayload)) {
 return res.status(400).json({ success: false, error: 'Şübhəli sorğu aşkarlandı və bloklandı.' });
 }
 next();
});

app.use((req, res, next) => {
 const method = String(req.method || 'GET').toUpperCase();
 const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
 if (!isMutating) return next();

 const payload = { query: req.query, params: req.params, body: req.body };
 if (hasSuspiciousSqlPattern(payload)) {
 return res.status(400).json({ success: false, error: 'Şübhəli sorğu aşkarlandı və bloklandı.' });
 }
 next();
});

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

 const now = Date.now();
 const shouldTouchLastSeen = !req.session.last_seen_touch_at || (now - req.session.last_seen_touch_at) > 120000;
 if (shouldTouchLastSeen) {
 await db.execute('UPDATE users SET last_seen_at = NOW() WHERE id = ?', [req.session.user.id]);
 req.session.last_seen_touch_at = now;
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

 const isTrackableMethod = req.method === 'GET';
 const pathValue = String(req.path || '');
 const skipPathPrefixes = ['/uploads/', '/css/', '/js/', '/images/', '/favicon', '/adminlte', '/cdn-cgi'];
 const isSkipPath = skipPathPrefixes.some(prefix => pathValue.startsWith(prefix));
 const shouldTrack = isTrackableMethod && !isSkipPath && db;

 if (shouldTrack) {
 const now = Date.now();
 const lastLogAt = Number(req.session.last_access_log_at || 0);
 if ((now - lastLogAt) > 30000) {
 const visitorIdentity = req.session.user?.id
 ? `u:${req.session.user.id}`
 : `g:${getClientIp(req) || 'unknown'}:${String(req.headers['user-agent'] || '').slice(0, 80)}`;

 await db.execute(
 'INSERT INTO site_access_logs (user_id, visitor_key, request_path) VALUES (?, ?, ?)',
 [req.session.user?.id || null, visitorIdentity, pathValue.slice(0, 255)]
 );
 req.session.last_access_log_at = now;
 }
 }

 delete req.session.error;
 delete req.session.success;
 } catch (err) {
 console.error("Middleware Error:", err.message);
 res.locals.announcements = [];
 }
 next();
});

app.get('/robots.txt', async (req, res) => {
 try {
 const [rows] = await db.execute('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', ['seo_robots']);
 const robotsSetting = rows.length ? String(rows[0].setting_value || '').trim().toLowerCase() : 'index,follow';
 const disallowAll = robotsSetting === 'noindex,nofollow';
 const lines = [
 'User-agent: *',
 disallowAll ? 'Disallow: /' : 'Disallow: /admin',
 disallowAll ? '' : 'Disallow: /login',
 disallowAll ? '' : 'Disallow: /register',
 disallowAll ? '' : 'Disallow: /profile',
 disallowAll ? '' : 'Disallow: /checkout',
 disallowAll ? '' : 'Disallow: /cart',
 disallowAll ? '' : 'Disallow: /tickets',
 disallowAll ? '' : 'Disallow: /wishlist',
 disallowAll ? '' : 'Disallow: /api'
 ].filter(Boolean);

 return res.type('text/plain').send(lines.join('\n'));
 } catch (e) {
 return res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /api');
 }
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

app.use(async (req, res, next) => {
 if (!VPN_BLOCK_ENABLED) return next();
 if (req.path === '/vpn-blocked') return next();

 const clientIp = getClientIp(req);
 if (!clientIp || isPrivateOrLocalIp(clientIp)) return next();

 const check = await checkVpnProxyStatus(clientIp);
 if (!check.blocked) return next();

 const rayId = normalizeOptionalString(req.headers['cf-ray']) || 'N/A';
 const blockInfo = {
 ip: clientIp,
 rayId,
 isp: check.isp,
 reason: check.reason,
 source: check.source
 };

 if ((req.path || '').startsWith('/api/') || req.accepts('json')) {
 return res.status(403).json({
 success: false,
 error: 'VPN və ya proxy bağlantısı bloklandı.',
 ...blockInfo
 });
 }

 return res.status(403).render('vpn_blocked', { title: 'Giriş Bloklandı', blockInfo });
});

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
 const homeCatalogProducts = [...allProducts];
 const saleProductCount = allProducts.length;

 // Filter by Category if provided
 const selectedCategory = req.query.category;
 if (selectedCategory) {
 allProducts = allProducts.filter(p => p.category === selectedCategory);
 }

 // Fetch Home Sections
 const [sections] = await db.execute('SELECT * FROM home_sections WHERE is_active = TRUE ORDER BY order_index ASC');

 const sectionsWithProducts = await Promise.all(sections.map(async (section) => {
 const productRefs = parseSectionProductRefs(section.product_ids);
 const selectedProducts = [];
 const seenRefs = new Set();

 for (const ref of productRefs) {
 const found = homeCatalogProducts.find((p) =>
 String(p.id) === String(ref) ||
 String(p.db_id || '') === String(ref).replace(/^db:/, '')
 );
 if (!found) continue;
 const key = String(found.id);
 if (seenRefs.has(key)) continue;
 seenRefs.add(key);
 selectedProducts.push(found);
 }

 if (section.category_id) {
 const categoryProducts = homeCatalogProducts.filter((p) => Number(p.category_id || 0) === Number(section.category_id));
 for (const product of categoryProducts) {
 if (selectedProducts.length >= 8) break;
 const key = String(product.id);
 if (seenRefs.has(key)) continue;
 seenRefs.add(key);
 selectedProducts.push(product);
 }
 }

 if (!section.category_id && !selectedProducts.length) {
 selectedProducts.push(...homeCatalogProducts.slice(0, 8));
 }

 const categoryName = categories.find((c) => Number(c.id) === Number(section.category_id))?.name || section.category_name || null;
 const link = categoryName ? `/all-products?category=${encodeURIComponent(categoryName)}` : null;

 return { ...section, category_name: categoryName, link, products: selectedProducts.slice(0, 8), productRefs };
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

 homeCatalogProducts.sort((a, b) => {
 const aPriority = gamePriority.indexOf(a.category);
 const bPriority = gamePriority.indexOf(b.category);

 if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
 if (aPriority !== -1) return -1;
 if (bPriority !== -1) return 1;
 return 0;
 });

 const normalizeText = (val) => String(val || '').toLowerCase();
 const hasAny = (product, keywords) => {
 const bag = `${normalizeText(product.category)} ${normalizeText(product.name)} ${normalizeText(product.description)}`;
 return keywords.some(k => bag.includes(k));
 };
 const gameKeywords = ['pubg', 'free fire', 'valorant', 'mobile legends', 'steam', 'roblox', 'xbox', 'playstation', 'google play', 'itunes', 'razer', 'oyun', 'game'];
 const aiKeywords = [' ai', 'ai ', 'chatgpt', 'gpt', 'midjourney', 'claude', 'gemini', 'copilot', 'openai'];
 const softwareKeywords = ['yazılım', 'yazilim', 'software', 'windows', 'office', 'vpn', 'antivirus', 'license', 'lisenziya'];
 const ingameKeywords = ['oyun içi', 'oyun ici', 'topup', 'top-up', 'uc', 'cp', 'vp', 'diamond', 'token', 'coins'];
 const pinKeywords = ['pin', 'e-pin', 'epin', 'gift card', 'giftcard'];

 const usedProductIds = new Set();
 const pickSectionProducts = (candidates, limit = 8) => {
 const picked = [];
 for (const p of candidates) {
 const uniqueId = String(p.id);
 if (usedProductIds.has(uniqueId)) continue;
 usedProductIds.add(uniqueId);
 picked.push(p);
 if (picked.length >= limit) break;
 }
 return picked;
 };

 const apiGamesCandidates = homeCatalogProducts.filter(p => p.api_id && hasAny(p, gameKeywords));
 const aiCandidates = homeCatalogProducts.filter(p => hasAny(p, aiKeywords));
 const softwareCandidates = homeCatalogProducts.filter(p => hasAny(p, softwareKeywords));
 const ingameCandidates = homeCatalogProducts.filter(p => hasAny(p, ingameKeywords));
 const pinCandidates = homeCatalogProducts.filter(p => hasAny(p, pinKeywords));

 const ingamePriorityKeywords = ['pubg', 'valorant', 'free fire', 'mobile legends', 'roblox'];
 const scoreByPriority = (product) => {
 const bag = `${normalizeText(product.category)} ${normalizeText(product.name)}`;
 for (let i = 0; i < ingamePriorityKeywords.length; i++) {
 if (bag.includes(ingamePriorityKeywords[i])) return i;
 }
 return 999;
 };
 const prioritizedIngameApi = [...homeCatalogProducts]
 .filter(p => p.api_id)
 .filter(p => hasAny(p, ingameKeywords) || hasAny(p, gameKeywords))
 .sort((a, b) => scoreByPriority(a) - scoreByPriority(b));

 let homeAutoSections = [
 { title: 'Oyun İçi Məhsullar', link: '/all-products?search=topup', products: pickSectionProducts(prioritizedIngameApi.length ? prioritizedIngameApi : ingameCandidates, 8) },
 { title: 'Oyunlar', link: '/all-products?search=oyun', products: pickSectionProducts(apiGamesCandidates, 8) },
 { title: 'AI', link: '/all-products?search=ai', products: pickSectionProducts(aiCandidates, 8) },
 { title: 'Yazılımlar', link: '/all-products?search=yaz%C4%B1l%C4%B1m', products: pickSectionProducts(softwareCandidates, 8) },
 { title: 'Pinlər', link: '/all-products?search=pin', products: pickSectionProducts(pinCandidates, 8) }
 ].filter(section => section.products.length > 0);

 if (sectionsWithProducts.length > 0) {
 homeAutoSections = [];
 }

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
	 homeAutoSections,
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

app.get('/vpn-blocked', (req, res) => {
 const blockInfo = {
 ip: getClientIp(req) || 'N/A',
 rayId: normalizeOptionalString(req.headers['cf-ray']) || 'N/A',
 isp: 'Unknown',
 reason: 'manual',
 source: 'system'
 };
 res.status(403).render('vpn_blocked', { title: 'Giriş Bloklandı', blockInfo });
});

app.get('/api/pubg-check', async (req, res) => {
 const playerIdRaw = normalizeOptionalString(req.query.player_id);
 if (!playerIdRaw) return res.json({ success: false, error: 'ID daxil edin.' });
 const playerId = String(playerIdRaw);
 // Prevent stale cached API responses (304 with old error payload)
 res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
 res.set('Pragma', 'no-cache');
 res.set('Expires', '0');
 res.set('ETag', `"pubg-check-${Date.now()}"`);

 const now = Date.now();
 const cached = pubgCheckCache.get(playerId);
 if (cached && (now - cached.createdAt) < PUBG_CHECKER_CONFIG.CACHE_TTL_MS) {
 return res.json(cached.payload);
 }

 if (!/^\d{5,20}$/.test(playerId)) {
 const invalid = { success: false, error: 'ID formatı düzgün deyil.' };
 pubgCheckCache.set(playerId, { createdAt: now, payload: invalid });
 return res.json(invalid);
 }

 try {
 let lookupPromise = pubgCheckInflight.get(playerId);
 if (!lookupPromise) {
 const requests = PUBG_CHECKER_CONFIG.URLS.map((baseUrl) => (
 axios.get(`${baseUrl}/check-player`, {
 params: { id: playerId },
 timeout: PUBG_CHECKER_CONFIG.TIMEOUT
 }).then((response) => {
 const data = response.data || {};
 if (data.success && data.player_name) {
 return { success: true, nickname: data.player_name };
 }
 throw new Error(data.error || 'Oyunçu tapılmadı.');
 })
 ));

 lookupPromise = Promise.any(requests)
 .catch((aggregateError) => {
 const firstReason = Array.isArray(aggregateError?.errors) && aggregateError.errors.length
 ? aggregateError.errors[0]
 : null;
 const message = firstReason?.message || 'PUBG checker servisi ilə bağlantı xətası baş verdi.';
 return { success: false, error: message };
 })
 .finally(() => {
 pubgCheckInflight.delete(playerId);
 });
 pubgCheckInflight.set(playerId, lookupPromise);
 }

 const payload = await lookupPromise;
 pubgCheckCache.set(playerId, { createdAt: Date.now(), payload });
 return res.json(payload);
 } catch (e) {
 console.error('PUBG checker lookup error:', e.message);
 const payload = { success: false, error: 'PUBG checker servisi ilə bağlantı xətası baş verdi.' };
 pubgCheckCache.set(playerId, { createdAt: Date.now(), payload });
 return res.json(payload);
 }
});

app.post('/api/translate-batch', async (req, res) => {
 try {
 const target = normalizeOptionalString(req.body.target);
 const textsRaw = Array.isArray(req.body.texts) ? req.body.texts : [];
 const texts = textsRaw
 .map((t) => String(t || '').trim())
 .filter(Boolean)
 .slice(0, 200);

 if (!target || !TRANSLATE_CONFIG.SUPPORTED.includes(target)) {
 return res.status(400).json({ success: false, error: 'Yanlış dil.' });
 }
 if (!texts.length) {
 return res.json({ success: true, translations: {} });
 }

 const uniqueTexts = [...new Set(texts)];
 const translations = {};
 for (const text of uniqueTexts) {
 translations[text] = await translateText(text, target);
 }

 return res.json({ success: true, translations });
 } catch (e) {
 console.error('Translate batch error:', e.message);
 return res.status(500).json({ success: false, error: 'Tərcümə servisi xətası.' });
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

app.get('/register', async (req, res) => {
 const incomingRefCode = sanitizeReferralCode(req.query.ref);
 if (incomingRefCode) req.session.reg_referral_code = incomingRefCode;

 const activeReferralCode = sanitizeReferralCode(req.session.reg_referral_code);
 let referrerName = null;

 if (activeReferralCode) {
 const [referrerRows] = await db.execute('SELECT full_name FROM users WHERE referral_code = ? LIMIT 1', [activeReferralCode]);
 if (referrerRows.length) {
 referrerName = referrerRows[0].full_name;
 } else {
 delete req.session.reg_referral_code;
 }
 }

 res.render('register', {
 title: 'Qeydiyyat',
 referralCode: activeReferralCode,
 referrerName
 });
});

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
 const registrationIp = getClientIp(req);

 // Verify OTP
 if (!req.session.reg_otp || req.session.reg_otp !== otp || new Date(req.session.reg_expiry) < new Date() || req.session.reg_phone !== phone) {
 return res.render('register', {
 title: 'Qeydiyyat',
 error: 'Yanlış və ya vaxtı keçmiş təsdiq kodu.',
 referralCode: sanitizeReferralCode(req.session.reg_referral_code),
 referrerName: null
 });
 }

 const hashed = await bcrypt.hash(password, 10);
 try {
 const [usersCount] = await db.execute('SELECT count(*) as count FROM users');
 const role = usersCount[0].count === 0 ? 'admin' : 'user';
 const ownReferralCode = await generateUniqueReferralCode();
 let referredBy = null;
 const referralCodeFromSession = sanitizeReferralCode(req.session.reg_referral_code);
 let referralBlockedByIp = false;

 if (referralCodeFromSession) {
 const [referrerRows] = await db.execute('SELECT id, registration_ip FROM users WHERE referral_code = ? LIMIT 1', [referralCodeFromSession]);
 if (referrerRows.length) {
 const referrer = referrerRows[0];
 const referrerIp = normalizeOptionalString(referrer.registration_ip);
 const clientIp = normalizeOptionalString(registrationIp);

 if (!clientIp) {
 referralBlockedByIp = true;
 } else if (clientIp && referrerIp && clientIp === referrerIp) {
 referralBlockedByIp = true;
 } else {
 const [sameIpUsed] = await db.execute(
 'SELECT id FROM users WHERE referred_by = ? AND registration_ip = ? LIMIT 1',
 [referrer.id, clientIp]
 );
 if (sameIpUsed.length > 0) {
 referralBlockedByIp = true;
 } else {
 referredBy = referrer.id;
 }
 }
 }
 }

 await db.execute(
 'INSERT INTO users (full_name, email, password, role, phone, referral_code, referred_by, registration_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
 [full_name, email, hashed, role, phone, ownReferralCode, referredBy, registrationIp]
 );

 // Clear registration session
 delete req.session.reg_otp;
 delete req.session.reg_phone;
 delete req.session.reg_expiry;
 delete req.session.reg_referral_code;

 req.session.success = referralBlockedByIp
 ? 'Qeydiyyat tamamlandı. Dəvət bonusu IP qaydasına görə tətbiq edilmədi.'
 : 'Uğurla qeydiyyatdan keçdiniz! İndi giriş edin.';
 res.redirect('/login');
 } catch (e) {
 res.render('register', {
 title: 'Qeydiyyat',
 error: 'Xəta: Bu email artıq istifadə olunub.',
 referralCode: sanitizeReferralCode(req.session.reg_referral_code),
 referrerName: null
 });
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

app.get('/forgot-password', (req, res) => {
 res.render('forgot_password', { title: 'Şifrəni Sıfırla' });
});

app.post('/forgot-password/send-otp', async (req, res) => {
 const identifier = normalizeOptionalString(req.body.identifier);
 if (!identifier) return res.json({ success: false, error: 'Email və ya username daxil edin.' });

 try {
 const user = await findUserByLoginIdentifier(identifier);
 if (!user) return res.json({ success: false, error: 'İstifadəçi tapılmadı.' });
 if (!normalizeOptionalString(user.phone)) {
 return res.json({ success: false, error: 'Bu istifadəçi üçün telefon nömrəsi tapılmadı.' });
 }

 const otp = Math.floor(100000 + Math.random() * 900000).toString();
 const expiry = new Date(Date.now() + 10 * 60000);
 req.session.forgot_user_id = user.id;
 req.session.forgot_otp = otp;
 req.session.forgot_expiry = expiry;

 const sent = await sendSMS(user.phone, `AZPINX Şifrə Sıfırlama Kodunuz: ${otp}`);
 if (!sent) return res.json({ success: false, error: 'OTP göndərilmədi. Yenidən cəhd edin.' });
 return res.json({ success: true, message: 'OTP göndərildi.' });
 } catch (e) {
 console.error('Forgot password send otp error:', e.message);
 return res.json({ success: false, error: 'Server xətası.' });
 }
});

app.post('/forgot-password/reset', async (req, res) => {
 const otp = normalizeOptionalString(req.body.otp);
 const newPassword = String(req.body.new_password || '');
 const confirmPassword = String(req.body.new_password_confirm || '');

 if (!req.session.forgot_user_id || !req.session.forgot_otp || !req.session.forgot_expiry) {
 req.session.error = 'OTP sessiyası tapılmadı. Yenidən OTP istəyin.';
 return res.redirect('/forgot-password');
 }
 if (!otp || otp !== req.session.forgot_otp || new Date(req.session.forgot_expiry) < new Date()) {
 req.session.error = 'Yanlış və ya vaxtı bitmiş OTP.';
 return res.redirect('/forgot-password');
 }
 if (!newPassword || newPassword.length < 6) {
 req.session.error = 'Yeni şifrə minimum 6 simvol olmalıdır.';
 return res.redirect('/forgot-password');
 }
 if (newPassword !== confirmPassword) {
 req.session.error = 'Yeni şifrə təkrar hissəsi uyğun deyil.';
 return res.redirect('/forgot-password');
 }

 try {
 const hashed = await bcrypt.hash(newPassword, 10);
 await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.session.forgot_user_id]);
 delete req.session.forgot_user_id;
 delete req.session.forgot_otp;
 delete req.session.forgot_expiry;
 req.session.success = 'Şifrəniz uğurla yeniləndi. İndi daxil ola bilərsiniz.';
 return res.redirect('/login');
 } catch (e) {
 console.error('Forgot password reset error:', e.message);
 req.session.error = 'Şifrə yenilənmə xətası.';
 return res.redirect('/forgot-password');
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

 if (payment_method === 'C2C Card Transfer') {
 if (!normalizeOptionalString(sender_name)) {
 return res.status(400).json({ success: false, error: 'Ödəniş edən şəxsin ad-soyadı tələb olunur.' });
 }
 if (!receipt_path) {
 return res.status(400).json({ success: false, error: 'Dekont yükləmək mütləqdir.' });
 }
 }

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
 const adminMsg = `AZPINX: Yeni sifariş!\nİstifadəçi: ${req.session.user.full_name}\nNömrə: ${req.session.user.phone || 'Yoxdur'}\nMəhsul: ${productList}\nMəbləğ: ${totalAmount} AZN\nSaat: ${timeNow}`;
 await notifyAllAdmins(adminMsg, 'order');

 res.json({ success: true });
 } catch (e) {
 console.error("Process Order Error:", e.message);
 res.status(500).json({ success: false, error: e.message });
 }
});

app.post('/balance/topups/request', uploadReceipt.single('receipt'), async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false, error: 'Daxil olun.' });

 try {
 const amount = Number(req.body.amount || 0);
 const senderName = normalizeOptionalString(req.body.sender_name);
 const receiptPath = req.file ? '/uploads/receipts/' + req.file.filename : null;

 if (!senderName) {
 return res.status(400).json({ success: false, error: 'Ad Soyad daxil edin.' });
 }
 if (!amount || amount <= 0) {
 return res.status(400).json({ success: false, error: 'Düzgün məbləğ daxil edin.' });
 }
 if (!receiptPath) {
 return res.status(400).json({ success: false, error: 'Dekont yükləmək mütləqdir.' });
 }

 const [result] = await db.execute(
 'INSERT INTO balance_topups (user_id, amount, sender_name, receipt_path, payment_method, status) VALUES (?, ?, ?, ?, ?, ?)',
 [req.session.user.id, Number(amount.toFixed(2)), senderName, receiptPath, 'C2C Card Transfer', 'pending']
 );

 const adminMsg = `AZPINX: Yeni balans artırma!\nİstifadəçi: ${req.session.user.full_name}\nNömrə: ${req.session.user.phone || 'Yoxdur'}\nMəbləğ: ${Number(amount).toFixed(2)} AZN\nTalep ID: #${result.insertId}`;
 await notifyAllAdmins(adminMsg, 'topup');

 return res.json({ success: true, message: 'Balans artırma tələbi admin təsdiqinə göndərildi.' });
 } catch (e) {
 console.error('Balance topup request error:', e.message);
 return res.status(500).json({ success: false, error: 'Balans artırma sorğusu yaradılmadı.' });
 }
});

// --- Wishlist Routes ---
app.get('/wishlist', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [wishlistRows] = await db.execute(
 'SELECT product_id, product_ref, created_at FROM wishlist WHERE user_id = ? ORDER BY created_at DESC',
 [req.session.user.id]
 );
 let allProducts = await getMappedProducts();
 allProducts = allProducts.filter((p) => p.status === 'sale' && p.is_active);
 const productMap = new Map();
 allProducts.forEach((product) => {
 productMap.set(String(product.id), product);
 if (product.db_id) productMap.set(`db:${product.db_id}`, product);
 });

 const wishlistItems = wishlistRows.map((row) => {
 const ref = normalizeWishlistProductRef(row.product_ref) || (row.product_id ? `db:${row.product_id}` : null);
 if (!ref) return null;
 return productMap.get(ref) ||
 productMap.get(String(ref).replace(/^db:/, '')) ||
 productMap.get(`local_${String(ref).replace(/^db:/, '')}`) ||
 null;
 }).filter(Boolean);

 const resellerDiscountPercent = await getResellerDiscountPercent();
 const pricedWishlist = applyResellerPricing(wishlistItems, req.session.user, resellerDiscountPercent);
 res.render('wishlist', { title: 'İstək Listəm', wishlist: pricedWishlist });
});

app.post('/wishlist/toggle', async (req, res) => {
 if (!req.session.user) return res.status(401).json({ success: false, error: 'Login olun' });
 const productRef = normalizeWishlistProductRef(req.body.product_id);
 if (!productRef) return res.status(400).json({ success: false, error: 'Məhsul ID düzgün deyil.' });
 try {
 const [existing] = await db.execute('SELECT id FROM wishlist WHERE user_id = ? AND product_ref = ?', [req.session.user.id, productRef]);
 if (existing.length > 0) {
 await db.execute('DELETE FROM wishlist WHERE user_id = ? AND product_ref = ?', [req.session.user.id, productRef]);
 res.json({ success: true, action: 'removed' });
 } else {
 let legacyProductId = null;
 if (/^\d+$/.test(productRef)) {
 legacyProductId = Number(productRef);
 } else if (/^local_\d+$/i.test(productRef)) {
 legacyProductId = Number(String(productRef).split('_')[1] || 0) || null;
 } else if (/^db:\d+$/i.test(productRef)) {
 legacyProductId = Number(String(productRef).replace(/^db:/i, '')) || null;
 }
 await db.execute('INSERT INTO wishlist (user_id, product_id, product_ref) VALUES (?, ?, ?)', [req.session.user.id, legacyProductId, productRef]);
 res.json({ success: true, action: 'added' });
 }
 } catch (e) {
 res.status(500).json({ success: false, error: e.message });
 }
});

app.get('/profile', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const [orders] = await db.execute('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
 const [topups] = await db.execute('SELECT * FROM balance_topups WHERE user_id = ? ORDER BY created_at DESC', [req.session.user.id]);
 const refundWindowMs = 5 * 24 * 60 * 60 * 1000;
 const now = Date.now();
 const enrichedTopups = topups.map((topup) => {
 const createdAtMs = new Date(topup.created_at).getTime();
 const withinRefundWindow = Number.isFinite(createdAtMs) && (now - createdAtMs) <= refundWindowMs;
 const refundStatus = topup.refund_status || 'none';
 const canRefund = topup.status === 'approved' && withinRefundWindow && refundStatus === 'none';
 return {
 ...topup,
 can_refund: canRefund,
 within_refund_window: withinRefundWindow
 };
 });
 const [userData] = await db.execute('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
 const user = userData[0];
 const referralCode = await ensureUserReferralCode(user.id);
 const referredCount = await getReferralCountForUser(user.id);
 const [pendingClaims] = await db.execute('SELECT id, status, created_at FROM referral_reward_requests WHERE user_id = ? AND status = "pending" ORDER BY created_at DESC LIMIT 1', [user.id]);
 const progressPercent = Math.min(100, Math.round((referredCount / REFERRAL_TARGET) * 100));
 const baseUrl = `${req.protocol}://${req.get('host')}`;
 const inviteLink = `${baseUrl}/register?ref=${encodeURIComponent(referralCode)}`;

 res.render('profile', {
 title: 'Profilim',
 orders,
 topups: enrichedTopups,
 user: { ...user, referral_code: referralCode },
 referral: {
 target: REFERRAL_TARGET,
 reward: REFERRAL_REWARD_LABEL,
 referredCount,
 progressPercent,
 inviteLink,
 pendingClaim: pendingClaims[0] || null,
 canClaim: referredCount >= REFERRAL_TARGET && pendingClaims.length === 0
 }
 });
});

app.post('/profile/topups/:id/refund-request', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');
 const topupId = Number(req.params.id);
 if (!topupId) {
 req.session.error = 'Yanlış topup ID.';
 return res.redirect('/profile');
 }

 try {
 const [rows] = await db.execute('SELECT * FROM balance_topups WHERE id = ? AND user_id = ? LIMIT 1', [topupId, req.session.user.id]);
 if (!rows.length) {
 req.session.error = 'Balans artırma qeydi tapılmadı.';
 return res.redirect('/profile');
 }

 const topup = rows[0];
 if (topup.status !== 'approved') {
 req.session.error = 'Yalnız təsdiqlənmiş balans artırma üçün iade tələbi yaradıla bilər.';
 return res.redirect('/profile');
 }

 const createdAtMs = new Date(topup.created_at).getTime();
 const refundWindowMs = 5 * 24 * 60 * 60 * 1000;
 if (!Number.isFinite(createdAtMs) || (Date.now() - createdAtMs) > refundWindowMs) {
 req.session.error = 'İade tələbi yalnız ilk 5 gün ərzində mümkündür.';
 return res.redirect('/profile');
 }

 if ((topup.refund_status || 'none') !== 'none') {
 req.session.error = 'Bu ödəniş üçün iade tələbi artıq mövcuddur.';
 return res.redirect('/profile');
 }

 await db.execute('UPDATE balance_topups SET refund_status = ?, refund_requested_at = NOW() WHERE id = ? AND user_id = ?', ['pending', topupId, req.session.user.id]);

 const [users] = await db.execute('SELECT full_name, phone FROM users WHERE id = ? LIMIT 1', [req.session.user.id]);
 const user = users[0] || { full_name: 'İstifadəçi', phone: 'Yoxdur' };
 await notifyAllAdmins(`AZPINX: Yeni iade tələbi!\nİstifadəçi: ${user.full_name}\nNömrə: ${user.phone || 'Yoxdur'}\nTopup ID: #${topupId}\nMəbləğ: ${Number(topup.amount || 0).toFixed(2)} AZN`, 'refund');

 req.session.success = 'İadeniz işleme alınmıştır. Sizə müştəri dəstəyi geri dönüş yapacaktır.';
 return res.redirect('/profile');
 } catch (e) {
 console.error('Topup refund request error:', e.message);
 req.session.error = 'İade tələbi yaradılarkən xəta baş verdi.';
 return res.redirect('/profile');
 }
});

app.post('/profile/referral/claim', async (req, res) => {
 if (!req.session.user) return res.redirect('/login');

 try {
 const userId = req.session.user.id;
 const [users] = await db.execute('SELECT id, full_name, phone FROM users WHERE id = ? LIMIT 1', [userId]);
 if (!users.length) {
 req.session.error = 'İstifadəçi tapılmadı.';
 return res.redirect('/profile');
 }

 const referredCount = await getReferralCountForUser(userId);
 if (referredCount < REFERRAL_TARGET) {
 req.session.error = `Ödül üçün ən az ${REFERRAL_TARGET} təsdiqlənmiş dəvət lazımdır.`;
 return res.redirect('/profile');
 }

 const [pendingClaims] = await db.execute('SELECT id FROM referral_reward_requests WHERE user_id = ? AND status = "pending" LIMIT 1', [userId]);
 if (pendingClaims.length) {
 req.session.error = 'Artıq gözləyən bir ödül tələbiniz var.';
 return res.redirect('/profile');
 }

 await db.execute(
 'INSERT INTO referral_reward_requests (user_id, required_count, reward_label, status) VALUES (?, ?, ?, "pending")',
 [userId, REFERRAL_TARGET, REFERRAL_REWARD_LABEL]
 );

 const msg = `AZPINX: Referral ödül tələbi!\nİstifadəçi: ${users[0].full_name}\nTelefon: ${users[0].phone || 'Yoxdur'}\nDəvət: ${referredCount}/${REFERRAL_TARGET}\nÖdül: ${REFERRAL_REWARD_LABEL}`;
 await notifyAllAdmins(msg);

 req.session.success = 'Ödül tələbiniz qəbul edildi. Admin yoxlamasından sonra sizinlə əlaqə saxlanılacaq.';
 return res.redirect('/profile');
 } catch (e) {
 console.error('Referral claim error:', e.message);
 req.session.error = 'Ödül tələbi zamanı xəta baş verdi.';
 return res.redirect('/profile');
 }
});

app.get('/invite/:code', (req, res) => {
 const code = sanitizeReferralCode(req.params.code);
 if (!code) return res.redirect('/register');
 return res.redirect(`/register?ref=${encodeURIComponent(code)}`);
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
 const notifyMsg = `AZPINX: Yeni Dəstək Bileti!\nİstifadəçi: ${req.session.user.full_name}\nMövzu: ${subject}`;
 await notifyAllAdmins(notifyMsg, 'ticket');

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
 const notifyMsg = `AZPINX: Yeni Ticket Mesajı!\nİstifadəçi: ${req.session.user.full_name}\nBilet: ${tickets[0].subject}`;
 await notifyAllAdmins(notifyMsg, 'ticket');

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
 const [dailyOrders] = await db.execute('SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE()');
 const [dailyCompletedOrders] = await db.execute("SELECT COUNT(*) as count FROM orders WHERE status = 'completed' AND DATE(created_at) = CURDATE()");
 const [activeUsers] = await db.execute("SELECT COUNT(*) as count FROM users WHERE last_seen_at IS NOT NULL AND last_seen_at >= (NOW() - INTERVAL 5 MINUTE)");
 const [dailyAccess] = await db.execute('SELECT COUNT(*) as hits, COUNT(DISTINCT visitor_key) as visitors FROM site_access_logs WHERE DATE(created_at) = CURDATE()');
 const [pendingTopups] = await db.execute("SELECT COUNT(*) as count FROM balance_topups WHERE status = 'pending'");

 res.render('admin/dashboard', {
 title: 'Dashboard',
 stats: {
 totalOrders: Number(orders[0].count || 0),
 pendingOrders: Number(pending[0].count || 0),
 totalUsers: Number(users[0].count || 0),
 dailyOrders: Number(dailyOrders[0].count || 0),
 dailyCompletedOrders: Number(dailyCompletedOrders[0].count || 0),
 activeUsers: Number(activeUsers[0].count || 0),
 dailyAccessHits: Number(dailyAccess[0].hits || 0),
 dailyAccessVisitors: Number(dailyAccess[0].visitors || 0),
 pendingTopups: Number(pendingTopups[0].count || 0)
 }
 });
});

app.get('/admin/orders', isAdmin, async (req, res) => {
 const [orders] = await db.execute(`
 SELECT orders.*, users.email, users.full_name AS user_full_name, users.phone AS user_phone
 FROM orders
 JOIN users ON orders.user_id = users.id
 ORDER BY created_at DESC
 `);
 res.render('admin/orders', { title: 'Sifariş İdarəetməsi', orders });
});

app.get('/admin/orders/export', isAdmin, async (req, res) => {
 try {
 const scope = String(req.query.scope || 'all').toLowerCase();
 const selectedIds = String(req.query.ids || '')
 .split(',')
 .map((v) => Number(String(v || '').trim()))
 .filter((v) => Number.isInteger(v) && v > 0);

 let rows = [];
 if (scope === 'selected') {
 if (!selectedIds.length) {
 return res.redirect('/admin/orders?error=Export üçün sipariş seçilməyib');
 }
 const placeholders = selectedIds.map(() => '?').join(',');
 const [selectedRows] = await db.execute(
 `SELECT o.id, o.user_id, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone,
 o.product_name, o.amount, o.payment_method, o.sender_name, o.receipt_path, o.player_id, o.player_nickname,
 o.status, o.created_at
 FROM orders o
 LEFT JOIN users u ON u.id = o.user_id
 WHERE o.id IN (${placeholders})
 ORDER BY o.created_at DESC`,
 selectedIds
 );
 rows = selectedRows;
 } else {
 const [allRows] = await db.execute(
 `SELECT o.id, o.user_id, u.full_name AS user_full_name, u.email AS user_email, u.phone AS user_phone,
 o.product_name, o.amount, o.payment_method, o.sender_name, o.receipt_path, o.player_id, o.player_nickname,
 o.status, o.created_at
 FROM orders o
 LEFT JOIN users u ON u.id = o.user_id
 ORDER BY o.created_at DESC`
 );
 rows = allRows;
 }

 const statusLabelMap = {
 pending: 'Gözləyir',
 completed: 'Tamamlandı',
 cancelled: 'Ləğv edildi'
 };
 const paymentLabelMap = {
 Balance: 'Balans',
 'C2C Card Transfer': 'Kartdan köçürmə (C2C)'
 };

 const escapeCsv = (value) => {
 const normalized = value === null || value === undefined ? '' : String(value);
 if (/[;"\n]/.test(normalized)) {
 return `"${normalized.replace(/"/g, '""')}"`;
 }
 return normalized;
 };

 const headers = [
 'Sətir №',
 'Sifariş ID',
 'Sifariş tarixi',
 'Status',
 'Məbləğ (AZN)',
 'Ödəniş üsulu',
 'Məhsul',
 'Oyunçu ID',
 'Oyunçu Nickname',
 'Göndərən',
 'İstifadəçi ID',
 'İstifadəçi adı',
 'İstifadəçi email',
 'İstifadəçi telefon',
 'Dekont linki'
 ];

 const csvLines = [headers.join(';')];
 rows.forEach((row, idx) => {
 const statusLabel = statusLabelMap[String(row.status || '').toLowerCase()] || row.status || '';
 const paymentLabel = paymentLabelMap[String(row.payment_method || '')] || row.payment_method || '';
 const createdAtText = row.created_at
 ? new Date(row.created_at).toLocaleString('az-AZ', { hour12: false })
 : '';

 const lineValues = [
 idx + 1,
 row.id,
 createdAtText,
 statusLabel,
 Number(row.amount || 0).toFixed(2),
 paymentLabel,
 row.product_name,
 row.player_id,
 row.player_nickname,
 row.sender_name,
 row.user_id,
 row.user_full_name,
 row.user_email,
 row.user_phone,
 row.receipt_path
 ];
 csvLines.push(lineValues.map(escapeCsv).join(';'));
 });

 csvLines.push('');
 csvLines.push(`Export Scope;${scope === 'selected' ? 'Seçilən sifarişlər' : 'Bütün sifarişlər'}`);
 csvLines.push(`Sifariş sayı;${rows.length}`);
 csvLines.push(`Export tarixi;${new Date().toLocaleString('az-AZ', { hour12: false })}`);

 const nowStamp = new Date().toISOString().replace(/[:.]/g, '-');
 const fileName = scope === 'selected' ? `orders-selected-${nowStamp}.csv` : `orders-all-${nowStamp}.csv`;
 res.setHeader('Content-Type', 'text/csv; charset=utf-8');
 res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
 return res.send('\uFEFF' + csvLines.join('\n'));
 } catch (e) {
 console.error('Orders export error:', e.message);
 return res.redirect('/admin/orders?error=' + encodeURIComponent('CSV export xətası: ' + e.message));
 }
});

app.post('/admin/orders/:id/update', isAdmin, async (req, res) => {
 const { status } = req.body;
 await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
 req.session.success ="Sifariş statusu yeniləndi.";
 res.redirect('/admin/orders');
});

app.post('/admin/orders/:id/approve-notify', isAdmin, async (req, res) => {
 const orderId = Number(req.params.id);
 const adminMessage = normalizeOptionalString(req.body.admin_message);
 if (!orderId) {
 req.session.error = 'Yanlış sifariş ID.';
 return res.redirect('/admin/orders');
 }

 try {
 const [rows] = await db.execute(
 `SELECT o.*, u.full_name AS user_full_name, u.phone AS user_phone
 FROM orders o
 LEFT JOIN users u ON u.id = o.user_id
 WHERE o.id = ? LIMIT 1`,
 [orderId]
 );
 if (!rows.length) {
 req.session.error = 'Sifariş tapılmadı.';
 return res.redirect('/admin/orders');
 }
 const order = rows[0];
 await db.execute('UPDATE orders SET status = ? WHERE id = ?', ['completed', orderId]);

 if (normalizeOptionalString(order.user_phone)) {
 let msg = `AZPINX: Sifarişiniz təsdiqləndi!\nMəhsul: ${order.product_name}\nMəbləğ: ${Number(order.amount || 0).toFixed(2)} AZN`;
 if (adminMessage) msg += `\nMesaj: ${adminMessage}`;
 await sendSMS(order.user_phone, msg);
 }

 req.session.success = 'Sifariş tamamlandı və istifadəçiyə WhatsApp mesajı göndərildi.';
 return res.redirect('/admin/orders');
 } catch (e) {
 console.error('Admin approve notify error:', e.message);
 req.session.error = 'Sifariş təsdiqləmə/mesaj xətası.';
 return res.redirect('/admin/orders');
 }
});

app.get('/admin/topups', isAdmin, async (req, res) => {
 const status = normalizeOptionalString(req.query.status) || 'all';
 const [rows] = await db.execute(`
 SELECT bt.*, u.full_name, u.email, u.phone
 FROM balance_topups bt
 JOIN users u ON u.id = bt.user_id
 ORDER BY FIELD(bt.refund_status, 'pending', 'processed', 'rejected', 'none'), FIELD(bt.status, 'pending', 'approved', 'rejected'), bt.created_at DESC
 `);

 const topups = (status === 'all')
 ? rows
 : rows.filter((row) => row.status === status);

 res.render('admin/topups', {
 title: 'Balans Tələbləri',
 topups,
 filters: { status }
 });
});

app.post('/admin/topups/:id/refund-update', isAdmin, async (req, res) => {
 const topupId = Number(req.params.id);
 const nextRefundStatus = normalizeOptionalString(req.body.refund_status);
 const adminNote = normalizeOptionalString(req.body.admin_note);

 if (!['processed', 'rejected'].includes(nextRefundStatus)) {
 req.session.error = 'Yanlış iade statusu.';
 return res.redirect('/admin/topups');
 }

 try {
 const [rows] = await db.execute('SELECT id, user_id, refund_status FROM balance_topups WHERE id = ? LIMIT 1', [topupId]);
 if (!rows.length) {
 req.session.error = 'Topup tapılmadı.';
 return res.redirect('/admin/topups');
 }
 const topup = rows[0];
 if ((topup.refund_status || 'none') !== 'pending') {
 req.session.error = 'Bu iade tələbi artıq işlənib və ya aktiv deyil.';
 return res.redirect('/admin/topups');
 }

 await db.execute(
 'UPDATE balance_topups SET refund_status = ?, admin_note = ? WHERE id = ?',
 [nextRefundStatus, adminNote, topupId]
 );

 const [users] = await db.execute('SELECT phone FROM users WHERE id = ? LIMIT 1', [topup.user_id]);
 if (users.length && users[0].phone) {
 const userMsg = nextRefundStatus === 'processed'
 ? 'AZPINX: İade tələbiniz işləndi. Müştəri dəstəyi sizinlə əlaqə saxlayacaq.'
 : 'AZPINX: İade tələbiniz rədd edildi.';
 sendSMS(users[0].phone, userMsg);
 }

 req.session.success = nextRefundStatus === 'processed'
 ? 'İade tələbi işləndi olaraq qeyd edildi.'
 : 'İade tələbi rədd edildi.';
 return res.redirect('/admin/topups');
 } catch (e) {
 console.error('Admin refund update error:', e.message);
 req.session.error = 'İade statusu yenilənmədi.';
 return res.redirect('/admin/topups');
 }
});

app.post('/admin/topups/:id/update', isAdmin, async (req, res) => {
 const topupId = Number(req.params.id);
 const nextStatus = normalizeOptionalString(req.body.status);
 const adminNote = normalizeOptionalString(req.body.admin_note);

 if (!['approved', 'rejected'].includes(nextStatus)) {
 req.session.error = 'Yanlış status seçimi.';
 return res.redirect('/admin/topups');
 }

 try {
 await db.beginTransaction();
 const [rows] = await db.execute('SELECT * FROM balance_topups WHERE id = ? FOR UPDATE', [topupId]);
 if (!rows.length) {
 await db.rollback();
 req.session.error = 'Balans tələbi tapılmadı.';
 return res.redirect('/admin/topups');
 }

 const topup = rows[0];
 if (topup.status !== 'pending') {
 await db.rollback();
 req.session.error = 'Bu tələb artıq işlənib.';
 return res.redirect('/admin/topups');
 }

 if (nextStatus === 'approved') {
 await db.execute('UPDATE users SET balance = balance + ? WHERE id = ?', [topup.amount, topup.user_id]);
 }

 await db.execute(
 'UPDATE balance_topups SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
 [nextStatus, adminNote, req.session.user.id, topupId]
 );

 await db.commit();

 const [users] = await db.execute('SELECT phone FROM users WHERE id = ? LIMIT 1', [topup.user_id]);
 if (users.length && users[0].phone) {
 const userMsg = nextStatus === 'approved'
 ? `AZPINX: Balans artırma təsdiqləndi. Məbləğ: ${Number(topup.amount).toFixed(2)} AZN`
 : `AZPINX: Balans artırma tələbiniz rədd edildi.`;
 sendSMS(users[0].phone, userMsg);
 }

 req.session.success = nextStatus === 'approved'
 ? 'Balans artırma təsdiqləndi və istifadəçi balansına əlavə olundu.'
 : 'Balans artırma tələbi rədd edildi.';
 return res.redirect('/admin/topups');
 } catch (e) {
 await db.rollback();
 console.error('Admin topup update error:', e.message);
 req.session.error = 'Topup yenilənmə xətası.';
 return res.redirect('/admin/topups');
 }
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
 const [categories] = await db.execute('SELECT name FROM categories ORDER BY name ASC');
 res.render('admin/sliders', { title: 'Slayder (Banner) İdarəetməsi', sliders, categories });
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
 const { title, description } = req.body;
 console.log('Slider Create Request Body:', req.body);
 console.log('Uploaded File Information:', req.file);

 if (!req.file) {
 console.warn('Slider upload attempt without file.');
 return res.redirect('/admin/sliders?error=Şəkil seçilməyib və ya yüklənmədi');
 }

 const image_path = '/uploads/sliders/' + req.file.filename;
 console.log('Storing slider with image_path:', image_path);

 const resolvedLink = resolveSliderLink(req.body);
 await db.execute('INSERT INTO sliders (image_path, title, description, link) VALUES (?, ?, ?, ?)',
 [image_path, title || '', description || '', resolvedLink || '#']);

 console.log('Slider successfully inserted into database.');
 res.redirect('/admin/sliders?success=Slayder əlavə edildi');
 } catch (e) {
 console.error('Database Error during slider creation:', e);
 res.redirect('/admin/sliders?error=Bazaya yazılma xətası: ' + encodeURIComponent(e.message));
 }
});

// Admin Slider Update
app.post('/admin/sliders/update', isAdmin, uploadSlider.single('image'), async (req, res) => {
 try {
 const id = Number(req.body.id);
 if (!id) return res.redirect('/admin/sliders?error=Yanlış ID');

 const title = normalizeOptionalString(req.body.title) || '';
 const description = normalizeOptionalString(req.body.description) || '';
 const link = resolveSliderLink(req.body) || '#';
 const imagePath = req.file ? '/uploads/sliders/' + req.file.filename : null;

 let sql = 'UPDATE sliders SET title = ?, description = ?, link = ?';
 const params = [title, description, link];
 if (imagePath) {
 sql += ', image_path = ?';
 params.push(imagePath);
 }
 sql += ' WHERE id = ?';
 params.push(id);

 await db.execute(sql, params);
 return res.redirect('/admin/sliders?success=Slayder yeniləndi');
 } catch (e) {
 console.error('Slider update error:', e.message);
 return res.redirect('/admin/sliders?error=' + encodeURIComponent(e.message));
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
 let products = await getMappedProducts();
 products = products.filter((p) => p.status === 'sale' && p.is_active);
 const sectionRows = sections.map((section) => ({
 ...section,
 productRefs: parseSectionProductRefs(section.product_ids)
 }));
 res.render('admin/home_sections', { title: 'Ana Səhifə Bölmələri', sections: sectionRows, categories, products });
 } catch (e) {
 res.redirect('/admin?error=' + encodeURIComponent(e.message));
 }
});

// Admin Bank Settings
app.get('/admin/settings', isAdmin, async (req, res) => {
 const [settings] = await db.execute('SELECT * FROM settings');
 const [admins] = await db.execute('SELECT id, full_name, phone FROM users WHERE role = "admin" ORDER BY full_name ASC');
 const settingsMap = {};
 settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);
 res.render('admin/settings', { title: 'Banka, SEO, Footer və WhatsApp Ayarları', settings: settingsMap, admins });
});

app.post('/admin/settings', isAdmin, async (req, res) => {
 const {
 bank_card,
 bank_name,
 bank_holder,
 reseller_discount_percent,
 seo_meta_title,
 seo_meta_description,
 seo_meta_keywords,
 seo_robots,
 footer_about_text,
 footer_trust_1,
 footer_trust_2,
 footer_quick_title,
 footer_quick_1_label,
 footer_quick_1_url,
 footer_quick_2_label,
 footer_quick_2_url,
 footer_quick_3_label,
 footer_quick_3_url,
 footer_account_title,
 footer_account_1_label,
 footer_account_1_url,
 footer_account_2_label,
 footer_account_2_url,
 footer_account_3_label,
 footer_account_3_url,
 footer_contact_title,
 footer_whatsapp_label,
 footer_whatsapp_value,
 footer_email_label,
 footer_email_value,
 footer_bottom_text,
 footer_payment_text,
 admin_whatsapp_enabled,
 admin_whatsapp_admin_ids,
 admin_whatsapp_events
 } = req.body;
 try {
 const [existingSettingsRows] = await db.execute('SELECT setting_key, setting_value FROM settings');
 const existingSettings = {};
 existingSettingsRows.forEach((row) => { existingSettings[row.setting_key] = row.setting_value; });

 const keep = (key, incoming, fallback = '') => {
 if (incoming === undefined || incoming === null || incoming === '') return existingSettings[key] ?? fallback;
 return incoming;
 };

 const hasAdminIdsInput = admin_whatsapp_admin_ids !== undefined;
 const hasEventsInput = admin_whatsapp_events !== undefined;
 const hasEnabledInput = admin_whatsapp_enabled !== undefined;

 const selectedAdminIds = Array.isArray(admin_whatsapp_admin_ids)
 ? admin_whatsapp_admin_ids
 : (admin_whatsapp_admin_ids ? [admin_whatsapp_admin_ids] : []);
 const normalizedAdminIds = [...new Set(selectedAdminIds
 .map((value) => Number(String(value || '').trim()))
 .filter((value) => Number.isInteger(value) && value > 0))];

 const selectedEvents = Array.isArray(admin_whatsapp_events)
 ? admin_whatsapp_events
 : (admin_whatsapp_events ? [admin_whatsapp_events] : []);
 const allowedEventKeys = ['order', 'ticket', 'refund', 'topup', 'all'];
 const normalizedEvents = [...new Set(selectedEvents
 .map((value) => String(value || '').trim().toLowerCase())
 .filter((value) => allowedEventKeys.includes(value)))];

 const updates = [
 { key: 'bank_card', value: keep('bank_card', bank_card, '') },
 { key: 'bank_name', value: keep('bank_name', bank_name, '') },
 { key: 'bank_holder', value: keep('bank_holder', bank_holder, '') },
 { key: 'reseller_discount_percent', value: String(clampPercent(keep('reseller_discount_percent', reseller_discount_percent, '8'), 0, 90)) },
 { key: 'seo_meta_title', value: keep('seo_meta_title', normalizeOptionalString(seo_meta_title), '') },
 { key: 'seo_meta_description', value: keep('seo_meta_description', normalizeOptionalString(seo_meta_description), '') },
 { key: 'seo_meta_keywords', value: keep('seo_meta_keywords', normalizeOptionalString(seo_meta_keywords), '') },
 { key: 'seo_robots', value: ['index,follow', 'noindex,nofollow'].includes(String(keep('seo_robots', seo_robots, 'index,follow'))) ? String(keep('seo_robots', seo_robots, 'index,follow')) : 'index,follow' },
 { key: 'footer_about_text', value: keep('footer_about_text', normalizeOptionalString(footer_about_text), '') },
 { key: 'footer_trust_1', value: keep('footer_trust_1', normalizeOptionalString(footer_trust_1), '') },
 { key: 'footer_trust_2', value: keep('footer_trust_2', normalizeOptionalString(footer_trust_2), '') },
 { key: 'footer_quick_title', value: keep('footer_quick_title', normalizeOptionalString(footer_quick_title), '') },
 { key: 'footer_quick_1_label', value: keep('footer_quick_1_label', normalizeOptionalString(footer_quick_1_label), '') },
 { key: 'footer_quick_1_url', value: keep('footer_quick_1_url', normalizeFooterLink(footer_quick_1_url, '/'), '/') },
 { key: 'footer_quick_2_label', value: keep('footer_quick_2_label', normalizeOptionalString(footer_quick_2_label), '') },
 { key: 'footer_quick_2_url', value: keep('footer_quick_2_url', normalizeFooterLink(footer_quick_2_url, '/faq'), '/faq') },
 { key: 'footer_quick_3_label', value: keep('footer_quick_3_label', normalizeOptionalString(footer_quick_3_label), '') },
 { key: 'footer_quick_3_url', value: keep('footer_quick_3_url', normalizeFooterLink(footer_quick_3_url, '/terms'), '/terms') },
 { key: 'footer_account_title', value: keep('footer_account_title', normalizeOptionalString(footer_account_title), '') },
 { key: 'footer_account_1_label', value: keep('footer_account_1_label', normalizeOptionalString(footer_account_1_label), '') },
 { key: 'footer_account_1_url', value: keep('footer_account_1_url', normalizeFooterLink(footer_account_1_url, '/profile'), '/profile') },
 { key: 'footer_account_2_label', value: keep('footer_account_2_label', normalizeOptionalString(footer_account_2_label), '') },
 { key: 'footer_account_2_url', value: keep('footer_account_2_url', normalizeFooterLink(footer_account_2_url, '/tickets'), '/tickets') },
 { key: 'footer_account_3_label', value: keep('footer_account_3_label', normalizeOptionalString(footer_account_3_label), '') },
 { key: 'footer_account_3_url', value: keep('footer_account_3_url', normalizeFooterLink(footer_account_3_url, '/wishlist'), '/wishlist') },
 { key: 'footer_contact_title', value: keep('footer_contact_title', normalizeOptionalString(footer_contact_title), '') },
 { key: 'footer_whatsapp_label', value: keep('footer_whatsapp_label', normalizeOptionalString(footer_whatsapp_label), '') },
 { key: 'footer_whatsapp_value', value: keep('footer_whatsapp_value', normalizeOptionalString(footer_whatsapp_value), '') },
 { key: 'footer_email_label', value: keep('footer_email_label', normalizeOptionalString(footer_email_label), '') },
 { key: 'footer_email_value', value: keep('footer_email_value', normalizeOptionalString(footer_email_value), '') },
 { key: 'footer_bottom_text', value: keep('footer_bottom_text', normalizeOptionalString(footer_bottom_text), '') },
 { key: 'footer_payment_text', value: keep('footer_payment_text', normalizeOptionalString(footer_payment_text), '') },
 { key: 'admin_whatsapp_enabled', value: keep('admin_whatsapp_enabled', hasEnabledInput ? (admin_whatsapp_enabled ? '1' : '0') : undefined, '1') },
 { key: 'admin_whatsapp_admin_ids', value: keep('admin_whatsapp_admin_ids', hasAdminIdsInput ? normalizedAdminIds.join(',') : undefined, '') },
 { key: 'admin_whatsapp_events', value: keep('admin_whatsapp_events', hasEventsInput ? normalizedEvents.join(',') : undefined, 'order,ticket,refund,topup') }
 ];

 for (const s of updates) {
 await db.execute(
 'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
 [s.key, s.value]
 );
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
 const productRefs = parseSectionProductRefs(req.body.product_refs);
 const isActive = req.body.is_active ? 1 : 0;
 await db.execute('INSERT INTO home_sections (title, category_id, product_ids, order_index, is_active) VALUES (?, ?, ?, ?, ?)',
 [normalizeOptionalString(title), category_id || null, productRefs.join(','), Number(order_index || 0), isActive]);
 res.redirect('/admin/home-sections?success=Bölmə yaradıldı');
 } catch (e) {
 res.redirect('/admin/home-sections?error=' + encodeURIComponent(e.message));
 }
});

app.post('/admin/home-sections/update', isAdmin, async (req, res) => {
 const { id, title, category_id, order_index } = req.body;
 try {
 const sectionId = Number(id);
 if (!sectionId) return res.redirect('/admin/home-sections?error=Yanlış ID');
 const productRefs = parseSectionProductRefs(req.body.product_refs);
 const isActive = req.body.is_active ? 1 : 0;
 await db.execute(
 'UPDATE home_sections SET title = ?, category_id = ?, product_ids = ?, order_index = ?, is_active = ? WHERE id = ?',
 [normalizeOptionalString(title), category_id || null, productRefs.join(','), Number(order_index || 0), isActive, sectionId]
 );
 return res.redirect('/admin/home-sections?success=Bölmə yeniləndi');
 } catch (e) {
 return res.redirect('/admin/home-sections?error=' + encodeURIComponent(e.message));
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
