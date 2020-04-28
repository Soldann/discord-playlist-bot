"use strict";

const auth = require("./auth.json"); //load tokens using require since they shouldn't be modified
const https = require("https");
const ws = require("ws");
const qs = require("querystring");

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
    var uploadPlaylistID = null;

    function handleMessage(message) {
        if (message.op == 11) {
            sendHeartbeat = false;
        } else {
            lastSequenceNum = message.s;
        }
         
        if (message.op == 10){
            heartbeatSender = setInterval(function(){
                if (sendHeartbeat == true){ //connection is broken
                    clearInterval(heartbeatSender);
                }
                connection.send(JSON.stringify({
                    "op" : 1,
                    "d" : lastSequenceNum
                }));
                sendHeartbeat = true;
            },message.d.heartbeat_interval);
        }
        console.log(message);
    }

    function sendMessage(message){
        var request = https.request({
            hostname: 'discordapp.com',
            path: '/api/channels/360542726896353290/messages',
            method: 'POST',
            agent: new https.Agent(this),
            headers: {
                "Authorization": "Bot " + auth.discord_token,
                "User-Agent": "discord-playlist-bot (https://github.com/Soldann/discord-playlist-bot, v1.0.0)",
                "Content-Type": "application/json",
            }
        });
        request.write(JSON.stringify({
            content: message,
            tts: false
        }), function(err){ request.end(); });
    }

    function getChannel(){
        if (playlistID == null){
            console.log("no playlist id");
        } else {
            https.get("https://www.googleapis.com/youtube/v3/playlists?" + qs.stringify({
                part: "snippet",
                id: playlistID,
            maxResults: 1,
            key: auth.youtube_token
        }), function(res){
            var data = "";
            res.on('data', function(d){
                data += d;
            });
            res.on('end', function(){
                    data = JSON.parse(data);
                    console.log(data);
                    console.log(data.items[0].snippet.channelId);
                    getUploadPlaylistID(data.items[0].snippet.channelId);
            });
        });
    }
    }

    function getUploads(){
        if (uploadPlaylistID === null){
            console.error("no channel defined")
        } else {
            https.get("https://www.googleapis.com/youtube/v3/playlistItems?" + qs.stringify({
                part: "snippet",
                playlistId: uploadPlaylistID,
                maxResults: 25,
                key: auth.youtube_token
            }), function(res){
                var data = "";
                res.on('data', function(d){
                    data += d;
                })
                res.on('end', function(){
                    console.log(JSON.parse(data).items);
                })
            });
        }
    }

    function vidCheck(vidID){
        if (playlistID === null){
            console.error("no playlist defined")
        } else {
            https.get("https://www.googleapis.com/youtube/v3/playlistItems?" + qs.stringify({
                part: "snippet",
                playlistId: playlistID,
                maxResults: 25,
                videoId: vidID,
                key: auth.youtube_token
            }), function(res){
                var data = "";
                res.on('data', function(d){
                    data += d;
            })
            res.on('end', function(){
                    data = JSON.parse(data);
                    if (data.error || data.items.length == 0){
                        //video not in playlist
                    } else {
                        console.log(data.items[0]);
                        sendMessage(data.items[0].snippet.title);
                    }
        })
            });
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