/****************************************************************/
/*      Stanton SCS.3d MIDI controller script v1.21             */
/*          Copyright (C) 2009, Sean M. Pappalardo              */
/*      but feel free to tweak this to your heart's content!    */
/*      For Mixxx version 1.7.x                                 */
/****************************************************************/

function StantonSCS3d() {}

// ----------   Customization variables ----------
//      See http://mixxx.org/wiki/doku.php/stanton_scs.3d_mixxx_user_guide  for details
StantonSCS3d.pitchRanges = [ 0.08, 0.12, 0.5, 1.0 ];    // Pitch ranges for LED off, blue, purple, red
StantonSCS3d.fastDeckChange = false;    // Skip the flashy lights if true, for juggling
StantonSCS3d.spinningPlatter = true;    // Spinning platter LEDs
StantonSCS3d.spinningPlatterOnlyVinyl = false;  // Only show the spinning platter LEDs in vinyl mode
StantonSCS3d.VUMeters = true;           // Pre-fader VU meter LEDs
StantonSCS3d.markHotCues = "blue";      // Choose red or blue LEDs for marking the stored positions in TRIG & LOOP modes
StantonSCS3d.jogOnLoad = true;          // Automatically change to Vinyl1 (jog) mode after loading a track if true
StantonSCS3d.globalMode = false;        // Stay in the current mode on deck changes if true
StantonSCS3d.deckChangeWait = 1000;     // Time in milliseconds to hold the DECK button down to avoid changing decks

// These values are heavily latency-dependent. They're preset for 10ms and will need tuning for other latencies. (For 2ms, try 0.885, 0.15, and 1.5.)
StantonSCS3d.scratching = {     "slippage":0.8,             // Slipperiness of the virtual slipmat when scratching with the circle (higher=slower response, 0<n<1)
                                "sensitivity":0.2,          // How much the audio moves for a given circle arc (higher=faster response, 0<n<1)
                                "stoppedMultiplier":1.7 };  // Correction for when the deck is stopped (set higher for higher latencies)

// ----------   Other global variables    ----------
StantonSCS3d.debug = false;  // Enable/disable debugging messages to the console
StantonSCS3d.vinyl2ScratchMethod = "scratch"; // "a-b" or "scratch"

StantonSCS3d.id = "";   // The ID for the particular device being controlled for use in debugging, set at init time
StantonSCS3d.channel = 0;   // MIDI channel to set the device to and use
StantonSCS3d.buttons = { "fx":0x20, "eq":0x26, "loop":0x22, "trig":0x28, "vinyl":0x24, "deck":0x2A };
StantonSCS3d.buttonLEDs = { 0x48:0x62, 0x4A:0x61, 0x4C:0x60, 0x4e:0x5f, 0x4f:0x67, 0x51:0x68, 0x53:0x69, 0x55:0x6a,
                            0x56:0x64, 0x58:0x65, 0x5A:0x6C, 0x5C:0x5D }; // Maps surface buttons to corresponding circle LEDs
StantonSCS3d.mode_store = { "[Channel1]":"vinyl", "[Channel2]":"vinyl" };   // Set vinyl mode on both decks
StantonSCS3d.deck = 1;  // Currently active virtual deck
StantonSCS3d.modifier = { "cue":0, "play":0 };  // Modifier buttons (allowing alternate controls) defined on-the-fly if needed
StantonSCS3d.state = { "pitchAbs":0, "jog":0, "changedDeck":false }; // Temporary state variables
StantonSCS3d.modeSurface = { "fx":"S3+S5", "eq":"S3+S5", "loop":"Buttons", "loop2":"Buttons", "loop3":"Buttons", "trig":"Buttons", "trig2":"Buttons", "trig3":"Buttons", "vinyl":"C1", "vinyl2":"C1", "vinyl3":"C1"};
StantonSCS3d.surface = { "C1":0x00, "S5":0x01, "S3":0x02, "S3+S5":0x03, "Buttons":0x04 };
StantonSCS3d.sysex = [0xF0, 0x00, 0x01, 0x60];  // Preamble for all SysEx messages for this device
// Variables used in the scratching alpha-beta filter: (revtime = 1.8 to start)
StantonSCS3d.scratch = { "revtime":1.8, "alpha":0.1, "beta":1.0, "touching":false };
StantonSCS3d.trackDuration = [0,0]; // Duration of the song on each deck (used for vinyl LEDs)
StantonSCS3d.lastLight = [-1,-1]; // Last circle LED values
StantonSCS3d.lastLoop = 0;  // Last-used loop LED
// Pitch values for key change (LOOP) mode
StantonSCS3d.pitchPoints = {    1:{ 0x48:-0.1998, 0x4A:-0.1665, 0x4C:-0.1332, 0x4E:-0.0999, 0x56:-0.0666, 0x58:-0.0333,
                                    0x5A:0.0333, 0x5C:0.0666, 0x4F:0.0999, 0x51:0.1332, 0x53:0.1665, 0x55:0.1998 }, // 3.33% increments
                                2:{ 0x48:-0.5, 0x4A:-0.4043, 0x4C:-0.2905, 0x4E:-0.1567, 0x56:-0.1058, 0x58:-0.0548, 
                                    0x5A:0.06, 0x5C:0.12, 0x4F:0.181, 0x51:0.416, 0x53:0.688, 0x55:1.0 },  // Key changes
                                3:{ 0x48:-0.4370, 0x4A:-0.3677, 0x4C:-0.3320, 0x4E:-0.2495, 0x56:-0.1567, 0x58:-0.0548, 
                                    0x5A:0.12, 0x5C:0.263, 0x4F:0.338, 0x51:0.506, 0x53:0.688, 0x55:0.895 } };  // Notes
// Multiple banks of multiple cue points:
StantonSCS3d.triggerPoints1 = { 1:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 },
                                2:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 },
                                3:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 } };
StantonSCS3d.triggerPoints2 = { 1:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 },
                                2:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 },
                                3:{ 0x48:-0.1, 0x4A:-0.1, 0x4C:-0.1, 0x4E:-0.1, 0x4F:-0.1, 0x51:-0.1, 0x53:-0.1, 
                                    0x55:-0.1, 0x56:-0.1, 0x58:-0.1, 0x5A:-0.1, 0x5C:-0.1 } };
StantonSCS3d.triggerS4 = 0xFF;


// Signals to (dis)connect by mode: Group, Key, Function name
StantonSCS3d.modeSignals = {"fx":[ ["[Flanger]", "lfoDepth", "StantonSCS3d.FXDepthLEDs"],
                                   ["[Flanger]", "lfoDelay", "StantonSCS3d.FXDelayLEDs"],
                                   ["[Flanger]", "lfoPeriod", "StantonSCS3d.FXPeriodLEDs"],
                                   ["CurrentChannel", "reverse", "StantonSCS3d.B11LED"],
                                   ["CurrentChannel", "flanger", "StantonSCS3d.B12LED"] ],
                            "eq":[ ["CurrentChannel", "filterLow", "StantonSCS3d.EQLowLEDs"],
                                   ["CurrentChannel", "filterMid", "StantonSCS3d.EQMidLEDs"],
                                   ["CurrentChannel", "filterHigh", "StantonSCS3d.EQHighLEDs"],
                                   ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "loop":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "loop2":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "loop3":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "trig":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "trig2":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "trig3":[  ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"] ],
                            "vinyl":[ ["CurrentChannel", "pfl", "StantonSCS3d.B11LED"],
                                      ["CurrentChannel", "VuMeter", "StantonSCS3d.VUMeterLEDs"] ],
                            "vinyl2":[["CurrentChannel", "pfl", "StantonSCS3d.B11LED"],
                                      ["CurrentChannel", "VuMeter", "StantonSCS3d.VUMeterLEDs"] ],
                            "vinyl3":[],
                            "none":[]  // To avoid an error on forced mode changes
                            };
StantonSCS3d.deckSignals = [    ["CurrentChannel", "rate", "StantonSCS3d.pitchLEDs"],
                                ["CurrentChannel", "rateRange", "StantonSCS3d.pitchSliderLED"],
                                ["CurrentChannel", "volume", "StantonSCS3d.gainLEDs"],
                                ["CurrentChannel", "play", "StantonSCS3d.playLED"],
                                ["CurrentChannel", "cue_default", "StantonSCS3d.cueLED"],
                                ["CurrentChannel", "beatsync", "StantonSCS3d.syncLED"],
                                ["CurrentChannel", "back", "StantonSCS3d.B13LED"],
                                ["CurrentChannel", "fwd", "StantonSCS3d.B14LED"]
                            ];

// ----------   Functions   ----------

StantonSCS3d.init = function (id) {    // called when the MIDI device is opened & set up
    
    StantonSCS3d.id = id;   // Store the ID of this device for later use
    
    // Set the device's MIDI channel to a known value
//     midi.sendSysexMsg(StantonSCS3d.sysex.concat([0x02, StantonSCS3d.channel, 0xF7]),7);
    
    var CC = 0xB0 + StantonSCS3d.channel;
    var No = 0x90 + StantonSCS3d.channel;
    midi.sendShortMsg(CC,0x7B,0x00);  // Extinguish all LEDs

    for (i=0x48; i<=0x5c; i++) midi.sendShortMsg(No,i,0x40); // Set surface LEDs to black default
    
    // Force change to first deck, initializing the control surface & LEDs and connecting signals in the process
    StantonSCS3d.deck = 2;  // Set active deck to right (#2) so the below will switch to #1.
    StantonSCS3d.DeckChange(StantonSCS3d.channel, StantonSCS3d.buttons["deck"], "", 0x80+StantonSCS3d.channel);
    
    // Connect the playposition functions permanently since they disrupt playback if connected on the fly
    if (StantonSCS3d.spinningPlatter) {
        engine.connectControl("[Channel1]","visual_playposition","StantonSCS3d.circleLEDs1");
        engine.connectControl("[Channel2]","visual_playposition","StantonSCS3d.circleLEDs2");
        engine.connectControl("[Channel1]","duration","StantonSCS3d.durationChange1");
        engine.connectControl("[Channel2]","duration","StantonSCS3d.durationChange2");
    }
    
    //  Initialize the spinning platter LEDs if the mapping is loaded after a song is
    StantonSCS3d.durationChange1(engine.getValue("[Channel1]","duration"));
    StantonSCS3d.durationChange2(engine.getValue("[Channel2]","duration"));
    
    print ("StantonSCS3d: \""+StantonSCS3d.id+"\" on MIDI channel "+(StantonSCS3d.channel+1)+" initialized.");
}

StantonSCS3d.shutdown = function () {   // called when the MIDI device is closed
    var CC = 0xB0 + StantonSCS3d.channel;
    var No = 0x90 + StantonSCS3d.channel;

    for (i=0x48; i<=0x5c; i++) midi.sendShortMsg(No,i,0x40); // Set surface LEDs to black default
    midi.sendShortMsg(CC,0x7B,0x00);  // Extinguish all LEDs
    
    print ("StantonSCS3d: \""+StantonSCS3d.id+"\" on MIDI channel "+(StantonSCS3d.channel+1)+" shut down.");
}

// (Dis)connects the appropriate Mixxx control signals to/from functions based on the currently controlled deck and what mode the controller is in
StantonSCS3d.connectSurfaceSignals = function (channel, disconnect) {

    var signalList = StantonSCS3d.modeSignals[StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"]];
    for (i=0; i<signalList.length; i++) {
        var group = signalList[i][0];
        if (group=="CurrentChannel") group = "[Channel"+StantonSCS3d.deck+"]";
        engine.connectControl(group,signalList[i][1],signalList[i][2],disconnect);
        
        // If connecting a signal, cause it to fire (by setting it to the same value) to update the LEDs
//         if (!disconnect) engine.trigger(group,signalList[i][1]);  // Commented because there's no sense in wasting queue length
        if (!disconnect) {
            // Alternate:
            var command = signalList[i][2]+"("+engine.getValue(group,signalList[i][1])+")";
//             print("StantonSCS3d: command="+command);
            eval(command);
        }
        if (StantonSCS3d.debug) {
            if (disconnect) print("StantonSCS3d: "+group+","+signalList[i][1]+" disconnected from "+signalList[i][2]);
            else print("StantonSCS3d: "+group+","+signalList[i][1]+" connected to "+signalList[i][2]);
        }
    }
    // If disconnecting signals, darken the LEDs on the control surface & soft buttons
    if (disconnect) {
        var CC = 0xB0 + channel;
        midi.sendShortMsg(CC,0x62,0x00);  // C1 LEDs off
        midi.sendShortMsg(CC,0x0C,0x00);  // S3 LEDs off
        midi.sendShortMsg(CC,0x01,0x00);  // S4 LEDs off
        midi.sendShortMsg(CC,0x0E,0x00);  // S5 LEDs off
    }
}

// (Dis)connects the mode-independent Mixxx control signals to/from functions based on the currently controlled virtual deck
StantonSCS3d.connectDeckSignals = function (channel, disconnect) {
    var signalList = StantonSCS3d.deckSignals;
    for (i=0; i<signalList.length; i++) {
        var group = signalList[i][0];
        var name = signalList[i][1];
        if (group=="CurrentChannel") group = "[Channel"+StantonSCS3d.deck+"]";
        engine.connectControl(group,name,signalList[i][2],disconnect);
//        if (StantonSCS3d.debug) print("StantonSCS3d: (dis)connected "+group+","+name+" to/from "+signalList[i][2]);
        
        // If connecting a signal, update the LEDs
        if (!disconnect) {
            switch (name) {
                case "play":
                        var currentValue = engine.getValue(group,name);
//                         print("StantonSCS3d: current value="+currentValue);
                        StantonSCS3d.playLED(currentValue);
                        break;
                case "cue_default":
                case "beatsync": break;
                default:    // Cause the signal to fire to update LEDs
//                         engine.trigger(group,name);  // No sense in wasting queue length if we can do this another way
                    // Alternate:
                        var command = signalList[i][2]+"("+engine.getValue(group,name)+")";
//                         print("StantonSCS3d: command="+command);
                        eval(command);
                        break;
            }
        }
        if (StantonSCS3d.debug) {
            if (disconnect) print("StantonSCS3d: "+group+","+signalList[i][1]+" disconnected from "+signalList[i][2]);
            else print("StantonSCS3d: "+group+","+signalList[i][1]+" connected to "+signalList[i][2]);
        }
    }
    // If disconnecting signals, darken the corresponding LEDs
    if (disconnect) {
        var CC = 0xB0 + channel;
        var No = 0x90 + channel;
        midi.sendShortMsg(CC,0x07,0x00);  // Gain LEDs off
        midi.sendShortMsg(CC,0x03,0x00);  // Pitch LEDs off
        midi.sendShortMsg(No,0x6D,0x00);  // PLAY button blue
        midi.sendShortMsg(No,0x6E,0x00);  // CUE button blue
        midi.sendShortMsg(No,0x6F,0x00);  // SYNC button blue
        midi.sendShortMsg(No,0x70,0x00);  // TAP button blue
    }
}

// Sets all mode buttons except Deck to the same color
StantonSCS3d.modeButtonsColor = function (channel, color) {
    var byte1 = 0x90 + channel;
    midi.sendShortMsg(byte1,StantonSCS3d.buttons["fx"],color); // Set FX button color
    midi.sendShortMsg(byte1,StantonSCS3d.buttons["eq"],color); // Set EQ button color
    midi.sendShortMsg(byte1,StantonSCS3d.buttons["loop"],color); // Set Loop button color
    midi.sendShortMsg(byte1,StantonSCS3d.buttons["trig"],color); // Set Trig button color
    midi.sendShortMsg(byte1,StantonSCS3d.buttons["vinyl"],color); // Set Vinyl button color
}

// Sets all four soft buttons to the same color
StantonSCS3d.softButtonsColor = function (channel, color) {
    var byte1 = 0x90 + channel;
    midi.sendShortMsg(byte1,0x2c,color); // Set B11 button color
    midi.sendShortMsg(byte1,0x2e,color); // Set B12 button color
    midi.sendShortMsg(byte1,0x30,color); // Set B13 button color
    midi.sendShortMsg(byte1,0x32,color); // Set B14 button color
}

// Sets color of side circle LEDs (used for deck change effect)
StantonSCS3d.circleLEDsColor = function (channel, color, side) {
    var byte1 = 0x90 + channel;
    var start;
    var end;
    if (side=="left") { start = 0x5e; end = 0x63; }
    else { start = 0x66; end = 0x6b; }
    for (i=start; i<=end; i++) midi.sendShortMsg(byte1,i,color);
}

StantonSCS3d.pitch = function (channel, control, value) {   // Lower the sensitivity of the pitch slider
    if (StantonSCS3d.modifier["Deck"]==1) return;   // If the Deck button is held down, ignore this.
    var currentValue = engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate");
    var newValue;
    if (StantonSCS3d.modifier[StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"]]==1)
        newValue = currentValue+(value-64)/1024;    // Fine pitch adjust
    else newValue = currentValue+(value-64)/256;
    if (newValue<-1) newValue=-1.0;
    if (newValue>1) newValue=1.0;
    engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate",newValue);
}

StantonSCS3d.pitchAbsolute = function (channel, control, value) {
    // Disable if doing fine adjustments (holding down the current mode button)
    if (StantonSCS3d.modifier[StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"]]==1) return;
    
    // Adjust the master balance if "Deck" is held down
    if (StantonSCS3d.modifier["Deck"]==1) {
        var newValue = (value-64)/64;
        engine.setValue("[Master]","balance",newValue);
        StantonSCS3d.pitchLEDs(newValue);
        return;
    }
    
    // --- Pitch bending at the edges of the slider ---
    if (StantonSCS3d.state["pitchAbs"]==0) StantonSCS3d.state["pitchAbs"]=value;    // Log the initial value
    
    // Ignore if the slider was first touched in the middle
    if (StantonSCS3d.state["pitchAbs"]>=10 && StantonSCS3d.state["pitchAbs"]<=117) return;
    
    if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate_dir") == -1) {   // Go in the appropriate direction
        if (value<10) engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_up",1);
        if (value>117) engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_down",1);
    }
    else {
        if (value<10) engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_down",1);
        if (value>117) engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_up",1);
    }
}

StantonSCS3d.pitchTouch = function (channel, control, value, status) {
    if ((status & 0xF0) == 0x80) {   // If button up
        StantonSCS3d.state["pitchAbs"]=0;   // Clear the initial value
        if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_down") != 0)
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_down",0);
        if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_up") != 0)
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate_temp_up",0);
    }
}

StantonSCS3d.gain = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) return;   // Ignore if "Deck" is held down
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier[currentMode]==1) return;
    engine.setValue("[Channel"+StantonSCS3d.deck+"]","volume",value/127);
}

StantonSCS3d.gainRelative = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) { // Adjust the master volume if "Deck" is held down
        var newValue = engine.getValue("[Master]","volume")+(value-64)/128;
        if (newValue<0.0) newValue=0.0;
        if (newValue>5.0) newValue=5.0;
        StantonSCS3d.MasterVolumeLEDs(newValue);
        engine.setValue("[Master]","volume",newValue);
        return;
    }
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier[currentMode]==1)  {   // If mode button held, set pre-gain level
        var newValue = engine.getValue("[Channel"+StantonSCS3d.deck+"]","pregain")+(value-64)/64;
        if (newValue<0.0) newValue=0.0;
        if (newValue>4.0) newValue=4.0;
        engine.setValue("[Channel"+StantonSCS3d.deck+"]","pregain",newValue);
        var add = StantonSCS3d.BoostCut(9,newValue, 0.0, 1.0, 4.0, 4, 4);
        var byte1 = 0xB0 + channel;
        midi.sendShortMsg(byte1,0x07,0x15+add);
    }
}

StantonSCS3d.playButton = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    if ((status & 0xF0) == 0x90) {    // If button down
        StantonSCS3d.modifier["play"]=1;
        if (StantonSCS3d.modifier["cue"]==1) engine.setValue("[Channel"+StantonSCS3d.deck+"]","play",1);
        else {
            var currentlyPlaying = engine.getValue("[Channel"+StantonSCS3d.deck+"]","play");
            if (currentlyPlaying && engine.getValue("[Channel"+StantonSCS3d.deck+"]","cue_default")==1) engine.setValue("[Channel"+StantonSCS3d.deck+"]","cue_default",0);
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","play", !currentlyPlaying);
        }
        return;
    }
    StantonSCS3d.modifier["play"]=0;
}

StantonSCS3d.cueButton = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    if ((status & 0xF0) != 0x80) {    // If button down
        engine.setValue("[Channel"+StantonSCS3d.deck+"]","cue_default",1);
        StantonSCS3d.modifier["cue"]=1;   // Set button modifier flag
        return;
    }
    if (StantonSCS3d.modifier["play"]==0) engine.setValue("[Channel"+StantonSCS3d.deck+"]","cue_default",0);
    StantonSCS3d.modifier["cue"]=0;   // Clear button modifier flag
}

StantonSCS3d.syncButton = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    if ((status & 0xF0) != 0x80) {    // If button down
        engine.setValue("[Channel"+StantonSCS3d.deck+"]","beatsync",1);
        return;
    }
    midi.sendShortMsg(byte1,control,0x00);  // SYNC button blue
    engine.setValue("[Channel"+StantonSCS3d.deck+"]","beatsync",0);
}

StantonSCS3d.tapButton = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    if (StantonSCS3d.modifier["Deck"]==1) { // If Deck is held down,
        engine.setValue("[Master]","crossfader",0.0);   // Reset cross-fader to center
        midi.sendShortMsg(0xB0+channel,0x01,0x18);  // Show it centered
        return;
    }
    if ((status & 0xF0) == 0x90) {    // If button down
        if (StantonSCS3d.debug) print("StantonSCS3d: TAP");
        midi.sendShortMsg(byte1,control,0x01);  // TAP button red
        bpm.tapButton(StantonSCS3d.deck);
        return;
    }
    midi.sendShortMsg(byte1,control,0x00);  // TAP button blue
}

StantonSCS3d.B11 = function (channel, control, value, status) {
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    var byte1 = 0x90 + channel;
    if ((status & 0xF0) == 0x90) {    // If button down
        StantonSCS3d.modifier["B11"]=1;   // Set button modifier flag
        // If Deck or the current mode button is held down,
        if (StantonSCS3d.modifier["Deck"]==1 || StantonSCS3d.modifier[currentMode]==1) { 
            midi.sendShortMsg(byte1,control,0x01); // Make button red
            if (StantonSCS3d.modifier["Deck"]==1) {
                engine.setValue("[Master]","volume",1.0);   // Reset master volume to center if Deck is held
                StantonSCS3d.MasterVolumeLEDs(1.0); // Show it centered
                }
            else {
                // Reset channel pre-fader gain to center if another mode button is held
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","pregain",1.0);
                // Update the LEDs
                var add = StantonSCS3d.BoostCut(9,1.0, 0.0, 1.0, 4.0, 5, 4);
                midi.sendShortMsg(0xB0 + channel,0x07,0x15+add);
                }                
            return;
        }
        switch (currentMode) {
            case "vinyl3": midi.sendShortMsg(byte1,control,0x01); // Make button red
                break;
            default: break;
        }
    }
    else {
        StantonSCS3d.modifier["B11"]=0;   // Clear button modifier flag
        if (StantonSCS3d.modifier["Deck"]==1 || StantonSCS3d.modifier[currentMode]==1) {
            midi.sendShortMsg(byte1,control,0x02); // Make button blue if a mode button is held
            return;
        }
        switch (currentMode) {
            case "vinyl3": midi.sendShortMsg(byte1,control,0x02); // Make button blue
                break;
            default: break;
        }
    }
    switch (currentMode) {
        case "fx":
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","reverse",!engine.getValue("[Channel"+StantonSCS3d.deck+"]","reverse"));
                break;
        case "vinyl3":
                if ((status & 0xF0) != 0x80) {    // If button down
                    engine.setValue("[Playlist]","SelectPrevPlaylist",1);
                }
                else engine.setValue("[Playlist]","SelectPrevPlaylist",0);
                break;
        case "vinyl":
        case "vinyl2":
        default:
                if ((status & 0xF0) != 0x80) {    // If button down
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","pfl",!engine.getValue("[Channel"+StantonSCS3d.deck+"]","pfl"));
                }
                break;
    }
}

StantonSCS3d.B12 = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];

    // Common & modifier actions
    if ((status & 0xF0) == 0x90) {    // If button down
        StantonSCS3d.modifier["B12"]=1;   // Set button modifier flag
        if (currentMode != "fx")
            midi.sendShortMsg(byte1,control,0x01); // Make button red
        if (StantonSCS3d.modifier[currentMode]==1) {    // Reset pitch to 0 if mode button held down
            midi.sendShortMsg(byte1,control,0x01); // Make button red
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate",0);
            return;
        }
        if (StantonSCS3d.modifier["Deck"]==1) { // If Deck is held down,
            midi.sendShortMsg(byte1,control,0x01); // Make button red
            engine.setValue("[Master]","balance",0.0); // Reset balance to center
            StantonSCS3d.pitchLEDs(0.0);
            return;
        }
    }
    else {  // If button up
        StantonSCS3d.modifier["B12"]=0;   // Clear button modifier flag
        if (StantonSCS3d.modifier["Deck"]==1 || StantonSCS3d.modifier[currentMode]==1) {
            midi.sendShortMsg(byte1,control,0x02); // Make button blue if a mode button is held
            return;
        }
        if (currentMode != "fx")
            midi.sendShortMsg(byte1,control,0x02); // Make button blue
    }
    switch (currentMode) {
        case "loop":
        case "loop2":
        case "loop3":
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate",0);
                break;
        case "fx":
                if ((status & 0xF0) == 0x90)     // If button down
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","flanger",!engine.getValue("[Channel"+StantonSCS3d.deck+"]","flanger"));
                break;
        case "vinyl3":
                if ((status & 0xF0) == 0x90) {    // If button down
                    engine.setValue("[Playlist]","SelectNextPlaylist",1);
                }
                else engine.setValue("[Playlist]","SelectNextPlaylist",0);
                break;
        case "vinyl":
        case "vinyl2":
        default:
                if ((status & 0xF0) == 0x90) {    // If button down
                    var currentRange = engine.getValue("[Channel"+StantonSCS3d.deck+"]","rateRange");
                    switch (true) {
                        case (currentRange<=StantonSCS3d.pitchRanges[0]):
                                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",StantonSCS3d.pitchRanges[1]);
                            break;
                        case (currentRange<=StantonSCS3d.pitchRanges[1]):
                                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",StantonSCS3d.pitchRanges[2]);
                            break;
                        case (currentRange<=StantonSCS3d.pitchRanges[2]):
                                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",StantonSCS3d.pitchRanges[3]);
                            break;
                        case (currentRange>=StantonSCS3d.pitchRanges[3]):
                                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",StantonSCS3d.pitchRanges[0]);
                            break;
                    }
                    // Update the screen display
                    engine.trigger("[Channel"+StantonSCS3d.deck+"]","rate");
                }
                break;
    }
}

StantonSCS3d.B13 = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if ((status & 0xF0) == 0x90) {    // If button down
        StantonSCS3d.modifier["B13"]=1;   // Set button modifier flag
        if (currentMode == "vinyl3")
            midi.sendShortMsg(byte1,control,0x01); // Make button red
    }
    else {
        StantonSCS3d.modifier["B13"]=0;   // Clear button modifier flag
        if (currentMode == "vinyl3")
            midi.sendShortMsg(byte1,control,0x02); // Make button blue
    }
    switch (currentMode) {
        case "vinyl3":
                if ((status & 0xF0) == 0x90) {    // If button down
                    engine.setValue("[Playlist]","SelectPrevTrack",1);
                }
                else engine.setValue("[Playlist]","SelectPrevTrack",0);
                break;
        default:
            if ((status & 0xF0) == 0x90) {    // If button down
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","back",1);
                return;
            }
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","back",0);
            break;
    }
}

StantonSCS3d.B14 = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if ((status & 0xF0) == 0x90) {    // If button down
        StantonSCS3d.modifier["B14"]=1;   // Set button modifier flag
        if (currentMode == "vinyl3")
            midi.sendShortMsg(byte1,control,0x01); // Make button red
    }
    else {
        StantonSCS3d.modifier["B14"]=0;   // Clear button modifier flag
        if (currentMode == "vinyl3")
            midi.sendShortMsg(byte1,control,0x02); // Make button blue
    }
    switch (currentMode) {
        case "vinyl3":
                if ((status & 0xF0) == 0x90) {    // If button down
                    engine.setValue("[Playlist]","SelectNextTrack",1);
                }
                else engine.setValue("[Playlist]","SelectNextTrack",0);
                break;
        default:
            if ((status & 0xF0) == 0x90) {    // If button down
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","fwd",1);
                return;
            }
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","fwd",0);
            break;
    }
}

// ----------   Mode buttons  ----------

StantonSCS3d.modeButton = function (channel, control, status, modeName) {
    if (StantonSCS3d.modifier["Deck"]==1) return;   // Skip if in DECK mode (while DECK button held down)
    var byte1 = 0x90 + channel;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if ((status & 0xF0) == 0x90) {    // If button down
        midi.sendShortMsg(byte1,control,0x03); // Make button purple
        StantonSCS3d.modifier[modeName]=1;   // Set mode modifier flag
        if (currentMode == modeName) {
            StantonSCS3d.modifier["time"] = new Date();  // Store the current time in milliseconds
            StantonSCS3d.B11LED(0); // B11 blue
            StantonSCS3d.B12LED(0); // B12 blue
            // Set Gain LEDs to pregain value
            var add = StantonSCS3d.BoostCut(9,engine.getValue("[Channel"+StantonSCS3d.deck+"]","pregain"), 0.0, 1.0, 4.0, 5, 4);
            midi.sendShortMsg(0xB0+channel,0x07,0x15+add);
        }
        else StantonSCS3d.modifier["time"] = 0.0;
        
        return;
    }
    StantonSCS3d.modifier[currentMode] = StantonSCS3d.modifier[modeName] = 0;   // Clear mode modifier flags
    StantonSCS3d.gainLEDs(engine.getValue("[Channel"+StantonSCS3d.deck+"]","volume"));  // Restore Gain LEDs
    StantonSCS3d.modeButtonsColor(channel,0x02);  // Make all mode buttons blue
    // If trying to switch to the same mode, or the same physical button was held down for over 1/3 of a second, stay in the current mode
    if (currentMode == modeName || (StantonSCS3d.modifier["time"] != 0.0 && ((new Date() - StantonSCS3d.modifier["time"])>300))) {
        switch (currentMode.charAt(currentMode.length-1)) {   // Return the button to its original color
            case "2": midi.sendShortMsg(byte1,control,0x03); break;   // Make button purple
            case "3": midi.sendShortMsg(byte1,control,0x00); break;   // Make button black
            default:  midi.sendShortMsg(byte1,control,0x01); break;  // Make button red
        }
        StantonSCS3d.connectSurfaceSignals(channel);  // Re-trigger signals
        return;
    }
    
    if (StantonSCS3d.debug) print("StantonSCS3d: Switching to "+modeName.toUpperCase()+" mode on deck "+StantonSCS3d.deck);
    switch (modeName.charAt(modeName.length-1)) {   // Set the button to its new color
        case "2": midi.sendShortMsg(byte1,control,0x03); break;   // Make button purple
        case "3": midi.sendShortMsg(byte1,control,0x00); break;   // Make button black
        default:  midi.sendShortMsg(byte1,control,0x01); break;  // Make button red
    }
    StantonSCS3d.connectSurfaceSignals(channel,true);  // Disconnect previous ones
    StantonSCS3d.softButtonsColor(channel,0x02);  // Make the soft buttons blue
    switch (currentMode) {    // Special recovery from certain modes
        case "loop":
        case "loop2":
        case "loop3":
        case "trig":
        case "trig2":
        case "trig3":
                // If switching to loop or trig from either, skip this
                if (modeName.substring(0,4)=="trig" || modeName.substring(0,4)=="loop") break;
                var redButtonLEDs = [0x48, 0x4a, 0x4c, 0x4e, 0x4f, 0x51, 0x53, 0x55];
                for (i=0; i<redButtonLEDs.length; i++)
                    midi.sendShortMsg(byte1,redButtonLEDs[i],0x40); // Set them to black
                for (i=0x56; i<=0x5c; i++)
                    midi.sendShortMsg(byte1,i,0x40); // Set center slider to black
            break;
    }
//     if (StantonSCS3d.modeSurface[modeName] != StantonSCS3d.modeSurface[currentMode])    // If different,
        midi.sendSysexMsg(StantonSCS3d.sysex.concat([0x01, StantonSCS3d.surface[StantonSCS3d.modeSurface[modeName]], 0xF7]),7);  // Configure surface
    switch (modeName) {    // Prep LEDs for certain modes
        case "loop":
        case "loop2":
        case "loop3":
        case "trig":
        case "trig2":
        case "trig3":
                // If switching to loop or trig from any other mode, prep the surface background LEDs
                
                var index = modeName.charAt(modeName.length-1);
                if (index != "2" && index != "3") index = "1";
                
                var redButtonLEDs = [0x48, 0x4a, 0x4c, 0x4e, 0x4f, 0x51, 0x53, 0x55, 0x56, 0x58, 0x5A, 0x5C];
                if ((currentMode.substring(0,4) != "trig" && currentMode.substring(0,4) != "loop") || StantonSCS3d.state["changedDeck"]) {
                    StantonSCS3d.state["changedDeck"] = false;
                    for (i=0; i<redButtonLEDs.length; i++)
                        midi.sendShortMsg(byte1,redButtonLEDs[i],0x41); // Set them to red dim
                }
                if (modeName.substring(0,4)=="loop") break;
                // Light the blue circle LEDs for any cues currently set
                var marker;
                for (i=0; i<redButtonLEDs.length; i++) {
                    if (StantonSCS3d.deck==1) {
                        if (StantonSCS3d.triggerPoints1[index][redButtonLEDs[i]] != -0.1) {
                            if (StantonSCS3d.markHotCues == "red") marker = redButtonLEDs[i];
                            else marker = StantonSCS3d.buttonLEDs[redButtonLEDs[i]];
                            midi.sendShortMsg(byte1,marker,0x01);
                        }
                    }
                    else {
                        if (StantonSCS3d.triggerPoints2[index][redButtonLEDs[i]] != -0.1) {
                            if (StantonSCS3d.markHotCues == "red") marker = redButtonLEDs[i];
                            else marker = StantonSCS3d.buttonLEDs[redButtonLEDs[i]];
                            midi.sendShortMsg(byte1,marker,0x01);
                        }
                    }
                }
            break;
        case "vinyl":
        case "vinyl2":
            // Force the circle LEDs to light
            StantonSCS3d.lastLight[StantonSCS3d.deck]=-1;
            StantonSCS3d.circleLEDs(engine.getValue("[Channel"+StantonSCS3d.deck+"]","visual_playposition"));
            break;
    }
    StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = modeName;
    StantonSCS3d.connectSurfaceSignals(channel);  // Connect new ones
}

StantonSCS3d.FX = function (channel, control, value, status) {
    StantonSCS3d.modeButton(channel, control, status, "fx");
}

StantonSCS3d.EQ = function (channel, control, value, status) {
    StantonSCS3d.modeButton(channel, control, status, "eq");
}

StantonSCS3d.Loop = function (channel, control, value, status) {
    var mode;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    
    switch (currentMode) {
        case "loop":
            if ((status & 0xF0) == 0x80) mode = "loop2";
            else mode = "loop";
            break;
        case "loop2":
            if ((status & 0xF0) == 0x80) mode = "loop3";
            else mode = "loop2";
            break;
        case "loop3":
            if ((status & 0xF0) == 0x80) mode = "loop";
            else mode = "loop3";
            break;
        default: mode = "loop";
    }
    StantonSCS3d.modeButton(channel, control, status, mode);
}

StantonSCS3d.Trig = function (channel, control, value, status) {
    StantonSCS3d.triggerS4 = 0xFF;
    var mode;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    
    switch (currentMode) {
        case "trig":
            if ((status & 0xF0) == 0x80) mode = "trig2";
            else mode = "trig";
            break;
        case "trig2":
            if ((status & 0xF0) == 0x80) mode = "trig3";
            else mode = "trig2";
            break;
        case "trig3":
            if ((status & 0xF0) == 0x80) mode = "trig";
            else mode = "trig3";
            break;
        default: mode = "trig";
    }
    StantonSCS3d.modeButton(channel, control, status, mode);
}

StantonSCS3d.Vinyl = function (channel, control, value, status) {
    var mode;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    
    switch (currentMode) {
        case "vinyl":
            if ((status & 0xF0) == 0x80) mode = "vinyl2";
            else mode = "vinyl";
            break;
        case "vinyl2":
            if ((status & 0xF0) == 0x80) mode = "vinyl3";
            else mode = "vinyl2";
            break;
        case "vinyl3":
            if ((status & 0xF0) == 0x80) mode = "vinyl";
            else mode = "vinyl3";
            break;
        default: mode = "vinyl";
    }
    StantonSCS3d.modeButton(channel, control, status, mode);
}

StantonSCS3d.lightDelay = function () {
    var date = new Date();
    var curDate = null;
    
    do { curDate = new Date(); }
    while(curDate-date < 60);
}

StantonSCS3d.DeckChange = function (channel, control, value, status) {
    var byte1 = 0x90 + channel;
    if ((status & 0xF0) == 0x90) {  // If button down
        StantonSCS3d.modeButtonsColor(channel,0x02);  // Make all mode buttons blue
        midi.sendShortMsg(byte1,control,0x01); // Make button red
        StantonSCS3d.modifier["Deck"]=1;   // Set button modifier flag
        StantonSCS3d.modifier["deckTime"] = new Date();  // Store the current time in milliseconds
        StantonSCS3d.connectSurfaceSignals(channel,true);   // Disconnect surface signals & turn off surface LEDs
        StantonSCS3d.B11LED(0); // B11 blue
        StantonSCS3d.B12LED(0); // B12 blue
        // Show the current master volume on the Gain slider
        StantonSCS3d.MasterVolumeLEDs(engine.getValue("[Master]","volume"));
        // Show the current balance value on the Pitch slider
        midi.sendShortMsg(byte1,0x3D,0x00);  // Pitch LED black
        midi.sendShortMsg(byte1,0x3E,0x00);
        StantonSCS3d.pitchLEDs(engine.getValue("[Master]","balance"));
        // Switch to three-slider mode
        midi.sendSysexMsg(StantonSCS3d.sysex.concat([0x01, StantonSCS3d.surface["S3+S5"], 0xF7]),7);
        // Show the current position of the cue mix on S3
        var add = StantonSCS3d.BoostCut(7,engine.getValue("[Master]","headMix"), -1.0, 0.0, 1.0, 3, 3);
        midi.sendShortMsg(0xB0+channel,0x0C,0x15+add);
        // Show the current crossfader position on S4
        var add = StantonSCS3d.BoostCut(7,engine.getValue("[Master]","crossfader"), -1.0, 0.0, 1.0, 3, 3);
        midi.sendShortMsg(0xB0+channel,0x01,0x15+add);
        // Show the current position of the headphone volume on S5
        var add = StantonSCS3d.BoostCut(7,engine.getValue("[Master]","headVolume"), 0.0, 1.0, 5.0, 3, 3);
        midi.sendShortMsg(0xB0+channel,0x0E,0x15+add);
        return;
    }
    midi.sendShortMsg(0xB0+channel,0x0C,0x00);  // Darken S3
    midi.sendShortMsg(0xB0+channel,0x01,0x00);  // Darken S4
    midi.sendShortMsg(0xB0+channel,0x0E,0x00);  // Darken S5
    StantonSCS3d.modifier["Deck"]=0;   // Clear button modifier flag
    var newMode;
    // If the button's been held down for longer than the specified time, stay on the current deck
    if (new Date() - StantonSCS3d.modifier["deckTime"]>StantonSCS3d.deckChangeWait) {
        midi.sendShortMsg(byte1,StantonSCS3d.buttons["deck"],0x01+StantonSCS3d.deck); // Return to appropriate color
        StantonSCS3d.pitchSliderLED(engine.getValue("[Channel"+StantonSCS3d.deck+"]","rateRange")); // Restore Pitch LED color
        StantonSCS3d.pitchLEDs(engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate"));   // Restore Pitch LEDs
    }
    else {
        StantonSCS3d.connectDeckSignals(channel,true);    // Disconnect static signals
        StantonSCS3d.softButtonsColor(channel,0x00);  // Darken the soft buttons
        if (StantonSCS3d.globalMode) newMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
        if (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"].substring(0,4) == "trig" || StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"].substring(0,4) == "loop")
            for (i=0x48; i<=0x5c; i++) midi.sendShortMsg(byte1,i,0x40); // Set surface LEDs to black
        if (StantonSCS3d.deck == 1) {
            if (StantonSCS3d.debug) print("StantonSCS3d: Switching to deck 2");
            StantonSCS3d.deck++;
            midi.sendShortMsg(byte1,StantonSCS3d.buttons["deck"],0x03); // Deck button purple
            midi.sendShortMsg(byte1,0x71,0x00);  // Deck A light off
            if (!StantonSCS3d.fastDeckChange) { // Make flashy lights to signal a deck change
                StantonSCS3d.circleLEDsColor(channel,0x00,"right");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x72,0x01);  // Deck B light on
                StantonSCS3d.circleLEDsColor(channel,0x01,"right");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x72,0x00);  // Deck B light off
                StantonSCS3d.circleLEDsColor(channel,0x00,"right");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x72,0x01);  // Deck B light on
                StantonSCS3d.circleLEDsColor(channel,0x01,"right");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x72,0x00);  // Deck B light off
                StantonSCS3d.circleLEDsColor(channel,0x00,"right");
                StantonSCS3d.lightDelay();
            }
                midi.sendShortMsg(byte1,0x72,0x01);  // Deck B light on
        }
        else {
            if (StantonSCS3d.debug) print("StantonSCS3d: Switching to deck 1");
            StantonSCS3d.deck--;
            midi.sendShortMsg(byte1,StantonSCS3d.buttons["deck"],0x02); // Deck button blue
            midi.sendShortMsg(byte1,0x72,0x00);  // Deck B light off
            if (!StantonSCS3d.fastDeckChange) {
                StantonSCS3d.circleLEDsColor(channel,0x00,"left");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x71,0x01);  // Deck A light on
                StantonSCS3d.circleLEDsColor(channel,0x01,"left");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x71,0x00);  // Deck A light off
                StantonSCS3d.circleLEDsColor(channel,0x00,"left");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x71,0x01);  // Deck A light on
                StantonSCS3d.circleLEDsColor(channel,0x01,"left");
                StantonSCS3d.lightDelay();
                midi.sendShortMsg(byte1,0x71,0x00);  // Deck A light off
                StantonSCS3d.circleLEDsColor(channel,0x00,"left");
                StantonSCS3d.lightDelay();
            }
            midi.sendShortMsg(byte1,0x71,0x01);  // Deck A light on
        }
        StantonSCS3d.connectDeckSignals(channel);    // Connect static signals
    }
    if (!StantonSCS3d.globalMode) newMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "none"; // Forces a mode change when a function is called
    StantonSCS3d.modifier["time"] = 0.0;    // Reset the mode-modifier time
    StantonSCS3d.state["changedDeck"]= true;    // Mark that we just changed decks so the surface LEDs can update correctly for TRIG & LOOP
    switch (newMode) {    // Call the appropriate mode change function to set the control surface & connect signals on the now-current deck
        case "fx":      StantonSCS3d.FX(channel, StantonSCS3d.buttons["fx"], value, 0x80 + channel); break;
        case "eq":      StantonSCS3d.EQ(channel, StantonSCS3d.buttons["eq"], value, 0x80 + channel); break;
        case "loop2":   StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "loop"; // force correct change
        case "loop3":
            if (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] == "none")
                StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "loop2";    // force correct change
        case "loop":    StantonSCS3d.Loop(channel, StantonSCS3d.buttons["loop"], value, 0x80 + channel); break;
        case "trig2":   StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "trig"; // force correct change
        case "trig3":
            if (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] == "none")
                StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "trig2";    // force correct change
        case "trig":    StantonSCS3d.Trig(channel, StantonSCS3d.buttons["trig"], value, 0x80 + channel); break;
        case "vinyl2":  StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "vinyl";    // force correct change
        case "vinyl3":
            if (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] == "none")
                StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"] = "vinyl2";   // force correct change
        case "vinyl":   StantonSCS3d.Vinyl(channel, StantonSCS3d.buttons["vinyl"], value, 0x80 + channel); break;
    }
}   // End Deck Change function

// ----------   Sliders  ----------

StantonSCS3d.S4relative = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) return;   // Skip if "Deck" is held down
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (currentMode=="vinyl2" && StantonSCS3d.vinyl2ScratchMethod=="scratch") {
        var group = "[Channel"+StantonSCS3d.deck+"]";
        var jogValue = (value-64);
        if (engine.getValue(group,"play")==1 && engine.getValue(group,"reverse")==1) jogValue= -(jogValue);

        var multiplier = StantonSCS3d.scratching["sensitivity"] * (engine.getValue(group,"play") ? 1 : StantonSCS3d.scratching["stoppedMultiplier"] );
//              if (StantonSCS3d.debug) print("do scratching VALUE:" + value + " jogValue: " + jogValue );
        multiplier = multiplier * 0.5;  // Reduce sensitivity of the slider since it's lower res
        engine.setValue(group,"scratch", (engine.getValue(group,"scratch") + (jogValue * multiplier)).toFixed(2));
    }
}

StantonSCS3d.S3absolute = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) { // Adjust the cue mix if "Deck" is held down
        var add = StantonSCS3d.BoostCut(7,(value-64)/63, -1.0, 0.0, 1.0, 3, 3);
        var byte1 = 0xB0 + channel;
        midi.sendShortMsg(byte1,0x0C,0x15+add);
        engine.setValue("[Master]","headMix",(value-64)/63);
        return;
    }
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    switch (currentMode) {
        case "fx": script.absoluteSlider("[Flanger]","lfoDepth",value,0,1); break;
        case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterLow",script.absoluteNonLin(value,0,1,4)); break;
    }
}

StantonSCS3d.S4absolute = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) { // Adjust the cross-fader if "Deck" is held down
        var add = StantonSCS3d.BoostCut(7,(value-64)/63, -1.0, 0.0, 1.0, 3, 3);
        var byte1 = 0xB0 + channel;
        midi.sendShortMsg(byte1,0x01,0x15+add);
        engine.setValue("[Master]","crossfader",(value-64)/63);
        return;
    }
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    switch (currentMode) {
        case "fx": script.absoluteSlider("[Flanger]","lfoDelay",value,50,10000); break;
        case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterMid",script.absoluteNonLin(value,0,1,4)); break;
        case "vinyl":   // Scratching
        case "vinyl2":
            // Set slider lights
            //var add = StantonSCS3d.Peak7(value,0,127);
            var add = (value/15)|0;
            var byte1 = 0xB0 + channel;
            midi.sendShortMsg(byte1,0x01,add); //S4 LEDs
            if (!StantonSCS3d.VUMeters || StantonSCS3d.deck!=1) midi.sendShortMsg(byte1,0x0C,add); //S3 LEDs
            if (!StantonSCS3d.VUMeters || StantonSCS3d.deck!=2)midi.sendShortMsg(byte1,0x0E,add); //S5 LEDs
            
            if (currentMode=="vinyl" || StantonSCS3d.vinyl2ScratchMethod == "a-b") {    // this is only for the alpha-beta filter implementation
                // Call global scratch slider function
                var newScratchValue = scratch.slider(StantonSCS3d.deck, value, StantonSCS3d.scratch["revtime"], StantonSCS3d.scratch["alpha"], StantonSCS3d.scratch["beta"]);
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch",newScratchValue);
            }
            break;
        case "loop":
        case "loop2":
        case "loop3":
            var button = 0x5C-2*Math.floor(value/32);
            if (StantonSCS3d.triggerS4==button) return; // prevent retriggering before releasing the button
            StantonSCS3d.S4buttonLights(channel,false,StantonSCS3d.triggerS4);  // Clear the previous lights
            StantonSCS3d.triggerS4 = button;
            StantonSCS3d.S4buttonLights(channel,true,button);
            
            var index = currentMode.charAt(currentMode.length-1);
            if (index != "2" && index != "3") index = "1";
            
//             if (StantonSCS3d.modifier[currentMode]==1) {
//                 StantonSCS3d.pitchPoints[index][button] = -0.1;
//                 break;
//             }
            if (StantonSCS3d.pitchPoints[index][button] == -0.1)
                StantonSCS3d.pitchPoints[index][button] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate");
            else {
                // Need 100% range for values to be correct
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",1.0);
                engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate",StantonSCS3d.pitchPoints[index][button]);
            }
            break;
            
        case "trig":
        case "trig2":
        case "trig3":
            // Free Bonus! Four extra buttons!
            var button = 0x5C-2*Math.floor(value/32);
            if (StantonSCS3d.triggerS4==button) return; // prevent retriggering before releasing the button
            StantonSCS3d.S4buttonLights(channel,false,StantonSCS3d.triggerS4);  // Clear the previous lights
            StantonSCS3d.triggerS4 = button;
            StantonSCS3d.S4buttonLights(channel,true,button);
            
            var index = currentMode.charAt(currentMode.length-1);
            if (index != "2" && index != "3") index = "1";
            
            if (StantonSCS3d.modifier[currentMode]==1) {
                if (StantonSCS3d.deck==1) StantonSCS3d.triggerPoints1[index][button] = -0.1;
                else StantonSCS3d.triggerPoints2[index][button] = -0.1;
                break;
            }
            if (StantonSCS3d.deck==1) {
                if (StantonSCS3d.triggerPoints1[index][button] == -0.1)
                    StantonSCS3d.triggerPoints1[index][button] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","playposition");
                else engine.setValue("[Channel"+StantonSCS3d.deck+"]","playposition",StantonSCS3d.triggerPoints1[index][button]); 
            break;
            }   // End deck 1
            else {
                if (StantonSCS3d.triggerPoints2[index][button] == -0.1)
                    StantonSCS3d.triggerPoints2[index][button] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","playposition");
                else engine.setValue("[Channel"+StantonSCS3d.deck+"]","playposition",StantonSCS3d.triggerPoints2[index][button]); 
            break;
            }
    }
}

StantonSCS3d.S5absolute = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) return;   // Ignore if "Deck" is held down
    switch (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"]) {
        case "fx": script.absoluteSlider("[Flanger]","lfoPeriod",value,50000,2000000); break;
        case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterHigh",script.absoluteNonLin(value,0,1,4)); break;
    }
}

StantonSCS3d.S5relative = function (channel, control, value) {
    if (StantonSCS3d.modifier["Deck"]==1) { // Adjust the headphone volume if "Deck" is held down
        var newValue = engine.getValue("[Master]","headVolume")+(value-64)/128;
        if (newValue<0.0) newValue=0.0;
        if (newValue>5.0) newValue=5.0;
        var add = StantonSCS3d.BoostCut(7,newValue, 0.0, 1.0, 5.0, 3, 3);
        var byte1 = 0xB0 + channel;
        midi.sendShortMsg(byte1,0x0E,0x15+add);
        engine.setValue("[Master]","headVolume",newValue);
        return;
    }
}

StantonSCS3d.C1touch = function (channel, control, value, status) {
    var byte1 = 0xB0 + channel;
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if ((status & 0xF0) == 0x90) {    // If button down
        switch (currentMode) {
//             case "vinyl":
            case "vinyl2":
                if (StantonSCS3d.vinyl2ScratchMethod == "a-b") scratch.enable(StantonSCS3d.deck);
                else {
                    StantonSCS3d.scratch["touching"] = true;
                    if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","play")==1) {
                        engine.setValue("[Channel"+StantonSCS3d.deck+"]","play",0);
                        engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch",(1+engine.getValue("[Channel"+StantonSCS3d.deck+"]","scratch")));  // So it ramps down when you touch
                        StantonSCS3d.scratch["wasPlaying"] = true;
                    }
                }
                break;
        }
    }
    else {  // If button up
        switch (currentMode) {
            case "vinyl": break;
            case "vinyl2":
                if (StantonSCS3d.vinyl2ScratchMethod == "a-b") scratch.disable(StantonSCS3d.deck);
                else StantonSCS3d.scratch["touching"] = false;
                break;
            default: midi.sendShortMsg(byte1,0x62,0x00); // Turn off C1 lights
                break;
        }
    }
}

StantonSCS3d.S3touch = function () {
    // Reset the value to center if the slider is touched while the mode button is held down
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier[currentMode]==1){
        switch (currentMode) {
            case "fx": engine.setValue("[Flanger]","lfoDepth",0.5); break;
            case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterLow",1); break;
        }
    }
}

StantonSCS3d.S4touch = function (channel, control, value, status) {
    if (StantonSCS3d.modifier["Deck"]==1) return;   // If we're modifying the cross-fader, ignore this touch
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier[currentMode]==1){ // If the current mode button is held down, reset the control to center
        switch (currentMode) {
            case "fx": engine.setValue("[Flanger]","lfoDelay",4950); break;
            case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterMid",1); break;
        }
    }
    if ((status & 0xF0) == 0x90) {    // If button down
        switch (currentMode) {
            case "vinyl":   // Store scratch info the point it was touched
            case "vinyl2":
                if (currentMode=="vinyl" || StantonSCS3d.vinyl2ScratchMethod == "a-b") scratch.enable(StantonSCS3d.deck);
                else {
                    StantonSCS3d.scratch["touching"] = true;
                    if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","play")==1) {
                        engine.setValue("[Channel"+StantonSCS3d.deck+"]","play",0);
                        engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch",(1+engine.getValue("[Channel"+StantonSCS3d.deck+"]","scratch")));  // So it ramps down when you touch
                        StantonSCS3d.scratch["wasPlaying"] = true;
                    }
                }
                break;
            case "vinyl3":  // Load the song
                // If the deck is playing and the cross-fader is not completely toward the other deck...
                if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","play")==1 &&
                ((StantonSCS3d.deck==1 && engine.getValue("[Master]","crossfader")<1.0) || 
                (StantonSCS3d.deck==2 && engine.getValue("[Master]","crossfader")>-1.0))) {
                    // ...light just the red button LEDs to show acknowledgement of the press but don't load
                    var byte1 = 0x90 + channel;
                    midi.sendShortMsg(byte1,0x56,0x01);
                    midi.sendShortMsg(byte1,0x5c,0x01);
                    print ("StantonSCS3d: Not loading into deck "+StantonSCS3d.deck+" because it's playing to the Master output.");
                }
                else {
                    StantonSCS3d.S4buttonLight(channel,true);
//                     engine.setValue("[Playlist]","LoadSelectedIntoFirstStopped",1);
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","LoadSelectedTrack",1);
                }
                break;
        }
        return;
    }
    // If button up
    switch (currentMode) {
        case "vinyl":   // Reset the triggers
        case "vinyl2":
            if (currentMode=="vinyl" || StantonSCS3d.vinyl2ScratchMethod == "a-b") scratch.disable(StantonSCS3d.deck);
            else StantonSCS3d.scratch["touching"] = false;
            var byte1a = 0xB0 + channel;
            midi.sendShortMsg(byte1a,0x01,0x00); //S4 LEDs off
            if (!StantonSCS3d.VUMeters || StantonSCS3d.deck!=1) midi.sendShortMsg(byte1a,0x0C,0x00); //S3 LEDs off
            if (!StantonSCS3d.VUMeters || StantonSCS3d.deck!=2) midi.sendShortMsg(byte1a,0x0E,0x00); //S5 LEDs off
            break;
        case "vinyl3":
            engine.setValue("[Playlist]","LoadSelectedIntoFirstStopped",0);
            StantonSCS3d.S4buttonLight(channel,false);
            if (StantonSCS3d.jogOnLoad) {   // Auto-change to vinyl jog mode on track load
                // ...only if we actually loaded a track.
                if (engine.getValue("[Channel"+StantonSCS3d.deck+"]","play")==1 &&
                ((StantonSCS3d.deck==1 && engine.getValue("[Master]","crossfader")<1.0) || 
                (StantonSCS3d.deck==2 && engine.getValue("[Master]","crossfader")>-1.0))) return;
                
                StantonSCS3d.modifier["time"] = 0.0;
                StantonSCS3d.Vinyl(channel, StantonSCS3d.buttons["vinyl"], value, 0x80 + channel);
            }
            break;
        case "loop":
        case "loop2":
        case "loop3":
        case "trig":
        case "trig2":
        case "trig3":
            StantonSCS3d.S4buttonLights(channel,false,StantonSCS3d.triggerS4);
            StantonSCS3d.triggerS4 = 0xFF;
            break;
    }
}

// Reset the value to center if the slider is touched while the mode button is held down
StantonSCS3d.S5touch = function () {
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier[currentMode]==1){
        switch (currentMode) {
            case "fx": engine.setValue("[Flanger]","lfoPeriod",1025000); break;
            case "eq": engine.setValue("[Channel"+StantonSCS3d.deck+"]","filterHigh",1); break;
        }
    }
}

StantonSCS3d.S4buttonLight = function (channel, light) {     // Turn on/off button lights
    var byte1 = 0x90 + channel;
    var color=0x00; // Off
    if (light) color=0x01;  // On
    midi.sendShortMsg(byte1,0x64,color);
    midi.sendShortMsg(byte1,0x65,color);
    midi.sendShortMsg(byte1,0x5d,color);
    midi.sendShortMsg(byte1,0x6c,color);
    midi.sendShortMsg(byte1,0x56,color);
    midi.sendShortMsg(byte1,0x5c,color);
}

StantonSCS3d.S4buttonLights = function (channel, light, button) {     // Turn on/off button lights for multiple buttons
    var marker;
    var byte1 = 0x90 + channel;
    var color=0x00; // Off
    if (light) color=0x01;  // On
    
    // Turn on/off button LED
    if (StantonSCS3d.markHotCues == "red") marker = StantonSCS3d.buttonLEDs[button];
    else marker = button;
    midi.sendShortMsg(byte1,marker,color);
    
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    var index = currentMode.charAt(currentMode.length-1);
    if (index != "2" && index != "3") index = "1";
    
    // Don't extinguish the marker LED if a cue point is set on that button
    if (currentMode.substring(0,4) == "trig")
        if (!light && (StantonSCS3d.deck==1 && StantonSCS3d.triggerPoints1[index][button] != -0.1) ||
            (StantonSCS3d.deck==2 && StantonSCS3d.triggerPoints2[index][button] != -0.1)) return;
    
    // Turn on/off corresponding marker LED
    if (StantonSCS3d.markHotCues == "red") marker = button;
    else marker = StantonSCS3d.buttonLEDs[button];
    midi.sendShortMsg(byte1,marker,color);
}

StantonSCS3d.C1relative = function (channel, control, value, status) {
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    switch (currentMode) {
        case "vinyl":
            if (StantonSCS3d.modifier["Deck"]==1) return;   // ignore if the cross-fader is being adjusted
            var newValue=(value-64);
//             print("C1="+value+", jog="+newValue);
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","jog",newValue);
            break;
        case "vinyl2":
            if (StantonSCS3d.vinyl2ScratchMethod != "scratch") break;   // This is only for the "scratch" method implementation
            var group = "[Channel"+StantonSCS3d.deck+"]";
            var jogValue = (value-64);
            if (engine.getValue(group,"play")==1 && engine.getValue(group,"reverse")==1) jogValue= -(jogValue);
            
            var multiplier = StantonSCS3d.scratching["sensitivity"] * (engine.getValue(group,"play") ? 1 : StantonSCS3d.scratching["stoppedMultiplier"] );
//              if (StantonSCS3d.debug) print("do scratching VALUE:" + value + " jogValue: " + jogValue );
            engine.setValue(group,"scratch", (engine.getValue(group,"scratch") + (jogValue * multiplier)).toFixed(2));
            break;
        case "vinyl3":
            if (StantonSCS3d.modifier["Deck"]==1) return;   // ignore if the cross-fader is being adjusted
            if ((value-64)>0) {
                engine.setValue("[Playlist]","SelectNextTrack",1);
            }
            else {
                engine.setValue("[Playlist]","SelectPrevTrack",1);
            }
            break;
    }
}

StantonSCS3d.C1absolute = function (channel, control, value, status) {
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    switch (currentMode) {
        case "vinyl":
//             // Slower response for jog wheel
//             var newValue = scratch.wheel(StantonSCS3d.deck, value, 1.8, StantonSCS3d.scratch["alpha"], 1.0);
//             print("StantonSCS3d: newValue="+newValue);
//             engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch",newValue);
            break;
        case "vinyl2": 
            if (StantonSCS3d.vinyl2ScratchMethod != "a-b") break;   // this is only for the alpha-beta filter implementation
            // ignore if the cross-fader is being adjusted
            if (StantonSCS3d.modifier["Deck"]==1 && ((value>52 && value<76) || (value>119 || value<10))) return;
            
            // Call global scratch wheel function
            var newScratchValue = scratch.wheel(StantonSCS3d.deck, value, StantonSCS3d.scratch["revtime"], StantonSCS3d.scratch["alpha"], StantonSCS3d.scratch["beta"]);
                
            engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch",newScratchValue);
            break;
        default:
            // Light the LEDs
            var byte1 = 0xB0 + channel;
            var light = Math.floor(value/8)+1;
            midi.sendShortMsg(byte1,0x62,light);
            break;
    }
}

// ----------   Surface buttons  ----------

StantonSCS3d.SurfaceButton = function (channel, control, value, status) {
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    var byte1 = 0x90 + channel;
    
    var index = currentMode.charAt(currentMode.length-1);
    if (index != "2" && index != "3") index = "1";
    
    if ((status & 0xF0) != 0x80) {    // If button down
        midi.sendShortMsg(byte1,control,0x01); // Turn on button lights
        midi.sendShortMsg(byte1,StantonSCS3d.buttonLEDs[control],0x01);
        switch (currentMode) {
            case "loop":
            case "loop2":
            case "loop3":
                // Multiple pitch points
                
//                 if (StantonSCS3d.modifier[currentMode]==1) {    // Delete a pitch point if the mode button is held
//                     StantonSCS3d.pitchPoints[index][button] = -0.1;
//                     break;
//                 }
                if (StantonSCS3d.pitchPoints[index][control] == -0.1)
                    StantonSCS3d.pitchPoints[index][control] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate");
                else {
                    // Need 100% range for values to be correct
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","rateRange",1.0);
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","rate",StantonSCS3d.pitchPoints[index][control]); 
                }
                break;
            case "trig":
            case "trig2":
            case "trig3":
                    // Multiple cue points
                    if (StantonSCS3d.modifier[currentMode]==1) {
                        if (StantonSCS3d.deck==1) StantonSCS3d.triggerPoints1[index][control] = -0.1;
                        else StantonSCS3d.triggerPoints2[index][control] = -0.1;
                        break;
                    }
                    if (StantonSCS3d.deck==1) {
                        if (StantonSCS3d.triggerPoints1[index][control] == -0.1)
                            StantonSCS3d.triggerPoints1[index][control] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","playposition");
                        else engine.setValue("[Channel"+StantonSCS3d.deck+"]","playposition",StantonSCS3d.triggerPoints1[index][control]); 
                    break;
                    }   // End deck 1
                    else {
                        if (StantonSCS3d.triggerPoints2[index][control] == -0.1)
                            StantonSCS3d.triggerPoints2[index][control] = engine.getValue("[Channel"+StantonSCS3d.deck+"]","playposition");
                        else engine.setValue("[Channel"+StantonSCS3d.deck+"]","playposition",StantonSCS3d.triggerPoints2[index][control]); 
                    break;
                    }
        }
        return;
    }
    var marker;
    if (StantonSCS3d.markHotCues == "red") marker = StantonSCS3d.buttonLEDs[control];
    else marker = control;
    midi.sendShortMsg(byte1,marker,0x00); // Turn off activated button LED
    // Don't extinguish the marker LED if a cue point isn't set on that button
    if (currentMode.substring(0,4)=="trig") {
        if ((StantonSCS3d.deck==1 && StantonSCS3d.triggerPoints1[index][control] != -0.1) ||
            (StantonSCS3d.deck==2 && StantonSCS3d.triggerPoints2[index][control] != -0.1)) return;
    }
    if (StantonSCS3d.markHotCues == "red") marker = control;
    else marker = StantonSCS3d.buttonLEDs[control];
    midi.sendShortMsg(byte1,marker,0x00);
}


// ----------   LED slot functions  ----------

StantonSCS3d.buttonLED = function (value, note, on, off) {
    var byte1 = 0x90 + StantonSCS3d.channel;
    if (value>0) midi.sendShortMsg(byte1,note,on);
    else midi.sendShortMsg(byte1,note,off);
}

// Transport buttons

StantonSCS3d.playLED = function (value) {
    StantonSCS3d.buttonLED(value, 0x6D, 0x01, 0x00);
}

StantonSCS3d.cueLED = function (value) {
    StantonSCS3d.buttonLED(value, 0x6E, 0x01, 0x00);
}

StantonSCS3d.syncLED = function (value) {
    StantonSCS3d.buttonLED(value, 0x6F, 0x01, 0x00);
}

// Soft buttons

StantonSCS3d.B11LED = function (value) {
    StantonSCS3d.buttonLED(value, 0x2C, 0x01, 0x02);
}

StantonSCS3d.B12LED = function (value) {
    StantonSCS3d.buttonLED(value, 0x2E, 0x01, 0x02);
}

StantonSCS3d.B13LED = function (value) {
    StantonSCS3d.buttonLED(value, 0x30, 0x01, 0x02);
}

StantonSCS3d.B14LED = function (value) {
    StantonSCS3d.buttonLED(value, 0x32, 0x01, 0x02);
}

StantonSCS3d.BoostCut = function (numberLights, value, low, mid, high, lowMidSteps, midHighSteps) {
    var LEDs = 0;
    var lowMidInterval = (mid-low)/(lowMidSteps*2);     // Half the actual interval so the LEDs light in the middle of the interval
    var midHighInterval = (high-mid)/(midHighSteps*2);  // Half the actual interval so the LEDs light in the middle of the interval
    value=value.toFixed(4);
    if (value>low) LEDs++;
    if (value>low+lowMidInterval) LEDs++;
    if (value>low+lowMidInterval*3) LEDs++;
    if (numberLights==9 && value>low+lowMidInterval*5) LEDs++;
    if (value>mid+midHighInterval) LEDs++;
    if (value>mid+midHighInterval*3) LEDs++;
    if (numberLights==9 && value>mid+midHighInterval*5) LEDs++;
    if (value>=high) LEDs++;
    return LEDs;
}

StantonSCS3d.Peak7 = function (value, low, high) {
    var LEDs = 0;
    var halfInterval = ((high-low)/6)/2;
    value=value.toFixed(4);
    if (value>low) LEDs++;
    if (value>low+halfInterval) LEDs++;
    if (value>low+halfInterval*3) LEDs++;
    if (value>low+halfInterval*5) LEDs++;
    if (value>low+halfInterval*7) LEDs++;
    if (value>low+halfInterval*9) LEDs++;
    if (value>=high) LEDs++;
    return LEDs;
}

StantonSCS3d.EQLowLEDs = function (value) {
    var add = StantonSCS3d.BoostCut(7,value, 0, 1, 4, 3, 3);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x0C,0x15+add);
}

StantonSCS3d.EQMidLEDs = function (value) {
    var add = StantonSCS3d.BoostCut(7,value, 0, 1, 4, 3, 3);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x01,0x15+add);
}

StantonSCS3d.EQHighLEDs = function (value) {
    var add = StantonSCS3d.BoostCut(7,value, 0, 1, 4, 3, 3);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x0E,0x15+add);
}

StantonSCS3d.FXDepthLEDs = function (value) {
    var add = StantonSCS3d.Peak7(value,0,1);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x0C,0x28+add);
}

StantonSCS3d.FXDelayLEDs = function (value) {
    var add = StantonSCS3d.Peak7(value,50,10000);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x01,0x28+add);
}

StantonSCS3d.FXPeriodLEDs = function (value) {
    var add = StantonSCS3d.Peak7(value,50000,2000000);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x0E,0x28+add);
}

StantonSCS3d.VUMeterLEDs = function (value) {
    if (!StantonSCS3d.VUMeters) return;
    if (StantonSCS3d.modifier["Deck"]==1) return;   // If the Deck button is held down, ignore this.
    var add = StantonSCS3d.Peak7(value,0,1);
    var byte1 = 0xB0 + StantonSCS3d.channel;
    if (StantonSCS3d.deck==2) midi.sendShortMsg(byte1,0x0E,0x28+add);
    else midi.sendShortMsg(byte1,0x0C,0x28+add);
}

StantonSCS3d.pitchLEDs = function (value) {
    var LEDs = 0;
    if (value>=-1) LEDs++;
    if (value>-0.78) LEDs++;
    if (value>-0.56) LEDs++;
    if (value>-0.33) LEDs++;
    if (value>-0.11) LEDs++;
    if (value>0.11) LEDs++;
    if (value>0.33) LEDs++;
    if (value>0.56) LEDs++;
    if (value>0.78) LEDs++;
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x03,0x14+LEDs);
}

StantonSCS3d.gainLEDs = function (value) {
    // Skip if displaying something else
    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.modifier["Deck"]==1 || StantonSCS3d.modifier[currentMode]==1) return;
    
    var LEDs = 0;
    if (value>0.01) LEDs++;
    if (value>0.13) LEDs++;
    if (value>0.26) LEDs++;
    if (value>0.38) LEDs++;
    if (value>0.50) LEDs++;
    if (value>0.63) LEDs++;
    if (value>0.75) LEDs++;
    if (value>0.88) LEDs++;
    if (value>=1) LEDs++;
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x07,0x28+LEDs);
}

StantonSCS3d.MasterVolumeLEDs = function (value) {
    var LEDs = 0;
    var mid = 1.0;
    var lowMidInterval = 1/8;   // Half the actual interval so the LEDs light in the middle of the interval
    var midHighInterval = 4/8;  // Half the actual interval so the LEDs light in the middle of the interval
    if (value>0.0) LEDs++;
    if (value>lowMidInterval) LEDs++;
    if (value>lowMidInterval*3) LEDs++;
    if (value>lowMidInterval*5) LEDs++;
    if (value>lowMidInterval*7) LEDs++;
    if (value>mid+midHighInterval) LEDs++;
    if (value>mid+midHighInterval*3) LEDs++;
    if (value>mid+midHighInterval*5) LEDs++;
    if (value>mid+midHighInterval*7) LEDs++;
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x07,0x28+LEDs);
}

StantonSCS3d.pitchSliderLED = function (value) {
    var byte1 = 0x90 + StantonSCS3d.channel;
    switch (true) {
        case (value<=StantonSCS3d.pitchRanges[0]):
                midi.sendShortMsg(byte1,0x3D,0x00);  // Pitch LED black
                midi.sendShortMsg(byte1,0x3E,0x00);
            break;
        case (value<=StantonSCS3d.pitchRanges[1]):
                midi.sendShortMsg(byte1,0x3D,0x00);  // Pitch LED blue
                midi.sendShortMsg(byte1,0x3E,0x01);
            break;
        case (value<=StantonSCS3d.pitchRanges[2]):
                midi.sendShortMsg(byte1,0x3D,0x01);  // Pitch LED purple
                midi.sendShortMsg(byte1,0x3E,0x01);
            break;
        case (value>=StantonSCS3d.pitchRanges[3]):
                midi.sendShortMsg(byte1,0x3D,0x01);  // Pitch LED red
                midi.sendShortMsg(byte1,0x3E,0x00);
            break;
    }
}

StantonSCS3d.circleLEDs1 = function (value) {
    if (StantonSCS3d.deck!=1) return;
    StantonSCS3d.circleLEDs(value);
}

StantonSCS3d.circleLEDs2 = function (value) {
    if (StantonSCS3d.deck!=2) return;
    StantonSCS3d.circleLEDs(value);
}

StantonSCS3d.durationChange1 = function (value) {
    StantonSCS3d.trackDuration[1]=value;
}

StantonSCS3d.durationChange2 = function (value) {
    StantonSCS3d.trackDuration[2]=value;
}

StantonSCS3d.circleLEDs = function (value) {
    if (StantonSCS3d.vinyl2ScratchMethod != "a-b") StantonSCS3d.wheelDecay(value); // Take care of scratching

    var currentMode = StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"];
    if (StantonSCS3d.spinningPlatterOnlyVinyl) {    // Skip if not in vinyl mode
        if (currentMode != "vinyl" && currentMode != "vinyl2") return;
    } else {    // Skip if in LOOP, TRIG, or VINYL3 modes since they use the circle LEDs
        if (currentMode == "vinyl3" || currentMode.substring(0,4) == "loop" ||
        currentMode.substring(0,4) == "trig") return;
    }
    
    // Revolution time of the imaginary record in seconds
//     var revtime = StantonSCS3d.scratch["revtime"]/2;    // Use this for two lights
    var revtime = StantonSCS3d.scratch["revtime"];
    var currentTrackPos = value * StantonSCS3d.trackDuration[StantonSCS3d.deck];
    
    var revolutions = currentTrackPos/revtime;
//     var light = ((revolutions-(revolutions|0))*8)|0;    // Use this for two lights
    var light = ((revolutions-(revolutions|0))*16)|0;   // OR with 0 replaces Math.floor and is faster

    if (StantonSCS3d.lastLight[StantonSCS3d.deck]==light) return;   // Don't send light commands if there's no visible change
    
    var byte1 = 0xB0 + StantonSCS3d.channel;
    midi.sendShortMsg(byte1,0x62,0x00);     // Clear circle lights
    var byte1 = 0x90 + StantonSCS3d.channel;
    StantonSCS3d.lastLight[StantonSCS3d.deck]=light;
    midi.sendShortMsg(byte1,0x5d+light,0x01);
//     midi.sendShortMsg(byte1,0x65+light,0x01);   // Add this for two lights
}

StantonSCS3d.wheelDecay = function (value) {

    if (StantonSCS3d.mode_store["[Channel"+StantonSCS3d.deck+"]"]=="vinyl2") {    // Only in Vinyl2 mode
        var scratch = engine.getValue("[Channel"+StantonSCS3d.deck+"]","scratch");
        var jogDecayRate = StantonSCS3d.scratching["slippage"] * (engine.getValue("[Channel"+StantonSCS3d.deck+"]","play") ? 1 : 1.1 );
        
        if (StantonSCS3d.debug) print("Scratch deck"+StantonSCS3d.deck+": " + scratch + ", Jog decay rate="+jogDecayRate);
        
        // If it was playing, ramp back to playback speed
        if (StantonSCS3d.scratch["wasPlaying"] && !StantonSCS3d.scratch["touching"]) {
            var rate = engine.getValue("[Channel"+StantonSCS3d.deck+"]","rate") * engine.getValue("[Channel"+StantonSCS3d.deck+"]","rateRange");
            var convergeTo = 1+rate;
            //jogDecayRate = StantonSCS3d.scratching["slippage"] * 0.2;
            if (scratch != convergeTo) { // Thanks to jusics on IRC for help with this part
                if (Math.abs(scratch-convergeTo) > jogDecayRate*0.001) {  
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch", (convergeTo + (scratch-convergeTo) * jogDecayRate).toFixed(5));
                    //engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch", (scratch + (convergeTo - scratch) / jogDecayRate).toFixed(5));
                } else {
                    // Once "scratch" has gotten close enough to the play speed, just resume normal playback
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch", 0);
                    engine.setValue("[Channel"+StantonSCS3d.deck+"]","play",1);
                    StantonSCS3d.scratch["wasPlaying"] = false;
                }
            }
        } else
        if (scratch != 0) { // For regular scratching when stopped or if playing (and ramp down...touch functions set scratch=1 and play=0)
            if (Math.abs(scratch) > jogDecayRate*0.001) {  
                  engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch", (scratch * jogDecayRate).toFixed(4));
               } else {
                  engine.setValue("[Channel"+StantonSCS3d.deck+"]","scratch", 0);
               }
        }
    }
}