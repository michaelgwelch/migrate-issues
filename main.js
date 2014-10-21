var Migrate = require('./migrate');
var async = require('async');
var child = require('child_process').exec;
var _ = require('lodash');



var source = {
	token: "5e23bc85f7971224035b7e4004881d14c30e5d01",
	repo: "michaelgwelch/test",
	proxy: "http://10.10.5.18:8080"
};

var dest = {
	options: {
		url: "https://c201sa26.jci.com/api/v3"
	},
	token: "af58f10c5bef7dbdcf812ccb2c848b2dcef5d383",
	repo: "secui/test2",
	ca: require('fs').readFileSync('/Users/mgwelch/DropBox/JCI Root CA.pem')

};

// delete the dest repo (if it exists)
// Create the dest repo (if it doesn't)
// clone the source repo --mirror
// use sed or awk to update pull to pr in packed-refs
// push --mirror to dest repo

// then start the migration of issues and pulls

var migrate = new Migrate(source, dest);

var toArray = function toArray(list) {
	var result = [];
	var i;
	for (i = 0; i < list.length; i++) {
		var numberedItem = list[i];
		result[numberedItem.number] = numberedItem;
	}
	return result;
};

var getIssueList = function getIssueList(callback) {
	migrate.getIssueList(function(err, issues) {
		callback(err, toArray(issues));
	});
};


// Add the base property of pulls to issue objects
var mergePullsAndIssues = function mergePullsAndIssues(issues, pulls) {
	var i;
	for(i = 0; i < pulls.length; i++) {
		var pull = pulls[i];
		var pullNumber = pull.number;

		var issue = issues[pullNumber];
		issue.base = pull.base;
		issue.head = pull.head;
	}
	return issues;
};

var mergeAndSortAllComments = function mergeAndSortAllComments(issueComments, commitComments, reviewComments) {
	return _.sortBy(issueComments.concat(commitComments).concat(reviewComments), function(comment) {
		return comment.created_at;
	});
};

var migrateIssues = function migrateIssues(issues, callback) {

	async.eachSeries(issues, function(issue, issueCallback) {
		if (issue) {
			if (issue.base) {
				migrate.createBaseBranchAndPull(issue, issueCallback);
			} else {
				migrate.createIssue(issue, issueCallback);
			}
		} else {
			issueCallback();
		}

	}, function(err) {
		if (err) {
			console.log("Error migrating issues: " + err);
		} else {
			console.log("Migrated all issues:");
		}
		callback(err);
	});

};

var updateIssues = function updateIssues(issues, callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
		if (issue) {
			migrate.updateIssue(issue, issueCallback);
		} else {
			issueCallback();
		}

	}, function(err) {
		if (err) {
			console.log("Error updating issues: " + err);
		} else {
			console.log("updated all issues:");
		}
		callback(err);
	});	
}

var migrateIssuesTask = function(issues) {
	return function(callback) {
		return migrateIssues(issues, callback);
	};
};

var reviewComment = function reviewComment(comment) {
	return comment.pull_request_url;
}

var commitComment = function commitComment(comment) {
	return comment.commit_id && !comment.pull_request_url;
}

var migrateComments = function migrateComments(comments, callback) {
	async.eachSeries(comments, function(comment, commentCallback) {
		if (reviewComment(comment)) {
			migrate.createPullComment(comment, commentCallback);

		} else if (commitComment(comment)) {
			migrate.createCommitComment(comment, commentCallback);
		} else {
			// must be issue comment (the simlest)
			migrate.createIssueComment(comment, commentCallback);
		}
	}, function(err) {
		if (err) {
			console.log("Error creating comments");
			console.dir(err);
		} 
		callback();
	});
}


// fetch all the data.
async.series([
	getIssueList,
	migrate.getPullList,
	migrate.getPullCommentList,
	migrate.getIssueCommentList,
	migrate.getCommitComments,
	],
	function(err, results) {

		if (err) {
			console.log("Error fetching data. Will abort");
			console.dir(err);
		} else {
			var allIssues = mergePullsAndIssues(results[0], results[1]);
			var allComments = mergeAndSortAllComments(results[2], results[3], results[4]);

			async.series([
				function(stepCallback) { migrateIssues(allIssues, stepCallback); },
				function(stepCallback) { migrateComments(allComments, stepCallback); },
				function(stepCallback) { updateIssues(allIssues, stepCallback); }
				],
				function(err, results) {
					if (err) {
						console.log("Error creating data. Aborted");
						console.dir(err);
					}
				});
		}


	});



// migrate.getIssueList(function(issues) {
// 	migrate.getPullList(function(pulls) {
// 		migrate.getPullCommentList(function(pullComments) {
// 			migrate.getIssueCommentList(function(issueComments) {

// 				var i, issue;
// 				for(i = 0; i < issues.length; i++) {

// 					issue = issues[i];
// 					var issueNumber = issue.number;

// 					allInfo[issueNumber] = issue;

// 				}

// 				for (i = 0; i < pulls.length; i++) {
// 					var pull = pulls[i];
// 					var pullNumber = pull.number;

// 					issue = allInfo[pullNumber];
// 					issue.base = pull.base;
// 					issue.head = pull.head;
// 				}


// 				var migratePull = function migratePull(pull, callback) {
// 					//migrateIssue(pull, callback);
// 					migrate.createPull(pull, callback);
// 				};

// 				var migrateIssue = function migaretIssue(issue, callback) {
// 					migrate.createIssue(issue, callback);
// 				};

// 				var migrateInfo = function migrateInfo(info, callback) {
// 					if (info.base) {
// 						migratePull(info, callback);
// 					} else {
// 						migrateIssue(info, callback);
// 					}
// 				};

// 				//console.dir(allInfo);
// 				var migratePullComments = function() {
// 					async.eachSeries(pullComments, function(pullComment, callback) {
// 						if (pullComment) {
// 							migrate.createPullComment(pullComment, callback);
// 						} else {
// 							callback();
// 						}
// 					}, function(err) {
// 						console.log('async error 2:' + err);
// 					});
// 				};

// 				var migrateIssueComments = function() {
// 					async.eachSeries(issueComments, function(issueComment, callback) {
// 						if(issueComment) {
// 							migrate.createIssueComment(issueComment, callback);
// 						} else {
// 							callback();
// 						}
// 					});
// 				};

// 				async.eachSeries(allInfo, function(issue, callback) {
// 					if (issue) {
// 						migrateInfo(issue, callback);
// 					} else { 
// 						callback(); 
// 					}
// 				}, function(err) {
// 					if (err) {
// 						console.log('async error: ' + err);
// 					} else {
// 						async.parallel([migrateIssueComments,migratePullComments], function(err) {
// 							if(err) {
// 								console.log("pull comments migration error", err);
// 							}
// 						});
// 					}
// 				});
// 			});

// 		});


// 	}); 
// });
