var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const history = require('connect-history-api-fallback');

var indexRouter = require('./routes/index');
var iotRouter = require('./routes/iot');
var mqttHandler = require('./conn/mqtt-device');
var coapHandler = require('./conn/coap-device');
var bacnetHandler = require('./conn/bacnet-device');
var opcuaHandler = require('./conn/opcua-device');
var modbusHandler = require('./conn/modbus-device');
var dnp3Handler = require('./conn/dnp3-device');
var iec61850Handler = require('./conn/iec61850-device');
var batch = require('./config/batch');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Vue.js Routing page
app.use('/api/iot', iotRouter);
app.use('/', indexRouter);
app.use(history());
app.use(express.static('public'));

// 프로토콜 서버 시작
console.info('[APP] Starting protocol servers...');
mqttHandler.connect();
coapHandler.connect();
bacnetHandler.connect();
opcuaHandler.connect();
modbusHandler.connect();
dnp3Handler.connect();
iec61850Handler.connect();
batch.batchStart();
console.info('[APP] Batch scheduler started');

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
