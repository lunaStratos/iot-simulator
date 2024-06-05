var coap = require('coap');
const mysql = require('../config/database')();
const conn = mysql.init();

/**
 * http://localhost:3000/iot/status/1000
 * http://localhost:3000/iot/control/1000
 * http://localhost:3000/iot/status/2000
 * http://localhost:3000/iot/control/2000
 */
module.exports = {
    
  connect() {
    var portNumber = 5683;
    const server = coap.createServer()

    server.on('request', (req, res) => {

      console.log('CoAP device got a request from %s', req.url);

        const deviceId = req.url.substring(req.url.lastIndexOf('/') + 1);

        switch(req.url) {
            case "/iot/status/" + deviceId:
              displayOutput(res, req, {'deviceId': deviceId});
            break;
            case "/iot/control/" + deviceId:
              controlProcess(res, req, deviceId)
            break;
  
            default:
            displayOutput(res);
  
        }
    })
    
    server.listen(() => {
        console.log('server started')
    })

    console.log(`CoAP Server is started at port Number ${portNumber}`);
  
    
    // Send
    function displayOutput (res, req, content, ) {

      const adr = content.deviceId;
    
      var sql = `select * , (select concat('{' ,group_concat('"',name,'"',':' ,'"',val,'"' ),'}') from iot_device_value) as json from iot_device where id = ?`
    
      conn.query(sql, [adr], function (err, rows, fields) {
          if(err) console.log('query is not excuted. select fail...\n' + err);
          else{
              rows[0].json = JSON.parse(rows[0].json)

              res.setOption('Content-Format','application/json');
              res.end(JSON.stringify({ device: rows[0] }));
              
          }
      });

    }

    //Input
    function controlProcess(res, req, ids) {

      const deviceId = ids;

      const payloadJson = JSON.parse(req.payload) //payload에 온다 

      console.log(payloadJson)
      const deviceControl = payloadJson.deviceControl
      const deviceControlName = payloadJson.deviceControlName;


      console.log("deviceId", deviceId)
      console.log("deviceControl", deviceControl)
      console.log("deviceControlName", deviceControlName)
      
      res.setOption('Content-Format','application/json');

      var sql = 'UPDATE iot_device_value SET val = ? WHERE name = ? AND id = ?';
      
      conn.query(sql, [deviceControl, deviceControlName , deviceId], function (err, rows, fields) {
          if(err) {
              console.log('query is not excuted. select fail...\n' + err);
              res.json({status : "error"});
          }else{
            res.setOption('Content-Format','application/json'); 
            res.end(JSON.stringify({"status" : "ok"}));
          }
      });
      
    }
    
  }
  
};
  