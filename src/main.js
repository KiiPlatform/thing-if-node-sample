//@flow
var fs = require('fs');

var kii = require('kii-sdk').create();

var APP_JSON = './app.json';
var THING_JSON = './thing.json';
var DATA_JSON = './data.json';

var APP = JSON.parse(fs.readFileSync(APP_JSON).toString());
if (APP.SITE in kii.KiiSite) {
  APP.SITE = kii.KiiSite[APP.SITE];
}
var THING = JSON.parse(fs.readFileSync(THING_JSON).toString());

function ts() {
  return new Date().toLocaleString();
}

function registerThing(id:string, password:string, type:string, savePath:string): Promise<KiiThing> {
  return kii.KiiThing.register({
    _vendorThingID: id,
    _password: password,
    _thingType: type
  }).then(
    function(thing) {
      fs.writeFileSync(savePath, JSON.stringify({
        THING_ID: thing.getThingID()
      }));
      return Promise.resolve(thing);
    }
  );
}

function loadThing(id, password) {
  var user = new kii.KiiUser();
  user._username = 'VENDOR_THING_ID:' + id;
  user._password = password;
  return new Promise(function(fulfill, reject) {
    user._authenticate({
      success: function(user) { fulfill(user); },
      failure: function(user, error) { reject(error); }
    });
  }).then(
    function(user) {
      return kii.KiiThing.loadWithVendorThingID(THING.VENDOR_ID);
    }
  );
}

function exponentialBackoff(name, fn, maxRetry, interval, retryCount: number = 0) {
  if (interval == null) {
    interval = 1000;
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

function setupThing(thing, savePath) {
  var data;
  try {
    data = JSON.parse(fs.readFileSync(savePath).toString());
  } catch (err) {
  }
  var id = thing.VENDOR_ID;
  var pass = thing.PASSWORD;
  if (data == null) {
    return registerThing(id, pass, thing.TYPE, savePath).then(
      function(thing) { return loadThing(id, pass); }
    );
  } else {
    return loadThing(id, pass);
  }
}

function startMonitor(thing: KiiThing) {
  var bucket = thing.bucketWithName('temperatures');
  setInterval(function() {
    var t = new Date();
    var sec = t.getSeconds();
    if ((sec % 60) == 59) {
      saveData(bucket, t, true);
      resetData();
    } else if ((sec % 15) == 14) {
      saveData(bucket, t, false);
    }
  }, 1000);
  var BlecastTM = require('blecast_tm');
  var monitor = new BlecastTM();
  monitor.on('data', function(data) {
    //console.log(ts(), 'BlecastTM', data);
    putData(data.temp);
  });
  //setInterval(putDummyData, 1000);
}

function format02d(v) {
  if (v < 10) {
    return '0' + v;
  } else {
    return '' + v;
  }
}

function getID(time) {
  return '' + time.getUTCFullYear() +
      '-' + format02d(time.getMonth() + 1) +
      '-' + format02d(time.getUTCDate()) +
      'T' + format02d(time.getUTCHours()) + '0000Z';
}

function getYMDH(time) {
  return time.getUTCFullYear() * 1000000 + (time.getMonth() + 1) * 10000
    + time.getUTCDate() * 100 + time.getUTCHours();
}

function updateObject(obj, index, value) {
  var data = obj.get('data');
  data[index] = value;
  obj.set('data', data);
  return obj.save();
}

function createObject(obj, label, index, value) {
  var data = [];
  data[index] = value;
  obj.set('ymdh', label);
  obj.set('data', data);
  return new Promise(function(fulfill, reject) {
    obj._performUpdate(false, {
      success: function(obj) { fulfill(obj); },
      failure: function() {
        var err = new Error(arguments[1]);
        err.target = obj;
        reject(err);
      }
    }, true);
  });
}

var cacheID;
var cacheObj;

function saveData(bucket, time, minend) {
  var id = getID(time);
  var min = time.getUTCMinutes();
  var val = getDataAve();
  var promise;
  if (id === cacheID && cacheObj != null) {
    promise = updateObject(cacheObj, min, val);
  } else {
    var obj = bucket.createObjectWithID(id);
    cacheID = id;
    cacheObj = obj;
    promise = obj.refresh().then(
      function(obj) { return updateObject(obj, min, val); },
      function(err) { return createObject(obj, getYMDH(time), min, val); }
    );
  }

  return promise.then(
    function(obj) {
      //console.log(ts(), 'saveData OK:', 'id=' + id, 'min=' + min, 'val=' + val);
    },
    function(err) {
      console.error(ts(), 'saveData NG:', err.toString());
      cacheID = null;
      cacheObj = null;
    }
  );
}

var values = [];

function getDataAve() {
  var sum = 0;
  for (var i = 0; i < values.length; ++i) {
    sum += values[i];
  }
  return sum / values.length;
}

function resetData() {
  values = [];
}

function putData(val) {
  values.push(val);
}

function putDummyData() {
  var v = Math.random() * 20 + 10;
  putData(v);
  //console.log(ts(), 'dummy: ', v);
}

kii.Kii.initializeWithSite(APP.ID, APP.KEY, APP.SITE);

exponentialBackoff('setup', function() {
  return setupThing(THING, DATA_JSON);
}, 5, 1000).then(
  function(thing) { startMonitor(thing) },
  function(error) { console.error(ts(), 'setup failed:', error); }
);
