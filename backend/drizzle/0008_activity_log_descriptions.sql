ALTER TABLE `mod_activity_log` ADD COLUMN `module` varchar(40) NULL;--> statement-breakpoint
ALTER TABLE `mod_activity_log` ADD COLUMN `outcome` varchar(20) NULL;--> statement-breakpoint
ALTER TABLE `mod_activity_log` ADD COLUMN `description` varchar(500) NULL;--> statement-breakpoint
CREATE INDEX `idx_mod_activity_module` ON `mod_activity_log` (`module`,`created_at`);
