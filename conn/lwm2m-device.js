var server = require('lwm2m').createServer();
 
server.on('register', function(params, accept) {
  setImmediate(function() {
    server
    .read(params.ep, '3/0')
    .then(function(device) {
      console.log(JSON.stringify(device, null, 4));
    })
  });
  accept();
});
 
server.listen(5683);