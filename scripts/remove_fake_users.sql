-- AZPINX fake user cleanup
-- Run manually on production DB after taking a backup.
-- Target profile:
-- 1) role=user
-- 2) registration_ip is NULL (open seed endpoint did not set it)
-- 3) email format similar to generated seed gmail pattern
-- 4) optional seeded bio text

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_fake_users (id INT PRIMARY KEY);

INSERT INTO tmp_fake_users (id)
SELECT u.id
FROM users u
WHERE u.role = 'user'
  AND u.registration_ip IS NULL
  AND u.email REGEXP '^[a-z0-9]+\\.[a-z0-9]+\\.[0-9]{12,}[0-9]{4,}@gmail\\.com$'
  AND (
    u.public_bio IS NULL OR u.public_bio IN (
      'PUBG və rəqəmsal məhsullar həvəskarı.',
      'Gündəlik oyun alışlarını AZPINX ilə edirəm.',
      'Oyun hesabımı inkişaf etdirməyi sevirəm.',
      'Mobil oyunlara marağım böyükdür.',
      'Sürətli və təhlükəsiz alış üçün buradayam.'
    )
  );

-- Preview count before deletion
SELECT COUNT(*) AS fake_user_count FROM tmp_fake_users;

-- Preview rows before deletion
SELECT id, full_name, email, created_at
FROM users
WHERE id IN (SELECT id FROM tmp_fake_users)
ORDER BY id DESC
LIMIT 200;

-- Delete dependent rows first
DELETE FROM ticket_messages
WHERE sender_id IN (SELECT id FROM tmp_fake_users)
   OR ticket_id IN (SELECT id FROM tickets WHERE user_id IN (SELECT id FROM tmp_fake_users));

DELETE FROM order_reviews
WHERE user_id IN (SELECT id FROM tmp_fake_users)
   OR order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM tmp_fake_users));

DELETE FROM tickets WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM orders WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM balance_topups WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM wishlist WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM referral_reward_requests WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM site_access_logs WHERE user_id IN (SELECT id FROM tmp_fake_users);
DELETE FROM user_avatars WHERE user_id IN (SELECT id FROM tmp_fake_users);

-- Null out referrals that point to deleted users
UPDATE users
SET referred_by = NULL
WHERE referred_by IN (SELECT id FROM tmp_fake_users);

-- Finally delete users
DELETE FROM users WHERE id IN (SELECT id FROM tmp_fake_users);

-- Post-check
SELECT ROW_COUNT() AS deleted_users;

COMMIT;
