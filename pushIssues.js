'use strict';
var rest = require('unirest');
var fs = require('fs');
var _ = require('lodash');
var async = require('async');
var moment = require('moment');
var dest = {
	options: {
		url: "https://c201sa26.jci.com/api/v3"
	},
	token: "af58f10c5bef7dbdcf812ccb2c848b2dcef5d383",
	repo: "secui/maps",
	ca: require('fs').readFileSync('/Users/mgwelch/DropBox/JCI Root CA.pem')

};
var destApiUrl = (dest.options && dest.options.url) || "https://api.github.com";
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

var closedByString = function closedByString(issue) {

	if (issue.closed_at) {
		return 'closed by {user} on {date}'.supplary({'user':issue.user.login, 'date':issue.closed_at});
	} else {
		return '';
	}
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
	var url = destApiUrl + '/repos/' + dest.repo + '/issues/' + issueUpdate.number;
	var data = {
			'state':issueUpdate.state,
			'labels': [ importLabel ]
		};
	patch(url, data, callback);
}

var createIssue = function(issue, callback) {
	var url = destApiUrl + '/repos/' + dest.repo + '/issues';
	var data = {
			'title':issue.title,
			'body':issue.body + suffix(issue)
		};
	post(url, data, callback);
};

var createBranch = function createBranch(pull, callback) {
	var url = destApiUrl + '/repos/' + dest.repo + '/git/refs';
	var data = {
		'ref':'refs/heads/pr' + pull.number + 'base',
		'sha':pull.base.sha
	};
	console.log("Create branch " + data.ref);
	post(url, data, callback);
};

var createPull = function createBranch(pull, callback) {
	var url = destApiUrl + '/repos/' + dest.repo + '/pulls';
	var data = {
		'title':pull.title,
		'body':pull.body + suffix(pull),
		'head':'pr/' + pull.number + '/head',
		'base':'pr' + pull.number + 'base'
	};
	console.log("Create pull " + pull.number);
	post(url, data, callback);
};

var createBaseBranchAndPull = function createBaseBranchAndPull(pull, callback) {

	async.series([
		function(stepCallback) { createBranch(pull, stepCallback); },
		function(stepCallback) { createPull(pull, stepCallback); } 
		], callback);
};

var files = fs.readdirSync('maps/issues');
var issues = _.map(files, function(file) { return JSON.parse(fs.readFileSync('maps/issues/' + file)); });
issues = _.sortBy(issues, function(issue) { return issue.number; });

var pushBranches = function(callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
		console.log("branch" + issue.number);
		createBranch(issue, issueCallback);
	}, function(err) {
		if (err) {
			console.log(err);
		}
		callback(err);
	});
};

var pushIssues = function(callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
		console.log("issue " + issue.number);
		if (issue.pull_request) {
			createPull(issue, issueCallback);
		} else {
			createIssue(issue, issueCallback);
		}
	}, function(err) {
		if (err) {
			console.log(err);
		}
		callback(err);
	});
};

// try to create label (it might exist, if so ignore error)
var createLabel = function(callback) {
	var url = destApiUrl + '/repos/' + dest.repo + '/labels';
	var data = { 'name':importLabel, 'color':'fef2c0' };
	post(url, data, function() { callback(); });
};

var updateIssues = function(callback) {
	async.eachSeries(issues, function(issue, issueCallback) {
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
	var url = destApiUrl + '/repos/' + dest.repo + '/git/refs?per_page=100';
	get(url, function(err, refs) {
		if (err) {
			console.log(err);
		} else {
			branches = refs;
		}
		callback();
	});
};

var branchRegEx = /pr\d+base/;

var deleteBranches = function(callback) {
	var baseurl = destApiUrl + '/repos/' + dest.repo + '/git'
	async.eachSeries(branches, function(refObject, branchCallback) {
		var ref = refObject.ref;
		if (branchRegEx.test(ref)) {
			var url = baseurl + '/' + ref;
			console.log('Deleting ref ' + ref);
			invoke(rest.delete, url, null, branchCallback);
		} else {
			branchCallback();
		}
	}, function(err) {
		callback(err);
	});
}

var baseUrl = destApiUrl + '/repos/' + dest.repo;

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

var createCommitComment = function(commitComment, callback) {
	var url = urlForCommitComment(commitComment);
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
	var url = urlForCommitComment(pullComment);
	var pullNumber = pullComment.pull_request_url.split('/').pop();
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
	var comments = JSON.parse(fs.readFileSync('maps/comments.json'));
	async.eachSeries(comments, function(comment, commentCallback) {
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

	var url = destApiUrl + '/repos/' + dest.repo + '/git/commits/' + commit;
	get(url, function(err,data) {
		if (err) {
			missingCommits.push(commit);
			console.log('PROBLEM: commit ' + commit + ' missing');
		}
		callback(null);
	})
}

var checkCommits = function(callback) {
	var comments = JSON.parse(fs.readFileSync('maps/comments.json'));
	async.eachSeries(comments, function(comment, commentCallback) {

		if (reviewComment(comment)) {
			checkCommitExists(comment.original_commit_id, commentCallback)
		} else if (commitComment(comment)) {
			checkCommitExists(comment.commit_id, commentCallback);
		} else {
			commentCallback();
		}
	}, function(err) {
		fs.writeFileSync('maps/missingCommits.json', JSON.stringify(_.unique(missingCommits)));
		callback();
	})
}

async.series([
	pushBranches,
	pushIssues,
	updateIssues,
	fetchBranches,
	deleteBranches,
	checkCommits,
	pushComments,
	], function(err) {
		console.log(err);
	})
