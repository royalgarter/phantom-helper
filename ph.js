'use strict';
const _phantomjs = require('node-phantom-simple');
const _fs = require('fs');

const _u = require('./utils/util.js');
const _hook = require('./utils/hook_stdout.js');

const CRITICAL_ERRORS = ['Request() error evaluating open()', 'Error: read ECONNRESET'];
const ERR_ARGS = 'Not enough arguments';

let _cfg = require('./config/ph.json');

const PhantomHelper = {};
module.exports = PhantomHelper;

PhantomHelper.createDefaultPage = function(startURL, callback) {
	return PhantomHelper.createPage(_cfg, startURL, callback);
}

PhantomHelper.createPage = function(phantomCfg, startURL, callback) {
	_u.isDebug = phantomCfg.isDebug;
	_u.logD(phantomCfg);
	_cfg = phantomCfg;
	let countTry = 0;
	const maxCountTry = 3;
	const delayRetry = 5000;
	const fnCreatePhantom = function(phantomCfg, startURL, callback) {
		countTry++;
		const fnRetry = function() {
			if (countTry < maxCountTry) {
				_u.logD('Retry create phantom:', countTry);
				fnCreatePhantom(phantomCfg, startURL, callback);
			} else {
				callback('Cannot create phantom browser & page');
			}
		};

		return _phantomjs.create(phantomCfg.phantomOpt || phantomCfg, function(err, phantom) {
			if (err) {
				_u.logD('Cannot create phantom browser:', err);
				setTimeout(fnRetry, delayRetry);
				return;
			}
			PhantomHelper.phantom = phantom;
			
			return phantom.createPage(function(err, page) {
				if (err) {
					_u.logD('Cannot create phantom page:', err);
					phantom.exit();
					setTimeout(fnRetry, delayRetry);
					return;
				}
				page.countRes = 0;
				page.isLoading = true;
				page.multiPage = phantomCfg.multiPage;

				page.onResourceRequested = function(request, a) {
					if (request.url.indexOf('.js') < 0) return;
					page.countRes++;
				};
				page.onResourceReceived = function(response) {
					if (response.url.indexOf('.js') < 0) return;
					if (!response.stage || response.stage === 'end') {
						page.countRes--;
					}
				};
				page.onNavigationRequested = function(obj) {}
				page.onResourceError = function(resourceError) {
					page.countRes--;
				};
				page.onResourceTimeout = function(request) {
					page.countRes--;
				};
				page.onConsoleMessage = function(msg, lineNum, sourceId) {
					if (process.env.PORT) return;
					_u.logD('CONSOLE: ' + msg);
				};
				page.onLoadFinished = function(status) {
					page.isLoading = false;
				};
				page.onLoadStarted = function() {
					page.isLoading = true;
				};
				page.onClosing = function(closingPage) {
					_u.logD('The page is closing!', closingPage);
					if (page.multiPage) return;
					phantom.exit();
				};
				page.onError = function(msg, trace) {
					var msgStack = ['PHANTOM internal page.onError: ' + msg];
					if (trace && trace.length) {
						msgStack.push('TRACE:');
						trace.forEach(function(t) {
							msgStack.push(' -> ' + t.file + ': ' + t.line + (t.function ? ' (in function "' + t.function+'")' : ''));
						});
					}
				};
				process.on('SIGTERM', function() {
					_u.logD('SIGTERM on PhantomHelper');
					phantom.exit();
				});
				process.on('uncaughtException', function(err) {
					_u.logD('Caught exception: ' + err);
				});
				_hook.setup(function(string, encoding, fd) {
					if (string.length <= 0 || string.includes('STDOUT')) return;
					for (var crit_err of CRITICAL_ERRORS)
						if (string.includes(crit_err)) return process.exit(1);
				});
				_u.logD('Preparing phantom page done');
				try {
					_u.logD('Openning:', startURL);
					if (phantomCfg.settings) {
						page.set('settings', phantomCfg.settings, function(err, res) {});
					}
					if (phantomCfg.viewportSize) {
						page.set('viewportSize', phantomCfg.viewportSize, function(err, res) {});
					}
					return setTimeout(function() {
						let proxyRaw = phantomCfg.phantomOpt.parameters.proxy;
						let proxy = proxyRaw;
						if (proxyRaw) {
							console.log('Proxies:', proxyRaw);
							if (Array.isArray(proxyRaw)) {
								let idx = Math.floor((Math.random() * proxyRaw.length));
								proxy = proxyRaw[idx];
							}
							console.log('Using proxy:', proxy);
							page.proxy = proxy;
							let words = proxy.split(':');
							if (words.length >= 2) {
								let proxyAuth = phantomCfg.phantomOpt.parameters['proxy-auth'];
								let username = '';
								let password = '';
								if (!proxyAuth && ~proxy.indexOf(':AUTH:')) {
									proxyAuth = proxy.split(':AUTH:')[1];
								}
								if (proxyAuth) {
									let auth = proxyAuth.split(':');
									username = auth[0];
									password = auth[1];
								}
								phantom.setProxy(words[0], words[1], 'http' || phantomCfg.phantomOpt.parameters['proxy-type'], username, password);
							}
						}
						let cookies = phantomCfg.cookies;
						if (cookies && cookies.length > 0) {
							console.log('Using cookies:', cookies);
							for (let idx = 0; idx < cookies.length; idx++) {
								phantom.addCookie(cookies[idx]);
							};
						}
						return page.open(startURL, function(err, status) {
							_u.logD('Openned:', err, status);
							if (err || status == 'fail') {
								_u.logD('Cannot open phantom page:', startURL, err);
								phantom.exit();
								setTimeout(fnRetry, delayRetry);
								return;
							}
							if (phantomCfg.phantomOpt.parameters.noWait) return callback(null, page);
							PhantomHelper.waitPageLoaded(page, function() {
								return callback(null, page);
							});
						});
					}, 1000);
				} catch (ex) {
					_u.logD('Cannot open phantom page:', startURL, ex);
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
			if (!_cfg.isDebugRender && (process.env.RENDER == undefined || !process.env.RENDER)) {
				if (_u.isFunc(fnCallback)) return fnCallback(null);
			}
		}
		page.get('content', function(err, res) {
			if (err || !res) return fnCallback && fnCallback(null);
			if (_cfg.isMiniRender) {
				res = res.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
			}
			const htmlFilepath = filepath.replace('.jpg', '').replace('.png', '').replace('.bmp', '') + '.html';
			_fs.writeFileSync(htmlFilepath, res);
			page.render(filepath, function(err) {
				if (err != null) {
					_u.logD('Render error:' + filepath, err);
				}
				if (_u.isFunc(fnCallback)) return fnCallback(null);
			});
		});
	} catch (ex) {
		_u.logD('RENDER EX:', ex);
		if (_u.isFunc(fnCallback)) return fnCallback(null);
	}
}

PhantomHelper.doWait = function(page, fnInject, fnCallback) {
	let args = [].splice.call(arguments, 0, arguments.length);
	args.splice(2, 0, null);
	PhantomHelper.doWaitCond.apply(PhantomHelper, args);
}

PhantomHelper.doWaitCond = function(page, fnInject, ifn_Condition, callback) {
	const ARG_LEN = 4;
	const fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length - 1] : null;
	const args = [].splice.call(arguments, 0, arguments.length);
	const ifn_args = args.splice(ARG_LEN - 1, args.length - ARG_LEN);
	const fnEvalCb = function(err, result) {
		_u.handle(err);
		if (_u.isUnDefOrNull(ifn_Condition)) return PhantomHelper.waitPageLoaded(page, function(err) {
			return fnCallback(err, result);
		});
		else return PhantomHelper.waitForCondition(page, ifn_Condition, function(err) {
			return fnCallback(err, result);
		});
	};
	let evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_args);
	evalArgs.push(fnEvalCb);
	page.evaluate.apply(page, evalArgs);
}

PhantomHelper.do = function(page, fnInject, callback) {
	const ARG_LEN = 3;
	const fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length - 1] : null;
	const args = [].splice.call(arguments, 0, arguments.length);
	const ifn_params = args.splice(ARG_LEN - 1, args.length - ARG_LEN);
	let evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_params);
	evalArgs.push(fnCallback);
	page.evaluate.apply(page, evalArgs);
}

PhantomHelper.waitDo = function(page, fnInject, fnCallback) {
	const args = [].splice.call(arguments, 0, arguments.length);
	args.splice(2, 0, null);
	PhantomHelper.waitDoCond.apply(PhantomHelper, args);
}

PhantomHelper.waitDoCond = function(page, fnInject, ifn_Condition, callback) {
	const ARG_LEN = 4;
	const fnCallback = arguments.length > (ARG_LEN - 1) ? arguments[arguments.length - 1] : null;
	const args = [].splice.call(arguments, 0, arguments.length);
	const ifn_args = args.splice(ARG_LEN - 1, args.length - ARG_LEN);
	let evalArgs = [fnInject];
	evalArgs = evalArgs.concat(ifn_args);
	evalArgs.push(fnCallback);
	if (_u.isUnDefOrNull(ifn_Condition)) PhantomHelper.waitPageLoaded(page, function() {
		page.evaluate.apply(page, evalArgs);
	});
	else PhantomHelper.waitForCondition(page, ifn_Condition, function() {
		page.evaluate.apply(page, evalArgs);
	});
}

PhantomHelper.click = function(page, query, index, isWait, fnCallback) {
	if (!_u.isStr(query)) {
		let err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}
	if (_u.isFunc(index)) {
		fnCallback = index;
		index = 0;
		isWait = 0;
	}
	if (_u.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}
	page.evaluate(function(query, index) {
		if (document.querySelectorAll(query).length < index + 1) return false;
		var ev = document.createEvent('MouseEvent');
		ev.initEvent('click', true, false);
		document.querySelectorAll(query)[index].dispatchEvent(ev);
		return true;
	}, query, index, function(err, result) {
		if (result && result == true) {
			if (!isWait) return fnCallback(err, result);
			PhantomHelper.waitPageLoaded(page, function() {
				fnCallback(err, result);
			});
		} else {
			let err = 'Click failed, ' + query + ' not found!'
			_u.logD(err);
			if (!isWait) return fnCallback(err, result);
			PhantomHelper.waitPageLoaded(page, function() {
				fnCallback(err, result);
			});
		}
	});
}

PhantomHelper.clickEx = function(page, query, isWait, fnCallback) {
	if (!_u.isStr(query)) {
		let err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}
	if (_u.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}
	page.evaluate(function(fnQueryStr, query) {
		eval('var $ = ' + fnQueryStr);
		var obj = $(query);
		if (!obj) return false;
		var ev = document.createEvent('MouseEvent');
		ev.initEvent('click', true, false);
		obj.dispatchEvent(ev);
		return true;
	}, PhantomHelper.exQuerySelectorAll.toString(), query, function(err, result) {
		if (result && result == true) {
			if (!isWait) return fnCallback(err, result);
			PhantomHelper.waitPageLoaded(page, function() {
				fnCallback(err, result);
			});
		} else {
			let err = 'Click failed, ' + query + ' not found!'
			_u.logD(err);
			if (!isWait) return fnCallback(err, result);
			PhantomHelper.waitPageLoaded(page, function() {
				fnCallback(err, result);
			});
		}
	});
}

PhantomHelper.clickNaEx = function(page, query, options, isWait, fnCallback) {
	if (!_u.isStr(query)) {
		let err = 'Click failed, query argument is not string!'
		return fnCallback(err);
	}
	if (_u.isFunc(isWait)) {
		fnCallback = isWait;
		isWait = 0;
	}
	options = (options === undefined || options === null) ? {} : options;
	options.dx = options.dx ? options.dx : 0;
	options.dy = options.dy ? options.dy : 0;
	options.type = options.type ? options.type : 'left';
	page.evaluate(function(fnQueryStr, query) {
		var getOffsetRect = function(elem) {
			if (!elem) return null;
			var box = elem.getBoundingClientRect();
			var body = document.body;
			var docElem = document.documentElement;
			var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
			var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
			var clientTop = docElem.clientTop || body.clientTop || 0;
			var clientLeft = docElem.clientLeft || body.clientLeft || 0;
			var top = box.top + scrollTop - clientTop;
			var left = box.left + scrollLeft - clientLeft;
			return {
				top: Math.round(top),
				left: Math.round(left),
				width: box.width,
				height: box.height
			};
		}
		eval('var $ = ' + fnQueryStr);
		var obj = $(query);
		if (!obj) return null;
		return getOffsetRect(obj);
	}, PhantomHelper.exQuerySelectorAll.toString(), query, function(err, result) {
		console.log('RECT', result);
		if (result) {
			return page.sendEvent('click', result.left + options.dx, result.top + options.dy, options.type, function(err) {
				if (!isWait) return fnCallback(err, result);
				PhantomHelper.waitPageLoaded(page, function() {
					fnCallback(err, result);
				});
			});
		} else {
			let err = 'Click failed, ' + query + ' not found!'
			_u.logD(err);
			if (!isWait) return fnCallback(err, result);
			return PhantomHelper.waitPageLoaded(page, function() {
				fnCallback(err, result);
			});
		}
	});
}

PhantomHelper.getVal = function(page, queries, fnCallback) {
	const SPLIT = '>>';
	if (typeof(queries) == 'string') queries = [queries];
	if (queries.length < 1) return fnCallback('Queries are not valid array');
	let results = {};
	while (queries.length > 0) {
		let query = queries.pop();
		let words = query.split(SPLIT);
		let len = words.length;
		let count = 0;
		let qSelector, qIdx = 0,
			qAttribute = 'text',
			fnGetVal = null;
		if (len > count) qSelector = words[count++];
		if (len > count) qIdx = parseInt(words[count++]);
		if (len > count) qAttribute = words[count++];
		switch (qAttribute) {
			case 'html':
				fnGetVal = function(query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].innerHTML
						};
					} catch (ex) {
						return {
							key: query,
							value: null
						};
					}
				}
				break;
			case 'text':
				fnGetVal = function(query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].innerText
						};
					} catch (ex) {
						return {
							key: query,
							value: null
						};
					}
				}
				break;
			case 'value':
				fnGetVal = function(query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].value
						};
					} catch (ex) {
						return {
							key: query,
							value: null
						};
					}
				}
				break;
			default:
				fnGetVal = function(query, qSelector, qIdx, qAttribute) {
					try {
						return {
							key: query,
							value: document.querySelectorAll(qSelector)[qIdx].getAttribute(qAttribute)
						};
					} catch (ex) {
						return {
							key: query,
							value: null
						};
					}
				}
		}
		if (fnGetVal == null) {
			if (queries.length == 0) {
				return fnCallback(null, results);
			}
			continue;
		}
		page.evaluate(fnGetVal, query, qSelector, qIdx, qAttribute, function(err, val) {
			results[val.key] = val.value;
			if (queries.length == 0) {
				return fnCallback(null, results);
			}
		});
	}
}

PhantomHelper.fill = function(page, query, index, value, fnCallback) {
	if (!_u.isStr(query)) {
		let err = 'Fill failed, query argument is not string!'
		return fnCallback(err);
	}
	page.evaluate(function(query, index, value) {
		if (document.querySelectorAll(query).length < index + 1) return false;
		document.querySelectorAll(query)[index].value = value;
		return true;
	}, query, index, value, function(err, result) {
		if (result && result == true) {
			return fnCallback(err, result);
		} else {
			let err = 'Fill failed, ' + query + ' not found!'
			_u.logD(err);
			return fnCallback(err, result);
		}
	});
}

PhantomHelper.fillEx = function(page, query, value, fnCallback) {
	if (!_u.isStr(query)) {
		let err = 'Fill failed, query argument is not string!'
		return fnCallback(err);
	}
	page.evaluate(function(fnQueryStr, query, value) {
		eval('var $ = ' + fnQueryStr);
		var obj = $(query);
		if (!obj) return false;
		obj.value = value;
		return true;
	}, PhantomHelper.exQuerySelectorAll.toString(), query, value, function(err, result) {
		if (result && result == true) {
			return fnCallback(err, result);
		} else {
			let err = 'Fill failed, ' + query + ' not found!'
			_u.logD(err);
			return fnCallback(err, result);
		}
	});
}

PhantomHelper.upload = function(page, query, filepath, fnCallback) {
	return page.upload(query, filepath, fnCallback);
}

PhantomHelper.wait = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {
	if (arguments.length == 2)
		return PhantomHelper.waitPageLoaded(page, arguments[arguments.length - 1]);

	if (~['function', 'string', 'object'].indexOf(typeof ifn_Condition) ) {
		return PhantomHelper.waitForConditionSafe(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback);
	}

	if (typeof ifn_Condition == 'number') {
		return PhantomHelper.waitPageLoaded(page, ifn_Condition, ifn_Condition * 2, fnCallback);
	}

	return PhantomHelper.waitPageLoaded(page, timeOutMillis, maxTimeOutMillis, callback);
}

PhantomHelper.waitForConditionSafe = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {
	const fnCallback = arguments.length > 2 ? arguments[arguments.length - 1] : null;
	return PhantomHelper.waitForCondition(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, function(err, result) {
		return fnCallback && fnCallback(null, {
			err: err,
			result: result
		});
	});
}

PhantomHelper.waitForCondition = function(page, ifn_Condition, timeoutInterval, maxTimeOutMillis, callback) {
	const fnCallback = arguments.length > 2 ? arguments[arguments.length - 1] : null;
	const startTime = Date.now();
	
	timeoutInterval = _u.isNum(timeoutInterval) ? timeoutInterval : _cfg.timeInterval;
	maxTimeOutMillis = _u.isNum(maxTimeOutMillis) ? maxTimeOutMillis : _cfg.maxTimeOutMillis;
	
	const fnHandle = function(err, result) {
		if (result) {
			_u.logD('wait finished in', Date.now() - startTime, 'ms');
			fnCallback && fnCallback(err, result);
		} else {
			setTimeout(testForSelector, timeoutInterval);
		}
	}
	
	const testForSelector = function() {
		const elapsedTime = Date.now() - startTime;
		if (elapsedTime > maxTimeOutMillis) {
			_u.logD('Timeout waiting for ifn_Condition');
			return fnCallback && fnCallback('Timeout waiting for ifn_Condition', null);
		}
		switch (typeof(ifn_Condition)) {
			case 'string':
				const argsCond = PhantomHelper.buildFnCondition(ifn_Condition);
				argsCond.push(fnHandle);
				page.evaluate.apply(page, argsCond);
				break;
			case 'function':
				page.evaluate(ifn_Condition, fnHandle);
				break;
			case 'object':
				if (Array.isArray(ifn_Condition)) {
					let count = 0;
					_async.whilst(function() {
						return count < ifn_Condition.length;
					}, function(fnWhilst) {
						const argsCond = PhantomHelper.buildFnCondition(ifn_Condition[count]);
						_u.logD('fnCond', ifn_Condition[count], argsCond);
						const fnEvalCb = function(err, res) {
							count++;
							if (err || !res) fnWhilst(ifn_Condition[count]);
							fnWhilst(null);
						}
						argsCond.push(fnHandle);
						page.evaluate.apply(page, argsCond);
					}, function(err) {
						if (err) return setTimeout(testForSelector, timeoutInterval);
						return fnCallback && fnCallback(null);
					});
				} else {
					fnCallback && fnCallback('ifn_Condition is invalid', null);
				}
				break;
			default:
				fnCallback && fnCallback('ifn_Condition is invalid', null);
		}
	};
	setTimeout(testForSelector, timeoutInterval);
}

PhantomHelper.waitPageLoaded = function(page, timeOutMillis, maxTimeOutMillis, callback) {
	const fnCallback = arguments.length > 1 ? arguments[arguments.length - 1] : null;
	timeOutMillis = _u.isNum(timeOutMillis) ? timeOutMillis : _cfg.timeOutMillis;
	maxTimeOutMillis = _u.isNum(maxTimeOutMillis) ? maxTimeOutMillis : _cfg.maxTimeOutMillis;
	const start = new Date().getTime();
	let countFinishRes = 0;
	let interval = setInterval(function() {
		let deltaTime = new Date().getTime() - start;
		let waitDone = false;
		let err = null;
		if (deltaTime > maxTimeOutMillis) {
			waitDone = true;
			_u.logD('wait too long in ' + deltaTime + ' ms, ' + page.countRes + ' resources remained');
		} else if (deltaTime > timeOutMillis) {
			if (page.isLoading == true || page.countRes > 0) {
				countFinishRes = 0;
				return;
			}
			if (countFinishRes++ < _cfg.maxTryFinishRes) return;
			waitDone = true;
			_u.logD('wait finished in ', deltaTime, ' ms');
		}
		if (waitDone) {
			clearInterval(interval);
			countFinishRes = 0;
			page.countRes = 0;
			page.isLoading = false;
			if (_u.isFunc(fnCallback)) return fnCallback(err);
			else return fnCallback;
		}
	}, _cfg.timeInterval);
}

/***************************** SUPPORT FUNCTIONS *******************************/

PhantomHelper.buildFnCondition = function(strCond) {
	const SPLIT = '>>';
	const words = strCond.split(SPLIT);
	let len = words.length;
	let count = 0;
	let qSelector, qIdx, qAttribute, qRegex;
	if (len > count) qSelector = words[count++];
	if (len > count) qIdx = parseInt(words[count++]);
	if (len > count) qAttribute = words[count++];
	if (len > count) qRegex = words[count++];
	
	const fnCond = function(qSelector, qIdx, qAttribute, qRegex) {
		try {
			if (!(typeof qSelector === 'undefined' || qSelector == null)) {
				qSelector = qSelector.toString();
				if (qSelector.indexOf('!') == 0) {
					qSelector = qSelector.substr(1);
					if (document.querySelectorAll(qSelector).length <= 0) return true;
					return false;
				} else if (document.querySelectorAll(qSelector).length <= 0) return false;
			}
			if (!(typeof qIdx === 'undefined' || qIdx == null)) {
				qIdx = parseInt(qIdx);
				if (document.querySelectorAll(qSelector).length > qIdx && !document.querySelectorAll(qSelector)[qIdx]) return false;
			}
			var attr = null;
			if (!(typeof qAttribute === 'undefined' || qAttribute == null)) {
				qAttribute = qAttribute.toString();
				switch (qAttribute) {
					case 'html':
						attr = document.querySelectorAll(qSelector)[qIdx].innerHTML;
						break;
					case 'text':
						attr = document.querySelectorAll(qSelector)[qIdx].innerText;
						break;
					default:
						attr = document.querySelectorAll(qSelector)[qIdx].getAttribute(qAttribute);
				}
				if (attr == null || attr.length < 1) return false;
			}
			if (attr != null && !(typeof qRegex === 'undefined' || qRegex == null) && attr.match(qRegex).length <= 0) return false;
			return true;
		} catch (ex) {
			return false;
		}
	}

	// _u.logD('CONDITION', qSelector, qIdx, qAttribute, qRegex);
	return [fnCond, qSelector, qIdx, qAttribute, qRegex];
}

PhantomHelper.exQuerySelectorAll = function(queryStr) {
	if (!queryStr || queryStr.length < 1) return null;
	var words = queryStr.split(':eq(');
	var ptr = document.querySelectorAll(words[0]);
	if (words.length < 2) return ptr[0];
	for (var i = 1; i < words.length; i++) {
		var eles = words[i].split(')');
		if (eles.length > 0) ptr = ptr[eles[0]];
		if (eles.length > 1 && eles[1]) ptr = ptr.querySelectorAll(eles[1].trim());
	};
	return ptr;
}

PhantomHelper.getOffsetRect = function(elem) {
	var box = elem.getBoundingClientRect();
	var body = document.body;
	var docElem = document.documentElement;
	var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
	var scrollLeft = window.pageXOffset || docElem.scrollLeft || body.scrollLeft;
	var clientTop = docElem.clientTop || body.clientTop || 0;
	var clientLeft = docElem.clientLeft || body.clientLeft || 0;
	var top = box.top + scrollTop - clientTop;
	var left = box.left + scrollLeft - clientLeft;
	return {
		top: Math.round(top),
		left: Math.round(left),
		width: box.width,
		height: box.height
	};
}