var config = {};

/// Most import variable to set
// All pushes will be sent to this address
config.rtmpBase = "rtmp://localhost/live/live+"


/// --- MistServer connection config ---


// Edit this if MistServer is running on a remote server - not supported for now
config.mistHost = "http://127.0.0.1:4242";
// Preconfigured stream name in MistServer
// If empty, pusheidon creates a new stream running local ffmpeg
config.streamName = "";
// If mistHost is not on localhost, set it to true as you will require to login
config.auth = false;
// fill in username to your MistServer instance if auth == true
config.mistUname = "";
// fill in password to your MistServer instance if auth == true
config.mistPw = "";


/// --- Config Variables ---

config.sleepMS = 4000;                // MS between each cycle of checking stream status'
config.maxBandwidthMBPS = 4.20;       // Will start/stop pushes to stay under this limit of bandwidth usage
config.initialPushes = 2;             // Initial amount of pushes to start
config.pushLimit = 8;                 // Max amount of total pushes to allow

module.exports = config;

