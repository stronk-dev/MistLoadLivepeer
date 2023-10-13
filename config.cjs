var config = {};

// Most import variable to set - all pushes will be sent to this address
// defaults to use the local MistServer instance using stream name 'live'
// Gratis generates a random UUID and appends it to this base
config.rtmpBase = "rtmp://localhost/live/live+"


/// --- Config Variables ---

config.sleepMS = 4000;                // MS between each cycle of checking stream status'
config.maxBandwidthMBPS = 4.20;       // Will start/stop pushes to stay under this limit of bandwidth usage
config.initialPushes = 2;             // Initial amount of pushes to start
config.pushLimit = 10;                 // Max amount of total pushes to allow


/// --- MistServer connection config ---

// Preconfigured stream name in MistServer
// If you want to reuse an existing stream, set it's stream name here
// If empty, gratis creates a new stream using FFMPEG on the local machine
config.streamName = "";

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