var _wait = require('wait.for');
var _ph = require('./PhantomHelper');


/********** FLOW FUNCTIONS **********/
var run = function (page) {
	_wait.for(_ph.render, page, 'res.jpg');
	_wait.for(page.close);
}

/********** MAIN FUNCTIONS **********/
var phConfig = {
	phantomOpt: {
		parameters: {
			'ignore-ssl-errors': 'yes',
			'load-images': 'no',
			'ssl-protocol': 'tlsv1',
			'disk-cache': 'no',
			'proxy-type': 'none'
		},
		noWait: 0,
		multiPage: 0
	},
	viewportSize: {
		width: 1360,
		height: 900
	},
	timeOutMillis: 1000,
	maxTimeOutMillis: 60000,
	maxTryFinishRes: 3,
	timeInterval: 300,
	isDebugRender: 1,
	isMiniRender: 1,
	isDebug: 1
};

_ph.createPage(phConfig, 'https://www.whatismyip.com/', function (err, page) {
	console.log('createPage done', err);
	_wait.launchFiber(run, page);
});

