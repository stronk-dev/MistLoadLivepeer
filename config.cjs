var config = {};

// Most import variable to set - all pushes will be sent to this address
// Gratis generates a random UUID and appends it to this base
config.rtmpBase = "rtmp://localhost/live/"


/// --- Config Variables ---

// Source buffer for outgoing pushes
// Keep as "" to automatically create a test stream
// Else fill in the stream name you want to use as source
config.sourceStream = "";
// Target stream name to push towards
// Keep as "" to automatically add a strean
//  preconfigured to use a local, stock Livepeer Broadcaster node
// When set to anything else, it will simply use the rtmpBase as target
config.targetStream = ""
config.sleepMS = 4000;                // MS between each cycle of checking stream status'
config.maxBandwidthMBPS = 4.20;       // Will start/stop pushes to stay under this limit of bandwidth usage
config.initialPushes = 2;             // Initial amount of pushes to start
config.pushLimit = 10;                 // Max amount of total pushes to allow

// When using a generated test stream, set it's properties here
config.genWidth = 1920;
config.genHeight = 1080;


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