let myAudio;
let ssp;
let otherAudios = {};
let audible = [];
let thisZone = 0; //default to Microphone User
let p5lm;
let audioID = {};
let isTalking = false;

function setup() {
  noCanvas();
  
  // Use constraints to request audio from createCapture
  let constraints = {
    audio: true,
    video: false,
    echocancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  };
  
  navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
    myAudio = createCapture(constraints, function(stream) {
      console.log("Microphone access granted.");
      p5lm = new p5LiveMedia(this, "CAPTURE", stream, "yard-intercom");
      p5lm.on('stream', gotStream);
      p5lm.on('data', gotData);
      p5lm.on('disconnect', gotDisconnect);
      
    });
    
    if (myAudio) {
      console.log("doing this");
        myAudio.elt.muted = true;
        myAudio.elt.volume = 1.0;
        myAudio.hide();
    }
  }).catch(function(err) {
    noMicrophone();
    console.log(otherAudios)
    console.log("No microphone found or permission denied:", err);
    
  });
}

function noMicrophone() {
  // Initialize p5LiveMedia in listener-only mode (no capture)
  p5lm = new p5LiveMedia(this, "LISTENER", null, "yard-intercom");
  p5lm.on('stream', gotStream);
  p5lm.on('data', gotData);
  p5lm.on('disconnect', gotDisconnect);
  console.log("Initialized in listener-only mode.");
}

function gotStream(stream, id) {
  console.log("Got stream from peer:", id);
  otherAudios[id] = stream;
  otherAudios[id].elt.muted = true; // mute by default
  otherAudios[id].hide();
}

function gotDisconnect(id) {
  if (otherAudios[id]) {
    otherAudios[id].remove();
    delete otherAudios[id];
  }
}

muteButton = document.getElementById("mute");
muteButton.addEventListener("click", toggleMute);

function toggleMute() {
  if (!isTalking) {
    muteButton.innerText = "Mute";
    muteButton.style.backgroundColor = "red";
    p5lm.send(JSON.stringify(audible)); //send current audible array when unmuted
    isTalking = true;
    //p5lm.send(JSON.stringify(audible))
  } else {
    muteButton.innerText = "Talk";
    muteButton.style.backgroundColor = "green";
    p5lm.send(JSON.stringify([])); //send empty array when muted
    isTalking = false;
  }
}

function joinRoom() {
  console.log("user-interaction");
}

form = document.querySelector("#zoneForm");
form.addEventListener("submit", function(event) {
  event.preventDefault();
  const selectedRadio = document.querySelector('input[name="thisZone"]:checked');
  thisZone = selectedRadio ? parseInt(selectedRadio.value) : 0;
  console.log("thisZone is now", thisZone);
});

//loop through checkboxes and add to audible array
form = document.querySelector("#destinationForm");
form.addEventListener("change", function(event) {
  audible = [];
  const checkboxes = document.querySelectorAll('input[name="destination"]');
  
  checkboxes.forEach((checkbox, index) => {
    if (checkbox.checked) {
      audible.push(index); // Add 1 to index to match zone numbers
    }
  });
  if (isTalking) {
    p5lm.send(JSON.stringify(audible)); //send updated audible array if talking
  }
  //p5lm.send(JSON.stringify(audible));
  
});

function gotData(data, id) {
  try {
    // Parse incoming data
    let dataObj = JSON.parse(data);
    let dataArray = dataObj.zones || dataObj; // Handle both formats
    
    console.log("Received from", id, ":", dataArray);
    
    // Check if this zone should hear the sender
    if (Array.isArray(dataArray) && dataArray.includes(thisZone) || dataArray.includes(0)) {
      console.log("Unmuting audio from peer:", id);
      if (otherAudios[id]) {
        otherAudios[id].elt.muted = false;
        otherAudios[id].elt.volume = 1.0;
      }
    } else {
      console.log("Muting audio from peer:", id);
      if (otherAudios[id]) {
        otherAudios[id].elt.muted = true;
      }
    }
  } catch (e) {
    console.error("Error parsing data:", e);
  }
}

