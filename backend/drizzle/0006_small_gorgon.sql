ALTER TABLE `profile_photos` ADD `mime_type` varchar(40) DEFAULT 'image/jpeg' NOT NULL;--> statement-breakpoint
ALTER TABLE `profile_photos` ADD `size_bytes` int unsigned DEFAULT 0 NOT NULL;