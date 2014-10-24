var exports = module.exports;
 
exports.setup = function(callback) {
  var write = process.stdout.write;
 
  process.stdout.write = (function (stub) {
    return function (string, encoding, fd) {
      stub.apply(process.stdout, arguments);
      callback(string, encoding, fd);
    };
  })(process.stdout.write);

  var write2 = process.stderr.write;
 
  process.stderr.write = (function (stub) {
    return function (string, encoding, fd) {
      stub.apply(process.stderr, arguments);
      callback(string, encoding, fd);
    };
  })(process.stderr.write);

 
  return function() {
    process.stdout.write = write;
    process.stderr.write = write2;
  };
};