# AZPINX - E-pin Satış Sistemi (v2)

Bu layihə AZPINX platformasının modernləşdirilmiş, Docker-ə uyğunlaşdırılmış və "Self-Healing" (özünü bərpa edən) bazası sistemi ilə təchiz edilmiş versiyasıdır.

## 🚀 Xüsusiyyətlər
- **Docker Ready**: Traefik və Portainer ilə problemsiz inteqrasiya.
- **Self-Healing Database**: Sayt hər dəfə işə düşəndə bütün cədvəllər yoxlanılır və çatışmayan hər şey (10+ cədvəl) avtomatik yaradılır.
- **Admin Panel**: Məhsulların, kateqoriyaların, elanların və sifarişlərin idarə edilməsi.
- **Dual Payment**: ABB BANK (Card Transfer) və Daxili Balans ilə ödəniş.
- **Multi-Domain**: Traefik vasitəsilə `azpinx.com`, `www.azpinx.com` və `azpinx.octotech.az` dəstəyi.
- **Security**: 2FA (OTP via HubMSG SMS), sessiya idarəçiliyi və şifrələnmiş admin girişi.

## 📦 Quraşdırılma (Docker)

1. Repozitoriyanı klonlayın:
   ```bash
   git clone https://github.com/aliyabuz25/AZPINX.git
   ```
2. Portainer-də yeni stack yaradın və `docker-compose.yml` məzmununu əlavə edin.
3. Ətraf mühit dəyişənlərini (Environment Variables) təyin edin:
   - `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `SESSION_SECRET` və s.
4. Stack-i başladın. Sistem avtomatik olaraq imici build edəcək və bazanı quracaq.

## 🔐 İlkin Giriş Məlumatları
Əgər bazada heç bir admin yoxdursa, sistem avtomatik olaraq bu giriş məlumatlarını yaradacaq:
- **Email**: `admin@azpinx.com`
- **Şifrə**: `admin123`

## 🛠 Texnologiyalar
- **Backend**: Node.js, Express
- **Database**: MySQL 8.0
- **Frontend**: EJS Templates, AdminLTE, Bootstrap 5
- **Infrastructure**: Docker, Docker Compose, Traefik

---
Developed for **AZPINX**. 🇦🇿
