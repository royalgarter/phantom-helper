'use strict';
module.exports = {
	setup: (callback) => {
		const write = process.stdout.write;
	 
		process.stdout.write = ((stub => function (string, encoding, fd) {
			stub.apply(process.stdout, arguments);
			callback(string, encoding, fd);
		}))(process.stdout.write);

		const write2 = process.stderr.write;
	 
		process.stderr.write = ((stub => function (string, encoding, fd) {
			stub.apply(process.stderr, arguments);
			callback(string, encoding, fd);
		}))(process.stderr.write);

	 
		return () => {
			process.stdout.write = write;
			process.stderr.write = write2;
		};
	}
}

