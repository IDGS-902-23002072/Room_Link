UPDATE `compat_dimension_weights`
SET `weight` = CASE `dimension`
  WHEN 'schedule' THEN 2.00
  WHEN 'cleanliness' THEN 3.00
  WHEN 'noise' THEN 3.00
  WHEN 'pets' THEN 2.00
  WHEN 'smoking' THEN 3.00
  WHEN 'visits' THEN 2.00
  WHEN 'gender_pref' THEN 1.00
END;
--> statement-breakpoint
DELETE FROM `match_affinity_scores`;
