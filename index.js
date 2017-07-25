var RaspiCam = require("raspicam");
var cv = require('opencv');
var express = require('express');
var sio = require('socket.io');
var ss = require('socket.io-stream');
var fs = require('fs');
const EventEmitter = require('events');
var emitter = new EventEmitter();

var app = express()
var http = require('http').Server(app);

app.use('/static', express.static('/home/pi/opencv/static'));
app.get('/', function (req, res) {
  res.sendFile('/home/pi/server/index.html');
})

app.listen(8080, function () {
  console.log('App listening on port 8080!')
})

var http = require('http');
http.createServer(app).listen(80);
var io = sio(http);
io.on('connection', (socket) => {
  console.log("Someone connected.");
});

emitter.on('facefound', (filename) => {
  var data = fs.readFile(filename, (err, data) => {
    if (err) throw err;
    var base64Data = data.toString('base64');
    io.emit('newimg', "image/png;base64,"+base64Data);
  });
});

var camera = new RaspiCam({
	mode: "timelapse",
	output: "./photo/image-%d.jpg",
	encoding: "jpg",
  timelapse: 500,
	timeout: 0 // take the picture immediately
});

camera.on("start", function( err, timestamp ){
	console.log("photo started at " + timestamp );
});

camera.on("read", function( err, timestamp, filename ){
	console.log("photo image captured with filename: " + filename );
  //Now load that photo into opencv
  cv.readImage("/home/pi/opencv/photo/"+filename, function(err, im){
    if (err) throw err;
    if (im.width() < 1 || im.height() < 1) {
      console.log("Image has no size");
      return;
    }
    im.detectObject("./node_modules/opencv/data/haarcascade_frontalface_alt.xml", {}, function(err, faces){
      if (err) throw err;

      for (var i = 0; i < faces.length; i++){
        var face = faces[i];
        im.ellipse(face.x + face.width / 2, face.y + face.height / 2, face.width / 2, face.height / 2);
      }

      var fileLocation = './tmp/face-detectObject.png';
      im.save(fileLocation);
      emitter.emit('facefound', fileLocation);
      console.log('Image saved to ./tmp/face-detection.png');
    });
  });
});

camera.on("exit", function( timestamp ){
	console.log("photo child process has exited at " + timestamp );
});

camera.start();
