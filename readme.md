# gratis
Keeps a set amount of streams active on a local MistServer instance \
Does not check stream health yet. This tool currently only applies load to the Broadcaster node using MistServer \
Requires a Livepeer Broadcaster node already running locally (unless you're overriding the default settings to stream somewhere else)

Check out this awesome drawing made in paint:
![secrets](https://github.com/stronk-dev/gratis/blob/master/images/secrets.png)


By default it auto-configures method 3 of above image. You can configure the transcode profile and amount of streams to push in `config.cjs``

### Prep
`nodejs` and either `npm` or `yarn` need to be installed in order to install dependencies and run the script \
run `npm install` or `yarn install` to install required node packages \
you also need `ffmpeg` installed if you want to generate a test stream to use as source on the fly, which is the default option

First time setup: 
  - MistServer running locally to push data from \
    If you do not have MistServer installed, you can just run the bundled binaries and config, see chapter `Run`

  - (Optionally) a stream or VOD to use as a source \
    If you do not configure anything, a a low bitrate test stream will be generated using ffmpeg \
    Otherwise there's a webinterface to configure streams (by default at http://127.0.0.1:4242). You can add a VOD file or set up a push input to stream into

  - (Optionally) a RTMP target to push towards \
    If you do not configure anything, it will assume the Broadcaster node is running on the local machine \
    It will automatically set up MistServer to transcode using the local Broadcaster node

    You can also set a custom RTMP target to push towards instead \
    NOTE: Direct Livepeer Broadcaster ingest is untested and probably does not work (yet)
  
### Run
run `mistserver/MistController --config mistserver/config.json` in a terminal to boot up MistServer. Unless you already have a local MistServer instance running


run `node gratis.cjs` to start the load test. It will slowly start streams from the initial amount up to the configured limit

Open MistServer's interface to browse through the streams and transcoded renditions \
By default this page is available at `http://127.0.0.1:4242` with username `test` and password `test` 

Note:
  - This is experimental software and it might be possible that a push does not get stopped on shutdown \
    Be sure to check your mistHost's push page every now and then to check on it \
    FFMPEG might also require a manual shutdown using `killall ffmpeg` afterwards