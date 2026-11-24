CREATE OR REPLACE VIEW `v_room_card` AS
SELECT
  l.`id`,
  l.`title`,
  l.`monthly_rent`,
  l.`available_from`,
  z.`name` AS `zone`,
  g.`latitude`,
  g.`longitude`,
  CASE WHEN EXISTS (
    SELECT 1 FROM `room_photos` rp WHERE rp.`listing_id` = l.`id`
  ) THEN CONCAT('/api/v1/rooms/', l.`id`, '/photos/first') END AS `main_photo`,
  l.`host_id`
FROM `room_listings` l
LEFT JOIN `geo_locations` g ON g.`id` = l.`location_id`
LEFT JOIN `geo_zones` z ON z.`id` = g.`zone_id`
WHERE l.`status` = 'published';
