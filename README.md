# About

Rewrite most static functions for below purposes

* Compatile with another sync libraries (with callback is the last arguments)
* Add some handy function to wait for page loaded with ajax
* Render both light-weight html and image for Debug


# Basic sample

With Callback Hell

```
var _ph = require('./PhantomHelper');

_ph.createDefaultPage('http://www.google.com', function (err, page) {
	_ph.fill(page, '#gbqfq', 0, 'phantom-helper', function (err, result) {
		_ph.click(page, '#gbqfba', 0, 1, function (err, result) { 
			_ph.render(page, 'res.jpg', function (err, result) { 
				page.close();
			});
		});
	});
});

```

Without Callback Hell

```
var _w = require('wait.for');
var _ph = require('./PhantomHelper');

var run = function (page) {
	_w.for(_ph.fill, page, '#gbqfq', 0, 'phantom-helper');
	_w.for(_ph.click, page, '#gbqfba', 0, 1);
	_w.for(_ph.render, page, 'res.jpg');

	_w.for(page.close);
}

_ph.createDefaultPage('http://www.google.com', function (err, page) {
	_w.launchFiber(run, page);
});

```

# Functions

* Create page (phantom instance) with an url

PhantomHelper.createDefaultPage = function(startURL, callback)

PhantomHelper.createPage = function(phantomCfg, startURL, callback)

* Render a page with both html content and image (for debugging)

PhantomHelper.render = function(page, filepath, fnCallback, isForceRender)

* Execute inject function to phantom

If you want to pass by the input arguments for fnInject, they should placed right before the last callback function

PhantomHelper.doWait = function(page, fnInject, fnCallback)

PhantomHelper.doWaitCond = function(page, fnInject, ifn_Condition, callback)

PhantomHelper.waitDo = function(page, fnInject, fnCallback)

PhantomHelper.waitDoCond = function(page, fnInject, ifn_Condition, callback)

PhantomHelper.do = function(page, fnInject, callback)

* Some handy overwrite function with support index when using document.querySelectorAll() in selector

PhantomHelper.click = function(page, query, index, isWait, fnCallback)

PhantomHelper.getVal = function(page, queries, fnCallback)

PhantomHelper.fill = function(page, query, index, value, fnCallback)

PhantomHelper.upload = function(page, query, filepath, fnCallback)

* Waiting functions that wait for page AJAX loaded or some specified condition

PhantomHelper.waitForCondition = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback)

PhantomHelper.waitPageLoaded = function (page, timeOutMillis, maxTimeOutMillis, callback)

