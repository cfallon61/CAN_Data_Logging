/*
In the node.js intro tutorial (http://nodejs.org/), they show a basic tcp
server, but for some reason omit a client connecting to it.  I added an
example at the bottom.

Save the following server in example.js:
*/

/*
var net = require('net');

var server = net.createServer(function(socket) {
	socket.write('Echo server\r\n');
	socket.pipe(socket);
});

server.listen(1337, '127.0.0.1');
*/
/*
And connect with a tcp client from the command line using netcat, the *nix
utility for reading and writing across tcp/udp network connections.  I've only
used it for debugging myself.

$ netcat 127.0.0.1 1337

You should see:
> Echo server

*/

/* Or use this example tcp client written in node.js.  (Originated with
example code from
http://www.hacksparrow.com/tcp-socket-programming-in-node-js.html.) */
var express = require('express');
var app = express();
var server = require('http').createServer(app)
var io = require('socket.io')(server);
var fs = require('fs');


var getTime = function () {
   var date = new Date();     //new date object
   return date.getTime();     //gets current time
};
var timeInit = getTime();     //gets the time that the server was started

var getDynamicDate = function(){    //gets the dynamic starting date
  var d = new Date();
  var date = (d.getMonth().toString())        //the actual date
  + "-"
  + (d.getDate() + 1).toString()
  + "-"
  + (d.getFullYear().toString())
  + "-";

  var startTime = (d.getHours()).toString()    //the time
  + ":"
  + d.getMinutes().toString()
  + ":"
  + d.getSeconds().toString();

  return date + startTime;
}

app.use(express.static(__dirname + '/node_modules'));

app.get('/', function(req, res, next) {
   res.sendFile(__dirname + '/index.html');
});

server.listen(4200);        //public access port is 4200

io.on('connection', function (socket) {     //writes a message to the console when a client connects
  console.log('web client connected')
   //this is a sample
   socket.on('clienttoserver', function (id, dlc, bytes) {

      console.log(bytes)
      sendCANFrame(id, dlc, bytes.slice(0,dlc))
   });
   socket.on('openCandapter', function () {
      console.log('starting candapter');
      openCandapter();
   });
   socket.on('closeCandapter', function () {
      console.log('stopping candapter');
      closeCandapter();
   });
   //send CAN frame to Main Logic Module which calibrates high values
   socket.on('calibrateHigh', function (throttle1, throttle2) {
      throttle1 = throttle1 || 0;
      throttle2 = throttle2 || 0;
      //TODO Send can frame
   });
   socket.on('calibrateLow', function (throttle1, throttle2) {
      throttle1 = throttle1 || 0;
      throttle2 = throttle2 || 0;
      //TODO send can frame
   });

})

//send can Frame
var sendCANFrame = function (id, dlc, data) {
   message = 'T';       //identifier bit
   idStr = id.toString(16);
   idStr = constWidthFromRight(idStr, 3, '0');
   message += idStr;
   message += Math.max(1, Math.min(dlc, 8)).toString();
   message += data.map(function (x) {
      return idStr = constWidthFromRight(x, 2,'0'); //make all bytes in array hexstring
   }).reduce(function(a, b) {
      return a + b;
   });
   message += '\r'
   console.log(message);
   candapterComPort.write(message);
};

var openCandapter = function () {
   candapterComPort.write('O\r')
}

var closeCandapter = function () {
   candapterComPort.write('C\r')
}

var constWidthFromRight = function(s, w, c) {
   c = c || ' '
   for (var i = 0; i < w; i++)
   {

      s = c + s;
   }
   return(s.substring(s.length - w, s.length));
};

var net = require('net');
var client = new net.Socket();


//uncomment if planning to use socat, for talking to candapter
//Chris and Ben changed to serialport on 01-11-18

// client.connect(9922, '127.0.0.1', function() {
// 	console.log('Connected to Candapter');
// 	client.write('Hello, server! Love, Client.');
// });

var SerialPort = require ('serialport');
var candapterComPort = new SerialPort('/dev/ttyUSB0', {autoOpen: false});

candapterComPort.open(function(err) {
  if (err){
    return console.log("Error opening candapterComPort", err.message);
  }
});

client.on('close', function() {
	console.log('Connection closed');
});

log = getDynamicDate();       //date and time together

var logPath = "/home/ben/logs/" + log + ".log";     //path to the new log file
try{
  fs.appendFileSync("/home/ben/logs/runs.txt", log + "\n");     //adds the date to a file containing dates of all the runs
  fs.appendFileSync(logPath, log);        //creates and adds the current date and time to a new run log file
}catch (err){
  console.log(err.stack);
}



////parse can frame stuff
receivingCanFrame = Buffer.alloc(21);
receivingCanFrameIndex = 0;

var CanParseStateType = {
	BEFORE_FRAME: 0,
	RECEIVING_FRAME: 1
}

var canParseState = CanParseStateType.BEFORE_FRAME;

candapterComPort.on('data', function(candapterData) {
	i = 0
	//116 = 't' in ascii
	while (i < candapterData.length && candapterData[i] != 116 && canParseState == CanParseStateType.BEFORE_FRAME)
	{
		i++;
	}
	while (i < candapterData.length && candapterData[i] != 13 && receivingCanFrameIndex <= 21)
	{
		i++
		canParseState = CanParseStateType.RECEIVING_FRAME;
		receivingCanFrame[receivingCanFrameIndex] = candapterData[i]
		receivingCanFrameIndex ++;
	}
	if (candapterData[i] == 13)  //carriage return /r
	{
		canParseState = CanParseStateType.BEFORE_FRAME
		//console.log('Parsed: ' + receivingCanFrame.toString('ascii', 0, receivingCanFrameIndex) + '\n');
		io.emit("candata",
			candapterData.toString('ascii').substring(0,receivingCanFrameIndex),
      getTime() - timeInit);

    receivingCanFrameIndex = 0;
	}
  //writes CAN messages to log files
  fs.appendFileSync(logPath, candapterData);
	//console.log('Received: ' + candapterData + '\n');

});
