var Migrate = require('./migrate');

var source = {
	token: "d145f3822bd12ee483e241b2e6cefefe20d5c791",
	repo: "michaelgwelch/test",
};

var dest = {
	token: "d145f3822bd12ee483e241b2e6cefefe20d5c791",
	repo: "michaelgwelch/test2"
};

var migrate = new Migrate(source, dest);

var allIssues = [];
var allPulls = [];

var allInfo = [];

migrate.getIssueList(function(issues) {
	migrate.getPullList(function(pulls) {

		var i;
		for(i = 0; i < issues.length; i++) {

			var issue = issues[i];
			var issueNumber = issue.number;

			allInfo[issueNumber] = issue;

		}

		for (i = 0; i < pulls.length; i++) {
			var pull = pulls[i];
			var pullNumber = pull.number;

			var issue = allInfo[pullNumber];
			issue.base = pull.base;
			issue.head = pull.head;
		}

		var migratePull = function migratePull(pull, callback) {
			migrateIssue(pull, callback);
		}

		var migrateIssue = function migaretIssue(issue, callback) {
			migrate.createIssue(issue, callback);
		}

		var migrateInfo = function migrateInfo(info, callback) {
			if (info.base) {
				migratePull(info, callback);
			} else {
				migrateIssue(info, callback);
			}
		}

		for(i = 1; i < allInfo.length; i++) {
			var info = allInfo[i];
			migrateInfo(info, function() {
				console.log("migrated " + info.number);
			});
		}

	}); 
});