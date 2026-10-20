INSERT INTO `compat_dimension_weights` (`dimension`, `weight`) VALUES
  ('schedule', 1.00),
  ('cleanliness', 1.50),
  ('noise', 1.50),
  ('pets', 1.00),
  ('smoking', 1.50),
  ('visits', 1.00),
  ('gender_pref', 0.50);
--> statement-breakpoint
CREATE TRIGGER `trg_profile_minimum_age_insert`
BEFORE INSERT ON `profile_profiles`
FOR EACH ROW
BEGIN
  IF NEW.`birth_date` > DATE_SUB(CURRENT_DATE(), INTERVAL 18 YEAR) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El usuario debe tener al menos 18 años';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_profile_minimum_age_update`
BEFORE UPDATE ON `profile_profiles`
FOR EACH ROW
BEGIN
  IF NEW.`birth_date` > DATE_SUB(CURRENT_DATE(), INTERVAL 18 YEAR) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El usuario debe tener al menos 18 años';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_room_publish_rules`
BEFORE UPDATE ON `room_listings`
FOR EACH ROW
BEGIN
  IF NEW.`status` = 'published' AND OLD.`status` <> 'published' THEN
    IF (SELECT COUNT(*) FROM `room_photos` WHERE `listing_id` = NEW.`id`) < 3 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Una habitación necesita al menos 3 fotos para publicarse';
    END IF;
    SET NEW.`published_at` = COALESCE(NEW.`published_at`, CURRENT_TIMESTAMP(6));
  END IF;

  IF NEW.`status` = 'closed' AND OLD.`status` <> 'closed' THEN
    SET NEW.`closed_at` = CURRENT_TIMESTAMP(6);
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_app_insert_rules`
BEFORE INSERT ON `app_applications`
FOR EACH ROW
BEGIN
  DECLARE listing_status VARCHAR(20);
  DECLARE listing_host CHAR(36);

  SELECT `status`, `host_id`
    INTO listing_status, listing_host
    FROM `room_listings`
    WHERE `id` = NEW.`listing_id`;

  IF listing_status IS NULL OR listing_status <> 'published' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Solo se puede postular a anuncios publicados';
  END IF;

  IF NEW.`applicant_id` = listing_host THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No puedes postularte a tu propio anuncio';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_conn_active_pair_insert`
BEFORE INSERT ON `conn_connections`
FOR EACH ROW
BEGIN
  IF NEW.`status` IN ('pending', 'accepted') THEN
    SET NEW.`active_pair_low` = LEAST(NEW.`requester_id`, NEW.`addressee_id`);
    SET NEW.`active_pair_high` = GREATEST(NEW.`requester_id`, NEW.`addressee_id`);
  ELSE
    SET NEW.`active_pair_low` = NULL;
    SET NEW.`active_pair_high` = NULL;
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER `trg_conn_active_pair_update`
BEFORE UPDATE ON `conn_connections`
FOR EACH ROW
BEGIN
  IF NEW.`status` IN ('pending', 'accepted') THEN
    SET NEW.`active_pair_low` = LEAST(NEW.`requester_id`, NEW.`addressee_id`);
    SET NEW.`active_pair_high` = GREATEST(NEW.`requester_id`, NEW.`addressee_id`);
  ELSE
    SET NEW.`active_pair_low` = NULL;
    SET NEW.`active_pair_high` = NULL;
  END IF;
END;
--> statement-breakpoint
CREATE VIEW `v_profile_card` AS
SELECT
  p.`user_id`,
  p.`full_name`,
  TIMESTAMPDIFF(YEAR, p.`birth_date`, CURRENT_DATE()) AS `age`,
  ph.`url` AS `main_photo`,
  z.`name` AS `desired_zone`,
  hp.`budget_min`,
  hp.`budget_max`,
  (p.`identity_status` = 'verified') AS `is_verified`
FROM `profile_profiles` p
JOIN `auth_users` u
  ON u.`id` = p.`user_id` AND u.`status` = 'active'
LEFT JOIN `profile_photos` ph
  ON ph.`user_id` = p.`user_id` AND ph.`position` = 1
LEFT JOIN `profile_housing_preferences` hp
  ON hp.`user_id` = p.`user_id`
LEFT JOIN `geo_zones` z
  ON z.`id` = hp.`desired_zone_id`;
--> statement-breakpoint
CREATE VIEW `v_room_card` AS
SELECT
  l.`id`,
  l.`title`,
  l.`monthly_rent`,
  l.`available_from`,
  z.`name` AS `zone`,
  g.`latitude`,
  g.`longitude`,
  (
    SELECT rp.`url`
    FROM `room_photos` rp
    WHERE rp.`listing_id` = l.`id`
    ORDER BY rp.`position`
    LIMIT 1
  ) AS `main_photo`,
  l.`host_id`
FROM `room_listings` l
LEFT JOIN `geo_locations` g ON g.`id` = l.`location_id`
LEFT JOIN `geo_zones` z ON z.`id` = g.`zone_id`
WHERE l.`status` = 'published';
--> statement-breakpoint
CREATE VIEW `v_accepted_connections` AS
SELECT
  `id`,
  `requester_id` AS `user_id`,
  `addressee_id` AS `other_user_id`
FROM `conn_connections`
WHERE `status` = 'accepted'
UNION ALL
SELECT
  `id`,
  `addressee_id` AS `user_id`,
  `requester_id` AS `other_user_id`
FROM `conn_connections`
WHERE `status` = 'accepted';
--> statement-breakpoint
CREATE VIEW `v_kpis_now` AS
SELECT
  (SELECT COUNT(*) FROM `auth_users` WHERE `status` = 'active') AS `active_users`,
  (SELECT COUNT(*) FROM `room_listings` WHERE `status` = 'published') AS `active_listings`,
  (SELECT COUNT(*) FROM `conn_connections` WHERE `status` = 'accepted') AS `accepted_connections`,
  (
    SELECT ROUND(AVG(TIMESTAMPDIFF(SECOND, `published_at`, `closed_at`) / 86400), 2)
    FROM `room_listings`
    WHERE `status` = 'closed' AND `published_at` IS NOT NULL
  ) AS `avg_days_to_close`;
