var _phantomjs = require('node-phantom-simple');
var _fs = require('fs');

var _utils = require('./utils/Utils');

var _hook = require('./utils/hook_stdout');

var _cfgPH = require('./config/PhantomHelper.json');

var _CRITICAL_ERRORS = [
'Request() error evaluating open()',
'Error: read ECONNRESET'
]

var PhantomHelper = {};
module.exports = PhantomHelper;

var ERR_ARGS = 'Not enough arguments';

PhantomHelper.createDefaultPage = function(startURL, callback) {
	return PhantomHelper.createPage(_cfgPH, startURL, callback);
}

PhantomHelper.createPage = function(phantomCfg, startURL, callback) {
	_utils.isDebug = phantomCfg.isDebug;
	_utils.logD(phantomCfg);

	_cfgPH = phantomCfg;
	var countTry = 0;
	var maxCountTry = 3;
	var delayRetry = 5000;
	
	var fnCreatePhantom = function(phantomCfg, startURL, callback) {
		countTry++;

		var fnRetry = function() {
			if (countTry < maxCountTry) {
				_utils.logD('Retry create phantom:', countTry);
				fnCreatePhantom(phantomCfg, startURL, callback);
			} else {
				callback('Cannot create phantom browser & page');
			}
		}

		return _phantomjs.create(phantomCfg, function (err, phantom) {
			if (err) {
				_utils.logD('Cannot create phantom browser:', err);
				setTimeout(fnRetry, delayRetry);
				return;
			}

			phantom.createPage(function (err, page) {
				if (err) {
					_utils.logD('Cannot create phantom page:', err);
					phantom.exit();
					setTimeout(fnRetry, delayRetry);
					return;
				}

				page.countRes = 0;
				page.isLoading = true;
				page.multiPage = phantomCfg.multiPage;
					
				page.onResourceRequested = function (request, a) {
					//**/_utils.logD(request);				
					if (request.url.indexOf('.js') < 0)
						return;

					page.countRes++;
					//page.allResIds[request.id] = 1;
					//console.log('-- REQ ' + request.id + ' ' + request.method + ' ' + request.url);
					//var reqUrl = request.url;
					//**/_utils.logD(page.countRes, reqUrl);
				};
				 
				page.onResourceReceived = function (response) {
					if (response.url.indexOf('.js') < 0)
						return;

					//**/_utils.logD(response);
					if (!response.stage || response.stage === 'end') {
						page.countRes--;
						//page.allResIds[response.id] = 0;
						//console.log('-- DONE ' + response.id + ' ' + response.status + ' ' + response.url);
						//**/_utils.logD(page.countRes, response.url);
					}
				};

				page.onNavigationRequested = function(obj) {
					//**/_utils.logD('Trying to navigate to: ' + obj);
				}
				
				page.onResourceError = function(resourceError) {
					page.countRes--;
					//page.allResIds[resourceError.id] = 0;
					//console.log('-- TIMEOUT ' + resourceError.id + ' ' + resourceError.errorCode + ' ' + resourceError.url);
					//**/_utils.logD(page.countRes, resourceError.url);
				};

				page.onResourceTimeout = function(request) {
					page.countRes--;
					//page.allResIds[request.id] = 0;
					//console.log('-- TIMEOUT ' + request.id + ' ' + request.method + ' ' + request.url);
				};
				
				page.onConsoleMessage = function(msg, lineNum, sourceId) {
					if (process.env.PORT) return;
					//**/_utils.logD('CONSOLE: ' + msg + ' (from line #' + lineNum + ' in "' + sourceId + '")');
					/**/_utils.logD('CONSOLE: ' + msg);
				};
				
				page.onLoadFinished = function(status) {
					//**/_utils.logD('onLoadFinished: ' + status);
					page.isLoading = false;
				};
				
				page.onLoadStarted = function() {
					page.isLoading = true;
				};
				
				page.onClosing = function(closingPage) {
					/**/_utils.logD('The page is closing!', closingPage);

					if (page.multiPage) return;
					phantom.exit();
				};
				
				page.onError = function(msg, trace) {
					var msgStack = ['PHANTOM internal page.onError: ' + msg];
					if (trace && trace.length) {
						msgStack.push('TRACE:');
						trace.forEach(function(t) {
							msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function + '")' : ''));
						});
					}
					//**/_utils.logD(msgStack.join('\n'));
				};

				process.on('SIGTERM', function () {
				  	_utils.logD('SIGTERM on PhantomHelper');
					phantom.exit();
				});

				process.on('uncaughtException', function(err) {
				  _utils.logD('Caught exception: ' + err);
				});

				_hook.setup(function (string, encoding, fd) {
					if (string.length > 0 && string.indexOf('STDOUT') < 0) {
						//console.log('STDOUT: ', string);
						for (var i = _CRITICAL_ERRORS.length - 1; i >= 0; i--) {
							if (string.indexOf(_CRITICAL_ERRORS[i]) >= 0)
								process.exit(1);
						};
					}
				});

				_utils.logD('Preparing phantom page done');

				try {
					_utils.logD('Openning:', startURL);

					if (phantomCfg.settings) {
						page.set('settings', phantomCfg.settings, function (err, res) {});
					}

					if (phantomCfg.viewportSize) {
						page.set('viewportSize', phantomCfg.viewportSize, function (err, res) {});
					}

					return setTimeout(function () {

						var proxyRaw = phantomCfg.phantomOpt.parameters.proxy;
						var proxy = proxyRaw;
						if (proxyRaw) {
							console.log('Proxies:', proxyRaw);
							if (Array.isArray(proxyRaw)) {
								var idx = Math.floor((Math.random() * proxyRaw.length));
								proxy = proxyRaw[idx];
							}
							console.log('Using proxy:', proxy);
							page.proxy = proxy;
							var words = proxy.split(':');
							if (words.length >= 2)
								phantom.setProxy(words[0], words[1], 'manual', '', '');
						}

						return page.open(startURL, function (err, status) {
							_utils.logD('Openned:', err, status);
							if (err) {
								_utils.logD('Cannot open phantom page:', startURL, err);
								phantom.exit();
								setTimeout(fnRetry, delayRetry);
								return;
							}
							//console.log(phantomCfg);
							if (phantomCfg.noWait) return callback(null, page);

							PhantomHelper.waitPageLoaded(page, function() {
								return callback(null, page);
							});
						});
					}, 1000);
				} catch (ex) {
					_utils.logD('Cannot open phantom page:', startURL, ex);
					phantom.exit();
					setTimeout(fnRetry, delayRetry);
				}
			});
		});			
	}

	return fnCreatePhantom(phantomCfg, startURL, callback);
}

PhantomHelper.render = function(page, filepath, fnCallback, isForceRender) {

	try {
		if (!isForceRender) {
			if (!_cfgPH.isDebugRender && (process.env.RENDER == undefined || !process.env.RENDER)) {

				if (_utils.isFunc(fnCallback)) 
					return fnCallback(null);
			}	
		}
		
		page.get('content', function (err, res) {
			if (_cfgPH.isMiniRender) {
				//res = res.replace(/\n/g, '').replace(/<script.*>.*<\/script>/gi, '');
				res = res.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
			}

			var htmlFilepath = filepath.replace('.jpg', '').replace('.png', '').replace('.bmp', '') + '.html';
			_fs.writeFileSync(htmlFilepath, res);
			page.render(filepath, function (err) {
				if (err != null) {
					_utils.logD('Render error:' + filepath, err);
				}

				if (_utils.isFunc(fnCallback)) 
					return fnCallback(null);
			});
		});

	} catch (ex) {
		_utils.logD('RENDER EX:', ex);
		if (_utils.isFunc(fnCallback))
			return fnCallback(null);
	}
}

PhantomHelper.doWait = function(page, fnInject, fnCallback) {
	
	var args = [].splice.call(arguments, 0, arguments.length);
	args.splice(2, 0, null);
	PhantomHelper.doWaitCond.apply(PhantomHelper, args);
}

PhantomHelper.doWaitCond = function(page, fnInject, ifn_Condition, callback) {
	
	var ARG_LEN = 4;

	var fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length-1] : null;

	var args = [].splice.call(arguments, 0, arguments.length);
	
	var ifn_args = args.splice(ARG_LEN - 1, args.length - ARG_LEN);
	
	var fnEvalCb = function(err, result) {		
		_utils.handle(err);

		if (_utils.isUnDefOrNull(ifn_Condition))
			return PhantomHelper.waitPageLoaded(page, function (err) {
				return fnCallback(err, result);
			});
		else
			return PhantomHelper.waitForCondition(page, ifn_Condition, function (err) {
				return fnCallback(err, result);
			});
	};	
	
	var evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_args);
	evalArgs.push(fnEvalCb);
	
	page.evaluate.apply(page, evalArgs);
}

PhantomHelper.do = function(page, fnInject, callback) {

	var ARG_LEN = 3;
	
	var fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length-1] : null;

	var args = [].splice.call(arguments, 0, arguments.length);

	var ifn_params = args.splice(ARG_LEN - 1, args.length - ARG_LEN);

	var evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_params);
	evalArgs.push(fnCallback);

	page.evaluate.apply(page, evalArgs);
}

PhantomHelper.waitDo = function(page, fnInject, fnCallback) {
	
	var args = [].splice.call(arguments, 0, arguments.length);
	args.splice(2, 0, null);
	PhantomHelper.waitDoCond.apply(PhantomHelper, args);
}

PhantomHelper.waitDoCond = function(page, fnInject, ifn_Condition, callback) {
	
	var ARG_LEN = 4;

	var fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length-1] : null;

	var args = [].splice.call(arguments, 0, arguments.length);
	
	var ifn_args = args.splice(ARG_LEN - 1, args.length - ARG_LEN);

	var evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_args);
	evalArgs.push(fnCallback);

	if (_utils.isUnDefOrNull(ifn_Condition))
		PhantomHelper.waitPageLoaded(page,  function() {
			page.evaluate.apply(page, evalArgs);
		});
	else
		PhantomHelper.waitForCondition(page, ifn_Condition, function() {
			page.evaluate.apply(page, evalArgs);
		});
}

PhantomHelper.click = function(page, query, index, isWait, fnCallback){

	if (!_utils.isStr(query)) {
		var err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}

	if (_utils.isFunc(index)) {
		fnCallback = index;
		index = 0;
		isWait = 0;
	}

	if (_utils.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}

	page.evaluate(
		function (query, index) {
			if (document.querySelectorAll(query).length < index + 1)
				return false

			var ev = document.createEvent('MouseEvent');
			ev.initEvent('click', true, false);
			//ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
			document.querySelectorAll(query)[index].dispatchEvent(ev);

			return true;
		}, 
		query, index,
		function (err, result) {
			if (result && result == true) {
				if (!isWait)
					return fnCallback(err, result);

				PhantomHelper.waitPageLoaded(page,  function() {
					fnCallback(err, result);
				});
			}
			else {
				var err = 'Click failed, ' + query + ' not found!'
				_utils.logD(err);

				if (!isWait)
					return fnCallback(err, result);

				PhantomHelper.waitPageLoaded(page,  function() {
					fnCallback(err, result);
				});
			}
		}
	);
}

PhantomHelper.clickEx = function(page, query, isWait, fnCallback){

	if (!_utils.isStr(query)) {
		var err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}

	if (_utils.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}

	page.evaluate(
		function (fnQueryStr, query) {

			eval('var $ = ' + fnQueryStr);
			//console.log($);
			var obj = $(query);
			//console.log(obj);

			if (!obj) return false;

			//ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
			var ev = document.createEvent('MouseEvent');
			ev.initEvent('click', true, false);
			obj.dispatchEvent(ev);

			return true;
		}, 
		PhantomHelper.exQuerySelectorAll.toString(), query,
		function (err, result) {
			if (result && result == true) {
				if (!isWait)
					return fnCallback(err, result);

				PhantomHelper.waitPageLoaded(page,  function() {
					fnCallback(err, result);
				});
			}
			else {
				var err = 'Click failed, ' + query + ' not found!'
				_utils.logD(err);

				if (!isWait)
					return fnCallback(err, result);

				PhantomHelper.waitPageLoaded(page,  function() {
					fnCallback(err, result);
				});
			}
		}
	);
}


/* 
options = {
	dx: 0,
	dy: 0,
	type: 'left'
}
*/
PhantomHelper.clickNaEx = function(page, query, options, isWait, fnCallback){

	if (!_utils.isStr(query)) {
		var err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}

	if (_utils.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}

	options = (options === undefined || options === null) ? {} : options;
	options.dx = options.dx ? options.dx : 0;
	options.dy = options.dy ? options.dy : 0;
	options.type = options.type ? options.type :'left';

	page.evaluate(
		function (fnQueryStr, query) {

			var getOffsetRect = function(elem) {

				if (!elem) return null;
				//console.log(elem);
				var box = elem.getBoundingClientRect();
				//console.log(box);

				var body = document.body;
				var docElem = document.documentElement;

				var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
				var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

				var clientTop = docElem.clientTop || body.clientTop || 0;
				var clientLeft = docElem.clientLeft || body.clientLeft || 0;

				var top  = box.top +  scrollTop - clientTop;
				var left = box.left + scrollLeft - clientLeft;

				return { top: Math.round(top), left: Math.round(left), width: box.width, height: box.height };
			}

			eval('var $ = ' + fnQueryStr);
			//console.log($);
			var obj = $(query);
			//console.log(obj);

			if (!obj) return null;

			return getOffsetRect(obj);
		}, 
		PhantomHelper.exQuerySelectorAll.toString(), query,
		function (err, result) {
			console.log('RECT', result);
			if (result) {
				return page.sendEvent('click', result.left + options.dx, result.top + options.dy, options.type, function (err) {
					if (!isWait)
						return fnCallback(err, result);

					PhantomHelper.waitPageLoaded(page,  function() {
						fnCallback(err, result);
					});
				});
			} else {
				var err = 'Click failed, ' + query + ' not found!'
				_utils.logD(err);

				if (!isWait)
					return fnCallback(err, result);

				return PhantomHelper.waitPageLoaded(page,  function() {
					fnCallback(err, result);
				});
			}
		}
	);
}

PhantomHelper.getVal = function(page, queries, fnCallback){
	var SPLIT = '>>';

	if (typeof(queries) == 'string')
		queries = [queries];

	if (queries.length < 1)
		return fnCallback('Queries are not valid array');

	var results = {};

	while (queries.length > 0) {
		var query = queries.pop();

		var words = query.split(SPLIT);
		var len = words.length;
		var count = 0;
		var qSelector, qIdx=0, qAttribute='text', fnGetVal=null;

		if (len > count) qSelector = words[count++];
		if (len > count) qIdx = parseInt(words[count++]);
		if (len > count) qAttribute = words[count++];

		//console.log(qSelector, qIdx, qAttribute);

		switch (qAttribute) {
			case 'html':
				fnGetVal = function (query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].innerHTML
						};
					} catch (ex) {
						return {key: query, value: null};
					}
				}
				break;
			case 'text':
				fnGetVal = function (query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].innerText
						};
					} catch (ex) {
						return {key: query, value: null};
					}
				}
				break;
			default:
				fnGetVal = function (query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].getAttribute(qAttribute)
						};
					} catch (ex) {
						return {key: query, value: null};
					}
				}
		}

		//console.log(JSON.stringify(fn));

		if (fnGetVal == null) {
			if (queries.length == 0) {
				return fnCallback(null, results);
			}
			continue;
		}

		page.evaluate(fnGetVal, query, qSelector, qIdx, qAttribute, function (err, val) {
			results[val.key] = val.value;

			if (queries.length == 0) {
				return fnCallback(null, results);
			}
		});
	}
}

PhantomHelper.fill = function(page, query, index, value, fnCallback){

	if (!_utils.isStr(query)) {
		var err = 'Fill failed, query argument is not string!'
		return fnCallback(err);
	}

	page.evaluate(
		function (query, index, value) {
			if (document.querySelectorAll(query).length < index + 1)
				return false

			document.querySelectorAll(query)[index].value = value;

			return true;
		}, 
		query, index, value,
		function (err, result) {
			if (result && result == true) {
				return fnCallback(err, result);
			}
			else {
				var err = 'Fill failed, ' + query + ' not found!'
				_utils.logD(err);

				return fnCallback(err, result);
			}
		}
	);
}

PhantomHelper.fillEx = function(page, query, value, fnCallback){

	if (!_utils.isStr(query)) {
		var err = 'Fill failed, query argument is not string!'
		return fnCallback(err);
	}

	page.evaluate(
		function (fnQueryStr, query, value) {

			eval('var $ = ' + fnQueryStr);
			var obj = $(query);

			if (!obj) return false;

			obj.value = value;

			return true;
		}, 
		PhantomHelper.exQuerySelectorAll.toString(), query, value,
		function (err, result) {
			if (result && result == true) {
				return fnCallback(err, result);
			}
			else {
				var err = 'Fill failed, ' + query + ' not found!'
				_utils.logD(err);

				return fnCallback(err, result);
			}
		}
	);
}

PhantomHelper.upload = function(page, query, filepath, fnCallback){
	return page.upload(query, filepath, fnCallback);
}

PhantomHelper.waitForConditionSafe = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {
	var fnCallback = arguments.length > 2 ? arguments[arguments.length-1] : null;
	return PhantomHelper.waitForCondition(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, function (err, result) {
		return fnCallback(null, {err: err, result: result});
	});
}

PhantomHelper.waitForCondition = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {
	
	var fnCallback = arguments.length > 2 ? arguments[arguments.length-1] : null;

	var startTime = Date.now();
	//var testRunning = false;
	timeoutInterval = _utils.isNum(timeoutInterval) ? timeoutInterval : _cfgPH.timeInterval;
	maxTimeOutMillis = _utils.isNum(maxTimeOutMillis) ? maxTimeOutMillis : _cfgPH.maxTimeOutMillis;

	var fnHandle = function (err, result) {
		//testRunning = false;
		//**/_utils.logD('fnHandle', err, result);
		if (result) {
			_utils.logD('wait finished in', Date.now() - startTime, 'ms');
			fnCallback(err, result);
		}
		else {
			setTimeout(testForSelector, timeoutInterval);
		}
	}

	var testForSelector = function () {
		//if (testRunning) return setTimeout(testForSelector, timeoutInterval);
		//testRunning = true;

		var elapsedTime = Date.now() - startTime;
		if (elapsedTime > maxTimeOutMillis) {
			/**/_utils.logD('Timeout waiting for ifn_Condition');
			return fnCallback('Timeout waiting for ifn_Condition', null);
		}

		switch (typeof(ifn_Condition)) {
			case 'string':
				//**/_utils.logD('string');
				var argsCond = PhantomHelper.buildFnCondition(ifn_Condition);
				//argsCond.splice(1, 0, fnHandle);
				argsCond.push(fnHandle);
				page.evaluate.apply(page, argsCond);
				break;
			case 'function':
				//**/_utils.logD('function');
				page.evaluate(ifn_Condition, fnHandle);
				break;
			case 'object':
				//**/_utils.logD('object');
				
				if (Array.isArray(ifn_Condition)) {
					var count = 0;
					_async.whilst(
					    function () { return count < ifn_Condition.length; },
					    function (fnWhilst) {
					    	var argsCond = PhantomHelper.buildFnCondition(ifn_Condition[count]);
					    	/**/_utils.logD('fnCond', ifn_Condition[count], argsCond);
					    	var fnEvalCb = function (err, res) {
					    		count++;
					    		if (err || !res)
					    			fnWhilst(ifn_Condition[count]);
					    		fnWhilst(null);
					    	}

					    	//argsCond.splice(1, 0, fnEvalCb);
					    	argsCond.push(fnHandle);
					    	page.evaluate.apply(page, argsCond);
					    },
					    function (err) {
					        if (err)
					        	return setTimeout(testForSelector, timeoutInterval);
					        return fnCallback(null);
					    }
					);
				} else {
					fnCallback('ifn_Condition is invalid', null);
				}
				
				break;
			default: 
				fnCallback('ifn_Condition is invalid', null);
		}
	};
	 
	setTimeout(testForSelector, timeoutInterval);
}

PhantomHelper.waitPageLoaded = function (page, timeOutMillis, maxTimeOutMillis, callback) {

	var fnCallback = arguments.length > 1 ? arguments[arguments.length-1] : null;
	var timeOutMillis = _utils.isNum(timeOutMillis) ? timeOutMillis : _cfgPH.timeOutMillis;
	var maxTimeOutMillis = _utils.isNum(maxTimeOutMillis) ? maxTimeOutMillis : _cfgPH.maxTimeOutMillis;

	var start = new Date().getTime();
	var countFinishRes = 0;
	
	var interval = setInterval(function() {
		var deltaTime = new Date().getTime() - start;
		var waitDone = false;
		var err = null;
		
		if (deltaTime > maxTimeOutMillis) {
			waitDone = true;
			_utils.logD('wait too long in ' + deltaTime + ' ms, ' + page.countRes + ' resources remained');
			//**/_utils.logD(err);
		} else if (deltaTime > timeOutMillis) {			
			if (page.isLoading == true || page.countRes > 0) {
				countFinishRes = 0;
				return;
			}
			if (countFinishRes++ < _cfgPH.maxTryFinishRes) return;
		
			waitDone = true;
			/**/_utils.logD('wait finished in ', deltaTime, ' ms');
		}
		
		if (waitDone) {			
			clearInterval(interval); 
			countFinishRes = 0;	
			
			page.countRes = 0;
			page.isLoading = false;

			if (_utils.isFunc(fnCallback))
				return fnCallback(err);
			else 
				return fnCallback;
		}
		
	}, _cfgPH.timeInterval); 
}

/***************************** SUPPORT FUNCTIONS *******************************/

PhantomHelper.buildFnCondition = function (strCond) {
	var SPLIT = '>>';

	var words = strCond.split(SPLIT);
	var len = words.length;
	var count = 0;
	var qSelector, qIdx, qAttribute, qRegex;

	if (len > count) qSelector = words[count++];
	if (len > count) qIdx = parseInt(words[count++]);
	if (len > count) qAttribute = words[count++];
	if (len > count) qRegex = words[count++];

	var fnCond = function (qSelector, qIdx, qAttribute, qRegex) {
		try {
			//**/console.log(1);
			if (!(typeof qSelector === 'undefined' || qSelector == null)) {
				qSelector = qSelector.toString();
				if (qSelector.indexOf('!') == 0) {
					qSelector = qSelector.substr(1);
					//**/console.log(1.1);
					if (document.querySelectorAll(qSelector).length <= 0)
						return true;
					//**/console.log(1.2);
					return false;
				} else if (document.querySelectorAll(qSelector).length <= 0)
					return false;
				//**/console.log(1.3);
			}

			//**/console.log(2);
			if (!(typeof qIdx === 'undefined' || qIdx == null)) {
				//**/console.log(2.1);
				qIdx = parseInt(qIdx);
				if (document.querySelectorAll(qSelector).length > qIdx && !document.querySelectorAll(qSelector)[qIdx])
					return false;
				//**/console.log(2.2);
			} 

			var attr = null;
			//**/console.log(3);
			if (!(typeof qAttribute === 'undefined' || qAttribute == null)) {
				qAttribute = qAttribute.toString();
				switch (qAttribute) {
					case 'html':
						//**/console.log(3.1, document.querySelectorAll(qSelector)[qIdx].innerHTML);
						attr = document.querySelectorAll(qSelector)[qIdx].innerHTML;
						break;
					case 'text':
						//**/console.log(3.2, document.querySelectorAll(qSelector)[qIdx].innerText);
						attr = document.querySelectorAll(qSelector)[qIdx].innerText;
						break;
					default:
						//**/console.log(3.3, document.querySelectorAll(qSelector).getAttribute(qAttribute));
						attr = document.querySelectorAll(qSelector)[qIdx].getAttribute(qAttribute);
				}

				//**/console.log(3.5, attr);
				if (attr == null || attr.length < 1)
					return false;
			}

			//**/console.log(4);
			if (attr != null && !(typeof qRegex === 'undefined' || qRegex == null) && attr.match(qRegex).length <= 0)
				return false;

			//**/console.log(5);
			return true;
		} catch (ex) {
			//**/console.log(666, ex);
			return false;
		}
	}

	/**/_utils.logD('CONDITION', qSelector, qIdx, qAttribute, qRegex);
	return [fnCond, qSelector, qIdx, qAttribute, qRegex];
}

PhantomHelper.exQuerySelectorAll = function (queryStr) {
	if (!queryStr || queryStr.length < 1)
		return null;

	// queryStr = '.abc:eq(0) span:eq(1) div';
	var words = queryStr.split(':eq(');

	var ptr = document.querySelectorAll(words[0]);
	if (words.length < 2) return ptr[0];

	for (var i = 1; i < words.length; i++) {
		var eles = words[i].split(')');
		// console.log('eles', eles);

		if (eles.length > 0)
			ptr = ptr[eles[0]];

		if (eles.length > 1 && eles[1])
			ptr = ptr.querySelectorAll(eles[1].trim());
	};

	return ptr;
}

PhantomHelper.getOffsetRect = function(elem) {
	//console.log(elem);
	var box = elem.getBoundingClientRect();
	//console.log(box);

	var body = document.body;
	var docElem = document.documentElement;

	var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
	var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;

	var clientTop = docElem.clientTop || body.clientTop || 0;
	var clientLeft = docElem.clientLeft || body.clientLeft || 0;

	var top  = box.top +  scrollTop - clientTop;
	var left = box.left + scrollLeft - clientLeft;

	return { top: Math.round(top), left: Math.round(left), width: box.width, height: box.height };
}