const five = require('johnny-five');
const botbrains = require('botbrains');
const scanner = require('node-wifi-scanner');

const board = new five.Board({port: process.argv[2] || '' });
const brains = new botbrains.NeuralNetwork(100);
botbrains.Toolkit.visualise(brains);

board.on('ready', () => {

  const sensor = new five.IMU({ controller: "LSM303C", freq: 100 });
  const light_FL = new five.Sensor({ pin: 'A0',  freq: 100, threshold: 5 });
  const light_BL = new five.Sensor({ pin: 'A1',  freq: 100, threshold: 5 });
  const light_BR = new five.Sensor({ pin: 'A2',  freq: 100, threshold: 5 });
  const light_FR = new five.Sensor({ pin: 'A3',  freq: 100, threshold: 5 });
  const rangefinder = new five.Proximity({ pin: 2, freq: 100, controller: "HCSR04" });
  const wifi = {};

  let ambientLight, averageLight, averageDistance, lastCollission;

  setInterval(() => {

    // Average over 100 measurements (10 seconds)
    ambientLight = (ambientLight||averageLight) * 99/100 + averageLight * 1/100;

    process.stdout.write('\033c');
    console.log("Mr Happy");
    console.log("  FL            : ", light_FL.value);
    console.log("  FR            : ", light_FR.value);
    console.log("  BL            : ", light_BL.value);
    console.log("  BR            : ", light_BR.value);
    console.log("  averageLight  : ", averageLight);
    console.log("  ambientLight  : ", ambientLight);
    console.log("  RANGE         : ", rangefinder.cm);
    console.log("  acc.x         : ", sensor.accelerometer.x);
    console.log("  acc.y         : ", sensor.accelerometer.y);
    console.log("  acc.z         : ", sensor.accelerometer.z);
    console.log("  mag.x         : ", sensor.magnetometer.raw.x);
    console.log("  mag.y         : ", sensor.magnetometer.raw.y);
    console.log("  mag.z         : ", sensor.magnetometer.raw.z);
    console.log("--------------------------------------");

    averageLight = light_FL.value/4 + light_FR.value/4 + light_BL.value/4 + light_BR.value/4;
    averageDistance = (averageDistance||100)*3/4 + rangefinder.cm/4;
    const compass = sensor.magnetometer.raw; 
    const now = Date.now(); 

    brains.input('Light Front/Left')((light_FL - ambientLight) / 512);
    brains.input('Light Front/Right')((light_FR - ambientLight) / 512);
    brains.input('Light Back/Left')((light_BL - ambientLight) / 512);
    brains.input('Light Back/Right')((light_BR - ambientLight) / 512);
    brains.input('Range Proximity')((200 - averageDistance) / 200);

    // Compass
    brains.input('North')(compass.x);
    brains.input('South')(-1*compass.x);
    brains.input('East')(compass.y);
    brains.input('West')(-1*compass.y);

    // Wifi telemetry
    Object.keys(wifi).forEach(ssid => 
      (now - wifi[ssid].time < 10000) ?
        brains.input(`wifi (${ssid})`)(wifi[ssid].signal) : false
    );
    
  }, 100);

  // Every 200ms
  setInterval(() => {
    if (averageDistance < 20) {
      avoidCollission();
      lastCollission = Date.now();
      brains.unlearn(.2);
    } 
  }, 200);

  // Every 1s
  setInterval(() => {
    const lightChange = averageLight - ambientLight / ambientLight;
    if (Math.abs(lightChange) > 0.05) {
      brains.learn(lightChange > 1 ? 1 : 
        (lightChange < -1 ? -1 : lightChange));
    }
    const msSinceCollission = Date.now() - lastCollission;
    if (msSinceCollission > 10000 && msSinceCollission < 20000) {
      brains.learn(msSinceCollission - 10000);
    }
    // Scan Wifi
    scanner.scan((err, networks) => {
      if (networks && networks.length) {
          networks.forEach(n => {
              const rssi = Math.abs(n.rssi);
              if (n.ssid && rssi) {
                  let signal = (-1*rssi + 100) / 70;
                  wifi[n.ssid] = signal;
                  signal = signal < 0 ? 0 : (signal > 1 ? 1 : signal); 
                  wifi[n.ssid] = { signal, time: Date.now() };
              }
          });
      }
  })
  }, 1000);

  const motors = new five.Motors([
    { pins: { dir: 7, pwm: 6 }, invertPWM: true },
    { pins: { dir: 8, pwm: 9 }, invertPWM: true }
  ]);
  const motor_L = motors[0];
  const motor_R = motors[1];

  brains.output('motor (L)').on('data', duration => {
    motor_L.forward();
    clearTimeout(motor_L.timeout);
    motor_L.timeout = setTimeout(() => motor_L.stop(), duration * 1000);
  });
  brains.output('motor (R)').on('data', duration => {
    motor_R.forward();
    clearTimeout(motor_R.timeout);
    motor_R.timeout = setTimeout(() => motor_R.stop(), duration * 1000);
  });

  function avoidCollission() {
    motors.reverse();
    board.wait(1000, () => {
      if (Math.random() > 0.5) motor_L.reverse();
      else motor_R.reverse();
      board.wait(Math.random() * 3000, () => motors.stop());
    });
  }

  board.on('exit', () => motors.stop());

});