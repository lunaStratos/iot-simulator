const coap = require('coap')
const server = coap.createServer()

server.on('request', (req, res) => {
  res.end('Hello ' + req.url.split('/')[1] + '\n')
})

// the default CoAP port is 5683
server.listen(() => {
  const req = coap.request('coap://localhost:5683')

  req.on('response', (res) => {
    res.pipe(process.stdout)
    res.on('end', () => {
      process.exit(0)
    })
  })

  req.end()
})

/**
 * 
 * https://saii42.tistory.com/52
 */