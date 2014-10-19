(function _() {
	'use strict';

	var MigrationClient = function(source, dest) {

		var rest = require('unirest');
		var sourceApiUrl = (source.options && source.options.url) || "https://api.github.com";
		var sourceRepo = source.repo;

		var destApiUrl = (dest.option && dest.options.url) || "https://api.github.com";
		var destRepo = dest.repo;

		var _ = require('lodash');

		var getList = function getList(listId, callback) {
			var list = [];

			var getPage = function(pageNumber) {

				var request = rest.get(sourceApiUrl + '/repos/' + sourceRepo + '/' + listId + 
					'?page=' + pageNumber + '&state=all');
				request.headers({
					'Authorization': 'token ' + source.token,
					'user-agent': 'node.js'
				});

				request.end(function(response) {
					if (response.error) {
						console.dir(response);
						callback([]);
					} else if (response.body.length === 0) {
						callback(list);
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

		var suffix = function suffix(issue) {
			return '\r\n\r\n*GitHub Import*\r\n' +
					'**Author:** ' + issue.user.login + '\r\n' +
					'**Created:** ' + issue.created_at + '\r\n' +
					'**Closed:** ' + issue.closed_at + '\r\n';
					// '| created by | create date | close date |\r\n' +
			  //      	'|------------|-------------|------------|\r\n' +
			  //      	'| ' + issue.user.login + ' | ' + issue.created_at + ' | ' + issue.closed_at + ' |';

		}

		var updateIssue = function(issueUpdate, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/issues/' + issueUpdate.number;
			var request = rest.patch(url)
				.type('json')
				.headers({
					'Authorization': 'token ' + source.token,
					'user-agent': 'node.js'					
				})
				.send({
					'state':issueUpdate.state
				})
				.end(function() {
					callback();
				});
		}

		this.createIssue = function(issue, callback) {
			var url = destApiUrl + '/repos/' + destRepo + '/issues';
			var request = rest.post(url)
				.type('json')
				.headers({
					'Authorization': 'token ' + source.token,
					'user-agent': 'node.js'
				})
				.send({
					'title':issue.title,
					'body':issue.body + suffix(issue)
				})
				.end(function(response) {
					if (issue.state === 'closed') {
						updateIssue(issue, callback);
					} else {
						callback();
					}
				});

		};

		this.createPull = function(pull, callback) {

			// task #1: push the base sha up to a branch
			var url = destApiUrl + '/repos/' + destRepo + '/git/refs';
			var request = rest.post(url)
				.type('json')
				.headers({
					'Authorization': 'token ' + source.token,
					'user-agent': 'node.js'					
				})
				.send({
					'ref':'refs/heads/pr' + pull.number + 'base',
					'sha':pull.base.sha
				})
				.end(function(response) {
					if (response.error) {
						console.dir(response.error);
						callback();
					} else {
						// task #2: create the pull
						url = destApiUrl + '/repos/' + destRepo + '/pulls';
						var request = rest.post(url)
							.type('json')
							.headers({
								'Authorization': 'token ' + source.token,
								'user-agent': 'node.js'					
							})
							.send({
								'title':pull.title,
								'body':pull.body + suffix(pull),
								'head':'pr/' + pull.number + '/head',
								'base':'pr' + pull.number + 'base'
							})
							.end(function(response){
								if (response.error) console.log(response.error);
								callback();
							});			
					}
				});



			// task #3: update the pull

		};
	};

	module.exports = MigrationClient;

})();