'use strict';
const _w = require('wait.for-es6');
const _ph = require('./ph');

/********** FLOW FUNCTIONS **********/
function* run() {
	let page = yield [_ph.createPage, phConfig, 'https://agenthub.jetstar.com/newtradeloginagent.aspx?culture=en-ZA'];
	// yield [_ph.waitForCondition, page, '#ip-box'];
	yield [_ph.render, page, 'res.jpg'];
	yield [page.close];
};

/********** MAIN FUNCTIONS **********/
const phConfig = {
	phantomOpt: {
		parameters: {
			'ignore-ssl-errors': 'yes',
			'load-images': 'yes',
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
	customHeaders: {
		'Connection': 'keep-alive',
	},
	userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36',
	timeOutMillis: 1000,
	maxTimeOutMillis: 60000,
	maxTryFinishRes: 3,
	timeInterval: 300,
	isDebugRender: 1,
	isMiniRender: 1,
	isDebug: 1
};

_w.launchFiber(run);
