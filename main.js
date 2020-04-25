"use strict";

const auth = require("./auth.json"); //load tokens using require since they shouldn't be modified
const https = require("https");
const ws = require("ws");

https.get("https://discordapp.com/api/gateway", function(res){ //get the WebSocket gateway from Discord
    var data = "";
    res.on('data',function(res){data += res;});
    res.on('end',function(){
        var bot = new Bot(JSON.parse(data).url);
        bot.runBot();
    });
});

class Bot {
    constructor(gateway){
        this.connection = new ws(gateway);
    }

    runBot(){
        this.connection.on('open',() => {
            this.connection.send(JSON.stringify({ //send handshake
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
    
        this.connection.on('message',function(res){
            console.log(JSON.parse(res));
        });
    }

}