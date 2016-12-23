var fs = require('fs');
var https = require('https');
var app = require('express')(), bodyParser = require('body-parser');
var auth = require('basic-auth')

var pegleg   = require('./pegleg.js');
var util = require('./util.js');

var fileName = "./secrets.json"
var secret

try {
  secrets = require(fileName)
}
catch (err) {
  secrets = {}
  console.log("unable to read file '" + fileName + "': ", err)
}


var options = {
   key  : fs.readFileSync(secrets.my_key),
   cert : fs.readFileSync(secrets.my_cert)
};

app.use(bodyParser.json());
// Authenticator
app.use(function(req, res, next) {
    var user = auth(req);

    if (user === undefined || user['name'] !== secrets.my_user || user['pass'] !== secrets.my_pwd) {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="sallgood.hopto.org"');
        res.end('Unauthorized');
    } else {
        next();
    }
});

app.get('/', function (req, res) {
   res.send('Hello World!');
});

//incoming POST from Quin at API.AI
app.post('/', function (req, res) {
    res.set('Content-Type', 'application/json');
    //console.log('{"speech": "Sure. ' + req.body.result.parameters.entity_id+ '"}');
    res.send('{"speech": "Sure. ' + req.body.result.parameters.entity_id+ '"}');
    PostCode(req.body.result.parameters.entity_id);
    res.end('ok');
});

//incoming POST from PegLeg at API.AI
app.post('/pegleg', function (req, res) {
    pegleg.handler(req, res, sendStuff); 
});

function sendStuff (res, data) {
    res.set('Content-Type', 'application/json');
    res.send(data);
    res.end('ok');
}

function PostCode(ent_id) {
    // Build the post string from an object
    // We replace all spaces with underscores to play nice with z-wave entity names in HASS
    ent_id = ent_id.replace(new RegExp(' ', 'g'), '_');
    
    var post_data = '{"entity_id":"light.' + ent_id + '"}';
    console.log("Post data: " + post_data);
  
    // An object of options to indicate where to post to
    var post_options = {
        host: my_host,
        port: '8123',
        path: '/api/services/homeassistant/toggle',
        method: 'POST',
        headers: {
            'x-ha-access': secrets.my_pwd,
            'Content-Type': 'application/json'
        }
    };

    // Set up the outgoing post to HASS
    var post_req = https.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            console.log('Response: ' + chunk);
        });
    });
      
    // post the data
    post_req.write(post_data);
    post_req.end();
}
  
https.createServer(options, app).listen(8124, function () {
   
   console.log('Started!');
 
});