var rest = require('unirest');

var token = '50d8f42b21081d0d9790e6fe5f9875cb03edfff8';

var options = {
	ca: require('fs').readFileSync('/Users/mgwelch/DropBox/JCI Root CA.pem')
};

var request = rest
	.get('https://c201sa26.jci.com/api/v3/')
	.headers({
		'Authorization': 'token ' + token,
		'user-agent': 'node.js'			
	})
request.options.ca = options.ca;

request.end(function(response){
		console.dir(response.body);
	});
