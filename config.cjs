var config = {};

// Properties of generated test stream
// NOTE: this is only enabled if config.sourceStream remains empty
config.genWidth = 1920;
config.genHeight = 1080;

// Transcode profiles to send to the local Broadcaster node
// NOTE: this is only enabled if config.targetStream remains empty
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

config.sleepMS = 4000; // MS between each cycle of checking stream status'
config.maxBandwidthMBPS = 4.2; // Will start/stop pushes to stay under this limit of bandwidth usage
config.initialPushes = 2; // Initial amount of pushes to start out with
config.pushLimit = 10; // Max amount of concurrent pushes to allow

/// --- Settings you probably don't want to touch ---

// All pushes will be sent to this address
// MistLoadLivepeer generates a random UUID and appends it to this base
config.rtmpBase = "rtmp://localhost/live/";

// Source buffer for outgoing pushes
// Keep as "" to automatically create a test stream
// Else fill in the stream name you want to use as source
config.sourceStream = "";

// Target stream name to push towards
// Keep as "" to automatically add a stream which connects to a local, stock Livepeer Broadcaster node
// When set to anything else, it will simply use the rtmpBase as target
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
