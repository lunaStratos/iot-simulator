const coap = require('coap'),
  bl = require('bl');


//construct coap request
var req = coap.request({
  observe: false,
  host: 'localhost',
  pathname: '/',
  port: 5683,
  method: 'get',
  confirmable: 'true',
  retrySend: 'true',
})

//put payload into request      
var payload = {
  username: 'aniu',
}
req.write(JSON.stringify(payload));

//waiting for coap server send con response
req.on('response', function(res) {
  //print response code, headers,options,method
  console.log('response code', res.code);

  if (res.code !== '2.05') return process.exit(1);
  //get response/payload from coap server, server sends json format
  res.pipe(bl(function(err, data) {
    //parse data into string
    var json = JSON.parse(data);
    console.log("string:", json);
    // JSON.stringify(json));
  }))

});
req.end();