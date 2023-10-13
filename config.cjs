var config = {};

// Properties of generated test stream
// NOTE: this is only enabled if config.sourceStream remains empty like it is by default
//       you can set sourceStream if you already have a configured stream in MistServer to use
//       as the source for the load test
// It is recommended to have the source resolution higher than the profiles below
config.genWidth = 1920;
config.genHeight = 1080;

// NOTE: The next two settings are only enabled if config.targetStream remains empty like it is by default
//       you can modify targetStream if you already have an RTMP endopoint to test
//       if you do this, mist will no longer configure a stream for you
// httpAddr of the Broadcaster node. It is highly recommended to run MistServer on the local network of the Broadcaster
config.broadcasterUri = "http://localhost:1937";
// Transcode profiles to send to the local Broadcaster node
config.profiles = [
  {
    bitrate: 250000,
    fps: 15,
    height: 480,
    name: "480p",
    profile: "H264ConstrainedHigh",
    track_inhibit: "video=<850x480",
    "x-LSP-name": "480p",
  },
  {
    bitrate: 1000000,
    fps: 25,
    height: 720,
    name: "720p",
    profile: "H264ConstrainedHigh",
    track_inhibit: "video=<1281x720",
    "x-LSP-name": "720p",
  },
];

config.maxBandwidthMBPS = 4.2; // Will start/stop pushes to stay under this limit of bandwidth usage
config.initialPushes = 2; // Initial amount of streams to start out with
config.pushLimit = 10; // Max amount of concurrent streams to allow

/// --- The following settings you likely won't need to edit ---

config.sleepMS = 4000; // milliseconds between each cycle of checking stream status'

// All pushes will be sent to this address
// MistLoadLivepeer generates a random UUID and appends it to this base
config.rtmpBase = "rtmp://localhost/live/";

// Source buffer for outgoing pushes
// Keep as "" to automatically create a test stream
// Else fill in the stream name of the stream you configured in MistServer
config.sourceStream = "";

// Target stream name to push towards
// Keep as "" to automatically configure this stream in MistServer
// It will use broadcasterUri for transcoding on the Livepeer network
// If you change this value, streams will be sent to `rtmpBase/<random uuid>`
config.targetStream = "";

/// --- MistServer connection config ---

// Settings below shouldn't be changed just yet, but will be used to allow remote management later on

// Edit this if MistServer is running on a remote server
config.mistHost = "http://127.0.0.1:4242";
// If mistHost is not on localhost, set it to true as you will require to login
config.auth = false;
// fill in username to your MistServer instance if auth == true
config.mistUname = "";
// fill in password to your MistServer instance if auth == true
config.mistPw = "";

module.exports = config;
