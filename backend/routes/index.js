var express = require('express');
var path = require('path'); // 모듈 추가
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  // res.render('index', { title: 'Express' });
  res.sendfile(path.join(__dirname, '../public/index.html')); // Vue로 빌드된 html 전송
});


/* post */
router.post('/', function(req, res, next) {
  console.log(req.body)
  res.json(req.body);
});

module.exports = router;
