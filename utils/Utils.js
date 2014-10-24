var Utils = {};
module.exports = Utils;

Utils.isDebug = true;

Utils.handle = function(err) {
	if (Utils.isUnDefOrNull(err)) {
		return false;
	} else {
		console.log('ERROR:', err);
		return true;
	}
}

Utils.clone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
}

Utils.isFunc = function(obj) {
	return (!Utils.isUnDef(obj) && typeof obj == 'function');
}

Utils.isStr = function(obj) {
	return (!Utils.isUnDef(obj) && typeof obj == 'string');
}

Utils.isNum = function(obj) {
	return (!Utils.isUnDef(obj) && typeof obj == 'number');
}

Utils.isUnDef = function(obj) {
	return (typeof obj === 'undefined');
}

Utils.isUnDefOrNull = function(obj) {
	return (typeof obj === 'undefined' || obj == null);
}

Utils.isNUD = function(obj) {
	return (typeof obj === 'undefined' || obj == null);
}

var writeLog = function (args) {
	console.log.apply(console, args);
}


Utils.log = function() {
	var args = [].splice.call(arguments,0,arguments.length);
	writeLog(args);
	//console.log.apply(console, args);
}

Utils.logD = function() {
	var isDoIt = false;

	if (!process.env.PORT && Utils.isDebug) {
		isDoIt = true;
	} 	
	
	if (isDoIt) {
		var args = [].splice.call(arguments,0,arguments.length);
		writeLog(args);
		//console.log.apply(console, args);
	}
}

Utils.toJson = function(obj){
	var seen = [];
	return JSON.stringify(obj, function(key, val) {
	   if (typeof val == "object") {
	        if (seen.indexOf(val) >= 0)
	            return;
	        seen.push(val);
	    }
	    return val;
	}, 4);
}

Utils.replaceAll = function(find, replace, str) {
	var escapeRegExp = function (string) {
    	return string.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	}
  	return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

Utils.checkUpTime = function (upTimeoutExitMinute) {
	console.log('COUNT CHILD:', _countRunning, '/', _limitRunning);
	var now = Date.now();
	var deltaT = (now - _upTime) / (1000 * 60);

	if (deltaT > upTimeoutExitMinute) {
		_db.stop();
		process.exit(0);		
	}

	if (_countRunning < _limitRunning)
		return false;

	return true;
}