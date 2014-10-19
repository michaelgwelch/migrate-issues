(function _() {
	'use strict';

	var MigrationClient = function(source, dest) {

		var github = require('octonode');
		var client = github.client(source.token || source.credentials, source.options);
		var repo = client.repo(source.repo);
		var destClient = github.client(dest.token || dest.credentials, dest.options);
		var destRepo = destClient.repo(dest.repo);

		var _ = require('lodash');

		this.getPullList = function(callback) {
			var pulls = [];

			var getPageOfPulls = function(pageNumber) {
				repo.prs({'page':pageNumber, 'state':'all'}, function(err, data, headers) {
					if (err) {
						console.dir(err); 
						callback([]);
					}
					else if (data.length === 0) {
						callback(_.sortBy(pulls));
					}
					else {
						pulls = pulls.concat(data);
						getPageOfPulls(pageNumber + 1);
					}
				});
			};

			getPageOfPulls(1);

		};


		this.getIssueList = function(callback) {
			var issues = [];

			var getPageOfIssues = function(pageNumber) {
				repo.issues({'page':pageNumber, 'state':'all'}, function(err, data, headers) {
					if (err) {
						console.dir(err);
						callback([]);
					} else if (data.length === 0) {
						callback(issues);
					} else {
						issues = issues.concat(data);
						getPageOfIssues(pageNumber + 1);
					}
				});
			};

			getPageOfIssues(1);
		};

		this.createIssue = function(issue, callback) {
			destRepo.issue({
				'title':issue.title,
				'body':issue.body + '\r\ngh---\r\nby: ' + issue.user.login + 
					'\r\ncreated: ' + issue.created_at +
					'\r\nclosed: ' + issue.closed_at
			}, callback);
		};
	};

	module.exports = MigrationClient;

})();