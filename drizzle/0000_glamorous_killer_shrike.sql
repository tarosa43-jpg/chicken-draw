CREATE TABLE `presence` (
	`code` text NOT NULL,
	`player` text NOT NULL,
	`seen` integer NOT NULL,
	PRIMARY KEY(`code`, `player`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL
);
