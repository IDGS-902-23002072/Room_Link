CREATE TABLE `auth_login_attempts` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`email` varchar(254) NOT NULL,
	`user_id` char(36),
	`success` boolean NOT NULL,
	`ip_address` varchar(45),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_login_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_oauth_identities` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`provider` enum('google') NOT NULL,
	`provider_user_id` varchar(255) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_oauth_identities_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_oauth_provider_identity` UNIQUE(`provider`,`provider_user_id`),
	CONSTRAINT `uq_auth_oauth_user_provider` UNIQUE(`user_id`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `auth_password_reset_tokens` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp(6) NOT NULL,
	`used_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_password_reset_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_reset_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`user_agent` varchar(500),
	`ip_address` varchar(45),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`expires_at` timestamp(6) NOT NULL,
	`revoked_at` timestamp(6),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_sessions_token_hash` UNIQUE(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `auth_user_roles` (
	`user_id` char(36) NOT NULL,
	`role` enum('seeker','host','admin') NOT NULL,
	CONSTRAINT `auth_user_roles_user_id_role_pk` PRIMARY KEY(`user_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `auth_users` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255),
	`status` enum('active','suspended','banned','deleted') NOT NULL DEFAULT 'active',
	`email_verified_at` timestamp(6),
	`terms_accepted_at` timestamp(6) NOT NULL,
	`failed_login_attempts` smallint unsigned NOT NULL DEFAULT 0,
	`locked_until` timestamp(6),
	`last_login_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `auth_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_auth_users_email` UNIQUE(`email`),
	CONSTRAINT `chk_auth_users_credential` CHECK(`auth_users`.`password_hash` IS NOT NULL OR `auth_users`.`email_verified_at` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `compat_dimension_weights` (
	`dimension` enum('schedule','cleanliness','noise','pets','smoking','visits','gender_pref') NOT NULL,
	`weight` decimal(4,2) NOT NULL,
	CONSTRAINT `compat_dimension_weights_dimension` PRIMARY KEY(`dimension`),
	CONSTRAINT `chk_compat_weight_positive` CHECK(`compat_dimension_weights`.`weight` > 0)
);
--> statement-breakpoint
CREATE TABLE `compat_profiles` (
	`user_id` char(36) NOT NULL,
	`schedule` smallint unsigned NOT NULL,
	`cleanliness` smallint unsigned NOT NULL,
	`noise` smallint unsigned NOT NULL,
	`pets` smallint unsigned NOT NULL,
	`smoking` smallint unsigned NOT NULL,
	`visits` smallint unsigned NOT NULL,
	`gender_pref` smallint unsigned NOT NULL,
	`completed_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `compat_profiles_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `chk_compat_schedule` CHECK(`compat_profiles`.`schedule` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_cleanliness` CHECK(`compat_profiles`.`cleanliness` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_noise` CHECK(`compat_profiles`.`noise` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_pets` CHECK(`compat_profiles`.`pets` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_smoking` CHECK(`compat_profiles`.`smoking` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_visits` CHECK(`compat_profiles`.`visits` BETWEEN 1 AND 5),
	CONSTRAINT `chk_compat_gender_pref` CHECK(`compat_profiles`.`gender_pref` BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE TABLE `match_affinity_scores` (
	`user_a` char(36) NOT NULL,
	`user_b` char(36) NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`computed_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `match_affinity_scores_user_a_user_b_pk` PRIMARY KEY(`user_a`,`user_b`),
	CONSTRAINT `chk_match_distinct_users` CHECK(`match_affinity_scores`.`user_a` <> `match_affinity_scores`.`user_b`),
	CONSTRAINT `chk_match_score` CHECK(`match_affinity_scores`.`score` BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `match_saved_profiles` (
	`user_id` char(36) NOT NULL,
	`candidate_id` char(36) NOT NULL,
	`status` enum('saved','discarded') NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `match_saved_profiles_user_id_candidate_id_pk` PRIMARY KEY(`user_id`,`candidate_id`),
	CONSTRAINT `chk_saved_profile_distinct_users` CHECK(`match_saved_profiles`.`user_id` <> `match_saved_profiles`.`candidate_id`)
);
--> statement-breakpoint
CREATE TABLE `search_saved_searches` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`name` varchar(160) NOT NULL,
	`filters` json NOT NULL DEFAULT (JSON_OBJECT()),
	`is_favorite` boolean NOT NULL DEFAULT false,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `search_saved_searches_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_search_saved_name` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `core_outbox_events` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`event_type` varchar(120) NOT NULL,
	`aggregate_id` char(36),
	`payload` json NOT NULL DEFAULT (JSON_OBJECT()),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`processed_at` timestamp(6),
	CONSTRAINT `core_outbox_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `geo_locations` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`zone_id` char(36),
	`address` varchar(500) NOT NULL,
	`postal_code` varchar(20),
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `geo_locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_geo_latitude` CHECK(`geo_locations`.`latitude` BETWEEN -90 AND 90),
	CONSTRAINT `chk_geo_longitude` CHECK(`geo_locations`.`longitude` BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE `geo_points_of_interest` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(200) NOT NULL,
	`category` varchar(100) NOT NULL,
	`latitude` decimal(9,6) NOT NULL,
	`longitude` decimal(9,6) NOT NULL,
	CONSTRAINT `geo_points_of_interest_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_geo_poi_latitude` CHECK(`geo_points_of_interest`.`latitude` BETWEEN -90 AND 90),
	CONSTRAINT `chk_geo_poi_longitude` CHECK(`geo_points_of_interest`.`longitude` BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE TABLE `geo_zones` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`name` varchar(160) NOT NULL,
	`city` varchar(160) NOT NULL,
	`state` varchar(160) NOT NULL DEFAULT 'Guanajuato',
	CONSTRAINT `geo_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_geo_zone_name_city_state` UNIQUE(`name`,`city`,`state`)
);
--> statement-breakpoint
CREATE TABLE `agreement_acceptances` (
	`agreement_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`accepted_at` timestamp(6),
	CONSTRAINT `agreement_acceptances_agreement_id_user_id_pk` PRIMARY KEY(`agreement_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `agreement_agreements` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`listing_id` char(36) NOT NULL,
	`rules_snapshot` json NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `agreement_agreements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_daily_metrics` (
	`metric_date` date NOT NULL,
	`users_registered` int unsigned NOT NULL DEFAULT 0,
	`active_listings` int unsigned NOT NULL DEFAULT 0,
	`connections_sent` int unsigned NOT NULL DEFAULT 0,
	`connections_accepted` int unsigned NOT NULL DEFAULT 0,
	`listings_closed` int unsigned NOT NULL DEFAULT 0,
	`avg_days_to_close` decimal(6,2),
	`avg_affinity_score` decimal(5,2),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_daily_metrics_metric_date` PRIMARY KEY(`metric_date`)
);
--> statement-breakpoint
CREATE TABLE `mod_activity_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`user_id` char(36),
	`action` varchar(160) NOT NULL,
	`metadata` json NOT NULL DEFAULT (JSON_OBJECT()),
	`ip_address` varchar(45),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `mod_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mod_listing_reviews` (
	`listing_id` char(36) NOT NULL,
	`status` enum('pending','approved','rejected','removed') NOT NULL DEFAULT 'pending',
	`reviewer_id` char(36),
	`reason` text,
	`reviewed_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `mod_listing_reviews_listing_id` PRIMARY KEY(`listing_id`)
);
--> statement-breakpoint
CREATE TABLE `mod_reports` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`reporter_id` char(36) NOT NULL,
	`target_type` enum('user','message','listing') NOT NULL,
	`target_user_id` char(36),
	`target_listing_id` char(36),
	`target_message_id` bigint unsigned,
	`reason` enum('fraud','harassment','spam','inappropriate','fake_profile','other') NOT NULL,
	`description` text,
	`status` enum('open','in_review','resolved','dismissed') NOT NULL DEFAULT 'open',
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`resolved_at` timestamp(6),
	CONSTRAINT `mod_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_report_target` CHECK((`mod_reports`.`target_type` = 'user' AND `mod_reports`.`target_user_id` IS NOT NULL) OR (`mod_reports`.`target_type` = 'listing' AND `mod_reports`.`target_listing_id` IS NOT NULL) OR (`mod_reports`.`target_type` = 'message' AND `mod_reports`.`target_message_id` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `mod_sanctions` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`report_id` char(36),
	`admin_id` char(36) NOT NULL,
	`user_id` char(36),
	`listing_id` char(36),
	`type` enum('warning','temporary_suspension','permanent_ban','listing_removed','dismissed') NOT NULL,
	`reason` text NOT NULL,
	`expires_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `mod_sanctions_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_sanction_target` CHECK(`mod_sanctions`.`user_id` IS NOT NULL OR `mod_sanctions`.`listing_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `notif_notifications` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`type` enum('application_status_changed','connection_request','connection_accepted','new_message','agreement_pending','listing_moderated','account_sanction','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`body` text,
	`payload` json NOT NULL DEFAULT (JSON_OBJECT()),
	`email_sent_at` timestamp(6),
	`read_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `notif_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notif_preferences` (
	`user_id` char(36) NOT NULL,
	`type` enum('application_status_changed','connection_request','connection_accepted','new_message','agreement_pending','listing_moderated','account_sanction','system') NOT NULL,
	`in_app` boolean NOT NULL DEFAULT true,
	`email` boolean NOT NULL DEFAULT true,
	CONSTRAINT `notif_preferences_user_id_type_pk` PRIMARY KEY(`user_id`,`type`)
);
--> statement-breakpoint
CREATE TABLE `profile_contact_privacy` (
	`user_id` char(36) NOT NULL,
	`show_phone_to_connections` boolean NOT NULL DEFAULT true,
	`show_email_to_connections` boolean NOT NULL DEFAULT true,
	`show_socials_to_connections` boolean NOT NULL DEFAULT true,
	CONSTRAINT `profile_contact_privacy_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `profile_housing_preferences` (
	`user_id` char(36) NOT NULL,
	`seeking` enum('room','roommate','both') NOT NULL DEFAULT 'both',
	`budget_min` decimal(10,2),
	`budget_max` decimal(10,2),
	`desired_zone_id` char(36),
	`move_in_date` date,
	`min_age_pref` smallint unsigned,
	`max_age_pref` smallint unsigned,
	CONSTRAINT `profile_housing_preferences_user_id` PRIMARY KEY(`user_id`),
	CONSTRAINT `chk_profile_budget_min` CHECK(`profile_housing_preferences`.`budget_min` IS NULL OR `profile_housing_preferences`.`budget_min` >= 0),
	CONSTRAINT `chk_profile_budget_max` CHECK(`profile_housing_preferences`.`budget_max` IS NULL OR `profile_housing_preferences`.`budget_max` >= 0),
	CONSTRAINT `chk_profile_budget_range` CHECK(`profile_housing_preferences`.`budget_max` IS NULL OR `profile_housing_preferences`.`budget_min` IS NULL OR `profile_housing_preferences`.`budget_max` >= `profile_housing_preferences`.`budget_min`),
	CONSTRAINT `chk_profile_min_age` CHECK(`profile_housing_preferences`.`min_age_pref` IS NULL OR `profile_housing_preferences`.`min_age_pref` >= 18),
	CONSTRAINT `chk_profile_age_range` CHECK(`profile_housing_preferences`.`max_age_pref` IS NULL OR `profile_housing_preferences`.`min_age_pref` IS NULL OR `profile_housing_preferences`.`max_age_pref` >= `profile_housing_preferences`.`min_age_pref`)
);
--> statement-breakpoint
CREATE TABLE `profile_photos` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`user_id` char(36) NOT NULL,
	`url` text NOT NULL,
	`position` smallint unsigned NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `profile_photos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_profile_photo_position` UNIQUE(`user_id`,`position`),
	CONSTRAINT `chk_profile_photo_position` CHECK(`profile_photos`.`position` BETWEEN 1 AND 6)
);
--> statement-breakpoint
CREATE TABLE `profile_profiles` (
	`user_id` char(36) NOT NULL,
	`full_name` varchar(200) NOT NULL,
	`birth_date` date NOT NULL,
	`occupation` varchar(160),
	`bio` varchar(300),
	`phone` varchar(30),
	`instagram` varchar(255),
	`facebook` varchar(255),
	`identity_status` enum('unverified','pending','verified','rejected') NOT NULL DEFAULT 'unverified',
	`identity_verified_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profile_profiles_user_id` PRIMARY KEY(`user_id`)
);
--> statement-breakpoint
CREATE TABLE `room_cost_items` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`listing_id` char(36) NOT NULL,
	`kind` enum('rent','service','deposit','maintenance','other') NOT NULL,
	`concept` varchar(160) NOT NULL,
	`amount` decimal(10,2) NOT NULL DEFAULT '0',
	`is_included` boolean NOT NULL DEFAULT false,
	`is_prorated` boolean NOT NULL DEFAULT false,
	CONSTRAINT `room_cost_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_room_cost_amount` CHECK(`room_cost_items`.`amount` >= 0),
	CONSTRAINT `chk_cost_included_prorated` CHECK(NOT (`room_cost_items`.`is_included` AND `room_cost_items`.`is_prorated`))
);
--> statement-breakpoint
CREATE TABLE `room_favorites` (
	`user_id` char(36) NOT NULL,
	`listing_id` char(36) NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `room_favorites_user_id_listing_id_pk` PRIMARY KEY(`user_id`,`listing_id`)
);
--> statement-breakpoint
CREATE TABLE `room_listings` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`host_id` char(36) NOT NULL,
	`location_id` char(36),
	`title` varchar(200) NOT NULL,
	`description` text,
	`monthly_rent` decimal(10,2) NOT NULL,
	`available_from` date,
	`max_roommates` smallint unsigned,
	`status` enum('draft','published','paused','closed') NOT NULL DEFAULT 'draft',
	`published_at` timestamp(6),
	`closed_at` timestamp(6),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `room_listings_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_listing_rent` CHECK(`room_listings`.`monthly_rent` >= 0),
	CONSTRAINT `chk_listing_max_roommates` CHECK(`room_listings`.`max_roommates` IS NULL OR `room_listings`.`max_roommates` >= 1),
	CONSTRAINT `chk_listing_publish_needs_location` CHECK(`room_listings`.`status` = 'draft' OR `room_listings`.`location_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `room_photos` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`listing_id` char(36) NOT NULL,
	`url` text NOT NULL,
	`position` smallint unsigned NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `room_photos_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_room_photo_position` UNIQUE(`listing_id`,`position`),
	CONSTRAINT `chk_room_photo_position` CHECK(`room_photos`.`position` >= 1)
);
--> statement-breakpoint
CREATE TABLE `room_rules` (
	`listing_id` char(36) NOT NULL,
	`visits_policy` text,
	`parties_allowed` boolean NOT NULL DEFAULT false,
	`quiet_hours_start` time,
	`quiet_hours_end` time,
	`pets_allowed` boolean NOT NULL DEFAULT false,
	`smoking_allowed` boolean NOT NULL DEFAULT false,
	`common_areas_notes` text,
	`extra_rules` text,
	CONSTRAINT `room_rules_listing_id` PRIMARY KEY(`listing_id`)
);
--> statement-breakpoint
CREATE TABLE `app_applications` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`listing_id` char(36) NOT NULL,
	`applicant_id` char(36) NOT NULL,
	`status` enum('pending','waitlisted','rejected','accepted') NOT NULL DEFAULT 'pending',
	`message` text,
	`compatibility_score` decimal(5,2),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`decided_at` timestamp(6),
	CONSTRAINT `app_applications_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_app_listing_applicant` UNIQUE(`listing_id`,`applicant_id`),
	CONSTRAINT `chk_app_compatibility_score` CHECK(`app_applications`.`compatibility_score` IS NULL OR `app_applications`.`compatibility_score` BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`room_id` char(36) NOT NULL,
	`sender_id` char(36) NOT NULL,
	`body` text NOT NULL,
	`sent_at` timestamp(6) NOT NULL DEFAULT (now()),
	`delivered_at` timestamp(6),
	`read_at` timestamp(6),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `chk_chat_message_length` CHECK(CHAR_LENGTH(`chat_messages`.`body`) BETWEEN 1 AND 4000)
);
--> statement-breakpoint
CREATE TABLE `chat_room_members` (
	`room_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`last_read_at` timestamp(6),
	CONSTRAINT `chat_room_members_room_id_user_id_pk` PRIMARY KEY(`room_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `chat_rooms` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`connection_id` char(36),
	`application_id` char(36),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_chat_connection` UNIQUE(`connection_id`),
	CONSTRAINT `uq_chat_application` UNIQUE(`application_id`),
	CONSTRAINT `chk_chat_origin` CHECK(`chat_rooms`.`connection_id` IS NOT NULL OR `chat_rooms`.`application_id` IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE `conn_connections` (
	`id` char(36) NOT NULL DEFAULT (UUID()),
	`requester_id` char(36) NOT NULL,
	`addressee_id` char(36) NOT NULL,
	`status` enum('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`intro_message` varchar(500),
	`response_message` varchar(500),
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	`responded_at` timestamp(6),
	`active_pair_low` char(36),
	`active_pair_high` char(36),
	CONSTRAINT `conn_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_conn_active_pair` UNIQUE(`active_pair_low`,`active_pair_high`),
	CONSTRAINT `chk_conn_distinct_users` CHECK(`conn_connections`.`requester_id` <> `conn_connections`.`addressee_id`)
);
--> statement-breakpoint
ALTER TABLE `auth_login_attempts` ADD CONSTRAINT `auth_login_attempts_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_oauth_identities` ADD CONSTRAINT `auth_oauth_identities_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_password_reset_tokens` ADD CONSTRAINT `auth_password_reset_tokens_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auth_user_roles` ADD CONSTRAINT `auth_user_roles_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `compat_profiles` ADD CONSTRAINT `compat_profiles_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_affinity_scores` ADD CONSTRAINT `match_affinity_scores_user_a_auth_users_id_fk` FOREIGN KEY (`user_a`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_affinity_scores` ADD CONSTRAINT `match_affinity_scores_user_b_auth_users_id_fk` FOREIGN KEY (`user_b`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_saved_profiles` ADD CONSTRAINT `match_saved_profiles_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `match_saved_profiles` ADD CONSTRAINT `match_saved_profiles_candidate_id_auth_users_id_fk` FOREIGN KEY (`candidate_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `search_saved_searches` ADD CONSTRAINT `search_saved_searches_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `geo_locations` ADD CONSTRAINT `geo_locations_zone_id_geo_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `geo_zones`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD CONSTRAINT `agreement_acceptances_agreement_id_agreement_agreements_id_fk` FOREIGN KEY (`agreement_id`) REFERENCES `agreement_agreements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agreement_acceptances` ADD CONSTRAINT `agreement_acceptances_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `agreement_agreements` ADD CONSTRAINT `agreement_agreements_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_activity_log` ADD CONSTRAINT `mod_activity_log_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_listing_reviews` ADD CONSTRAINT `mod_listing_reviews_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_listing_reviews` ADD CONSTRAINT `mod_listing_reviews_reviewer_id_auth_users_id_fk` FOREIGN KEY (`reviewer_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_reports` ADD CONSTRAINT `mod_reports_reporter_id_auth_users_id_fk` FOREIGN KEY (`reporter_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_reports` ADD CONSTRAINT `mod_reports_target_user_id_auth_users_id_fk` FOREIGN KEY (`target_user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_reports` ADD CONSTRAINT `mod_reports_target_listing_id_room_listings_id_fk` FOREIGN KEY (`target_listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_reports` ADD CONSTRAINT `mod_reports_target_message_id_chat_messages_id_fk` FOREIGN KEY (`target_message_id`) REFERENCES `chat_messages`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_sanctions` ADD CONSTRAINT `mod_sanctions_report_id_mod_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `mod_reports`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_sanctions` ADD CONSTRAINT `mod_sanctions_admin_id_auth_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `auth_users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_sanctions` ADD CONSTRAINT `mod_sanctions_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mod_sanctions` ADD CONSTRAINT `mod_sanctions_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notif_notifications` ADD CONSTRAINT `notif_notifications_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notif_preferences` ADD CONSTRAINT `notif_preferences_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profile_contact_privacy` ADD CONSTRAINT `profile_contact_privacy_user_id_profile_profiles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `profile_profiles`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profile_housing_preferences` ADD CONSTRAINT `profile_housing_preferences_user_id_profile_profiles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `profile_profiles`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profile_housing_preferences` ADD CONSTRAINT `profile_housing_preferences_desired_zone_id_geo_zones_id_fk` FOREIGN KEY (`desired_zone_id`) REFERENCES `geo_zones`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profile_photos` ADD CONSTRAINT `profile_photos_user_id_profile_profiles_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `profile_profiles`(`user_id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profile_profiles` ADD CONSTRAINT `profile_profiles_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_cost_items` ADD CONSTRAINT `room_cost_items_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_favorites` ADD CONSTRAINT `room_favorites_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_favorites` ADD CONSTRAINT `room_favorites_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_listings` ADD CONSTRAINT `room_listings_host_id_auth_users_id_fk` FOREIGN KEY (`host_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_listings` ADD CONSTRAINT `room_listings_location_id_geo_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `geo_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_photos` ADD CONSTRAINT `room_photos_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_rules` ADD CONSTRAINT `room_rules_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_applications` ADD CONSTRAINT `app_applications_listing_id_room_listings_id_fk` FOREIGN KEY (`listing_id`) REFERENCES `room_listings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `app_applications` ADD CONSTRAINT `app_applications_applicant_id_auth_users_id_fk` FOREIGN KEY (`applicant_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_room_id_chat_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_sender_id_auth_users_id_fk` FOREIGN KEY (`sender_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_room_members` ADD CONSTRAINT `chat_room_members_room_id_chat_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_room_members` ADD CONSTRAINT `chat_room_members_user_id_auth_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD CONSTRAINT `chat_rooms_connection_id_conn_connections_id_fk` FOREIGN KEY (`connection_id`) REFERENCES `conn_connections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_rooms` ADD CONSTRAINT `chat_rooms_application_id_app_applications_id_fk` FOREIGN KEY (`application_id`) REFERENCES `app_applications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conn_connections` ADD CONSTRAINT `conn_connections_requester_id_auth_users_id_fk` FOREIGN KEY (`requester_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `conn_connections` ADD CONSTRAINT `conn_connections_addressee_id_auth_users_id_fk` FOREIGN KEY (`addressee_id`) REFERENCES `auth_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_auth_attempts_email` ON `auth_login_attempts` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_auth_reset_user` ON `auth_password_reset_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_auth_sessions_user_active` ON `auth_sessions` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `idx_match_feed` ON `match_affinity_scores` (`user_a`,`score`);--> statement-breakpoint
CREATE INDEX `idx_search_saved_user` ON `search_saved_searches` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_outbox_pending` ON `core_outbox_events` (`processed_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_geo_locations_coords` ON `geo_locations` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_geo_locations_zone` ON `geo_locations` (`zone_id`);--> statement-breakpoint
CREATE INDEX `idx_geo_poi_coords` ON `geo_points_of_interest` (`latitude`,`longitude`);--> statement-breakpoint
CREATE INDEX `idx_mod_activity_user` ON `mod_activity_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mod_listing_reviews_queue` ON `mod_listing_reviews` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mod_reports_queue` ON `mod_reports` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_mod_sanctions_user` ON `mod_sanctions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_notif_user_unread` ON `notif_notifications` (`user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notif_user` ON `notif_notifications` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_room_cost_listing` ON `room_cost_items` (`listing_id`);--> statement-breakpoint
CREATE INDEX `idx_room_listings_host` ON `room_listings` (`host_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_room_listings_search` ON `room_listings` (`status`,`monthly_rent`);--> statement-breakpoint
CREATE INDEX `idx_app_listing` ON `app_applications` (`listing_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_app_applicant` ON `app_applications` (`applicant_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_room` ON `chat_messages` (`room_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_chat_members_user` ON `chat_room_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_conn_addressee` ON `conn_connections` (`addressee_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_conn_requester` ON `conn_connections` (`requester_id`,`status`);
