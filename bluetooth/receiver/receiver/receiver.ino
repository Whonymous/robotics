/*
  DigitalReadSerial
 Reads a digital input on pin 2, prints the result to the serial monitor

 This example code is in the public domain.
 */

// digital pin 2 has a pushbutton attached to it. Give it a name:
int rfData = 11;

// the setup routine runs once when you press reset:
void setup() {
  // initialize serial communication at 9600 bits per second:
  Serial.begin(9600);
  // make the pushbutton's pin an input:
  pinMode(rfData, INPUT);
}

// the loop routine runs over and over again forever:
void loop() {
  // read the input pin:
  int state = digitalRead(rfData);
  // print out the state of the button:
  if (state == HIGH) {
    Serial.println("data");
  } 
  delay(1);        // delay in between reads for stability
}



