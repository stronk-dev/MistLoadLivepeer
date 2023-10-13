# gratis
Keeps a set amount of streams active on a local MistServer instance \
Can be configured to duplicate an existing stream. If not set it will generate a test stream as source \
Instructions on how to set it up to transcode using a local Livepeer Broadcaster node coming soon...

Meanwhile check out this awesome drawing made in paint:
![secrets](https://github.com/stronk-dev/gratis/blob/master/images/secrets.png)

Not yet hooked up to retrieve stream health, only for applying load

### prep
`nodejs` and either `npm` or `yarn` need to be installed in order to install dependencies and run the script \
run `npm install` or `yarn install` to install required node packages \
you also need `FFMPEG` installed if you want to generate a test stream to use as source on the fly

First time setup: 
  - MistServer running locally to push data from \
    It is recommended to just run mistserver/MistController in a separate terminal

  - (Optionally) a preconfigured stream on the local MistServer to use as source \
    If you do not configure anything, a a low bitrate 720p infinite test stream will be created using ffmpeg on MistServer's host machine \
    Otherwise there's a webinterface to configure streams at mistHost (usually http://127.0.0.1:4242)

    Configure a stream to us as source. You can add a VOD file or set up a push input to stream into

  - (Optionally) a RTMP target to push towards \
    If you do not configure anything, it will assume the Broadcaster node is running on the local machine \
    It will automatically set up MistServer to transcode using the local Broadcaster node

    You can also set a custom RTMP target to push towards instead \
    NOTE: Direct Livepeer Broadcaster ingest is untested and probably does not work (yet) \

Note:
  - This is experimental software and it might be possible that a push does not get stopped on shutdown \
    Be sure to check your mistHost's push page every now and then to check on it
  

### run
run `mistserver/MistController` in a terminal first to boot up MistServer. Unless you already have a local MistServer instance running of course


run `node gratis.cjs` to start the load test. It will slowly start streams from the initial amount up to the configured amount

Open MistServer's interface to view the streams and transcoded tracks (default @ http://localhost:4242)