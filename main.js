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
    var discordChannel = null;
    var playlistID = null;

    function handleMessage(message) {
        if (message.op == 11) {
            sendHeartbeat = false;
        } else {
            lastSequenceNum = message.s;
        }
         
        if (message.op == 0){
            if (message.t == "MESSAGE_CREATE"){
            } else if (message.t == "GUILD_CREATE") {
                for (let ch of message.d.channels){
                    if (ch.type == 0){ //default channel will be the first text channel
                        discordChannel = ch.id;
                        break;
                    }
                }
            }
        } else if (message.op == 10){
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
        if (discordChannel){
            let request = https.request({
            hostname: 'discordapp.com',
                path: '/api/channels/'+ discordChannel +'/messages',
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
        } else {
            console.error("no discord channels detected");
        }
    }

    function getChannel(){
        if (playlistID == null){
            console.error("no playlist id");
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
                    if (data.items.length > 0){
                    getUploadPlaylistID(data.items[0].snippet.channelId);
                    } else {
                        console.error("playlist not found");
                        playlistID = null;
                    }
            });
        });
    }
    }

    function getUploadPlaylistID(channelID){
        https.get("https://www.googleapis.com/youtube/v3/channels?" + qs.stringify({
            part: "contentDetails",
            id: channelID,
            maxResults: 1,
            key: auth.youtube_token
        }), function(res){
            var data = "";
            res.on('data', function(d){
                data += d;
            });
            res.on('end', function(){
                uploadPlaylistID = JSON.parse(data).items[0].contentDetails.relatedPlaylists.uploads;
                console.log(uploadPlaylistID);
            });
        });
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
                    data = JSON.parse(data);
                    if (data.error) {
                        console.error(data.error.code + ": " + data.error.message);
                    } else {
                        for (let videos of data.items){
                        console.log(videos);
                        vidCheck(videos.snippet.resourceId.videoId);
                    }
                    }
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