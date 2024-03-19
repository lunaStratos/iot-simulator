var server = require('lwm2m').createServer();
const mysql = require('../config/database')();
const conn = mysql.init();


const portNumber = 5300;
module.exports = {
    
    connect() {  
      console.log(`lwm2m Server is started at port Number ${portNumber}`);
      server.on('register', function(params, accept) {
        console.log(`register ${params}`);

        setImmediate(function() {
           
          // read device related information
          server.read("test", '3/0')
            .then(function(device) {
              console.log(JSON.stringify(device, null, 4))
            })
            
          // monitor device battery level
          server.observe("test", '/3/0/9')
            .then(function(teststream) {
              stream.on('data', function(value) {
                console.log('battery level: %d%', value)
              })
            })
        })

        var schema = Schema({
          test: { id: 1, type: Number }
        });
        
        var options = { 
          schema: schema, 
          format: 'json',
        };
        
        server.read('test', '/1024/11', options, function(err, res) {
          assert(res.hasOwnProperty('test'));
          assert(typeof res.test == 'number');
        });

        accept()
      })
      
      server.listen(portNumber)
    }
  
  };
  