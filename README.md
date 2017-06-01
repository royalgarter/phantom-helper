# About

Rewrite most static functions for below purposes

* Compatile with another sync libraries (with callback is the last argument)
* Add some handy function to wait for page loaded with ajax
* Render both light-weight html and image for Debugging


# Prerequires: 

* Take a look at: https://github.com/baudehlo/node-phantom-simple (what we based on)
* Take a look at: http://phantomjs.org/api/command-line.html (the original one)


# Basic sample

* With Callback Hell

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

* Without Callback Hell using wait.for

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

### Create page (phantom instance) with an url

```javascript
PhantomHelper.createDefaultPage = function(startURL, callback) {}

PhantomHelper.createPage = function(phantomHelperCfg, startURL, callback) {}
```

### Configuration

phantomOpt.parameters: is exactly the same as PhantomJs configure without '--'
See more here: http://phantomjs.org/api/command-line.html

```javascript
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


### Render a page with both html content and image (for debugging)

```javascript
PhantomHelper.render = function(page, filepath, fnCallback, isForceRender) {}
```

### Execute inject function to phantom
If you want to pass by the input arguments for fnInject, they should placed right before the last callback function

```javascript
// execute inject function and wait for any AJAX
PhantomHelper.doWait = function(page, fnInject, fnCallback) {}

// execute inject function and wait for any condition function
PhantomHelper.doWaitCond = function(page, fnInject, ifn_Condition, callback) {}

// wait for any AJAX then execute inject function
PhantomHelper.waitDo = function(page, fnInject, fnCallback) {}

// wait for any condition function then execute inject function
PhantomHelper.waitDoCond = function(page, fnInject, ifn_Condition, callback) {}

// execute inject function without waiting
PhantomHelper.do = function(page, fnInject, callback) {}
```

### Some handy overwrite function with support index when using document.querySelectorAll() in selector


```javascript
PhantomHelper.fill = function(page, query, index, value, fnCallback) {}

PhantomHelper.click = function(page, query, index, isWait, fnCallback) {}

PhantomHelper.clickEx = function(page, query, isWait, fnCallback) {}
// Support jQuery like selector with :eq(<index>) to clarify index of DOM

PhantomHelper.clickNaEx = function(page, query, options/*(default null)*/, isWait, fnCallback) {}
// Apply the native click (click at XY coordinate based on viewportSize). See more at: http://phantomjs.org/api/webpage/method/send-event.html

PhantomHelper.fillEx = function(page, query, value, fnCallback) {}

PhantomHelper.upload = function(page, query, filepath, fnCallback) {}

```

### Get value DOM value from page, queries should follow the below format

* Array: [queryStr1, queryStr2, ... queryStrN]
* Single string: queryStr

 Result is Hash object with queries as keys and their results as values

 Each query should be formatted as 'selector>>index>>attribute'.
 attribute is DOM attribute or 'text' for innerText and 'html' for innerHTML

 * Example:
    queries = '.a div span>>0>>text';
    queries = ['.a div span>>0>>text', '.tr div a>>0>>html'];

```javascript
PhantomHelper.getVal = function(page, queries, fnCallback) {}
```

### Waiting functions that wait for AJAX loaded or specified condition
* All the timeout could be ommitted to use the default value from config

```javascript
PhantomHelper.waitForCondition = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {}

PhantomHelper.waitPageLoaded = function (page, timeOutMillis, maxTimeOutMillis, callback) {}
```

### Super handy waiting function


```javascript
PhantomHelper.wait = function(page, condition, callback) {}

/* 
condition could be:
* number: wait in ms
* string: selector string, wait for that element existed
* array: array of selector strings, wait for all elements existed
* function: wait for that condition function return true

If condition is omitted (page, callback), default waitPageLoaded will be called

*/

```