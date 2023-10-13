# gratis
Keeps a set amount of streams active on a local MistServer instance \
Does not check stream health yet. This tool currently only applies load to the Broadcaster node using MistServer \
Requires a Livepeer Broadcaster node already running locally (unless you're overriding the default settings to stream somewhere else)

Check out this awesome drawing made in paint:
![secrets](https://github.com/stronk-dev/gratis/blob/master/images/secrets.png)


By default it auto-configures method 3 of above image. You can configure the transcode profile and amount of streams to push in `config.cjs`

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

### Running a Livepeer Broadcaster
A Livepeer Broadcaster node has to be running locally, which is ran basically the same as an Orchestrator node \
Use `livepeer_cli` to add some ETH as some minimum balance might be required \
It is advised for the Orchestrators used by the Broadcaster to set the price to 0, otherwise these load tests will be expensive

The following flags should be adjusted on the Broadcaster:
- `-orchAddr`: fill in the service URI including port of the Orchestrator's you want to use for transcoding, ie: `https://your.transcoder.com:8995`. Accepts a single string or a list of strings
- `-maxPricePerUnit`: if you don't want to accidentally spend cash on streams if the O's don't have their price set to 0
- `-rtmpAddr`: MistServer's RTMP port will clash with the Broadcaster's RTMP port. It is advised to set the Broadcaster to a non-default port like `0.0.0.0:1936` and use MistServer for ingest
- `-httpAddr`: Recommended to set this to `0.0.0.0:1937` or `127.0.0.1:1937`. **By default the script will use port `1937` to send segments to the Broadcaster**
- `-httpIngest`: Set this to `true`
- `-maxSessions`: By default the Broadcaster will only allow 10 concurrent sessions

Here is an example systemd script for inspiration:
```
[Unit]
Description=LivepeerBroadcaster

[Service]
Type=simple
User=stronk
Restart=always
RestartSec=4
ExecStart=/usr/local/bin/livepeer -network arbitrum-one-mainnet \
-broadcaster=true \
-orchAddr=https://orchestrator.video-miner.xyz:8443 \
-ethAcctAddr=0x847791cBF03be716A7fe9Dc8c9Affe17Bd49Ae5e \
-maxPricePerUnit=10 \
-ethUrl=https://arbitrum.blockpi.network/v1/rpc/public \
-ethPassword /path/to/eth-password.txt \
-cliAddr 127.0.0.1:8994 \
-httpAddr 0.0.0.0:1937 \
-rtmpAddr 0.0.0.0:1936 \
-httpIngest=true \
-monitor \
-maxSessions=30

[Install]
WantedBy=default.target
```