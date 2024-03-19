var coap = require('coap');
const mysql = require('../config/database')();
const conn = mysql.init();

module.exports = {
    
  connect() {
    var portNumber = 5683;
    coap.createServer(function (req,res) {
        console.log('CoAP device got a request from %s', req.url);
        console.log('CoAp req %s', req);
        console.log('CoAp req.payload %s', req.payload);

        switch(req.url) {
            case "/iot/status/1000":
              displayOutput(res, {'deviceId': 1000});
            break;
            case "/iot/control/1000":
              controlProcess(res, req, "1000")
            break;
  
            default:
            displayOutput(res);
  
          }
     }).listen(portNumber);
    
    console.log(`CoAP Server is started at port Number ${portNumber}`);
    
    // Send
    function displayOutput (res,content) {

      var sql = 'SELECT * FROM iot_boiler WHERE id = 1000';
      conn.query(sql, [], function (err, rows, fields) {
          if(err) console.log('query is not excuted. select fail...\n' + err);
          console.log("Sending measurement: " + rows[0] + "º");
          res.setOption('Content-Format','application/json');
          res.end (JSON.stringify(rows[0]));
      });

    }

    //Input
    function controlProcess(res, req, ids) {

      const deviceId = ids;

      const payloadJson = JSON.parse(req.payload) //payload에온다 
      const deviceControl = payloadJson.deviceControl
      const deviceControlName = payloadJson.deviceControlName;


      console.log("deviceId", deviceId)
      console.log("deivceControl", deviceControl)
      console.log("deivceControlName", deviceControlName)
      
      res.setOption('Content-Format','application/json');

      var sql = `UPDATE iot_boiler SET ${deviceControlName}  = ? WHERE id = ?`;
      conn.query(sql, [deviceControl, deviceId], function (err, rows, fields) {
          if(err) console.log('query is not excuted. select fail...\n' + err);
          res.end (JSON.stringify({"status" : "ok"}));
      });
     
      
    }
    
  }
  
};
  