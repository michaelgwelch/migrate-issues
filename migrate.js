(function _() {
	'use strict';

	var MigrationClient = function(source, dest) {
		var async = require('async');
		var moment = require('moment');
		var rest = require('unirest');
		var sourceApiUrl = (source.options && source.options.url) || "https://api.github.com";
		var sourceRepo = source.repo;
		var sourceProxy = source.proxy;

		var destApiUrl = (dest.options && dest.options.url) || "https://api.github.com";
		var destRepo = dest.repo;

		var _ = require('lodash');

		var getList = function getList(listId, callback) {
			var list = [];

			var getPage = function(pageNumber) {
				console.log("Getting page " + pageNumber + " of " + listId);
				var request = rest.get(sourceApiUrl + '/repos/' + sourceRepo + '/' + listId + 
					'?page=' + pageNumber + '&state=all&per_page=100');
				request.headers({
					'Authorization': 'token ' + source.token,
					'user-agent': 'node.js'
				});

				if (source.proxy) {
					request.proxy(sourceProxy);
				}

				request.end(function(response) {
					if (response.error) {
						console.dir(response);
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

		this.getPullList = function(callback) {
			getList('pulls', callback);

		};


		this.getIssueList = function(callback) {
			getList('issues', callback);
		};

		this.getPullCommentList = function(callback) {
			getList('pulls/comments', callback);
		};

		this.getIssueCommentList = function(callback) {
			getList('issues/comments', callback);
		}

		this.getCommitComments = function(callback) {
			getList('comments', callback);
		}

		var dateFormat = 'MMM Do YY';
		var formatDate = function formatDate(date) {
			return moment(date).format(dateFormat);
		}

		var suffix = function suffix(issue) {
			var creation = formatDate(issue.created_at);
			
			var closing = "";
			if (issue.closed_at) {
				closing = formatDate(issue.closed_at);
			}

			var result = '\r\n\r\n> ' +
					'Originally authored on GitHub by ' + issue.user.login + 
					' on ' + creation;

			if (closing !== '') {
				result = result + "\r\nClosed on GitHub";
				if (issue.closed_by) {
					result = result + ' by ' + issue.closed_by
				}
				result = result + ' on ' + closing + '\r\n';
			}
			return result;
		}

		var destHeaders = {
			'Authorization': 'token ' + dest.token,
			'user-agent': 'node.js'	
		};

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
					console.log("Error making call to " + url);
					console.log("With data: ");
					console.dir(data);
					console.dir(response.error);
				}
				callback(response.error, response);
			});
		}

		var get = function get(url, callback) {
			invoke(rest.get, url, null, callback);
		}

		this.checkBaseCommit = function(issue, callback) {
			if (issue.base.sha && issue.base.sha !== 'fc81586fd3068d5c102596694469bcd334c280c9') {
				console.log(issue.base.sha);

				var url = destApiUrl + '/repos/' + destRepo + '/git/commits/' + issue.base.sha;
				get(url, function(err,data) {
					if (err) {
						console.log('PROBLEM: commit ' + issue.base.sha + ' missing');
					}
					callback(null);
				})
			} else {
				callback(null);
			}
		}

		var patch = function patch(url, data, callback) {
			invoke(rest.patch, url, data, callback);
		}

		var post = function post(url, data, callback) {
			invoke(rest.post, url, data, callback);
		}

		this.updateIssue = function(issueUpdate, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/issues/' + issueUpdate.number;
			var data = {
					'state':issueUpdate.state
				};
			patch(url, data, callback);
		}

		this.createIssue = function(issue, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/issues';
			var data = {
					'title':issue.title,
					'body':issue.body + suffix(issue)
				};
			post(url, data, callback);
		};

		var createBranch = function createBranch(pull, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/git/refs';
			var data = {
				'ref':'refs/heads/pr' + pull.number + 'base',
				'sha':pull.base.sha
			};
			console.log("Create branch " + data.ref);
			post(url, data, callback);
		};

		var createPull = function createBranch(pull, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/pulls';
			var data = {
				'title':pull.title,
				'body':pull.body + suffix(pull),
				'head':'pr/' + pull.number + '/head',
				'base':'pr' + pull.number + 'base'
			};
			console.log("Create pull " + pull.number);
			post(url, data, callback);
		};

		this.createBaseBranchAndPull = function(pull, callback) {

			async.series([
				function(stepCallback) { createBranch(pull, stepCallback); },
				function(stepCallback) { createPull(pull, stepCallback); } 
				], callback);
		};


		this.createPullComment = function(pullComment, callback) {
			var pullNumber = pullComment.pull_request_url.split('/').pop();
			var url = destApiUrl + '/repos/' + destRepo + '/pulls/' + pullNumber + '/comments';
			var data = {
					'body':pullComment.body + suffix(pullComment),
					'commit_id':pullComment['original_commit_id'],
					'path':pullComment.path,
					'position':pullComment['original_position']
				};
			post(url, data, callback);
		};

		this.createIssueComment = function(issueComment, callback) {
			var issueNumber = issueComment.issue_url.split('/').pop();
			var url = destApiUrl + '/repos/' + destRepo + '/issues/' + issueNumber + '/comments';
			var data = {
					'body':issueComment.body + suffix(issueComment),
				};
			post(url, data, callback);			
		};

		this.createCommitComment = function(commitComment, callback) {
			var commitSha = commitComment.commit_id;
			var url = destApiUrl + '/repos/' + destRepo + '/commits/' + commitSha + '/comments';
			var data = {
					'body':commitComment.body + suffix(commitComment),
					'sha':commitSha,
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
	};

	module.exports = MigrationClient;

})();