# discord-playlist-bot
A Discord bot for notifying when new videos are added to a YouTube playlist

### Commands:
- yp!set [playlistId] to set the playlist checked by the bot. This will be checked every 30 minutes.
- yp!get to manually check for uploads to the playlist
- yp!channel to set the output channel to the channel this command was sent from

### Installation:
1. Go to https://discordapp.com/developers/applications/ and create a new application
2. Click "BOT" on the sidebar and add a bot 
3. Copy the TOKEN into the discord_token field of auth-template.json
4. Go to https://console.developers.google.com/apis/credentials and create a new API key
5. Paste the API key into the youtube_key field of auth-template.json
6. Rename auth-template.json to auth.json
7. Run npm install to install dependencies
8. Run npm start to start the bot
