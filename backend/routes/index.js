var express = require('express');
var path = require('path');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

router.post('/', function(req, res, next) {
  res.json(req.body);
});

module.exports = router;
