var fs = require('fs');

var kii = require('./lib/kii-cloud-sdk-v2.1.34.js').create();
var https = require('https');

var APP_JSON = './app.json';
var THING_JSON = './thing.json';

var APP = JSON.parse(fs.readFileSync(APP_JSON));
if (APP.SITE in kii.KiiSite) {
  APP.SITE = kii.KiiSite[APP.SITE];
}
var THING = JSON.parse(fs.readFileSync(THING_JSON));

function ts() {
  return new Date().toLocaleString();
}

function loadThing(vendorId, password) {
  var user = new kii.KiiUser();
  user._username = 'VENDOR_THING_ID:' + vendorId;
  user._password = password;
  return new Promise(function(fulfill, reject) {
    user._authenticate({
      success: function(user) { fulfill(user); },
      failure: function(user, error) { reject(error); }
    });
  }).then(
    function(user) {
      console.log(ts(), 'logged in as thing');
      return kii.KiiThing.loadWithVendorThingID(THING.VENDOR_ID);
    }
  ).then(
    function(thing) {
      console.log(ts(), 'thing loaded');
      return Promise.all(
          [
          new Promise(function(resolve, reject) {
            var req = https.request(
                {
                  hostname: 'api-jp.kii.com',
                  port: 443,
                  path: '/thing-if/apps/'+ APP.ID + '/onboardings',
                  method: 'POST',
                  headers: {
                    authorization: 'Bearer ' + kii.KiiUser.getCurrentUser().getAccessToken(),
                    'content-type': 'application/vnd.kii.onboardingWithVendorThingIDByThing+json'
                  }
                });
            req.write(JSON.stringify(
                  {
                    vendorThingID:vendorId,
                    thingPassword:password
                  }));
            req.end();

            req.on('response', function(res) {
              console.log(ts(), 'thing onboarding status : ', res.statusCode);
              if (res.statusCode != 200) {
                reject('status code ' + res.statusCode);
              }
              var data = "";
              res.on('data', function(chunk) {
                data += chunk;
              });
              res.on('end', function() {
                console.log(ts(), 'thing onboarded');
                console.log(ts(), 'server response : ', data);
                resolve(JSON.parse(data));
              });
              res.on('error', function(error) {
                console.log(ts(), 'error while reading onboarding response', error);
                reject(error);
              });
            });

            req.on('aborted', function() {
              reject('connection aborted by server');
            });
          })
      , thing
       ]);
    });
}

function exponentialBackoff(name, fn, maxRetry, interval, retryCount) {
  if (interval == null) {
    interval = 1000;
  }
  if (retryCount == null) {
    retryCount = 0;
  }
  return fn().then(
    function(value) {
      if (retryCount > 0) {
        console.log(ts(), name, "success with retry (" + retryCount + '/' + maxRetry + ")");
      }
      return Promise.resolve(value);
    },
    function(error) {
      if (retryCount >= maxRetry) {
        return Promise.reject(error);
      }
      return new Promise(function(fulfill, reject) {
        ++retryCount;
        console.log(ts(), name, "retry (" + retryCount + '/' + maxRetry + ") after " + interval + " msecs:", error);
        setTimeout(function() {
          exponentialBackoff(name, fn, maxRetry, interval * 2, retryCount).then(
            function(value) { fulfill(value); },
            function(error) { reject(error); }
          );
        }, interval);
      });
    }
  );
}

function setupThing(thing) {
  var id = thing.VENDOR_ID;
  var pass = thing.PASSWORD;
  return loadThing(id, pass);
}

function startMonitor(thing, behavior) {
  setInterval(function() {
    var t = new Date();
    var sec = t.getSeconds();
    if ((sec % 60) == 59) {
      behavior.generateState()
        .then(function(state) {
          state.lastModified = Date.now();
          saveData(thing.getThingID(), state);
        }).catch(function(err) {
          console.log(ts(), "error while generating state", err);
        });
    }
  }, 1000);
  //setInterval(putDummyData, 1000);
}

function saveData(thingId, state) {
  var path = '/thing-if/apps/'+ APP.ID + '/targets/thing:' + thingId + '/states';
  console.log(ts(), "reporting state : ", state);
  var req = https.request(
      {
        hostname: 'api-jp.kii.com',
        port: 443,
        path: path,
        method: 'PUT',
        headers: {
          authorization: 'Bearer ' + kii.KiiUser.getCurrentUser().getAccessToken(),
          'content-type': 'application/json'
        }
      },
      function(res) {
        console.log(ts(), 'reported. server status ' + res.statusCode);
      });
  req.write(JSON.stringify(state));
  req.end();
}

function startMQTT(onboard, behavior) {
  var endpoint = onboard.mqttEndpoint;
  var mqtt    = require('mqtt');
  var client  = mqtt.connect('mqtt://' + endpoint.host + ':' + endpoint.port,
      {username:endpoint.username, password:endpoint.password, clientId:endpoint.mqttTopic} );

  client.on('error', function (error) {
      console.error(ts(), "MQTT error ", error);
      });

  client.on('connect', function () {
      console.log(ts(), "connected to MQTT endpoint");
      client.subscribe(endpoint.mqttTopic);
      });

  client.on('message', function (topic, message) {
      // message is Buffer 
      // message is like {"schema":"prototype","schemaVersion":1,"commandID":"03675d40-7509-11e6-b753-22000b07265b","actions":[{"mythingsAction":{"payload":"{\"test\":0}","id":1}}],"issuer":"user:d009f7a00022-5308-6e11-e443-0222ec98"}
      msgJSON = JSON.parse(message);
      console.log(ts(), 'received command : ' , message.toString());
      behavior.consumeCommand(message);
    });
}

kii.Kii.initializeWithSite(APP.ID, APP.KEY, APP.SITE);

var behavior_str = 'raspberry-pi';
if (process.argv.length > 2) {
  behavior_str = process.argv[2];
}
console.log(ts(), "using behavior : ", behavior_str);
var behavior = require('./' + behavior_str + '.js');

exponentialBackoff('setup', function() {
  return setupThing(THING);
}, 5, 1000).then(
  function(resp) {
    behavior.setup();
    startMQTT(resp[0], behavior);
    startMonitor(resp[1], behavior);
  },
  function(error) { console.error(ts(), 'setup failed:', error); }
);
