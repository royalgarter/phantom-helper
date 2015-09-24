var _wait = require('wait.for');
var _ph = require('./PhantomHelper');


/********** FLOW FUNCTIONS **********/

var run = function (page) {
	_wait.for(_ph.render, page, 'begin.jpg');
	_wait.for(_ph.fillEx, page, '[name="q"]', 'phantom-helper');
	_wait.for(_ph.clickNaEx, page, '[name="btnG"]:eq(0)', null, 1);
	_wait.for(_ph.render, page, 'res.jpg');

	_wait.for(page.close);
}


/********** MAIN FUNCTIONS **********/

// _ph.createDefaultPage(_host, function (err, page) {
// 	console.log('createPage done', err);
// 	_wait.launchFiber(run, page);
// });

_ph.createDefaultPage('http://www.google.com', function (err, page) {
	console.log('createPage done', err);
	_wait.launchFiber(run, page);
});

