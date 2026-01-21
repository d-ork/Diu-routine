CREATE TABLE `classSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheId` int NOT NULL,
	`day` varchar(20) NOT NULL,
	`timeStart` varchar(10) NOT NULL,
	`timeEnd` varchar(10) NOT NULL,
	`courseCode` varchar(20) NOT NULL,
	`courseName` text,
	`batch` varchar(10) NOT NULL,
	`section` varchar(10) NOT NULL,
	`batchSection` varchar(20) NOT NULL,
	`room` varchar(50) NOT NULL,
	`teacher` varchar(20) NOT NULL,
	`department` varchar(50) NOT NULL DEFAULT 'cse',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pdfCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`department` varchar(50) NOT NULL,
	`pdfUrl` text NOT NULL,
	`version` varchar(20) NOT NULL DEFAULT '1.0',
	`parsedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`totalClasses` int NOT NULL DEFAULT 0,
	CONSTRAINT `pdfCache_id` PRIMARY KEY(`id`)
);
