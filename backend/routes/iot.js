const express = require('express');
const router = express.Router();
const mysql = require('../config/database')();
const conn = mysql.init();
mysql.db_open(conn);

/**
 * /api/iot 
 */


router.get('/status/:deviceId', function(req, res, next) {
    const adr = req.params.deviceId;
    console.log("adr", adr)
    var sql = `select * , (select concat('{' ,group_concat('"',name,'"',':' ,'"',val,'"' ),'}') from iot_device_value where id = ${adr}) as json from iot_device where id = ${adr}`
    
    conn.query(sql, [], function (err, rows, fields) {
        if(err) console.log('query is not excuted. select fail...\n' + err);
        else{
            rows[0].json = JSON.parse(rows[0].json)
            res.json({ device: rows[0] });
        }
    });
});



/**
 * deviceControlName : switch, hope_temperature, mode
 * method : put
 */
router.put('/control/:deviceId', (req, res, next) =>{
    console.log("body", req.body)
    
    const deviceId = req.params.deviceId;
    const deviceControl = req.body.deviceControl
    const deviceControlName = req.body.deviceControlName;

    console.log("deviceId", deviceId)
    console.log("deviceControl", deviceControl)
    console.log("deviceControlName", deviceControlName)
    
    var sql = 'UPDATE iot_device_value SET val = ? WHERE name = ? AND id = ?';
    conn.query(sql, [deviceControl, deviceControlName , deviceId], function (err, rows, fields) {
        if(err) {
            console.log('query is not excuted. select fail...\n' + err);
            res.json({status : "error"});
        }else res.json({status : "ok"});
    });

})


module.exports = router;
