CREATE TABLE `mon_activity_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`occurred_at` timestamp(6) NOT NULL DEFAULT (now()),
	`module` varchar(48) NOT NULL,
	`action` varchar(160) NOT NULL,
	`result` varchar(16) NOT NULL,
	`message` text NOT NULL,
	`http_status` smallint,
	`duration_ms` int,
	`request_id` varchar(64),
	`source` varchar(16) NOT NULL DEFAULT 'real',
	`sli_id` varchar(10),
	`actor_id` char(36),
	`detail` json NOT NULL DEFAULT (JSON_OBJECT()),
	CONSTRAINT `mon_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_backup_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`backup_date` varchar(10) NOT NULL,
	`status` varchar(16) NOT NULL,
	`size_bytes` bigint unsigned,
	`duration_ms` int,
	`source` varchar(16) NOT NULL DEFAULT 'synthetic',
	`recorded_at` timestamp(6) NOT NULL DEFAULT (now()),
	`message` text NOT NULL,
	CONSTRAINT `mon_backup_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_case_event` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sli_id` varchar(8) NOT NULL,
	`case_key` char(36) NOT NULL,
	`started_at` datetime(3) NOT NULL,
	`finished_at` datetime(3),
	`elapsed_ms` int,
	`on_time` tinyint,
	CONSTRAINT `mon_case_event_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_error` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`occurred_at` timestamp(6) NOT NULL DEFAULT (now()),
	`module` varchar(48) NOT NULL,
	`code` varchar(80) NOT NULL,
	`message` text NOT NULL,
	`status` smallint,
	`request_id` varchar(64),
	`source` varchar(16) NOT NULL DEFAULT 'real',
	CONSTRAINT `mon_error_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_exclusion` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`kind` varchar(24) NOT NULL,
	`value` varchar(160) NOT NULL,
	`reason` text NOT NULL,
	`created_at` timestamp(6) NOT NULL DEFAULT (now()),
	CONSTRAINT `mon_exclusion_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_incident` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`github_issue` int NOT NULL,
	`priority` enum('P0','P1','P2','P3') NOT NULL,
	`module` varchar(4) NOT NULL,
	`opened_at` datetime NOT NULL,
	`first_response_at` datetime,
	`restored_at` datetime,
	`closed_at` datetime,
	`first_response_due_at` datetime NOT NULL,
	CONSTRAINT `mon_incident_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_mon_incident_github_issue` UNIQUE(`github_issue`)
);
--> statement-breakpoint
CREATE TABLE `mon_probe` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`checked_at` timestamp(6) NOT NULL DEFAULT (now()),
	`status` varchar(16) NOT NULL,
	`http_status` smallint,
	`latency_ms` int,
	`source` varchar(16) NOT NULL DEFAULT 'synthetic',
	`request_id` varchar(64),
	`message` text NOT NULL,
	CONSTRAINT `mon_probe_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_request_log` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`occurred_at` timestamp(6) NOT NULL DEFAULT (now()),
	`method` varchar(10) NOT NULL,
	`route_pattern` varchar(200) NOT NULL,
	`status` smallint NOT NULL,
	`duration_ms` int NOT NULL,
	`role` varchar(32),
	`request_id` varchar(64),
	`sli_id` varchar(10),
	`is_good` tinyint NOT NULL,
	`source` varchar(16) NOT NULL DEFAULT 'real',
	CONSTRAINT `mon_request_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_sli_catalog` (
	`sli_id` varchar(8) NOT NULL,
	`module` varchar(48) NOT NULL,
	`type` varchar(16) NOT NULL,
	`threshold_ms` int,
	`slo_percent` decimal(5,1),
	`method` text NOT NULL,
	`route_pattern` varchar(200),
	`active` tinyint NOT NULL DEFAULT 1,
	CONSTRAINT `mon_sli_catalog_sli_id` PRIMARY KEY(`sli_id`)
);
--> statement-breakpoint
CREATE TABLE `mon_slo_compliance` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`sli_id` varchar(10) NOT NULL,
	`period` varchar(7) NOT NULL,
	`total_tx` int NOT NULL,
	`good_tx` int NOT NULL,
	`sli_value` decimal(5,1),
	`slo_value` decimal(5,1),
	`compliant` tinyint,
	`computed_at` timestamp(6) NOT NULL DEFAULT (now()),
	`message` text NOT NULL,
	CONSTRAINT `mon_slo_compliance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_test_result` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`run_id` char(36) NOT NULL,
	`occurred_at` timestamp(6) NOT NULL DEFAULT (now()),
	`sli_id` varchar(10),
	`module` varchar(48) NOT NULL,
	`test_name` varchar(300) NOT NULL,
	`result` varchar(16) NOT NULL,
	`data_summary` text,
	`expected` text,
	`obtained` text,
	`duration_ms` int,
	`source` varchar(16) NOT NULL DEFAULT 'test',
	`message` text NOT NULL,
	CONSTRAINT `mon_test_result_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mon_test_run` (
	`id` char(36) NOT NULL,
	`started_at` timestamp(6) NOT NULL,
	`finished_at` timestamp(6) NOT NULL,
	`suite` varchar(80) NOT NULL,
	`complete` tinyint NOT NULL DEFAULT 0,
	`total_tests` int NOT NULL,
	`passed_tests` int NOT NULL,
	`failed_tests` int NOT NULL,
	`commit_sha` varchar(64),
	`source` varchar(16) NOT NULL DEFAULT 'test',
	`message` text NOT NULL,
	CONSTRAINT `mon_test_run_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `mon_case_event` ADD CONSTRAINT `mon_case_event_sli_id_mon_sli_catalog_sli_id_fk` FOREIGN KEY (`sli_id`) REFERENCES `mon_sli_catalog`(`sli_id`) ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE `mon_test_result` ADD CONSTRAINT `mon_test_result_run_id_mon_test_run_id_fk` FOREIGN KEY (`run_id`) REFERENCES `mon_test_run`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_mon_activity_occurred` ON `mon_activity_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_activity_filters` ON `mon_activity_log` (`module`,`result`,`source`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_activity_action` ON `mon_activity_log` (`action`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_activity_request` ON `mon_activity_log` (`request_id`);--> statement-breakpoint
CREATE INDEX `idx_mon_backup_date` ON `mon_backup_log` (`backup_date`);--> statement-breakpoint
CREATE INDEX `idx_mon_case_sli_started` ON `mon_case_event` (`sli_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_error_occurred` ON `mon_error` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_exclusion_kind` ON `mon_exclusion` (`kind`,`value`);--> statement-breakpoint
CREATE INDEX `idx_mon_incident_opened` ON `mon_incident` (`opened_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_incident_priority_opened` ON `mon_incident` (`priority`,`opened_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_probe_checked` ON `mon_probe` (`checked_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_request_occurred` ON `mon_request_log` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_request_sli` ON `mon_request_log` (`sli_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_request_source` ON `mon_request_log` (`source`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_slo_period` ON `mon_slo_compliance` (`period`,`sli_id`);--> statement-breakpoint
CREATE INDEX `idx_mon_test_result_run` ON `mon_test_result` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_mon_test_result_sli` ON `mon_test_result` (`sli_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_mon_test_run_finished` ON `mon_test_run` (`finished_at`);