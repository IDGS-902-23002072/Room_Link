ALTER TABLE `room_photos` ADD `file_name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `room_photos` ADD `mime_type` varchar(100) NOT NULL;--> statement-breakpoint
ALTER TABLE `room_photos` ADD `image_data` longblob NOT NULL;--> statement-breakpoint
ALTER TABLE `room_photos` DROP COLUMN `url`;