var rest = require('unirest');
var fs = require('fs');
var async = require('async');

var source = {
	token: "c342a113328ad4eac39b2b7b0f7314435315b149",
	repo: "jci-sec/maps",
	proxy: "http://10.10.5.18:8080"
};
var sourceApiUrl = (source.options && source.options.url) || "https://api.github.com";
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