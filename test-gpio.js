var GPIO_18 = 12

function logError(error) {
  if (error) {
    console.log(error);
  }
}

function blinkLED(gpio, port, count) {
  var on = false;
  var current = 0;
  var id = setInterval(function() {
      if(current == count) {
	gpio.destroy(logError);
        clearInterval(id);
	return;
      }
      if(on) {
        console.log("off");
        gpio.write(port, false, logError);
        on = false;
      } else {
        console.log("on");
        gpio.write(port, true, logError);
        on = true;
	current++;
      }
    }, 500);
}


var gpio = require('rpi-gpio');
gpio.setup(GPIO_18, gpio.DIR_OUT, logError);

blinkLED(gpio, GPIO_18, 5);
