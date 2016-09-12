var gpio = require('rpi-gpio');
var GPIO_18 = 12
var BME280 = require('node-adafruit-bme280');

var blinkLED = function(port, count) {
  var current = 0;
  var on = false;
  var id = setInterval(function() {
      if(current == count) {
        gpio.write(port, false);
        clearInterval(id);
      }

      if(on) {
        gpio.write(port, false);
        on = false;
      } else {
        gpio.write(port, true);
        on = true;
        current++;
      }
  }, 300);
}

module.exports.setup = function() {
    gpio.setup(GPIO_18, gpio.DIR_OUT);
}

module.exports.generateState = function() {
    return new Promise(function(resolve, reject) {
        BME280.probe(function(temperature, pressure, humidity) {
            resolve({temperature: temperature, humidity: humidity})
        });
    })
};
module.exports.consumeCommand = function(command) {
    // GPIO channel number. see http://elinux.org/RPi_Low-level_peripherals#Interfacing_with_GPIO_pins
    blinkLED(GPIO_18, command.actions[0].mythingsAction.id);
}
