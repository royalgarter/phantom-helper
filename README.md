# About

Rewrite most static functions for below purposes

* Compatile with another sync libraries (with callback is the last arguments)
* Add some handy function to wait for page loaded with ajax
* Render both light-weight html and image for Debug

# Prerequires: 

* Take a look at: https://github.com/baudehlo/node-phantom-simple (what we based on)
* Take a look at: http://phantomjs.org/api/command-line.html (the original one)


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

Without Callback Hell using wait.for

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

```
PhantomHelper.createDefaultPage = function(startURL, callback)

PhantomHelper.createPage = function(phantomHelperCfg, startURL, callback)
```

* phantom-helper configure

phantomOpt.parameters: is exactly the same as PhantomJs configure without '--'
See more here: http://phantomjs.org/api/command-line.html

```
{   
	"phantomOpt" : {		
		"parameters": {
			"ignore-ssl-errors": "yes",
			"load-images": "no",
			"disk-cache": "yes",
			"max-disk-cache-size": 10000,
			"proxy-type": "none"
		},
		"noWait": 0,     // not supported yet, leave as default
		"multiPage": 0   // not supported yet, leave as default
	},
	"viewportSize" : { "width": 1360, "height": 900 },
	"timeOutMillis" : 1000, // iterator timeout to check AJAX resources
	"maxTimeOutMillis" : 60000, // max timeout to check AJAX resources
	"maxTryFinishRes" : 3, // check the resource available n times to make sure AJAX loaded
	"timeInterval" : 300, // delay between each iterator check
	"isDebugRender" : 1, // render image and html
	"isMiniRender" : 1, // remove JS code in HTML render
	"isDebug" : 1 // for more console log to debugging
}
```


* Render a page with both html content and image (for debugging)

```
PhantomHelper.render = function(page, filepath, fnCallback, isForceRender)
```

* Execute inject function to phantom
If you want to pass by the input arguments for fnInject, they should placed right before the last callback function

```
// execute inject function and wait for any AJAX
PhantomHelper.doWait = function(page, fnInject, fnCallback)

// execute inject function and wait for any condition function
PhantomHelper.doWaitCond = function(page, fnInject, ifn_Condition, callback)

// wait for any AJAX then execute inject function
PhantomHelper.waitDo = function(page, fnInject, fnCallback)

// wait for any condition function then execute inject function
PhantomHelper.waitDoCond = function(page, fnInject, ifn_Condition, callback)

// execute inject function without waiting
PhantomHelper.do = function(page, fnInject, callback)
```

* Some handy overwrite function with support index when using document.querySelectorAll() in selector

```
PhantomHelper.click = function(page, query, index, isWait, fnCallback)

PhantomHelper.fill = function(page, query, index, value, fnCallback)

PhantomHelper.upload = function(page, query, filepath, fnCallback)
```

* Get value DOM value from page, queries should follow the below format
   Array: [query1, query2,... ,queryN]
   or
   Single string: queryStr

 Result is Hash object with queries as keys and their results as values

 Each query should be formatted as 'selector>>index>>attribute'.
 attribute is DOM attribute or 'text' for innerText and 'html' for innerHTML

 Example:
    queries = '.a div span>>0>>text';
    queries = ['.a div span>>0>>text', '.tr div a>>0>>html'];

```
PhantomHelper.getVal = function(page, queries, fnCallback)
```

* Waiting functions that wait for page AJAX loaded or some specified condition. The 'timeoutInterval' and 'maxTimeOutMillis' could be ommitted to use the default value

```
PhantomHelper.waitForCondition = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback)

PhantomHelper.waitPageLoaded = function (page, timeOutMillis, maxTimeOutMillis, callback)
```
