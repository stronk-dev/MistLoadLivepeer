# gratis
Keeps a set amount of streams active on a local MistServer instance

Can be configured to duplicate an existing stream. If not set it will generate a test stream as source

Instructions on how to set it up to transcode using a local Livepeer Broadcaster node coming soon...

Meanwhile check out this awesome drawing made in paint:
![secrets](https://github.com/stronk-dev/gratis/blob/master/images/secrets.png)

Not yet hooked up to retrieve stream health, only for applying load

### prep
`npm install` to install required node packages

Prerequisites: 
  - MistServer running somewhere
    It is recommended to just run mistserver/MistController in a separate terminal
    Make sure to configure it for transcoding
  - (Optionally) a preconfigured stream in MistServer
    There's a webinterface to configure streams at mistHost (usually http://127.0.0.1:4242)
    If unset it will generate a test stream using ffmpeg on MistServer's host machine
    This generated stream is in 720p or something and a fairly low bitrate

Notes:
  - this is experimental software and it might be possible that a push to your does not get stopped on shutdown
    make sure to check your mistHost's push page every now and then to check on it
  

### run
run `mistserver/MistController` in a terminal first to boot up MistServer

Configure a stream to us as source. You can add a VOD file or set up a push input to stream into. If you do not configure anything, a a low bitrate 720p infinite test stream will be created

Create a stream called 'live' with source 'push://'. This is the default stream name gratis uses. Configure a Livepeer transcode process in order to hook up a local Broadcaster node

run `node gratis.cjs` to start the load test. It will slowly start streams from the initial amount up to the configured amount

Open MistServer's interface to view the streams and transcoded tracks (default @ http://localhost:4242)