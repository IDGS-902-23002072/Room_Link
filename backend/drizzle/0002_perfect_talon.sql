ALTER TABLE `mod_reports` DROP FOREIGN KEY `mod_reports_target_message_id_chat_messages_id_fk`;
--> statement-breakpoint
ALTER TABLE `mod_reports` ADD CONSTRAINT `mod_reports_target_message_id_chat_messages_id_fk` FOREIGN KEY (`target_message_id`) REFERENCES `chat_messages`(`id`) ON DELETE cascade ON UPDATE no action;