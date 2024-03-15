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
    console.log(adr)
    var sql = 'SELECT * FROM iot_boiler WHERE id = ?';
    conn.query(sql, [adr], function (err, rows, fields) {
        if(err) console.log('query is not excuted. select fail...\n' + err);
        else res.json({ device: rows[0] });
    });
});



/**
 * deivceControlName : switch, hope_temperature, mode
 * method : put
 */
router.put('/control/:deviceId', (req, res, next) =>{
    console.log("body", req.body)
    
    const deviceId = req.params.deviceId;
    const deivceControl = req.body.deviceControl
    const deivceControlName = req.body.deviceControlName;

    console.log("deviceId", deviceId)
    console.log("deivceControl", deivceControl)
    console.log("deivceControlName", deivceControlName)
    
    var sql = 'UPDATE iot_boiler SET '+ deivceControlName+' = ? WHERE id = ?';
    conn.query(sql, [deivceControl, deviceId], function (err, rows, fields) {
        if(err) console.log('query is not excuted. select fail...\n' + err);
        else res.json({status : "ok"});
    });

})


module.exports = router;
