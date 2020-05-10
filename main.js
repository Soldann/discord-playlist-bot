"use strict";

//TODO: cleanup debug statements

const auth = require("./auth.json"); //load tokens using require since they shouldn't be modified
const https = require("https");
const ws = require("ws");
const qs = require("querystring");

https.get("https://discordapp.com/api/gateway", function(res){ //get the WebSocket gateway from Discord
    var data = "";
    res.on('data',function(res){data += res;});
    res.on('end',function(){runBot(JSON.parse(data).url);});
});

function getDate(){
    var date = new Date();
    return date.toISOString();
}

function runBot(gateway){
    var connection = new ws(gateway);
    var sendHeartbeat = false;
    var heartbeatSender = null; //holds the setInterval object that sends websocket heartbeat
    var lastSequenceNum = null;
    var uploadPlaylistID = null;
    var discordChannel = null;
    var playlistID = null;
    var lastCheck = getDate();
    var scheduler = null; //holds the setInterval object that calls getUploads every X mins
    var rateLimitReset = 5000; //delay sending messages for this amount of time (in ms) to reset the rate limit
    var rateLimit = 1; //default rateLimit set to 1
    var rateSent = 0; //number of message requests sent
    var rateLimitTimer = null;

    function handleMessage(message) {
        if (message.op == 11) {
            sendHeartbeat = false;
        } else {
            lastSequenceNum = message.s;
        }
        
        if (message.op == 0){
            if (message.t == "MESSAGE_CREATE"){
                let reResult = null;
                if (reResult = message.d.content.match(/^yp!set\s([^\s]+)/)){ //set playlistID
                    sendMessage("Playlist set to " + reResult[1]);
                    playlistID = reResult[1];
                    getChannel();
                    if (!scheduler){
                        scheduler = setInterval(getUploads, 1800000); //schedule checking for uploads every 30 mins
                    }
                } else if (message.d.content.match(/^yp!get/)) {
                    getUploads();
                } else if (message.d.content.match(/^yp!channel/)) {
                    discordChannel = message.d.channel_id;
                    sendMessage("Output channel set");
                }
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
        if (rateSent >= rateLimit) {
            setTimeout(sendMessage,rateLimitReset,message); //do nothing, try again after the rateLimitReset
        } else if (discordChannel){
            rateSent += 1; //update because we sent a message request
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
            }, function(res){
                if (res.statusCode == 429){
                    console.error("Rate Limited!");
                }
                //update rateLimit variables in case they have changed
                rateLimit = res.headers["x-ratelimit-limit"];
                rateLimitReset = res.headers["x-ratelimit-reset-after"] * 1000 //change from seconds to ms

                //don't allow multiple instances, use the most recent data
                clearTimeout(rateLimitTimer); 
                rateLimitTimer = setInterval(() => {rateSent = 0;}, rateLimitReset);
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
            });
        });
    }

    function getUploads(){
        function requestPlaylistItems(pageToken=""){
            https.get("https://www.googleapis.com/youtube/v3/playlistItems?" + qs.stringify({
                part: "snippet",
                playlistId: uploadPlaylistID,
                maxResults: 25,
                nextPageToken: pageToken,
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
                        if (data.nextPageToken && data.items.length > 0 && data.items[data.items.length - 1].snippet.publishedAt >= lastCheck){ //stop iterating if going past lastCheck time
                            console.log("next page");
                            requestPlaylistItems(data.nextPageToken); //recursively iterate through pages
                        }
                        for (let videos of data.items){
                            if (videos.snippet.publishedAt < lastCheck) {
                                break;
                            }
                            vidCheck(videos.snippet.resourceId.videoId);
                        }
                        lastCheck = getDate();
                    }
                })
            });
        }
        if (uploadPlaylistID === null){
            console.error("no channel defined")
        } else {
            requestPlaylistItems();
        }
    }

    function vidCheck(vidID){
        if (playlistID === null){
            console.error("no playlist defined")
        } else {
            https.get("https://www.googleapis.com/youtube/v3/playlistItems?" + qs.stringify({
                part: "snippet",
                playlistId: playlistID,
                maxResults: 1, //should only return 1 if in playlist or 0 if not
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
                        sendMessage("**" + data.items[0].snippet.title + "**" +
                            "\nhttps://youtu.be/" + data.items[0].snippet.resourceId.videoId);
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