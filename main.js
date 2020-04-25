"use strict";

const auth = require("./auth.json"); //load tokens using require since they shouldn't be modified
const https = require("https");
const ws = require("ws");

https.get("https://discordapp.com/api/gateway", function(res){ //get the WebSocket gateway from Discord
    var data = "";
    res.on('data',function(res){data += res;});
    res.on('end',function(){runBot(JSON.parse(data).url);});
});

function runBot(gateway){
    var connection = new ws(gateway);
    var sendHeartbeat = false;
    var heartbeatSender = null;
    var lastSequenceNum = null;

    function handleMessage(message) {
        lastSequenceNum = message.s;
        if (message.op == 10){
            heartbeatSender = setInterval(function(){
                connection.send(JSON.stringify({
                    "op" : 1,
                    "d" : lastSequenceNum
                }));
            },message.d.heartbeat_interval);
        }
    }

    connection.on('open',function(){
        connection.send(JSON.stringify({ //send handshake
            "op": 2,
            "d": {
              "token": auth.discord_token,
              "properties": {
                "$os": "linux",
                "$browser": "nodejs",
                "$device": "nodejs"
              }
            }
          }));
    });

    connection.on('message',function(res){
        handleMessage(JSON.parse(res));
    });
}