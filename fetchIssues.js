var rest = require('unirest');
var fs = require('fs');
var async = require('async');
var _ = require('lodash');
var cli = require('cli');

cli.parse();


//constant
var owner = 'jci-sec'; // could be an org or a user

if (!cli.args[0]) {
	console.log('Usage: node fetchIssues.js repoName');
	return;
}
var repo = cli.args[0];

var source = {
	token: "c342a113328ad4eac39b2b7b0f7314435315b149",
	repo: owner + '/' + repo,
	//proxy: "http://10.10.5.18:8080"
};
var sourceApiUrl = (source.options && source.options.url) || "https://api.github.com";
var sourceRepoUrl = sourceApiUrl + '/repos/' + source.repo;

var sourceHeaders = {
	'Authorization': 'token ' + source.token,
	'user-agent': 'node.js'	
};
var invoke = function invoke(method, url, data, callback) {
	var request = method(url)
		.type('json')
		.headers(sourceHeaders);

	if (data) {
		request.send(data);
	}
	if (source.proxy) {
		request.proxy(source.proxy);
	}
	//request.options.ca = dest.ca;
	request.end(function(response) {
		if (response.error) {
			console.log("Error making call to " + url);
			console.log("With data: ");
			console.dir(data);
			console.dir(response.error);
		}
		callback(response.error, response.body);
	});
}

var get = function get(url, callback) {
	invoke(rest.get, url, null, callback);
}

var post = function post(url, data, callback) {
	invoke(rest.post, url, data, callback);
}

var anchorCommit = function(commit, callback) {
	var url = sourceRepoUrl + '/git/refs';
	var data = {'ref':'refs/anchor/' + commit, 'sha':commit};
	post(url, data, function(err) {
		if (err) {
			console.log('problem creating ref for ' + commit);
		}
		callback();
	});
}

var issuesDirName = repo + '/issues';
if (!fs.existsSync(repo)) { fs.mkdirSync(repo); }
if (!fs.existsSync(issuesDirName)) { fs.mkdirSync(issuesDirName); }

var getIssue = function getIssue(issueNumber, callback) {
	var issueUrl = sourceRepoUrl + '/issues/' + issueNumber;
	var pullUrl = sourceRepoUrl + '/pulls/' + issueNumber;



	var writeIssue = function(issue) {
		fs.writeFileSync(issuesDirName + '/issue' + issueNumber, JSON.stringify(issue));
	}

	get(issueUrl, function(err, issue) {
		if (err) {
			console.log(err);
			callback();
		} else {
			console.log("issue" + issueNumber);
			if (issue.pull_request) {
				get(pullUrl, function(err, pull) {
					if (err) {
						console.log(err);
					} else {
						issue.base = pull.base;
						issue.head = pull.head;
					}
					writeIssue(issue);
					getIssue(issueNumber + 1, callback);
				})
			} else {
				writeIssue(issue);
				getIssue(issueNumber + 1, callback);				
			}


		}
	});

};

var getIssues = function(callback) {
	getIssue(570, callback);
}

var getList = function getList(listId, callback) {
	var list = [];

	var getPage = function(pageNumber) {
		console.log("Getting page " + pageNumber + " of " + listId);
		var request = rest.get(sourceRepoUrl + '/' + listId + 
			'?page=' + pageNumber + '&state=all&per_page=100');
		request.headers({
			'Authorization': 'token ' + source.token,
			'user-agent': 'node.js'
		});

		if (source.proxy) {
			request.proxy(source.proxy);
		}

		request.end(function(response) {
			if (response.error) {
				callback(response.error, []);
			} else if (response.body.length === 0) {
				callback(null, list);
			} else {
				list = list.concat(response.body);
				getPage(pageNumber + 1);
			}
		})

	};

	getPage(1);
}

var getPullCommentList = function(callback) {
	getList('pulls/comments', callback);
};

var getIssueCommentList = function(callback) {
	getList('issues/comments', callback);
}

var getCommitComments = function(callback) {
	getList('comments', callback);
}

var mergeAndSortAllComments = function mergeAndSortAllComments(issueComments, commitComments, reviewComments) {
	return _.sortBy(issueComments.concat(commitComments).concat(reviewComments), function(comment) {
		return comment.created_at;
	});
};


var getComments = function(callback) {
	async.series([
		getPullCommentList,
		getIssueCommentList,
		getCommitComments,

		], function(err, results) {
			if (err) {
				callback(err);
			} else {
				var allComments = mergeAndSortAllComments(results[0], results[1], results[2]);
				fs.writeFileSync(repo + '/comments.json', JSON.stringify(allComments));
				callback(err, allComments);
			}
		});

}

var anchorCommits = function(callback) {
	var commits = JSON.parse(fs.readFileSync(repo + '/missingCommits.json'));
	async.eachSeries(commits, function(commit, commitCallback) {
		anchorCommit(commit, commitCallback)
	}, function(err) {
		callback(err);
	})
}


async.series([
	anchorCommits,
	//getIssues,
	//getComments, 
	], function(err) {
		if (err) {
			console.log('error: ' + JSON.stringify(err));
		}
		console.log('end');
	});

