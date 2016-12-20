'use strict';
const _w = require('wait.for-es6');
const _ph = require('./ph');

/********** FLOW FUNCTIONS **********/
function* run() {
	let page = yield [_ph.createPage, phConfig, 'https://www.whatismyip.com/'];
	yield [_ph.render, page, 'res.jpg'];
	yield [_ph.waitForCondition, page, '#ip-box']
	yield [page.close]
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
	timeOutMillis: 1000,
	maxTimeOutMillis: 60000,
	maxTryFinishRes: 3,
	timeInterval: 300,
	isDebugRender: 1,
	isMiniRender: 1,
	isDebug: 1
};

_w.launchFiber(run);
