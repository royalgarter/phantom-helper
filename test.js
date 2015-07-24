var _wait = require('wait.for');

var _phantomHelper = require('./PhantomHelper');


var _host = 'http://www.madmimi.com';

/********** FLOW FUNCTIONS **********/

var run = function (page) {
	var step = 0;
	console.log(step++);_wait.for(_phantomHelper.render, page, 'home.jpg');
	console.log(step++);_wait.for(_phantomHelper.doWait, page, ifn_Login);
	console.log(step++);_wait.for(_phantomHelper.render, page, 'ifn_Login.jpg');
	console.log(step++);_wait.for(_phantomHelper.click, page, '[href="/audience_members"]', 0, 1);
	console.log(step++);_wait.for(_phantomHelper.render, page, 'ifn_ClickAudience.jpg');
	// console.log(step++);_wait.for(_phantomHelper.doWait, page, ifn_Delete);
	// console.log(step++);_wait.for(_phantomHelper.render, page, 'ifn_Delete.jpg');

	console.log(step++);_wait.for(page.close);
}

var run2 = function (page) {
	_wait.for(_phantomHelper.render, page, 'begin.jpg');
	_wait.for(_phantomHelper.fill, page, '[name="q"]', 0, 'phantom-helper');
	_wait.for(_phantomHelper.clickNaEx, page, '.lsb', null, 1);
	_wait.for(_phantomHelper.render, page, 'res.jpg');

	_wait.for(page.close);
}


/********** IFN FUNCTIONS **********/

var ifn_Login = function () {

	document.querySelector('#email').value = 'username-here';
	document.querySelector('#password').value = 'password-here';

	var ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('[class="btn primary"]').dispatchEvent(ev);
}

var ifn_ClickAudience = function () {
	var ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('[href="/audience_members"]').dispatchEvent(ev);
}

var ifn_Delete = function () {
	var ev = null;
	
	ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('#contacts_check_all').dispatchEvent(ev);

	ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('#select_whole_list').dispatchEvent(ev);

	ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('#delete_contacts').dispatchEvent(ev);

	ev = document.createEvent('MouseEvent');
	ev.initMouseEvent( 'click', true , true , window, null, 0, 0, 0, 0, false, false, false, false, 0 , null);
	document.querySelector('#anonymous_element_30').dispatchEvent(ev);
}


/********** MAIN FUNCTIONS **********/

// _phantomHelper.createDefaultPage(_host, function (err, page) {
// 	console.log('createPage done', err);
// 	_wait.launchFiber(run, page);
// });

_phantomHelper.createDefaultPage('http://www.google.com', function (err, page) {
	console.log('createPage done', err);
	_wait.launchFiber(run2, page);
});

