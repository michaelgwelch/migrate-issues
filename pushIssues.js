'use strict';
var rest = require('unirest');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var cli = require('cli');

cli.parse();

var owner = 'you';

if(!cli.args[0]) {
	console.log('node pushIssues.js repoName');
	return;
}

var repo = cli.args[0];

var dest = {
	options: {
		url: "https://c201sa26.jci.com/api/v3"
	},
	token: 
	repo: owner + '/' + repo,
	ca: require('fs').readFileSync('.pem')

};
var destApiUrl = (dest.options && dest.options.url) || "https://api.github.com";
var destRepoUrl = destApiUrl + '/repos/' + dest.repo;
var destHeaders = {
	'Authorization': 'token ' + dest.token,
	'user-agent': 'node.js'	
};

String.prototype.supplant = function (o) {
    return this.replace(/{([^{}]*)}/g,
        function (a, b) {
            var r = o[b];
            return typeof r === 'string' || typeof r === 'number' ? r : a;
        }
    );
};

//<time datetime="2014-10-19T13:37:57Z" is="relative-time" title="October 19, 2014 at 8:37:57 AM CDT">3 days ago</time>

var shortFormat = 'MMM D, YYYY';
var longFormat = 'dddd, MMMM Do YYYY, h:mm:ss a Z';
var formatDate = function formatDate(date) {
	var display = moment(date).format(shortFormat);
	var title = moment(date).format(longFormat);
	var html = '<time datetime="' + date + '" title="' + title + '">' + display + '</time>';
	return html;
}


// avatars
// <img alt="cwelchmi" class="avatar js-avatar" data-user="71" height="20" src="https://secure.gravatar.com/avatar/634fafebc51a88026361eb29b7d3fc21?d=https%3A%2F%2Fc201sa26.jci.com%2Fidenticons%2Fe2c420d928d4bf8ce0ff2ec19b371514.png&amp;r=x&amp;s=140" width="20">
var suffix = function suffix(issue) {
	var creation = formatDate(issue.created_at);
	
	var createdAvatar = '';
	if (issue.user.avatar_url) {
		createdAvatar = '<img alt="{login}" class="avatar js-avatar" height="20" src="{avatar}&amp;r=x&amp;s=140" width="20">'.supplant({'login':issue.user.login, 'avatar':issue.user.avatar_url});
	}

	var closedAvatar = '';
	if (issue.closed_by){
		if (issue.closed_by.login == issue.user.login) {
			closedAvatar = '';
		} else {
			closedAvatar = '<img alt="{login}" class="avatar js-avatar" height="20" src="{avatar}&amp;r=x&amp;s=140" width="20">'.supplant({'login':issue.closed_by.login, 'avatar':issue.closed_by.avatar_url});
		}
	}
	var closing = "";
	if (issue.closed_at) {
		closing = formatDate(issue.closed_at);
	}

	var result = '\r\n\r\n> ' + createdAvatar + ' ' + closedAvatar + ' ' +
			'Authored by ' + issue.user.login + 
			' on ' + creation;

	if (closing !== '') {
		result = result + "; closed";
		if (issue.closed_by) {
			result = result + ' by ' + issue.closed_by.login
		}
		result = result + ' on ' + closing;
	}
	return result;
}

var invoke = function invoke(method, url, data, callback) {
	var request = method(url)
		.type('json')
		.headers(destHeaders);

	if (data) {
		request.send(data);
	}

	request.options.ca = dest.ca;
	request.end(function(response) {
		if (response.error) {

		}
		callback(response.error, response.body);
	});
}

var get = function get(url, callback) {
	invoke(rest.get, url, null, callback);
}

var patch = function patch(url, data, callback) {
	invoke(rest.patch, url, data, callback);
}

var post = function post(url, data, callback) {
	invoke(rest.post, url, data, callback);
}
var importLabel = 'GitHub Import';

var updateIssue = function(issueUpdate, callback) {
	var url = destRepoUrl + '/issues/' + issueUpdate.number;
	var data = {
			'state':issueUpdate.state,
			'labels': [ importLabel ]
		};
	patch(url, data, callback);
}

var createIssue = function(issue, callback) {
	var url = destRepoUrl + '/issues';
	var data = {
			'title':issue.title,
			'body':issue.body + suffix(issue)
		};
	post(url, data, callback);
};

var createBranch = function createBranch(pull, callback) {
	var url = destRepoUrl + '/git/refs';
	var data = {
		'ref':'refs/heads/pr' + pull.number + 'base',
		'sha':pull.base.sha
	};
	console.log("Create branch " + data.ref);
	post(url, data, callback);
};

var createPull = function createBranch(pull, callback) {
	var url = destRepoUrl + '/pulls';
	var data = {
		'title':pull.title,
		'body':suffix(pull)  + '\r\n\r\n' + pull.body,
		'head':'pr/' + pull.number + '/head',
		'base':'pr' + pull.number + 'base'
	};

	if (pull.base.sha == pull.head.sha) {
		data.head = 'refs/heads/master';
	}
	console.log("Create pull " + pull.number);
	post(url, data, callback);
};

var createBaseBranchAndPull = function createBaseBranchAndPull(pull, callback) {

	async.series([
		function(stepCallback) { createBranch(pull, stepCallback); },
		function(stepCallback) { createPull(pull, stepCallback); } 
		], callback);
};

var issuesDir = repo + '/issues';
var files = fs.readdirSync(issuesDir);
var issues = _.map(files, function(file) { return JSON.parse(fs.readFileSync(issuesDir + '/' + file)); });
issues = _.sortBy(issues, function(issue) { return issue.number; });

var pushBranches = function(callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
		// if (issue.number < 42) {
		// 	issueCallback()
		// } else {
		if (issue.base) {
			console.log("branch" + issue.number);
			createBranch(issue, issueCallback);
		} else {
			issueCallback();
		}
		// }
	}, function(err) {
		if (err) {
			console.log(err);
		}
		callback(err);
	});
};

var pushIssues = function(callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
		// if (issue.number < 1020) {
		// 	issueCallback();
		// } else {
			console.log("issue " + issue.number);
			if (issue.pull_request) {
				createPull(issue, issueCallback);
			} else {
				createIssue(issue, issueCallback);
			}
		// }
	}, function(err) {
		if (err) {
			console.log(err);
		}
		callback(err);
	});
};

// try to create label (it might exist, if so ignore error)
var createLabel = function(callback) {
	var url = destRepoUrl + '/labels';
	var data = { 'name':importLabel, 'color':'fef2c0' };
	post(url, data, function() { callback(); });
};

createLabel(function() {});

var updateIssues = function(callback) {
	async.each(issues, function(issue, issueCallback) {
		console.log("update issue " + issue.number);
		updateIssue(issue, issueCallback);
	}, function(err) {
		if (err) {
			console.log(err);
		}
		callback();
	});
};

var branches = [];
var fetchBranches = function(callback) {
	var getPage = function(pageNumber) {
		console.log("getting page " + pageNumber + " of /git/refs/head");
		var url = destRepoUrl + '/git/refs/head?per_page=100&page=' + pageNumber;
		get(url, function(err, refs) {
			if (err) {
				callback(err);
			} else {
				branches = refs;
				callback(null); // fetch just from head seems to return all refs not just 100.
				//getPage(pageNumber + 1);

			}
		});
	}
		
	getPage(1);
};

var branchRegEx = /pr\d+base/;

var deleteBranches = function(callback) {
	var baseurl = destRepoUrl + '/git'
	async.each(branches, function(refObject, branchCallback) {
		var ref = refObject.ref;
		if (branchRegEx.test(ref)) {
			var url = baseurl + '/' + ref;
			console.log('Deleting ref ' + ref);
			invoke(rest.delete, url, null, branchCallback);
		} else {
			branchCallback();
		}
	}, callback);
}

var baseUrl = destRepoUrl;

var urlForPullComment = function(pullComment) {
	var pullNumber = pullComment.pull_request_url.split('/').pop();
	return baseUrl + '/pulls/' + pullNumber + '/comments';
}

var urlForIssueComment = function(issueComment) {
	var issueNumber = issueComment.issue_url.split('/').pop();
	return baseUrl + '/issues/' + issueNumber + '/comments';
}

var urlForCommitComment = function(commitComment) {
	var commitSha = commitComment.commit_id;
	return baseUrl + '/commits/' + commitSha + '/comments';
}

// This is used when I want to add a review comment, but the original commit
// is no longer part of the pull request (most likely due to a push - f)
// So now I"m falling back to doing a commit comment and need the url
// for the commit (using the original_commit_id)
var urlForCommitPullComment = function(pullComment, callback) {
	var commitSha = pullComment.original_commit_id;
	return baseUrl + '/commits/' + commitSha + '/comments';
}

var createCommitComment = function(commitComment, callback) {
	var url = urlForCommitComment(commitComment);
	console.log("Comment on " + commitComment.commit_id);
	var data = {
			'body':commitComment.body + suffix(commitComment),
			'sha':commitComment.commit_id,
			'path':commitComment.path,
			'position':commitComment.position
		};
	post(url, data, function(err, result) {
		// Most likely failure is a comment on a non-existent commit, so ignore it
		if (err) {
			console.log("comment on commit " + data.sha + " failed");
			console.log("continuing");
		}
		callback();
	});			
}

var createCommitCommentWithLinkToPull = function(pullComment, callback) {
	var url = urlForCommitPullComment(pullComment);
	var pullNumber = pullComment.pull_request_url.split('/').pop();
	console.log("Comment on commit " + pullComment.original_commit_id);
	var data = {
			'body':pullComment.body + suffix(pullComment) + ". Originated on #" + pullNumber,
			'sha':pullComment.original_commit_id,
			'path':pullComment.path,
			'position':pullComment.original_position
		};
	post(url, data, function(err, result) {
		// Most likely failure is a comment on a non-existent commit, so ignore it
		if (err) {
			console.log("comment on commit " + data.sha + " failed");
			console.log("this was a pr retry");
		}
		callback();
	});			
}

var createPullComment = function(pullComment, callback) {
	var url = urlForPullComment(pullComment);
	console.log("Comment on pull " + url);
	var data = {
			'body':pullComment.body + suffix(pullComment),
			'commit_id':pullComment['original_commit_id'],
			'path':pullComment.path,
			'position':pullComment['original_position']
		};
	post(url, data, function(err) {
		if (err) {
			// commit is no longer part of pull request. Probably because of 'push -f'
			// create commit comment with link back to original pull request.
			createCommitCommentWithLinkToPull(pullComment,callback);
		} else {
			callback();
		}
	});
};

var createIssueComment = function(issueComment, callback) {
	var url = urlForIssueComment(issueComment);
	console.log("Comment on issue " + url);
	var data = {
			'body':issueComment.body + suffix(issueComment),
		};
	post(url, data, callback);			
};



var reviewComment = function reviewComment(comment) {
	return comment.pull_request_url;
}

var commitComment = function commitComment(comment) {
	return comment.commit_id && !comment.pull_request_url;
}

var pushComments = function(callback) {
	var comments = JSON.parse(fs.readFileSync(repo + '/comments.json'));
	var commit_count = 0;
	async.eachSeries(comments, function(comment, commentCallback) {
		console.log("commit count: " + commit_count);
		commit_count = commit_count + 1;
		if (reviewComment(comment)) {
			createPullComment(comment, commentCallback);
		} else if (commitComment(comment)) {
			createCommitComment(comment, commentCallback);
		} else {
			createIssueComment(comment, commentCallback);
		}
	}, callback)
}

var missingCommits = [];
var checkCommitExists = function(commit, callback) {

	var url = destRepoUrl + '/git/commits/' + commit;
	get(url, function(err,data) {
		if (err) {
			missingCommits.push(commit);
			console.log('PROBLEM: commit ' + commit + ' missing');
		}
		callback(null);
	})
}

var checkCommits = function(callback) {
	var comments = JSON.parse(fs.readFileSync(repo + '/comments.json'));
	async.eachSeries(comments.concat(issues), function(item, itemCallback) {
		if (item.base) { // this is a pull request
			checkCommitExists(item.base.sha, itemCallback);
		} else if (reviewComment(item)) {
			checkCommitExists(item.original_commit_id, itemCallback);
		} else if (commitComment(item)) {
			checkCommitExists(item.commit_id, itemCallback);
		} else {
			itemCallback();
		}
	}, function(err) {
		fs.writeFileSync(repo + '/missingCommits.json', JSON.stringify(_.unique(missingCommits)));
		callback();
	});
}

var checkPulls = function(callback) {
	var i;
	for(i = 0; i < issues.length; i++) {
		var issue = issues[i];
		if (issue.base) {
			if (issue.base.sha == issue.head.sha) {
				console.log("Bad pull requests: " + issue.number);
			}
		}
	}
	callback();
}


async.series([
	//pushBranches,
	//pushIssues,
	//pushComments,
	updateIssues,
	//fetchBranches,
	//deleteBranches,
	//checkCommits,
	//checkPulls,
	], function(err) {
		console.log(err);
	})
