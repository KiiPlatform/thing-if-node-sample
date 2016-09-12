var fs = require('fs');
var DATA_JSON = './data.json';

module.exports = {
  setup: function() {},
  generateState: function() {
    return new Promise(function(resolve, reject) {
      fs.readFile(DATA_JSON, function(err, data) {
        if (err) {
          reject(err);
        }
        resolve(JSON.parse(data));
      })});
  },
  consumeCommand: function(command) {}
}
