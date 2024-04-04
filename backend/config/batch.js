var schedule = require('node-schedule');

const util = require('../util/util');
const mysql = require('../config/database')();
const conn = mysql.init();

/**
 * schedule 
 * 
 * 5 sec update 
 * 
 */
module.exports = {
    batchStart() {
        schedule.scheduleJob('*/5 * * * * *', ()=>{ 

            const humidity = Math.floor(Math.random() * 101)
            const nowtemp = Math.floor(Math.random() * 20) + 16;
            const deviceId = "1000"; // boiler

            var sql = "SELECT val from iot_device_value WHERE id = ? and name = 'switch'";
            conn.query(sql, [deviceId], function (err, rows, fields) {
                if(rows[0].val !== 0){
                    var sql = "UPDATE iot_device_value SET val = ? WHERE name = 'now_temperature' AND id = ?";
                    conn.query(sql, [nowtemp, deviceId], function (err, rows, fields) {
        
                    });
                
                    var sql = "UPDATE iot_device_value SET val = ? WHERE name = 'humidity' AND id = ?";
                    conn.query(sql, [humidity, deviceId], function (err, rows, fields) {
                
                    });
                }
            });
        
            
        
        })
    }
}