var BME280 = require('node-adafruit-bme280')
 
BME280.probe(function(temperature, pressure, humidity) {
  console.log("temperature: ", temperature);
  console.log("pressure: ", pressure);
  console.log("humidity: ", humidity);
});

