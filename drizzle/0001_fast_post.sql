CREATE TABLE `faculty` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` text NOT NULL,
	`initials` varchar(10) NOT NULL,
	`department` varchar(50) NOT NULL DEFAULT 'cse',
	`photoUrl` text,
	`profileUrl` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `faculty_id` PRIMARY KEY(`id`),
	CONSTRAINT `faculty_initials_unique` UNIQUE(`initials`)
);
